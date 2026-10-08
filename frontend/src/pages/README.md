# pages/ — Route Views

Top-level views wired to React Router. One directory or file per route.

- `Landing/` — marketing landing page
- `Auth/` — sign-in / sign-up
- `NotFound/` — 404 page
- `agent/` — Infinity AI workspace: `AgentHome`, `AgentChat`, `AgentConsole`,
  `AgentCharacter`, `Account`, `Alerts`, plus Hunt views (`HuntView`, `HuntTerminal`)

## Conventions

- Pages compose `components/`; they contain no reusable UI of their own.
- New routes are registered in `App.jsx` alongside their page import.
