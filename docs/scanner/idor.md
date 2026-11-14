# Insecure Direct Object Reference (IDOR)

## What it is
Object IDs in URLs are predictable and the server doesn't check ownership,
so one user can read or modify another user's data.

## How Dark Matter checks it (v2)
The scanner flags sequential numeric, UUID-shaped, and predictable-token
object references in URLs (e.g. `/user/12345/profile`,
`/orders/550e8400-e29b-41d4-a716-446655440000`,
`/orders/ord-9f2k7xq4`) as a **review surface**.

Probe: `backend/src/scanner/probes/idor.js` (`probeIdorSurface`,
`classifyIdSegment`). Pure function of the URL — no network.

### The confirmable leg (v2, coverage row #339 [Medium] BOLA — UUID /
predictable token IDs, CWE-639 | OWASP API01:2023)
Probe: `backend/src/scanner/probes/idorUuid.js` (`probeIdorUuid`),
riding the same `idor` phase. It mines object URLs from the crawl
whose path carries a UUID-shaped or predictable-token segment
(short hex id such as a truncated UUID or a 24-hex ObjectId, or a
mixed letter+digit token — see `classifyIdSegment`), then runs a
three-way differential on each:

1. **No-token GET** — must be refused (401/403/404 or a refusal
   message). An object that answers 200 anonymously is public,
   not BOLA (that is missing-auth #47's territory), and is
   skipped, never a finding.
2. **Owner-token GET** (control, labCreds session) — must be
   granted (2xx + a non-empty body with no refusal text). Object
   reads need not be JSON, so an HTML profile page counts. An
   object the owner session cannot reach is not a valid control
   and is skipped.
3. **Other-user-token GET** — the other user is a throwaway
   self-registered lab account (per-run random email suffix, fixed
   canary password, same login candidates as the owner control —
   the BFLA session model, see `bfla.js`). **Confirm only when**
   the replay is granted (2xx + no refusal text) with a body of
   at least 50 bytes and at least half the owner control body's
   length **and** the requested object id present in the body — a
   long body without the id is a different object (a list page, a
   generic success stub), not the same object, and a short or
   filtered answer is the server enforcing something, not a
   bypass. The first confirmed URL ends the probe (max 1 finding).

Findings are class `idor_uuid`, severity **medium**. `protocolFor`
routes any class containing 'idor' to the idor protocol, judged on
`evidence.crossUserRead` (see `backend/src/hunt-intel/differential.js`).

Pure numeric ids are NOT candidates for this leg — the numeric
cross-user differential is rows #10/#338, implemented by the
follow-up leg in `idorNumeric.js` (see
[idor-numeric-differential.md](idor-numeric-differential.md)),
riding the same `idor` phase.

## Payloads used
The object id itself is the payload: the probe replays the mined
object URL under a second, unrelated session. No crafted payload
bodies — the object read is a plain GET.

## What counts as proof (oracle)
A true IDOR needs a cross-user differential: object A (own) vs object B
(other user's) with two sessions. Without a second session the item stays
**UNCONFIRMED by design** and is never reported as a finding — it appears
only as an informational review note. The v2 leg implements that
differential for UUID / predictable-token objects: the same object,
returned to an unrelated session, with the object id present in the
body, is the proof. Every other outcome (refused, filtered,
public, uncalibrated) is a true negative, not a finding.

## Gates and budget
Lab-gated: `labCreds` + `allowWrite` + `isLabTargetHost`, and depth
`standard`/`deep` only (`quick` skips the probe). At most 10 POSTs
(owner login 4, registration 2, other-user login 4) and at most
15 GETs (5 object URLs × 3 legs). Non-lab scans behave exactly as
in v1 — the surface detector only.

## Limits
This is the honest boundary of rule-based scanning: IDOR confirmation needs
two authenticated identities. The scanner surfaces the candidates; the v2
leg confirms them for UUID / predictable-token objects on lab targets.
Honest limits of the leg:

- It can only test object URLs the crawl mined — a lab with no
  UUID-addressed objects in its crawl yields no surface and an
  honest `[]`.
- Pure-predictability analysis (sample N ids from the target, test
  for sequential or structured values vs random — entropy
  sampling) is a documented next step, not this lane: this leg
  proves the cross-user **access** flaw on UUID /
  predictable-token objects, which is the BOLA half of row #339.
- Numeric-id confirmation (rows #10/#338) is the follow-up leg
  in `idorNumeric.js` — see
  [idor-numeric-differential.md](idor-numeric-differential.md).
