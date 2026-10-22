---
name: fileupload
description: File upload — a marker file that is stored and served back as-is
---
## Attack surface
Upload forms and endpoints: avatars, attachments, document import, media libraries — any multipart form, and any path that behaves like one (/upload).
## Detection channels
Storage (the file can be fetched back afterwards), serving (it returns with its content type intact), and disclosure (the response names the stored path).
## Testing methodology
1. Find ONE upload endpoint and learn its expected shape from the real form (field name, accepted types).
2. Upload a harmless .txt carrying a unique marker, with curl -F using the form's own field name — note the response and any stored path it reveals.
3. Fetch the file back from where uploads are served: your exact marker returned means storage is real and reachable.
4. Upload the same marker as an .html file. If it is later served AS HTML (content type text/html, rendered by browser_open), stored script content is possible.
5. Only if the .html is rejected, try ONE bypass: a double extension (file.html.txt reversed as file.txt.html) or a mismatched Content-Type on the part.
6. Use only your own marker files. Never overwrite an existing file, and never upload anything that executes for other users beyond the harmless marker.
## Validation
Probed and proven means: your uploaded marker fetched back and served as-is — HTML served as HTML is the strong form — with both the upload and fetch requests kept. Claim with both commands and outputs.
## False positives
Files stored but never web-reachable; downloads forced as attachments with a safe content type; random renames with no route that serves them back; an upload that succeeds but is quarantined or converted (images re-encoded). Storage without serving is a note, not a finding.
