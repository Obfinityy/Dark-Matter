# XPath Injection

## What it is
Apps querying XML with user input (`//user[username='<input>']`) let an
attacker break out of the string literal: `' or '1'='1` turns the predicate
TRUE for every node; `'] | //* | //*['` unions the whole document.

## How the scanner checks it
Per URL parameter (max 10), against a benign baseline:

1. **Boolean:** `' or '1'='1`, `'] | //* | //*['`, `1' or 1=1 or '1'='1`
   must return a node set diverging >25% (>200 chars).
2. **Error:** XPath engine text (`XPath`, `XPathExpressionException`,
   `javax.xml.xpath`) on the breakout, absent on benign.

**Proof oracle:** `evidence.signalCorrelated=true` → default protocol →
**confirmed** (severity **high**).

## Payloads
The three breakout shapes above.

## Limits
- Blind XPath (no output difference) is not confirmed.
- Only URL params today.
