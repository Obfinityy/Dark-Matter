# NoSQL Deep Probe (`nosqlDeep.js`, phase `nosql-deep`)

Closes the gap left by `nosqli.js` (one-shot operator probes only). The
deep probe runs inside the param battery (`batteryStep('nosql-deep')` in
`index.js`) and carries four legs, T3–T6, all differential — a finding
fires only when a malicious variant behaves differently from its benign
control in the direction the vulnerability predicts.

## Legs

### T3 — Operator auth bypass (CRITICAL)

Sends a wrong credential pair (plain control, must NOT authenticate) and
then `[$ne]` / `[$gt]` operator variants in PHP array syntax plus a JSON
`{"$ne": null}` smuggling variant. Confirms only when the operator
variant authenticates (new session cookie or dashboard redirect) while
plain wrong creds do not. Demonstrated against the scanner's OWN canary
account only.

### T4 — `$regex` blind extraction (HIGH, Deep-gated)

Anchored enumeration of the scanner's own canary field
(`opts.nosqlCanary = { userParam, field, value }`). Each guessed
character is tested as `$regex: "^<prefix>"` against an
impossible-suffix control; confirms only when >= 4 extracted chars match
the known canary value (self-verifying). Runs at Standard depth and
above, only when a canary is supplied.

### T5 — `$where` server-side JS (CRITICAL, Deep-gated)

True/false legs (`this.username==this.username` vs `1==2`) must diverge
exactly AND a JS-canary leg (`this.x=='<canary>'`) must reflect. Proves
arbitrary server-side JS execution, not query semantics.

### T6 — Aggregation pipeline injection (HIGH, Deep-gated + lab-gated)

Sends a JSON body carrying an injected pipeline stage under a single
`{"pipeline": [...]}` carrier key and confirms only on the joined/widened
canary data appearing where the control did not return it. Two variants,
first confirmed wins:

- **(a) `$lookup` join** — only when `opts.nosqlCanary.collection` is
  set. The request body carries NO canary value (only the collection +
  field names), so the value can appear in the response only if the join
  actually executed against the database — echo cannot fake it.
  Anti-echo guard: the response must not contain the `"$lookup"`
  literal.
- **(b) `$match` widen** — the canary leg's pipeline matches the known
  canary document; the control leg matches a random nonexistent value.
  Confirms only when the canary value appears in the canary leg, is
  absent from the control leg, AND the canary response carries no
  `"$match"` literal (anti-echo guard — a verbatim echo of the request
  body would contain it).

T6 requires `opts.nosqlCanary` (same seam as T4) and a lab target:
`isLabTargetHost(url, opts.labTargets)` is checked BEFORE any request,
and `index.js` passes `labTargets` into this probe's opts (the `hpp`
precedent). Without a lab target the gate stays shut and T6 sends
nothing (fail-closed). T6 runs only at Deep depth.

## Depth

- Quick = T3 only.
- Standard = T3 (+ T4 capped when a canary is present).
- Deep = full battery (T3 + T4 + T5 + T6).

## Canary supply (honest note)

No production caller sets `opts.nosqlCanary` today — a grep across
`backend/src/` finds the field only inside `nosqlDeep.js` itself. T4 and
T6 therefore run only when a lab harness supplies the canary (the
scanner's own record, never a real user's data). Wiring the canary
supply into the hunt route is a follow-up, not part of this probe.

## Honest limits

- Modern MongoDB/drivers disable `$where` by default — a clean negative
  is documented, not a miss. `$where` has no sleep in modern Mongo — no
  fake time oracle.
- T6 tries only the `{"pipeline": [...]}` carrier key. Raw-array
  pipeline bodies (`POST [...]` with no wrapper key) are untested, as
  are `$group` / `$unwind` / `$project` stage exfiltration beyond the
  `$match` / `$lookup` proof.
- T6 confirms against the scanner's own canary record only. A pipeline
  that widens to arbitrary real documents without the canary is not
  probed — the oracle needs a known value to distinguish execution from
  echo or from an unfiltered full-table return.
- All legs are read-only HTTP (POSTs only, redirects never followed),
  per-run canaries, `$0` AI.
