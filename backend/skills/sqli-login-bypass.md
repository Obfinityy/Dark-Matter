---
name: sqli-login-bypass
description: Boolean SQL injection against a JSON login endpoint to obtain a privileged session.
tags: sqli,auth,login,jwt,session
targets: ecommerce,api,saas
last_verified: 2026-10-19
---
Use when a login form posts JSON credentials and errors hint at a database.
- Probe: put `' OR 1=1--` in the identity (email/username) field, any password.
- Confirm: the response issues a real session or JWT for a privileged account; replay it against an authenticated endpoint.
- Variants if the first form fails: other comment styles (`#`, `-- -`), closing the string differently, UNION SELECT on adjacent search/list parameters.
- Ruled out when: the payload is reflected sanitised or the endpoint is not SQL-backed (check the tech fingerprint first).
