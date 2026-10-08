# hunt/ — Hunt Orchestration

The runtime that executes bug-bounty hunts: planning, running engines and
tools, streaming live results, and building reports.

## Key files

- `huntRunner.js` — main hunt execution loop
- `planner.js` — turns the brain's plan into an executable hunt
- `toolRunner.js` — launches security tools and managed binaries
- `engineFeed.js` — streams engine findings into the hunt pipeline
- `liveReport.js` — live report assembly during a hunt

## Conventions

- Brains decide (see `agent/`); this directory executes and records.
- Every finding requires evidence, not just status codes.
- Scope allowlist is enforced before any network action; testing is
  non-destructive only — no data modification, no DoS.
