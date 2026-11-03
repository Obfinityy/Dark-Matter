# Open Redirect

## What it is
A parameter controls where the app redirects the user, enabling phishing:
victims trust the real domain, then land on the attacker's page.

## How Dark Matter checks it
For every discovered parameter, the scanner substitutes
`https://evil.example/` and observes the response **without following**
redirects (`redirect: 'manual'`).

Probe: `backend/src/scanner/probes/redirect.js` (`probeOpenRedirect`).

## Payloads used
`https://evil.example/` as the parameter value.

## What counts as proof (oracle)
An HTTP 3xx whose `Location` header points at `evil.example`
(`signalCorrelated: true`).

## Limits
Header-based redirects only in v1. Meta-refresh and JavaScript
(`location=`) redirects are documented next steps.
