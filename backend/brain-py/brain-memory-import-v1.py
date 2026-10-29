#!/usr/bin/env python3
"""
brain-memory-import-v1.py — IMPORT THE WAR RECORD (Playbook Rule #22).

The brain's per-hunt three-file memory starts EMPTY. The REAL hunt that the
parent drove (h_830317bdc184, DVWA, 29 Oct 2026) produced 11 genuine verified
findings, 9 verifier rejections, 435 not-interesting plans and 10 audited
false-positive admin-variant dupes — all recorded in events.jsonl. Without
an import the new brain would RE-DRIVE everything it already knows.

This tool converts a real hunt's events.jsonl into the brain's three-file
memory (memory.json / claims.json / process.json), loop-schema compatible:

  findings[]          <- verified:true findings (11 genuine), tried[] stamped
  audit_rejections[]  <- owner-audited false-positive dupes (never re-file)
  dead_ends[]         <- engine DEAD_ENDS + rejected-verdict module paths
  import_rejected_plans[] / import_exhausted_plans[] <- WITH REASON detail
  claims.json         <- 11x ACCEPTED + rejected REJECTED (Rule #21 gate seed)

Fail-closed: missing/corrupt events file -> exit 2; no target-profile event
-> exit 2; --target-base != source hunt target -> exit 2 (unless
--allow-target-mismatch, lab only); any verified finding that cannot be
mapped to an engine module path -> exit 2 (never silently dropped);
corrupt existing memory.json -> exit 2. Idempotent: re-import merges.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# Claim-state constants come from the state machine itself (brain-claims-v1):
# FILED="filed", ACCEPTED="accepted", REJECTED="rejected". Never hardcode.
import importlib.util as _ilu
_claims_spec = _ilu.spec_from_file_location(
    "brain_claims_v1", os.path.join(HERE, "brain-claims-v1.py"))
_claims_mod = _ilu.module_from_spec(_claims_spec)
_claims_spec.loader.exec_module(_claims_mod)
CLAIM_FILED, CLAIM_ACCEPTED, CLAIM_REJECTED = (
    _claims_mod.FILED, _claims_mod.ACCEPTED, _claims_mod.REJECTED)

# Engine contract mirror (brain-engine-v2.py MODULES): module path -> vuln class.
ENGINE_MODULES = {
    "vulnerabilities/xss_r/": "xss",
    "vulnerabilities/exec/": "cmdi",
    "vulnerabilities/fi/": "lfi",
    "vulnerabilities/xss_s/": "xss",
    "vulnerabilities/sqli/": "sqli",
    "vulnerabilities/sqli_blind/": "sqli",
    "vulnerabilities/brute/": "brute",
    "vulnerabilities/xss_d/": "xss",
    "vulnerabilities/javascript/": "javascript",
    "vulnerabilities/csp/": "csp",
    "vulnerabilities/csrf/": "CSRF",
}
ENGINE_DEAD_ENDS = sorted({
    "vulnerabilities/upload/",
    "vulnerabilities/weak_id/",
    "vulnerabilities/captcha/",
    "vulnerabilities/open_redirect/",
    "vulnerabilities/authbypass/",
})

# 29-Oct owner audit: verifier accepted these, but they are duplicates of
# parent-brain findings — audited false positives. Never re-file, never
# count as genuine. Stored under audit_rejections, claims state REJECTED.
AUDIT_DUPE_TITLES = {
    "admin panel unauthenticated disclosure",
    "admin config variant sweep",
    "encryption keys client disclosure",
    "admin application-version variant sweep",
    "admin security-config variant sweep",
}

MODPATH_RE = re.compile(r"/vulnerabilities/([a-z_]+)(?:/|(?=\s|$))")


def now_ist():
    return datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")


def sha256_hex(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def norm_title(t):
    t = (t or "").strip()
    t = re.sub(r"^PoC confirmed:\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s+", " ", t).strip().lower()
    return t


def module_path_of(title):
    m = MODPATH_RE.search(title or "")
    if not m:
        return None
    return f"vulnerabilities/{m.group(1)}/"


def atomic_write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path),
                               prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
            f.write("\n")
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def fail(msg):
    print(f"IMPORT FAILED (fail-closed): {msg}", file=sys.stderr)
    return 2


def load_events(path):
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    events = []
    bad = 0
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError:
                bad += 1
    return events, bad


def main():
    p = argparse.ArgumentParser(description="Import a real hunt's war record "
                                "into brain three-file memory.")
    p.add_argument("--events", required=True, help="hunt events.jsonl snapshot")
    p.add_argument("--mem-dir", required=True, help="brain per-hunt memory dir")
    p.add_argument("--target-base", required=True,
                   help="brain's intended target base URL")
    p.add_argument("--hunt-id", default="",
                   help="source hunt id (recorded as provenance)")
    p.add_argument("--allow-target-mismatch", action="store_true",
                   help="lab only: import even if target differs")
    args = p.parse_args()

    try:
        events, bad = load_events(args.events)
    except FileNotFoundError:
        return fail(f"events file not found: {args.events}")
    if bad:
        return fail(f"{bad} corrupt JSON lines in {args.events} — refusing "
                    f"to import a damaged war record")
    if not events:
        return fail(f"0 events parsed from {args.events} — refusing to "
                    f"seed memory from an empty record")

    # Source target = the hunt's own target-profile event (never assumed).
    source_target = None
    for e in events:
        if e.get("type") == "target-profile":
            source_target = ((e.get("profile") or {}).get("url") or "").strip()
            break
    if not source_target:
        return fail("no target-profile event in events — cannot prove the "
                    "war record's target; refusing to import")
    if source_target.rstrip("/") != args.target_base.rstrip("/"):
        if not args.allow_target_mismatch:
            return fail(f"target mismatch: war record is for {source_target} "
                        f"but brain targets {args.target_base} — refusing "
                        f"(use --allow-target-mismatch in the lab only)")
        mismatch_note = (f"LAB: target mismatch allowed "
                         f"({source_target} -> {args.target_base})")
    else:
        mismatch_note = None

    # ---- existing memory (merge, idempotent) ----
    mem_path = os.path.join(args.mem_dir, "memory.json")
    if os.path.exists(mem_path):
        try:
            with open(mem_path, "r", encoding="utf-8") as f:
                memory = json.load(f)
            if not isinstance(memory, dict):
                return fail("existing memory.json is not a JSON object")
        except (json.JSONDecodeError, OSError) as e:
            return fail(f"existing memory.json unreadable ({e}) — refusing "
                        f"to merge into a corrupt file")
        fresh = False
    else:
        memory = {"tried": [], "explore_tried": [], "findings": [],
                  "dead_ends": sorted(ENGINE_DEAD_ENDS), "claim_blocks": []}
        fresh = True
    for k in ("tried", "explore_tried", "findings", "dead_ends",
              "claim_blocks", "audit_rejections", "import_rejected_plans",
              "import_exhausted_plans", "import_unmapped"):
        memory.setdefault(k, [] if k != "dead_ends" else sorted(ENGINE_DEAD_ENDS))
    tried = set(memory["tried"])
    dead_ends = set(memory["dead_ends"])
    seen_finding_titles = {norm_title(f.get("title", "")) for f in memory["findings"]}
    seen_audit = {norm_title(a.get("title", "")) for a in memory["audit_rejections"]}
    seen_rej = {(r.get("plan_norm", ""), r.get("verdict", "")) for r in memory["import_rejected_plans"]}
    seen_exh = {r.get("plan_norm", "") for r in memory["import_exhausted_plans"]}

    # ---- claims (Rule #21 seed) ----
    claims_path = os.path.join(args.mem_dir, "claims.json")
    if os.path.exists(claims_path):
        try:
            with open(claims_path, "r", encoding="utf-8") as f:
                claims = json.load(f)
            if not isinstance(claims, dict):
                return fail("existing claims.json is not a JSON object")
        except (json.JSONDecodeError, OSError) as e:
            return fail(f"existing claims.json unreadable ({e}) — refusing")
    else:
        claims = {}

    def import_claim_hash(title_norm):
        # Synthetic but deterministic; the live gate's E/F path
        # (module+class) is what blocks re-files of imported claims.
        return sha256_hex("import-claim:" + title_norm)

    def seed_claim(title_norm, title, module, cls, state, reason):
        ch = import_claim_hash(title_norm)
        if ch in claims:
            return False  # idempotent
        claims[ch] = {
            "title": title, "module": module, "class": cls,
            "state": state, "filed_turn": "import", "filed_at_ist": now_ist(),
            "terminal": {"verdict": state, "at_ist": now_ist(), "reason": reason},
            "source": f"imported from {args.hunt_id or 'live hunt'} war record",
        }
        return True

    # ---- pass 1: findings ----
    n_findings = n_dupes = 0
    unmapped = []
    best = {}  # norm title -> event (prefer verified:true)
    for e in events:
        if e.get("type") != "finding" or not e.get("title"):
            continue
        nt = norm_title(e["title"])
        cur = best.get(nt)
        if cur is None or (e.get("verified") and not cur.get("verified")):
            best[nt] = e
    for nt, e in sorted(best.items()):
        title = e["title"]
        if nt in AUDIT_DUPE_TITLES:
            if nt not in seen_audit:
                seen_audit.add(nt)
                memory["audit_rejections"].append({
                    "title": title, "title_norm": nt,
                    "reason": "owner-audited false-positive admin-variant dupe "
                              "(29 Oct): verifier accepted it but it duplicates "
                              "a parent-brain finding — never re-file, never "
                              "count as genuine",
                    "source_event_at": e.get("cachedAt"),
                })
                seed_claim(nt, title, "", "audit-dupe", CLAIM_REJECTED,
                           "owner-audited false-positive dupe (29 Oct)")
                n_dupes += 1
            continue
        if not e.get("verified"):
            # unverified finding event: record as exhausted, never claimable
            if nt not in seen_exh:
                seen_exh.add(nt)
                memory["import_exhausted_plans"].append({
                    "plan": title, "plan_norm": nt,
                    "reason": f"finding event verified:false "
                              f"(evidenceStatus={e.get('evidenceStatus')}) — "
                              f"no terminal verification, never claim",
                    "source_event_at": e.get("cachedAt"),
                })
            continue
        mod = module_path_of(title)
        if mod is None or mod not in ENGINE_MODULES:
            unmapped.append(title)
            continue
        if nt not in seen_finding_titles:
            seen_finding_titles.add(nt)
            tried.add(mod)
            memory["findings"].append({
                "title": title, "severity": e.get("severity"),
                "class": ENGINE_MODULES[mod], "module": mod,
                "turn": "import",
                "claim_hash": import_claim_hash(nt),
                "status": "verifier-accepted (imported from live hunt "
                          f"{args.hunt_id or 'war record'} — never re-file)",
                "verification": str(e.get("verification", ""))[:200],
                "recorded_ist": now_ist(),
            })
            seed_claim(nt, title, mod, ENGINE_MODULES[mod], CLAIM_ACCEPTED,
                       "verifier accepted in live hunt; imported war record")
            n_findings += 1
    if unmapped:
        memory["import_unmapped"] = sorted(set(unmapped))
        return fail(f"{len(unmapped)} VERIFIED findings unmapped to engine "
                    f"modules (never silently dropped): {unmapped[:3]}")

    # Final state wins: a module with a verifier-ACCEPTED finding is never a
    # dead end, even if an earlier claim on it was rejected as false_positive
    # (the 29-Oct sqli/exec/xss_s/csrf first-filings were rejected, then
    # re-proven and accepted). The rejection stays in the war record WITH
    # REASON; only the dead-end flag is final-state gated.
    accepted_modules = {f.get("module") for f in memory["findings"]}

    # ---- pass 2: validation verdicts ----
    n_rej = n_exh = 0
    for e in events:
        if e.get("type") != "validation":
            continue
        plan = e.get("plan") or ""
        nt = norm_title(plan)
        verdict = e.get("verdict")
        detail = e.get("detail") or ""
        if verdict == "rejected":
            key = (nt, verdict)
            if key not in seen_rej:
                seen_rej.add(key)
                memory["import_rejected_plans"].append({
                    "plan": plan, "plan_norm": nt, "verdict": verdict,
                    "reason": f"verifier REJECTED: {detail} — dead end, "
                              f"never re-claim",
                    "source_event_at": e.get("cachedAt"),
                })
                mod = module_path_of(plan)
                if mod and mod not in accepted_modules:
                    # Final state wins: only a rejection that was NEVER
                    # overturned becomes a dead end. Overturned rejections
                    # stay in import_rejected_plans as history WITH REASON.
                    dead_ends.add(mod)
                    if mod in ENGINE_MODULES:
                        seed_claim(nt, plan, mod, ENGINE_MODULES[mod],
                                   CLAIM_REJECTED,
                                   f"verifier rejected and never re-proven: "
                                   f"{detail}")
                n_rej += 1
        elif verdict == "not-interesting":
            if nt not in seen_exh:
                seen_exh.add(nt)
                memory["import_exhausted_plans"].append({
                    "plan": plan, "plan_norm": nt,
                    "reason": f"verifier not-interesting: {detail}",
                    "source_event_at": e.get("cachedAt"),
                })
                mod = module_path_of(plan)
                if mod and mod not in ENGINE_MODULES and mod not in dead_ends:
                    dead_ends.add(mod)  # beyond-playbook module, dead
                n_exh += 1

    # Belt and braces: no accepted module is ever a dead end.
    dead_ends -= set(memory["tried"])
    memory["tried"] = sorted(tried)
    memory["dead_ends"] = sorted(dead_ends)
    memory["import_provenance"] = {
        "source_hunt": args.hunt_id or "unknown",
        "source_target": source_target,
        "brain_target": args.target_base,
        "target_mismatch_allowed": bool(args.allow_target_mismatch),
        "events_file": os.path.basename(args.events),
        "events_parsed": len(events),
        "imported_at_ist": now_ist(),
        "note": mismatch_note,
    }

    atomic_write_json(mem_path, memory)
    atomic_write_json(claims_path, claims)
    # Loop-compatible process.json (brain-loop-v1 fresh_process shape:
    # in_process/current/history) + import provenance as extra keys.
    atomic_write_json(os.path.join(args.mem_dir, "process.json"), {
        "in_process": False,
        "current": None,
        "history": [],
        "hunt_id": args.hunt_id or "import",
        "target_base": args.target_base,
        "current_task": (f"war-record import complete: {n_findings} verified "
                         f"findings, {len(tried)} modules tried, "
                         f"{n_dupes} audit dupes rejected, {n_rej} rejected "
                         f"plans, {n_exh} exhausted plans"),
        "goal": "never repeat the live hunt's work — decide() starts from "
                "the imported war record",
        "imported_at_ist": now_ist(),
    })

    print(f"IMPORT OK ({'fresh' if fresh else 'merged'}): "
          f"findings={n_findings} tried={len(tried)} "
          f"audit_dupes={n_dupes} rejected_plans={n_rej} "
          f"exhausted_plans={n_exh} dead_ends={len(dead_ends)} "
          f"claims={len(claims)} source_target={source_target}")
    if mismatch_note:
        print(mismatch_note)
    return 0


if __name__ == "__main__":
    sys.exit(main())
