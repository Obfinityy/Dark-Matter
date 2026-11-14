# IDOR — Numeric / Sequential-ID Cross-User Differential

## What it is

Object IDs in URLs are sequential numbers and the server doesn't check
ownership, so one user can read another user's data by guessing the next
id (`/api/Users/1` → `/api/Users/2`, `/rest/basket/1` → `/rest/basket/2`).

Coverage rows **#10 / #338** [IDOR / BOLA — numeric IDs, CWE-639 |
OWASP API01:2023], plus the AUTHZ family rows that share the same root
cause: **AUTHZ-01 IDOR, AUTHZ-02 BOLA (numeric half), AUTHZ-04
horizontal privilege escalation, AUTHZ-08 missing ownership validation,
AUTHZ-15 cross-account data access**. The UUID / predictable-token half
of the same family is row #339, owned by `idorUuid.js` — this leg is the
numeric follow-up its header names.

## How Dark Matter checks it

Probe: `backend/src/scanner/probes/idorNumeric.js` (`probeIdorNumeric`),
riding the same `idor` phase as `idorUuid.js` — no new phase number.
It mines object URLs from the crawl (`scanTargets` + `jsWriteTargets`)
whose path carries a **numeric object-id segment** (a digit run of 1–10
digits), then runs a **three-way differential** on each — exactly the
`idorUuid` oracle shape:

1. **No-token GET** — must be refused (401/403/404 or a refusal
   message). An object that answers 200 anonymously is public, not
   BOLA (that is missing-auth #47's territory), and is skipped, never
   a finding.
2. **Owner-token GET** (control, labCreds session) — must be granted
   (2xx + a non-empty body with no refusal text). Object reads need
   not be JSON, so an HTML profile page counts. An object the owner
   session cannot reach is not a valid control and is skipped.
3. **Other-user-token GET** — the other user is a throwaway
   self-registered lab account (per-run random email suffix, fixed
   canary password, same login candidates as the owner control — the
   BFLA session model, see `bfla.js`). **Confirm only when** the replay
   is granted (2xx + no refusal text) with a body of at least 50 bytes
   and at least half the owner control body's length **and** the
   requested object id present in the body **as a structured id
   field** — `"id":123`, `"id":"123"`, `"userId":123`,
   `data-id="123"`, a same-origin `/123/` link, or `id=123`.

The first confirmed URL ends the probe (max 1 finding). If every URL
refuses the other user, that is a proven true negative, not a finding.

### Why the id must be a structured field

A bare `"123"` appears in prices, dates, counts and years all over any
page, so a plain substring match — the check `idorUuid.js` uses, which
is safe there because UUIDs are long and unique — would false-confirm
on numeric ids constantly. The structured-field check
(`numericIdInBody`) is what makes short ids testable at all: a long
body without the id field is a different object (a list page, a generic
success stub), not the same object, and a short or filtered answer is
the server enforcing something, not a bypass.

### The sequential-neighbour leg

Numeric ids are guessable by design, so after the mined URLs all
refuse, the probe also tries the immediate neighbours (**id−1, id+1**)
of the first two mined object URLs under the **same** three-way
differential. A neighbour confirms only when the owner control grants
it too (the object exists and is readable by an authenticated user)
**and** the other-user body carries the neighbour id as a structured
id field. A neighbour that answers 200 anonymously is public and is
skipped, exactly as in the mined leg. The neighbour leg only reaches
id±1 of mined objects; it does not enumerate a range.

### What is NOT a candidate

Two numeric-looking shapes are excluded from mining, because they are
not object ids even though they look numeric:

- **Year-like segments (1900–2100)** — archive / date paths such as
  `/archive/2026`; the "same object" check would be meaningless
  against a year.
- **Timestamp-like segments (>10 digits)** — epoch-millis values such
  as `/events/1763088000000`.

The miner deliberately takes **1–2 digit ids** too (Juice basket `1`,
user `1`): `classifyIdSegment`'s 3+ digit bar is the v1 *surface* rule
in `idor.js` and is left untouched — the differential's safety comes
from the structured-field check and the three-way oracle, not from the
digit length. UUID / predictable-token segments are not candidates
here — `idorUuid.js` owns that surface.

## Payloads used

The object id itself is the payload: the probe replays the mined
object URL (and its id±1 neighbours) under a second, unrelated
session. No crafted payload bodies — the object read is a plain GET.

## What counts as proof (oracle)

A true IDOR needs a cross-user differential: object A (own) vs object B
(other user's) with two sessions. Without a second session the item
stays **UNCONFIRMED by design** and is never reported as a finding —
it appears only as an informational review note (see `idor.md`). This
leg implements that differential for numeric / sequential objects: the
same object, returned to an unrelated session, with the object id
present in the body as a structured id field, is the proof. Every other
outcome (refused, filtered, public, uncalibrated, bare-number-only
body) is a true negative, not a finding.

Findings are class `idor_numeric`, severity **medium**. `protocolFor`
routes any class containing 'idor' to the idor protocol, judged on
`evidence.crossUserRead` (see `backend/src/hunt-intel/differential.js`).

## Gates and budget

Lab-gated: `labCreds` + `allowWrite` + `isLabTargetHost`, and depth
`standard`/`deep` only (`quick` skips the probe). At most 10 POSTs
(owner login 4, registration 2, other-user login 4) and at most 27 GETs
(5 mined object URLs × 3 legs, plus 2 neighbours × 2 base URLs × 3
legs). Non-lab scans behave exactly as in v1 — the surface detector
only.

## Limits

- It can only test object URLs the crawl mined — a lab with no
  numeric-addressed objects in its crawl yields no surface and an
  honest `[]`.
- It only reaches id±1 of mined objects; a lab whose objects sit
  further from any mined id is not enumerated.
- The structured-field check assumes the object read echoes its id
  in a field, attribute or link; an object read that returns only
  opaque content with no id anywhere cannot confirm (fail-closed,
  not a finding).
