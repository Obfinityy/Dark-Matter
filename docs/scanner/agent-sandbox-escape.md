# Agent Sandbox Escape

## What it is
A NEW vulnerability class (14 Nov 2026, no coverage row yet). An AI
agent — or any sandboxed tool surface — exposes a tool-call endpoint
(`POST /agent/execute`, `/api/agent/execute`, `/agent/tool`, …) that
is supposed to confine the tool to the sandbox: the tool may echo,
read files inside its working directory, or run privileged actions
only with approval, and every action is written to an audit log. The
sandbox is escaped when a tool call reaches the host anyway:

- **Host command execution** — the exec tool evaluates a command on
  the host shell ([Critical]).
- **Sensitive file read** — the read_file tool follows a traversal
  out of its directory to credential files ([Critical]).
- **Approval-gate bypass** — a privileged action executes on a
  client-supplied `approved: true` (or with no approval at all)
  ([High]).
- **Audit-log evasion** — an executed action leaves no audit record
  ([Medium]).

Related existing coverage: row #485 [Critical] MCP tool poisoning
(a poisoned tool description — a different attack: the tool itself
is the vector, not the sandbox), rows #17/#379 [Critical/High] LLM
excessive agency (a state-changing agent action with no confirmation
step). This phase tests the sandbox boundary itself, not the model.

## How Dark Matter uses it
`backend/src/scanner/probes/agentSandboxEscape.js`
(`probeAgentSandboxEscape`, phase `agent-sandbox-escape`, the 149th
phase). Lab-gated: `allowWrite` + lab target host + depth ≠ `quick`
— the probe executes commands and deletes a lab user, so it never
runs outside a lab target or on a quick scan. No lab credentials:
the agent service is unauthenticated in the mock, like the LLM lab.
At most 24 tool-call POSTs per run; at most one finding per leg.

Legs (each a bounded differential with a benign control):

- **L0 exec** — `exec {command: 'expr 6 + 36'}`. Confirms only when
  the result is exactly `42`: an echo passthrough would return the
  literal command string; only a host shell evaluates the expression.
  The command contains no glob and no `42`, so a `42` answer cannot
  be an echo of the input.
- **L1 file read** — control: `read_file {path: 'hello.txt'}` must
  return the known public marker `ASE-PUBLIC-HELLO`; then the
  traversal `../private/credentials.txt`. Confirms only when the
  response carries the canary marker `ASE_CANARY_TOKEN=` (the mock
  lab's fake credential file — never a real secret).
- **L2 approval gate** — the victim is the last user of the agent's
  own `/agent/users` list. The unapproved `run_admin` delete_user
  must be refused first (control); then the crafted call with
  `approved: true`. Confirms only when the victim is also gone from
  a re-read user list (observed state change). If the unapproved
  call already executes, that fires the same finding (no approval
  at all). Each confirming run consumes one seeded lab user; the
  lab re-seeds on restart.
- **L3 audit evasion** — after L0/L2 executed, `GET /agent/audit`.
  Confirms only when the log answers with entries and none names
  the executed action. One finding per class: if both the exec and
  the admin action are missing, both are named in the single L3
  finding (the verifier dedupes same-class findings). If the audit
  endpoint does not answer, L3 is uncalibrated, never a finding.

Fingerprint: mined routes matching agent/tool-call patterns from
`apiRoutes` first, then the well-known paths above — but well-known
paths are tried ONLY on lab targets. A benign echo call
(`{tool: 'echo', arguments: {text: 'ase-fingerprint-hi'}}`) must
return 200 + JSON carrying the marker verbatim.

## What counts as proof (oracle)
Deterministic, no judge, no LLM, $0: the computed value `42` from
the arithmetic probe; the canary marker from the traversal; the
victim gone from the re-read user list; the executed action absent
from an answering audit log. Every finding carries structured
evidence (`request`, `response`, `impact_demo`,
`signalCorrelated: true`) and passes through the same differential
verifier as the other probes. Finding classes
(`agent_sandbox_exec`, `agent_sandbox_file_read`,
`agent_sandbox_approval_gate`, `agent_sandbox_audit_evasion`)
contain neither `xss` nor `bypass`, so they route to the default
confirmation protocol.

## Mock lab
`~/workspace/dm-v2/probes/agent-sandbox-lab.mjs` (node:http, no
deps): `bypassable` on port 18790 (exec runs a real shell via
`child_process.exec`; read_file joins naively against the public
dir so traversal escapes it; run_admin honors client-supplied
`approved: true`; audit logs only echo + read_file) and `control`
on port 18791 (exec refused; read_file confined to the public dir;
run_admin ignores the client flag and needs a server-issued token
from `POST /agent/approve`; audit logs everything). Re-proof
driver: `agent-sandbox-escape-reproof-driver.mjs` — full standard
battery against both mocks plus the Juice (31/0) and DVWA (21/0)
baselines.

## Limits
The real mechanism of the user's muse-code report ("sandbox bypass
of muse — arbitrary host code execution + credential exfiltration,
no approval, no logs") is being verified by a separate hunt lane
and is NOT wired here — this probe tests the generic family against
the mock lab. A follow-up lane wires the exact technique once
confirmed. L2 needs an observable user list and L3 needs an
answering audit endpoint; a real agent service without those
surfaces leaves L2/L3 uncalibrated (quiet, never a guess). The
probe never reads a real credential: the only "sensitive" file it
reads is the mock's canary file, whose content is a made-up marker.
Phase-count note: PRs #499/#505/#507/#510/#511 and #526 claim the
149th phase slot too — whichever merges later renumbers.
