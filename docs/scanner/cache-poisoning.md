# Web Cache Poisoning

## What it is
Caches key pages by URL but ignore headers the app reflects (like
`X-Forwarded-Host`). An attacker sends one poisoned request; every later
visitor gets the poisoned page — defacement, phishing, or stored-XSS-scale
script injection without touching the app again.

## How the scanner checks it
Three steps on the target URL:
1. **Baseline:** clean GET — the fresh canary must be absent.
2. **Poison:** one request carrying the canary through the leg's
   unkeyed input — `X-Forwarded-Host: evil-<rand>.example` (#355),
   a `dmcache=<rand>` query parameter (#356), a GET carrying a
   `dmcache=<rand>` body parameter (#357, fat GET / parameter
   cloaking), or a `Cookie: dmcache=<rand>` value (#358). The app
   must reflect the canary (else there is nothing to poison with).
3. **Victim:** clean GET again. If the canary now appears, the poisoned
   variant was served from cache.

**Proof oracle:** canary in the clean victim response → `signalCorrelated`
→ **confirmed** (severity **medium**; the XSS layer, if any, is a separate
finding). Cache-hit headers (`Age`, `X-Cache`, `Cf-Cache-Status`)
strengthen the verdict when present.

## Payloads
A single synthetic hostname for the header leg (`evil-<rand>.example`),
a `dmcache-<rand>` token for the query/cookie/body legs — no list.

## Limits
- The fat-GET leg (#357) sends a GET with a body via the shared
  `rawHeaderFetch` transport (node:http) — fetch cannot send a GET
  body. The differential is the body itself: the baseline plain GET
  has no canary, the GET-with-body reflects it, and the clean victim
  GET serves it.
- The #356/#357/#358 legs are lab-gated (`opts.allowWrite`): cache
  poisoning writes shared state, so they run only on lab targets.
  The older XFH leg (#355) is ungated by history — that inconsistency
  is a known ledger item, not this lane's change.
- Severity is medium for all four legs; rows #356/#357 are filed
  [High] — probe-vs-filing mismatch, same as #355.
- No cache = correct negative. Some stacks reflect-but-don't-cache.
- Request smuggling (CL.TE/TE.CL) needs raw sockets — separate future
  phase, documented in the catalog.
