#!/usr/bin/env python3
"""brain-drive-v1.py — AUTONOMOUS DRIVE THROUGH THE SUBMIT PATH (29 Oct ~19:50 IST).

Closes the full autonomous loop the agent will run in production:

  engine.decide -> build turn JSON -> submitter 4-gate dry-run -> TRANSPORT
  -> feedback.ingest({ok,hash,output,entry}) -> next turn

TRANSPORT is the only swappable part:
  --mock-backend   lab mode: executes the probe LOCALLY and wraps the result
                   in the EXACT {ok, hash, output, entry} shape the real
                   backend returns from POST /api/v1/hunts/{id}/brain-action-json
                   (proven 29 Oct ~19:44 IST from deployed code). The ingest
                   path is byte-identical to production.
  (real mode: owner JWT -> brain-submit-v1.py --submit. API gate closed until
   the owner hands the token; this lane never touches it.)

The next turn's decision sees memory+process EXACTLY as production: titles+
hashes, tried list (never repeats), dead ends with reasons, and the output
index — full output only via recall WITH reason.

USAGE (lab):
  python3 brain-recon-v1.py --target-base http://127.0.0.1:8310 > recon.json
  python3 brain-drive-v1.py --memory-dir probe-lab/mem-drive \\
      --hunt-id local-lab --mock-backend \\
      --target-base http://127.0.0.1:8310 --rebase-from http://172.17.0.1:3100 \\
      --recon recon.json
"""
import argparse
import importlib.util
import json
import os
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))

# Rule #26 (29 Oct ~21:40 IST): PER-MODULE PROBE TIMEOUTS. The blind-SQLi
# timing oracle needs >60s over a forwarded link (live-cold run reached bit
# POS 9/32 before the timeout killed it). Slow oracles get patience instead
# of a NO_VERDICT: the drive grants listed modules their own ceiling.
MODULE_TIMEOUTS = {
    "vulnerabilities/sqli_blind/": 300,
}
# Rule #27: explore specs are logical names ("explore/authbypass/") — the
# gate needs the REAL paths each explore probe touches. Sourced from the
# probe code itself (grep-verified 29 Oct); a missing key falls back to
# the logical name, which the default scope ("/") still allows.
EXPLORE_SCOPE_PATHS = {
    "explore/authbypass/": ["login.php", "vulnerabilities/brute/"],
    "explore/second-order/": ["vulnerabilities/xss_s/"],
    "explore/traversal-variants/": ["vulnerabilities/fi/"],
    "explore/method-tamper/": ["vulnerabilities/exec/"],
}
IST = timezone(timedelta(hours=5, minutes=30))


