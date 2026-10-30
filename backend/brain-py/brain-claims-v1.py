#!/usr/bin/env python3
"""brain-claims-v1.py — CLAIM STATE MACHINE (Rule #21, 29 Oct ~20:50 IST).

The 29-Oct live lesson, coded: the parent filed the CSRF claim THREE TIMES in
one hour (12:51 / 13:02 / 13:12 IST, same hash 89f265ce) with no terminal
validation on the later filings. --verdict-feedback dead-ends REJECTED claims,
but NOTHING stopped re-filing a claim that was still awaiting its verdict.

This lane makes "FILE ONCE, WAIT FOR THE TERMINAL VERDICT" a state machine,
not a promise:

    filed  --(terminal validation event)-->  accepted | rejected

Terminal states are final. The brain can never re-file, and the only way a
filed claim leaves the pending set is the verifier's terminal validation event.

Per-hunt claims.json (alongside memory.json / process.json / output/):
  {claim_hash: {title, class, module, severity, state, filed_turn,
                filed_at_ist, history: [{state, at_ist, reason}], terminal}}

pre_claim_gate(claim, mem_dir, module) — FAIL-CLOSED. Blocks (ok=False):
  A. identical hash still FILED   -> "already FILED — wait for the verifier's
     terminal validation event; re-filing is forbidden (29-Oct lesson)"
  B. identical hash ACCEPTED      -> "already VERIFIED — A-to-Z memory,
     never re-file a verified finding"
  C. identical hash REJECTED      -> "rejected claim is a dead end"
  D. same (module, class), new hash, another claim FILED
     -> "one claim per finding-class — a claim for this module+class is
     already FILED; wait for the terminal verdict"
  E. same (module, class) ACCEPTED -> "already VERIFIED"
  F. same (module, class) REJECTED  -> "dead end WITH REASON"
A blocked re-file is GOOD behaviour (discipline), not an error: the drive
records it in memory.json["claim_blocks"] WITH REASON — the counter of times
the brain almost re-filed. Today that counter would read 3.

scan_terminal_validation(events_path, mem_dir) — reads REAL hunt events.jsonl
(format proven live on EC2 29 Oct 20:43 IST:
  {"type":"validation","verdict":"rejected",
   "plan":"Claim: <title>",...,"cachedAt":"..."}),
matches FILED claims by normalized title, and applies the terminal verdict:
  accepted -> finding marked verifier-accepted (by claim_hash, same keying as
              apply_verdict_feedback)
  rejected -> module folded into memory.json dead_ends WITH REASON
Idempotent: terminal states are final; re-scanning changes nothing.
Unmatched or ambiguous verdict events are LOGGED, never applied (fail-closed).
Multiple filed claims sharing one normalized title = ambiguity -> skip with
a logged reason (human resolves; the gate keeps blocking re-files meanwhile).

USAGE:
  python3 brain-claims-v1.py --self-test
  python3 brain-claims-v1.py --mem-dir ./mem --cmd gate --module sqli \\
      --claim-json claim.json            # 0/1 exit, JSON result on stdout
  python3 brain-claims-v1.py --mem-dir ./mem --cmd file --module sqli \\
      --turn 7 --claim-json claim.json   # registers FILED (gate first)
  python3 brain-claims-v1.py --mem-dir ./mem --cmd scan \\
      --events /path/to/events.jsonl     # applies terminal verdicts
  python3 brain-claims-v1.py --mem-dir ./mem --cmd status
"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
CLAIMS_FILE = "claims.json"

FILED = "filed"
ACCEPTED = "accepted"
REJECTED = "rejected"
TERMINAL = (ACCEPTED, REJECTED)


class GateError(Exception):
    """Fail-closed: the gate could not decide safely. Nothing is filed."""


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


def sha256_hex(s):
    if isinstance(s, str):
        s = s.encode("utf-8")
    return hashlib.sha256(s).hexdigest()


def claim_hash_of(claim):
    """Identical to brain-drive-v1's claim hash: sha256 of canonical JSON."""
    return sha256_hex(json.dumps(claim, sort_keys=True))


