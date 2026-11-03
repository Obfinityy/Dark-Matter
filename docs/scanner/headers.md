# Security Headers + CORS

## What it is
Missing hardening headers (HSTS, CSP, X-Frame-Options…) and CORS
misconfigurations widen every other attack.

## How Dark Matter checks it
The scanner reads the target's response headers once and checks for:

- `Strict-Transport-Security` (low if missing)
- `Content-Security-Policy` (low if missing)
- `X-Frame-Options` (low if missing — clickjacking)
- `X-Content-Type-Options` (info if missing)
- `Referrer-Policy` (info if missing)
- CORS: `Access-Control-Allow-Origin: *` **with**
  `Access-Control-Allow-Credentials: true` (medium — real misconfiguration)
- CSP directive analysis (iter2): a present-but-weak policy is a CSP-bypass
  class finding —
  - `unsafe-inline` in script-src → medium
  - `unsafe-eval` in script-src → medium
  - wildcard `*` in script-src → medium
  - missing `object-src` (with no `default-src` fallback) → low
  - missing `frame-ancestors` (with no `X-Frame-Options`) → low
  (`default-src` counts as the `object-src` fallback per the CSP spec, so it
  is not flagged when `default-src` is set.)

Probe: `backend/src/scanner/probes/headers.js` (`probeHeaders`). No docker needed.

## Payloads used
None (header analysis).

## What counts as proof (oracle)
The header is deterministically absent/present on the live response
(`signalCorrelated: true`).

## Limits
Hardening signals, not vulnerabilities by themselves — except the CORS
wildcard+credentials case, which is a real finding.
