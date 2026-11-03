# Sensitive File Exposure

## What it is
Deployment artifacts and debug endpoints left publicly reachable leak
source code, secrets, or server internals.

## How Dark Matter checks it
The scanner requests a fixed list of sensitive paths and checks for
content markers — not just HTTP 200 (which catches custom 404 pages).

Probe: `backend/src/scanner/probes/files.js` (`probeSensitiveFiles`).

## Paths and markers
| Path | Marker | Severity |
|---|---|---|
| `/.git/HEAD` | `ref:` | high |
| `/.env` | `=` | critical |
| `/phpinfo.php` | `phpinfo()` | medium |
| `/server-status` | `Apache Status` | medium |
| `/.DS_Store` | (any 200) | low |

## What counts as proof (oracle)
HTTP 200 **with** the content marker (`signalCorrelated: true`).

## Limits
Fixed path list in v1. Wordlist-driven discovery (ffuf/gobuster phase in
`docker/tools/`) extends coverage in later versions.
