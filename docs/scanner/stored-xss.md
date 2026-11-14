# Stored XSS (two-step oracle)

## What it is
Stored (persistent) cross-site scripting: attacker input is saved server-side
(guestbook entry, comment, profile field) and rendered back to every later
visitor. Unlike reflected XSS it needs no victim click on a crafted link —
viewing the page is enough, so it is the highest-impact XSS class.

## How the scanner checks it
Three steps per text-ish form input (max 5 forms, 3 inputs each):

1. **Baseline:** `GET` the form's action page. The freshly-random canary
   (`dmxss<16 hex>`) must be absent — sanity control.
2. **Inject:** submit the canary into the input (`POST` body or `GET` query,
   matching the form's method). Every other input gets a unique filler
   (`dmprobeN_<rand>`) so a state-changing form can never fire by filler
   equality (the e5878767 safety rule); `Submit=1` is set for DVWA-style
   `isset` gates.
3. **Verify:** re-`GET` the action page **and** the site root. If the canary
   now appears verbatim, the value was stored and re-rendered.

**Proof oracle:** canary absent before submit, present verbatim after →
`evidence.canaryReflected=true` → the xss confirmation protocol marks it
**confirmed** (severity **high**).

## Payloads
A single canary string per input — no payload list. The canary IS the proof;
executability follows from verbatim reflection into HTML.

## URI-scheme leg (14 Nov 2026, row #272)
`probeStoredXssUriScheme` (same file, wired into the `stored-xss` plan
alongside `probeStoredXss`) submits `javascript:dmxss<rand>` and
`data:text/html,dmxss<rand>` into the first text-ish input per form and
confirms **only** when the value re-renders verbatim inside a
navigable-URL attribute on the action page or site root — class
`xss_uri_scheme_stored`, severity **medium** (click-required). A bare
text re-render never confirms.

## Limits
- Only re-reads the form's action page and the site root; stored values
  rendered on other pages are missed (the Nuclei battery covers per-path
  stored-XSS templates).
- JavaScript-rendered storage (localStorage/DOM) needs a browser — out of
  the rule-based scanner's scope, documented as a gap.
- Writes benign canary data to the target — authorized targets only.
