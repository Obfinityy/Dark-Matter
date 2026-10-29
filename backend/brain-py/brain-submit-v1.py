#!/usr/bin/env python3
"""brain-submit-v1.py — THE SUBMITTER LANE (Track 2, owner order 29 Oct ~19:09 IST).

The missing component the owner named: an autonomous agent that works the
Brain Console API interface BY ITSELF — takes the engine's turn JSON, submits
it to the backend exactly like the console does, and reads the response.

SUBMIT CONTRACT (extracted 29 Oct ~19:44 IST from DEPLOYED code, origin/main):
  Frontend : frontend/src/lib/api.js :: submitBrainActionJson(id, reply)
             -> POST /api/v1/hunts/{id}/brain-action-json
             -> body { "reply": {...} }
             -> Authorization: Bearer <dm_token> (JWT, owner-only gate)
             -> timeout 300000 ms (5 min — probes can take minutes)
  Console  : frontend/src/components/BrainConsole.jsx :: submitJsonAction
             -> client-validates reply, then posts; on success the backend
                returns {ok, hash, output, entry}
             -> 400 names the bad field (errors[0].field)
             -> 409 = AI is the brain right now (submit refused)
  Schema   : frontend/src/lib/brainReply.schema.json
             -> reply = { task, goal, progress, action, recall? }
             -> action.type in the 23 deployed kinds; per-type required fields

PRE-SUBMIT VALIDATION (fail-closed, nothing is sent unless ALL pass):
  1. Reply schema   — task/goal/progress/action present and non-empty
  2. Console gate   — action.type required (gm()/pm()/fm() verbatim replica;
                     proven 29 Oct ~19:42 in brain-contract-proof.py)
  3. Backend dispatch — action.action must be a known kind
                     (backend humanLoop.js:4263: String(action.action).toLowerCase())
  4. Claim gate     — claim_finding needs title, class, command>=8,
                     evidence>=30, counterevidence>=10,
                     confidence in {high,medium,low}
                     (claimGateCheck minimums, mapped 29 Oct ~19:36)

MODES:
  --dry-run TURN.json --hunt-id ID
      Build + validate the full request against the deployed contract.
      Prints the request (auth redacted). NO network. This is the
      pre-flight every autonomous turn runs before it may submit.
  --probe-route --hunt-id ID [--base URL]
      Unauthenticated POST to the live route to prove (a) the endpoint
      exists on the deployed backend and (b) the owner-only auth gate
      holds. Expects 401/403. Uses NO credentials, changes NO state —
      the gate rejects before any dispatch.
  --submit TURN.json --hunt-id ID [--token T | env DM_BRAIN_TOKEN]
      REAL submit through the console's route. Needs the owner's JWT.
      The token is passed, never stored, never logged, never written.

SECURITY: the token lives only in argv/env for one call; every printed
header shows Authorization: Bearer <redacted>.
"""
import argparse
import importlib.util
import json
import os
import sys
import urllib.request
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- contract

BASE_DEFAULT = "https://api.thebhavesh.online"

# The 23 action kinds the deployed backend dispatches (backend/src/brainMode.js,
# mapped 29 Oct ~19:36 from deployed console bundle index-uiXAEDmf.js).
VALID_KINDS = {
    "shell", "browser_open", "click", "type", "recall", "claim_finding",
    "browser_snapshot", "screenshot", "desktop_snapshot", "desktop_click",
    "desktop_key", "desktop_click_at", "desktop_click_control",
    "list_controls", "desktop_screenshot", "see_screen", "desktop_terminal",
    "launch_tool", "download_tool", "proxy_start", "intercept_list",
    "intercept_read", "intercept_replay",
}

# Per-type required fields from brainReply.schema.json (origin/main).
REQUIRED_FIELDS = {
    "shell": ["command"],
    "browser_open": ["url"],
    "click": [],        # selector OR text (checked below)
    "type": ["selector", "text"],
    "recall": [],       # hash OR id (checked below)
    "claim_finding": ["title", "severity", "command", "evidence",
                      "counterevidence", "confidence"],
    "desktop_click": ["window"],
    "desktop_key": [],  # keys OR text
    "desktop_click_at": ["x", "y"],
    "desktop_click_control": ["control"],
    "launch_tool": ["tool"],
    "download_tool": ["tool"],
    "intercept_read": ["index"],
    "intercept_replay": ["index"],
}


