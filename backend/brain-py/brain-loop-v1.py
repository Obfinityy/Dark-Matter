#!/usr/bin/env python3
"""
Brain Loop v1 — autonomous loop runner for Brain Engine v2.
Built 29 Oct 2026 (~19:10 IST). NO Meta API. NO local LLM. NO backend writes.

This is the "khud se hunt" core: decide -> real probe action -> execute ->
exact VERDICT line -> claim JSON -> per-hunt memory writes, fully deterministic.

Three-file working memory (owner's 28-Oct architecture), stored per hunt in
--memory-dir:
  memory.json  — titles + hashes + tried modules + dead ends only (A-to-Z,
                 never repeats: decide_next_module skips tried + DEAD_ENDS +
                 verifier-feedback dead ends). Verifier feedback (--verdict-feedback)
                 records rejected claims as dead ends WITH REASON so the brain
                 never re-files them — hard enforcement of the owner rule
                 "rejected claims are dead ends".
  process.json — {in_process: bool, current: full task detail, history: [...]}
                 a finished process flips false and the NEXT turn starts a NEW
                 process (PROCESS AS A BOOLEAN, owner order 28 Oct 18:25)
  output/<sha256>.txt — full probe stdout saved by hash, fetched on demand
                 (OUTPUT stays on disk, fetched by hash/id — owner order)

Hard rules enforced here (not just documented):
- A claim is built ONLY on an exact `VERDICT: CONFIRMED` last line
  (playbook rule #3, enforced by engine VERDICT_RE). No line -> no claim.
- Claims are recorded LOCALLY ONLY (status: local-only). The API gate stays
  closed: there is intentionally NO submit-to-backend path in this build.
  Submission to the Brain Console / verifier needs the owner's release.
- Probes travel with the command (quoted heredoc, marker as argv) — no file
  persistence needed, matching how hunt containers lose /opt/hunt on respawn.
- The loop NEVER touches the live hunt backend or Meta. --execute runs the
  probe commands against --target-base ONLY (use the mock DVWA for testing).

Usage:
  # planning dry-run (no execution): shows the autonomous turn plan
  python3 brain-loop-v1.py --memory-dir ./lab-memory

  # full autonomous run against the mock DVWA (probes rebased to the mock)
  python3 brain-loop-v1.py --memory-dir ./lab-memory --execute \\
      --target-base http://127.0.0.1:8310 \\
      --rebase-from http://172.17.0.1:3100
"""

import argparse
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
IST = timezone(timedelta(hours=5, minutes=30))


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


