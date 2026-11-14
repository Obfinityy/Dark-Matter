# Cryptography probe (#34)

`backend/src/scanner/probes/crypto.js` — the first probe that MEASURES
properties instead of injecting payloads. Phase `crypto`, in
`DEFAULT_PHASES`, runs in production scans.

## Tiers

| Tier | What it measures | Severity | Confirm bar |
|---|---|---|---|
| T1 | TLS version/cipher baseline — pinned handshakes per version; accepts TLS1.0/1.1 → MEDIUM, RC4/3DES/export/null → HIGH | medium/high | Server accepts the deprecated version / broken cipher in a live handshake |
| T2 | Session-token structure — predictable when ≥2 independent structural signals agree (monotonic numeric suffix, timestamp-decodable segment, low-entropy short token, username-derived segment, base64(username:timestamp) round-trip) | high | ≥2 signals across ≥2 harvested tokens; a single token's shape never confirms |
| T3 | Reset-token analysis | — | NOT IMPLEMENTED (row #368) — no T3 leg exists in code; needs a lab mailbox surface first |
| T4 | Plaintext password in reset flow | — | NOT IMPLEMENTED — no T4 function exists in code; same mailbox surface as T3 |
| T5 | Exposed password hashes — MD5/SHA1 in fetched page/API bodies | high | Hash present in a server response. NOTE (batch-9 filing error): the header promises an account tie, but the code fires on any 32/40-hex string — no username/email proximity check is performed |
| T6 | Weak secret derivation — base64(username:ts)/md5(username) round-trip on harvested tokens | (rides T2) | Round-trip decode against a harvested token + known lab username |

## Token supply (T2/T6) — rows #124/#261/#369

T2/T6 need `opts.cryptoTokens`. Until 14 Nov 2026 nothing supplied
it and the leg was dead in production. The supply is wired in
`backend/src/scanner/index.js` (crypto plan) via
`backend/src/scanner/tokenHarvest.js`, which harvests only what the
scan already saw — zero extra requests:

1. **Set-Cookie values** on the fingerprinted/crawled pages — read
   from the full `.setCookies` list (`fetchPage` returns it alongside
   the collapsed `headers` object; see below). Session-like names, or
   a dotless value ≥16 chars. Tracking cookies are excluded by name,
   and dotted long values (GA1.2.x.y format) are excluded so a
   tracking cookie can never poison the oracle's monotonic check.
2. **Hidden token/CSRF inputs** in discovered forms
   (`name` matches token/csrf/xsrf, `type` hidden, value ≥8 chars).
3. **The lab session's bearer token + cookies** (lab targets only),
   with the lab username attached so the username-derived signal can
   fire.

An explicit `opts.cryptoTokens` from the caller (lab harness / tests)
wins over the harvest. Phase extras carry the harvested COUNT only —
token values never land in a phase record.

## The Set-Cookie collapse (why fetchPage returns setCookies)

Iterating a `Headers` object collapses several `Set-Cookie` values
into ONE entry — last wins, the rest are silently lost (verified
first-hand: a two-cookie response collapses to the second cookie
only). `fetchPage` therefore ALSO returns `setCookies` (via
`res.headers.getSetCookie()`, guarded for stubbed fetch impls), and
`fingerprint()` / `crawl()` / `crawlSite()` pass it through. The
collapsed `headers['set-cookie']` string is unchanged for existing
consumers; the harvester uses it only as a fallback (split
Expires-aware in `tokenHarvest.splitSetCookieHeader`).

## Safety / limits

- ≤8 TLS handshakes per origin, sequential, 5s cap each.
- No cracking (identification is the finding). No cert-validation
  bypass.
- Tokens only from self-owned lab accounts (lab session) or from the
  target's own public responses (cookies / form tokens the scan
  already fetched).
- T1 duplicates the TLS version/cipher measurement in `tlsScan.js`
  (two handshakes per https scan) — known overlap, batch 9.
- T5 has no account-tie check despite the header wording (see table).
- `crypto.test.js` covers T5 only for the old tests; T2 is covered by
  the T2 oracle tests in the same file and by the end-to-end wiring
  tests in `scanner.test.js` (`runScan crypto token-supply wiring`).

## Rows

#124 Insufficient Entropy / Predictable Randomness, #261 Predictable
Session Token, #369 Predictable session IDs — all three ride the one
T2 leg (filed Critical for #369 vs the leg's HIGH; the leg's severity
stands). #130/#365 (hard-coded key), #122/#362/#364 (ECB/IV),
#366 (custom cipher), #368 (reset tokens) are separate rows with
their own gaps — see the coverage re-proof batch-9 doc.
