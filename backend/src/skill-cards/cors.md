---
name: cors
description: CORS misconfiguration — reflected Origin with credentials allowed
---
## Attack surface
API endpoints that return Access-Control-* headers — above all authenticated JSON endpoints whose responses carry a logged-in user's data.
## Detection channels
Reflection (your arbitrary Origin comes back in Access-Control-Allow-Origin) combined with Access-Control-Allow-Credentials: true. Either one alone is not a finding.
## Testing methodology
1. Pick ONE authenticated API endpoint on the target and request it with a foreign origin: curl -s -i -H "Origin: https://evil.example" <endpoint>.
2. Read the response headers: Access-Control-Allow-Origin reflecting https://evil.example AND Access-Control-Allow-Credentials: true is the misconfiguration.
3. If the foreign origin is not reflected, retry once with Origin: null — sandboxed contexts send it, and some servers allow it.
4. Confirm the endpoint actually returns sensitive data under a session (your own account only) — cross-origin reading of public data harms no one.
5. If the answer is Access-Control-Allow-Origin: * with no credentials header, stop: that combination cannot be exploited with a victim's session.
## Validation
Probed and proven means: the response headers from a reproduced request showing an arbitrary origin reflected WITH credentials allowed on an endpoint that returns session data. Claim with the exact curl command and the full header block.
## False positives
A wildcard origin on public, unauthenticated data; reflection on endpoints that return nothing sensitive; headers added by a CDN only to static assets. Test the real API endpoint, not the homepage — header sets differ per path.
