#!/usr/bin/env python3
"""
brain-chain-v1.py — CHAIN FINDINGS INTO IMPACT PROOFS (Playbook Rule #24).

A real hunter never stops at "command injection confirmed". She chains:
  exec -> arbitrary file read
  fi   -> system user enumeration (config/creds surface)
  sqli -> dumped usernames -> brute-forced account

ZERO new payload probes (the 29 Oct 21:00 lane was safety-blocked on payload
authoring; this lane composes EXISTING verified probes with artifact-passing
only). Each recipe re-runs an existing probe (rebased in-memory, exact
VERDICT-last-line audit, output saved by hash) and files a NEW claim through
the Rule #21 claim state machine.

State machine in memory.json["chains"]: proposed -> attempted ->
proven | failed | not_possible. Terminal states are NEVER re-attempted
(A-to-Z discipline: the brain never repeats work).

Exit codes: 0 ok; 2 fail-closed on an internal defect (mirrors other lanes).
API gate stays CLOSED — claims are filed local-only.
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
PROBES = os.path.join(HERE, "brain-probes")
IST = timezone(timedelta(hours=5, minutes=30))
TERMINAL = {"proven", "failed", "not_possible"}

# Rule #28: proxy port for composed-probe subprocesses. Set in main().
_PROXY_PORT = None


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


def sha256_hex(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def fail(msg, code=2):
    print(f"[chain] FAIL-CLOSED: {msg}", file=sys.stderr, flush=True)
    sys.exit(code)


def load_mod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


feedback = load_mod("brain_feedback_v1", os.path.join(HERE, "brain-feedback-v1.py"))
claims_mod = load_mod("brain_claims_v1", os.path.join(HERE, "brain-claims-v1.py"))

KNOWN_USERS = ["admin", "gordonb", "1337", "pablo", "smithy"]

# --------------------------------------------------------------------------
# CHAIN REGISTRY. Each recipe reuses an EXISTING probe — no new payloads.
# requires: (module, vuln_class) the finding must carry.
# --------------------------------------------------------------------------
CHAIN_REGISTRY = [
    {
        "id": "chain/exec-fileread",
        "requires": ("vulnerabilities/exec/", "cmdi"),
        "probe": "chain_exec_fileread.py",
        "kind": "py",
        "argv_marker": True,
        "title": "Command Injection → Arbitrary File Read (chained proof)",
        "class": "cmdi",
        "severity": "CRITICAL",
        "artifact_re": re.compile(r"CHAINED FILE LINE:\s*(.+)"),
        "command_tpl": "python3 brain-probes/chain_exec_fileread.py {marker}",
        "counterevidence": ("control response (exec without the file-read "
                            "suffix) contained the marker but no /etc/passwd "
                            "content"),
        "why": ("a confirmed command-injection primitive is only the start; "
                "a human proves impact by reading a sensitive server file "
                "THROUGH it"),
    },
    {
        "id": "chain/fi-userenum",
        "requires": ("vulnerabilities/fi/", "lfi"),
        "probe": "parent_brain_lfi.py",
        "kind": "py",
        "argv_marker": False,
        "title": "File Inclusion → System User Enumeration (chained proof)",
        "class": "lfi",
        "severity": "HIGH",
        "artifact_re": re.compile(r"PASSWD LINE:\s*(.+)"),
        "command_tpl": "python3 brain-probes/parent_brain_lfi.py",
        "counterevidence": ("control page (include.php, no traversal) "
                            "contained no passwd content"),
        "why": ("a confirmed file-inclusion primitive is chained into real "
                "impact by enumerating system users from /etc/passwd"),
    },
    {
        "id": "chain/sqli-brute",
        "requires": ("vulnerabilities/sqli/", "sqli"),
        "probe": "parent_brain_brute.sh",
        "kind": "sh",
        "argv_marker": False,
        "title": "SQLi → Dumped Usernames → Brute-Forced Account (chained)",
        "class": "sqli",
        "severity": "CRITICAL",
        "artifact_re": None,  # artifact comes from the sqli finding's output
        "command_tpl": "bash brain-probes/parent_brain_brute.sh",
        "counterevidence": ("brute probe without the sqli-dumped username "
                            "surface would be blind guessing; the sqli dump "
                            "named the accounts to target"),
        "why": ("dumped usernames are not the end — a human feeds them to "
                "the login surface and proves account compromise"),
    },
]


def mem_paths(mem_dir):
    # Canonical three-file layout (same as brain-feedback-v1.paths):
    # <mem_dir>/output/<hash>.txt + <hash>.meta.json. A previous revision
    # wrote a stray "outputs/" dir — the report lane's strict hash check
    # would still pass, but the files would be invisible to recall.
    return feedback.paths(mem_dir)


def exact_verdict_last_line(stdout):
    """Playbook rule #3: the VERDICT must be the LAST non-empty line, exact."""
    lines = [l.strip() for l in (stdout or "").splitlines() if l.strip()]
    if not lines:
        return None
    last = lines[-1]
    if last == "VERDICT: CONFIRMED":
        return "CONFIRMED"
    if last == "VERDICT: FAILED":
        return "FAILED"
    return None


