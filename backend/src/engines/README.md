# engines/ — Security Analysis Engines

~590 small, pure-function engines that do the actual bug-hunting analysis:
recon, fingerprinting, vulnerability detection, PoC generation, risk scoring,
false-positive filtering, and report writing.

## Key files

- `eliteRecon.js` — subdomain + technology fingerprinting
- `vulnDetector.js` — SQLi / XSS / SSRF / IDOR detection
- `pocGenerator.js` — auto-generated curl + Python proof-of-concepts
- `riskScorer.js` — CVSS-style 0–10 scoring and finding prioritization
- `fpFilter.js` — false-positive filter with reasons
- `learningEngine.js` — learns from every hunt, suggests checks per tech stack
- `aiReportWriter.js` — professional bounty reports
- `chainBuilder.js`, `vulnChainReasoner.js` — vulnerability chaining (kept separate
  per architecture hold — not wired into the hunt loop until Infinity One decides)
- `secretScanner.js`, `jwtAnalyzer.js`, `corsChecker.js`, `paramMiner.js`,
  `takeoverChecker.js` — specialized detectors

## Conventions

- Every engine is a **pure function**: inputs in, findings out, no side effects.
- Each engine has unit tests; run them individually with `node --test`.
- New engines follow the `*Core.js` + registry pattern used by the wave system.
- Never add decorative code — no animations, no mocks, no TODO debris.
