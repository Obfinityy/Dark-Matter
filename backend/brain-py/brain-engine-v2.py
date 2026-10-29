#!/usr/bin/env python3
"""
Brain Engine v2 — Rule-Based Autonomous Bug Bounty Hunter
Built 29 Oct 2026. NO Meta API. NO local LLM. Pure deterministic expert system.

v2 changes (vs v1 which emitted only `note` actions):
- Each turn emits a REAL `shell` action whose command runs the module's
  verified probe INLINE via heredoc (no file persistence needed — hunt
  containers lose /opt/hunt scripts on respawn, so probes travel with the
  command). All 11 probes are self-contained: login + security=low +
  exploit + verification, ending in an exact `VERDICT: CONFIRMED` /
  `VERDICT: FAILED` last line (playbook rule #3, enforced by fixes
  applied 29 Oct ~18:55 IST to cmdi/lfi/brute/domx/bsqli/sxss probes).
- On VERDICT: CONFIRMED, emits a `claim_finding` action through the
  verifier JSON lane carrying action.title + class + command + evidence
  + counterevidence + confidence (Turn-21 validator rule + deployed
  claimGateCheck minimums).
- validate_*() rejects malformed JSON before it ever reaches the console.
- decide_next_module() skips dead ends and anything already in hunt
  memory, so the brain NEVER repeats work (A-to-Z memory rule).

v2.1 (29 Oct ~19:35 IST) — DUAL-KEY CONTRACT. The 19:25 run verified
only the BACKEND half of the contract and missed the CONSOLE half:
- CONSOLE (paste path the parent actually uses — gm()/pm()/fm() in the
  DEPLOYED bundle index-uiXAEDmf.js, extracted + replicated 19:35 IST):
  gm() REQUIRES action.type ("action.type is required." — the paste is
  rejected otherwise). Accepted types: shell, browser_open, click, type
  (aliases -> browser_click/browser_type), recall, claim_finding + the 17
  OS-control kinds. Claims additionally require action.title,
  action.command, action.evidence, action.counterevidence, action.severity
  in {critical,high,medium,low} (case-insensitive), action.confidence in
  {high,medium,low}. Top level: task/goal/progress non-empty strings;
  optional recall {hash}|{id} (+ reason <= 300 chars). gm() passes the
  action object through untouched ({...b}), so extra keys survive.
- BACKEND (humanLoop.js:4263, verified live on EC2): dispatches on
  `String(action.action).toLowerCase()`. A paste carrying ONLY type
  (like the console's own placeholder example!) computes kind
  "undefined" -> "Unknown action" — nothing executes.
=> The engine emits BOTH "type" and "action" on every turn. Console
accepts the paste, backend dispatches it. Either key alone fails one
of the two gates. (Console placeholder friction: the deployed
BrainConsole.jsx placeholder shows {"type": "shell"} WITHOUT
"action" — fixed in source 29 Oct 19:35 IST, deploy pending.)

DEPLOYED BACKEND CONTRACT (verified live 29 Oct ~19:25 IST against
/opt/Dark-Matter on EC2 + the deployed console bundle index-uiXAEDmf.js
on hack.thebhavesh.online — brainMode.js):
- humanLoop.js: `const kind = String(action.action).toLowerCase();`
  THE BACKEND KIND KEY IS `action.action`. A turn shaped
  {"action": {"type": "shell"}} computes kind "undefined" and is
  REJECTED ("Unknown action") — nothing executes. Fixed 29 Oct 19:25 IST:
  the engine now emits "action": {"action": "shell"|"claim_finding"}.
- v2.1 adds the missing "type" key (console gm() requirement) — dual-key.
- claim_finding lane reads action.title (default 'Untitled claim'),
  action.evidence, action.command (falls back to the last shell command —
  the engine always sends its own full probe command, which is exactly
  what the verifier re-runs).
- claimGateCheck (completeness, before the verifier ever sees the claim):
  title non-empty; class non-empty (normaliseCoverageClass lowercases/
  slugs any non-empty value, else claimClassFromTitle matches the title);
  command >= 8 chars; evidence >= 30 chars of real output (not a summary);
  counterevidence >= 10 chars (control/baseline beside the trigger, or the
  strongest false-positive explanation + what ruled it out);
  confidence in {high, medium, low} (+ confidence_rationale when not high).
  validate_claim_json() enforces every one of these locally.
- Valid console action kinds (deployed brainMode.js): shell,
  browser_open, browser_click, browser_type (+ short aliases click/type),
  recall, claim_finding, browser_snapshot, screenshot, desktop_snapshot,
  desktop_click, desktop_key, desktop_click_at, desktop_click_control,
  list_controls, desktop_screenshot, see_screen, desktop_terminal,
  launch_tool, download_tool, proxy_start, intercept_list, intercept_read,
  intercept_replay.

Usage (dry-run — no submission, no hunting, no Meta):
  python3 brain-engine-v2.py --dry-run
  python3 brain-engine-v2.py --dry-run --memory-json '["vulnerabilities/xss_r/"]'

Live submission is intentionally NOT wired in this build: the engine
only ever generates Brain Console JSON payloads. A human (or an
approved submitter) pastes them into the console. The API gate stays
closed until the owner releases it.
"""

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROBE_DIR = os.path.join(HERE, "brain-probes")

