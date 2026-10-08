# components/ — Reusable UI Components

Shared React components plus feature galleries. Organized by area:

- `agent/` — Infinity AI chat/build/control UI
- `brand/` — Infinity AI branding elements (logo, wordmark)
- `fx/` — visual effects (original implementations; never verbatim copies)
- `hunt/` — hunt feature components and **wave galleries**. Each wave ships
  6 files here: `*Core.js` (pure logic + registry), `.jsx` (components +
  export-only gallery), `.css` (scoped, zero keyframes), `.test.js`.
  Galleries are export-only and never mounted in production.

## Conventions

- Real functionality only — no mock/simulate buttons, no decorative keyframes.
- Wave CSS is scoped (`.<prefix>-`) with zero animations per the zero-animation order.
- Product copy says **Infinity AI** only — never DarkMatter or Muse.
