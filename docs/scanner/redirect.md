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
`https://evil.example/` as the parameter value, then — only when the
plain value does not fire for that parameter — the bypass variants:

- **#401 protocol-relative / backslash:** `//evil.example`,
  `/\evil.example`, `https://evil.example\`
- **#403 userinfo (@) trick:** `https://trusted.com@evil.example`,
  `https://evil.example%40trusted.com`
- **#470 Unicode / IDN:** `https://evil。example/` (U+3002 ideographic
  full stop), `https://ｅｖｉｌ.example/` (full-width latin),
  `https://xn--vil-qdd.example/` (punycode for the Cyrillic-е homograph
  `еvil`), `https:%C0%AF%2Fevil.example` (overlong UTF-8 for `/`)

The first firing value per parameter records the finding; a variant
finding names the variant and its coverage row in the evidence
(`evidence.variant`, `evidence.coverageRow`) and in the finding id
(`open-redirect-protocol-relative-<param>`,
`open-redirect-userinfo-<param>`, `open-redirect-unicode-idn-<param>`).
Request budget: at most 10 params × (1 base + 9 variants) = 100 requests.

## What counts as proof (oracle)
An HTTP 3xx whose `Location` header points at `evil.example`
(`signalCorrelated: true`). The oracle is the same for every value —
a 200 with `evil.example` in the body, or a 200 carrying a `Location`
header, never confirms.

## Limits
Header-based redirects only in v1. Meta-refresh and JavaScript
(`location=`) redirects are documented next steps.
