# agent/ — Autonomous Hunting Brain

The decision-making core behind every hunt: state machines, brain providers,
methodologies, and schemas that turn recon data into attack plans.

## Key files

- `brain.js`, `autonomousBrain.js`, `deterministicBrain.js` — brain implementations
  (provider-backed vs. rule-based fallback)
- `huntStateMachine.js`, `stateManager.js` — hunt lifecycle and persisted state
- `planner.js`, `methodology.js` — attack planning and methodology knowledge
- `providers/` — brain providers (e.g. `gradioProvider.js` for the Kaggle vision link)
- `memory/` — per-hunt memory and context tracking
- `*Schema.js` — JSON decision schemas constraining brain output (`decisionSchema.js`,
  `autonomousDecisionSchema.js`, `computerTaskDecisionSchema.js`)

## Conventions

- Brains never touch the network directly — they propose actions; `hunt/` executes them.
- All brain output must validate against its decision schema.
- The resilient provider chain (`resilientBrainProvider.js`) falls back to the
  deterministic brain when the remote provider is unreachable.
