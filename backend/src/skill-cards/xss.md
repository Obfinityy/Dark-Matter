---
name: xss
description: Cross-site scripting — find the reflection context, then prove execution
---
## Attack surface
Any input rendered back into a page: reflected parameters (search, error pages), stored fields shown to users (profile, comments, names), and client-side DOM sources (location, hash, postMessage).
## Detection channels
Reflection (your marker returns in the response), context (HTML body, attribute, script string, or DOM), and execution (the payload actually runs in the browser).
## Testing methodology
1. Put a harmless unique marker (e.g. dmxss123) in ONE input and find exactly where it lands in the response or page — context decides the payload.
2. HTML body context: send <script>alert(1)</script> and check whether it returns unescaped in the page source.
3. Attribute context: break out first — "><svg onload=alert(1)>. Script-string context: '-alert(1)-'.
4. Prove execution, not reflection: open the page with browser_open and use browser_snapshot / screenshot — the payload must run or render live, not merely appear in raw text.
5. Stored candidates: submit the marker payload in a field, then open every page that displays that field (profile, listing, admin view) and repeat step 4 there.
6. Keep payloads harmless: alert(1) or your unique marker only. Never a payload that steals data.
## Validation
Probed and proven means: the payload observed executing in the browser, or stored and served unescaped where browsers render it — with the exact request and the rendered page text or screenshot as evidence. Reflection that is fully entity-encoded is not a finding.
## False positives
Marker reflected inside a plain-text or JSON response that is never rendered as HTML; fully encoded reflection (&lt;script&gt;); a strict CSP that blocks the execution you observed nowhere. If it never runs in the browser, do not claim it.
