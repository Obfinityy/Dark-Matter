# Path Traversal / Local File Inclusion (LFI)

## What it is
A file-path parameter lets an attacker escape the intended directory and
read arbitrary server files.

## How Dark Matter checks it
For every discovered parameter, the scanner tries four traversal payloads and
looks for known file-content markers. Relative legs are tried first; the
absolute legs fire when a server blocks `../` but opens a bare absolute
path directly (coverage row #230). One finding per parameter — the first
confirming leg wins.

Probe: `backend/src/scanner/probes/traversal.js` (`probeTraversal`).

## Payloads used
- `../../../../../../../../etc/passwd` → marker `root:x:0:0` (Unix, relative)
- `..\..\..\..\..\..\windows\win.ini` → marker `[extensions]` (Windows, relative)
- `/etc/passwd` → marker `root:x:0:0` (Unix, absolute — row #230)
- `C:\windows\win.ini` → marker `[extensions]` (Windows, absolute — row #230)

## What counts as proof (oracle)
The response contains the file-content marker (`signalCorrelated: true`).
A 200 without the marker, or an error page, is not a finding.

## Limits
Read-only markers in v1. Null-byte and encoding-bypass variants
(`..%2f`, `....//`) are documented next steps.
