# Cross-Site Request Forgery (CSRF)

## What it is
A state-changing request (e.g. password change) has no unpredictable token,
so an attacker can forge it from another site in the victim's browser.

## How Dark Matter checks it
Three legs, all in `backend/src/scanner/probes/csrf.js` (phase `'csrf'`):

1. **Token presence** (`probeCsrf`): every crawled POST form is inspected
   for an anti-CSRF token field (names matching `csrf`, `xsrf`, `_token`,
   `authenticity`, `nonce`). A form with no token field is flagged
   `csrf-missing-token`, severity medium. Pure function of the crawled
   forms — no network.
2. **SameSite-only defense** (`probeCsrf` + `fetchSessionSameSite`,
   row #407): the session cookie's SameSite attribute is read once (one
   GET of the target; `cookies.js` owns the parsing via
   `getSessionCookieSameSite`). A token-less form whose session cookie
   carries SameSite=Lax/Strict is flagged `csrf_samesite_only` instead
   of `csrf-missing-token` — the site's only CSRF defense is the cookie
   attribute, not a token. SameSite=None (or no session cookie) keeps
   the original missing-token finding. A failed SameSite read degrades
   honestly to the original behaviour.
3. **Referer-only defense** (`probeCsrfRefererOnly`, row #407): a
   token-less POST form with NO SameSite protection is submitted twice
   — same-origin Referer (control) and cross-site Referer
   (`https://evil.example/`, a reserved domain, header value only) —
   through `rawHeaderFetch` (node:http.request, transmits Referer
   verbatim; fetch/undici drops it as a forbidden header). A finding
   `csrf_referer_only` fires ONLY when the control is accepted, the
   cross-site Referer is refused, and the refusal reproduces on a
   repeat. Auth-gated forms fail the control and stay silent. Capped
   at 2 forms / 6 requests; never runs when SameSite already
   characterizes the defense (Leg 2 owns those forms).

## Payloads used
Leg 1–2: none (static analysis of the form HTML + one read-only GET).
Leg 3: benign filler POSTs (unique `dmprobe` values per input, same
pattern as the post-forms battery) with a forged Referer header.

## What counts as proof (oracle)
- Leg 1: a POST form with no token field (`signalCorrelated: true`).
- Leg 2: the same form PLUS a session cookie carrying
  SameSite=Lax/Strict.
- Leg 3: control accepted AND cross-site Referer refused AND refusal
  reproduced — a three-leg differential, judged by
  `assessRefererResponse` (4xx / login redirect / CSRF-error phrase
  = refused; 2xx / non-login 3xx = accepted; 5xx = unclear).
Severity is medium in all three legs: exploitability depends on cookie
auth and the action's sensitivity, which needs human review.

## Limits
- Leg 2 reads the session cookie of the target URL only; a form
  whose session is set on a different path/origin is not covered.
- Leg 3 can only characterize forms that accept anonymous POSTs; an
  auth-gated form fails the control and is inconclusive by design.
- Token-strength testing (predictable tokens, token-not-validated)
  is a documented next step. Row #408 (login CSRF) stays verified
  detection-level on Leg 1 — this file does not confirm the
  session-binding step.
