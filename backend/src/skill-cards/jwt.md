---
name: jwt
description: JWT attacks — alg none, tampered claims, algorithm confusion
---
## Attack surface
Session tokens the hunt legitimately holds: JWTs from login responses, cookies, or Authorization headers — tested only against endpoints that should verify them. Never another user's token.
## Detection channels
Acceptance (an endpoint accepts a token it must reject: unsigned, tampered, confused, or expired). Decoding the token is not a channel — every JWT decodes.
## Testing methodology
1. Capture a token THIS hunt was issued, and replay it unchanged against an authenticated endpoint — the baseline must accept. Also send NO token: if that is accepted too, the endpoint is public and there is nothing to test.
2. Decode header and payload (base64url) and note alg, kid, and the claims that carry privilege (id, role, admin).
3. Set the header alg to none, drop the signature, keep the claims — resend. Acceptance means signature verification is missing.
4. Restore the original signature but tamper ONE claim (your own id or role) — resend. Acceptance means integrity is not checked.
5. If alg is RS256, try the confusion: sign the tampered token with HS256 using the server's public key as the HMAC secret.
6. If an expired token is available, replay it — acceptance means expiry is not enforced.
## Validation
Probed and proven means: an authenticated endpoint accepting a token it must reject, reproduced with the exact requests kept (baseline, no-token control, and the forged token). Claim with all three.
## False positives
Endpoints that are public anyway (the no-token control accepts); client-side-only checks where the server re-verifies; a token accepted by a logout or refresh endpoint that issues nothing sensitive. Without the no-token control, acceptance proves nothing.
