# SQL Injection — Second-Order (Stored)

## What it is
Second-order SQL injection (CWE-89): user input is stored by one request
(a profile / registration field) and executed only when a LATER request
re-uses the stored value in a SQL query. The injection point is not the
request that carries the payload — it is the request that reads the stored
value back. First-order probes (error / blind / OOB) never store anything,
so they cannot see this class at all.

Coverage rows #208 [High] and #281 [High] — the same concept filed twice
in the 478 checklist (batch-3 re-proof overlap flag, 14 Nov 2026). This
one leg covers both rows.

## How Dark Matter checks it
For every discovered form (same surface as stored-xss), the scanner runs a
four-step two-request oracle per text input:

1. Baseline: GET the trigger pages (the form's action page + the site
   root) — they must NOT already carry a DB error.
2. Benign control: store a benign value (`dmprobe_benign_<rand>`) via the
   form, re-GET the trigger pages — they must stay clean.
3. Store: submit a canary SQLi payload (an unbalanced quote,
   `dmprobe'<rand>`) into the input.
4. Trigger: re-GET the trigger pages. A genuine DB error signature now
   appearing is the confirmation.

Probe: `backend/src/scanner/probes/sqliSecondOrder.js`
(`probeSqliSecondOrder`). Phase `'sqli-second-order'` (149th phase),
wired next to `stored-xss` in `backend/src/scanner/index.js`.

## Payloads used
A single unbalanced quote inside the stored value. When the application
later builds a query with the stored value unescaped, the quote breaks
the query and the database returns a syntax error on the trigger request.

## What counts as proof (oracle)
A database error signature (`detectDbError` — the same strict matcher as
the error-based probe, Zerodha FP fix 9 Nov 2026) appears on the trigger
request after the malicious store **and is absent** on the pre-store
baseline **and** after storing a benign value
(`errorCorrelated: true`, `diverged: true`). The finding also carries
`signalCorrelated: true`. One-sided errors (present on both, or on
neither) are not findings. The stack gate applies: an engine-specific
error contradicting the fingerprinted stack never confirms.

The `diverged` flag matters for confirmation: `protocolFor` routes class
`sqli_second_order` to the sqli_boolean protocol, judged on `diverged`
(`differential.js`) — `errorCorrelated` alone would land `unconfirmed`.

## Safety
Lab-gated like the rest of the SQLi family. The store step WRITES to the
target, so the phase runs only when `allowWrite` (the target host is
listed in `labTargets`); on a non-lab host it records a gated skip
(`lab-gated: second-order writes need a lab target`), and the probe
re-checks `isLabTargetHost` itself before any request.

## Limits
- Error-based leg only in v1. Time-based (store a SLEEP payload, read the
  delay on the trigger request) and OOB (store a callback payload, watch
  for the hit on the trigger request) legs are the same two-step shape
  and can extend this file.
- One confirmed finding per form: a confirmed malicious store poisons the
  trigger page for every later input in the same form, so later inputs
  could not be attributed honestly.
- Trigger pages are the form action + the site root (the stored-xss
  model). An application that executes the stored value only on a
  different page (e.g. an admin review queue) is not covered.
