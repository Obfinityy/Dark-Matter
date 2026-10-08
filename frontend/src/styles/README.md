# styles/ — Design System CSS

Global stylesheets for the Infinity AI design system (fx: DarkVeil,
SpotlightCard, DecryptedText, ElectricBorder, Bento).

## Key files

- `globals.css`, `layout.css` — base styles and app shell layout
- `infinity.css`, `elegant.css` — Infinity AI theme tokens
- `components.css`, `forms.css`, `auth.css`, `agent.css` — area styles
- `animations.css` — **legacy only**; new work follows the zero-animation order
- `dark-matter-overrides.css` — compatibility shims (do not extend)

## Conventions

- Component-scoped styles live next to their component; only shared tokens here.
- Original implementations only — inspired by reactbits.dev, never verbatim.
