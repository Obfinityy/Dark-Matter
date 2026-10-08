# routes/ — API Routing Table

The single entry point for all REST API routes. Start here to understand
the backend's public surface.

## Key files

- `index.js` — **all** route registrations: auth, hunts, voice, computer,
  model-runner, billing, chat, and more

## Conventions

- One file by design — the full API surface stays greppable in a single place.
- Handlers are thin controllers from `controllers/`; middleware from `middleware/`.
- Versioned under `/api/v1/`; see root `AGENTS.md` for the key route list.
