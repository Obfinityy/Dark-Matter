---
name: ssti
description: Server-side template injection — {{7*7}} first, engine second, proof third
---
## Attack surface
Inputs rendered through a template engine: display names and profile fields, e-mail / preview generators, CMS page builders, error pages, PDF and report builders, search-result greetings.
## Detection channels
Evaluation (your arithmetic renders as its result), error (template engine errors naming the engine), and reflection (the expression returns literally — a negative).
## Testing methodology
1. Put {{7*7}} in ONE input and open the page or response that renders it.
2. If the output shows 49, the engine evaluated your input. If it shows {{7*7}} literally, this input is not template-rendered — stop here.
3. If braces are escaped or stripped, try the other common syntaxes once each: ${7*7}, #{7*7}, <%= 7*7 %>.
4. Identify the engine from its error messages or behaviour BEFORE escalating — the escalation shape differs per engine.
5. Escalate exactly one step to prove control: an engine-appropriate probe that reads a harmless config value or evaluates a second, distinct expression (e.g. {{7*8}} rendering 56 alongside the first).
6. Stop at demonstrated evaluation plus one controlled effect. Do not turn it into code execution on the box.
## Validation
Probed and proven means: the rendered output contains the evaluated result (49, and 56 for the control expression) from a reproduced request — claim with the exact request and the rendered output. A literal reflection of the expression is evidence AGAINST, not for.
## False positives
A calculator or search feature that legitimately evaluates arithmetic outside a template; your expression reflected verbatim in an attribute or a code sample on the page; another user's content containing 49 by chance. Two distinct expressions evaluating is what separates SSTI from coincidence.
