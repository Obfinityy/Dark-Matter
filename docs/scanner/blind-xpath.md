# Blind XPath Injection

## What it is
The blind variant of XPath injection (row #479, CWE-643): the sink
evaluates injected XPath, but the application suppresses engine
errors and caps or pages the result set, so the general xpathi
oracle (error text, or a widening payload returning a node set
diverging >25%) never fires. The attacker still controls the XPath
boolean — `substring()` extraction reads XML-stored data one
character at a time without any error output.

## How the scanner checks it
Per URL parameter (max 6), against two benign baselines that must
agree first (a jittery page skips the param):

1. **T1 — TRUE/FALSE pair:** two payloads differing ONLY in the
   compared character of an injected XPath boolean. Shape A
   (primary): `' or substring('dmprobe',1,1)='d` (TRUE) vs
   `' or substring('dmprobe',1,1)='0` (FALSE) — the literal is
   known to the probe, so the verdict is self-verifying. Shape B
   (fallback): `' or '1'='1` vs `' or '1'='2`. The legs must
   diverge AND each leg must reproduce on repeat.
2. **T2 — second independent witness:** shape A extracts the
   literal further (positions 2, 3 — `m`, `p`); each position's
   TRUE leg must match the T1-TRUE signature and its FALSE leg
   the T1-FALSE signature. Shape B uses a `string-length()` pair
   (`=7` vs `=6`) instead.

A finding fires ONLY when T1 AND T2 both hold. The FALSE leg is
itself the nonsense control: a server that merely reacts to "weird
input" (any quote breaks the query into the same error page)
shows TRUE == FALSE and the probe stays quiet.

**Proof oracle:** `evidence.signalCorrelated=true` → default
protocol → **confirmed** (severity **high**). Class
`xpath_injection`, same as the general row — the title and id keep
the blind variant distinct in the dedupe key, so both findings
can stand on one sink.

## Payloads
The substring() / string-length() / equality shapes above; the
embedded literal is a fixed probe marker, never a secret.

## Limits
- Read-only GETs; no write surface is probed.
- A `contains()`-style template (the input stays a string
  argument) type-errors identically on both legs — honest no-op,
  not a finding.
- Only URL params and path segments today.
