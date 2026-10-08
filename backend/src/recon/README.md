# recon/ — Reconnaissance Scan Loops

Active reconnaissance routines used during the recon phase of a hunt:
subdomain enumeration, port chaining, parameter mining, and WAF adaptation.

## Key files

- `dnsBrute.js`, `subdomainTakeover.js` — subdomain discovery and takeover checks
- `portChain.js`, `netGuard.js` — port scanning with safety guards
- `paramLoop.js`, `jsEndpointLoop.js`, `apiFuzzer.js` — endpoint/parameter discovery
- `idorChecker.js` — insecure direct object reference checks
- `techPlan.js` — tech-stack-driven recon planning
- `wafAdaptive.js`, `scanLoops.js` — WAF-aware adaptive scanning

## Conventions

- All loops respect the scope allowlist and rate limits; `netGuard.js` is the
  safety gate — never bypass it.
- Findings flow into `engines/` detectors for analysis, then to `hunt/` for reporting.
