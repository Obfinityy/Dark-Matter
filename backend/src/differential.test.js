// HTTP error-page gate tests (27 Oct 2026, 404-verified audit).
//
// The live DVWA hunt's 5 false "verified" findings all carry a 404
// page in evidence.response — curl exits 0 on a 404, the 404 body
// contains the signal word "admin", and a 404 reproduces
// deterministically. The gate must reject error pages at every limb
// that could stamp verified.
import test from 'node:test';
import assert from 'node:assert/strict';

import { httpErrorStatus, isHttpErrorPage, assessContentRelevance, evidenceSignalIds, evidenceDataTokens, evidenceReproduced } from './hunt-intel/differential.js';

// Real evidence excerpts from the live DVWA hunt h_830317bdc184
// (27 Oct 2026) — the exact strings the verifier stamped.
const APACHE_404_HEADERS = 'HTTP/1.1 404 Not Found\r\nDate: Tue, 27 Oct 2026 15:28:22 GMT\r\nServer: Apache/2.4.25 (Debian)\r\nContent-Length: 306\r\nContent-Type: text/html; charset=iso-8859-1\r\n\r\n<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">';
const BODY_ONLY_404 = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>404 Not Found</title>\n</head><body>\n<h1>Not Found</h1>\n<p>The requested URL /rest/admin/application-configuration was not found on this server.</p>';
const OK_200 = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"admin": true, "token": "abc"}';
const BODY_200 = '<html><head><title>Admin panel</title></head><body>Welcome admin</body></html>';

test('httpErrorStatus detects a 404 status line', () => {
  assert.equal(httpErrorStatus(APACHE_404_HEADERS), 404);
});

test('httpErrorStatus detects a body-only 404 page (title + Apache body)', () => {
  assert.equal(httpErrorStatus(BODY_ONLY_404), 404);
});

test('httpErrorStatus detects other error codes', () => {
  assert.equal(httpErrorStatus('HTTP/1.1 500 Internal Server Error\r\n\r\nerror'), 500);
  assert.equal(httpErrorStatus('<title>403 Forbidden</title>'), 403);
});

test('httpErrorStatus returns 0 for 200 responses', () => {
  assert.equal(httpErrorStatus(OK_200), 0);
  assert.equal(httpErrorStatus(BODY_200), 0);
  assert.equal(httpErrorStatus(''), 0);
  assert.equal(httpErrorStatus(null), 0);
});

test('isHttpErrorPage mirrors httpErrorStatus', () => {
  assert.equal(isHttpErrorPage(APACHE_404_HEADERS), true);
  assert.equal(isHttpErrorPage(OK_200), false);
});

test('assessContentRelevance rejects an error page even when it carries signal words', () => {
  const rel = assessContentRelevance({
    command: "curl -sk 'http://172.17.0.1:3100/rest/admin/application-version'",
    target: 'http://172.17.0.1:3100/',
    output: BODY_ONLY_404,
    baselines: [],
  });
  assert.equal(rel.relevant, false);
  assert.match(rel.reason, /404/);
});

test('assessContentRelevance still accepts a real 200 page with signals', () => {
  const rel = assessContentRelevance({
    command: "curl -sk 'http://172.17.0.1:3100/admin'",
    target: 'http://172.17.0.1:3100/',
    output: BODY_200,
    baselines: [],
  });
  assert.equal(rel.relevant, true);
});

// ---------------------------------------------------------------------------
// evidenceReproduced (gate-replay lane, 28 Oct 2026).
//
// Root cause: the verifier required the coarse signal-id SETS of the
// brain's pasted evidence and the re-run output to be identical.
// For a data-exfiltration finding (UNION dump) the evidence is a
// hand-pasted excerpt and the re-run is full raw output — they carry
// different signal words, so a real reproducible dump was rejected
// as "the second run differed" (twice, 05:17 + 06:31 IST 28 Oct).
// The fix checks whether the re-run reproduces the CLAIMED DATA
// (hashes / canary tokens / signal lines), not the signal sets.
// ---------------------------------------------------------------------------

