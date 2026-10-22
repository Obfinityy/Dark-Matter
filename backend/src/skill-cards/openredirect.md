---
name: openredirect
description: Open redirect — an external URL in a redirect parameter the server honours
---
## Attack surface
Redirect parameters on any endpoint: next, url, redirect, redirect_uri, return, dest, target — most valuable on login, logout, and OAuth flows, where a trusted link lends its name to the landing page.
## Detection channels
Location (the response's Location header points at your external domain) and landing (the browser actually ends up on the external site).
## Testing methodology
1. Find ONE redirect parameter on a discovered endpoint and send its normal baseline value; note where it lands.
2. Set the parameter to https://example.com and request it: curl -s -I <endpoint-with-param> — read the Location header.
3. Location pointing at example.com is proof. Alternatively browser_open the URL and observe where you land.
4. If the exact URL is rejected, try the scheme-relative form once: //example.com as the parameter value.
5. Check whether the parameter sits on a login or OAuth flow — that is what raises the impact; a redirect on a plain link page is low severity and should be reported as such.
## Validation
Probed and proven means: a reproduced request whose Location header (or observed browser landing) is the external domain you supplied. Claim with the exact request and the response headers.
## False positives
Redirects to a subdomain of the target (same trust boundary — not open); an interstitial warning page that names the destination and requires a click; your parameter reflected in a page body without any redirect occurring.
