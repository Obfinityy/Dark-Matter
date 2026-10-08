# data/ — Static Data

Compile-time data bundled with the frontend.

## Key files

- `modelCatalog.js` — the local model library catalog (18 models, metadata,
  download URLs) shown on the Models page

## Conventions

- Static and version-controlled; runtime data comes from `services/api.js`.
- Keep entries factual — download URLs are verified before being added.
