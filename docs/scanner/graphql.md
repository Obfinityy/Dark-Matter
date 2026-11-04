# GraphQL Endpoint Testing Probe

## What it is

GraphQL is a query language whose endpoints accept arbitrary query documents.
This probe tests GraphQL endpoints for known vulnerability classes using
predefined requests — no AI, no browser required.

## Detection surface

1. **Path probes** (max 8 requests): POST `{"query":"{__typename}"}` to:
   - `/graphql`, `/api/graphql`, `/graphql/console`, `/graphiql`,
     `/.well-known/graphql`
   - Plus any crawler-discovered endpoint matching `/graphql/i`
   
   200 + JSON with `data` or `errors` = GraphQL confirmed.

2. **Passive**: JS/HTML bundle scan for `__schema`, `/graphql`, `apollo`,
   `graphiql`, `playground`.

## Sub-tests

### T1. Introspection enabled — INFO (LOW with sensitive types)
Query: `{"query":"{__schema{queryType{name}}}"}`

- 200 JSON with `data.__schema` = introspection ON
- Follow-up: dump `types{name}` (cap: 3 requests total)
- Flag sensitive type names via regex: `password|secret|token|ssn|admin|internal|debug`

**Oracle:** Positive = JSON `data` present. Finding = INFO (LOW if sensitive types).

**Reference:** OWASP GraphQL cheat sheet, Shopify 2018, GitLab 2023.

### T2. Query-depth / alias-overloading DoS — MEDIUM/HIGH (GATED)
**Gate:** Only on Standard/Deep depth, after T1 confirms schema.

- Baseline: median of 3 `{__typename}` requests
- Payload: 50 aliased `__typename` fields in one query
- **Oracle:** CONFIRMED only if payload median ≥ 10× baseline AND baseline stable (±25%)

Cap: single round, no amplification loops.

**Reference:** CVE-2024-34381, Apollo Server best practices.

### T3. Unauthenticated mutation — HIGH/CRITICAL (STATE-VERIFYING)
**Status:** Spec written, implementation pending.

Three-step differential:
1. READ: query current value unauthenticated → V0
2. MUTATE: send mutation with unique canary value (`dmmut<rand>`)
3. RE-READ: query again → V1

CONFIRMED only if V1 == canary and V1 != V0.

Safety: canary values only, blocklist: `delete`, `remove`, `drop`, `destroy`, `purge`.

### T4. Error-based field suggestion — LOW/MEDIUM
Query non-existent field: `{"query":"{dmfield<rand>}"}`

**Oracle:** Response `errors[].message` contains "Did you mean" or leaks type names.
Control: second random name must produce isomorphic error.

**Reference:** OWASP GraphQL §suggestions.

### T5. Batching abuse — MEDIUM
- Probe: 5 rapid sequential `{__typename}` → check for 429s
- If rate-limited: send 20 batched queries in ONE POST
- **Oracle:** CONFIRMED if 20/20 responses returned despite rate limiting

Safety: 20 cheap `{__typename}` queries only, never mutations.

**Reference:** 2024 GraphQL batching attacks.

## What counts as proof

Per the 100% truth rule:
- **Introspection:** JSON `data.__schema` present (positive control)
- **DoS:** Latency differential (10× + stable baseline)
- **Mutation:** State change verified (V1 == canary != V0)
- **Error leakage:** "Did you mean" + isomorphic control
- **Batching:** 20/20 bypass vs 429 baseline

## Scan-time budget

T1–T4 ≈ 12 requests; T5 ≈ 26. Full battery ≈ under 40 requests per endpoint.

## Not in scope (v1 limits)

- WebSocket subscription hijack (CSWSH #29)
- Persisted-query allowlist bypass (needs per-target hashes)
- Federation `_service` SDL (only if `/_service` responds — free add-on)
