---
name: xxe-file-upload
description: XML external-entity injection through file upload or import endpoints to read local files.
tags: xxe,xml,upload,import,file-disclosure
targets: ecommerce,api,enterprise
last_verified: 2026-10-19
---
Use when an endpoint accepts XML directly or inside an uploaded file (SVG, DOCX, SOAP, import features).
- Probe: DOCTYPE with an external entity pointing at /etc/passwd, placed where the parser echoes content or errors.
- Confirm: `root:x:0:0` (or the target file's known content) appears in the response or error message.
- Variants: parameter entities, billion-laughs-safe small expansions, other readable files (/etc/os-release) when passwd is filtered.
- Ruled out when: the parser is hardened (no entity resolution) — one clean failure is enough; do not loop payloads.
