---
name: cmdi
description: Command injection — append ; id and prove it with uid= output or timing
---
## Attack surface
Inputs plausibly passed to a shell command: network utilities (ping, traceroute, DNS lookup), file conversion and import/export features, filename and path parameters, backup/restore actions.
## Detection channels
Output (the command's output appears in the response), time (a sleep delays the response), and error (shell error text leaks into the response).
## Testing methodology
1. Pick ONE input on a discovered endpoint that plausibly reaches a command; send a normal baseline request and save its output and timing.
2. Send the same request with the input set to test; id — a uid= line in the response proves the command ran.
3. If ; is filtered or stripped, try the other separators in turn: test|id, test&&id, test`id`, test$(id) — one variable at a time.
4. If output never returns, go blind by time: test; sleep 5 against the baseline timing, reproduced once.
5. Confirm with a second harmless command (whoami) only if step 2 or 4 was positive.
6. Stop at id / whoami output. Do not explore the filesystem, the network, or other accounts from the shell you reached.
## Validation
Probed and proven means: uid= / gid= output (or a stable, reproduced sleep delay against baseline) produced by a reproduced request — claim with the exact command line you ran and the full output. A single unexplained delay is not proof.
## False positives
Coincidental slow responses (repeat the timing pair before believing it); your own input reflected back containing the word "id"; generic 500 errors with no shell text. If every separator returns the ordinary baseline, this input does not reach a shell — move on.
