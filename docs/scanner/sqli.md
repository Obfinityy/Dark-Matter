# SQL Injection (error-based)

## What it is
User input reaches a SQL query without proper parameterization, letting an
attacker alter the query — reading or writing database contents.

## How Dark Matter checks it
For every discovered parameter, the scanner sends two requests:
1. Benign: `?id=1`
2. Malicious: `?id=1'`

Probe: `backend/src/scanner/probes/sqliError.js` (`probeSqliError`).

## Payloads used
A single quote (`'`) appended to the parameter value. The DB family is
identified from the error text to pick follow-up payloads later
(MySQL / MSSQL / Postgres / SQLite / Oracle signatures in
`fingerprint.js:detectDbFamily`).

## What counts as proof (oracle)
A database error signature appears on the malicious input **and is absent**
on the benign input (`errorCorrelated: true`). One-sided errors (present on
both, or on neither) are not findings.

## Limits
Error-based only in v1. Blind boolean/time-based SQLi is confirmed today via
the sqlmap lane (see the tooling research doc); UNION-based extraction is
proven in `dvwaAuth.js:dvwaSqliDump` for the DVWA lab.
