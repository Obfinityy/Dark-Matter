#!/usr/bin/env python3
"""brain-explore-v1.py — PROCESS AS A BOOLEAN (owner refinement #2, 29 Oct ~19:57 IST).

The playbook's 11 modules are the KNOWN hunting ground. When decide_next_module
returns None the loop used to STOP. A real elite hunter doesn't stop — it gets
curious: "the sink reads 'ip' — does it care about the METHOD?", "the payload
persisted — does it reach OTHER sinks?", "which traversal VARIANT slips past
a naive filter?", "if SQLi works, is the AUTH layer injectable?"

This module is that curiosity, codified. decide_new_process() picks the next
UNEXPLORED beyond-playbook process — each carrying its own REASON (owner
refinement #1: ADD/REMOVE WITH REASON). When playbook AND explore are both
exhausted it returns None (never repeats).

Specs are the same 7-tuple shape as engine.MODULES entries:
  (module, probe_file, runner, marker, vuln_class, severity, title)
so engine.build_probe_json / build_claim_json / validators work unchanged.
Probe sources live in brain-probes/ (explore_*.py/sh), following the exact
probe contract: single self-contained command, marker via argv, fixed
VERDICT line LAST (engine.VERDICT_RE).
"""
import argparse
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))

_engine_spec = importlib.util.spec_from_file_location(
    "brain_engine_v2", os.path.join(HERE, "brain-engine-v2.py"))
engine = importlib.util.module_from_spec(_engine_spec)
_engine_spec.loader.exec_module(engine)

# (key, probe_file, runner, marker, vuln_class, severity, title, reason)
EXPLORE_CATALOG = [
    ("explore/authbypass/",
     "explore_authbypass.py", "python3", None, "auth_bypass", "HIGH",
     "Auth-bypass probe on login/brute (explore — beyond playbook)",
     "Playbook SQLi UNION proved /vulnerabilities/sqli/ is injectable; a real "
     "hunter asks next whether the AUTH layer itself is injectable. Try "
     "classic SQLi auth-bypass payloads on /login.php and /vulnerabilities/brute/."),
    ("explore/second-order/",
     "explore_secondorder.py", "python3", "2ORD7719-EXP2", "xss", "HIGH",
     "Second-order XSS via guestbook txtName (explore — beyond playbook)",
     "Playbook stored XSS used the mtxMessage field only; the payload persisted. "
     "A real hunter asks whether the same persistence reaches OTHER sinks — "
     "poison the txtName field and verify reflection."),
    ("explore/traversal-variants/",
     "explore_traversal.sh", "bash", "TRV7719-EXP2", "lfi", "HIGH",
     "LFI filter-evasion traversal variants (explore — beyond playbook)",
     "Basic ../ inclusion was confirmed; naive filters are everywhere. Test "
     "filter-evasion variants WAFs commonly miss: ....// nesting, absolute "
     "path, URL-encoded slashes."),
    ("explore/method-tamper/",
     "explore_methodtamper.py", "python3", "MTM7719-EXP2", "cmdi", "HIGH",
     "Command injection via POST method tamper (explore — beyond playbook)",
     "Command injection was proved via GET; the sink reads 'ip'. A real hunter "
     "asks whether the sink cares about the METHOD — POST the same injection "
     "to the same endpoint (method-based filter evasion)."),
]

EXPLORE_KEYS = {k for k, *_ in EXPLORE_CATALOG}


def spec_tuple(entry):
    """Strip the reason (lane-internal) -> engine 7-tuple."""
    return entry[:7]


def decide_new_process(tried, explore_tried=None, dead_ends=None):
    """
    Next unexplored explore process, WITH its reason. Returns
    (spec_7tuple, reason) or (None, None) when explore is exhausted.
    Respects the same dead-end + tried discipline as the playbook:
    a process already tried, or folded into dead_ends WITH REASON, is never
    picked again.
    """
    tried = set(tried or [])
    explore_tried = set(explore_tried or [])
    dead = set(dead_ends or [])
    for entry in EXPLORE_CATALOG:
        key = entry[0]
        if key in tried or key in explore_tried or key in dead:
            continue
        return spec_tuple(entry), entry[7]
    return None, None


