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

## Blind SSRF (14 Nov 2026, coverage rows #237 [High] + #311)
A fetch that happens but returns nothing to the attacker can never confirm
under the metadata oracle — that is the definition of blind SSRF. The blind
leg sends a collaborator canary URL as the parameter value (the same
`oobCallback` / `oobWaitFor` seam sqli-oob and xxe use) and confirms class
`ssrf_blind` (HIGH) ONLY when the canary listener records a hit for the
probe token AND a never-advertised control token records NO hit.

- Control design (14 Nov 2026, live evidence): the control token is
  NEVER sent to the target — it is waited on only. A literal copy of
  the `ssrfReferer.js` leg-1 model (send the control canary the same
  way as the probe) was tested against a mock target that fetches any
  `?url=` value and returns nothing: BOTH tokens hit, so the copy
  REJECTS a genuinely vulnerable fetcher. The Referer model's control
  relies on a per-page-cache assumption ("link preview cached per
  page") that has no param equivalent — a server that fetches a URL
  param fetches every value it is given. The probe token is
  fresh-random per run and advertised only in the probe request, so
  its hit already attributes the fetch to the probe; a hit for the
  never-sent control token can only mean the listener records hits
  the probe did not cause, so the leg rejects.
- Lab-gated: the wiring starts one collaborator per `ssrf` task only when
  the scan target is a lab host, and the probe re-checks `opts.labTargets`
  before sending anything — a non-lab target never receives a callback URL.
  Without the collaborator seam the leg is skipped, never guessed at.
- Capped at the first 2 URL-shaped parameters per scan target (the
  sqli-oob global-cap discipline: each parameter costs a 5 s probe wait
  plus a 1 s control wait).
- Skipped on a parameter the metadata leg already confirmed — that
  parameter is already proven fetchable.
- Waits: 5 s for the probe token, 1 s for the control token.

## Limits
Metadata-exfil plus the blind collaborator leg in v1. No timing-differential
blind channel (a fetcher that is slow but synchronous would show as a hit
only if it fetches within the 5 s window); no DNS-only exfiltration channel
(the collaborator speaks HTTP only).
