# CORS Misconfiguration

## What it is
Cross-Origin Resource Sharing (CORS) lets a server declare which origins may
read its responses cross-origin. A misconfiguration lets an attacker's site
read responses it should never see.

## How the scanner checks it
Sends two `GET <target>` requests: one with
`Origin: https://evil-dm-probe.example` (a domain the scanner controls
conceptually — it will never exist) and one with `Origin: null`.

**Proof oracle:** the response reflects the evil origin in
`Access-Control-Allow-Origin`.
- Reflected origin **+** `Access-Control-Allow-Credentials: true` → **high**
  (any malicious site can make credentialed requests and read the victim's
  private responses — session hijack).
- Reflected origin without credentials → **medium** (cross-origin data theft
  on endpoints that don't need cookies).
- `Access-Control-Allow-Origin: *` with credentials → **medium** (broken
  policy signal).
- `Access-Control-Allow-Origin: null` **+** credentials, on the null-Origin
  request only → **high** (#395; a sandboxed or redirected page can make
  credentialed requests and read the responses). A literal `null` returned
  for any other Origin is not this leg's oracle, and `null` without
  credentials stays silent.
- `Access-Control-Allow-Origin: *` **without** credentials → **medium**
  (#396, class `cors_wildcard`, id `cors-wildcard-no-creds`; distinct from
  the wildcard-with-credentials leg above). `ACAC: false` counts as
  without credentials; the leg fires exactly once per scan.

## Payloads
No payload list — two synthetic `Origin` headers are the whole test
(`https://evil-dm-probe.example` and the literal string `null`).

## Limits
- Only tests the landing URL, not every endpoint (CORS policies can vary per
  path — the Nuclei battery covers per-path cases).
- Cannot confirm exploitability without a victim browser; the header
  reflection is the finding.
