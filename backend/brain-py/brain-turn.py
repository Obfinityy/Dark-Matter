#!/usr/bin/env python3
"""
brain-turn.py — ONE TURN of the one-loop brain, callable by the backend.

The backend (Node, backend/src/brain/oneLoopBrain.js) spawns this once per
hunt iteration:

    python3 brain-turn.py --memdir D --goal G --target-base T

Contract (Rule #40 — BACKEND-CALLABLE BRAIN):
- stdout's LAST line is exactly:  TURNSUMMARY: {json}
- the JSON is {"ok": true, ...} on success, {"ok": false, "error": ...}
  on any failure. Exit code 0 on ok, 1 on failure (fail-closed: the
  backend must never act on a half-turn).
- The loop's 3-file memory lives in D; EVERY load inside run_turn is
  from disk, so the backend keeps ZERO in-memory brain state between
  turns. Turn N+1 is valid iff turn N's summary said ok:true.
- Probes execute inside this process (sed-rebased copies, Rule #31);
  claims are filed local-only into D/claims.json (the backend claim
  bridge is a later rule — this seam proves the turn protocol).

Inputs beyond the CLI: none. The one-loop handles login itself
(_lab_login_opener, default creds, fail-closed to unauthenticated recon).
"""

import argparse
import importlib.util
import json
import os
import sys
import time

_HERE = os.path.dirname(os.path.abspath(__file__))
_APILOOP = os.path.join(_HERE, "brain-apiloop-v1.py")
_SUMMARY_PREFIX = "TURNSUMMARY: "


def _load_apiloop():
    spec = importlib.util.spec_from_file_location("brain_apiloop_v1", _APILOOP)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load brain-apiloop-v1.py from %s" % _APILOOP)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _clip(s, n=200):
    s = "" if s is None else str(s)
    return s if len(s) <= n else s[:n] + "..."


def one_turn(memdir, goal, target_base):
    """Run exactly one loop turn; return the backend-facing summary dict."""
    if not target_base or not str(target_base).strip():
        raise ValueError("empty --target-base (fail-closed: no invented target)")
    if not memdir or not str(memdir).strip():
        raise ValueError("empty --memdir (fail-closed)")
    api = _load_apiloop()
    ctx = {"target_base": str(target_base).strip(), "memdir": memdir}
    t0 = time.time()
    result = api.run_turn(memdir, goal, ctx)
    wall_s = round(time.time() - t0, 2)

    reply = result.get("reply") or {}
    action = reply.get("action") or {}
    turn = int(result.get("turn", 0))

    # verdict + liveness: read back the loop's own on-disk record after the
    # turn (the A-to-Z source of truth — never recompute it here).
    verdict = None
    process_active = False
    try:
        mp = api.mem_paths(memdir)
        proc_doc = api.load_json(mp["process"], {"process": None})
        proc = proc_doc.get("process")
        process_active = proc is not None
        if proc:
            for h in proc.get("history", []):
                if int(h.get("turn", -1)) == turn:
                    verdict = h.get("verdict")
                    break
    except Exception:
        verdict = None  # summary stays honest: unknown verdict, not a guess

    events = result.get("events") or []
    return {
        "ok": True,
        "turn": turn,
        "task": reply.get("task"),
        "goal": reply.get("goal"),
        "progress": _clip(reply.get("progress")),
        "why_this": _clip(reply.get("why_this"), 300),
        "action_type": action.get("type"),
        "verdict": verdict,
        "process_active": process_active,
        "completed": "process_completed" in events,
        "dead_end_turn": bool(reply.get("dead_end_step")),
        "events": events,
        "output_hash": result.get("output_hash"),
        "backend_reads": result.get("backend_reads", 0),
        "bounced": len((result.get("validation") or {}).get("bounced", [])),
        "wall_s": wall_s,
        "llm_calls": 0,
        "meta_spend_usd": 0,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--memdir", required=True, help="per-hunt loop memory dir")
    ap.add_argument("--goal", required=True, help="standing goal string")
    ap.add_argument("--target-base", required=True, help="explicit target base URL")
    args = ap.parse_args()
    try:
        summary = one_turn(args.memdir, args.goal, args.target_base)
        sys.stdout.write(_SUMMARY_PREFIX + json.dumps(summary) + "\n")
        sys.stdout.flush()
        sys.exit(0)
    except Exception as e:  # fail-closed: one JSON line, non-zero exit
        sys.stdout.write(_SUMMARY_PREFIX + json.dumps(
            {"ok": False, "error": "%r" % (e,)}) + "\n")
        sys.stdout.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
