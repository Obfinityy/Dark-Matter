#!/usr/bin/env python3
"""
Brain Escalate v1 — FAILED-verdict escalation ladders.
Built 29 Oct 2026 (~20:40 IST). NO Meta API. NO local LLM.

THE GAP IT CLOSES (tester-found, 29 Oct): a real elite hunter does NOT walk
away after one failed payload. "Why did it fail? WAF? filter? encoding? wrong
payload class?" — it escalates with variant payloads BEFORE declaring a dead
end. Until this build, the loop fired ONE probe per module per turn: a FAILED
verdict meant the module was done (or a dead end). Against any target with
even a naive filter, that misses real findings a human would catch.

DESIGN (owner refinements honored):
- A ladder is an ordered list of ESCALATION RUNGS per module. Each rung is a
  self-contained variant probe (own command, fixed marker, own VERDICT line —
  probe lesson preserved) that defeats ONE specific naive-filter class.
- Escalation fires ONLY on VERDICT: FAILED, NEVER on CONFIRMED. A CONFIRMED
  base probe means the ladder never runs (zero extra turns).
- A-to-Z memory: tried rung ids live in memory["tried_variants"]; the brain
  NEVER re-runs a rung, across turns AND across loop restarts (resume-safe).
- Fail-closed ceilings: MAX_RUNGS_PER_MODULE=4 per module; unknown modules
  get no ladder (immediate dead-end behavior, unchanged); a rung spec whose
  probe file is missing is SKIPPED, never executed blind.
- ADD/REMOVE WITH REASON: when a ladder is exhausted, the module joins
  dead_ends WITH REASON = the full ladder summary (which rung failed and
  why) — the brain remembers exactly what was tried and why it stopped.
- The variant's claim title carries "(escalation rung N: <name> — <reason>)"
  so the finding's HOW is visible in the claim itself.

LADDER RUNG CATALOG (each rung = one naive-filter class, one bypass class):
  xss_r : case-variant      — <ScRiPt> vs case-sensitive <script block
          event-handler     — <img onerror> needs no <script tag at all
  xss_s : nested-tag        — <scr<scriptipt> vs single-pass strip
  sqli  : mixed-case-union  — uNiOn vs uppercase-only keyword block
  exec  : and-separator     — && vs ';' stripping
  fi    : absolute-path     — /etc/passwd vs dot-dot blocking
Modules without a ladder (sqli_blind, brute, xss_d, javascript, csp, csrf):
unchanged behavior — FAILED goes straight to dead end WITH REASON.

API (drop-in for any turn loop — brain-drive-v1.py wires it this build):
  consume_pending(memory, engine) -> variant spec tuple | None
      Call FIRST at turn start, before decide_next_module. Returns the armed
      variant spec (a full 7-tuple like engine.MODULES entries) or None.
  after_turn(memory, engine, module, verdict, fail_reason="") -> None
      Call AFTER the turn's verdict is known (and, for drive, after ingest
      reloaded memory). Performs ALL escalation bookkeeping:
        - CONFIRMED: records the rung, clears pending, marks base tried.
        - FAILED (playbook module): records the attempt; arms the next rung
          (sets memory["escalation_pending"]) or dead-ends the module WITH
          the ladder summary as reason.
        - FAILED (explore/*): untouched — the caller keeps its own handling.
      It also UNDOES the caller's tried-marking of a base module whose
      ladder is now armed (drive's ingest marks tried unconditionally).

Usage:
  python3 brain-escalate-v1.py --dry-run   # validate every rung spec
"""

import argparse
import importlib.util
import os
import sys
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
IST = timezone(timedelta(hours=5, minutes=30))

MAX_RUNGS_PER_MODULE = 4  # fail-closed ceiling: no module escalates forever

