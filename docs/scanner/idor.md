# Insecure Direct Object Reference (IDOR)

## What it is
Object IDs in URLs are predictable and the server doesn't check ownership,
so one user can read or modify another user's data.

## How Dark Matter checks it (v1)
The scanner flags sequential numeric object references in URLs
(e.g. `/user/12345/profile`) as a **review surface**.

Probe: `backend/src/scanner/probes/idor.js` (`probeIdorSurface`). Pure
function of the URL — no network.

## Payloads used
None in v1.

## What counts as proof (oracle)
A true IDOR needs a cross-user differential: object A (own) vs object B
(other user's) with two sessions. Without a second session the item stays
**UNCONFIRMED by design** and is never reported as a finding — it appears
only as an informational review note.

## Limits
This is the honest boundary of rule-based scanning: IDOR confirmation needs
two authenticated identities. The scanner surfaces the candidates; a human
(or a future two-session lane) confirms them.
