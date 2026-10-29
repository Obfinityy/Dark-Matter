#!/usr/bin/env python3
"""
brain-benchmark-v1.py — Rule #23: PROVE THE LEVEL.

Runs the one-command autonomous brain (brain-agent-v1.py: auth -> recon ->
drive -> fuzz) against a fresh mock-DVWA target, measures the SAME numbers
the 27-Oct owner order demands for the benchmark vs the live hunt's war
record (iterations, verified findings, payloads sent, dedup blocks,
time/cost per cycle), and emits a before/after comparison.

No LLM, no Meta/API, no live hunt touch. The mock is a localhost stand-in
for the training ground (DVWA-faithful vuln logic), so $0 and minutes
replace $10 and 26 hours. The claim is scope-honest: this proves the level
on the SAME bug classes the live hunt verified, not on an unknown target.

Usage:
    python3 brain-benchmark-v1.py [--mem-root DIR] [--port 8310] [--waf]
"""
import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))

# The live war record, h_830317bdc184 @ 29 Oct ~21:05 IST. Constants are
# quoted with their source so the comparison is auditable, not invented.
WAR_RECORD = {
    "hunt_id": "h_830317bdc184",
    "target": "DVWA (EC2, 172.17.0.1:3100)",
    "iterations": 248,                 # meta.json, live checkpoint
    "genuine_verified": 11,            # 4 CRITICAL + 5 HIGH + 2 MEDIUM
    "meta_calls": 657,                 # backend spend ledger, 28 Oct
    "meta_spend_usd": 10.0288,        # budget cap hit, 28 Oct 09:51 IST
    "avg_turn_minutes": "13-32",       # 8B brain measured 27 Oct
    "retractions": 0,
    "exhausted_plans": 235,            # war-record import, 29 Oct
    "rejected_plans": 8,               # war-record import, 29 Oct
    "source": "live hunt events.jsonl watermark 5619 + owner-verified reports",
}


