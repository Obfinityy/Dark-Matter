---
name: sqli
description: SQL injection — boolean differential first, then error and time
---
## Attack surface
Any input that reaches a database query: login and search fields, id / sort / filter parameters, JSON body keys, and cookies or headers the app looks up or logs.
## Detection channels
Boolean (true and false fragments answer differently), error (SQL errors surface in the response), time (the response is delayed on demand), content (extra rows appear).
## Testing methodology
1. Send one request to a discovered endpoint with the input set to ' OR 1=1, then the identical request with ' OR 1=2 — only the fragment differs; keep both full responses.
2. Differing answers mean the input reaches the query. Repeat the pair once: the difference must be stable, not a fluke.
3. If the pair answers identically, send a lone ' (then a lone ") in the same input — a SQL error names the database and proves reachability.
4. If errors are hidden, go blind by time: ' OR SLEEP(5)-- on the same input; a ~5s delay against a fast baseline, reproduced once, proves it.
5. On a login form, put ' OR 1=1-- in the identity field with any password: a session or JWT issued for an account you are not is a confirmed bypass.
6. Stop at proof: reachability plus ONE controlled effect (one differing pair, one bypass, one stable delay). Do not dump tables or other users' rows.
## Validation
Probed and proven means: a reproduced request pair differing ONLY in the injected fragment, both full responses kept as evidence — or a bypass session replayed against an authenticated endpoint. Claim with the exact command and both outputs.
## False positives
WAF or validation pages that change for any odd input; ordinary "no results" pages; a catch-all error page. If ' OR 1=1 and ' OR 1=2 answer identically and no error or delay appears, this input is not injectable — move on.
