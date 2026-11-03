# Web Cache Poisoning

## What it is
Caches key pages by URL but ignore headers the app reflects (like
`X-Forwarded-Host`). An attacker sends one poisoned request; every later
visitor gets the poisoned page — defacement, phishing, or stored-XSS-scale
script injection without touching the app again.

## How the scanner checks it
Three steps on the target URL:
1. **Baseline:** clean GET — the fresh canary must be absent.
2. **Poison:** GET with `X-Forwarded-Host: evil-<rand>.example`. The app
   must reflect the canary (else there is nothing to poison with).
3. **Victim:** clean GET again. If the canary now appears, the poisoned
   variant was served from cache.

**Proof oracle:** canary in the clean victim response → `signalCorrelated`
→ **confirmed** (severity **medium**; the XSS layer, if any, is a separate
finding). Cache-hit headers (`Age`, `X-Cache`, `Cf-Cache-Status`)
strengthen the verdict when present.

## Payloads
A single synthetic hostname — no list.

## Limits
- Only the `X-Forwarded-Host` unkeyed-input vector; other unkeyed inputs
  (cookies, query params) are future work.
- No cache = correct negative. Some stacks reflect-but-don't-cache.
- Request smuggling (CL.TE/TE.CL) needs raw sockets — separate future
  phase, documented in the catalog.
