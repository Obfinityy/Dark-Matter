# Cross-Site Request Forgery (CSRF)

## What it is
A state-changing request (e.g. password change) has no unpredictable token,
so an attacker can forge it from another site in the victim's browser.

## How Dark Matter checks it
The scanner inspects every crawled POST form for an anti-CSRF token field
(names matching `csrf`, `xsrf`, `_token`, `authenticity`, `nonce`).

Probe: `backend/src/scanner/probes/csrf.js` (`probeCsrf`). Pure function of
the crawled forms — no network.

## Payloads used
None (static analysis of the form HTML).

## What counts as proof (oracle)
A POST form with no token field (`signalCorrelated: true`). Severity is
medium: exploitability depends on cookie auth and the action's sensitivity,
which needs human review.

## Limits
Token-presence only in v1. Token-strength testing (predictable tokens,
token-not-validated) is a documented next step.
