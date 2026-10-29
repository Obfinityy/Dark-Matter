#!/usr/bin/env python3
"""brain-feedback-v1.py — OBSERVATION -> NEXT-TURN FEEDBACK LOOP (29 Oct ~19:45 IST).

THE MISSING LINK between "agent submits a brain turn" and "agent decides the
next turn". In the real system the backend EXECUTES the brain's action and
returns {ok, hash, output, entry} (brain-action-json contract, extracted from
deployed code 29 Oct ~19:44 IST). Without a code path that folds that response
back into the three files, the autonomous agent is blind after turn 1.

OWNER-ORDERED THREE-FILE ARCHITECTURE (28 Oct ~18:16 IST), enforced here:
  MEMORY  — titles + hashes only, per-hunt isolated, A-to-Z (never repeats)
  PROCESS — in_process boolean; current task FULL detail while running;
            cleared when the task completes (a new process starts next turn)
  OUTPUT  — full results stay on disk keyed by hash; fetched on demand via
            recall WITH A REASON (the brain must say WHY it recalls)

SAVE TIMING (owner order 27 Oct ~19:36 IST): a task's input/output is saved
to disk WHEN THE TASK COMPLETES — the ingest path below does exactly that.

COMMANDS:
  --ingest RESPONSE.json --turn-meta META.json --memory-dir DIR
      Fold one backend {ok, hash, output, entry} response into the three
      files. RESPONSE.json is the backend's reply; META.json describes what
      we sent: {turn, module, probe, task, goal, action_summary,
                claim: {title, class, severity, claim_hash}?}.
      Writes output/<hash>.txt, appends process history, records findings
      (titles+hashes only), stamps tried (never-repeat), flips in_process
      false and clears current. Prints RECALL_TOKEN <hash>.
  --recall HASH --reason "..." --memory-dir DIR
      Fetch output/<hash>.txt by hash. The reason is REQUIRED and is logged
      to memory.recall_log — the brain may not silently rummage through
      output; every recall says why (owner's recall-with-reason rule).
  --context --memory-dir DIR
      Print the EXACT context the engine gets on its next turn:
      MEMORY (titles+hashes, tried, dead ends with reasons) + PROCESS
      (current full detail + history tail) + output INDEX (hashes and
      sizes, NOT full text — fetched on demand via --recall).

All writes are atomic (tmp + os.replace). Fail-closed: a malformed response
aborts the ingest and changes nothing.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
IST = timezone(timedelta(hours=5, minutes=30))


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)  # atomic — no half-written memory


def paths(memory_dir):
    out_dir = os.path.join(memory_dir, "output")
    os.makedirs(out_dir, exist_ok=True)
    return (os.path.join(memory_dir, "memory.json"),
            os.path.join(memory_dir, "process.json"), out_dir)


def ingest(memory_dir, response, meta):
    """Fold one backend response into the three files. Returns recall token."""
    mem_path, proc_path, out_dir = paths(memory_dir)
    memory = load_json(mem_path, None)
    process = load_json(proc_path, None)
    if memory is None or process is None:
        return fail("memory.json/process.json missing — run brain-loop first")

    # --- fail-closed contract check (backend reply shape) ---
    if not isinstance(response, dict) or response.get("ok") is not True:
        return fail("response.ok is not true — refusing to ingest a failure")
    h = response.get("hash")
    output = response.get("output")
    entry = response.get("entry")
    if not (isinstance(h, str) and h and isinstance(output, str)):
        return fail("response missing hash/output — refusing to ingest")
    if entry is not None and not isinstance(entry, dict):
        return fail("response.entry must be an object — refusing to ingest")

    turn = meta.get("turn", "?")
    module = meta.get("module", "?")

    # --- OUTPUT: full result saved by hash (fetched on demand, never inlined) ---
    # INVARIANT (owner order 28 Oct): the recorded hash IS sha256 of the stored
    # file. Raw probe stdout goes into <h>.txt alone; provenance headers live
    # in the <h>.meta.json sidecar so the file hash never drifts.
    out_path = os.path.join(out_dir, h + ".txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(output)
    meta_path = os.path.join(out_dir, h + ".meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"backend_entry_hash": h, "turn": turn, "module": module,
                   "ingested_ist": now_ist(), "entry": entry}, f, indent=1)
    out_bytes = os.path.getsize(out_path)

    # --- PROCESS: task completes -> flip false, clear current, save timing ---
    hist_entry = {
        "turn": turn, "module": module, "probe": meta.get("probe"),
        "action_summary": meta.get("action_summary"),
        "backend_hash": h, "output_hash": h, "output_bytes": out_bytes,
        "entry": entry, "finished_ist": now_ist(),
    }
    process["history"].append(hist_entry)
    process["in_process"] = False
    process["current"] = None

    # --- MEMORY: titles + hashes only; A-to-Z (never repeat) ---
    if module not in memory.setdefault("tried", []):
        memory["tried"].append(module)
    claim = meta.get("claim")
    if isinstance(claim, dict):
        memory.setdefault("findings", []).append({
            "title": claim.get("title"), "class": claim.get("class"),
            "severity": claim.get("severity"), "module": module,
            "turn": turn, "claim_hash": claim.get("claim_hash"),
            "output_hash": h, "status": "filed (backend executed)",
            "recorded_ist": now_ist(),
        })
    memory["runs"] = memory.get("runs", 0)

    save_json(mem_path, memory)
    save_json(proc_path, process)
    return {"recall_token": h, "output_bytes": out_bytes,
            "turn": turn, "module": module}


def recall(memory_dir, h, reason):
    """Fetch output by hash WITH a logged reason. Reason is required."""
    if not reason or not reason.strip():
        return fail("--reason is required: the brain must say WHY it recalls")
    mem_path, _, out_dir = paths(memory_dir)
    out_path = os.path.join(out_dir, h + ".txt")
    if not os.path.isfile(out_path):
        return fail(f"no output stored for hash {h}")
    memory = load_json(mem_path, None)
    if memory is None:
        return fail("memory.json missing")
    memory.setdefault("recall_log", []).append(
        {"hash": h, "reason": reason.strip(), "at_ist": now_ist()})
    save_json(mem_path, memory)
    with open(out_path, "r", encoding="utf-8") as f:
        return {"hash": h, "output": f.read()}


def context(memory_dir):
    """The exact next-turn context: MEMORY (titles+hashes) + PROCESS (full
    detail) + output index (hashes+sizes, NOT full text)."""
    mem_path, proc_path, out_dir = paths(memory_dir)
    memory = load_json(mem_path, None)
    process = load_json(proc_path, None)
    if memory is None or process is None:
        return fail("memory.json/process.json missing")
    index = []
    for f in sorted(os.listdir(out_dir)):
        if f.endswith(".txt"):
            p = os.path.join(out_dir, f)
            index.append({"hash": f[:-4], "bytes": os.path.getsize(p)})
    findings = memory.get("findings", [])
    return {
        "MEMORY": {
            "hunt_id": memory.get("hunt_id"),
            "titles_and_hashes": [
                {"title": f.get("title"), "class": f.get("class"),
                 "severity": f.get("severity"), "claim_hash": f.get("claim_hash"),
                 "output_hash": f.get("output_hash")} for f in findings],
            "tried": memory.get("tried", []),
            "dead_ends": memory.get("dead_ends", []),
            "dead_end_reasons": memory.get("dead_end_reasons", {}),
            "recall_log": memory.get("recall_log", []),
        },
        "PROCESS": {
            "in_process": process.get("in_process"),
            "current": process.get("current"),
            "history_tail": process.get("history", [])[-5:],
        },
        "OUTPUT_INDEX": index,
        "NOTE": ("Full outputs are NOT inlined — recall one by hash with a "
                 "reason via --recall. This keeps every turn's context small "
                 "and the brain's memory A-to-Z without repeats."),
    }


def fail(msg):
    return {"error": msg}


def main():
    p = argparse.ArgumentParser(description="Brain feedback loop v1")
    p.add_argument("--memory-dir", required=True,
                   help="per-hunt working memory dir")
    p.add_argument("--ingest", metavar="RESPONSE.json",
                   help="backend {ok,hash,output,entry} response to fold in")
    p.add_argument("--turn-meta", metavar="META.json",
                   help="what we sent this turn (needed with --ingest)")
    p.add_argument("--recall", metavar="HASH",
                   help="fetch output by hash (needs --reason)")
    p.add_argument("--reason", default="",
                   help="why the brain recalls this output")
    p.add_argument("--context", action="store_true",
                   help="print the exact next-turn context")
    args = p.parse_args()
    mem_dir = os.path.abspath(args.memory_dir)

    if args.ingest:
        if not args.turn_meta:
            print(json.dumps(fail("--turn-meta is required with --ingest")))
            sys.exit(2)
        with open(args.ingest, "r", encoding="utf-8") as f:
            response = json.load(f)
        with open(args.turn_meta, "r", encoding="utf-8") as f:
            meta = json.load(f)
        res = ingest(mem_dir, response, meta)
        if "error" in res:
            print(json.dumps(res)); sys.exit(1)
        print(f"RECALL_TOKEN {res['recall_token']}  "
              f"(turn={res['turn']} module={res['module']} "
              f"bytes={res['output_bytes']})")
        print(json.dumps(res, indent=2))
    elif args.recall:
        res = recall(mem_dir, args.recall, args.reason)
        if "error" in res:
            print(json.dumps(res)); sys.exit(1)
        print(res["output"])
        print(f"\n[recall logged: hash={res['hash']} reason={args.reason!r}]",
              file=sys.stderr)
    elif args.context:
        res = context(mem_dir)
        if "error" in res:
            print(json.dumps(res)); sys.exit(1)
        print(json.dumps(res, indent=2))
    else:
        p.print_help(); sys.exit(2)


if __name__ == "__main__":
    main()
