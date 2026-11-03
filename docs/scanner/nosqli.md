# NoSQL Injection

## What it is
Modern apps backed by MongoDB/CouchDB build queries from user input with
operators (`$ne`, `$gt`, `$where`). Injecting an operator bypasses equality
filters — the classic login bypass is `{"username": {"$ne": null},
"password": {"$ne": null}}`.

## How the scanner checks it
Per URL parameter (max 10), two differentials against a benign baseline
(`param=<random-unlikely>`):

1. **Boolean:** `param[$ne]=<unlikely>` (PHP-style) and a JSON
   `{"$ne": "<unlikely>"}` value. The operator variant must return a
   result set diverging >25% (>200 chars) from the benign one.
2. **Error:** MongoDB error text (`MongoError`, `unknown operator`,
   `$where`, `BSON`) on the operator input, absent on benign.

**Proof oracle:** `evidence.diverged=true` → the class name contains
`sqli`, so the sqli_boolean protocol judges it → **confirmed** (severity
**high**).

## Payloads
`$ne` operator in both encodings; error oracle needs no payload list.

## Limits
- Only URL params today (POST bodies use the same operator shapes — a
  post-forms variant is future work).
- `$where` JS-execution is detected via errors only, not time-based.
- Apps that sanitize operators server-side show no divergence — correct
  negative.
