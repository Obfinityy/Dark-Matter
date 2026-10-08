# core/ — Shared Primitives

Dependency-free building blocks used across the backend: crypto helpers,
error types, and general utilities.

## Key files

- `crypto.js` — hashing, token, and secret helpers
- `errors.js` — typed application errors (mapped to HTTP status codes)
- `utils.js` — general-purpose helpers

## Conventions

- Nothing in `core/` may import from `services/`, `controllers/`, or `routes/`
  — it is the bottom of the dependency graph.
- Keep modules pure and testable; no I/O except where the function name says so.
