#!/usr/bin/env python3
"""
brain-flipcheck-v1.py — RULE #51: THE OWNER FLIP CHECKLIST AS CODE.

The flip decision (BRAIN_PROVIDER default -> the one loop) is the owner's,
but the EVIDENCE for it must be machine-checkable, not vibes. This module
evaluates a one-loop session's artifacts + rehearsal evidence against the
8-item flip checklist and returns a fail-closed verdict: READY or NOT-READY
with reasons. It never claims READY on missing evidence.

Inputs:
  --memdir PATH          one-loop session memdir (claims.json, turns.log,
                         state.json, process.json, titles.json, output/)
  --rehearsal-json PATH  optional rehearsal results JSON (Rule #48 shape:
                         claims{hash:{state,module,severity}}, validations[],
                         bridge_log[], aiOk, failKind, turnsRun)
  --advisory-marker PATH optional file to grep for the Rule #50 bound marker
  --advisory-string STR   marker string (default OLLAMA_ADVISORY_TIMEOUT_MS)
  --deploy-note STR       recorded deployment evidence (free text, surfaced)
  --out PATH             optional path to write the checklist JSON

Checklist (each PASS/FAIL + evidence string):
  S1 all_claims_accepted     every claim state == 'accepted' (real pipeline)
  S2 no_filed_leftovers      no claim stuck in 'filed' (non-terminal)
  S3 validations_terminal    every validation verdict terminal, count == claims
  S4 no_half_turns           every turn line ok, count matches state.json turn
  S5 zero_llm_zero_cost      llm_calls == 0 and spend_usd == 0.0 (fail-closed)
  S6 evidence_hash_every_claim  Rule #37: every claim carries evidence_hash
  S7 rule20_invariants       outputs saved by hash + titles/process present
  S8 verifier_advisory_bounded Rule #50: bound marker present in code

Overall READY iff all 8 PASS. Missing/unreadable memdir -> exit 2,
NOT-READY, fail_closed=true. $0, localhost-only, read-only.
"""
import argparse, json, os, re, sys

TERMINAL_VERDICTS = {"verified", "accepted", "rejected",
                     "gate-rejected", "not-interesting"}

def item(name, passed, evidence):
    return {"name": name, "result": "PASS" if passed else "FAIL",
            "evidence": evidence}

def fail_closed(reason):
    out = {"overall": "NOT-READY", "fail_closed": True, "reason": reason,
           "items": []}
    print(json.dumps(out, indent=2))
    return 2

