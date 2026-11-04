# Password-Reset Token Probe (#324) — Disclosure & Predictability

`backend/src/scanner/probes/passwordReset.js`, exported as
`probePasswordReset(forms, url, opts)` — the same signature as
`probeUserEnum(forms, url, opts)` so the coordinator can wire it as the
`password-reset` phase. Owns ONLY the reset-token surface; the valid/invalid
account oracle stays in `userEnum.js` (#45) — no overlap.

## Method

**Form discovery:** reset forms are those whose `action` matches
`reset|forgot|recover|password` AND that contain NO password-type input (a
form with a password field is a login/change form, not a reset request).

**T1 — token in HTTP response — CRITICAL** (`pwdreset_token_in_response`):
submit the reset form with a per-run canary email
(`dmprobe+<rand><a|b>@example.invalid`, `redirect: 'manual'`). If the response
body/JSON discloses the reset token or a reset link — a reset-flavored JSON
key (`reset_token`, `password_reset_token`, …) carrying a token-ish value, or
a `/reset…?token=…` URL — the token is handed to whoever triggered the
request: no mailbox needed, account takeover by response alone.

**T2 — predictability / entropy — CRITICAL** (`pwdreset_token_predictable`):
only when T1 issued a token. A SECOND submission with a DIFFERENT canary
email: identical tokens across accounts ⇒ predictable (attacker requests a
token for their own account and replays it for the victim). Otherwise the
token shape is checked against the entropy bar — <16 characters, purely
numeric <10 digits, single repeated character, or a guessable prefix
(`123/abc/test/qwerty/password/reset/000…`) ⇒ weak, brute-forceable offline.

Max 2 submissions per form. All submissions use `@example.invalid` canary
addresses — no real mailbox, no real account touched.

## Entropy criteria (exact)

`weakTokenReason(token)` returns a reason string or `null`:

| Check | Fails when |
|---|---|
| Length | < 16 characters |
| Numeric | purely digits AND < 10 digits |
| Repetition | single repeated character (`aaaa…`) |
| Prefix | matches `/^(123\|abc\|test\|qwerty\|password\|reset\|000)/i` |

Extraction floor: JSON values ≥6 chars (short tokens are exactly what we
want), URL tokens ≥8 chars; placeholder/example strings and common status
words (`ok`, `sent`, `error`, `invalid`, …) are excluded so
`{"reset_status":"sent"}` is not misread as a token.

## Safety & lab gating

**Submissions are LAB-GATED:** the POST only fires when the target host is in
`opts.labTargets` (fail-closed, same model as `race.js`). Non-lab targets get
a **passive check only** — GET the reset page; a token/link embedded in
HTML/JS without any request still fires T1 (mailbox-bypass evidence, no form
submitted).

## Honest limits (not silently skipped)

- **Email interception is never claimed.** A token "sent to the email" is not
  observable by the scanner; we test only what the HTTP layer discloses.
- A second submission is only made when the first response disclosed a token
  (no blind double-submits against clean endpoints).
- Tokens of 4–5 chars fall below the extraction floor (documented edge).

## Wiring & cost

`probePasswordReset(forms, url, opts)` — mirror of `probeUserEnum`; the
coordinator wires the `password-reset` phase. Budget: 1 GET (passive) or up to
2 POSTs per reset form. $0 AI, seconds.