def wait_port(port, timeout_s=30):
    """Fail closed: the mock never listening means the benchmark runs nowhere."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=2):
                return True
        except OSError:
            time.sleep(0.5)
    return False


def main():
    ap = argparse.ArgumentParser(description="benchmark the autonomous brain")
    ap.add_argument("--mem-root", default=None,
                    help="parent dir for the fresh benchmark memory dir")
    ap.add_argument("--port", type=int, default=8310)
    ap.add_argument("--waf", action="store_true",
                    help="run mock in --waf mode (naive filters on)")
    args = ap.parse_args()

    mem_dir = tempfile.mkdtemp(prefix="bench-mem-",
                               dir=args.mem_root or tempfile.gettempdir())
    print(f"[bench] memory dir: {mem_dir}", flush=True)

    # ---- start the mock target (localhost, disposable) ----
    mock_cmd = [sys.executable, os.path.join(HERE, "probe-lab", "mock-dvwa.py")]
    if args.waf:
        mock_cmd.append("--waf")
    env = dict(os.environ, MOCK_PORT=str(args.port))
    mock = subprocess.Popen(mock_cmd, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_port(args.port):
            print("[bench] FATAL: mock never listened — benchmark ABORTED",
                  flush=True)
            mock.terminate()
            return 2
        print(f"[bench] mock up on 127.0.0.1:{args.port} waf={args.waf}",
              flush=True)

        # ---- run the flagship autonomous path, zero human turns ----
        agent_cmd = [sys.executable, os.path.join(HERE, "brain-agent-v1.py"),
                     "--target-base", f"http://127.0.0.1:{args.port}",
                     "--memory-dir", mem_dir,
                     "--hunt-id", "bench_dvwa_waf" if args.waf else "bench_dvwa",
                     "--max-turns", "15",
                     "--fuzz"]
        t0 = time.time()
        r = subprocess.run(agent_cmd, text=True, capture_output=True,
                           timeout=1800)
        wall_s = time.time() - t0
        print(f"[bench] agent rc={r.returncode} wall={wall_s:.1f}s", flush=True)
        if r.returncode != 0:
            print("[bench] agent run failed — tail:\n"
                  + r.stdout[-2000:] + "\n" + r.stderr[-2000:], flush=True)
            return 1

        # ---- read the machine-readable results from the 3 files ----
        mem = json.loads(open(os.path.join(mem_dir, "memory.json"),
                              encoding="utf-8").read())
        # claims.json lives ALONGSIDE memory.json (brain-claims-v1 Rule #21),
        # not inside it — and it is keyed by claim hash ({hash: {...}}),
        # not a list. Read the real file or count zero wrongly.
        try:
            claims_doc = json.loads(
                open(os.path.join(mem_dir, "claims.json"),
                     encoding="utf-8").read())
        except (OSError, ValueError):
            claims_doc = {}
        if isinstance(claims_doc, dict) and "claims" in claims_doc and \
                isinstance(claims_doc["claims"], list):
            claims = claims_doc["claims"]
        else:
            claims = claims_doc  # list, or {hash: {...}} dict
        summary = mem.get("summary", {})
        findings = mem.get("findings", [])
        blocks = mem.get("claim_blocks", {})
        out_dir = os.path.join(mem_dir, "output")
        out_files = [f for f in os.listdir(out_dir) if f.endswith(".txt")] \
            if os.path.isdir(out_dir) else []
        turns = summary.get("turns") or 0
        confirmed = summary.get("confirmed") or 0
        failed = summary.get("failed") or 0
        fuzz_hits = len([f for f in findings
                         if str(f.get("turn")) == "fuzz"])
        drive_hits = len(findings) - fuzz_hits
        total_blocks = sum(len(v) if isinstance(v, list) else 1
                           for v in blocks.values()) if blocks else 0

        agent = {
            "hunt_id": "bench_dvwa" + ("_waf" if args.waf else ""),
            "target": f"mock-DVWA 127.0.0.1:{args.port}"
                      + (" (WAF mode)" if args.waf else ""),
            "wall_seconds": round(wall_s, 1),
            "turns": turns,
            "confirmed": confirmed,
            "failed": failed,
            "drive_findings_local_only": drive_hits,
            "fuzz_findings_local_only": fuzz_hits,
            "total_findings_local_only": len(findings),
            "claims_filed_local_only": len(claims) if isinstance(claims,
                                                            (list, dict))
            else 0,
            "dedup_blocks": total_blocks,
            "outputs_by_hash": len(out_files),
            "errors": summary.get("errors") or 0,
            "exhausted": bool(mem.get("exhausted")),
            "llm_calls": 0,
            "meta_spend_usd": 0.0,
            "time_per_turn_s": round(wall_s / turns, 1) if turns else None,
            "api_gate": "CLOSED",
        }

        # ---- before/after: same numbers the owner ordered on 27 Oct ----
        wr = WAR_RECORD
        table = [
            ("iterations / turns", wr["iterations"], agent["turns"]),
            ("verified / local-only findings", wr["genuine_verified"],
             agent["total_findings_local_only"]),
            ("dedup / re-file blocks", "n/a (backend)",
             agent["dedup_blocks"]),
            ("time per cycle", f'{wr["avg_turn_minutes"]} min/turn (8B)',
             f'{agent["time_per_turn_s"]} s/turn'),
            ("total wall time", "~26h (budget pause ended it)",
             f'{round(wall_s / 60, 1)} min'),
            ("Meta/API spend", f'${wr["meta_spend_usd"]}', "$0.0000"),
            ("retractions", wr["retractions"], 0),
        ]
        report = {
            "generated_ist": time.strftime("%Y-%m-%d %H:%M IST"),
            "rule": "#23 PROVE THE LEVEL",
            "war_record": wr,
            "agent": agent,
            "comparison_table": [
                {"metric": m, "live_hunt": a, "autonomous_brain": b}
                for m, a, b in table
            ],
            "scope_note": ("mock is localhost DVWA-faithful logic, not the "
                           "real DVWA; benchmark proves level on the same "
                           "bug classes, not on an unknown target."),
        }
        out_json = os.path.join(
            HERE, "probe-lab",
            f"benchmark-2026-10-29-{'waf' if args.waf else 'base'}.json")
        json.dump(report, open(out_json, "w", encoding="utf-8"), indent=2)
        print(f"[bench] wrote {out_json}", flush=True)

        for m, a, b in table:
            print(f"[bench] {m}: live={a} | brain={b}", flush=True)
        print(f"[bench] DONE — findings={agent['total_findings_local_only']} "
              f"wall={agent['wall_seconds']}s spend=$0 exhausted="
              f"{agent['exhausted']}", flush=True)
        return 0
    finally:
        mock.terminate()
        mock.wait(timeout=10)
        shutil.rmtree(mem_dir, ignore_errors=True)
        print("[bench] mock stopped, memdir cleaned", flush=True)


if __name__ == "__main__":
    sys.exit(main())