def find_finding(memory, module, vuln_class):
    for f in memory.get("findings", []):
        if f.get("module") == module and f.get("class") == vuln_class:
            return f
    return None


def decide_chains(memory):
    """Return recipes eligible now: requirement met AND not terminal."""
    chains = memory.setdefault("chains", {})
    eligible = []
    for rec in CHAIN_REGISTRY:
        mod, cls = rec["requires"]
        state = chains.get(rec["id"], {}).get("state")
        if state in TERMINAL:
            continue
        if find_finding(memory, mod, cls) is None:
            continue
        eligible.append(rec)
    return eligible


def _proxy_env():
    """Rule #28 env for composed-probe subprocesses (curl honors it)."""
    port = _PROXY_PORT
    env = dict(os.environ)
    env.pop("no_proxy", None)
    env.pop("NO_PROXY", None)
    if port:
        proxy_url = f"http://127.0.0.1:{port}"
        env["http_proxy"] = proxy_url
        env["https_proxy"] = proxy_url
    return env


def run_composed_probe(rec, target_base, rebase_from, timeout, marker):
    """Rebase an EXISTING probe in memory only; originals untouched."""
    src_path = os.path.join(PROBES, rec["probe"])
    if not os.path.isfile(src_path):
        fail(f"probe missing on disk: {rec['probe']}")
    with open(src_path, encoding="utf-8") as f:
        src = f.read()
    src = src.replace(rebase_from, target_base)
    suffix = ".py" if rec["kind"] == "py" else ".sh"
    with tempfile.NamedTemporaryFile("w", suffix=suffix, delete=False,
                                     dir="/tmp") as tf:
        tf.write(src)
        tmp = tf.name
    try:
        if rec["kind"] == "py":
            cmd = [sys.executable, tmp] + ([marker] if rec["argv_marker"] else [])
        else:
            cmd = ["/bin/bash", tmp]
        r = subprocess.run(cmd, capture_output=True, text=True,
                           timeout=timeout, env=_proxy_env())
        return r.stdout or "", (r.stderr or "")[-500:], r.returncode
    except subprocess.TimeoutExpired:
        fail(f"composed probe timed out after {timeout}s: {rec['probe']}")
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def extract_sqli_usernames(memory, mem_dir):
    """Artifact: usernames the sqli probe already dumped (recall WITH reason).

    The sqli probe prints only USERS_FOUND: n/5 — it checks the dumped
    response against a literal username list in its OWN source. The chain
    extracts that same list from the probe source (no new payload, no new
    request) and accepts it as the artifact only when the probe's printed
    line says the full list was dumped.
    """
    f = find_finding(memory, "vulnerabilities/sqli/", "sqli")
    if f is None or not f.get("output_hash"):
        fail("sqli finding has no output_hash — cannot chain")
    out = feedback.recall(mem_dir, f["output_hash"],
                          reason=("chain/sqli-brute: extract the usernames the "
                                  "sqli probe dumped, to feed the brute probe "
                                  "the real account surface"))
    if not isinstance(out, dict) or "output" not in out:
        fail(f"sqli output recall failed: {out}")
    text = out.get("output", "") or ""
    src = open(os.path.join(PROBES, "probe_sqli.py"),
               encoding="utf-8").read()
    m = re.search(r"for u in \[(.*?)\]", src, re.S)
    if not m:
        fail("probe_sqli.py no longer carries its username check list — "
             "refusing to invent the artifact")
    listed = re.findall(r"'([a-zA-Z0-9_]{2,20})'", m.group(1))
    m2 = re.search(r"USERS_FOUND:\s*(\d+)/(\d+)", text)
    if not (m2 and int(m2.group(1)) == int(m2.group(2)) == len(listed)
            and len(listed) > 0):
        fail("sqli output does not show the full username list dumped — "
             "chain has no surface")
    return sorted(set(listed))


