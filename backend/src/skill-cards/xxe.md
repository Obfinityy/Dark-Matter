---
name: xxe
description: XML external entity — a DOCTYPE entity that reads a local file
---
## Attack surface
Any parser that accepts XML: SOAP endpoints, XML request bodies, SVG / DOCX / spreadsheet uploads, import features, RSS readers, SAML responses.
## Detection channels
Content (the referenced file's contents appear in the response), error (parser errors naming internal paths), and difference (entity resolution changes an otherwise identical response).
## Testing methodology
1. Identify ONE XML-accepting endpoint (content type, upload field, or import feature) and send a well-formed benign XML baseline.
2. Send the same shape declaring an external entity: <?xml version="1.0"?><!DOCTYPE r [<!ENTITY xxe SYSTEM "file:///etc/passwd">]> with &xxe; placed where content is echoed or errors surface.
3. Look for root:x:0:0 in the response OR in the error message — either is the parser resolving your entity.
4. If /etc/passwd is blocked but the parser resolves entities, retry once against /etc/os-release.
5. If entities resolve but nothing echoes, use a parameter-entity variant once to force an error carrying the content.
6. One clean failure against a hardened parser (entities rejected or ignored) rules this endpoint out — do not loop payload variants.
## Validation
Probed and proven means: the target file's actual contents (root:x:0:0…) appear in a response or error from a reproduced request. Claim with the exact command and the full output containing the file content.
## False positives
Your DOCTYPE echoed back unprocessed; generic XML parse errors with no file content; a WAF block page mentioning your payload. Reflection of the request is not resolution — without file contents, there is no XXE.
