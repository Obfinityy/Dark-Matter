---
name: jwt-session-abuse
description: Abuse a captured or issued JWT: replay, claim tampering, and algorithm confusion checks.
tags: jwt,auth,session,token,chain
targets: api,saas,ecommerce
last_verified: 2026-10-19
---
Use when the hunt holds any JWT (login response, captured chain artefact).
- Probe: replay the token against privileged endpoints; then tamper claims (role/id) and re-sign attempts (alg none, weak-secret guesses from the app context).
- Confirm: a tampered or replayed token is ACCEPTED by an endpoint that should reject it.
- Variants: kid traversal, RS256→HS256 confusion with the public key as HMAC secret.
- Ruled out when: signature verification rejects every tamper and expiry is enforced.
