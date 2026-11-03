# Server-Side Template Injection (SSTI)

## What it is
User input is evaluated as a template expression, letting an attacker
execute code on the server.

## How Dark Matter checks it
For every discovered parameter, the scanner injects `{{7*7}}`.

Probe: `backend/src/scanner/probes/ssti.js` (`probeSsti`).

## Payloads used
`{{7*7}}` (Jinja2/Twig/Smarty-style delimiters).

## What counts as proof (oracle)
The response contains `49` **and not** the literal `{{7*7}}`
(`signalCorrelated: true`) — the engine evaluated the expression.
A literal reflection means the input is not evaluated: not a finding.

## Limits
`{{7*7}}` delimiters only in v1. `${7*7}`, `<%= 7*7 %>`, and engine-specific
payloads (Tornado, ERB, Razor) are documented next steps. The fingerprint's
tech detection picks the right family in later versions.