def explore_exhausted(tried, explore_tried=None, dead_ends=None):
    spec, _ = decide_new_process(tried, explore_tried, dead_ends)
    return spec is None


def sha256_hex(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def now_ist():
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
            ).strftime("%Y-%m-%d %H:%M:%S IST")


def run_probe(command, timeout=300):
    """Execute one self-contained probe command; return dict with stdout."""
    t0 = time.time()
    try:
        p = subprocess.run(["bash", "-c", command], capture_output=True,
                           text=True, timeout=timeout)
        return {"rc": p.returncode, "stdout": p.stdout, "stderr": p.stderr[-2000:],
                "elapsed_s": round(time.time() - t0, 1), "timed_out": False}
    except subprocess.TimeoutExpired as e:
        out = (e.stdout or "") if isinstance(e.stdout, str) else ""
        return {"rc": -1, "stdout": out, "stderr": "TIMEOUT",
                "elapsed_s": round(time.time() - t0, 1), "timed_out": True}


# ---------------------------------------------------------------- CLI ----
def cmd_list(args):
    for entry in EXPLORE_CATALOG:
        print(f"{entry[0]}  probe={entry[1]} marker={entry[3]} class={entry[4]}")
        print(f"    REASON: {entry[7]}")


def cmd_dry_run(args):
    """All 4 explore turns must pass the engine's probe validators + the
    dual-key console/backend contract (same checks build_probe_json faces)."""
    ok = True
    total = len(engine.MODULES) + len(EXPLORE_CATALOG)
    for i, entry in enumerate(EXPLORE_CATALOG):
        spec = spec_tuple(entry)
        turn = len(engine.MODULES) + i + 1
        probe_json = engine.build_probe_json(turn, total, spec)
        err = engine.validate_probe_json(probe_json)  # list: empty == valid
        cmd = probe_json["action"]["command"]
        checks = {
            "validate_probe_json": not err,
            "dual-key type==shell": probe_json["action"]["type"] == "shell",
            "dual-key action==shell": probe_json["action"]["action"] == "shell",
            "heredoc-tag present": "PROBEEOF" in cmd,
            "marker travels": (entry[3] or "") in cmd or entry[3] is None,
        }
        bad = [k for k, v in checks.items() if not v]
        print(f"[dry-run] {entry[0]} turn={turn} "
              f"{'OK' if not bad else 'FAIL: ' + ','.join(bad)}"
              + (f" gate-errors={err}" if err else ""))
        ok = ok and not bad and not err
    # claim-lane check on a synthetic CONFIRMED explore claim
    spec = spec_tuple(EXPLORE_CATALOG[1])
    claim = engine.build_claim_json(
        spec, probe_command="synthetic",
        evidence_lines=["EVIDENCE: payload reflected in txtName sink"],
        counterevidence="control benign-name reflected, marker absent in control")
    cerr = engine.validate_claim_json(claim)  # list: empty == valid
    print(f"[dry-run] synthetic explore claim: "
          f"{'OK' if not cerr else 'FAIL: ' + '; '.join(cerr)}")
    ok = ok and not cerr
    sys.exit(0 if ok else 1)


def _start_mock(port):
    lab = os.path.join(HERE, "probe-lab")
    p = subprocess.Popen([sys.executable, os.path.join(lab, "mock-dvwa.py")],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import urllib.request
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/login.php",
                                   timeout=2).read()
            return p
        except Exception:
            time.sleep(0.25)
    p.kill()
    raise RuntimeError("mock did not start")


