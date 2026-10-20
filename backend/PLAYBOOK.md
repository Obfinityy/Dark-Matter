# Dark Matter Playbook — procedural memory

One rule per line. A rule earns its place ONLY after a validator-confirmed
success used the technique (promotion gate: `backend/src/playbook.js`).
The agent may propose rules freely (`PROPOSE_PLAYBOOK: ...`); proposals
stay inert in `data/playbook-proposals.jsonl` until the gate promotes
them. Promoted rules are appended below by the gate with their evidence
episode. Delete a bad rule's line to retire it — git history is the
audit trail.

- [verify] A failed command's error echo is never evidence — if the tool did not execute, the result does not exist. (earned: solver #442, verifier false-accept root cause)
- [verify] Homepage HTML/CSS, SPA fallback pages, redirect headers and timing printouts prove nothing — a finding needs the vulnerability's own signal in the response. (earned: solver #442 audit)
- [sqli] On a JSON login endpoint, try a boolean SQLi in the identity field (`' OR 1=1--`) — a returned privileged session/JWT is the confirmation signal. (earned: h_bench_d69e5746, SQLi authentication bypass, verified)
- [xxe] On XML-accepting uploads and imports, send an external-entity DOCTYPE reading /etc/passwd — `root:x:0:0` in the response or error is the confirmation signal. (earned: h_bench_d69e5746, XXE file disclosure, verified)
- [exposure] Probe well-known sensitive locations (/ftp/, backups, config artefacts) unauthenticated — a 200 carrying the file's real magic bytes (e.g. KDBX) is exposure; headers alone are not. (earned: h_bench_d69e5746, sensitive-file exposure, verified)
