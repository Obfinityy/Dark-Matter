# utils/ — Frontend Helpers

Small, pure helper functions shared across the app.

## Key files

- `normalizeTarget.js` — normalize user-pasted URLs into canonical hunt targets
- `owaspCoverage.js` — map findings to OWASP categories for coverage display

## Conventions

- Pure functions only — no React, no DOM, no network.
- Tested alongside the components that use them.
