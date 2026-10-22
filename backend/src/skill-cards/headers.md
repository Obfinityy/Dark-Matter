---
name: headers
description: Security headers — curl -s -I on the sensitive pages, report only real absences
---
## Attack surface
Every page the target serves — but only sensitive pages matter: login, account, admin, and anything carrying a session. Observable with one header request per page.
## Detection channels
Absence: no Content-Security-Policy, no X-Frame-Options / frame-ancestors (clickjacking), no Strict-Transport-Security on HTTPS, no X-Content-Type-Options, no Referrer-Policy.
## Testing methodology
1. Run curl -s -I on the target root and save the full header block.
2. Run the same on the login page (and the post-login landing page if you hold a session) — header sets differ per path, and only the sensitive pages count.
3. List which protections are absent on the SENSITIVE pages; note CSP present-but-weak (unsafe-inline everywhere) separately from CSP absent.
4. For clickjacking specifically: a login page with neither X-Frame-Options nor a frame-ancestors directive can be framed — that is the reportable core.
5. Report the absences as ONE low-severity hardening finding for the sensitive page. Do not inflate it, and do not report a static marketing page.
## Validation
Probed and proven means: the exact curl -s -I output for the sensitive page showing the absences — that output IS the whole evidence. Claim with the command and the header block.
## False positives
Headers present on the root but stripped by the app on the login route (test the real page, both ways); a CDN that adds headers only to cached copies; HSTS absent on an HTTP-only redirect hop that never serves content. Absence on a page nobody logs into is a note, not a finding.
