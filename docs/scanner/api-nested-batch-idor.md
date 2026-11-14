# API — IDOR via Nested Objects / Batch Requests

Coverage row #345 [Medium] — CWE-639 | OWASP API01:2023.
Probe: `backend/src/scanner/probes/nestedBatchIdor.js`
(`probeNestedBatchIdor`), riding the `idor` phase alongside
`idor.js` (surface) and `idorUuid.js` (row #339, flat object
URLs). Row #385 (GraphQL mutation BOLA) is a different leg,
already closed by PR #518 — this file tests REST object
access, not GraphQL query shape.

## What it is

Object-level authorization is often enforced on the flat
single-object read (`GET /api/orders/{id}`) but not on the
two shapes that reach the same object through a different
door:

- **Nested objects** — `/api/users/{ownId}/orders/{otherId}`,
  `/api/accounts/{ownId}/documents/{otherId}`. Many servers
  check only the outer id (or only the inner one), so swapping
  the outer id for the attacker's own id — or replaying the
  mined nested path under a second account — returns another
  user's object.
- **Batch requests** — one POST carrying an array of object
  ids (`{"ids": [...]}`, `{"id": [...]}`, `{"items": [...]}`).
  The batch handler often iterates the ids without the
  per-object ownership check the single-object read performs,
  so a foreign id in the list comes back in the response.

## How Dark Matter checks it

The probe runs the same three-way differential as the
idorUuid leg, once per sink:

1. **No-token request** — must be refused (401/403/404 or a
   refusal message). A candidate that answers 200 anonymously
   is public, not BOLA (that is missing-auth #47's territory),
   and is skipped, never a finding.
2. **Owner-token request** (control, labCreds session) — must
   be granted (2xx + a non-empty body with no refusal text). A
   candidate the owner session cannot reach is not a valid
   control and is skipped.
3. **Other-user-token request** — the other user is a
   throwaway self-registered lab account (per-run random email
   suffix, fixed canary password, same login candidates as the
   owner control — the BFLA session model, see `bfla.js`).
   **Confirm only when** the replay returns the SAME object.

### The nested leg

Candidates are mined routes whose path carries **two or more**
id-shaped segments (uuid / predictable-token / numeric — see
`classifyIdSegment` in `idor.js`). When the owner's own id can
be learned from a self endpoint (`/api/users/me`,
`/rest/user/whoami`, `/api/me`, `/api/users/self`,
`/api/profile`, `/api/account`, `/rest/user/me`), the probe
builds the **outer-swapped variant** first — outer id replaced
with the owner's own id, inner (foreign) id kept — and tests
that: the other user receiving an object nested under the
owner's own id is the nested-specific proof. When no self id
is learnable, the mined URL itself is tested (same three-way
differential, nested path). Confirm rule (shared with
idorUuid): other-user body >= 50 bytes and >= half the owner
control body's length **and** the inner object id present in
the body. The first confirmed URL ends the leg (max 1 nested
finding).

### The batch leg

Candidates are mined routes that look like batch endpoints —
a path segment `batch`/`bulk`/`multi`/`fetch-many`/`batch-get`,
or a query parameter named `ids`/`id`/`objectIds`/`itemIds`.
The foreign object id comes from the mined object ids (any
id-shaped segment in the route set). The probe POSTs one
envelope at a time — `{"ids":[id]}`, `{"id":[id]}`,
`{"items":[id]}` — and confirms **only when** the other-user
batch response returns the foreign object: 2xx + no refusal
text + the object id present in an OBJECT context
(`"id":"<id>"`) or a substantive body (>= 50 bytes). A bare
echo of the requested ids (`{"requested": [id]}`) never
confirms — that is the server parroting the request, not
returning the object. The first confirmed envelope ends the
leg (max 1 batch finding). Once an envelope's owner control
grants, the key is proven and that envelope decides the
endpoint either way — a non-confirming other-user answer is a
verdict on the endpoint, not on the key.

Findings are class `idor_nested` / `idor_batch`, severity
**medium**. `protocolFor` routes any class containing `idor`
to the idor protocol, judged on `evidence.crossUserRead` (see
`backend/src/hunt-intel/differential.js`).

## Gates and bounds

Lab-gated: `labCreds` + `allowWrite` + lab host
(`isLabTargetHost`) + depth `standard`/`deep` (`quick`
skips). At most 10 POSTs (owner login 4, registration 2,
other-user login 4), at most 15 nested GETs (5 nested URLs x
3 legs) + 7 self-endpoint GETs, and at most 27 batch POSTs
(3 endpoints x 3 envelopes x 3 legs). No mined registration
route means an honest `[]` — the probe never invents a route.
Non-lab scans behave exactly as before — the surface detector
only.

## Payloads used

The object id itself is the payload: the probe replays the
mined nested URL under a second, unrelated session, and posts
the foreign id in a batch envelope. No crafted payload bodies
beyond the standard envelopes — the reads are plain GETs and a
single-id batch POST.

## What counts as proof (oracle)

A true nested/batch IDOR needs the cross-user differential:
object A (own) vs object B (foreign) across two sessions, on
the nested path or through the batch endpoint — with the
no-token leg proving the object is not public and the owner
control proving the object exists and is reachable. Error text
alone never confirms; a filtered/short answer is the server
enforcing something, not a bypass.

## Honest limits

- The probe can only test nested paths and batch endpoints the
  crawl mined — a lab with no nested object URLs or batch
  endpoints in its crawl yields no surface and an honest `[]`.
- A batch endpoint whose array key is not one of the three
  envelopes (`ids`/`id`/`items`) is missed — mining the key
  from OpenAPI / JS bundles is a documented next step.
- The outer-swap variant needs a learnable self id; without
  one the leg falls back to the mined nested URL differential.
- Numeric-id confirmation on flat URLs (rows #10/#338) is a
  separate follow-up — this leg covers the nested/batch sink,
  not the flat numeric one.
