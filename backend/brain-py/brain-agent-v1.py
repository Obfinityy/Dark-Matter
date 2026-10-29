#!/usr/bin/env python3
"""brain-agent-v1.py — ONE-COMMAND AUTONOMOUS BUG BOUNTY BRAIN (29 Oct 2026).

The AIM's core unit: the owner pastes ONE link, this agent hunts the whole
target BY ITSELF — recon, decide, probe, exact VERDICT, claim, feedback,
explore new processes, exhaust — with ZERO human turns.

Pipeline (all deterministic, zero LLM, zero Meta API, zero cost):
  brain-recon-v1.py   -> attack surface: crawl + forms + JS sinks +
                         fingerprints + param/path -> module mapping
  brain-drive-v1.py   -> engine.decide -> build turn JSON ->
                         submitter 4-gate dry-run -> mock-backend transport
                         (execute probe, wrap {ok,hash,output,entry} EXACTLY
                         like POST /api/v1/hunts/{id}/brain-action-json) ->
                         feedback.ingest -> next turn; when the playbook is
                         exhausted, brain-explore-v1 thinks of NEW processes
                         WITH REASON (PROCESS AS A BOOLEAN) instead of
                         stopping.

Memory: the three-file per-hunt architecture (owner's 28-Oct design) in
--memory-dir: memory.json (titles+hashes, tried, dead ends w/ reason),
process.json (in_process boolean, full current task, history),
output/<sha256>.txt (full probe stdout, fetched by hash on demand).

Hard rules (enforced, not documented-only):
- Claims exist ONLY on an exact `VERDICT: CONFIRMED` last line, recorded
  LOCAL-ONLY (status: local-only). API gate stays closed: there is NO
  submit-to-backend path. Filing to the verifier needs the owner's release.
- Live hunt / Meta / backend NEVER touched. --rebase-from rewrites probe
  sources IN MEMORY ONLY; the originals stay pointed at the live base.
- Never repeats: tried + dead ends (static + verifier-feedback) +
  explore_tried are all skipped on resume. Proven by --resume-check:
  with an exhausted memory dir, decide_next_module AND decide_new_process
  both return None, so a resume drive would run 0 turns.

USAGE (lab — mock DVWA):
  python3 brain-agent-v1.py --target-base http://127.0.0.1:8310 \\
      --memory-dir probe-lab/mem-agent --hunt-id local-agent

USAGE (real — owner JWT + green light only):
  NOT SUPPORTED YET. Transport is --mock-backend by design. The real
  submit path (brain-submit-v1.py --submit) needs the owner's token and
  explicit release; until then the API gate stays closed.
"""
import argparse
import atexit
import importlib.util
import json
import os
import socket
import subprocess
import sys
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
IST = timezone(timedelta(hours=5, minutes=30))
LIVE_BASE = "http://172.17.0.1:3100"   # originals point here; never touched


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


