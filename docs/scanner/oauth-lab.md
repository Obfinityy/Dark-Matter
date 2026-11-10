# OAuth Lab Flows — `oauth-lab` phase (rows #487–#493, #497, #502)

Phase 130, landed 10 November 2026. The base `oauth` phase tests
authorization *requests* only — it never completes a flow, never
exchanges a code, never redeems a token. These 9 rows are the
opposite: each one is a *completed-flow* flaw, so the probe drives
the OAuth lab's flows end to end with canary accounts it registers
itself. Probe: `backend/src/scanner/probes/oauthLab.js`
(`probeOauthLab`), tests:
`backend/src/scanner/probes/oauthLab.test.js`, lab:
`labs/oauth-lab/` (EC2, `http://172.17.0.1:3620`).

## Rows

| Row | Class | Severity | Flaw |
| --- | ----- | -------- | ---- |
| #487 | `oauth_magic_link_replay` | High | Magic-link token is replayable — same token issues a fresh session on every redeem (never expires, not single-use) |
| #487 | `oauth_state_as_magic_link` | High | OAuth `state` value is redeemable as a magic link — unified token store |
| #488 | `oauth_preaccount_hijack` | High | Pre-account hijacking — attacker password survives the victim's magic-link sign-in |
| #489 | `oauth_unverified_email_idp` | High | SSO account takeover via unverified email at the IdP — `id_token` carries `email_verified:false` and is accepted |
| #490 | `oauth_forced_linking` | High | Forced profile linking — attacker OAuth identity linked into a victim session with no CSRF or state check |
| #491 | `oauth_code_injection` | High | Authorization-code injection — callback accepts a bogus state and overwrites the caller's session |
| #492 | `oauth_idp_mixup` | High | IdP mix-up — token endpoint redeems any IdP's code without issuer validation |
| #493 | `oauth_ssrf_dynamic_registration` | High | SSRF via dynamic client registration — server fetches attacker-supplied `jwks_uri` / `logo_uri` |
| #497 | `oauth_refresh_token_reuse` | Medium | Refresh token never rotates and is never revoked on reuse |
| #502 | `oauth_webauthn_no_validation` | High | WebAuthn finish accepts any challenge and any origin — no challenge, origin, signature or counter validation |

Rows #494–#496 stay in Tier B (they need a host-routing lab, not
covered here).

## Method and proof criteria

Every CONFIRMED verdict pairs a control against the flaw
(differential / state-change evidence, never a bare claim):

- **#487 replay:** redeem #1 must succeed (control, token is live);
  the flaw is redeem #2 succeeding with `redeemedCount` 2 and a
  second, different session token.
- **#487 state:** an OAuth `state` minted by `/oauth/authorize` for
  a verified Acme identity redeems at the magic-link endpoint with
  `tokenKind: "oauth-state"`.
- **#488:** attacker password logs in *after* the victim's
  magic-link sign-in completed the account (register → magic-link
  redeem → login, all three must hold).
- **#489:** control — idp-acme refuses an unverified identity
  (403); test — idp-quick issues a code for one; corroborated by
  decoding the issued `id_token` (`email_verified:false`) and a
  successful callback session for the unverified identity.
- **#490:** the victim's `linkedIdentities` list is empty before
  the link call and holds the attacker's identity after it
  (`csrfChecked:false`, `stateChecked:false` in the response).
- **#491:** `/api/auth/me` resolves the victim session to the
  victim *before* the callback and to the attacker *after* it
  (`stateValidated:false` on the callback response).
- **#492:** codes from *both* IdPs redeem, both responses admit
  `issuer_validated:false`, and the quick code's `id_token` `iss`
  is the quick IdP (control: the Acme code redeems too, so the
  endpoint cannot tell the IdPs apart).
- **#493:** the fetch-log holds no canary URL before registration
  and holds the server's GET of our canary `jwks_uri`/`logo_uri`
  after it (the registration response's `fetched[]` agrees). The
  SSRF target is another lab host on the same bridge (target host,
  port 3000); the cloud metadata address `169.254.169.254` is
  never used.
- **#497:** refresh #1 (control) then refresh #2 with the *same*
  token both succeed, `rotated:false`, `refreshReuseCount` stepping
  1 → 2, same refresh token returned.
- **#502:** `register/finish` with a never-issued challenge returns
  200 (`challengeChecked:false`); `authenticate/finish` with a
  stale challenge, origin `https://evil.example` and a fake
  signature returns 200 with a session and all four `*Checked`
  flags false.

All accounts, passwords and tokens are canary fixtures created by
the probe (`dmprobe-<rand>@example.com`); no seeded account is
used, no real credential exists, and token values are redacted in
evidence (first 8 chars + `<redacted>`). About 48 requests per
phase run, seconds-scale on the lab, $0 AI.

## Gates

- **Lab-only:** `isLabTargetHost(url, opts.labTargets)` — non-lab
  targets return `[]` with zero requests.
- **Depth:** `quick` skips the probe entirely.
- **Fingerprint:** `GET /health` must answer `service: 'oauth-lab'`
  — any other lab host returns `[]` after that one GET.

## Wiring

`'oauth-lab'` in `DEFAULT_PHASES` (right after `'oauth'`) and a
`step('oauth-lab', ...)` call beside the oauth step in
`backend/src/scanner/index.js`. Adding the phase moved the scanner
from 129 to 130 phases (bare-page rollup 81/48 → 82/48 ok/skipped;
Juice-shape rollup 159/159/0 → 160/160/0 — updated in
`gatedSkip.test.js` and `paramBattery.test.js`).

## Tests

`oauthLab.test.js` (6 tests): the REAL oauth-lab server is spawned
as a child process on a scratch port — all 10 classes fire exactly
once with the evidence contract (class, id, title, severity, url,
parameter, evidence `{request, response, impact_demo,
signalCorrelated: true}`) and token redaction; plus gate tests
(non-lab host, quick depth, non-oauth-lab fingerprint). The
honest-negative leg runs the probe against a fixed-behaviour stub
(same endpoints, correct semantics — single-use magic links,
verified-only IdPs, state-validating callback, rotating refresh
tokens, challenge-checking WebAuthn) and requires ZERO findings.

## Limits

- The probe tests the lab's *contract*, not a production IdP:
  real-world OAuth flaws need a real IdP/RP pair and a browser
  redirect flow; the lab's in-memory state resets on restart.
- #493 proves the server *attempts* the fetch (logged by the lab
  itself); whether the fetched content is *used* (e.g. a poisoned
  JWKS key accepted) is a separate row family, not claimed here.
- #489's control depends on idp-acme refusing unverified
  identities; if a future lab change makes Acme non-verifying,
  the probe correctly stops firing rather than false-positiving.