# ----------------------------------------------------------------------------
# Module table: DVWA attack order (easiest first), severities cross-checked
# against the 11 genuine verified findings of h_830317bdc184 (29 Oct 2026).
# brute_force severity corrected v1->v2: HIGH was wrong, finding #7 is
# CRITICAL (verified 29 Oct ~02:22 IST, Turn 14).
# ----------------------------------------------------------------------------
MODULES = [
    # module_path, probe_file, runner, marker, vuln_class, severity, claim_title
    ("vulnerabilities/xss_r/", "probe_xss_r.py", "python3",
     "PBRN7719", "xss", "HIGH",
     "Reflected XSS in /vulnerabilities/xss_r/"),
    ("vulnerabilities/exec/", "parent_brain_cmdi.py", "python3",
     "CMDI7719", "cmdi", "CRITICAL",
     "Command Injection in /vulnerabilities/exec/"),
    ("vulnerabilities/fi/", "parent_brain_lfi.py", "python3",
     None, "lfi", "HIGH",
     "File Inclusion in /vulnerabilities/fi/"),
    ("vulnerabilities/xss_s/", "parent_brain_sxss.py", "python3",
     "SXSS7719-9F3C7A1B", "xss", "HIGH",
     "Stored XSS in /vulnerabilities/xss_s/"),
    ("vulnerabilities/sqli/", "probe_sqli.py", "python3",
     "SQLI7719-7B2E4C9A", "sqli", "CRITICAL",
     "SQL Injection (UNION) in /vulnerabilities/sqli/"),
    ("vulnerabilities/sqli_blind/", "parent_brain_bsqli.sh", "bash",
     None, "sqli", "CRITICAL",
     "Blind SQL Injection in /vulnerabilities/sqli_blind/"),
    ("vulnerabilities/brute/", "parent_brain_brute.sh", "bash",
     None, "brute", "CRITICAL",
     "Brute Force in /vulnerabilities/brute/"),
    ("vulnerabilities/xss_d/", "parent_brain_domx.sh", "bash",
     "DOMX7719-7F3A9B2C", "xss", "HIGH",
     "DOM XSS in /vulnerabilities/xss_d/"),
    ("vulnerabilities/javascript/", "probe_javascript.py", "python3",
     None, "javascript", "MEDIUM",
     "JavaScript token logic flaw in /vulnerabilities/javascript/"),
    ("vulnerabilities/csp/", "probe_csp.py", "python3",
     "CSP18-4D8A2F6E", "csp", "MEDIUM",
     "CSP Bypass in /vulnerabilities/csp/"),
    ("vulnerabilities/csrf/", "probe_csrf.sh", "bash",
     "CSRF22-PROOF-9A", "CSRF", "HIGH",
     "CSRF in /vulnerabilities/csrf/"),
]

