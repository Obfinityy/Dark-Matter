# controllers/ — HTTP Controller Layer

Thin Express controllers: validate input, call services, format responses.
One file per domain (auth, hunts, voice, computer, billing, …).

## Key files

- `agentController.js`, `huntController.js` (if present) — hunt lifecycle endpoints
- `authController.js`, `billingController.js` — identity and payments
- `voiceController.js` — Infinity Voice TTS endpoints
- `computerController.js`, `computerTaskController.js` — Control-mode endpoints
- `brainChatController.js` — Infinity AI chat endpoints

## Conventions

- Controllers are thin: no business logic here — delegate to `services/`.
- All routes are registered centrally in `routes/index.js`.
- Use the shared error helpers from `core/errors.js`; never leak stack traces.