def load_json(path):
    with open(path) as f:
        return json.load(f)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--memdir", required=True)
    ap.add_argument("--rehearsal-json", default=None)
    ap.add_argument("--advisory-marker", default=None)
    ap.add_argument("--advisory-string",
                    default="OLLAMA_ADVISORY_TIMEOUT_MS")
    ap.add_argument("--deploy-note", default="")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    md = a.memdir
    if not os.path.isdir(md):
        return fail_closed("memdir missing or not a directory: %s" % md)

    # --- claims.json (Rule #21 state machine shape) ---
    try:
        claims = load_json(os.path.join(md, "claims.json"))
    except Exception as e:
        return fail_closed("claims.json unreadable: %s" % e)
    if not isinstance(claims, dict) or not claims:
        return fail_closed("claims.json empty or wrong shape")

    states = [c.get("state", "<none>") for c in claims.values()]
    n = len(claims)
    items = []

    # S1: all claims pipeline-accepted
    ok1 = all(s == "accepted" for s in states)
    items.append(item("all_claims_accepted", ok1,
        "%d/%d claims state=accepted" % (sum(s == "accepted" for s in states), n)))

    # S2: no filed leftovers (filed is non-terminal)
    n_filed = sum(s == "filed" for s in states)
    items.append(item("no_filed_leftovers", n_filed == 0,
        "%d claims still in 'filed' (non-terminal)" % n_filed))

    # S3: validations terminal — from rehearsal evidence if provided
    if a.rehearsal_json:
        try:
            rh = load_json(a.rehearsal_json)
        except Exception as e:
            return fail_closed("rehearsal-json unreadable: %s" % e)
        vals = rh.get("validations", [])
        ok3 = (len(vals) == n and
               all(str(v.get("verdict", "")).lower() in TERMINAL_VERDICTS
                   for v in vals))
        items.append(item("validations_terminal", ok3,
            "%d validations for %d claims; terminal=%s" %
            (len(vals), n, all(str(v.get("verdict", "")).lower() in
                               TERMINAL_VERDICTS for v in vals))))
    else:
        items.append(item("validations_terminal", False,
            "no rehearsal evidence provided (fail-closed)"))

    # S4: no half-turns — turns.log lines all ok, count == state.json turn
    tpath = os.path.join(md, "turns.log")
    try:
        lines = [l for l in open(tpath).read().splitlines() if l.strip()]
        parsed = [json.loads(l) for l in lines]
        bad = [p for p in parsed
               if p.get("ok") is False or "error" in p or "traceback" in str(p)]
        st = load_json(os.path.join(md, "state.json"))
        expect = st.get("turn")
        ok4 = (not bad) and (expect is None or len(parsed) == expect)
        items.append(item("no_half_turns", ok4,
            "%d turn lines, %d bad; state.turn=%s" % (len(parsed), len(bad), expect)))
    except Exception as e:
        items.append(item("no_half_turns", False,
            "turns.log/state.json unreadable: %s (fail-closed)" % e))

    # S5: zero LLM, zero cost — fail-closed on missing evidence
    try:
        st = st if "st" in dir() else load_json(os.path.join(md, "state.json"))
        llm = st.get("llm_calls", "MISSING")
        spend = st.get("spend_usd", "MISSING")
        ok5 = (llm == 0 and spend == 0.0)
        items.append(item("zero_llm_zero_cost", ok5,
            "llm_calls=%s spend_usd=%s" % (llm, spend)))
    except Exception as e:
        items.append(item("zero_llm_zero_cost", False,
            "no spend evidence: %s (fail-closed)" % e))

    # S6: Rule #37 — evidence_hash on every claim
    nohash = [h for h, c in claims.items() if not c.get("evidence_hash")]
    items.append(item("evidence_hash_every_claim", not nohash,
        "%d/%d claims carry evidence_hash" % (n - len(nohash), n)))

    # S7: Rule #20 invariants — outputs by hash + titles + process present
    outdir = os.path.join(md, "output")
    outs = []
    if os.path.isdir(outdir):
        outs = [f for f in os.listdir(outdir)
                if re.fullmatch(r"[0-9a-f]{64}(\..*)?", f)]
    titles_ok = os.path.isfile(os.path.join(md, "titles.json"))
    proc_ok = os.path.isfile(os.path.join(md, "process.json"))
    ok7 = bool(outs) and titles_ok and proc_ok
    items.append(item("rule20_invariants", ok7,
        "hash-named outputs=%d titles.json=%s process.json=%s" %
        (len(outs), titles_ok, proc_ok)))

    # S8: Rule #50 — advisory bound marker present in code
    if a.advisory_marker:
        try:
            body = open(a.advisory_marker, errors="replace").read()
            ok8 = a.advisory_string in body
            ev8 = "marker '%s' %s in %s" % (a.advisory_string,
                "PRESENT" if ok8 else "ABSENT", a.advisory_marker)
        except Exception as e:
            ok8, ev8 = False, "marker file unreadable: %s (fail-closed)" % e
    else:
        ok8, ev8 = False, "no advisory-marker file provided (fail-closed)"
    items.append(item("verifier_advisory_bounded", ok8, ev8))

    ready = all(i["result"] == "PASS" for i in items)
    out = {"overall": "READY" if ready else "NOT-READY",
           "fail_closed": False,
           "passed": sum(i["result"] == "PASS" for i in items),
           "total": len(items),
           "items": items,
           "deploy_note": a.deploy_note,
           "decision_note": ("Flip decision stays with the owner. "
                             "This checklist is evidence only — no auto-flip.")}
    if a.out:
        json.dump(out, open(a.out, "w"), indent=2)
    print(json.dumps(out, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