# Dead ends — NEVER probe these (verifier rejected or exhausted, 29 Oct).
DEAD_ENDS = {
    "vulnerabilities/upload/",      # rejected 2x (Turn 11, Turn 23 .pht)
    "vulnerabilities/weak_id/",     # rejected 2x (Turn 16, Turn 21)
    "vulnerabilities/captcha/",     # dead on all angles
    "vulnerabilities/open_redirect/",  # 404
    "vulnerabilities/authbypass/",     # 404
}

VERDICT_RE = re.compile(r"^VERDICT:\s*(CONFIRMED|FAILED)\s*$", re.MULTILINE)

# Recon short-keys (brain-recon-v1.py modules_mapped) -> engine module paths.
# The recon layer seeds the turn order; the engine validates keys here so a
# stale/foreign recon file can never inject an unknown module into the loop.
RECON_KEYS = {
    "brute":      "vulnerabilities/brute/",
    "bsqli":      "vulnerabilities/sqli_blind/",
    "cmdi":       "vulnerabilities/exec/",
    "csp":        "vulnerabilities/csp/",
    "csrf":       "vulnerabilities/csrf/",
    "domx":       "vulnerabilities/xss_d/",
    "javascript": "vulnerabilities/javascript/",
    "lfi":        "vulnerabilities/fi/",
    "sqli":       "vulnerabilities/sqli/",
    "sxss":       "vulnerabilities/xss_s/",
    "xss_r":      "vulnerabilities/xss_r/",
}

HEREDOC_TAG = "PROBEEOF"


