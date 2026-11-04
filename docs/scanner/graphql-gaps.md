# GraphQL Gap Coverage — #155 / #156 / #158

Rule-based GraphQL tests added beyond the base probe (see `docs/scanner/graphql.md`).
All tests live in `probeGraphql()` in `backend/src/scanner/probes/graphql.js`,
Standard/Deep depth only. Quick depth skips them.

## #155 — GraphQL CSRF on GET-based queries — MEDIUM

**Method.** Two-condition differential test; the finding fires ONLY when both hold:

1. **GET execution:** `GET <endpoint>?query={__typename}` (benign introspection
   constant). 200 + JSON with `data.__typename` = the endpoint executes queries
   sent via GET.
2. **Unprotected session cookie:** fetch the target page, read `set-cookie`
   headers. Any session-ish cookie (`sess|session|auth|token|sid|phpsessid|
   jsessionid|aspsession`) is weak when its SameSite attribute is **missing**,
   or `SameSite=None` without `Secure`. `SameSite=Lax|Strict` (or
   `None; Secure`) = protected, no finding.

**Payloads.**
- Probe: `GET /graphql?query=%7B__typename%7D`
- Cookie read: `GET /` (target page), `redirect: manual`, scan `set-cookie`.

**Proof criteria (differential honesty).**
- Positive: GET query executes AND ≥1 weak session cookie present.
- Rejects: GET unsupported (400/405/no `data`) → silent; all session cookies
  carry `SameSite=Lax|Strict` → silent.

**Limits.** CSRF via GET only matters for endpoints that execute
state-changing operations on GET (queries with side effects, GET mutations).
The finding flags the *precondition* (executable GET + cookie), not a
confirmed cross-site state change — impact_demo states this. No cross-origin
request is actually issued from a browser context.

## #156 — GraphQL field-level authorization bypass — HIGH (CRITICAL for clear privileged values)

**Method.** Requires introspection ON (reuses the base probe's detection).

1. Enumerate root query fields: `{__schema{queryType{fields{name}}}}`.
2. Filter for sensitive names: `password|passhash|ssn|socialsecurity|secret|
   token|apikey|api_key|email|phone|salary|wage|admin|role`.
3. Query up to 3 of the most sensitive-looking fields in one document,
   **unauthenticated** — sent with no caller-supplied headers (no
   `Authorization`), only the scanner UA.

**Payload.** `POST /graphql {"query":"{userEmail adminToken}"}` (no auth headers).

**Proof criteria (differential honesty).**
- Positive: 200 with **non-null, non-empty data** for ≥1 sensitive field.
  Empty arrays/strings and `null` = rejected (no finding).
- Errors alone are never proof — absence of errors is not absence of data.
- Severity: **high** by default; **critical** only when the field name is
  clearly privileged (`password|passhash|ssn|secret|token|apikey|api_key`) AND
  a non-trivial value (≥8 chars) is actually returned. Password-hash-shaped
  strings are the canonical critical case.

**Limits.** Best-effort per the coverage order: introspection-disabled
endpoints cannot be enumerated without schema knowledge, so the test is
skipped (no finding) there — that is a documented gap, not silent skipping.
The probe does not attempt authenticated bypass (token tampering etc.).

## #158 — GraphQL mutation mass assignment — HIGH (lab-gated)

**Method.** Via introspection, enumerate mutations and their input-object
types:

`{__schema{mutationType{fields{name args{name type{kind ofType{name inputFields{name}}}}}}}}`

For each mutation input object, flag privileged field names:
`role|isAdmin|admin|permissions|privilege|is_superuser|superuser`.

- **Non-lab targets — PASSIVE only (LOW):** if a mutation input type exposes
  privileged fields, emit `graphql_mutation_privileged_fields` (low) noting
  the surface. The mutation is NEVER sent off-lab.
- **Lab targets** (`opts.labTargets`, host match on `endpoint` host):
  send the mutation with documented fields + unexpected privileged fields,
  all **canary values** (`dm_<canary>`), on a **non-existent id** so no real
  data can be touched.

**Payload (lab).**
`mutation{updateUser(input:{id:"dm_ab12cd34", role:"dm_ab12cd34", isAdmin:true}){__typename}}`

**Proof criteria (differential honesty).**
- Positive: 200 with `data` returned and **no** "unknown field"/validation
  error — the privileged input field was accepted by the resolver.
- Rejects: validation error (`unknown field`, `invalid`, `validation`) with
  no `data` → silent. "Not found" on the fake id → silent.
- Severity: high (never critical — acceptance of a privileged field name is
  confirmed, but actual privilege escalation is not executed).

**Limits.** Read-only by design: canary values + fake id; a "not found" error
means the test is inconclusive (no finding), not a pass. Resolvers that
silently ignore unknown fields produce no finding — correct per the 100%
truth rule (unknown ≠ bound).

## Scan-time budget

- #155: 2 requests (GET query + page fetch).
- #156: 1 introspection + 1 field query.
- #158: 1 introspection (+ 1 mutation on lab targets).
- Total added worst case: ~5 requests, seconds-scale, $0 AI.
