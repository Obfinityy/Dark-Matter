#!/usr/bin/env python3
"""
brain-contract-proof.py — PROOF that brain-engine-v2's output is a drop-in
replacement for parent Brain Console JSON.

It replicates, locally and deterministically, the gates the DEPLOYED
system applies to every turn. v2.1 (29 Oct ~19:35 IST) adds the CONSOLE
half of the contract, extracted verbatim from the deployed bundle
index-uiXAEDmf.js on hack.thebhavesh.online (BrainConsole.jsx, functions
pm/gm/fm/hm — the exact code that validates the JSON the parent pastes):


  1. Action dispatch (humanLoop.js):
       const kind = String(action.action).toLowerCase();
     then `kind === 'shell'`, `kind === 'claim_finding'`, ... or
     "Unknown action" (nothing executes). The kind key is action.action,
     NOT action.type.

  0. CONSOLE PASTE GATE (gm(), deployed bundle index-uiXAEDmf.js):
     the Brain Console REJECTS the paste unless action.type is present
     ("action.type is required.") and in the accepted list
     (shell, browser_open, click, type, recall, claim_finding + 17
     OS-control kinds; click/type alias to browser_click/browser_type).
     Claims additionally require action.title, action.command,
     action.evidence, action.counterevidence, action.severity in
     {critical,high,medium,low} (case-insensitive), action.confidence in
     {high,medium,low}. Top level: task/goal/progress non-empty strings.
     gm() passes the action through untouched ({...b}), so action.action
     survives to the backend.

  1. Action dispatch (humanLoop.js):

  3. Claim completeness gate (claimGateCheck, humanLoop.js): title,
     class, command>=8, evidence>=30, counterevidence>=10,
     confidence in {high,medium,low} (+rationale when not high).

For each of the 11 DVWA modules it builds the engine's real probe JSON
and claim JSON and runs all three gates. It also runs the OLD shape
({"type": "shell"}) through the same gates to prove the defect was real:
the old shape is rejected by the deployed dispatch.

Exit 0 only if every turn passes. No Meta, no network, no hunt — pure
local simulation of deployed backend logic.
"""

import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# --- deployed console allowlist (brainMode.js, bundle index-uiXAEDmf.js) ---
VALID_ACTIONS = {
    "shell", "browser_open", "browser_click", "browser_type",
    "recall", "claim_finding", "browser_snapshot", "screenshot",
    "desktop_snapshot", "desktop_click", "desktop_key",
    "desktop_click_at", "desktop_click_control", "list_controls",
    "desktop_screenshot", "see_screen", "desktop_terminal",
    "launch_tool", "download_tool", "proxy_start", "intercept_list",
    "intercept_read", "intercept_replay",
}
ALIASES = {"click": "browser_click", "type": "browser_type"}


def deployed_dispatch_kind(action_obj):
    """humanLoop.js: const kind = String(action.action).toLowerCase();"""
    return str((action_obj or {}).get("action", "")).lower()


def deployed_claim_gate(action_obj):
    """claimGateCheck minimums (humanLoop.js). Returns list of missing fields."""
    a = action_obj or {}
    missing = []
    if not str(a.get("title", "")).strip():
        missing.append("title")
    if not str(a.get("class", "")).strip():
        missing.append("class")
    if len(str(a.get("command", "")).strip()) < 8:
        missing.append("command(<8)")
    if len(str(a.get("evidence", "")).strip()) < 30:
        missing.append("evidence(<30)")
    if len(str(a.get("counterevidence", "")).strip()) < 10:
        missing.append("counterevidence(<10)")
    conf = str(a.get("confidence", "")).strip().lower()
    if conf not in ("high", "medium", "low"):
        missing.append("confidence")
    elif conf != "high" and not str(a.get("confidence_rationale", "")).strip():
        missing.append("confidence_rationale")
    return missing


