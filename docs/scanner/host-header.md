# Host Header Injection

## What it is
Many apps build absolute URLs from the request's `Host` header
(password-reset links, email verification, redirects) or trust
`X-Forwarded-Host` behind a proxy. If the app reflects an attacker-supplied
host, the attacker poisons reset links (account takeover), cache keys and
redirects.

## How the scanner checks it
`GET <target>` with a canary host (`evil-<rand>.example`) sent as:
- `Host` (kept for runtimes that honour it — fetch/undici drops it as a
  forbidden header, so this variant is best-effort),
- `X-Forwarded-Host`,
- `X-Host`.

**Proof oracle:** the canary host appears verbatim in the response body or
the `Location` header while the baseline (normal Host) cannot contain the
freshly-random canary → `evidence.signalCorrelated=true` → **confirmed**
(severity **medium**).

## Payloads
A single synthetic hostname per variant — no payload list.

## Limits
- Confirms the header is *trusted/reflected*, not end-to-end reset-link
  poisoning (that needs a mailbox and a victim click — the finding is the
  reflection).
- Proxy-stripped headers on some stacks → false negatives; the header
  reflection is a sufficient but not necessary signal.
