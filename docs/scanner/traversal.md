# Path Traversal / Local File Inclusion (LFI)

## What it is
A file-path parameter lets an attacker escape the intended directory and
read arbitrary server files.

## How Dark Matter checks it
For every discovered parameter, the scanner tries two traversal payloads and
looks for known file-content markers.

Probe: `backend/src/scanner/probes/traversal.js` (`probeTraversal`).

## Payloads used
- `../../../../../../../../etc/passwd` → marker `root:x:0:0` (Unix)
- `..\..\..\..\..\..\windows\win.ini` → marker `[extensions]` (Windows)

## What counts as proof (oracle)
The response contains the file-content marker (`signalCorrelated: true`).
A 200 without the marker, or an error page, is not a finding.

## Limits
Read-only markers in v1. Null-byte and encoding-bypass variants
(`..%2f`, `....//`) are documented next steps.
