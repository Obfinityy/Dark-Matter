# OS Command Injection (time-based)

## What it is
User input reaches a shell command, letting an attacker execute OS commands
on the server.

## How Dark Matter checks it
For every discovered parameter (max 6, to bound scan time):
1. Baseline: `?id=1` — must respond fast (< 3s), else inconclusive.
2. Malicious: `?id=1;sleep 5` — response time is measured.

Probe: `backend/src/scanner/probes/cmdi.js` (`probeCmdiTime`).

## Payloads used
`;sleep 5` appended to the parameter value.

## What counts as proof (oracle)
The injected sleep tracks the response delay: response takes ≥ ~4s longer
than the fast baseline (`delayTracks: true` and `signalCorrelated: true`).
A slow baseline, a timeout, or no delay difference = no finding.

## Limits
Time-based only in v1 (Unix `sleep`). Output-reflection variants
(`;echo MARKER`) and Windows (`timeout`) payloads are documented next steps.
Each parameter costs ~5–10s of scan time by construction.