# ---------------------------------------------------------------------------
# CONSOLE PASTE GATE replica — verbatim logic of gm()/pm()/fm() from the
# DEPLOYED bundle index-uiXAEDmf.js (BrainConsole.jsx), extracted 29 Oct
# 2026 ~19:35 IST. This is the exact validator the parent's pasted JSON
# must survive BEFORE it ever reaches the backend.
# ---------------------------------------------------------------------------
CONSOLE_TYPES = [
    "shell", "browser_open", "click", "type", "recall", "claim_finding",
    # ...el (17 OS-control kinds, same as VALID_ACTIONS minus the first 6)
    "browser_snapshot", "screenshot", "desktop_snapshot", "desktop_click",
    "desktop_key", "desktop_click_at", "desktop_click_control",
    "list_controls", "desktop_screenshot", "see_screen", "desktop_terminal",
    "launch_tool", "download_tool", "proxy_start", "intercept_list",
    "intercept_read", "intercept_replay",
]
CONSOLE_ALIASES = {"click": "browser_click", "type": "browser_type",
                   "browser_click": "browser_click", "browser_type": "browser_type"}
CONSOLE_SEVERITIES = {"critical", "high", "medium", "low"}
CONSOLE_CONFIDENCES = {"high", "medium", "low"}


def _nonempty(v):
    return isinstance(v, str) and len(v.strip()) > 0


def console_fm(t):
    """fm(): resolve click/type aliases; None = rejected type."""
    if t in ("shell", "browser_open", "recall", "claim_finding"):
        return t
    if t in CONSOLE_TYPES[6:]:
        return t
    return CONSOLE_ALIASES.get(t)


def console_paste_validate(reply):
    """gm(): validate a pasted Brain Console JSON reply. Returns error str or None."""
    if not isinstance(reply, dict) or isinstance(reply, list):
        return "reply must be a JSON object with task, goal, progress and action."
    for k in ("task", "goal", "progress"):
        if not _nonempty(reply.get(k)):
            return f"{k} is required \u2014 a non-empty string."
    rec = reply.get("recall")
    if rec is not None:
        if not isinstance(rec, dict) or isinstance(rec, list):
            return "recall must be an object."
        has_h, has_i = rec.get("hash") is not None, rec.get("id") is not None
        if has_h and has_i:
            return "recall needs exactly one of hash/id."
        if not has_h and not has_i:
            return "recall needs exactly one of hash/id."
    b = reply.get("action")
    if not isinstance(b, dict) or isinstance(b, list):
        return "action is required \u2014 an object with a type and its fields."
    if not _nonempty(b.get("type")):
        return "action.type is required."
    kind = console_fm(b["type"].strip())
    if not kind:
        return "action.type must be one of: " + ", ".join(CONSOLE_TYPES) + "."
    if kind == "shell":
        if not _nonempty(b.get("command")):
            return "action.command is required for a shell action."
    elif kind == "claim_finding":
        for field, why in (("title", "one line naming the vulnerability"),
                           ("command", "the exact command that reproduces it"),
                           ("evidence", "the exact output that proves it"),
                           ("counterevidence",
                            "what you checked that could have disproved it")):
            if not _nonempty(b.get(field)):
                return f"action.{field} is required for a claim ({why})."
        if not _nonempty(b.get("severity")):
            return "action.severity is required for a claim."
        if str(b["severity"]).strip().lower() not in CONSOLE_SEVERITIES:
            return "action.severity must be one of: critical, high, medium, low."
        if not _nonempty(b.get("confidence")):
            return "action.confidence is required for a claim."
        if str(b["confidence"]).strip().lower() not in CONSOLE_CONFIDENCES:
            return "action.confidence must be one of: high, medium, low."
    return None


