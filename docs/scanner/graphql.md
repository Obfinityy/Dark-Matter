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

### T3. Mutation BOLA — HIGH (TWO-SESSION DIFFERENTIAL, #385)
**Status:** Implemented 14 Nov 2026 (coverage row #385).

The original unauthenticated-mutation sketch below was superseded: a
mutation on a foreign id sent without sessions cannot attribute the
write to a privilege failure, so the sound oracle is the two-session
differential (BFLA session model):

1. CALIBRATE: introspect `mutationType` for an update-style mutation
   whose input carries both an `id` field and a mutable `name` field;
   introspect `queryType` for a self field (`me`/`viewer`/`currentUser`)
   and an id-taking read field.
2. SESSIONS: admin login with `labCreds` (control); throwaway
   low-privilege registration + login (actor).
3. IDENTITY: `{me{id}}` as admin → the foreign (admin) object id.
4. READ: `{user(id:"<adminId>"){name}}` as low-priv → V0.
5. MUTATE: `mutation{updateUser(input:{id:"<adminId>" name:"dmbola<rand>"}){id name}}` as low-priv — exactly one mutation.
6. RE-READ: same read as low-priv → V1.

CONFIRMED only if V1 == canary and V1 != V0 — the persisted
cross-user write. A mutation response alone never confirms; an
`errors` answer rejects (hardened target).

Safety: canary values only (`dmbola<rand>`); blocklist: `delete`,
`remove`, `drop`, `destroy`, `purge` (never candidates); lab-gated
(lab host + `allowWrite` + `labCreds` + `apiRoutes`); uncalibrated
(no candidate, no self/read field, no sessions, unreadable V0)
returns no finding. Finding class `graphql_mutation_bola`.

The earlier unauthenticated three-step sketch (READ → MUTATE with
`dmmut<rand>` → RE-READ, V1 == canary != V0) is retained as the
oracle shape — the #385 leg is its two-session form.

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
- **Mutation:** State change verified (V1 == canary != V0) on the
  persisted re-read; the #385 two-session differential additionally
  requires an admin control session and a low-privilege actor session
- **Error leakage:** "Did you mean" + isomorphic control
- **Batching:** 20/20 bypass vs 429 baseline

## Scan-time budget

T1–T4 ≈ 12 requests; T5 ≈ 26. The #385 leg adds ≈ 9 (2 introspection,
up to 3 session POSTs, identity + 2 reads + 1 mutation). Full battery
≈ under 50 requests per endpoint.

## Not in scope (v1 limits)

- WebSocket subscription hijack (CSWSH #29)
- Persisted-query allowlist bypass (needs per-target hashes)
- Federation `_service` SDL (only if `/_service` responds — free add-on)
