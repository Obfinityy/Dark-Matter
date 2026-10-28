// GATE-REPLAY lab (28 Oct 2026, gate-replay lane).
//
// Proves, against a LOCAL mock DVWA (no docker, no Meta, $0, no
// live hunt or backend touched), the two halves of the fix for the
// night the level proof stayed at 0 despite real evidence:
//
//   (A) UNION DUMP REPLAY — the brain filed the SQLi UNION dump
//       twice (05:17 + 06:31 IST 28 Oct) and the gate rejected it
//       twice within 1 second ("the second run differed") because
//       it required the coarse signal-id SETS of the pasted
//       evidence and the re-run output to be identical. Here the
//       real reproduction command (curl) runs against the mock
//       DVWA, the real gate functions decide, and the claim
//       CONFIRMS — while the old signal-set comparison is shown
//       to still disagree (the root cause, demonstrated).
//   (B) 404 STILL FAILS — the same gate, on the Juice Shop
//       /rest/admin/* path that produced the 5 false "verified"
//       findings, still rejects: the re-run returns an error page,
//       so it is not a confirmation, and content-relevance rejects
//       it too. The step-2 protection is intact.
//   (C) RE-PROOF -> FILE — the real humanIteration drives the
//       reflected-XSS claim with a REAL curl exec against the mock
//       DVWA: the brain re-proves with a fresh marker each turn;
//       after 3 consistent proofs the 4th probe is blocked and the
//       brain is told to FILE the claim (proof_file_nudge).
//
// Usage: node scripts/lab-gate-replay.mjs
// Exit 0 when every check passes, 1 otherwise.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-gate-replay-'));
process.env.DATA_DIR = tmpRoot;

