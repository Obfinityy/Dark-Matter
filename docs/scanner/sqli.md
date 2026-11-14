# SQL Injection (error-based, union-based, blind)

## What it is
User input reaches a SQL query without proper parameterization, letting an
attacker alter the query — reading or writing database contents.

## How Dark Matter checks it
Four legs in the param battery (phases `sqli-error`, `sqli-blind`,
`sqli-union`, `sqli-boolean-blind`):

1. **Error-based** — for every discovered parameter, the scanner sends
   two requests: benign `?id=1`, malicious `?id=1'`.
   Probe: `backend/src/scanner/probes/sqliError.js` (`probeSqliError`).
2. **Time-based blind** — a SLEEP payload must ADD ~5s to the response
   time vs a double baseline.
   Probe: `backend/src/scanner/probes/sqliBlind.js` (`probeBlindSqli`).
3. **Union-based** (row #277 [Critical], 14 Nov 2026) — discover the
   column count (`ORDER BY n` differential, capped at 10), then send a
   UNION SELECT carrying a numeric canary (`1337` + 4 random digits,
   in every column so it renders in numeric and text columns alike)
   plus a control UNION with a different canary.
   Probe: `backend/src/scanner/probes/sqliUnion.js` (`probeSqliUnion`).
   Oracle dialect appends `FROM DUAL`. Lab-gated (see Limits).
4. **Boolean-based blind** (row #278 [High], 14 Nov 2026) — TRUE/FALSE
   payload pairs (`1' AND 1=1-- -` vs `1' AND 1=2-- -`): TRUE must
   return the baseline page, FALSE must change it, and a repeat must
   reproduce both in the same direction. Volatile values are stripped
   before the differential (`oracleGuards.js`, proof #18).
   Probe: `backend/src/scanner/probes/sqliBlind.js`
   (`probeBooleanBlindSqli`). Lab-gated (see Limits).

## Payloads used
A single quote (`'`) appended to the parameter value. The DB family is
identified from the error text to pick follow-up payloads later
(MySQL / MSSQL / Postgres / SQLite / Oracle signatures in
`fingerprint.js:detectDbFamily`).

## What counts as proof (oracle)
- Error-based: a database error signature appears on the malicious input
  **and is absent** on the benign input (`errorCorrelated: true`).
  One-sided errors (present on both, or on neither) are not findings.
- Union-based: the UNION SELECT returns the attacker-chosen canary
  where the benign query did not, AND the control UNION returns its own
  (different) canary — proving the channel is live and the probe canary
  is not stale/static (`unionConfirmed: true`, `columnCount` recorded).
- Boolean-blind: TRUE returns the baseline page, FALSE changes it, and
  a repeat reproduces both in the same direction
  (`booleanDiverges: true`). A DB error on either leg belongs to the
  error-based probe, never this one.

## Limits
- The union and boolean-blind legs are LAB-GATED: they run only when
  the target host is listed in `labTargets` (same gate as the HPP and
  OOB probes). A non-lab target returns no findings from these two
  phases without sending a single request — a skip, never a negative.
  The error-based and time-based legs run on any authorized target.
- UNION column-count discovery caps at 10 columns; the boolean-blind
  payloads assume a numeric/string context closed by `1'` (same
  assumption as the rest of the SQLi battery).
- Out-of-band SQLi lives in `sqliOob.js` (row #280) — a separate
  collaborator-based probe, not this file.