LADDERS = {
    "vulnerabilities/xss_r/": [
        {"name": "case-variant",
         "probe_file": "variant_xss_r_case.py",
         "reason": ("mixed-case <ScRiPt> bypasses naive case-sensitive "
                    "<script block filters"),
         "expectation": ("marker reflects when the filter strips only "
                         "lowercase '<script'")},
        {"name": "event-handler",
         "probe_file": "variant_xss_r_event.py",
         "reason": ("<img src=x onerror=...> needs no <script tag at all"),
         "expectation": ("marker reflects when every script tag is stripped "
                         "regardless of case")},
    ],
    "vulnerabilities/xss_s/": [
        {"name": "nested-tag",
         "probe_file": "variant_sxss_nested.py",
         "reason": ("<scr<scriptipt> survives a SINGLE-PASS case-insensitive "
                    "'<script' strip (one pass leaves <script>alert(1)</script>)"),
         "expectation": ("stored script tag present when the WAF strips once "
                         "non-recursively")},
    ],
    "vulnerabilities/sqli/": [
        {"name": "mixed-case-union",
         "probe_file": "variant_sqli_mixedcase.py",
         "reason": ("mixed-case uNiOn bypasses uppercase-only keyword blocks; "
                    "SQL keywords are case-insensitive"),
         "expectation": ("5/5 users dumped when the WAF blocks literal UNION only")},
    ],
    "vulnerabilities/exec/": [
        {"name": "and-separator",
         "probe_file": "variant_cmdi_and.py",
         "reason": "&& chains commands when the ';' separator is stripped",
         "expectation": "uid= output when ';' is filtered but '&&' is allowed"},
    ],
    "vulnerabilities/fi/": [
        {"name": "absolute-path",
         "probe_file": "variant_lfi_nested.py",
         "reason": ("/etc/passwd needs no traversal at all — defeats naive "
                    "WAFs that only block dot-dot sequences"),
         "expectation": "passwd content returned when '..' is blocked"},
    ],
}


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


# --------------------------------------------------------------------------
# rung identity helpers
# --------------------------------------------------------------------------
def rung_id(module, index):
    return "%s::esc%d" % (module, index)


def is_variant(module_id):
    return "::esc" in str(module_id)


def base_of(variant_id):
    return str(variant_id).split("::esc")[0]


def rung_index(variant_id):
    return int(str(variant_id).split("::esc")[1])


# --------------------------------------------------------------------------
# ladder state
# --------------------------------------------------------------------------
def next_rung(module, memory):
    """First untried rung for a base module -> (rung_dict, index) | (None, None)."""
    ladder = LADDERS.get(module, [])
    tried = set((memory or {}).get("tried_variants", []))
    for i, rung in enumerate(ladder[:MAX_RUNGS_PER_MODULE]):
        if rung_id(module, i) not in tried:
            return rung, i
    return None, None


def record_attempt(memory, module, index, verdict, reason=""):
    """Persist one ladder attempt (A-to-Z: never re-run a rung)."""
    rid = rung_id(module, index) if index is not None else module + "::base"
    tried_v = memory.setdefault("tried_variants", [])
    if rid not in tried_v:
        tried_v.append(rid)
    esc = memory.setdefault("escalations", {}).setdefault(
        module, {"rungs": [], "ladder": [r["name"] for r in LADDERS.get(module, [])]})
    rung_name = (LADDERS.get(module, [])[index]["name"]
                 if index is not None and index < len(LADDERS.get(module, []))
                 else "base")
    esc["rungs"].append({"rung": rung_name, "index": index, "verdict": verdict,
                         "reason": (reason or "")[:300], "at_ist": now_ist()})


def ladder_summary(memory, module):
    """Human-readable WITH REASON summary for the dead-end record."""
    esc = (memory or {}).get("escalations", {}).get(module, {})
    parts = []
    for r in esc.get("rungs", []):
        bit = "%s: VERDICT %s" % (r["rung"], r["verdict"])
        if r.get("reason"):
            bit += " (%s)" % r["reason"]
        parts.append(bit)
    ladder = " -> ".join(esc.get("ladder", [])) or "(no ladder)"
    return ("escalation ladder exhausted [%s]. Attempts: %s. "
            "The module's hypothesis did not hold under any bypass class."
            % (ladder, "; ".join(parts) if parts else "base probe only"))


