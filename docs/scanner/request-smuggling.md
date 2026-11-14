# HTTP Request Smuggling

## What it is
Front-end and back-end servers disagreeing on where a request ends
(`Content-Length` vs `Transfer-Encoding: chunked`) let attacker bytes be
processed as a new request — cache poisoning, credential hijack, response
splitting at the infrastructure layer.

## How the scanner checks it
Raw TCP (`node:net`; fetch normalizes the headers, so byte-exact sockets
are required). Plain HTTP only in v1 — HTTPS needs a TLS layer, documented
limit.

1. **Baseline:** clean POST + pipelined GET — must yield 2 clean responses
   (else the oracle is unusable and the probe bails).
2. **Ambiguous:** POST with `Content-Length: 6` + `Transfer-Encoding:
   chunked` (conflicting) + pipelined GET.
3. **Verdict:**
   - **high** — proven desync: response count differs from baseline, or a
     400 where the baseline was clean (leftover bytes corrupted the next
     request).
   - **medium** — the server answered the ambiguous request with 2xx/3xx
     instead of rejecting it with 400: the CL.TE/TE.CL precondition is
     real, desync not proven.

**Proof oracle:** differential vs the clean baseline on the same
connection pattern (`signalCorrelated`). The probe would rather miss than
cry wolf — ambiguity without evidence is not a finding.

## TE-variant legs (rows #352–#354, 14 Nov 2026, lab-gated)
The same raw-socket oracle, appended after the CL.TE leg — each leg fires
a **high** finding only on a proven desync judged by the shared
`assessSmugglingDesync` oracle (smugglingClCl.js). One finding per leg;
the first proven attempt wins. A correct 400 rejection of the ambiguous
request is quiet, never a finding.

- **#352 TE.CL** — same conflicting body, `Transfer-Encoding` presented
  *before* `Content-Length`.
- **#353 TE.TE** — obfuscated `Transfer-Encoding` spellings, one attempt
  each: `xchunked`, space before the colon, duplicate TE headers
  (`chunked` then `identity`), vertical-tab (`Transfer-Encoding:\x0bchunked`).
- **#354 chunked-extension / LF-only** — terminal 0-chunk with an
  extension (`0;ext=x`, `Content-Length: 12`), and LF-only line endings
  in the chunked body (`0\n\nX`, `Content-Length: 4`).

Lab gate: the variant legs run only when the scan explicitly allows
writes on a lab target (`allowWrite` + lab host — the same gate
file-upload gets; the plan call passes both through). The CL.TE leg
above stays ungated exactly as before. The CL.TE desync judgment uses
the shared oracle: a 400 on the *first* response is correct rejection,
not a desync (the old inline check flagged any 400 anywhere — a latent
false positive against the verified #351 semantics).

## Payloads
The single conflicting-length shape above — the disagreement IS the test.

## Limits
- HTTP only (no TLS in v1).
- Servers that don't pipeline (baseline < 2 responses) are skipped.
- Medium findings need a manual desync proof to upgrade.