def load_feedback():
    spec = importlib.util.spec_from_file_location(
        "brain_feedback_v1", os.path.join(HERE, "brain-feedback-v1.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


def load_engine():
    spec = importlib.util.spec_from_file_location(
        "brain_engine_v2", os.path.join(HERE, "brain-engine-v2.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_explore():
    """Import brain-explore-v1.py (hyphenated filename) as a module."""
    spec = importlib.util.spec_from_file_location(
        "brain_explore_v1", os.path.join(HERE, "brain-explore-v1.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_claims():
    """Import brain-claims-v1.py (Rule #21 claim state machine)."""
    spec = importlib.util.spec_from_file_location(
        "brain_claims_v1", os.path.join(HERE, "brain-claims-v1.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_submitter():
    spec = importlib.util.spec_from_file_location(
        "brain_submit_v1", os.path.join(HERE, "brain-submit-v1.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_escalate():
    """Import brain-escalate-v1.py (FAILED-verdict escalation ladders)."""
    spec = importlib.util.spec_from_file_location(
        "brain_escalate_v1", os.path.join(HERE, "brain-escalate-v1.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_scope_mod():
    """Import brain-scope-v1.py (Rule #27 scope discipline)."""
    spec = importlib.util.spec_from_file_location(
        "brain_scope_v1", os.path.join(HERE, "brain-scope-v1.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def sha256_hex(text):
    import hashlib
    # Defense in depth: accept bytes as well as str (the timeout path
    # below normalizes to str, but a hash must never crash the drive).
    if isinstance(text, bytes):
        return hashlib.sha256(text).hexdigest()
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _to_text(value):
    """Normalize subprocess output to str.

    subprocess.TimeoutExpired.stdout/stderr are RAW BYTES even when the
    run used text=True (CPython decodes only on clean completion; the
    partial output on timeout is never decoded). Found 29 Oct on the
    LIVE target: the blind-SQLi probe timed out over the SSH forward and
    the bytes crashed sha256_hex, killing the whole drive. The mock
    never times out, so the lab never exercised this path.
    """
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def execute_command(command, timeout):
    """Run one engine shell action. Returns dict with stdout/stderr/rc/elapsed.

    Rule #28: when a proxy port is configured (--proxy-port), every probe
    runs with http_proxy/https_proxy pointed at the brain proxy and
    no_proxy/NO_PROXY cleared — curl honors env proxies, and a proxy that
    can be silently bypassed is worse than none.
    """
    start = datetime.now(IST)
    env = dict(os.environ)
    env.pop("no_proxy", None)
    env.pop("NO_PROXY", None)
    if _PROXY_PORT:
        proxy_url = f"http://127.0.0.1:{_PROXY_PORT}"
        env["http_proxy"] = proxy_url
        env["https_proxy"] = proxy_url
    try:
        proc = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=timeout, executable="/bin/bash", env=env,
        )
        rc, out, err, timed_out = proc.returncode, proc.stdout, proc.stderr, False
    except subprocess.TimeoutExpired as e:
        rc, out, err, timed_out = -1, _to_text(e.stdout), _to_text(e.stderr), True
    elapsed = (datetime.now(IST) - start).total_seconds()
    return {"rc": rc, "stdout": out, "stderr": err[-2000:],
            "timed_out": timed_out, "elapsed_s": round(elapsed, 1)}


def fresh_memory(hunt_id, target_base, engine):
    return {
        "hunt_id": hunt_id, "target_base": target_base,
        "tried": [], "explore_tried": [], "findings": [], "recall_log": [],
        "dead_ends": sorted(engine.DEAD_ENDS),
        "dead_end_reasons": {},
        "verdict_feedback_applied": [],
        "started_ist": now_ist(), "runs": 0,
    }


def fresh_process():
    return {"in_process": False, "current": None, "history": []}


# Rule #28: proxy port for this drive's probe subprocesses. Set once in
# main() from --proxy-port; execute_command reads it.
_PROXY_PORT = None


def main():
    global _PROXY_PORT
    p = argparse.ArgumentParser(description="Brain drive v1 — autonomous submit-path loop")
    p.add_argument("--memory-dir", required=True)
    p.add_argument("--hunt-id", default="local-lab")
    p.add_argument("--mock-backend", action="store_true",
                   help="lab transport: execute locally, wrap in {ok,hash,output,entry}")
    p.add_argument("--target-base", default="")
    p.add_argument("--rebase-from", default="http://172.17.0.1:3100")
    p.add_argument("--max-turns", type=int, default=15,
                   help="playbook (11) + explore (4) processes")
    p.add_argument("--probe-timeout", type=int, default=180)
    p.add_argument("--recon", default="")
    p.add_argument("--proxy-port", type=int, default=0,
                   help="Rule #28: route every probe request through the "
                        "brain proxy on 127.0.0.1:PORT (audit + scope "
                        "enforcement); 0 = direct")
    p.add_argument("--session-jar", default="",
                   help="Netscape cookie jar from brain-auth-v1; when set, "
                        "probes without their own login reuse the proved "
                        "session instead of running unauthenticated")
    p.add_argument("--scope-file", default="",
                   help="Rule #27 scope spec JSON; without it the default "
                        "scope (everything under the target host) is used")
    p.add_argument("--polite-gap", type=float, default=0,
                   help="Rule #27 polite mode: minimum seconds between "
                        "executed turns (0 = fast lab)")
    args = p.parse_args()

    if not args.mock_backend:
        print("real transport needs the owner JWT (API gate closed) — "
              "use --mock-backend for lab", file=sys.stderr)
        sys.exit(2)
    if not args.target_base:
        print("--target-base is required", file=sys.stderr); sys.exit(2)
    _PROXY_PORT = args.proxy_port or None
    if _PROXY_PORT:
        print(f"[drive] Rule #28: probes route via brain proxy "
              f"127.0.0.1:{_PROXY_PORT}", flush=True)

    # --- SCOPE GATE, startup (Rule #27): the target itself must be in
    # scope, else fail-closed with ZERO probes. This is the "explicit
    # targets only" order coded into the agent. ---
    scope_mod = load_scope_mod()
    try:
        scope = scope_mod.load_scope(args.scope_file, args.target_base)
    except ValueError as e:
        print(f"fail-closed: {e}", file=sys.stderr); sys.exit(2)
    ok, why = scope.url_allowed(args.target_base)
    if not ok:
        print(f"fail-closed: target_base out of scope: {why} "
              f"(0 probes launched)", file=sys.stderr)
        sys.exit(2)
    print(f"[scope] {why}", flush=True)
    polite_gap = max(0.0, args.polite_gap or scope.min_turn_gap_s)

    engine = load_engine()
    explore = load_explore()
    submitter = load_submitter()
    feedback = load_feedback()
    claims_mod = load_claims()
    escalate = load_escalate()
    mem_dir = os.path.abspath(args.memory_dir)
    mem_path, proc_path, out_dir = feedback.paths(mem_dir)

    memory = feedback.load_json(mem_path, None) or fresh_memory(
        args.hunt_id, args.target_base, engine)
    process = feedback.load_json(proc_path, None) or fresh_process()
    memory["runs"] = memory.get("runs", 0) + 1
    memory["last_run_ist"] = now_ist()

    # recon seeding (same as brain-loop-v1 --recon)
    priority_order = []
    if args.recon:
        with open(args.recon, "r", encoding="utf-8") as f:
            recon = json.load(f)
        for key in recon.get("modules_mapped") or []:
            path = engine.RECON_KEYS.get(key)
            if path and path not in priority_order:
                priority_order.append(path)
        memory["recon"] = {"target": recon.get("target"),
                           "modules_mapped": recon.get("modules_mapped"),
                           "verdict": recon.get("VERDICT"),
                           "seeded_turn_order": bool(priority_order)}
        print(f"[recon] seeded {len(priority_order)} module(s) first", flush=True)
    feedback.save_json(mem_path, memory)

    # rebase probe sources IN MEMORY ONLY (originals untouched)
    orig_loader = engine.load_probe_source

    # Session-jar prelude for python probes that use urllib.request WITHOUT
    # their own login (the explore lane). install_opener makes every
    # urlopen in the probe carry the proved session — the human-like
    # "log in once, browse with the session" behavior.
    _SESSION_PRELUDE = (
        "import os as _os, urllib.request as _ur\n"
        "from http.cookiejar import MozillaCookieJar as _MCJ\n"
        "_sj = _os.environ.get('BRAIN_SESSION_JAR')\n"
        "if _sj and _os.path.exists(_sj):\n"
        "    try:\n"
        "        _c = _MCJ(_sj); _c.load(ignore_discard=True, ignore_expires=True)\n"
        "        _ur.install_opener(_ur.build_opener(_ur.HTTPCookieProcessor(_c)))\n"
        "    except Exception:\n"
        "        pass\n"
    )

    session_jar = args.session_jar if (
        args.session_jar and os.path.exists(args.session_jar)) else ""
    if session_jar:
        # Inherited by every probe subprocess (shell=True keeps env).
        os.environ["BRAIN_SESSION_JAR"] = session_jar

    def rebased_loader(filename):
        src = orig_loader(filename).replace(args.rebase_from, args.target_base)
        if not session_jar:
            return src
        # Shell probes that never log in (no -b flag): attach the jar READ-ONLY.
        # Probes with their own cookie jar (-b "$COOKIE") are left alone —
        # their self-login is idempotent under the proved session.
        # NOTE: -b only, never -c: curl -c would REWRITE the shared jar at
        # exit, and a curl that can't parse a line (e.g. empty expires)
        # clobbers the proved session for every later turn (found 29 Oct:
        # traversal's -c wiped the jar, method-tamper then FALSE-FAILED).
        if filename.endswith(".sh") and " -b " not in src:
            src = src.replace("curl -s ", 'curl -s -b "$BRAIN_SESSION_JAR" ')
        # Python probes on urllib.request without session handling:
        # prepend the session prelude (requests-based probes self-login).
        if filename.endswith(".py") and "urllib.request" in src \
                and "HTTPCookieProcessor" not in src:
            src = _SESSION_PRELUDE + src
        return src
    engine.load_probe_source = rebased_loader

    total, turn, confirmed, failed, errors = (
        len(engine.MODULES) + len(explore.EXPLORE_CATALOG), 0, 0, 0, [])
    # Rule #27: modules blocked by the scope gate are skipped for THIS run
    # only — never marked tried (a re-scoped run may still hunt them), but
    # kept out of this run's decider inputs so the loop can't spin on them.
    run_skip = set()
    while turn < args.max_turns:
        run_tried = list(memory["tried"]) + sorted(run_skip)
        run_explore_tried = (list(memory.get("explore_tried", []))
                             + sorted(run_skip))
        # ESCALATION FIRST (Rule #18): an armed ladder rung outranks a new
        # module — a real hunter finishes the current hypothesis (with a
        # bypass variant) before moving on to the next one.
        spec = escalate.consume_pending(memory, engine)
        spec_source = "escalation" if spec is not None else None
        if spec is None:
            spec = engine.decide_next_module(run_tried,
                                             memory.get("dead_ends"),
                                             priority_order)
            spec_source = "playbook" if spec is not None else None
        if spec is None:
            # PLAYBOOK EXHAUSTED -> PROCESS AS A BOOLEAN (Rule #15, owner
            # order 29 Oct ~19:57 IST): brain-explore-v1 thinks of a NEW
            # process WITH REASON instead of stopping. None only when
            # explore is exhausted too (never repeats).
            spec, _reason = explore.decide_new_process(
                run_tried, run_explore_tried,
                memory.get("dead_ends"))
            spec_source = "explore" if spec is not None else None
        if spec is None:
            break  # fully exhausted — playbook AND explore, never repeats
        # --- SCOPE GATE, per turn (Rule #27): fail-closed BEFORE any
        # probe subprocess launches. The turn's real target URLs are:
        #   playbook/escalation -> target_base + base module path
        #                        (variants are "<path>::esc<N>")
        #   explore             -> target_base + each path the explore probe
        #                        actually touches (EXPLORE_SCOPE_PATHS).
        # A blocked turn sends ZERO requests, is recorded in
        # memory["scope_blocks"] WITH the reason, and never marks the
        # module tried. An armed escalation ladder whose rung is blocked
        # is consumed (dies WITH the scope reason) so the loop can't spin.
        module_path = spec[0]
        gate_paths = [module_path]
        if spec_source == "escalation" and escalate.is_variant(module_path):
            gate_paths = [escalate.base_of(module_path)]
        elif spec_source == "explore":
            gate_paths = EXPLORE_SCOPE_PATHS.get(module_path, [module_path])
        gate_urls = [urllib.parse.urljoin(
            args.target_base.rstrip("/") + "/",
            gp.lstrip("/")) for gp in gate_paths]
        blocked_reason = None
        for gu in gate_urls:
            ok, why = scope.url_allowed(gu)
            if not ok:
                blocked_reason = why
                break
        if blocked_reason:
            block = {"module": module_path, "probe": spec[1],
                     "source": spec_source, "urls": gate_urls,
                     "reason": blocked_reason, "at_ist": now_ist()}
            memory.setdefault("scope_blocks", []).append(block)
            if spec_source == "escalation":
                memory["escalation_pending"] = None
            run_skip.add(module_path)
            feedback.save_json(mem_path, memory)
            print(f"[scope] BLOCKED {module_path}: {blocked_reason} "
                  f"(0 requests sent)", flush=True)
            continue
        if polite_gap and turn > 0:
            time.sleep(polite_gap)
        turn += 1
        module, probe_file = spec[0], spec[1]

        probe_json = engine.build_probe_json(turn, total, spec)
        perr = engine.validate_probe_json(probe_json)
        if perr:
            errors.append({"turn": turn, "module": module, "error": perr})
            memory["tried"].append(module); feedback.save_json(mem_path, memory)
            continue

        # --- 4-gate pre-submit dry-run (identical gates the real submit runs) ---
        gerr = submitter.validate_reply(probe_json)
        if gerr:
            errors.append({"turn": turn, "module": module,
                           "error": f"submit gate: {gerr}"})
            memory["tried"].append(module); feedback.save_json(mem_path, memory)
            continue

        # --- process starts: in_process=true, full detail ---
        process["in_process"] = True
        process["current"] = {
            "turn": turn, "module": module, "probe": probe_file,
            "task": probe_json["task"], "goal": probe_json["goal"],
            "progress": probe_json["progress"],
            "action": {"type": probe_json["action"].get("type"),
                       "action": probe_json["action"].get("action")},
            "started_ist": now_ist(),
        }
        feedback.save_json(proc_path, process)

        # --- TRANSPORT (mock backend: execute locally, wrap like the real one) ---
        # Advisory external-host audit (Rule #27): payload strings like the
        # CSP probe's https://pastebin.com/raw/... are NOT requests, so this
        # logs but never blocks. A future proxy lane can enforce it.
        ext_hosts = scope_mod.audit_probe_hosts(
            probe_json["action"]["command"], scope)
        if ext_hosts:
            print(f"[scope] advisory: probe references external host(s) "
                  f"{ext_hosts} (payload strings, not requests)", flush=True)
        module_timeout = MODULE_TIMEOUTS.get(module, args.probe_timeout)
        exec_info = execute_command(probe_json["action"]["command"],
                                    module_timeout)
        stdout = exec_info["stdout"]
        h = sha256_hex(stdout)
        verdict = engine.parse_verdict(stdout) or "NO_VERDICT"
        response = {"ok": True, "hash": h, "output": stdout,
                    "entry": {"turn": turn, "module": module,
                              "verdict": verdict,
                              "rc": exec_info["rc"],
                              "elapsed_s": exec_info["elapsed_s"],
                              "timed_out": exec_info["timed_out"]}}

        # --- claim built locally when the verdict confirms (filed on ingest) ---
        claim_meta = None
        claim_blocked = None
        if verdict == "CONFIRMED":
            confirmed += 1
            lines = [l for l in stdout.splitlines()
                     if l.strip() and not l.startswith("VERDICT")]
            claim = engine.build_claim_json(
                spec, probe_command=probe_json["action"]["command"],
                evidence_lines=lines[-15:],
                counterevidence=("Probe's own control logic: injection marker "
                                  "present in the exploit request and absent in "
                                  "the control request (see probe stdout); exact "
                                  "VERDICT: CONFIRMED last line; command is the "
                                  "reproducible proof."),
            )
            cerr = engine.validate_claim_json(claim)
            if cerr:
                errors.append({"turn": turn, "module": module,
                               "error": f"claim JSON invalid: {cerr}"})
            else:
                # --- 5th PRE-SUBMIT GATE (Rule #21): the claim STATE MACHINE.
                # The 29-Oct live lesson: never re-file a claim that is
                # already FILED (wait for the terminal validation event),
                # already ACCEPTED (verified), or REJECTED (dead end). A
                # blocked re-file is DISCIPLINE, not an error — it is
                # counted in memory.json["claim_blocks"] WITH REASON.
                try:
                    gate_ok, gate_reason = claims_mod.pre_claim_gate(
                        claim, mem_dir, module)
                except Exception as e:  # corrupt state -> fail closed
                    gate_ok, gate_reason = False, f"gate ERROR: {e}"
                if not gate_ok:
                    n = claims_mod.record_block(mem_dir, claim, module,
                                                gate_reason)
                    claim_blocked = {"reason": gate_reason,
                                     "blocks_total": n}
                else:
                    claims_mod.record_filed(mem_dir, claim, module, turn)
                    claim_meta = {"title": claim["action"]["title"],
                                  "class": claim["action"]["class"],
                                  "severity": claim["action"]["severity"],
                                  "claim_hash": sha256_hex(
                                      json.dumps(claim, sort_keys=True))}
        elif verdict == "FAILED":
            failed += 1

        # --- OBSERVATION -> next-turn feedback (the new lane) ---
        meta = {"turn": turn, "module": module, "probe": probe_file,
                "task": probe_json["task"], "goal": probe_json["goal"],
                "action_summary": probe_json["action"]["command"][:140],
                "claim": claim_meta, "claim_blocked": claim_blocked}
        res = feedback.ingest(mem_dir, response, meta)
        ingest_ok = "error" not in res
        if not ingest_ok:
            errors.append({"turn": turn, "module": module,
                           "error": f"ingest: {res['error']}"})
        else:
            memory = feedback.load_json(mem_path, memory)
            process = feedback.load_json(proc_path, process)

        # --- ESCALATION LANE bookkeeping (Rule #18): a FAILED verdict arms
        # the next bypass-variant rung (or dead-ends the module WITH the
        # ladder summary as reason). Runs AFTER the ingest reload, on the
        # reloaded dict — same discipline as the explore lane. after_turn
        # undoes ingest's tried-marking of a base whose ladder is now
        # armed, so the rung stays decidable on the next turn. Fail-closed:
        # nothing is armed when ingest itself failed.
        if ingest_ok and verdict in ("CONFIRMED", "FAILED"):
            fail_reason = ""
            if verdict == "FAILED":
                olines = [l.strip() for l in stdout.splitlines()
                          if l.strip() and not l.strip().startswith("VERDICT")]
                fail_reason = (olines[-1] if olines else "")[:200]
            escalate.after_turn(memory, engine, module, verdict,
                                fail_reason=fail_reason)
            feedback.save_json(mem_path, memory)

        # --- EXPLORE LANE bookkeeping (Rule #15): ingest() loads memory.json
        # from disk, so explore_tried + dead-end folding happen AFTER the
        # reload, on the reloaded dict. ---
        if module.startswith("explore/"):
            if module not in memory.get("explore_tried", []):
                memory.setdefault("explore_tried", []).append(module)
            if ingest_ok and verdict == "FAILED":
                # A failed beyond-playbook process becomes a dead end WITH
                # REASON (owner refinement #1) — the brain never re-tries it.
                if module not in memory.get("dead_ends", []):
                    memory.setdefault("dead_ends", []).append(module)
                    memory["dead_ends"] = sorted(memory["dead_ends"])
                memory.setdefault("dead_end_reasons", {})[module] = {
                    "reason": ("explore probe VERDICT: FAILED — the process's "
                               "hypothesis did not hold on this target"),
                    "at_ist": now_ist(),
                    "source": "explore",
                }
            feedback.save_json(mem_path, memory)
        print(f"[turn {turn:02d}] {module} verdict={verdict} "
              f"hash={h[:12]} claim={'yes' if claim_meta else 'no'} "
              f"{'BLOCKED(' + claim_blocked['reason'][:60] + ') ' if claim_blocked else ''}"
              f"in_process={process.get('in_process')}", flush=True)

    playbook_done = engine.decide_next_module(memory["tried"],
                                              memory.get("dead_ends"),
                                              priority_order) is None
    explore_spec, _ = explore.decide_new_process(
        memory["tried"], memory.get("explore_tried", []),
        memory.get("dead_ends"))
    exhausted = playbook_done and explore_spec is None
    memory["exhausted"] = exhausted
    memory["summary"] = {"turns": turn, "confirmed": confirmed,
                         "failed": failed, "findings": len(memory["findings"]),
                         "exhausted": exhausted, "errors": len(errors)}
    feedback.save_json(mem_path, memory)

    print(f"\n[drive done] turns={turn} confirmed={confirmed} failed={failed} "
          f"exhausted={exhausted} findings={len(memory['findings'])} "
          f"errors={len(errors)}")
    if errors:
        print(json.dumps(errors, indent=2)); sys.exit(1)


if __name__ == "__main__":
    main()