def build_chain_claim(rec, command, artifact, marker):
    evidence_lines = [
        f"composed probe: {command}",
        f"artifact: {artifact}",
        f"marker: {marker}",
        "control/negative path held (see counterevidence)",
    ]
    claim = {
        "task": f"File chained finding: {rec['title']}",
        "goal": f"Prove impact beyond the base finding for {rec['id']}",
        "progress": "Composed probe VERDICT: CONFIRMED — filing chained claim",
        "action": {
            # DUAL-KEY CONTRACT (Rule #12): console needs action.type,
            # backend dispatches on action.action.
            "type": "claim_finding",
            "action": "claim_finding",
            "title": rec["title"],
            "class": rec["class"],
            "severity": rec["severity"],
            "command": command,
            "evidence": "\n".join(evidence_lines),
            "counterevidence": rec["counterevidence"],
            "confidence": "high",
        },
    }
    return claim


def run_chain(rec, memory, process, mem_dir, args, marker, turn):
    rid = rec["id"]
    mem_path, proc_path, out_dir = mem_paths(mem_dir)

    # Artifact for the sqli->brute chain comes from the requiring finding
    # via feedback.recall — which SAVES memory.json to disk. Reload after
    # it (tester-found defect pattern, 29 Oct 20:15): the stale in-memory
    # dict would otherwise wipe the recall_log entry on the next save.
    sqli_users = None
    if rid == "chain/sqli-brute":
        sqli_users = extract_sqli_usernames(memory, mem_dir)
        memory = feedback.load_json(mem_path, None) or {}

    chains = memory.setdefault("chains", {})
    chains[rid] = {"state": "attempted", "reason": "composed probe running",
                   "turn": turn, "attempted_ist": now_ist()}
    feedback.save_json(mem_path, memory)

    stdout, stderr_tail, rc = run_composed_probe(
        rec, args.target_base, args.rebase_from, args.probe_timeout, marker)

    verdict = exact_verdict_last_line(stdout)
    if verdict is None:
        chains[rid] = {"state": "failed", "turn": turn,
                       "reason": ("no exact VERDICT last line in composed "
                                  f"probe output (rc={rc}); refusing to "
                                  "judge — fail-closed"),
                       "failed_ist": now_ist()}
        feedback.save_json(mem_path, memory)
        return {"id": rid, "verdict": "NO_VERDICT", "error": True}

    # Output by hash (Rule #20 invariant: hash IS sha256 of the stored file).
    os.makedirs(out_dir, exist_ok=True)
    h = sha256_hex(stdout)
    with open(os.path.join(out_dir, h + ".txt"), "w",
              encoding="utf-8") as f:
        f.write(stdout)
    with open(os.path.join(out_dir, h + ".meta.json"), "w",
              encoding="utf-8") as f:
        json.dump({"backend_entry_hash": h, "turn": turn, "module": rid,
                   "composed_probe": rec["probe"],
                   "ingested_ist": now_ist()}, f, indent=1)

    artifact = None
    if rec["artifact_re"] is not None:
        m = rec["artifact_re"].search(stdout)
        artifact = m.group(1).strip()[:160] if m else None
    if rid == "chain/sqli-brute":
        artifact = f"sqli-dumped usernames: {', '.join(sqli_users)}"
    if verdict == "CONFIRMED" and not artifact:
        verdict = "FAILED"  # honest: confirmed without the impact artifact
        fail_reason = ("probe said CONFIRMED but the chain's impact artifact "
                       "was absent from the output — refusing to claim")
    else:
        fail_reason = None

    if verdict == "CONFIRMED":
        command = rec["command_tpl"].format(marker=marker)
        claim = build_chain_claim(rec, command, artifact, marker)
        gate_ok, gate_reason = claims_mod.pre_claim_gate(claim, mem_dir, rid)
        if not gate_ok:
            n = claims_mod.record_block(mem_dir, claim, rid, gate_reason)
            chains[rid] = {"state": "failed", "turn": turn,
                           "reason": f"claim blocked by Rule #21 gate: {gate_reason}",
                           "claim_blocks": n, "failed_ist": now_ist()}
            feedback.save_json(mem_path, memory)
            return {"id": rid, "verdict": "CONFIRMED",
                    "claim": "blocked", "reason": gate_reason}
        claims_mod.record_filed(mem_dir, claim, rid, turn)
        memory.setdefault("findings", []).append({
            "title": rec["title"], "class": rec["class"],
            "severity": rec["severity"], "module": rid,
            "turn": turn, "claim_hash": sha256_hex(json.dumps(claim,
                                                              sort_keys=True)),
            "output_hash": h, "status": "filed (chain lane, local-only)",
            "recorded_ist": now_ist(),
        })
        if rid not in memory.setdefault("tried", []):
            memory["tried"].append(rid)
        chains[rid] = {"state": "proven", "turn": turn, "artifacts": artifact,
                       "output_hash": h, "proven_ist": now_ist(),
                       "reason": f"composed probe CONFIRMED with artifact: {artifact}"}
    else:
        chains[rid] = {"state": "failed", "turn": turn,
                       "reason": fail_reason or "composed probe VERDICT: FAILED",
                       "output_hash": h, "failed_ist": now_ist()}

    process.setdefault("history", []).append({
        "turn": turn, "module": rid, "probe": rec["probe"],
        "action_summary": f"chain: {rec['why']}",
        "backend_hash": h, "output_hash": h,
        "output_bytes": len(stdout.encode("utf-8")),
        "entry": {"verdict": verdict}, "finished_ist": now_ist(),
    })
    feedback.save_json(mem_path, memory)
    feedback.save_json(proc_path, process)
    return {"id": rid, "verdict": verdict, "artifact": artifact}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--memory-dir", required=True)
    ap.add_argument("--hunt-id", default="local-agent")
    ap.add_argument("--target-base", required=True)
    ap.add_argument("--rebase-from",
                    default="http://172.17.0.1:3100")
    ap.add_argument("--probe-timeout", type=int, default=180)
    ap.add_argument("--start-turn", type=int, default=100)
    ap.add_argument("--scope-file", default=None,
                    help="Rule #27 scope spec JSON — chain recipes only touch "
                         "target_base; the target is fail-closed gated here")
    ap.add_argument("--proxy-port", type=int, default=0,
                    help="Rule #28: route composed probes via the brain proxy "
                         "on 127.0.0.1:PORT; 0 = direct")
    args = ap.parse_args()
    global _PROXY_PORT
    _PROXY_PORT = args.proxy_port or None
    if _PROXY_PORT:
        print(f"[chain] Rule #28: composed probes route via brain proxy "
              f"127.0.0.1:{_PROXY_PORT}", flush=True)

    # Rule #27 startup gate: chain recipes only ever touch target_base, so
    # gating the target itself covers the whole lane (fail-closed, 0 probes).
    if args.scope_file:
        scope_mod = load_mod("brain_scope_v1",
                             os.path.join(HERE, "brain-scope-v1.py"))
        try:
            scope = scope_mod.load_scope(args.scope_file, args.target_base)
        except ValueError as e:
            fail(f"fail-closed: {e}")
        ok, why = scope.url_allowed(args.target_base)
        if not ok:
            fail(f"fail-closed: target out of scope: {why} (0 probes launched)")
        print(f"[scope] {why}", flush=True)

    mem_path, proc_path, _ = mem_paths(args.memory_dir)
    if not os.path.isfile(mem_path):
        fail(f"memory.json missing: {mem_path}")
    memory = feedback.load_json(mem_path, None) or {}
    process = feedback.load_json(proc_path, None) or {}

    eligible = decide_chains(memory)
    print(f"[chain] eligible recipes: {[r['id'] for r in eligible]}",
          flush=True)

    process["in_process"] = True
    process["current"] = {"task": "chain findings into impact proofs",
                         "goal": "prove impact beyond base findings",
                         "progress": f"{len(eligible)} chain(s) eligible",
                         "started_ist": now_ist()}
    feedback.save_json(proc_path, process)

    results = []
    turn = args.start_turn
    for rec in eligible:
        turn += 1
        marker = f"CHN{turn}{int(time.time()) % 10000:04d}"
        print(f"[chain] {rec['id']}: {rec['why']}", flush=True)
        res = run_chain(rec, memory, process, args.memory_dir, args,
                        marker, turn)
        results.append(res)
        print(f"[chain] {rec['id']} -> {res['verdict']} "
              f"{res.get('artifact') or ''}", flush=True)

    process["in_process"] = False
    process["current"] = None
    feedback.save_json(proc_path, process)

    proven = sum(1 for r in results if r["verdict"] == "CONFIRMED")
    failed = sum(1 for r in results if r["verdict"] != "CONFIRMED")
    summary = {"eligible": len(eligible), "proven": proven,
               "failed": failed, "results": results,
               "llm_calls": 0, "meta_spend": 0.0, "api_gate": "CLOSED"}
    # Marker-prefixed single line: the agent parses on CHAIN_SUMMARY_JSON
    # (rfind('{') breaks on the nested result dicts).
    print("CHAIN_SUMMARY_JSON:" + json.dumps(summary), flush=True)


if __name__ == "__main__":
    main()
