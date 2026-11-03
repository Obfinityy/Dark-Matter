# SSI Injection

## What it is
Pages the web server parses for Server-Side Includes directives execute
`<!--#echo ... -->`, `<!--#include ... -->` and (on misconfigured hosts)
`<!--#exec ... -->`. User input landing in such a page unescaped runs the
directive — `#exec` is remote code execution.

## How the scanner checks it
Per URL parameter (max 10):

1. **Benign:** `param=dmssi<rand>` — must render inertly (echoed or not,
   but no date).
2. **Malicious:** `param=<!--#echo var="DATE_LOCAL" -->` — the server must
   render a date string, and the raw `#echo` text must NOT just echo back
   unprocessed.

**Proof oracle:** date rendered on malicious, absent on benign, directive
not merely echoed → `evidence.signalCorrelated=true` → **confirmed**
(severity **high**).

## Payloads
The single `#echo` directive — the execution IS the test.

## Limits
- Only URL params; `#exec`/`#include` are not attempted (the `#echo`
  proof already establishes directive execution).
- Servers without SSI parsing show no differential — correct negative.