def norm_title(t):
    """Normalize a claim title for terminal-verdict matching.

    The backend's validation events carry plan="Claim: <title>" where <title>
    is the claim's action.title (proven live 29 Oct 20:43 IST). Strip the
    prefix, lowercase, collapse whitespace.
    """
    t = (t or "").strip()
    t = re.sub(r"^claim:\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s+", " ", t).strip().lower()
    return t


def _claims_path(mem_dir):
    return os.path.join(mem_dir, CLAIMS_FILE)


def load_claims(mem_dir):
    """Fail-closed: corrupt claims.json aborts, never silently resets."""
    path = _claims_path(mem_dir)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        raise GateError(f"claims.json unreadable/corrupt ({e}) — refusing "
                        f"to decide; repair manually")
    if not isinstance(data, dict):
        raise GateError("claims.json is not a JSON object — refusing to decide")
    return data


def save_claims(mem_dir, claims):
    """Atomic write: tmp + os.replace so a crash never leaves half a file."""
    os.makedirs(mem_dir, exist_ok=True)
    path = _claims_path(mem_dir)
    fd, tmp = tempfile.mkstemp(dir=mem_dir, prefix="claims.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(claims, f, indent=2, sort_keys=True)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _claim_fields(claim):
    action = (claim or {}).get("action", {})
    return {
        "title": str(action.get("title", "")),
        "class": str(action.get("class", "")),
        "severity": str(action.get("severity", "")),
    }


def pre_claim_gate(claim, mem_dir, module):
    """Return (ok, reason). ok=False means DO NOT FILE.

    Six fail-closed blocks (A..F). Blocked re-files are recorded by the
    caller in memory.json["claim_blocks"] WITH REASON — discipline you can
    count.
    """
    claims = load_claims(mem_dir)
    fields = _claim_fields(claim)
    ch = claim_hash_of(claim)
    rec = claims.get(ch)

    if rec is not None:
        state = rec.get("state")
        if state == FILED:
            return (False,
                    f"BLOCKED-A: claim {ch[:12]} already FILED at turn "
                    f"{rec.get('filed_turn')} ({rec.get('filed_at_ist')}) — "
                    f"wait for the verifier's terminal validation event; "
                    f"re-filing is forbidden (29-Oct lesson)")
        if state == ACCEPTED:
            return (False,
                    f"BLOCKED-B: claim {ch[:12]} already VERIFIED "
                    f"(accepted {rec.get('terminal', {}).get('at_ist')}) — "
                    f"A-to-Z memory: never re-file a verified finding")
        if state == REJECTED:
            return (False,
                    f"BLOCKED-C: claim {ch[:12]} REJECTED "
                    f"({rec.get('terminal', {}).get('at_ist')}) — rejected "
                    f"claims are dead ends, never re-claimed")
        raise GateError(f"claim {ch[:12]} has unknown state {state!r} — "
                        f"refusing to decide")

    # Same (module, class), different hash — one claim per finding-class.
    mod = module or ""
    cls = fields["class"]
    for och, orec in claims.items():
        if orec.get("module") == mod and orec.get("class") == cls:
            ostate = orec.get("state")
            if ostate == FILED:
                return (False,
                        f"BLOCKED-D: claim {och[:12]} for module={mod} "
                        f"class={cls} already FILED (turn "
                        f"{orec.get('filed_turn')}) — one claim per "
                        f"finding-class; wait for the terminal verdict "
                        f"before any new evidence is filed")
            if ostate == ACCEPTED:
                return (False,
                        f"BLOCKED-E: module={mod} class={cls} already "
                        f"VERIFIED (claim {och[:12]}) — never re-file a "
                        f"verified finding")
            if ostate == REJECTED:
                reason = (orec.get("terminal", {}) or {}).get("reason", "")
                return (False,
                        f"BLOCKED-F: module={mod} class={cls} is a dead end "
                        f"WITH REASON (claim {och[:12]} rejected"
                        f"{': ' + reason if reason else ''}) — rejected "
                        f"claims are dead ends, never re-claimed")
    return (True, "gate PASS: no prior claim for this hash or module+class")


def record_filed(mem_dir, claim, module, turn):
    """Gate first, then register FILED. Raises GateError / returns record.

    GateError message starts with "BLOCKED-" when the gate refused; the
    caller records that as a claim_block (discipline), not an error.
    """
    ok, reason = pre_claim_gate(claim, mem_dir, module)
    if not ok:
        raise GateError(reason)
    claims = load_claims(mem_dir)
    fields = _claim_fields(claim)
    ch = claim_hash_of(claim)
    at = now_ist()
    action = (claim or {}).get("action", {}) or {}
    claims[ch] = {
        "title": fields["title"],
        "class": fields["class"],
        "module": module or "",
        "severity": fields["severity"],
        # Rule #37: the claim RECORD cites the evidence hash too (the
        # claim BODY already carries it from _build_lab_claim) so the
        # report lane can prove every finding from hash-verified bytes.
        # Parent-path claims may not carry one — recorded honestly empty.
        "evidence_hash": str(action.get("evidence_hash") or ""),
        # Rule #43: the backend claim bridge files FILED claims through
        # the real claim pipeline (claimGateCheck + assessResult), which
        # needs the verifier-facing proof package — persist it from the
        # claim body so the bridge never re-derives or invents it.
        # Parent-path claims may not carry these: stored honestly empty,
        # and the bridge skips such claims (fail-closed). The claim HASH
        # is computed from the input dict, not this record — adding
        # stored fields changes no existing hash.
        "command": str(action.get("command") or ""),
        "evidence": str(action.get("evidence") or ""),
        "counterevidence": str(action.get("counterevidence") or ""),
        "confidence": str(action.get("confidence") or ""),
        "state": FILED,
        "filed_turn": turn,
        "filed_at_ist": at,
        "history": [{"state": FILED, "at_ist": at,
                     "reason": "filed by the brain (gate PASS)"}],
        "terminal": None,
    }
    save_claims(mem_dir, claims)
    return claims[ch]


def record_block(mem_dir, claim, module, reason):
    """A blocked re-file is DISCIPLINE, not an error: count it WITH REASON."""
    mem_path = os.path.join(mem_dir, "memory.json")
    memory = {}
    if os.path.exists(mem_path):
        try:
            with open(mem_path, "r", encoding="utf-8") as f:
                memory = json.load(f) or {}
        except (json.JSONDecodeError, OSError):
            memory = {}
    blocks = memory.setdefault("claim_blocks", [])
    blocks.append({
        "at_ist": now_ist(),
        "module": module or "",
        "title": _claim_fields(claim)["title"],
        "claim_hash": claim_hash_of(claim)[:16],
        "reason": reason,
    })
    fd, tmp = tempfile.mkstemp(dir=mem_dir, prefix="memory.",
                               suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(memory, f, indent=2, sort_keys=True)
            f.write("\n")
        os.replace(tmp, mem_path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return len(blocks)


# Rule #43: the real pipeline's verdict vocabulary. assessResult records
# 'verified' on success (never 'accepted'); 'gate-rejected' and
# 'not-interesting' are terminal rejections of the proof package (the
# verifier saw the evidence and refused it — the claim is a dead end,
# never re-claimed). 'execution-failed' is NOT a verdict on the claim's
# truth — the command never executed — so the claim stays FILED
# (fail-closed); anything else unknown stays fail-open per line.
_TERMINAL_VERDICTS = {
    "accepted": ACCEPTED,
    "verified": ACCEPTED,
    "rejected": REJECTED,
    "gate-rejected": REJECTED,
    "not-interesting": REJECTED,
}
_NONTERMINAL_VERDICTS = frozenset({"execution-failed"})


def _parse_validation_event(line):
    """Parse one jsonl line; return
    (norm_plan_title, terminal_state, raw_verdict, event_ref, detail)
    for type=validation events carrying a terminal pipeline verdict,
    else None. Fail-open per line: a bad line is skipped, never fatal."""
    line = (line or "").strip()
    if not line:
        return None
    try:
        ev = json.loads(line)
    except json.JSONDecodeError:
        return None
    if not isinstance(ev, dict) or ev.get("type") != "validation":
        return None
    raw = str(ev.get("verdict", "")).lower()
    if raw in _NONTERMINAL_VERDICTS:
        return None
    terminal = _TERMINAL_VERDICTS.get(raw)
    if terminal is None:
        return None
    plan = norm_title(ev.get("plan", ""))
    if not plan:
        return None
    ref = ev.get("cachedAt") or ev.get("at") or ""
    detail = str(ev.get("detail", "") or "")
    return (plan, terminal, raw, ref, detail)


def _load_memory(mem_dir):
    path = os.path.join(mem_dir, "memory.json")
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f) or {}


def _save_memory(mem_dir, memory):
    path = os.path.join(mem_dir, "memory.json")
    fd, tmp = tempfile.mkstemp(dir=mem_dir, prefix="memory.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(memory, f, indent=2, sort_keys=True)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def scan_terminal_validation(events_path, mem_dir):
    """Apply the verifier's terminal validation events to FILED claims.

    Returns {"applied": [...], "unmatched": [...], "ambiguous": [...],
             "errors": [...]}. Idempotent: re-scanning changes nothing.
    """
    claims = load_claims(mem_dir)
    memory = _load_memory(mem_dir)
    memory.setdefault("dead_ends", [])
    memory.setdefault("dead_end_reasons", {})
    result = {"applied": [], "unmatched": [], "ambiguous": [], "errors": []}

    # Index filed claims by normalized title.
    by_title = {}
    for ch, rec in claims.items():
        if rec.get("state") == FILED:
            by_title.setdefault(norm_title(rec.get("title", "")), []).append(ch)

    def fold_rejected(ch, rec, terminal, raw_verdict, ref, detail, at):
        module = rec.get("module", "")
        reason = (f"verifier REJECTED the claim '{rec.get('title')}' "
                  f"(pipeline verdict '{raw_verdict}'"
                  f"{': ' + detail if detail else ''}; "
                  f"terminal validation event {ref or 'unref'})")
        if module and module not in memory["dead_ends"]:
            memory["dead_ends"].append(module)
            memory["dead_ends"] = sorted(memory["dead_ends"])
        if module:
            memory["dead_end_reasons"][module] = {
                "reason": reason,
                "claim_hash": ch,
                "at_ist": at,
                "source": "verifier",
            }
        # The finding itself must not keep reading "filed (backend
        # executed)" while its claim is REJECTED — mark it, same keying
        # as fold_accepted.
        for f in memory.get("findings", []):
            if f.get("claim_hash") == ch:
                f["status"] = "verifier-rejected"

    def fold_accepted(ch, rec):
        for f in memory.get("findings", []):
            if f.get("claim_hash") == ch:
                f["status"] = "verifier-accepted"
        # Rule #73: a re-bridged claim can verify AFTER an earlier
        # rejection folded this module into dead_ends. The verifier's
        # latest word supersedes — drop the stale dead-end entry for
        # THIS claim only; other modules' dead ends are untouched.
        module = rec.get("module", "")
        rsn = (memory.get("dead_end_reasons") or {}).get(module)
        if module and rsn and rsn.get("claim_hash") == ch:
            memory["dead_end_reasons"].pop(module, None)
            if module in memory.get("dead_ends", []):
                memory["dead_ends"].remove(module)

    try:
        fh = open(events_path, "r", encoding="utf-8")
    except OSError as e:
        result["errors"].append(f"cannot read events file: {e}")
        return result

    changed = False
    # Rule #73: collect ALL terminal events per filed claim first, then
    # apply the LATEST one per claim. A re-bridged claim (reset to filed
    # after a fix) carries both the stale rejection and the fresh verdict
    # in the events file — first-event-wins applied the stale one and left
    # the fresh verdict "unmatched" (live: ssrf re-bridge, 30 Oct 2026).
    # The verifier's latest word is authoritative.
    per_claim_events = {}  # ch -> [(lineno, terminal, raw_verdict, ref, detail)]
    with fh:
        for lineno, line in enumerate(fh, 1):
            parsed = _parse_validation_event(line)
            if parsed is None:
                continue
            plan_title, terminal, raw_verdict, ref, detail = parsed
            cands = by_title.get(plan_title, [])
            if not cands:
                result["unmatched"].append(
                    {"line": lineno, "plan": plan_title,
                     "verdict": terminal,
                     "pipeline_verdict": raw_verdict, "ref": ref})
                continue
            if len(cands) > 1:
                result["ambiguous"].append(
                    {"line": lineno, "plan": plan_title,
                     "verdict": terminal,
                     "pipeline_verdict": raw_verdict, "ref": ref,
                     "candidates": [c[:12] for c in cands],
                     "reason": "multiple FILED claims share this title — "
                               "human resolves; gate keeps blocking re-files"})
                continue
            ch = cands[0]
            per_claim_events.setdefault(ch, []).append(
                (lineno, terminal, raw_verdict, ref, detail))

    for ch, evs in per_claim_events.items():
        rec = claims[ch]
        # Defensive: state may have changed since the index was built.
        if rec.get("state") != FILED:
            continue
        # Latest terminal event wins; earlier ones are superseded.
        evs.sort(key=lambda e: e[0])
        lineno, terminal, raw_verdict, ref, detail = evs[-1]
        at = now_ist()
        reason = (f"terminal validation event line {lineno} "
                  f"(pipeline verdict '{raw_verdict}' -> {terminal}, "
                  f"ref={ref or 'none'})")
        if len(evs) > 1:
            reason += (f"; superseded {len(evs) - 1} earlier terminal "
                       f"event(s) for this claim")
        rec["state"] = terminal
        rec["terminal"] = {"verdict": terminal,
                           "pipeline_verdict": raw_verdict,
                           "pipeline_detail": detail,
                           "event_ref": ref,
                           "event_line": lineno, "at_ist": at,
                           "reason": reason}
        rec["history"].append({"state": terminal, "at_ist": at,
                               "reason": reason})
        if terminal == REJECTED:
            fold_rejected(ch, rec, terminal, raw_verdict, ref,
                          detail, at)
        else:
            fold_accepted(ch, rec)
        result["applied"].append(
            {"claim_hash": ch[:16], "title": rec.get("title"),
             "verdict": terminal, "pipeline_verdict": raw_verdict,
             "line": lineno})
        changed = True

    if changed:
        save_claims(mem_dir, claims)
        _save_memory(mem_dir, memory)
    return result


def status(mem_dir):
    claims = load_claims(mem_dir)
    by_state = {}
    for ch, rec in claims.items():
        by_state.setdefault(rec.get("state", "?"), []).append(ch[:12])
    memory = _load_memory(mem_dir)
    return {
        "claims_total": len(claims),
        "by_state": {k: len(v) for k, v in by_state.items()},
        "claim_hashes": {k: v for k, v in by_state.items()},
        "claim_blocks": len(memory.get("claim_blocks", [])),
    }


# ---------------------------------------------------------------- self-test
def _tclaim(title, cls, module):
    return {"task": "t", "goal": "g", "progress": "p",
            "action": {"type": "claim_finding", "action": "claim_finding",
                       "title": title, "class": cls, "severity": "high",
                       "command": "cmd", "evidence": "ev",
                       "counterevidence": "ce", "confidence": "high"}}


def self_test():
    import shutil
    fails = []

    def check(name, cond, extra=""):
        print(("PASS " if cond else "FAIL ") + name +
              (f" — {extra}" if extra and not cond else ""))
        if not cond:
            fails.append(name)

    tmp = tempfile.mkdtemp(prefix="claims-test-")
    try:
        # 1. fresh gate PASS
        c1 = _tclaim("Reflected XSS in /xss", "xss_r", "xss_r")
        ok, reason = pre_claim_gate(c1, tmp, "xss_r")
        check("fresh claim gate PASS", ok, reason)

        # 2. file it
        rec = record_filed(tmp, c1, "xss_r", 3)
        check("record_filed state=filed", rec["state"] == FILED)

        # 3. identical re-file BLOCKED-A (the 29-Oct CSRF scenario)
        ok, reason = pre_claim_gate(c1, tmp, "xss_r")
        check("identical re-file BLOCKED-A",
              (not ok) and reason.startswith("BLOCKED-A"), reason)

        # 4. same module+class new evidence BLOCKED-D (one claim per class)
        c1b = _tclaim("Reflected XSS in /xss", "xss_r", "xss_r")
        c1b["action"]["evidence"] = "different evidence text"
        ok, reason = pre_claim_gate(c1b, tmp, "xss_r")
        check("same module+class new-hash BLOCKED-D",
              (not ok) and reason.startswith("BLOCKED-D"), reason)

        # 5. different module+class PASS
        c2 = _tclaim("SQLi in /sqli", "sqli", "sqli")
        ok, reason = pre_claim_gate(c2, tmp, "sqli")
        check("different module+class gate PASS", ok, reason)
        record_filed(tmp, c2, "sqli", 5)

        # 6. scan: accepted + rejected terminal events (REAL format)
        # seed one finding so the reject-status fold has something to mark
        _save_memory(tmp, {"findings": [
            {"module": "sqli", "claim_hash": claim_hash_of(c2),
             "status": "filed (backend executed)"},
            {"module": "xss_r", "claim_hash": claim_hash_of(c1),
             "status": "filed (backend executed)"}]})
        ev_path = os.path.join(tmp, "events.jsonl")
        with open(ev_path, "w", encoding="utf-8") as f:
            f.write('{"type":"thinking","detail":"x"}\n')
            f.write('{"type":"validation","verdict":"accepted",'
                    '"plan":"Claim: Reflected XSS in /xss",'
                    '"detail":"ok","text":"validation: Claim: Reflected XSS '
                    'in /xss — accepted","cachedAt":"2026-10-29T10:00:00Z"}\n')
            f.write('{"type":"validation","verdict":"rejected",'
                    '"plan":"Claim: SQLi in /sqli",'
                    '"detail":"false_positive",'
                    '"text":"validation: Claim: SQLi in /sqli — rejected",'
                    '"cachedAt":"2026-10-29T10:05:00Z"}\n')
            f.write('{"type":"validation","verdict":"accepted",'
                    '"plan":"Claim: Something Never Filed",'
                    '"cachedAt":"2026-10-29T10:06:00Z"}\n')
            f.write('not json at all\n')
        res = scan_terminal_validation(ev_path, tmp)
        check("scan applied 2", len(res["applied"]) == 2, str(res))
        check("scan unmatched 1", len(res["unmatched"]) == 1, str(res))
        check("scan no errors", not res["errors"], str(res["errors"]))

        claims = load_claims(tmp)
        h1, h2 = claim_hash_of(c1), claim_hash_of(c2)
        check("xss claim ACCEPTED", claims[h1]["state"] == ACCEPTED)
        check("sqli claim REJECTED", claims[h2]["state"] == REJECTED)

        # 7. post-terminal gates
        ok, reason = pre_claim_gate(c1, tmp, "xss_r")
        check("re-file accepted BLOCKED-B",
              (not ok) and reason.startswith("BLOCKED-B"), reason)
        ok, reason = pre_claim_gate(c2, tmp, "sqli")
        check("re-file rejected BLOCKED-C",
              (not ok) and reason.startswith("BLOCKED-C"), reason)
        c2b = _tclaim("SQLi in /sqli", "sqli", "sqli")
        c2b["action"]["evidence"] = "new"
        ok, reason = pre_claim_gate(c2b, tmp, "sqli")
        check("re-file rejected module+class BLOCKED-F",
              (not ok) and reason.startswith("BLOCKED-F"), reason)

        # 8. dead-end fold with reason
        mem = _load_memory(tmp)
        check("rejected module in dead_ends", "sqli" in mem.get("dead_ends", []))
        check("dead_end_reasons has verifier source",
              mem.get("dead_end_reasons", {}).get("sqli", {})
              .get("source") == "verifier")
        by_ch = {f.get("claim_hash"): f.get("status")
                 for f in mem.get("findings", [])}
        check("rejected finding marked verifier-rejected",
              by_ch.get(h2) == "verifier-rejected", str(by_ch))
        check("accepted finding marked verifier-accepted",
              by_ch.get(h1) == "verifier-accepted", str(by_ch))

        # 9. idempotent re-scan
        res2 = scan_terminal_validation(ev_path, tmp)
        check("re-scan idempotent (0 applied)", len(res2["applied"]) == 0,
              str(res2))

        # 10. corrupt claims.json fails closed
        with open(_claims_path(tmp), "w", encoding="utf-8") as f:
            f.write("{corrupt")
        try:
            pre_claim_gate(c2, tmp, "sqli")
            check("corrupt claims.json fails closed", False,
                  "gate decided on corrupt state")
        except GateError:
            check("corrupt claims.json fails closed", True)

        # 11. ambiguity: two filed claims, same normalized title
        tmp2 = tempfile.mkdtemp(prefix="claims-test2-")
        ca = _tclaim("Dup Title", "xss_r", "xss_r")
        cb = _tclaim("dup   title", "sqli", "sqli")  # normalizes equal
        record_filed(tmp2, ca, "xss_r", 1)
        record_filed(tmp2, cb, "sqli", 2)
        ev2 = os.path.join(tmp2, "events.jsonl")
        with open(ev2, "w", encoding="utf-8") as f:
            f.write('{"type":"validation","verdict":"accepted",'
                    '"plan":"Claim: Dup Title","cachedAt":"t"}\n')
        res3 = scan_terminal_validation(ev2, tmp2)
        check("ambiguous title skipped, logged",
              len(res3["applied"]) == 0 and len(res3["ambiguous"]) == 1,
              str(res3))
        shutil.rmtree(tmp2, ignore_errors=True)

        # 12. Rule #43: pipeline verdict vocabulary + verifier fields
        tmp3 = tempfile.mkdtemp(prefix="claims-test3-")
        cv = _tclaim("Pipe Vuln A", "xss_r", "xss_r")
        rec_v = record_filed(tmp3, cv, "xss_r", 1)
        check("record_filed persists verifier fields",
              rec_v.get("command") == "cmd" and
              rec_v.get("evidence") == "ev" and
              rec_v.get("counterevidence") == "ce" and
              rec_v.get("confidence") == "high",
              str({k: rec_v.get(k)
                   for k in ("command", "evidence",
                             "counterevidence", "confidence")}))
        cg = _tclaim("Pipe Vuln B", "sqli", "sqli")
        record_filed(tmp3, cg, "sqli", 2)
        cn = _tclaim("Pipe Vuln C", "exec", "exec")
        record_filed(tmp3, cn, "exec", 3)
        ce = _tclaim("Pipe Vuln D", "fi", "fi")
        record_filed(tmp3, ce, "fi", 4)
        ev3 = os.path.join(tmp3, "events.jsonl")
        with open(ev3, "w", encoding="utf-8") as f:
            f.write('{"type":"validation","verdict":"verified",'
                    '"plan":"Claim: Pipe Vuln A",'
                    '"detail":"re-run reproduced","cachedAt":"t1"}\n')
            f.write('{"type":"validation","verdict":"gate-rejected",'
                    '"plan":"Claim: Pipe Vuln B","detail":"evidence gate",'
                    '"cachedAt":"t2"}\n')
            f.write('{"type":"validation","verdict":"not-interesting",'
                    '"plan":"Claim: Pipe Vuln C","detail":"no signal",'
                    '"cachedAt":"t3"}\n')
            f.write('{"type":"validation","verdict":"execution-failed",'
                    '"plan":"Claim: Pipe Vuln D","detail":"exit 1",'
                    '"cachedAt":"t4"}\n')
        res4 = scan_terminal_validation(ev3, tmp3)
        cl3 = load_claims(tmp3)
        ha, hb, hc, hd = (claim_hash_of(x) for x in (cv, cg, cn, ce))
        check("pipeline 'verified' -> accepted",
              cl3[ha]["state"] == ACCEPTED and
              cl3[ha]["terminal"]["pipeline_verdict"] == "verified",
              str(cl3[ha].get("terminal")))
        check("pipeline 'gate-rejected' -> rejected",
              cl3[hb]["state"] == REJECTED,
              str(cl3[hb].get("state")))
        check("pipeline 'not-interesting' -> rejected",
              cl3[hc]["state"] == REJECTED,
              str(cl3[hc].get("state")))
        check("rejected dead-end carries pipeline reason",
              "gate-rejected" in _load_memory(tmp3)
              .get("dead_end_reasons", {}).get("sqli", {})
              .get("reason", ""),
              str(_load_memory(tmp3).get("dead_end_reasons")))
        check("pipeline 'execution-failed' stays FILED (non-terminal)",
              cl3[hd]["state"] == FILED,
              str(cl3[hd].get("state")))
        check("scan applied 3 (execution-failed not applied)",
              len(res4["applied"]) == 3, str(res4))
        # old-format records (no verifier fields) still load — the
        # bridge skips them fail-closed, the store never breaks
        old = dict(cl3[hd])
        for k in ("command", "evidence", "counterevidence", "confidence"):
            old.pop(k, None)
        check("old-format record loads without verifier fields",
              isinstance(old.get("title"), str))
        shutil.rmtree(tmp3, ignore_errors=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    print(f"\nself-test: {12 - len(fails)}/12 groups passed"
          if not fails else f"\nself-test FAILED: {fails}")
    return 1 if fails else 0


def main():
    p = argparse.ArgumentParser(description="Brain Claims v1 — claim state machine")
    p.add_argument("--mem-dir", required=True)
    p.add_argument("--cmd", choices=["gate", "file", "scan", "status"],
                   default="status")
    p.add_argument("--module", default="")
    p.add_argument("--turn", type=int, default=0)
    p.add_argument("--claim-json", default="",
                   help="path to claim JSON file ('-' for stdin)")
    p.add_argument("--events", default="", help="hunt events.jsonl for scan")
    p.add_argument("--self-test", action="store_true")
    args = p.parse_args()

    if args.self_test:
        sys.exit(self_test())

    if args.cmd in ("gate", "file"):
        if not args.claim_json:
            print(json.dumps({"ok": False,
                              "error": "--claim-json required"}))
            sys.exit(2)
        raw = (sys.stdin.read() if args.claim_json == "-"
               else open(args.claim_json, encoding="utf-8").read())
        claim = json.loads(raw)
        if args.cmd == "gate":
            try:
                ok, reason = pre_claim_gate(claim, args.mem_dir, args.module)
            except GateError as e:
                print(json.dumps({"ok": False, "gate": "ERROR",
                                  "reason": str(e)}))
                sys.exit(2)
            print(json.dumps({"ok": ok, "gate": "PASS" if ok else "BLOCKED",
                              "reason": reason}))
            sys.exit(0 if ok else 1)
        # file
        try:
            rec = record_filed(args.mem_dir, claim, args.module, args.turn)
        except GateError as e:
            msg = str(e)
            if msg.startswith("BLOCKED-"):
                n = record_block(args.mem_dir, claim, args.module, msg)
                print(json.dumps({"filed": False, "blocked": True,
                                  "reason": msg,
                                  "claim_blocks_total": n}))
                sys.exit(1)
            print(json.dumps({"filed": False, "blocked": False,
                              "error": msg}))
            sys.exit(2)
        print(json.dumps({"filed": True, "claim_hash": claim_hash_of(claim),
                          "state": rec["state"]}))
        sys.exit(0)

    if args.cmd == "scan":
        if not args.events:
            print(json.dumps({"error": "--events required for scan"}))
            sys.exit(2)
        res = scan_terminal_validation(args.events, args.mem_dir)
        print(json.dumps(res, indent=2))
        sys.exit(0 if not res["errors"] else 2)

    print(json.dumps(status(args.mem_dir), indent=2))


if __name__ == "__main__":
    main()
