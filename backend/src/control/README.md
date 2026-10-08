# control/ — Control-Mode Agent Loop

The runtime loop that executes Control-mode tasks: read the screen, decide
the next action, execute it, verify the outcome, repeat.

## Key files

- `agentLoop.js` — the perceive → decide → act → verify loop
- `actions.js` — concrete action implementations used by the loop

## Conventions

- Tasks come from `jobs/computerTaskWorker.js`; results stream back via SSE.
- The loop is brain-driven (no simulated steps) and bound by `computer/`
  `actionSchema.js` — any action outside the whitelist is rejected.