def variant_spec(module, rung, index, engine):
    """Build a full engine-style 7-tuple spec for one rung.

    Looks up the base module's (runner, marker, vuln_class, severity) from
    engine.MODULES so the variant inherits the module's claim metadata;
    the title carries the escalation rung WITH REASON (owner refinement #1).
    Fail-closed: unknown module or missing probe file -> ValueError.
    """
    base = next((s for s in engine.MODULES if s[0] == module), None)
    if base is None:
        raise ValueError("escalation: unknown base module %r" % module)
    probe_path = os.path.join(HERE, "brain-probes", rung["probe_file"])
    if not os.path.isfile(probe_path):
        raise ValueError("escalation: probe file missing: %s" % probe_path)
    _mp, _pf, runner, marker, vuln_class, severity, title = base
    esc_title = ("%s (escalation rung %d: %s — %s)"
                 % (title, index, rung["name"], rung["reason"]))
    return (rung_id(module, index), rung["probe_file"], runner, marker,
            vuln_class, severity, esc_title)


# --------------------------------------------------------------------------
# turn-loop API
# --------------------------------------------------------------------------
def consume_pending(memory, engine):
    """Return the armed variant spec, or None. Call FIRST at turn start."""
    pend = (memory or {}).get("escalation_pending")
    if not pend:
        return None
    module, index = pend.get("module"), pend.get("rung")
    ladder = LADDERS.get(module, [])
    if (not isinstance(index, int) or index < 0
            or index >= min(len(ladder), MAX_RUNGS_PER_MODULE)):
        memory["escalation_pending"] = None  # stale/corrupt — fail closed
        return None
    return variant_spec(module, ladder[index], index, engine)


def after_turn(memory, engine, module, verdict, fail_reason=""):
    """Escalation bookkeeping after a turn's verdict. See module docstring."""
    if verdict not in ("CONFIRMED", "FAILED"):
        return  # NO_VERDICT/SKIPPED: touch nothing, fail closed
    if str(module).startswith("explore/"):
        return  # explore lane owns its dead ends — not laddered

    tried = memory.setdefault("tried", [])

    if verdict == "CONFIRMED":
        if is_variant(module):
            base = base_of(module)
            record_attempt(memory, base, rung_index(module), "CONFIRMED")
            if base not in tried:
                tried.append(base)  # base done — found via escalation
            if module not in tried:
                tried.append(module)
        else:
            if module not in tried:
                tried.append(module)
        memory["escalation_pending"] = None
        return

    # verdict == FAILED
    if is_variant(module):
        base, idx = base_of(module), rung_index(module)
        record_attempt(memory, base, idx, "FAILED", fail_reason)
        if module not in tried:
            tried.append(module)
    else:
        base = module
        record_attempt(memory, base, None, "FAILED", fail_reason)
        # The caller (drive's ingest) may have marked the base tried; while
        # its ladder is armed the base must stay decidable, so undo that.
        # (after_turn re-adds it only when the ladder is exhausted.)

    rung, idx = next_rung(base, memory)
    if rung is None:
        # Ladder exhausted (or the module never had one): dead end WITH
        # REASON — the full ladder summary, per ADD/REMOVE WITH REASON.
        summary = ladder_summary(memory, base)
        dead = memory.setdefault("dead_ends", [])
        if base not in dead:
            dead.append(base)
            dead = sorted(dead)
            memory["dead_ends"] = dead
        memory.setdefault("dead_end_reasons", {})[base] = {
            "reason": summary, "at_ist": now_ist(), "source": "escalation"}
        memory["escalation_pending"] = None
        if base not in tried:
            tried.append(base)
        return

    # Arm the next rung: base stays OUT of tried until the ladder resolves.
    if base in tried:
        tried.remove(base)
    memory["escalation_pending"] = {"module": base, "rung": idx,
                                    "armed_ist": now_ist()}


