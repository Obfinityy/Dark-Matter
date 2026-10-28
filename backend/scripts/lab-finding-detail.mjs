// Lab: finding detail — the full record behind one panel row.
//
//   GET /:id/findings/:title through the REAL hunts router against a
//   local mock backend (express + real store in a temp DATA_DIR),
//   seeded with the realistic live shape: the verified PBRN7719
//   reflected-XSS finding plus an under-investigation lead.
//   Verifies the full detail round-trips (title, severity,
//   verified, verification, evidence request/response/reflected
//   line, at), the lead stays honestly unverified, an unknown title
//   404s, a title containing '/' matches via encodeURIComponent,
//   and the reads mutate nothing. No Meta calls, $0 spend, no live
//   hunt touched. Exit 0 + ALL CHECKS PASSED on success, non-zero
//   otherwise.
//
//   node backend/scripts/lab-finding-detail.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-finding-detail-'));
process.env.DATA_DIR = tmpRoot;
process.env.JWT_SECRET = 'lab-finding-detail-test-secret-1234';
process.env.ENGINE_URL = 'http://127.0.0.1:9'; // nothing listens: engine unreachable, fast fail

const express = (await import('express')).default;
const huntsRouter = (await import('../src/routes/hunts.js')).default;
const { issueToken } = await import('../src/routes/auth.js');
const { writeHuntMeta, appendHuntEvent, readHuntEvents, readHuntMeta } = await import('../src/store.js');

const HUNT_ID = 'h_lab_finding_detail';
const TARGET = 'http://172.17.0.1:3100/';
const OWNER = { id: 'owner-1', username: 'owner', role: 'admin' };
const XSS_TITLE = 'Reflected XSS in /vulnerabilities/xss_r name parameter';
const XSS_EVIDENCE = {
  request: 'python3 /opt/hunt/parent_brain_xss.py PBRN7719',
  response: 'xss_r 200 len 4388\nRAW marker present: True | script tag present: True\nREFLECTED LINE: <pre>Hello PBRN7719<sCrIpT>alert(1)</sCrIpT></pre>',
};