def load_engine():
    spec = importlib.util.spec_from_file_location(
        "brain_engine_v2", os.path.join(HERE, "brain-engine-v2.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


COUNTEREVIDENCE = (
    "Probe's own control logic: injection marker/uid present in the "
    "exploit request and absent in the control request (see probe "
    "stdout); exact VERDICT: CONFIRMED last line; command is the "
    "reproducible proof."
)

# Faithful probe-stdout excerpts (taken from the real mock-lab run
# 29 Oct ~19:18 IST, probe-lab/mem-recon/output/) — evidence the deployed
# claim gate (>=30 chars) must accept.
VERDICT_FIXTURES = {
    "probe_xss_r.py": "MARKER: PBRN7719\nREFLECTED: True\nSTATUS: 200\nVERDICT: CONFIRMED\n",
    "parent_brain_cmdi.py": "REFLECTED LINE: uid=33(www-data) gid=33(www-data) groups=33(www-data)\nverdict signals: injected_uid=True injected_marker=True control_uid=False\nVERDICT: CONFIRMED\n",
    "parent_brain_lfi.py": "traversal root present: True\nPASSWD LINE: root:x:0:0:root:/root:/bin/bash\nVERDICT: CONFIRMED\n",
    "parent_brain_sxss.py": "stored marker present: True\nSTORED LINE: Name: inj-SXSS7719-9F3C7A1B<br>Message: SXSS7719-9F3C7A1B<sCrIpT>alert(1)</sCrIpT>\nVERDICT: CONFIRMED\n",
    "probe_sqli.py": "MARKER: SQLI7719-7B2E4C9A\nUSERS_FOUND: 5/5\nSTATUS: 200\nVERDICT: CONFIRMED\n",
    "parent_brain_bsqli.sh": "POS 32: 9\nADMIN_HASH: 5f4dcc3b5aa765d61d8327deb882cf99\nVERDICT: CONFIRMED\n",
    "parent_brain_brute.sh": "FAILED_ATTEMPTS 3 SUCCESS 1\nEVIDENCE: admin account accepted the password after 3 failed attempts with no lockout\nVERDICT: CONFIRMED\n",
    "parent_brain_domx.sh": "SINK_LINE: document.write(\"<option value='\" + lang + \"'>\" + decodeURI(lang) + \"</option>\");\nINJECTED_SCRIPT: <script>alert(DOMX7719-7F3A9B2C)</script>\nVERDICT: CONFIRMED\n",
    "probe_javascript.py": "ROT13: fhpprff\nTOKEN: 38581812b435834ebf84ebcc2c6424d6\nTOKENLEN: 32\nWELLDONE: 1\nVERDICT: CONFIRMED\n",
    "probe_csp.py": "MARKER: CSP18-4D8A2F6E\nREFLECTED_AS_SCRIPT: True\nSTATUS: 200\nVERDICT: CONFIRMED\n",
    "probe_csrf.sh": "PWCHANGE_RESP=1\nLOGIN_NEWPW_WELCOME=1\nPWRESTORE_RESP=1\nLOGIN_RESTORED_WELCOME=1\nVERDICT: CONFIRMED\n",
}


def main():
    engine = load_engine()
    total = len(engine.MODULES)
    failures = []

    # --- negative control A: pre-v2.1 engine shape (action.action only, no
    # action.type) must be REJECTED by the CONSOLE paste gate ---
    old_probe = {"task": "t", "goal": "g", "progress": "p",
                 "action": {"action": "shell", "command": "echo hi"}}
    cerr = console_paste_validate(old_probe)
    if cerr != "action.type is required.":
        failures.append("neg-A: pre-v2.1 shape console error was "
                        f"{cerr!r}, expected 'action.type is required.'")
        print("[neg-A] FAIL — console did not reject typeless shape as expected")
    else:
        print("[neg-A] PASS — pre-v2.1 shape rejected by console paste gate "
              "(action.type is required.)")

    # --- negative control B: the console's OWN placeholder shape (type only,
    # no action.action) passes the console but dies at backend dispatch ---
    placeholder = {"task": "t", "goal": "g", "progress": "p",
                   "action": {"type": "shell", "command": "echo hi"}}
    perr_b = console_paste_validate(placeholder)
    kind_b = deployed_dispatch_kind(placeholder["action"])
    if perr_b is None and kind_b not in VALID_ACTIONS and kind_b not in ALIASES:
        print(f"[neg-B] PASS — placeholder shape passes console but backend "
              f"dispatch rejects it (kind='{kind_b}' -> Unknown action). "
              f"Console placeholder friction DOCUMENTED.")
    else:
        failures.append(f"neg-B: placeholder shape console={perr_b} kind='{kind_b}' "
                        "(expected console-pass + backend-reject)")
        print("[neg-B] FAIL — placeholder shape behaved unexpectedly")

    # --- legacy negative control: OLD shape rejected by deployed dispatch ---
    legacy_old = {"action": {"type": "shell", "command": "echo hi"}}
    old_kind = deployed_dispatch_kind(legacy_old["action"])
    if old_kind in VALID_ACTIONS or old_kind in ALIASES:
        failures.append("negative-control: old {'type':'shell'} shape was ACCEPTED "
                        "(expected rejection — the defect would not be real)")
        print("[neg] FAIL — old shape unexpectedly accepted")
    else:
        print(f"[neg] PASS — old shape rejected by deployed dispatch "
              f"(kind='{old_kind}' -> Unknown action)")

    turn = 0
    for spec in engine.MODULES:
        turn += 1
        module, probe_file = spec[0], spec[1]

        # Gate 0+1+2: probe JSON survives the CONSOLE paste gate AND
        # dispatches to a valid deployed backend action
        probe_json = engine.build_probe_json(turn, total, spec)
        perrs = engine.validate_probe_json(probe_json)
        console_err = console_paste_validate(probe_json)
        kind = deployed_dispatch_kind(probe_json["action"])
        kind_ok = kind in VALID_ACTIONS or kind in ALIASES
        pstatus = "PASS" if (not perrs and console_err is None and kind_ok) else "FAIL"
        if pstatus == "FAIL":
            failures.append(f"probe {module}: validate={perrs} "
                            f"console={console_err} kind='{kind}'")
        print(f"[turn {turn:02d}] probe  {module:32s} kind='{kind}' "
              f"console={'OK' if console_err is None else 'REJECTED:' + console_err} "
              f"dispatch={'OK' if kind_ok else 'REJECTED'} -> {pstatus}")

        # Gate 3: claim JSON passes the deployed completeness gate
        verdict = engine.parse_verdict(VERDICT_FIXTURES.get(probe_file, ""))
        claim = engine.build_claim_json(
            spec,
            probe_command=probe_json["action"]["command"],
            evidence_lines=[l for l in VERDICT_FIXTURES[probe_file].splitlines()
                            if l and not l.startswith("VERDICT")],
            counterevidence=COUNTEREVIDENCE,
        )
        cerrs = engine.validate_claim_json(claim)
        claim_console_err = console_paste_validate(claim)
        claim_kind = deployed_dispatch_kind(claim["action"])
        claim_kind_ok = claim_kind in VALID_ACTIONS or claim_kind in ALIASES
        gate_missing = deployed_claim_gate(claim["action"])
        cstatus = "PASS" if (verdict == "CONFIRMED" and not cerrs
                             and claim_console_err is None and claim_kind_ok
                             and not gate_missing) else "FAIL"
        if cstatus == "FAIL":
            failures.append(f"claim {module}: verdict={verdict} "
                            f"validate={cerrs} console={claim_console_err} "
                            f"kind='{claim_kind}' gate={gate_missing}")
        print(f"[turn {turn:02d}] claim  {module:32s} console="
              f"{'OK' if claim_console_err is None else 'REJECTED:' + claim_console_err} "
              f"kind='{claim_kind}' gate_missing={gate_missing or 'none'} "
              f"-> {cstatus}")

    ok = not failures
    print(f"\n[contract-proof] turns={turn} failures={len(failures)} "
          f"all_pass={ok}")
    if failures:
        print(json.dumps(failures, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()