def run(cmd, **kw):
    # cmd is a LIST; no shell, no executable= — executable="/bin/bash" with a
    # list corrupts argv (bash eats -s/-o as its own flags, errors with
    # argv[0] as the program name: "curl: /dev/null: invalid option name").
    print(f"[agent] $ {' '.join(cmd)}", flush=True)
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def main():
    p = argparse.ArgumentParser(description="One-command autonomous bug bounty brain")
    p.add_argument("--target-base", required=True)
    p.add_argument("--memory-dir", required=True)
    p.add_argument("--hunt-id", default="local-agent")
    p.add_argument("--rebase-from", default=LIVE_BASE,
                   help="probe sources carry this base; replaced in memory only")
    p.add_argument("--max-turns", type=int, default=15,
                   help="playbook (11) + explore (4) processes")
    p.add_argument("--probe-timeout", type=int, default=180)
    p.add_argument("--resume-check", action="store_true",
                   help="prove never-repeats on an existing memory dir, "
                        "run zero turns, exit 0 if both deciders return None")
    p.add_argument("--fuzz", action="store_true",
                   help="STEP 2.5: generic sweep — brain-fuzz-v1 fires the "
                        "payload corpus at every injectable input of every "
                        "recon-mapped form (the human's 'fuzz everything' "
                        "move; works on ANY target)")
    p.add_argument("--chain", action="store_true",
                   help="STEP 2.75: chain findings into impact proofs — "
                        "brain-chain-v1 composes EXISTING probes with "
                        "artifact-passing (exec->fileread, fi->userenum, "
                        "sqli->brute); zero new payload probes")
    p.add_argument("--report", action="store_true",
                   help="STEP 4: emit REPORT.md (submission-quality dossier) "
                        "from the per-hunt memory via brain-report-v1")
    p.add_argument("--scope-file", default=None,
                   help="Rule #27 scope spec JSON — every lane (recon, "
                        "drive, fuzz, chain) stays inside scope; the target "
                        "itself is fail-closed gated at each lane's startup")
    p.add_argument("--polite", action="store_true",
                   help="Rule #27 polite mode for real targets: 1.0s minimum "
                        "between drive turns, 0.5s between recon page fetches "
                        "(lab default is 0 = fast)")
    p.add_argument("--proxy", action=argparse.BooleanOptionalAction,
                   default=True,
                   help="Rule #28: run every lane through the brain proxy "
                        "(request audit + scope enforcement at the network "
                        "layer). On by default; --no-proxy disables. If the "
                        "proxy cannot start, the agent fails CLOSED (exit 1, "
                        "zero probes) — a silently missing enforcer is worse "
                        "than none.")
    args = p.parse_args()

    mem_dir = os.path.abspath(args.memory_dir)
    os.makedirs(os.path.join(mem_dir, "output"), exist_ok=True)

    # ---- load deciders for resume-check and final exhaustion proof ----
    def load_mod(name, fname):
        spec = importlib.util.spec_from_file_location(
            name, os.path.join(HERE, fname))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    engine = load_mod("brain_engine_v2", "brain-engine-v2.py")
    explore = load_mod("brain_explore_v1", "brain-explore-v1.py")
    feedback = load_mod("brain_feedback_v1", "brain-feedback-v1.py")
    mem_path, proc_path, out_dir = feedback.paths(mem_dir)
    memory = feedback.load_json(mem_path, None)

    if args.resume_check:
        if memory is None:
            print("[resume-check] no memory dir yet — nothing to resume",
                  flush=True)
            sys.exit(2)
        s1 = engine.decide_next_module(memory.get("tried", []),
                                       memory.get("dead_ends"), [])
        s2, _r = explore.decide_new_process(
            memory.get("tried", []), memory.get("explore_tried", []),
            memory.get("dead_ends"))
        print(f"[resume-check] playbook_next={s1} explore_next={s2} "
              f"exhausted={memory.get('exhausted')}", flush=True)
        if s1 is None and s2 is None:
            print("[resume-check] PASS — a resume drive would run 0 turns "
                  "(never-repeats holds)", flush=True)
            sys.exit(0)
        print("[resume-check] FAIL — a new process is still available",
              file=sys.stderr)
        sys.exit(1)

    # ---- Rule #28: brain proxy lifecycle (audit + scope enforcement) ----
    # Every lane's requests route through the proxy, so the audit trail
    # covers the WHOLE hunt (auth canary included) and the scope gate
    # cannot be dodged by a probe firing a request no lane saw.
    _proxy_proc = None
    _proxy_audit = None
    proxy_port = 0

    def _teardown_proxy():
        # atexit: runs on every exit path (incl. auth-blocked early exit).
        if _teardown_proxy.proc is not None:
            try:
                _teardown_proxy.proc.terminate()
                _teardown_proxy.proc.wait(timeout=5)
            except Exception:
                try:
                    _teardown_proxy.proc.kill()
                except Exception:
                    pass
            _teardown_proxy.proc = None
        if _teardown_proxy.audit is None:
            return
        try:
            n = b = 0
            with open(_teardown_proxy.audit, encoding="utf-8") as f:
                for line in f:
                    try:
                        e = json.loads(line)
                    except Exception:
                        continue
                    n += 1
                    if e.get("blocked"):
                        b += 1
            print(f"[agent] proxy audit: requests={n} blocked={b} "
                  f"({_teardown_proxy.audit})", flush=True)
        except Exception as ex:
            print(f"[agent] proxy audit unreadable: {ex}", flush=True)

    _teardown_proxy.proc = None
    _teardown_proxy.audit = None

    if args.proxy:
        _proxy_audit = os.path.join(mem_dir, "proxy-audit.jsonl")
        _pid_file = os.path.join(mem_dir, "proxy.pid")
        # free port discovery (bind 0 -> read -> close; tiny race, lab-ok)
        _s = socket.socket()
        _s.bind(("127.0.0.1", 0))
        proxy_port = _s.getsockname()[1]
        _s.close()
        _pcmd = [sys.executable, os.path.join(HERE, "brain-proxy-v1.py"),
                 "--port", str(proxy_port),
                 "--audit-log", _proxy_audit,
                 "--pid-file", _pid_file]
        if args.scope_file:
            _pcmd += ["--scope-file", args.scope_file]
        print(f"[agent] $ {' '.join(_pcmd)}", flush=True)
        _proxy_proc = subprocess.Popen(
            _pcmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        _teardown_proxy.proc = _proxy_proc
        _teardown_proxy.audit = _proxy_audit
        atexit.register(_teardown_proxy)
        # wait-ready: the proxy must answer TCP before any lane runs.
        _ready = False
        for _ in range(100):
            try:
                socket.create_connection(
                    ("127.0.0.1", proxy_port), timeout=1).close()
                _ready = True
                break
            except OSError:
                if _proxy_proc.poll() is not None:
                    break
                import time as _t
                _t.sleep(0.1)
        if not _ready:
            print(f"[agent] FAIL-CLOSED: brain proxy did not start on "
                  f"127.0.0.1:{proxy_port} (0 probes run)", file=sys.stderr)
            sys.exit(1)
        _proxy_url = f"http://127.0.0.1:{proxy_port}"
        os.environ.pop("no_proxy", None)
        os.environ.pop("NO_PROXY", None)
        os.environ["http_proxy"] = _proxy_url
        os.environ["https_proxy"] = _proxy_url
        print(f"[agent] Rule #28: proxy live on {_proxy_url} "
              f"(audit={_proxy_audit})", flush=True)
    proxy_arg = (["--proxy-port", str(proxy_port)] if proxy_port else [])

    # ---- fail-closed: the target must answer before any probe runs ----
    chk = run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
               "--max-time", "10", args.target_base + "/login.php"])
    if (chk.stdout or "").strip() not in ("200", "301", "302"):
        print(f"[agent] target unreachable: {args.target_base}/login.php -> "
              f"{chk.stdout.strip()!r} {chk.stderr.strip()[:200]}",
              file=sys.stderr)
        sys.exit(1)
    print(f"[agent] target up: {args.target_base}", flush=True)

    # ---- STEP 0: autonomous authentication (one brain, no human) ----
    # A human hunter's first move is a session. The lane detects whether
    # auth is required, logs in ONCE from the agent vault, and proves the
    # session end-to-end. If auth is required and no credential works it
    # fails CLOSED (exit 1) — and we run ZERO probes, because every probe
    # would FALSE-FAILED and poison the A-to-Z memory with false-negative
    # dead ends. Honest exhausted beats wrong lessons.
    a = run([sys.executable, os.path.join(HERE, "brain-auth-v1.py"),
             "--target-base", args.target_base,
             "--memory-dir", mem_dir,
             "--hunt-id", args.hunt_id] +
            (["--scope-file", args.scope_file] if args.scope_file else []) +
            proxy_arg)
    auth = (feedback.load_json(mem_path, None) or {}).get("auth", {})
    if a.returncode != 0:
        reason = auth.get("reason", "auth blocked, no detail")
        memory = feedback.load_json(mem_path, None) or {}
        memory["exhausted"] = True  # fail-closed exhausted: never retry blind
        save = feedback.save_json if hasattr(feedback, "save_json") else None
        if save:
            save(mem_path, memory)
        else:
            import json as _json
            _json.dump(memory, open(mem_path, "w"), indent=2)
        print(f"[agent] AUTH BLOCKED: {reason}", flush=True)
        print("=" * 64, flush=True)
        print(f"[agent] HUNT SUMMARY — {args.hunt_id} @ {args.target_base}",
              flush=True)
        print(f"  turns=0 confirmed=0 failed=0 findings_local_only=0 "
              f"outputs_by_hash=0 errors=0 exhausted=True", flush=True)
        print(f"  dead_ends={memory.get('dead_ends')} "
              f"(auth_blocked WITH REASON — 0 false negatives)", flush=True)
        print(f"  llm_calls=0 meta_spend=$0.0000 api_gate=CLOSED", flush=True)
        print("=" * 64, flush=True)
        sys.exit(0)
    jar = os.path.join(mem_dir, "auth.cookies")
    jar_arg = [jar] if (auth.get("required") and os.path.exists(jar)) else []
    print(f"[agent] auth: {auth.get('method', '?')} "
          f"(jar={'yes' if jar_arg else 'no'})", flush=True)

    # ---- STEP 1: autonomous recon (one brain, no human) ----
    recon_path = os.path.join(mem_dir, "recon.json")
    rcmd = [sys.executable, os.path.join(HERE, "brain-recon-v1.py"),
            "--target", args.target_base, "--out", recon_path] + proxy_arg
    if jar_arg:
        rcmd += ["--cookie-jar", jar_arg[0]]
    if args.scope_file:
        rcmd += ["--scope-file", args.scope_file]
    if args.polite:
        rcmd += ["--crawl-delay", "0.5"]
    r = run(rcmd)
    if r.returncode != 0 or not os.path.exists(recon_path):
        print(f"[agent] RECON FAILED rc={r.returncode}\n{r.stderr[-1500:]}",
              file=sys.stderr)
        sys.exit(1)
    recon = json.load(open(recon_path, encoding="utf-8"))
    print(f"[agent] recon: VERDICT={recon.get('VERDICT')} "
          f"modules_mapped={recon.get('modules_mapped')}", flush=True)

    # ---- STEP 2: the drive — decide/probe/VERDICT/claim/feedback/explore ----
    dcmd = [
        sys.executable, os.path.join(HERE, "brain-drive-v1.py"),
        "--memory-dir", mem_dir,
        "--hunt-id", args.hunt_id,
        "--mock-backend",
        "--target-base", args.target_base,
        "--rebase-from", args.rebase_from,
        "--max-turns", str(args.max_turns),
        "--probe-timeout", str(args.probe_timeout),
        "--recon", recon_path]
    if jar_arg:
        # The proved session rides along: login-less probes reuse it instead
        # of FALSE-FAILED under an auth gate (tester-found defect, 29 Oct).
        dcmd += ["--session-jar", jar_arg[0]]
    if args.scope_file:
        dcmd += ["--scope-file", args.scope_file]
    if args.polite:
        dcmd += ["--polite-gap", "1.0"]
    dcmd += proxy_arg
    d = subprocess.run(dcmd, text=True)
    if d.returncode != 0:
        print(f"[agent] DRIVE FAILED rc={d.returncode}", file=sys.stderr)
        sys.exit(d.returncode)

    # ---- STEP 2.5: the generic sweep (human's "fuzz everything" move) ----
    # The playbook + explore lanes are targeted probes. A human hunter then
    # fuzzes EVERYTHING the recon mapped — that is what finds bugs on
    # targets the playbook never imagined. brain-fuzz-v1 writes its findings
    # straight into the three files (fuzz-local, API gate closed).
    fuzz_findings = 0
    if args.fuzz:
        fuzz_out = os.path.join(mem_dir, "fuzz.json")
        fcmd = [sys.executable, os.path.join(HERE, "brain-fuzz-v1.py"),
                "--target", args.target_base,
                "--recon", recon_path,
                "--memory-dir", mem_dir,
                "--out", fuzz_out] + proxy_arg
        if jar_arg:
            fcmd += ["--cookie-jar", jar_arg[0]]
        if args.scope_file:
            fcmd += ["--scope-file", args.scope_file]
        f = run(fcmd)
        if f.returncode != 0:
            print(f"[agent] FUZZ FAILED rc={f.returncode}\n"
                  f"{f.stderr[-1500:]}", file=sys.stderr)
            sys.exit(f.returncode)
        try:
            fuzz_findings = len(json.load(open(fuzz_out,
                                               encoding="utf-8")).get("findings", []))
        except Exception:
            fuzz_findings = -1
        print(f"[agent] fuzz sweep done: findings={fuzz_findings}", flush=True)

    # ---- STEP 2.75: chain findings into impact proofs (Rule #24) ----
    # A human hunter never stops at "command injection confirmed" — she
    # chains primitives into impact (exec->file read, fi->user enum,
    # sqli->dumped accounts->brute force). brain-chain-v1 composes the
    # EXISTING verified probes with artifact-passing only: zero new
    # payload probes. Runs after the drive (needs CONFIRMED findings to
    # chain) and before the fuzz sweep.
    chain_proven = 0
    if args.chain:
        ccmd = [sys.executable, os.path.join(HERE, "brain-chain-v1.py"),
                "--memory-dir", mem_dir,
                "--hunt-id", args.hunt_id,
                "--target-base", args.target_base,
                "--rebase-from", args.rebase_from,
                "--probe-timeout", str(args.probe_timeout)]
        if args.scope_file:
            ccmd += ["--scope-file", args.scope_file]
        ccmd += proxy_arg
        c = run(ccmd)
        if c.returncode != 0:
            print(f"[agent] CHAIN FAILED rc={c.returncode}\n"
                  f"{c.stderr[-1500:]}", file=sys.stderr)
            sys.exit(c.returncode)
        try:
            csum_line = [l for l in c.stdout.splitlines()
                         if l.startswith("CHAIN_SUMMARY_JSON:")][-1]
            csum = json.loads(csum_line.split(":", 1)[1])
            chain_proven = csum.get("proven", 0)
        except Exception:
            chain_proven = -1
        print(f"[agent] chain step done: proven={chain_proven}", flush=True)

    # ---- STEP 3: the AIM-facing summary, read from the three files ----
    memory = feedback.load_json(mem_path, {}) or {}
    process = feedback.load_json(proc_path, {}) or {}
    summary = memory.get("summary", {})
    findings = memory.get("findings", [])
    out_files = [f for f in os.listdir(out_dir)
                 if f.endswith(".txt")] if os.path.isdir(out_dir) else []
    print("\n" + "=" * 64, flush=True)
    print(f"[agent] HUNT SUMMARY — {args.hunt_id} @ {args.target_base}",
          flush=True)
    print(f"  turns={summary.get('turns')} "
          f"confirmed={summary.get('confirmed')} "
          f"failed={summary.get('failed')} "
          f"findings_local_only={len(findings)} "
          f"outputs_by_hash={len(out_files)} "
          f"errors={summary.get('errors')} "
          f"exhausted={memory.get('exhausted')}", flush=True)
    print(f"  tried={len(memory.get('tried', []))} "
          f"explore_tried={len(memory.get('explore_tried', []))} "
          f"dead_ends={len(memory.get('dead_ends', []))} "
          f"in_process={process.get('in_process')}", flush=True)
    for f in findings:
        print(f"  CLAIM(local-only): {f.get('title')} "
              f"[{f.get('class')}/{f.get('severity')}] "
              f"hash={str(f.get('claim_hash'))[:12]}", flush=True)
    print(f"  llm_calls=0 meta_spend=$0.0000 api_gate=CLOSED", flush=True)
    print("=" * 64, flush=True)

    # ---- STEP 4: the dossier — a real hunter DELIVERS a report, not a list --
    if args.report:
        rcmd = [sys.executable, os.path.join(HERE, "brain-report-v1.py"),
                "--memory-dir", mem_dir]
        r = subprocess.run(rcmd, text=True)
        print(f"[agent] report step: rc={r.returncode} "
              f"(REPORT.md in {mem_dir})", flush=True)


if __name__ == "__main__":
    main()
