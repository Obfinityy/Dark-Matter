# middleware/ — Express Middleware

Request pipeline middleware shared by all API routes.

## Key files

- `auth.js` — authentication and session validation
- `requestContext.js` — per-request context (request id, user, timing)
- `errorHandler.js` — centralized error → HTTP response mapping

## Conventions

- Registered in `src/app.js` (order matters: context → auth → routes → errors).
- Middleware stays thin; business rules belong in `services/` and `controllers/`.
