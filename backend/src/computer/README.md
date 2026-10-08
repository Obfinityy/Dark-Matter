# computer/ — Desktop Control Bridge

The Control-mode bridge between the web app and the owner's local machine.
Lets Infinity AI see the screen, click, and type — models and actions stay
local, commands never traverse the cloud.

## Key files

- `actionSchema.js` — whitelisted action contract (click, type, screenshot, …)
- `computerState.js`, `computerEvents.js` — machine state and event bus
- `openInterfaceAdapter.js`, `mockComputerAdapter.js` — real vs. test adapters
- `agentSDriver.js` — driver for the on-device agent loop
- `outcomeCheck.js`, `recoveryAdvisor.js` — verify actions, suggest recovery
- `applicationResolver.js` — resolve app names to launch targets
- `setupGuide.js` — one-time local setup instructions

## Conventions

- The Python side (`backend/computer/`) is a separate bridge process; this
  directory is the Node.js half (protocol, schema, adapters).
- `mockComputerAdapter` exists for tests only — never use it in production paths.
- Every action must be whitelisted in `actionSchema.js` before it can run.
