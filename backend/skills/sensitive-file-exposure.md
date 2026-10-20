---
name: sensitive-file-exposure
description: Unauthenticated retrieval of sensitive files from well-known exposed locations.
tags: exposure,ftp,backup,config,kdbx,files
targets: ecommerce,api,enterprise,legacy
last_verified: 2026-10-19
---
Use early on any target: exposed storage is common and quiet to check.
- Probe: /ftp/, /backup/, /.env, config and credential artefacts (kdbx, pem, sql dumps) without authentication.
- Confirm: HTTP 200 AND the body's magic bytes match the claimed file type (KDBX header, PEM header, SQL text). Headers alone prove nothing.
- Variants: directory listing first, then the files it names; continue-code and support-bundle endpoints.
- Ruled out when: the location 404s or serves the SPA fallback (check Content-Length/ETag against the homepage).