// Modelled on the live DVWA hunt's UNION dump (28 Oct 2026): the
// brain's pasted excerpt (admin + gordonb hashes are the real dumped
// values; the other rows are representative 32-hex MD5 strings) and
// the re-run's full raw output, which carries EXTRA signal words
// (mysql, token) the excerpt never had.
const UNION_EVIDENCE = [
  "SQLi UNION dump — /vulnerabilities/sqli/?id=1' UNION SELECT user,password FROM users#",
  'admin | 5f4dcc3b5aa765d61d8327deb882cf99',
  'gordonb | e99a18c428cb38d5f260853',
  '1337 | 8d3533d75ae2c3966d7e0d9e6a5b8f3',
  'pablo | 0d107d09f5bbe40cadea9d6d6d9e5b0',
  'smithy | 5f4dcc3b5aa765d61d8327deb882cf99',
].join('\n');
const UNION_RERUN = [
  '[+] target: http://172.17.0.1:3100/vulnerabilities/sqli/',
  '[+] mysql version: 5.7.44',
  "[+] UNION SELECT user,password FROM users#",
  'admin | 5f4dcc3b5aa765d61d8327deb882cf99',
  'gordonb | e99a18c428cb38d5f260853',
  '1337 | 8d3533d75ae2c3966d7e0d9e6a5b8f3',
  'pablo | 0d107d09f5bbe40cadea9d6d6d9e5b0',
  'smithy | 5f4dcc3b5aa765d61d8327deb882cf99',
  '[+] dumped 5 users, session token abc123',
].join('\n');
const UNION_COMMAND = 'python3 /opt/hunt/sqli_final.py';

test('evidenceDataTokens extracts the dumped hashes from UNION evidence', () => {
  const tokens = evidenceDataTokens(UNION_EVIDENCE, UNION_COMMAND);
  assert.ok(tokens.includes('5f4dcc3b5aa765d61d8327deb882cf99'), 'admin hash');
  assert.ok(tokens.includes('e99a18c428cb38d5f260853'), 'gordonb hash');
  assert.ok(!tokens.includes('python3'), 'tool name is not a data token');
});

test('evidenceDataTokens extracts a reflected XSS canary shared by evidence and command', () => {
  const tokens = evidenceDataTokens(
    'Hello QXZ7719<sCrIpT>alert(1)</sCrIpT>',
    "curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=QXZ7719<sCrIpT>alert(1)</sCrIpT>'",
  );
  assert.ok(tokens.includes('qxz7719'), 'the canary marker');
  assert.ok(!tokens.includes('admin'), 'stopwords are excluded');
});

test('evidenceReproduced accepts the UNION dump: the old signal-set rule would have rejected it', () => {
  // The old rule: sig1 must equal sig2. The excerpt and the full
  // output carry DIFFERENT signal words — this is exactly why the
  // live gate rejected the filed claim twice.
  const sig1 = evidenceSignalIds(UNION_EVIDENCE, UNION_COMMAND);
  const sig2 = evidenceSignalIds(UNION_RERUN, UNION_COMMAND);
  assert.notEqual(sig1.join(','), sig2.join(','), 'the old rule would have rejected this dump');
  // The new rule: the re-run reproduces the claimed data.
  assert.equal(evidenceReproduced(UNION_EVIDENCE, UNION_RERUN, UNION_COMMAND), true);
});

test('evidenceReproduced rejects a 404 re-run even though the 404 reproduces deterministically', () => {
  const command = "curl -sk 'http://172.17.0.1:3100/rest/admin/application-version'";
  assert.equal(evidenceReproduced(BODY_ONLY_404, BODY_ONLY_404, command), false);
  assert.deepEqual(evidenceDataTokens(BODY_ONLY_404, command), []);
});

test('evidenceReproduced accepts a reflected XSS canary reproduced by the re-run', () => {
  const command = "curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=QXZ7719<sCrIpT>alert(1)</sCrIpT>'";
  const evidence = 'Hello QXZ7719<sCrIpT>alert(1)</sCrIpT>';
  assert.equal(evidenceReproduced(evidence, evidence, command), true);
  assert.equal(evidenceReproduced(evidence, 'Hello QXZ7719 — no script tag here', command), false);
});

test('evidenceReproduced rejects prose evidence with nothing concrete to reproduce', () => {
  const evidence = 'the UNION query returned all 5 users with password hashes';
  assert.equal(evidenceReproduced(evidence, UNION_RERUN, UNION_COMMAND), false);
});

test('evidenceReproduced accepts a reproduced signal line when there is no hash or canary', () => {
  const command = "curl -sk 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=test'";
  const line = 'Vulnerable: the page reflects <script>alert(1)</script> without encoding on the live form';
  assert.equal(evidenceReproduced(line, `probe output:\n${line}\nend`, command), true);
  assert.equal(evidenceReproduced(line, 'the page reflects nothing here', command), false);
});
