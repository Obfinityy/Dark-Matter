---
name: ssrf
description: Server-side request forgery — make the server fetch an internal URL
---
## Attack surface
Features that fetch a URL you supply: webhooks, link previews, image or document import by URL, avatar-by-URL, PDF-from-URL, URL health checks and redirect followers.
## Detection channels
Content (the fetched internal content returns to you), error (connection errors naming internal hosts or ports), and difference (internal and external URLs answer measurably differently).
## Testing methodology
1. Find ONE feature that takes a URL and baseline it with a normal external address: https://example.com — save the response shape.
2. Set the URL to http://169.254.169.254/latest/meta-data/ — metadata content in the response, or an error that only a real fetch attempt explains, proves the server fetched it.
3. If the metadata address is blocked, try http://127.0.0.1/ on the same feature and compare against the baseline.
4. Change one variable at a time (host, then scheme, then port) so every difference is attributable.
5. Instance-identity lines from metadata are enough proof — never use the fetched access to reach other services or other users' data.
6. If both internal addresses return the same generic failure as a nonsense external URL, this feature validates or allow-lists — rule it out.
## Validation
Probed and proven means: internal content returned by the server-side fetch, or a reproduced difference between internal and external requests with both requests kept as evidence. Claim with the exact commands and both outputs.
## False positives
The fetch happening in YOUR browser (client-side preview is not SSRF); a validator that rejects every non-allow-listed URL alike; a proxy error page that is identical for dead external hosts. If nonsense URLs and internal URLs fail identically, nothing was forged.
