# CORS Misconfiguration

## What it is
Cross-Origin Resource Sharing (CORS) lets a server declare which origins may
read its responses cross-origin. A misconfiguration lets an attacker's site
read responses it should never see.

## How the scanner checks it
Sends `GET <target>` with `Origin: https://evil-dm-probe.example` (a domain
the scanner controls conceptually — it will never exist).

**Proof oracle:** the response reflects the evil origin in
`Access-Control-Allow-Origin`.
- Reflected origin **+** `Access-Control-Allow-Credentials: true` → **high**
  (any malicious site can make credentialed requests and read the victim's
  private responses — session hijack).
- Reflected origin without credentials → **medium** (cross-origin data theft
  on endpoints that don't need cookies).
- `Access-Control-Allow-Origin: *` with credentials → **medium** (broken
  policy signal).

## Payloads
No payload list — a single synthetic `Origin` header is the whole test.

## Limits
- Only tests the landing URL, not every endpoint (CORS policies can vary per
  path — the Nuclei battery covers per-path cases).
- Cannot confirm exploitability without a victim browser; the header
  reflection is the finding.
