# Reflected Cross-Site Scripting (XSS)

## What it is
User input is reflected into the HTML response without encoding, letting an
attacker execute JavaScript in a victim's browser (session theft, actions).

## How Dark Matter checks it
For every discovered parameter, the scanner injects a unique canary payload
containing break-out characters:

```
'"<>dmxss<random-hex>
```

Probe: `backend/src/scanner/probes/xss.js` (`probeXssReflected`).

## Payloads used
The raw canary above. Control: the HTML-encoded variant
(`&quot;&#x27;&lt;&gt;dmxss…`) is sent as a second request — it must **not**
come back raw.

## URI-scheme leg (14 Nov 2026, row #272)
`probeXssUriScheme` (same file, wired into the `xss` battery step
alongside `probeXssReflected`) sends `javascript:dmxss<rand>` and
`data:text/html,dmxss<rand>` per parameter and confirms **only** when the
value appears verbatim inside a navigable-URL attribute
(`href`/`src`/`action`/`formaction`/`xlink:href`) — class
`xss_uri_scheme`, severity **medium** (click-required). A bare text echo
never confirms; no browser execution is needed for the reflection proof.

## What counts as proof (oracle)
The raw canary is reflected verbatim and unencoded in the response
(`canaryReflected: true`). Encoded reflections are not findings.

## Limits
Reflected XSS only in v1. Stored XSS needs a second read step (persistence
check across a fresh GET) and DOM XSS needs JS-sink analysis — both are
documented next steps, covered today by the Dalfox pipeline phase and manual
review.