let checks = 0;
let failures = 0;
function check(name, cond, extra = '') {
  checks++;
  if (cond) console.log(`  PASS ${name}`);
  else { failures++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

// --- seed a hunt shaped like the live DVWA hunt: one verified finding,
// --- one lead under investigation, plus a "PoC confirmed:" duplicate stamp.
writeHuntMeta(HUNT_ID, {
  huntId: HUNT_ID, target: TARGET, userId: OWNER.id, state: 'paused', paused: true, iteration: 248,
});
appendHuntEvent(HUNT_ID, {
  type: 'finding', title: XSS_TITLE, severity: 'high', verified: true,
  verification: 'confirmed (all 4 steps passed)',
  detail: 'Reflected XSS: marker PBRN7719 reflected raw with a script tag on a 200 page.',
  url: 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=PBRN7719',
  evidence: XSS_EVIDENCE,
});
appendHuntEvent(HUNT_ID, {
  type: 'finding', title: `PoC confirmed: ${XSS_TITLE}`, severity: 'high', verified: true,
  verification: 'confirmed (all 4 steps passed)', evidence: XSS_EVIDENCE,
});
appendHuntEvent(HUNT_ID, {
  type: 'finding', title: 'possible sqli in login form', severity: 'medium', verified: false,
  verification: 'evidence not reproduced on re-run',
  detail: 'Login form takes a username parameter; UNION probe returned the login page unchanged.',
  evidence: { request: "POST /login.php user=' OR 1=1--", response: '200 login page, no dump' },
});

const app = express();
app.use(express.json());
app.use('/api/v1/hunts', huntsRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}/api/v1/hunts/${HUNT_ID}`;
const token = issueToken({ id: OWNER.id, username: OWNER.username, role: OWNER.role });
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function call(method, url, body) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}

console.log('lab-finding-detail: full finding record through the real route (temp DATA_DIR, no live hunt)');
try {
  const eventsBefore = readHuntEvents(HUNT_ID);
  const metaBefore = readHuntMeta(HUNT_ID);

  // 1. The verified XSS finding: full detail round-trips.
  let r = await call('GET', `${base}/findings/${encodeURIComponent(XSS_TITLE)}`);
  check('GET findings/:title is 200 ok', r.status === 200 && r.json.ok === true, JSON.stringify(r.json).slice(0, 200));
  check('huntId echoes the hunt', r.json.huntId === HUNT_ID);
  const f = r.json.finding || {};
  check('title round-trips exactly (slashes included)', f.title === XSS_TITLE, String(f.title));
  check('severity is high', f.severity === 'high', String(f.severity));
  check('verified is true', f.verified === true, String(f.verified));
  check('verification is the confirmed verdict', f.verification === 'confirmed (all 4 steps passed)', String(f.verification));
  check('detail names the marker', typeof f.detail === 'string' && f.detail.includes('PBRN7719'), String(f.detail));
  check('evidence.request is the parent-brain command', f.evidence && f.evidence.request === 'python3 /opt/hunt/parent_brain_xss.py PBRN7719', JSON.stringify(f.evidence).slice(0, 200));
  check('evidence.response carries the marker + script-tag verdict', f.evidence && /RAW marker present: True \| script tag present: True/.test(f.evidence.response), JSON.stringify(f.evidence).slice(0, 200));
  check('evidence.response carries the reflected line', f.evidence && f.evidence.response.includes('REFLECTED LINE: <pre>Hello PBRN7719<sCrIpT>alert(1)</sCrIpT></pre>'), JSON.stringify(f.evidence).slice(0, 200));
  check('evidence.response carries the 200 + length', f.evidence && f.evidence.response.includes('xss_r 200 len 4388'), JSON.stringify(f.evidence).slice(0, 200));
  check('at is a real timestamp from the verified stamp', typeof f.at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(f.at), String(f.at));
  check('firstSeen/lastSeen are real timestamps', /^\d{4}-\d{2}-\d{2}T/.test(f.firstSeen || '') && /^\d{4}-\d{2}-\d{2}T/.test(f.lastSeen || ''), `${f.firstSeen} / ${f.lastSeen}`);
  check('stamps counts both stamps of the title (incl. PoC confirmed: duplicate)', f.stamps === 2, String(f.stamps));

  // 2. The same title matches case-insensitively (normalised title).
  r = await call('GET', `${base}/findings/${encodeURIComponent('  reflected XSS in /vulnerabilities/xss_r NAME parameter ')}`);
  check('title match is normalised (case/whitespace-insensitive)', r.status === 200 && r.json.finding.verified === true, JSON.stringify(r.json).slice(0, 200));

  // 3. The lead under investigation: honest, unverified, evidence present.
  r = await call('GET', `${base}/findings/${encodeURIComponent('possible sqli in login form')}`);
  check('lead returns 200 with verified false', r.status === 200 && r.json.finding.verified === false, JSON.stringify(r.json).slice(0, 200));
  check('lead keeps its own evidence', r.json.finding.evidence && r.json.finding.evidence.request === "POST /login.php user=' OR 1=1--", JSON.stringify(r.json.finding.evidence).slice(0, 200));
  check('lead has no verified timestamp', r.json.finding.at === '', String(r.json.finding.at));
  check('lead detail is its own honest note', /UNION probe/.test(r.json.finding.detail || ''), String(r.json.finding.detail));

  // 4. Unknown title 404s with the contract error.
  r = await call('GET', `${base}/findings/${encodeURIComponent('no such finding')}`);
  check('unknown title is 404 unknown_finding', r.status === 404 && r.json.error === 'unknown_finding', JSON.stringify(r.json));

  // 5. The panel row and the detail record agree on the same title.
  r = await call('GET', `${base}/events?limit=200`);
  const row = (r.json.findings || []).find((x) => x.title === XSS_TITLE);
  check('panel row exists for the XSS title', !!row, JSON.stringify(r.json.findings).slice(0, 200));
  check('panel row agrees: verified + high + same verdict', row && row.verified === true && row.severity === 'high' && row.verification === 'confirmed (all 4 steps passed)', JSON.stringify(row));

  // 6. Read-only: the GETs mutated nothing.
  check('no event was appended by the reads', JSON.stringify(readHuntEvents(HUNT_ID)) === JSON.stringify(eventsBefore));
  check('meta untouched by the reads', JSON.stringify(readHuntMeta(HUNT_ID)) === JSON.stringify(metaBefore));
} finally {
  await new Promise((resolve) => server.close(resolve));
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\nlab-finding-detail: ${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log('lab-finding-detail: FAILED');
  process.exit(1);
}
console.log('lab-finding-detail: ALL CHECKS PASSED (temp DATA_DIR — live hunt untouched; the title-with-slash route works via encodeURIComponent)');
