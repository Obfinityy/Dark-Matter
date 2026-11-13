# Blind XSS (out-of-band oracle)

## What it is
Blind (stored, out-of-band) cross-site scripting: attacker input is saved
server-side and executed later in a **different context than the injection
point** — typically an admin panel, moderation queue, or log viewer the
scanner never visits. Unlike stored XSS it cannot be confirmed by re-reading
a page: the only confirmation is out-of-band, a callback from the executing
context to a canary URL the scanner controls.

## How the scanner checks it
One step per text-ish form input (max 3 forms, 2 inputs each):

1. **Submit:** submit a canary payload into the input (`POST` body or `GET`
   query, matching the form's method). Every other input gets a unique
   filler (`dmprobeN_<rand>`) so a state-changing form can never fire by
   filler equality; `Submit=1` is set for DVWA-style `isset` gates.
2. **Wait:** wait for a callback hit on the in-process OOB collaborator
   (default 8s per input). The collaborator is started by `runScan` for the
   duration of the `blind-xss` phase only, and only for lab-gated scans.

**Proof oracle:** collaborator hit for our token → `evidence.oobHit=true`
→ the SSRF/OOB confirmation protocol marks it **confirmed** (severity
**high**). No hit → no finding (100% truth rule: unconfirmed stays
silent). Without a waiter (an external `oobCallback` string only) the probe
emits an honest `xss_blind_oob_sent` INFO record — dispatched,
confirmation out-of-band.

## Payloads
A single canary payload per input — an `<img src=x onerror="fetch('<canary URL>')">`
handler. The payload is **inert unless executed**: a bare reflection of the
payload string in a response triggers no fetch, so reflection alone can
never confirm (that is the reflected-XSS probe's job). `<img onerror>` (not
`<script>`) is the carrier because a `<script>` tag injected via `innerHTML`
does not execute in browsers, while an event-handler attribute does — the
admin-panel render path most often goes through `innerHTML`.

## Limits
- Lab-gated: the OOB leg runs only when the host is listed in
  `opts.labTargets` and a collaborator is up. Non-lab targets never receive
  a callback URL.
- Only form inputs are probed (max 3 forms, 2 inputs each); stored values
  that execute only after a long delay (beyond the 8s wait) are missed.
- The executing context must be able to reach the collaborator (docker
  bridge gateway `172.17.0.1` by default) — an admin panel on an isolated
  network cannot call back.
- Writes benign canary data to the target — authorized targets only.
