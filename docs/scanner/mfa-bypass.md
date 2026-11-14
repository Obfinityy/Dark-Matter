# MFA Bypass Probe

## What it is

Multi-factor authentication that can be skipped is a broken second factor,
not a second factor at all. This probe tests whether a shop's 2FA step is
actually enforced, using only predefined requests against the shop's own
API — no AI, no browser required. It covers coverage rows **#46
[Critical] MFA Bypass** and **#327 [Critical] Auth — 2FA bypass via
direct endpoint access** (AUTH-08, OWASP A07:2021, CWE-287), plus
**BIZ-12 OTP Reuse** (row #46 family) as a High leg.

OTP brute-force (row #326) is **not** re-implemented here — the
`twofa-bruteforce` phase already owns it (10 wrong codes, confirm only
on 10/10 ordinary invalid-code answers). Predictable/sequential OTP
(row #368) is not directly observable without a delivered code and
belongs to the crypto token-supply lane (PR #520).

## Detection surface

The probe mines the scanner's recon route set (`apiRoutes`) for the
shop's 2FA surface and classifies it — it never invents routes:

- verify: `/rest/2fa/verify`, `/2fa/verify`, `/api/2fa/verify`, … (2FA verify)
- status: `/rest/2fa/status`, `/2fa/status`, … (enrollment state)
- setup: `/rest/2fa/setup`, `/2fa/setup`, …
- disable: `/rest/2fa/disable`, `/2fa/disable`, …
- recovery: `recovery-code/verify`, `backup-code`, … (recovery-code verify)
- protected: mined API routes whose path hints at an authenticated
  resource (`/api/Users`, `/rest/user/profile`, `/api/admin`, …)
- sensitive: `change-password`, `change-email`, `update-email`,
  `payment`, `withdraw`, … (state-changing mutations)

It then logs in with the lab canary (`opts.labCreds`, lab-gated:
`labCreds` + `allowWrite` + `isLabTargetHost`, standard/deep depth
only — quick skips) and works the legs below.

## Legs

### L0. MFA enrolled but login never challenges — CRITICAL

**Oracle:** `GET /rest/2fa/status` says `setup: true`, but login returns
a full Bearer token with no `tmpToken` and no `totp_token_required`
status — and that token opens a protected route the anonymous control
cannot (anonymous request refused, token request granted with a
substantive body that differs from the anonymous body).

**Reference:** OWASP A07:2021, CWE-287 (improper authentication).

### L1. MFA step skippable via direct endpoint access — CRITICAL

**Oracle (differential, 100% truth rule):** login is MFA-pending (a
`tmpToken` is issued, or the login status is `totp_token_required`).
Before any code is verified, the pre-MFA credential — the Bearer token
issued alongside the `tmpToken`, and the `tmpToken` itself as a Bearer
token — is replayed on a mined protected route:
- Control: the same route with no credential → expect 401/403.
- Pre-MFA replay → if 2xx with a substantive body (≥50 chars or an
  identity field) that differs from the anonymous body → **CONFIRMED**.

**Reference:** row #327; CWE-287; PortSwigger "2FA bypass using a
brute-force attack" / direct-access variants.

### L2. MFA not enforced on sensitive actions — CRITICAL

**Oracle:** the same pre-MFA credential is replayed on a mined
sensitive mutation (password change, email change, payment) with the
new value equal to the current value (a no-op — **nothing is really
changed**). Confirm only on a 2xx success marker; a 401/403 is the
expected control answer.

**Reference:** OWASP A07:2021; CWE-863 (incorrect authorization).

### L3. OTP reuse across sessions — HIGH (BIZ-12)

**Oracle:** when 2FA is off but the status endpoint discloses the
TOTP secret in-band, the probe enrolls the canary itself (setup with
the password + a code computed from the disclosed secret), re-logs
in, verifies once with a fresh code, then **replays the same code
with the same `tmpToken`**. Confirm only if the replay also succeeds
(2xx + a Bearer token). A "code already used" answer is the correct
negative. 2FA is disabled again afterwards; `restoreOk` records
whether the lab is back to `setup: false`.

**Reference:** RFC 6238 (TOTP is single-use by construction);
CWE-307 (improper restriction of excessive authentication attempts).

### L5. Recovery-code verify without rate limiting — HIGH

**Oracle:** reuses the `twofa-bruteforce` wrong-code oracle — 10
distinct wrong recovery codes, confirm only on 10/10 ordinary
invalid-code answers with no 429 / lockout / CAPTCHA / sudden-403
signal anywhere. The first throttle signal stops the leg with no
finding.

**Reference:** CWE-307; OWASP A07:2021.

### L6. MFA enrollment bypass — CRITICAL

**Oracle:** with the status-disclosed secret in hand, enrollment is
attempted with the fixed wrong code `000000`. Confirm only on a 2xx
enrollment-success answer. A 400 "Invalid code" — or, on Juice, a
401 — is the correct negative. The canary is enrolled for real
afterwards (to run L3/L7), then disabled again; `restoreOk` records
the restore.

**Reference:** CWE-287.

### L7. Overly broad TOTP validity window — MEDIUM

**Oracle:** with a fresh login `tmpToken` for each try, codes at
T−2 and T+2 steps (60 seconds out) are submitted. Confirm only if
either verifies. T±1 is normal clock-skew tolerance and is never a
finding. Requires the server-disclosed secret (see L3); the probe
never guesses a valid code.

**Reference:** RFC 6238 §5.2 (validation window); CWE-307.

## What counts as proof

Per the 100% truth rule, every leg confirms only on a differential
oracle:

- **CONFIRMED (bypass classes):** `evidence.bypassWorks === true` —
  the pre-MFA credential (or the wrong code, or the replayed code)
  opened something the control could not.
- **CONFIRMED (reuse/window classes):** `evidence.signalCorrelated
  === true` — the replay / far-out code verified, and the control
  (wrong code, used code) did not.
- Every finding carries `evidence.request` / `evidence.response`
  pairs for the malicious call **and** the control call.

## Gates and safety

- Lab-gated: needs `labCreds` + `allowWrite` + a lab target host,
  standard/deep depth only. On a shop with no 2FA surface the probe
  returns `[]` before any login.
- Post cap: **24 POSTs** per run (logins + setup + verify + recovery
  + disable). Protected-route replay is capped at 5 routes × 2 GETs.
- Sensitive-action mutations are no-ops (new value == current
  value). The enrollment legs restore the lab (disable 2FA) in a
  `finally` block; if the disable fails, `restoreOk` is `false` and
  the operator re-disables by hand.
- Codes are computed **only** from a server-disclosed secret (RFC
  6238, verified against the RFC test vectors in the test file), or
  are fixed wrong values. The probe never guesses a valid code.

## Live re-proof (14 Nov 2026, EC2 labs)

Driver: `~/workspace/dm-v2/probes/mfa-diag-driver.mjs` (direct probe
calls with explicit routes) + `mfa-trace-driver.mjs` (raw
request/response trace) + `mfa-reproof-driver.mjs` (full standard
battery via `runScan`).

### Juice Shop findings — lab re-proof evidence (NOT bounty findings)

Juice Shop is a deliberately vulnerable training lab. The two
findings below are real vulnerabilities in the LAB deployment; they
prove the probe's legs fire on real behaviour. They are **not**
real-product vulnerabilities — do not file them and do not count
them toward any bounty total.

1. **L1 [Critical] — the MFA-pending `tmpToken` JWT opens
   `/api/Users`:** anonymous `GET /api/Users` → 401; the same
   route with the `tmpToken` as a Bearer token → **200 with the
   full user list** (emails, roles). Juice's auth middleware
   accepts any valid JWT as a session token without checking that
   the second factor was completed (the token's type is
   `password_valid_needs_second_factor_token`).
2. **L3 [High] — a consumed TOTP code verifies a second time:**
   `POST /rest/2fa/verify {tmpToken, totpToken}` → 200 with a
   session token; the **identical code + identical tmpToken**
   immediately replayed → **200 again with a fresh session
   token**. Juice never marks a code (or tmpToken) as consumed.

Controls on the same lab (all correctly negative): L2
change-password with a pre-MFA credential → HTTP 500, not a
success; L6 setup with `000000` → 401; L7 a code two steps out
(T−2) → 401. T±1 tolerance is never a finding.

### The 401 pending-login quirk

On Juice, an MFA-pending login answers **HTTP 401** with status
`totp_token_required` + `tmpToken` and **no Bearer token at all**.
The probe's first version discarded 401/400 login responses
before reading the pending signal, so it never obtained a
tmpToken and L1/L2/L3/L7 were unreachable. Fixed 14 Nov 2026:
`tryApiLogin` now reads the pending signal (`findMfaPending`)
on every login response before the 401/400 skip. Regression
tests MFB-22 (401 pending login still yields the tmpToken, L1
fires) and MFB-23 (plain 401 login stays silent).

### Route-supply gap (remaining, not fixed by this lane)

On Juice the JS-bundle miner (`js-api-routes`, capped at 20
targets + 20 writeTargets) surfaces `/rest/2fa/verify` and
`/rest/2fa/status` only. `/rest/2fa/setup` and `/rest/2fa/disable`
are in `main.js` (one occurrence each) but fall outside the cap,
and Juice's `/api-docs` carries **zero** `2fa` mentions, so the
OpenAPI step cannot supply them either. In a full scan the probe
therefore sees `mfaRoutes: 2`, logs in, reads the status, and
stops before the enrollment legs — the legs are proven live via
the explicit-routes driver, but a full scan cannot engage them
until the miner's cap/order is addressed (scanner-wide change,
own lane — raising the cap would shift every probe's route set
and the 31/0 + 21/0 lab baselines).

### Full-scan result (re-run with the login fix)

- Juice Shop: full standard battery, errors `[]`, total
  confirmed findings **31** (unchanged baseline — the probe adds
  no false positives on mined routes); `mfa-bypass` phase
  `mfaRoutes: 2`, 0 findings; Juice 2FA left OFF (`setup: false`).
- DVWA: full standard battery, errors `[]`, total confirmed
  findings **21** (unchanged baseline); `mfa-bypass` phase
  `mfaRoutes: 0`, 0 findings — no 2FA surface, as designed.

## What it does not cover

- OTP brute-force (#326) — owned by `twofa-bruteforce`.
- Predictable/sequential OTP (#368) — needs a delivered code;
  belongs to the crypto token-supply lane (PR #520).
- MFA missing entirely (row #48 Missing MFA) — a policy gap, not a
  bypass; the probe reports nothing when there is no 2FA surface.
- Biometric / hardware-key factors — out of scope for a rule-based
  HTTP probe.

## References

- OWASP Top 10:2025 A07 — Identification and Authentication Failures
- CWE-287 (Improper Authentication), CWE-307, CWE-863
- RFC 6238 (TOTP), RFC 4226 (HOTP)
- PortSwigger Web Security Academy: 2FA bypass labs
- Juice Shop: `/rest/2fa/verify`, `/rest/2fa/status`,
  `/rest/2fa/setup`, `/rest/2fa/disable` (the lab ground truth for
  this probe — the status endpoint discloses the TOTP secret
  in-band, which is what makes the enrollment-mediated legs
  testable)