def fail(field, message):
    return {"field": field, "message": message}


def validate_reply(reply):
    """The four pre-submit gates. Returns a list of {field, message}."""
    errors = []
    if not isinstance(reply, dict):
        return [fail("reply", "reply must be a JSON object")]
    # Gate 1 — reply schema: task/goal/progress/action required, non-empty.
    for key in ("task", "goal", "progress", "action"):
        if not reply.get(key):
            errors.append(fail(key, f"'{key}' is required and must be non-empty"))
    action = reply.get("action")
    if not isinstance(action, dict):
        return errors + [fail("action", "action must be a JSON object")]
    # Gate 2 — console paste gate replica (gm()/pm()/fm()): type is required.
    atype = action.get("type")
    if not atype or not isinstance(atype, str):
        errors.append(fail("action.type", "action.type is required."))
    elif atype not in VALID_KINDS:
        errors.append(fail("action.type", f"unknown action type '{atype}'"))
    # Gate 3 — backend dispatch replica (humanLoop.js:4263): action.action
    # must resolve to a known kind, else "Unknown action".
    aaction = action.get("action")
    if not aaction or not isinstance(aaction, str):
        errors.append(fail("action.action",
                           "action.action is required (backend dispatches on it)"))
    elif aaction.lower() not in VALID_KINDS:
        errors.append(fail("action.action",
                           f"unknown action '{aaction}' — backend would reject "
                           "as 'Unknown action'"))
    # Gate 3b — per-type required fields (schema mirror).
    for field in REQUIRED_FIELDS.get(atype, []):
        if field not in action or action[field] in (None, ""):
            errors.append(fail(f"action.{field}",
                               f"'{field}' is required for action type '{atype}'"))
    if atype == "click" and not (action.get("selector") or action.get("text")):
        errors.append(fail("action.selector",
                           "click needs 'selector' or 'text'"))
    if atype == "recall" and not (action.get("hash") or action.get("id") is not None):
        errors.append(fail("action.hash", "recall needs 'hash' or 'id'"))
    if atype == "desktop_key" and not (action.get("keys") or action.get("text")):
        errors.append(fail("action.keys", "desktop_key needs 'keys' or 'text'"))
    # Gate 4 — claim completeness gate (claimGateCheck minimums).
    if atype == "claim_finding":
        if len(str(action.get("command", ""))) < 8:
            errors.append(fail("action.command",
                               "claim command must be >= 8 chars (reproducible)"))
        if len(str(action.get("evidence", ""))) < 30:
            errors.append(fail("action.evidence",
                               "evidence must be >= 30 chars (real excerpt)"))
        if len(str(action.get("counterevidence", ""))) < 10:
            errors.append(fail("action.counterevidence",
                               "counterevidence must be >= 10 chars"))
        if action.get("confidence") not in ("high", "medium", "low"):
            errors.append(fail("action.confidence",
                               "confidence must be high|medium|low"))
    return errors


def build_request(turn, hunt_id, base=BASE_DEFAULT, token=None):
    url = f"{base}/api/v1/hunts/{hunt_id}/brain-action-json"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return url, headers, {"reply": turn}


def redacted_headers(headers):
    return {k: ("Bearer <redacted>" if k.lower() == "authorization" else v)
            for k, v in headers.items()}


def post_json(url, headers, body, timeout):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return resp.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


# ------------------------------------------------------------------ modes