def load_probe_source(filename):
    """Read a probe file's source so it can be inlined via heredoc."""
    path = os.path.join(PROBE_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def build_shell_command(runner, source, marker):
    """
    Wrap a probe source in a single self-contained shell command.
    Quoted heredoc (<<'PROBEEOF') prevents local shell expansion; the
    marker travels as argv ($1 / sys.argv[1]) so verifier re-runs match.
    """
    if runner == "python3":
        head = f"python3 - {marker}" if marker else "python3 -"
    elif runner == "bash":
        head = f"bash -s {marker}" if marker else "bash -s"
    else:
        raise ValueError(f"unknown runner: {runner}")
    if HEREDOC_TAG in source:
        raise ValueError("probe source collides with heredoc tag")
    return f"{head} <<'{HEREDOC_TAG}'\n{source.rstrip()}\n{HEREDOC_TAG}"


def build_probe_json(turn, total, spec):
    """One Brain Console JSON per turn: a real shell action, not a note."""
    module, probe_file, runner, marker, vuln_class, severity, title = spec
    source = load_probe_source(probe_file)
    command = build_shell_command(runner, source, marker)
    return {
        "task": f"Probe {module} for {vuln_class}",
        "goal": f"Verify {title}",
        "progress": f"Testing module {turn}/{total} — {module}",
        "action": {
            # DUAL-KEY CONTRACT (fixed 29 Oct ~19:35 IST — the 19:25 run
            # verified only the BACKEND half):
            # - Brain Console paste validator (gm() in the deployed bundle
            #   index-uiXAEDmf.js) REQUIRES action.type
            #   ("action.type is required.", else the paste is rejected).
            # - Backend dispatcher (humanLoop.js:4263) reads action.action
            #   (`String(action.action).toLowerCase()`); a paste carrying
            #   only type computes kind "undefined" -> "Unknown action".
            # Emit BOTH keys so the JSON survives the console AND the
            # backend. The console passes action through untouched
            # (gm spreads ...b), so action.action reaches the backend.
            "type": "shell",
            "action": "shell",
            "command": command,
        },
    }


def build_claim_json(spec, probe_command, evidence_lines, counterevidence):
    """
    Verifier JSON lane claim. Turn-21 validator rule: claims MUST carry
    action.title explicitly. Filed only on VERDICT: CONFIRMED.
    """
    module, probe_file, runner, marker, vuln_class, severity, title = spec
    return {
        "task": f"File verified finding: {title}",
        "goal": f"Report {vuln_class} in {module} with reproducible proof",
        "progress": "Probe VERDICT: CONFIRMED — filing claim with full evidence",
        "action": {
            # DUAL-KEY CONTRACT (see build_probe_json): the console's gm()
            # requires action.type="claim_finding" (else "action.type is
            # required."), the backend dispatches on action.action.
            "type": "claim_finding",
            "action": "claim_finding",
            "title": title,
            "class": vuln_class,
            "severity": severity,  # engine metadata; the verifier assigns severity
            "command": probe_command,
            "evidence": "\n".join(evidence_lines),
            "counterevidence": counterevidence,
            "confidence": "high",
        },
    }


def parse_verdict(output):
    """Return 'CONFIRMED', 'FAILED', or None from a probe's stdout."""
    matches = VERDICT_RE.findall(output or "")
    return matches[-1] if matches else None


def validate_probe_json(payload):
    """Reject malformed probe JSON before it reaches the console."""
    errors = []
    for key in ("task", "goal", "progress", "action"):
        if not payload.get(key):
            errors.append(f"missing/empty top-level key: {key}")
    action = payload.get("action") or {}
    # DUAL-KEY CONTRACT: console gm() requires action.type, backend
    # humanLoop.js requires action.action. Both must be present.
    if action.get("type") != "shell":
        errors.append("action.type must be 'shell' "
                      "(Brain Console gm() rejects the paste without it: "
                      "'action.type is required.')")
    if action.get("action") != "shell":
        errors.append("action.action must be 'shell' "
                      "(deployed backend reads action.action, not action.type)")
    cmd = action.get("command", "")
    if not cmd or len(cmd) < 50:
        errors.append("action.command empty or suspiciously short")
    if f"<<'{HEREDOC_TAG}'" not in cmd:
        errors.append("action.command must use the quoted heredoc wrapper")
    if "VERDICT" not in cmd:
        errors.append("embedded probe has no VERDICT emission")
    return errors


def validate_claim_json(payload):
    """
    Enforce the Turn-21 validator rules AND the deployed claimGateCheck
    completeness gate (humanLoop.js): the exact minimums the backend
    demands before the verifier ever sees a claim.
    """
    errors = []
    for key in ("task", "goal", "progress", "action"):
        if not payload.get(key):
            errors.append(f"missing/empty top-level key: {key}")
    action = payload.get("action") or {}
    # DUAL-KEY CONTRACT: console gm() requires action.type, backend
    # humanLoop.js requires action.action. Both must be present.
    if action.get("type") != "claim_finding":
        errors.append("action.type must be 'claim_finding' "
                      "(Brain Console gm() rejects the paste without it: "
                      "'action.type is required.')")
    if action.get("action") != "claim_finding":
        errors.append("action.action must be 'claim_finding' "
                      "(deployed backend reads action.action, not action.type)")
    if not str(action.get("title", "")).strip():
        errors.append("missing/empty action.title (gate: one line naming the vuln)")
    # normaliseCoverageClass() never blanks a non-empty class, and
    # claimClassFromTitle() falls back to the title — non-empty suffices.
    if not str(action.get("class", "")).strip():
        errors.append("missing/empty action.class (gate: vuln class)")
    if len(str(action.get("command", "")).strip()) < 8:
        errors.append("action.command < 8 chars (gate: the exact reproducing command)")
    if len(str(action.get("evidence", "")).strip()) < 30:
        errors.append("action.evidence < 30 chars "
                      "(gate: real output excerpt, not a summary)")
    if len(str(action.get("counterevidence", "")).strip()) < 10:
        errors.append("action.counterevidence < 10 chars "
                      "(gate: control/baseline beside the trigger)")
    conf = str(action.get("confidence", "")).strip().lower()
    if conf not in ("high", "medium", "low"):
        errors.append("action.confidence must be high|medium|low")
    elif conf != "high" and not str(action.get("confidence_rationale", "")).strip():
        errors.append("action.confidence_rationale required when confidence is not high")
    return errors


def decide_next_module(memory_modules, extra_dead_ends=None, priority_order=None):
    """
    Pick the next untested module. memory_modules = list of module paths
    already tried (from the hunt's A-to-Z memory). Dead ends are skipped
    even if never tried — they are settled, never re-claimed.
    extra_dead_ends: per-hunt verifier-rejected modules recorded in the
    loop's memory.json (verifier feedback). Unioned with the static
    DEAD_ENDS set. Lets a rejected claim become a dead end WITH REASON
    without a code change — the brain never re-files a rejected claim.
    priority_order: optional list of module paths from brain-recon-v1
    (attack-surface recon). Recon-mapped modules go first, in recon order;
    every other known module still follows in static order, so a recon
    miss can never silently drop a module — coverage is always complete.
    Unknown paths are ignored (fail-closed).
    """
    tried = set(memory_modules or [])
    dead = set(DEAD_ENDS) | set(extra_dead_ends or [])
    known = {spec[0] for spec in MODULES}
    ordered = [m for m in (priority_order or []) if m in known]
    ordered += [spec[0] for spec in MODULES if spec[0] not in set(ordered)]
    path_to_spec = {spec[0]: spec for spec in MODULES}
    for module in ordered:
        if module in tried or module in dead:
            continue
        return path_to_spec[module]
    return None  # exhausted


def main():
    p = argparse.ArgumentParser(description="Brain Engine v2 (dry-run)")
    p.add_argument("--dry-run", action="store_true",
                   help="Generate and validate JSONs, print them, submit nothing")
    p.add_argument("--memory-json", default="[]",
                   help="JSON list of already-tried module paths (hunt memory)")
    args = p.parse_args()

    if not args.dry_run:
        print("Live submission is not wired in this build. Use --dry-run.",
              file=sys.stderr)
        sys.exit(2)

    try:
        memory = json.loads(args.memory_json)
    except json.JSONDecodeError as e:
        print(f"bad --memory-json: {e}", file=sys.stderr)
        sys.exit(2)

    total = len(MODULES)
    turn = 0
    verdict_fixtures = {
        # Faithful probe-stdout excerpts (taken from the real mock-lab run
        # 29 Oct ~19:18 IST, mem-recon/output/) -> exercises parse_verdict
        # + claim path with evidence the deployed gate (>=30 chars) accepts.
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

    tried = list(memory)
    all_ok = True
    while True:
        spec = decide_next_module(tried)
        if spec is None:
            break
        turn += 1
        module, probe_file = spec[0], spec[1]

        probe_json = build_probe_json(turn, total, spec)
        errors = validate_probe_json(probe_json)
        status = "OK" if not errors else f"INVALID: {errors}"
        if errors:
            all_ok = False
        print(f"[turn {turn:02d}] {module} -> probe JSON {status} "
              f"(cmd {len(probe_json['action']['command'])} chars)")

        # Verdict pipeline test: parse fixture stdout, build claim if confirmed
        verdict = parse_verdict(verdict_fixtures.get(probe_file, ""))
        if verdict == "CONFIRMED":
            claim = build_claim_json(
                spec,
                probe_command=probe_json["action"]["command"],
                evidence_lines=[l for l in verdict_fixtures[probe_file].splitlines()
                                if l and not l.startswith("VERDICT")],
                counterevidence="Control run without injection shows no marker/uid — "
                                "effect is injection-specific.",
            )
            cerrs = validate_claim_json(claim)
            cstatus = "OK" if not cerrs else f"INVALID: {cerrs}"
            if cerrs:
                all_ok = False
            print(f"           verdict=CONFIRMED -> claim JSON {cstatus}")
        elif verdict == "FAILED":
            print("           verdict=FAILED -> no claim, module marked dead for this run")
        else:
            print("           verdict=None -> PARSER FAILURE (fixture has no clean VERDICT line)")
            all_ok = False

        tried.append(module)

    exhausted = (len(memory) + turn) == total
    print(f"\n[done] turns={turn} modules_exhausted={exhausted} all_valid={all_ok}")
    if not exhausted or not all_ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
