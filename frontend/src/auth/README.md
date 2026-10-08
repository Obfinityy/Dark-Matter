# auth/ — Authentication Context

Session state for the signed-in user: login, logout, token refresh, and the
`useAuth` hook consumed across the app.

## Key files

- `AuthContext.jsx` — provider + `useAuth()` hook (user, token, loading state)

## Conventions

- All API calls go through `services/api.js`, which reads the token from here.
- Never store tokens in `localStorage` manually — use this context.
