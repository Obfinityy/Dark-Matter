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

## Payloads
The single conflicting-length shape above — the disagreement IS the test.

## Limits
- HTTP only (no TLS in v1).
- Servers that don't pipeline (baseline < 2 responses) are skipped.
- Medium findings need a manual desync proof to upgrade.
