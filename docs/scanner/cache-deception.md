# Web Cache Deception

## What it is
Caches key on a normalized path or file extension while the origin still
serves the dynamic page. An attacker requests a static-looking variant of
a victim's dynamic URL (e.g. `/account/.css`); the cache stores the
authenticated response and serves it to anyone who asks for the variant —
session content leaks to strangers (#169, #434, #435).

## How the scanner checks it
Runs only on dynamic-looking URLs (query params present or session-ish
path: account/profile/settings/dashboard/admin/user/session/cart/
checkout/order). Six path-confusion variants per target:

- (a) path confusion: `/;x.css`, `/..;/x.css`, `/%2e%2f/x.css`
- (b) extension tricks (#435): `/.css`, `/x.png`
- (c) normalization: `/%2f..%2f/x.png`

Variant URLs are built by string surgery (not `new URL`) so the parser's
dot-segment handling cannot normalize away `%2e` / `%2f` segments.

**Proof oracle (two-request differential per variant):**
1. **Busted:** `GET <variant>?dmscb=<rand>` — fresh request, expected MISS.
2. **Unbusted:** `GET <variant>` — if explicit cache-hit headers appear
   (`Age`, `X-Cache` / `X-Cache-Status` / `X-Proxy-Cache` / `Cf-Cache-Status:
   HIT`), the cache stored and served the confused variant.

**Verdict:**
- HIT + sensitive markers in the cached body (CSRF token, session id,
  email address, `logout`, account/username/email fields) →
  `cache_deception` **high** (#169/#434), `signalCorrelated`.
- HIT + clean body → `cache_deception_surface` **low** info (#435) — the
  variant is cached; harden cache-key rules before auth content lands in it.
- No HIT on any variant → no finding. One finding max (strongest variant).

## Payloads
No payloads — path suffixes + a unique cache-buster per run. Read-only
GET, `redirect: manual`.

## Limits
- Deliberate: an identical `Date` header alone is **not** a hit signal —
  two fresh fetches in the same second share a `Date`. Only explicit
  cache headers count, which keeps same-second negatives honest.
- Sensitive detection is a small marker regex set; an authenticated page
  without those markers yields the low surface finding, not the high one.
- The cached body is the *scanner's own* sessionless fetch — a real
  victim-content leak needs a victim session; the probe proves the cache
  serves the confused variant, which is the deception primitive.
- The pre-existing X-Forwarded-Host poisoning lane in the same probe is
  unchanged; deception runs regardless of its result.
