# brain-py — the deterministic one-loop brain (Rule #40/#41)

Drop-in brain provider for the Dark Matter backend. Pure Python stdlib —
no LLM calls, no Meta API, $0 per turn. Lab-proven 11/11 on live DVWA.

## What lives here

- `brain-turn.py` — ONE turn per process call. The backend spawns it once
  per hunt iteration:
  `python3 brain-turn.py --memdir D --goal G --target-base T`
  stdout's LAST line is exactly `TURNSUMMARY: {json}`; exit 0/1.
  Fail-closed: the backend must never advance a hunt on ok:false.
- `brain-apiloop-v1.py` — the one loop (recon → decide → probe →
  VERDICT → claim → feedback → explore → exhaust). Per-hunt 3-file memory
  (memory.json / process.json / outputs-by-hash) lives in D; every load is
  from disk, so the backend keeps ZERO in-memory brain state between turns.
- `brain-probes/` — the 11 live-proven parent probes (+ 5 WAF-escalation
  variants + fuzz corpus). Executed as sed-rebased copies, target taken
  only from `--target-base` (fail-closed on empty).
- `brain-claims-v1.py`, `brain-escalate-v1.py`, … — the lane modules the
  loop lazy-loads (claim state machine, escalation ladders, scope gate,
  traffic proxy, fuzzer, chain composer, report dossier).

## Box setup (one time per backend host)

The bundle is stdlib-only except one dependency: **Pillow**, used for the
synthetic screenshot fallback when no real capture tool exists on a
headless box (the brain "sees" a frame every turn — Rule #28 spec).
Without it the loop fail-closes on turn 1
(`no real capture tool AND no PIL`).

    sudo apt-get install -y python3-pil

This is installed automatically by `.github/workflows/deploy-backend.yml`
on every backend deploy; the command above is the manual equivalent.

## How the backend uses it

`../src/brain/oneLoopBrain.js` (ESM, no deps) exports `brainTurn()` and
`isOneLoopEnabled()` (env gate `BRAIN_PROVIDER=oneloop`). Wiring into
`humanLoop.js` is Rule #42 — env-gated, default off. The deployed script
path the backend passes is:

    <repo>/backend/brain-py/brain-turn.py

## Standing invariants

- Claims are LOCAL-ONLY here (`D/claims.json`, evidence_hash per claim).
  The backend claim bridge is a later rule — do not invent one.
- Probes only touch the explicit `--target-base` (scope gate, Rule #27;
  wire proxy, Rule #28). Nothing here phones home.
- Provenance: this bundle mirrors the lab source of truth in the goal
  workspace (`hidden_files/brain-*.py`). Regenerate from there; never
  hand-edit both copies.

## Live proof

Rule #41: deployed to EC2 via the normal git workflow; `brainTurn()`
drove live turns against the real DVWA (172.17.0.1:3100) from the EC2
box. See `hidden_files/probe-lab/results-2026-10-30-brainbundle.md`.