def load_engine():
    """Import brain-engine-v2.py (hyphenated filename) as a module."""
    path = os.path.join(HERE, "brain-engine-v2.py")
    spec = importlib.util.spec_from_file_location("brain_engine_v2", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_explore():
    """Import brain-explore-v1.py (hyphenated filename) as a module."""
    path = os.path.join(HERE, "brain-explore-v1.py")
    spec = importlib.util.spec_from_file_location("brain_explore_v1", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def sha256_hex(text):
    return hashlib.sha256(text.encode("utf-8", "replace")).hexdigest()


def load_json(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)  # atomic write — no half-written memory


def fresh_memory(hunt_id, target_base, engine):
    return {
        "hunt_id": hunt_id,
        "target_base": target_base,
        "tried": [],
        "explore_tried": [],   # beyond-playbook processes tried (Rule #15)
        "findings": [],
        "dead_ends": sorted(engine.DEAD_ENDS),
        "dead_end_reasons": {},       # module -> {reason, claim_hash, at_ist, source}
        "verdict_feedback_applied": [],  # entry ids already applied (idempotency)
        "started_ist": now_ist(),
        "runs": 0,
    }


def fresh_process():
    return {"in_process": False, "current": None, "history": []}


def _to_text(value):
    """Normalize subprocess output to str.

    subprocess.TimeoutExpired.stdout/stderr are RAW BYTES even when the
    run used text=True (CPython decodes only on clean completion; the
    partial output on timeout is never decoded). Found 29 Oct on the
    LIVE target: a timed-out probe's bytes crashed the hash step and
    killed the whole loop. The mock never times out, so the lab never
    exercised this path.
    """
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


# Rule #26 (29 Oct ~21:40 IST): PER-MODULE PROBE TIMEOUTS — blind-SQLi
# timing oracle gets 300s instead of the default (see brain-drive-v1.py).
MODULE_TIMEOUTS = {
    "vulnerabilities/sqli_blind/": 300,
}


def execute_command(command, timeout):
    """Run one engine shell action. Returns dict with stdout/stderr/rc/elapsed."""
    start = datetime.now(IST)
    try:
        proc = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=timeout, executable="/bin/bash",
        )
        rc, out, err, timed_out = proc.returncode, proc.stdout, proc.stderr, False
    except subprocess.TimeoutExpired as e:
        rc, out, err, timed_out = -1, _to_text(e.stdout), _to_text(e.stderr), True
    elapsed = (datetime.now(IST) - start).total_seconds()
    return {"rc": rc, "stdout": out, "stderr": err[-2000:],
            "timed_out": timed_out, "elapsed_s": round(elapsed, 1)}


def apply_verdict_feedback(memory, entries):
    """
    Fold verifier outcomes into per-hunt memory. entries = list of dicts:
      {"id": str, "module": str, "verdict": "rejected"|"accepted",
       "claim_hash": str?, "reason": str?, "at_ist": str?}

    - "rejected": module joins memory["dead_ends"] WITH REASON
      (memory["dead_end_reasons"][module]). decide_next_module skips it
      forever — the brain never re-files a rejected claim (owner rule).
    - "accepted": matching finding (by claim_hash, else module) is marked
      "verifier-accepted".
    Idempotent: re-applying an entry whose id is already in
    memory["verdict_feedback_applied"] changes nothing.
    Returns the number of newly applied entries.
    """
    memory.setdefault("dead_ends", [])
    memory.setdefault("dead_end_reasons", {})
    memory.setdefault("verdict_feedback_applied", [])
    applied = memory["verdict_feedback_applied"]
    applied_n = 0
    for e in entries or []:
        eid = e.get("id") or sha256_hex(json.dumps(e, sort_keys=True))[:16]
        if eid in applied:
            continue  # already folded in — idempotent
        module = e.get("module", "")
        verdict = (e.get("verdict") or "").lower()
        if verdict == "rejected" and module:
            if module not in memory["dead_ends"]:
                memory["dead_ends"].append(module)
                memory["dead_ends"] = sorted(memory["dead_ends"])
            memory["dead_end_reasons"][module] = {
                "reason": e.get("reason", "verifier rejected the claim"),
                "claim_hash": e.get("claim_hash"),
                "at_ist": e.get("at_ist", now_ist()),
                "source": "verifier",
            }
            # A rejected module must never be re-tried even in a fresh
            # process: also stamp it tried if the loop somehow hasn't.
            applied.append(eid)
            applied_n += 1
        elif verdict == "accepted":
            ch = e.get("claim_hash")
            matched = False
            for f in memory.get("findings", []):
                if (ch and f.get("claim_hash") == ch) or \
                   (not ch and f.get("module") == module):
                    f["status"] = "verifier-accepted"
                    matched = True
            if matched:
                applied.append(eid)
                applied_n += 1
            # unmatched accepted verdicts are NOT recorded — a verdict for
            # a claim we never made is evidence of nothing.
        # unknown verdict values are ignored (fail-closed)
    return applied_n


def main():
    p = argparse.ArgumentParser(description="Brain Loop v1 — autonomous loop runner")
    p.add_argument("--memory-dir", required=True,
                   help="per-hunt working memory dir (memory.json/process.json/output/)")
    p.add_argument("--hunt-id", default="local-lab",
                   help="hunt id recorded in memory.json")
    p.add_argument("--execute", action="store_true",
                   help="actually run probe commands (default: planning dry-run)")
    p.add_argument("--target-base", default="",
                   help="base URL probes execute against (required with --execute)")
    p.add_argument("--rebase-from", default="http://172.17.0.1:3100",
                   help="URL baked into probe sources to replace")
    p.add_argument("--max-turns", type=int, default=15,
                   help="playbook (11) + explore (4) processes")
    p.add_argument("--probe-timeout", type=int, default=180,
                   help="seconds per probe execution")
    p.add_argument("--verdict-feedback", default="",
                   help="JSON file with verifier outcomes "
                        "(list of {id, module, verdict: rejected|accepted, "
                        "claim_hash, reason, at_ist}); rejected modules become "
                        "dead ends with reason, never re-filed")
    p.add_argument("--recon", default="",
                   help="brain-recon-v1.py output JSON: its modules_mapped "
                        "list seeds the turn order (recon-mapped modules "
                        "first, rest in static order). Omit for static order.")
    args = p.parse_args()

    engine = load_engine()
    explore = load_explore()
    mem_dir = os.path.abspath(args.memory_dir)
    out_dir = os.path.join(mem_dir, "output")
    os.makedirs(out_dir, exist_ok=True)

    mem_path = os.path.join(mem_dir, "memory.json")
    proc_path = os.path.join(mem_dir, "process.json")
    memory = load_json(mem_path, None)
    if memory is None:
        memory = fresh_memory(args.hunt_id,
                              args.target_base if args.execute else "(dry-run)",
                              engine)
    process = load_json(proc_path, None)
    if process is None:
        process = fresh_process()
    memory["runs"] = memory.get("runs", 0) + 1
    memory["last_run_ist"] = now_ist()

    # --- verifier feedback: fold rejections/acceptances into memory BEFORE
    # any decision is made, so a rejected module is already a dead end when
    # decide_next_module runs (never re-filed, owner rule) ---
    feedback_applied = 0
    if args.verdict_feedback:
        with open(args.verdict_feedback, "r", encoding="utf-8") as f:
            feedback_entries = json.load(f)
        feedback_applied = apply_verdict_feedback(memory, feedback_entries)
        print(f"[feedback] applied {feedback_applied} new verifier "
              f"outcome(s); dead_ends={len(memory.get('dead_ends', []))}",
              flush=True)
    save_json(mem_path, memory)

    # --- recon seeding: attack-surface recon becomes turn 0 of the hunt.
    # A-to-Z memory records "I did recon first" so the brain never repeats
    # it; the engine orders recon-mapped modules first, then the rest in
    # static order (full coverage even when recon misses a module). ---
    priority_order = []
    if args.recon:
        with open(args.recon, "r", encoding="utf-8") as f:
            recon = json.load(f)
        mapped = recon.get("modules_mapped") or []
        for key in mapped:
            path = engine.RECON_KEYS.get(key)
            if path and path not in priority_order:
                priority_order.append(path)
        memory["recon"] = {
            "target": recon.get("target"),
            "started_ist": recon.get("started_ist"),
            "pages_crawled": recon.get("pages_crawled"),
            "modules_mapped": mapped,
            "verdict": recon.get("VERDICT"),
            "seeded_turn_order": bool(priority_order),
        }
        save_json(mem_path, memory)
        print(f"[recon] seeded turn order from {args.recon}: "
              f"{len(priority_order)} mapped module(s) first",
              flush=True)

    if args.execute and not args.target_base:
        print("--execute requires --target-base", file=sys.stderr)
        sys.exit(2)

    # Rebase probe sources to the execution target IN MEMORY ONLY —
    # originals in brain-probes/ stay untouched (verifier re-runs use them).
    orig_loader = engine.load_probe_source

    def rebased_loader(filename):
        src = orig_loader(filename)
        if args.execute and args.rebase_from and args.target_base:
            src = src.replace(args.rebase_from, args.target_base)
        return src

    engine.load_probe_source = rebased_loader

    total = len(engine.MODULES) + len(explore.EXPLORE_CATALOG)
    turn = 0
    confirmed = failed = no_verdict = 0
    engine_errors = []

    while turn < args.max_turns:
        spec = engine.decide_next_module(memory["tried"],
                                         memory.get("dead_ends"),
                                         priority_order)
        if spec is None:
            # PLAYBOOK EXHAUSTED -> PROCESS AS A BOOLEAN (Rule #15, owner
            # order 29 Oct ~19:57 IST): the brain thinks of a NEW process
            # instead of stopping. brain-explore-v1.py picks the next
            # unexplored beyond-playbook process WITH REASON; it returns
            # None only when explore is exhausted too (never repeats).
            spec, _reason = explore.decide_new_process(
                memory["tried"], memory.get("explore_tried", []),
                memory.get("dead_ends"))
            if spec is not None:
                memory.setdefault("explore_tried", []).append(spec[0])
        if spec is None:
            break  # fully exhausted — playbook AND explore, never repeats
        turn += 1
        module, probe_file, runner, marker = spec[0], spec[1], spec[2], spec[3]

        probe_json = engine.build_probe_json(turn, total, spec)
        perr = engine.validate_probe_json(probe_json)
        if perr:
            engine_errors.append({"turn": turn, "module": module,
                                  "error": f"probe JSON invalid: {perr}"})
            memory["tried"].append(module)
            save_json(mem_path, memory)
            continue

        # --- process starts (in_process=true, full detail, dynamic) ---
        process["in_process"] = True
        process["current"] = {
            "turn": turn, "module": module, "probe": probe_file,
            "task": probe_json["task"], "goal": probe_json["goal"],
            "progress": probe_json["progress"], "started_ist": now_ist(),
        }
        save_json(proc_path, process)

        verdict, output_hash, exec_info = "SKIPPED", None, None
        if args.execute:
            command = probe_json["action"]["command"]
            _mt = MODULE_TIMEOUTS.get(module, args.probe_timeout)
            exec_info = execute_command(command, _mt)
            stdout = exec_info["stdout"]
            output_hash = sha256_hex(stdout)
            # INVARIANT: recorded hash IS sha256 of the stored file — raw stdout
            # only; provenance headers go in the <hash>.meta.json sidecar.
            with open(os.path.join(out_dir, output_hash + ".txt"),
                      "w", encoding="utf-8") as f:
                f.write(stdout)
            with open(os.path.join(out_dir, output_hash + ".meta.json"),
                      "w", encoding="utf-8") as f:
                json.dump({"module": module, "turn": turn,
                           "executed_ist": now_ist(), "rc": exec_info['rc'],
                           "timed_out": exec_info['timed_out'],
                           "elapsed_s": exec_info['elapsed_s']}, f, indent=1)
            verdict = engine.parse_verdict(stdout) or "NO_VERDICT"

        hist_entry = {"turn": turn, "module": module, "probe": probe_file,
                      "verdict": verdict, "output_hash": output_hash,
                      "elapsed_s": (exec_info or {}).get("elapsed_s"),
                      "timed_out": (exec_info or {}).get("timed_out", False),
                      "finished_ist": now_ist()}

        if verdict == "CONFIRMED":
            confirmed += 1
            lines = [l for l in (exec_info["stdout"] or "").splitlines()
                     if l.strip() and not l.startswith("VERDICT")]
            evidence_lines = lines[-15:]
            claim = engine.build_claim_json(
                spec, probe_command=probe_json["action"]["command"],
                evidence_lines=evidence_lines,
                counterevidence=("Probe's own control logic: injection marker/uid "
                                  "present in the exploit request and absent in the "
                                  "control request (see probe stdout); exact "
                                  "VERDICT: CONFIRMED last line; command is the "
                                  "reproducible proof."),
            )
            cerr = engine.validate_claim_json(claim)
            if cerr:
                engine_errors.append({"turn": turn, "module": module,
                                      "error": f"claim JSON invalid: {cerr}"})
                hist_entry["claim"] = "BUILD_FAILED"
            else:
                claim_hash = sha256_hex(json.dumps(claim, sort_keys=True))
                hist_entry["claim"] = "RECORDED_LOCAL_ONLY"
                hist_entry["claim_hash"] = claim_hash
                memory["findings"].append({
                    "title": claim["action"]["title"],
                    "class": claim["action"]["class"],
                    "severity": claim["action"]["severity"],
                    "module": module, "turn": turn, "marker": marker,
                    "claim_hash": claim_hash, "output_hash": output_hash,
                    "evidence_excerpt": "\n".join(evidence_lines[-6:]),
                    "status": "local-only (API gate closed — NOT filed to verifier)",
                    "recorded_ist": now_ist(),
                })
        elif verdict == "FAILED":
            failed += 1
            if module.startswith("explore/"):
                # EXPLORE LANE RULE: a failed beyond-playbook process becomes
                # a dead end WITH REASON (same discipline as verifier
                # rejections) — the brain never re-tries it, with the reason
                # recorded per the owner's ADD/REMOVE WITH REASON order.
                if module not in memory.get("dead_ends", []):
                    memory.setdefault("dead_ends", []).append(module)
                    memory["dead_ends"] = sorted(memory["dead_ends"])
                memory.setdefault("dead_end_reasons", {})[module] = {
                    "reason": ("explore probe VERDICT: FAILED — the process's "
                               "hypothesis did not hold on this target"),
                    "at_ist": now_ist(),
                    "source": "explore",
                }
        else:
            no_verdict += 1  # includes SKIPPED (dry-run) and NO_VERDICT

        memory["tried"].append(module)
        process["history"].append(hist_entry)
        # --- process finishes: flip false, clear current (new process next turn) ---
        process["in_process"] = False
        process["current"] = None
        save_json(mem_path, memory)   # SAVE TIMING: saved when the task completes
        save_json(proc_path, process)

        print(f"[turn {turn:02d}] {module} verdict={verdict} "
              f"elapsed={(exec_info or {}).get('elapsed_s', '-')}s "
              f"claim={hist_entry.get('claim', '-')}", flush=True)

    playbook_done = engine.decide_next_module(memory["tried"],
                                              memory.get("dead_ends"),
                                              priority_order) is None
    explore_spec, _ = explore.decide_new_process(
        memory["tried"], memory.get("explore_tried", []),
        memory.get("dead_ends"))
    exhausted = playbook_done and explore_spec is None
    memory["exhausted"] = exhausted
    memory["summary"] = {"turns": turn, "confirmed": confirmed,
                         "failed": failed, "no_verdict": no_verdict,
                         "findings": len(memory["findings"]),
                         "exhausted": exhausted,
                         "engine_errors": len(engine_errors)}
    save_json(mem_path, memory)

    print(f"\n[loop done] turns={turn} confirmed={confirmed} failed={failed} "
          f"no_verdict={no_verdict} exhausted={exhausted} "
          f"findings={len(memory['findings'])} engine_errors={len(engine_errors)}")
    if engine_errors:
        print(json.dumps(engine_errors, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()