def load_engine():
    spec = importlib.util.spec_from_file_location(
        "brain_engine_v2", os.path.join(HERE, "brain-engine-v2.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    p = argparse.ArgumentParser(description="Brain Escalate v1 (dry-run)")
    p.add_argument("--dry-run", action="store_true",
                   help="Validate every rung spec (file exists, probe JSON "
                        "valid, claim JSON valid, dual-key contract).")
    args = p.parse_args()
    if not args.dry_run:
        print("Escalation runs inside a turn loop. Use --dry-run.",
              file=sys.stderr)
        sys.exit(2)
    engine = load_engine()
    errors, checked = [], 0
    for module, ladder in LADDERS.items():
        if len(ladder) > MAX_RUNGS_PER_MODULE:
            errors.append("%s: %d rungs exceed ceiling %d"
                          % (module, len(ladder), MAX_RUNGS_PER_MODULE))
        for i, rung in enumerate(ladder):
            checked += 1
            try:
                spec = variant_spec(module, rung, i, engine)
            except ValueError as e:
                errors.append(str(e))
                continue
            pj = engine.build_probe_json(1, 99, spec)
            perr = engine.validate_probe_json(pj)
            if perr:
                errors.append("%s rung %d probe JSON: %s"
                              % (module, i, perr))
                continue
            claim = engine.build_claim_json(
                spec, probe_command=pj["action"]["command"],
                evidence_lines=["e" * 40], counterevidence="c" * 20)
            cerr = engine.validate_claim_json(claim)
            if cerr:
                errors.append("%s rung %d claim JSON: %s" % (module, i, cerr))
            # dual-key contract spot check
            a = pj["action"]
            if a.get("type") != "shell" or a.get("action") != "shell":
                errors.append("%s rung %d: dual-key contract broken" % (module, i))
    # negative controls: unknown module, missing file
    try:
        variant_spec("vulnerabilities/nope/", {"name": "x", "probe_file": "y",
                     "reason": "r", "expectation": "e"}, 0, engine)
        errors.append("negative control FAILED: unknown module accepted")
    except ValueError:
        pass
    bad = dict(name="x", probe_file="does-not-exist.py",
               reason="r", expectation="e")
    try:
        variant_spec("vulnerabilities/xss_r/", bad, 0, engine)
        errors.append("negative control FAILED: missing probe file accepted")
    except ValueError:
        pass
    # state-machine unit checks
    mem = {"tried": [], "tried_variants": [], "escalations": {},
           "dead_ends": [], "dead_end_reasons": {}, "escalation_pending": None}
    if consume_pending(mem, engine) is not None:
        errors.append("consume_pending should be None on fresh memory")
    after_turn(mem, engine, "vulnerabilities/xss_r/", "FAILED", "base blocked")
    if not mem["escalation_pending"]:
        errors.append("FAILED base did not arm rung 0")
    elif "vulnerabilities/xss_r/" in mem["tried"]:
        errors.append("armed base must stay out of tried")
    spec = consume_pending(mem, engine)
    if spec is None or spec[0] != "vulnerabilities/xss_r/::esc0":
        errors.append("consume_pending did not return rung 0 spec")
    after_turn(mem, engine, spec[0], "FAILED", "rung0 blocked")
    spec2 = consume_pending(mem, engine)
    if spec2 is None or spec2[0] != "vulnerabilities/xss_r/::esc1":
        errors.append("consume_pending did not advance to rung 1")
    after_turn(mem, engine, spec2[0], "CONFIRMED")
    if mem["escalation_pending"]:
        errors.append("CONFIRMED variant did not clear pending")
    if "vulnerabilities/xss_r/" not in mem["tried"]:
        errors.append("CONFIRMED variant did not mark base tried")
    # exhaustion path
    mem2 = {"tried": [], "tried_variants": [], "escalations": {},
            "dead_ends": [], "dead_end_reasons": {}, "escalation_pending": None}
    after_turn(mem2, engine, "vulnerabilities/fi/", "FAILED", "base blocked")
    after_turn(mem2, engine, "vulnerabilities/fi/::esc0", "FAILED", "rung blocked")
    if mem2["escalation_pending"]:
        errors.append("exhausted ladder did not clear pending")
    if "vulnerabilities/fi/" not in mem2["dead_ends"]:
        errors.append("exhausted ladder did not dead-end the module")
    if "ladder exhausted" not in mem2["dead_end_reasons"]["vulnerabilities/fi/"]["reason"]:
        errors.append("dead-end reason missing ladder summary")
    print(f"[escalate] dry-run: {checked} rungs checked, "
          f"{len(errors)} error(s)")
    for e in errors:
        print("  ERROR:", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