def cmd_dry_run(args):
    turn = json.load(open(args.turn_json))
    errors = validate_reply(turn)
    url, headers, body = build_request(turn, args.hunt_id, args.base)
    print(f"[dry-run] POST {url}")
    print(f"[dry-run] headers {json.dumps(redacted_headers(headers))}")
    print(f"[dry-run] body.reply.task = {turn.get('task')!r}")
    print(f"[dry-run] body.reply.action.type = {turn.get('action', {}).get('type')!r} / "
          f"action.action = {turn.get('action', {}).get('action')!r}")
    if errors:
        print(f"[dry-run] VALIDATION FAILED ({len(errors)} errors):")
        for e in errors:
            print(f"  - {e['field']}: {e['message']}")
        return 1
    print("[dry-run] ALL 4 GATES PASS — this turn would be accepted by the "
          "console paste gate AND the backend dispatch AND the claim gate")
    return 0


def cmd_probe_route(args):
    # Minimal schema-shaped body, NO auth: proves the route exists and the
    # owner-only gate holds. A 401/403 is the PASS condition.
    turn = {"task": "route probe (no-op)",
            "goal": "prove the brain-action-json route exists + auth gate holds",
            "progress": "probe only, not a hunt turn",
            "action": {"type": "shell", "action": "shell", "command": "id"}}
    url, headers, body = build_request(turn, args.hunt_id, args.base)
    print(f"[probe-route] POST {url} (no Authorization header)")
    status, raw = post_json(url, headers, body, timeout=20)
    print(f"[probe-route] HTTP {status}")
    print(f"[probe-route] body: {raw[:300]}")
    if status in (401, 403):
        print("[probe-route] PASS — route is live, owner-only auth gate holds, "
              "no state changed")
        return 0
    print(f"[probe-route] UNEXPECTED — expected 401/403, got {status}")
    return 1


def cmd_submit(args):
    token = args.token or os.environ.get("DM_BRAIN_TOKEN")
    if not token:
        print("[submit] REFUSED: no token — pass --token or set DM_BRAIN_TOKEN. "
              "The token is the owner's JWT; the agent never invents one.",
              file=sys.stderr)
        return 2
    turn = json.load(open(args.turn_json))
    errors = validate_reply(turn)
    if errors:
        print(f"[submit] REFUSED: turn fails pre-submit validation "
              f"({len(errors)} errors) — nothing sent:")
        for e in errors:
            print(f"  - {e['field']}: {e['message']}")
        return 1
    url, headers, body = build_request(turn, args.hunt_id, args.base, token)
    print(f"[submit] POST {url} (timeout 300s, auth redacted)")
    status, raw = post_json(url, headers, body, timeout=300)
    print(f"[submit] HTTP {status}")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = None
    if status == 409:
        print("[submit] REFUSED BY BACKEND: AI is the brain right now "
              "(brainMode='ai') — hand the brain back to the parent first.")
        return 1
    if status == 400:
        print("[submit] BACKEND VALIDATION ERROR — field-level:")
        print(raw[:500])
        return 1
    if status in (401, 403):
        print("[submit] AUTH REJECTED — the token is missing/expired. "
              "Ask the owner; never retry with a guessed token.")
        return 1
    if status == 200 and data:
        print(f"[submit] ACCEPTED — hash={data.get('hash')}")
        out = data.get("output")
        if isinstance(out, str):
            print(f"[submit] output ({len(out)} chars):\n{out[:2000]}")
        else:
            print(f"[submit] output: {json.dumps(out)[:2000]}")
        entry = data.get("entry")
        if isinstance(entry, dict):
            print(f"[submit] entry keys: {sorted(entry.keys())}")
        return 0
    print(f"[submit] UNEXPECTED RESPONSE: {raw[:500]}")
    return 1


def main():
    p = argparse.ArgumentParser(description="Submitter lane: drive the Brain "
                                            "Console API like the console does")
    p.add_argument("--base", default=BASE_DEFAULT)
    p.add_argument("--hunt-id", required=True)
    sub = p.add_subparsers(dest="mode", required=True)
    d = sub.add_parser("dry-run"); d.add_argument("turn_json")
    r = sub.add_parser("probe-route")
    s = sub.add_parser("submit"); s.add_argument("turn_json"); s.add_argument("--token")
    args = p.parse_args()
    if args.mode == "dry-run":
        return cmd_dry_run(args)
    if args.mode == "probe-route":
        return cmd_probe_route(args)
    return cmd_submit(args)


if __name__ == "__main__":
    sys.exit(main())