const {
  evidenceSignalIds,
  evidenceReproduced,
  supportingSignalLines,
  verifyPipeline,
  assessContentRelevance,
} = await import('../src/hunt-intel/differential.js');
const { humanIteration } = await import('../src/humanLoop.js');

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
// ---------------------------------------------------------------------------
const DUMP_ROWS = [
  'admin | 5f4dcc3b5aa765d61d8327deb882cf99',
  'gordonb | e99a18c428cb38d5f260853',
  '1337 | 8d3533d75ae2c3966d7e0d9e6a5b8f3',
  'pablo | 0d107d09f5bbe40cadea9d6d6d9e5b0',
  'smithy | 5f4dcc3b5aa765d61d8327deb882cf99',
].join('\n');

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (u.pathname === '/vulnerabilities/sqli/') {
    const id = u.searchParams.get('id') || '';
    if (/union\s+select/i.test(id)) {
      // The re-run's FULL raw output: the dumped rows plus extra
      // signal words (mysql, token) the pasted excerpt never had.
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`[+] target: ${u.pathname}\n[+] mysql version: 5.7.44\n[+] UNION SELECT user,password FROM users#\n${DUMP_ROWS}\n[+] dumped 5 users, session token abc123\n`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body>SQL Injection — please enter an ID.</body></html>');
    return;
  }
  if (u.pathname === '/rest/admin/application-version') {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>404 Not Found</title>\n</head><body>\n<h1>Not Found</h1>\n<p>The requested URL /rest/admin/application-version was not found on this server.</p>');
    return;
  }
  if (u.pathname === '/vulnerabilities/xss_r/') {
    const name = u.searchParams.get('name') || '';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`Hello ${name}`);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('Not Found');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;
console.log(`mock DVWA listening on ${BASE}`);

async function runCurl(cmd) {
  try {
    const { stdout, stderr } = await execFileAsync('sh', ['-c', cmd], { timeout: 10000 });
    return `${stdout || ''}${stderr || ''}`;
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}${e.message || ''}`;
  }
}

// ---------------------------------------------------------------------------
// (A) UNION dump replay — the filed claim now confirms.
// ---------------------------------------------------------------------------
console.log('\n(A) UNION dump replay');
const UNION_EVIDENCE = [
  "SQLi UNION dump — /vulnerabilities/sqli/?id=1' UNION SELECT user,password FROM users#",
  ...DUMP_ROWS.split('\n'),
].join('\n');
const UNION_COMMAND = `curl -sk '${BASE}/vulnerabilities/sqli/?id=1%27%20UNION%20SELECT%20user%2Cpassword%20FROM%20users%23'`;
const unionReRun = await runCurl(UNION_COMMAND);
check('the reproduction command returns the dumped rows', unionReRun.includes('5f4dcc3b5aa765d61d8327deb882cf99'));
const sig1 = evidenceSignalIds(UNION_EVIDENCE, UNION_COMMAND);
const sig2 = evidenceSignalIds(unionReRun, UNION_COMMAND);
check('the OLD signal-set rule would still reject this dump (root cause demonstrated)', sig1.join(',') !== sig2.join(','), `sig1=${sig1.join(',')} sig2=${sig2.join(',')}`);
const unionConfirmed = evidenceReproduced(UNION_EVIDENCE, unionReRun, UNION_COMMAND);
check('evidenceReproduced accepts the dump (hashes reproduced)', unionConfirmed === true);
const unionSteps = verifyPipeline({
  reachability: unionReRun.length > 50,
  payload_validation: supportingSignalLines(unionReRun, { excludeText: UNION_COMMAND }).length > 0 || /vulnerable|bypass|injection|leak/i.test(unionReRun),
  impact_assessment: sig2.length > 0,
  exploit_confirmation: unionConfirmed,
});
check('verifyPipeline confirms all 4 steps', unionSteps.verified === true, unionSteps.verdict);
const unionRel = assessContentRelevance({ command: UNION_COMMAND, target: `${BASE}/`, output: unionReRun, baselines: [] });
check('content-relevance accepts the dump', unionRel.relevant === true, unionRel.reason || '');
console.log(`  verdict: ${unionSteps.verified && unionRel.relevant ? 'CONFIRMED (all 4 steps passed)' : 'REJECTED'}`);

// ---------------------------------------------------------------------------
// (B) 404 still fails.
// ---------------------------------------------------------------------------
console.log('\n(B) 404 error page still fails');
const NOT_FOUND_BODY = '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>404 Not Found</title>\n</head><body>\n<h1>Not Found</h1>\n<p>The requested URL /rest/admin/application-version was not found on this server.</p>';
const NOT_FOUND_COMMAND = `curl -sk '${BASE}/rest/admin/application-version'`;
const notFoundReRun = await runCurl(NOT_FOUND_COMMAND);
check('the reproduction command returns the 404 page', notFoundReRun.includes('404 Not Found'));
check('evidenceReproduced rejects the 404 re-run', evidenceReproduced(NOT_FOUND_BODY, notFoundReRun, NOT_FOUND_COMMAND) === false);
const notFoundSteps = verifyPipeline({
  reachability: notFoundReRun.length > 50,
  payload_validation: supportingSignalLines(notFoundReRun, { excludeText: NOT_FOUND_COMMAND }).length > 0,
  impact_assessment: evidenceSignalIds(notFoundReRun, NOT_FOUND_COMMAND).length > 0,
  exploit_confirmation: false,
});
check('verifyPipeline fails at exploit_confirmation', notFoundSteps.verified === false && notFoundSteps.failedAt === 'exploit_confirmation', notFoundSteps.verdict);
const notFoundRel = assessContentRelevance({ command: NOT_FOUND_COMMAND, target: `${BASE}/`, output: notFoundReRun, baselines: [] });
check('content-relevance rejects the 404 page', notFoundRel.relevant === false, notFoundRel.reason || '');

// ---------------------------------------------------------------------------
// (C) Re-proof -> file through the real humanIteration + real curl.
// ---------------------------------------------------------------------------
console.log('\n(C) re-proof -> file (real humanIteration, real curl exec)');
const XSS_URL = `${BASE}/vulnerabilities/xss_r/`;
const XSS_KEY = `127.0.0.1/vulnerabilities/xss_r|xss`;
const XSS_SNAP = { url: XSS_URL, title: 'XSS reflected', text: 'Hello', elements: [] };
const recorded = [];
const execCalls = [];
let metaStore = {};
let n = 0;
const markers = ['ZXSS987654', 'ZXQ9777', 'QXZ7719', 'RXS2810B'];
const replies = markers.map((marker) => `Probing reflected XSS with a fresh marker.\n${JSON.stringify({
  action: 'shell',
  command: `curl -sk '${XSS_URL}?name=${marker}<sCrIpT>alert(1)</sCrIpT>'`,
})}`);
const res = await humanIteration('h_lab_gate_replay', `${BASE}/`, {
  turns: replies.length,
  deps: {
    chat: async () => replies[n++],
    gui: {
      open: async () => ({ observation: 'opened', snapshot: XSS_SNAP }),
      snapshot: async () => ({ observation: `Page: ${XSS_URL}\nHello`, snapshot: XSS_SNAP }),
      click: async () => ({ ok: true, observation: 'clicked', snapshot: XSS_SNAP }),
      type: async () => ({ ok: true, observation: 'Typed.', snapshot: XSS_SNAP }),
      screenshot: async () => ({ observation: 'shot', snapshot: XSS_SNAP }),
    },
    // REAL exec: the shell command runs against the mock DVWA.
    exec: async (h, t, cmd) => {
      execCalls.push(String(cmd || ''));
      const out = await runCurl(String(cmd || ''));
      return { stdout: out, stderr: '', code: 0 };
    },
    execRaw: async () => ({ stdout: '', stderr: '' }),
    record: (h, e) => { recorded.push(e); },
    recordNote: () => {},
    readMeta: () => metaStore,
    writeMeta: (h, patch) => { metaStore = { ...metaStore, ...(patch || {}) }; return metaStore; },
    readEvents: () => [],
    buildBriefing: async () => '',
    machineControlled: () => false,
    assess: null,
  },
});
check('four turns ran', res.turnsRun === 4, `turnsRun=${res.turnsRun}`);
check('the fourth probe never executed (3 real curls only)', execCalls.length === 3, `execCalls=${execCalls.length}`);
check('the proof count persisted to meta', metaStore.proofCounts && metaStore.proofCounts[XSS_KEY] === 3, JSON.stringify(metaStore.proofCounts || {}));
check('the fourth turn is the file nudge', /PROOF COMPLETE — FILE IT NOW/.test(res.log[3]?.observation || '') && /claim_finding/.test(res.log[3]?.observation || ''));
const nudge = recorded.find((e) => e.type === 'proof_file_nudge');
check('a proof_file_nudge event was recorded', Boolean(nudge) && nudge.count === 3, nudge ? `count=${nudge.count}` : 'none');

server.close();
console.log(`\n${failures.length === 0 ? 'ALL CHECKS PASSED' : `${failures.length} CHECK(S) FAILED: ${failures.join(', ')}`}`);
process.exit(failures.length === 0 ? 0 : 1);
