# Server-Side Request Forgery (SSRF)

## What it is
The server fetches an attacker-chosen URL, exposing internal services and
cloud metadata.

## How Dark Matter checks it
The scanner finds URL-fetching parameters (names like `url`, `image`, `src`,
`fetch`, `webhook`) and points them at the cloud metadata endpoint:

```
http://169.254.169.254/latest/meta-data/
```

Probe: `backend/src/scanner/probes/ssrf.js` (`probeSsrf`).

## Payloads used
The metadata URL above, substituted into each candidate parameter.

## What counts as proof (oracle)
Cloud metadata markers (`ami-id`, `instance-id`, `meta-data`) appear in the
response (`oobHit: true`) — the server-side fetcher reached our URL.

## Limits
Metadata-exfil only in v1. A full out-of-band collaborator listener (DNS/HTTP
callback for arbitrary internal targets) is a documented next step.