def cmd_execute(args):
    """Full proof: playbook pipeline THEN explore pipeline vs mock DVWA.
    Proves the loop no longer stops at 11 — new processes keep coming."""
    port = args.port
    mock = _start_mock(port)
    target = f"http://127.0.0.1:{port}"
    try:
        # Rebase probe sources to the lab target IN MEMORY ONLY.
        orig_loader = engine.load_probe_source

        def rebased_loader(filename):
            return orig_loader(filename).replace("http://172.17.0.1:3100", target)
        engine.load_probe_source = rebased_loader

        tried, explore_tried, dead = [], [], set()
        total = len(engine.MODULES) + len(EXPLORE_CATALOG)
        turn = confirmed = failed = errors = 0
        findings = []

        def one_turn(spec, lane):
            nonlocal turn, confirmed, failed, errors
            turn += 1
            module = spec[0]
            probe_json = engine.build_probe_json(turn, total, spec)
            err = engine.validate_probe_json(probe_json)
            if err:
                errors += 1
                print(f"[turn {turn:02d}] {module} ENGINE-ERROR {err}")
                return
            exec_info = run_probe(probe_json["action"]["command"],
                                  args.probe_timeout)
            verdict = engine.parse_verdict(exec_info["stdout"]) or "NO_VERDICT"
            if verdict == "CONFIRMED":
                confirmed += 1
                claim = engine.build_claim_json(
                    spec, probe_command=probe_json["action"]["command"],
                    evidence_lines=[l for l in exec_info["stdout"].splitlines()
                                    if l.strip()][-10:],
                    counterevidence=("probe's own control logic; exact "
                                      "VERDICT: CONFIRMED last line"))
                cerr = engine.validate_claim_json(claim)
                if cerr:
                    errors += 1
                    print(f"[turn {turn:02d}] {module} CLAIM-INVALID {cerr}")
                else:
                    findings.append({"module": module, "lane": lane,
                                     "title": claim["action"]["title"],
                                     "claim_hash": sha256_hex(
                                         json.dumps(claim, sort_keys=True))})
            elif verdict == "FAILED":
                failed += 1
                if module.startswith("explore/"):
                    dead.add(module)  # dead end WITH REASON, lane rule
            print(f"[turn {turn:02d}] {module} lane={lane} verdict={verdict} "
                  f"elapsed={exec_info['elapsed_s']}s", flush=True)
            tried.append(module)

        # Phase 1: playbook (decide_next_module until None)
        while True:
            spec = engine.decide_next_module(tried, None, None)
            if spec is None:
                break
            one_turn(spec, "playbook")

        # Phase 2: THE NEW BEHAVIOR — explore keeps going
        while True:
            spec, reason = decide_new_process(tried, explore_tried, dead)
            if spec is None:
                break
            print(f"[explore] NEW PROCESS {spec[0]}", flush=True)
            print(f"          REASON: {reason}", flush=True)
            explore_tried.append(spec[0])
            one_turn(spec, "explore")

        exhausted = explore_exhausted(tried, explore_tried, dead)
        print(f"\n[explore-execute done] turns={turn} confirmed={confirmed} "
              f"failed={failed} findings={len(findings)} errors={errors} "
              f"exhausted={exhausted}")
        for f in findings:
            if f["lane"] == "explore":
                print(f"  EXPLORE FINDING: {f['title']} "
                      f"(claim {f['claim_hash'][:12]}…, local-only)")
        # resume discipline: a second pass must pick NOTHING
        spec2, _ = decide_new_process(tried, explore_tried, dead)
        print(f"[resume check] decide_new_process after full run -> "
              f"{spec2[0] if spec2 else None} (expect None)")
        ok = errors == 0 and exhausted and spec2 is None and turn == total
        print(f"RESULT: {'PASS' if ok else 'FAIL'}")
        sys.exit(0 if ok else 1)
    finally:
        mock.kill()


def main():
    ap = argparse.ArgumentParser(description="brain-explore-v1: new processes "
                                 "when the playbook is exhausted")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list", help="show the explore catalog with reasons")
    sub.add_parser("dry-run", help="validate all explore turns vs engine gates")
    ex = sub.add_parser("execute", help="playbook-then-explore vs mock DVWA")
    ex.add_argument("--port", type=int, default=8310)
    ex.add_argument("--probe-timeout", type=int, default=300)
    args = ap.parse_args()
    {"list": cmd_list, "dry-run": cmd_dry_run,
     "execute": cmd_execute}[args.cmd](args)


if __name__ == "__main__":
    main()
