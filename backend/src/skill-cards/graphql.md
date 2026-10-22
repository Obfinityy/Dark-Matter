---
name: graphql
description: GraphQL — introspection first, then one unauthorised query with your own data
---
## Attack surface
GraphQL endpoints (/graphql and variants), GraphQL-over-GET routes, and the schema itself: queries and mutations reachable without the authorisation the UI implies.
## Detection channels
Introspection (the schema is returned), verbosity (errors naming valid fields and types), and authorisation (a query returning data it should refuse).
## Testing methodology
1. POST the introspection query to the discovered endpoint: {"query":"{__schema{types{name}}}"} with Content-Type: application/json.
2. A full schema answer means introspection is on: record the sensitive query and mutation names, but treat the schema alone as a low-severity exposure unless the programme says otherwise.
3. If introspection is refused, send one simple query the app's own traffic uses (watch its requests) and read the errors — field suggestions are a map, not a finding.
4. Pick ONE sensitive query from the schema and run it with NO credentials, asking only for your own data or public data — a data answer is broken authorisation.
5. Stop there: one unauthorised data response is proof. Do not enumerate other users' objects or ids.
## Validation
Probed and proven means: the schema response (for introspection) or an unauthorised data response (for authorisation), each from a reproduced request kept in full. Claim with the exact request body and the response.
## False positives
Introspection enabled on a documented PUBLIC API by design (check the programme scope first); a schema containing only public types; error verbosity with every actual query correctly refused. Verbose errors alone are a lead — the data answer is the finding.
