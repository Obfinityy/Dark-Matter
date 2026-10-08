# crawler/ — Interactive Crawling Strategies

Strategies for crawling modern JS-heavy web apps during recon: how to drive
interactive pages, trigger dynamic content, and enumerate client-side routes.

## Key files

- `interactiveStrategies.js` — click/scroll/form strategies for dynamic pages

## Conventions

- Strategies are pure descriptions (what to do); execution belongs to `hunt/`.
- Scope allowlist is enforced before any network action — crawlers never run
  against out-of-scope targets.
