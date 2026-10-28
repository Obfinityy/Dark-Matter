// Finding detail — backend unit + route tests (28 Oct 2026, feat/finding-detail).
//
// The panel rows (GET /:id/events -> panelFindings) drop the raw
// evidence, timestamps and any id/hash, so the detail view needs
// its own read: findingDetail (pure, in huntMemory.js) + the
// GET /:id/findings/:title route. Covered here:
//   (a) findingDetail: the real verified PBRN7719 XSS finding
//       round-trips in full (evidence request/response, the marker
//       and the reflected line, at / firstSeen / lastSeen)
//   (b) duplicate stamps of one title dedupe to one record with a
//       stamp count ("PoC confirmed:" collapses, same as the panel)
//   (c) under-investigation findings: partial evidence returned
//       honestly, no evidence -> null, never labelled verified
//   (d) error-page demotion: a "verified" stamp whose evidence is
//       a 404 page never counts as verified and its "confirmed"
//       verification/detail never leak onto the record
//   (e) unknown / empty title -> null; matching is by normalised
//       title (case/whitespace-insensitive), like panelFindings
//   (f) the route, mounted for real: 200 with the full finding
//       (title with '/' via encodeURIComponent), 404
//       unknown_finding, owner-only, and read-only (no state
//       mutation from any GET).
//
// No Meta calls, $0 spend. DATA_DIR points at a temp dir; the live
// hunt and the EC2 backend are untouched.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR / JWT_SECRET must be set BEFORE store/config/auth load.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'finding-detail-'));
process.env.DATA_DIR = tmpRoot;
process.env.JWT_SECRET = 'finding-detail-test-secret-1234';
process.env.ENGINE_URL = 'http://127.0.0.1:9'; // nothing listens: engine unreachable, fast fail

const { findingDetail, panelFindings } = await import('../huntMemory.js');
const huntsRouter = (await import('./hunts.js')).default;
const { issueToken } = await import('./auth.js');
const { writeHuntMeta, appendHuntEvent, readHuntEvents, readHuntMeta } = await import('../store.js');
const express = (await import('express')).default;

const XSS_TITLE = 'Reflected XSS in /vulnerabilities/xss_r name parameter';
const XSS_EVIDENCE = {
  request: 'python3 /opt/hunt/parent_brain_xss.py PBRN7719',
  response: 'xss_r 200 len 4388\nRAW marker present: True | script tag present: True\nREFLECTED LINE: <pre>Hello PBRN7719<sCrIpT>alert(1)</sCrIpT></pre>',
};
const XSS_AT = '2026-10-28T09:00:00.000Z';

const err404 = (url) => [
  'HTTP/1.1 404 Not Found',
  'Content-Type: text/html; charset=iso-8859-1',
  '',
  '<!DOCTYPE HTML><html><head><title>404 Not Found</title></head>',
  `<body><h1>Not Found</h1><p>The requested URL ${url} was not found on this server.</p>`,
  '<p>admin panel</p></body></html>',
].join('\n');

function xssStamp(over = {}) {
  return {
    type: 'finding', title: XSS_TITLE, severity: 'high', verified: true,
    verification: 'confirmed (all 4 steps passed)',
    detail: 'Reflected XSS: marker PBRN7719 reflected raw with a script tag on a 200 page.',
    url: 'http://172.17.0.1:3100/vulnerabilities/xss_r/?name=PBRN7719',
    cachedAt: XSS_AT, evidence: XSS_EVIDENCE, ...over,
  };
}

// (a) verified XSS round-trips in full ---------------------------------------
test('(a) findingDetail: verified PBRN7719 XSS round-trips with full evidence', () => {
  const rec = findingDetail([xssStamp()], XSS_TITLE);
  assert.ok(rec, 'record found');
  assert.equal(rec.title, XSS_TITLE);
  assert.equal(rec.severity, 'high');
  assert.equal(rec.verified, true);
  assert.equal(rec.verification, 'confirmed (all 4 steps passed)');
  assert.match(rec.detail, /PBRN7719/);
  assert.equal(rec.stamps, 1);
  assert.equal(rec.at, XSS_AT);
  assert.equal(rec.firstSeen, XSS_AT);
  assert.equal(rec.lastSeen, XSS_AT);
  // The evidence is the verified stamp's evidence as stored, as-is.
  assert.deepEqual(rec.evidence, XSS_EVIDENCE);
  assert.equal(rec.evidence.request, 'python3 /opt/hunt/parent_brain_xss.py PBRN7719');
  assert.match(rec.evidence.response, /PBRN7719/);
  assert.match(rec.evidence.response, /REFLECTED LINE: <pre>Hello PBRN7719<sCrIpT>alert\(1\)<\/sCrIpT><\/pre>/);
  assert.match(rec.evidence.response, /xss_r 200 len 4388/);
  // The detail view agrees with the panel row for the same title.
  const row = panelFindings([xssStamp()])[0];
  assert.equal(row.title, rec.title);
  assert.equal(row.severity, rec.severity);
  assert.equal(row.verified, rec.verified);
  assert.equal(row.verification, rec.verification);
});

// (b) duplicate stamps dedupe -------------------------------------------------
test('(b) findingDetail: duplicate stamps of one title dedupe to one record with a count', () => {
  const stamps = [
    { type: 'finding', title: XSS_TITLE, severity: 'medium', verified: false, cachedAt: '2026-10-28T08:00:00.000Z', evidence: { request: 'probe 1', response: 'no reflection yet' } },
    xssStamp({ cachedAt: '2026-10-28T09:00:00.000Z' }),
    { type: 'finding', title: `PoC confirmed: ${XSS_TITLE}`, severity: 'high', verified: true, verification: 'confirmed (all 4 steps passed)', cachedAt: '2026-10-28T09:05:00.000Z', evidence: XSS_EVIDENCE },
  ];
  const rec = findingDetail(stamps, XSS_TITLE);
  assert.ok(rec);
  assert.equal(rec.stamps, 3, '"PoC confirmed:" is the same finding, not a second one');
  assert.equal(rec.verified, true);
  assert.equal(rec.severity, 'high', 'severity comes from a verified stamp');
  assert.equal(rec.verification, 'confirmed (all 4 steps passed)');
  assert.equal(rec.at, '2026-10-28T09:00:00.000Z', 'at is the first verified stamp');
  assert.equal(rec.firstSeen, '2026-10-28T08:00:00.000Z');
  assert.equal(rec.lastSeen, '2026-10-28T09:05:00.000Z');
  assert.deepEqual(rec.evidence, XSS_EVIDENCE);
});

// (c) under-investigation findings ---------------------------------------------
test('(c) findingDetail: under-investigation finding returns its partial evidence, honestly unverified', () => {
  const lead = {
    type: 'finding', title: 'possible sqli in login form', severity: 'medium',
    verified: false, verification: 'evidence not reproduced on re-run',
    detail: 'Login form takes a username parameter; UNION probe returned the login page unchanged.',
    cachedAt: '2026-10-28T08:30:00.000Z',
    evidence: { request: "POST /login.php user=' OR 1=1--", response: '200 login page, no dump' },
  };
  const rec = findingDetail([lead], 'possible sqli in login form');
  assert.ok(rec);
  assert.equal(rec.verified, false);
  assert.equal(rec.severity, 'medium');
  assert.equal(rec.stamps, 1);
  assert.equal(rec.at, '', 'no verified stamp, so no verified timestamp');
  assert.equal(rec.firstSeen, '2026-10-28T08:30:00.000Z');
  assert.equal(rec.lastSeen, '2026-10-28T08:30:00.000Z');
  assert.deepEqual(rec.evidence, lead.evidence);
  assert.match(rec.detail, /UNION probe/);
});

test('(c) findingDetail: under-investigation finding with no evidence reports null, never invented', () => {
  const lead = {
    type: 'finding', title: 'possible sqli in login form', severity: 'low',
    cachedAt: '2026-10-28T08:30:00.000Z',
  };
  const rec = findingDetail([lead], 'possible sqli in login form');
  assert.ok(rec);
  assert.equal(rec.verified, false);
  assert.equal(rec.verification, '');
  assert.equal(rec.detail, '');
  assert.equal(rec.evidence, null);
  assert.equal(rec.severity, 'low');
});

// (d) error-page demotion -------------------------------------------------------
test('(d) findingDetail: error-page stamp demoted — never verified, no "confirmed" leakage', () => {
  const falseFinding = {
    type: 'finding', title: 'admin panel unauthenticated disclosure', severity: 'medium',
    verified: true, verification: 'confirmed (all 4 steps passed)',
    detail: 'confirmed (all 4 steps passed): admin panel disclosed without auth',
    cachedAt: '2026-10-27T15:58:00.000Z',
    evidence: { request: 'GET /rest/admin/x', response: err404('/rest/admin/x') },
  };
  const rec = findingDetail([falseFinding], 'admin panel unauthenticated disclosure');
  assert.ok(rec);
  assert.equal(rec.verified, false, 'a stamp whose evidence is a 404 page never counts as verified');
  assert.equal(rec.verification, '', 'the "confirmed" verdict must not leak onto the demoted record');
  assert.doesNotMatch(rec.detail || '', /confirmed/i, 'the detail must not claim confirmation either');
  assert.equal(rec.at, '', 'no verified stamp, so no verified timestamp');
  // The raw evidence is still returned as-is (honestly labelled unverified);
  // only the verdict/detail claims are suppressed.
  assert.equal(rec.evidence.response, err404('/rest/admin/x'));
  // And the panel agrees: this title is a lead, not a confirmed row.
  assert.equal(panelFindings([falseFinding])[0].verified, false);
});

// (e) unknown title / normalised matching ---------------------------------------
test('(e) findingDetail: unknown or empty title returns null; matching is by normalised title', () => {
  const stamps = [xssStamp()];
  assert.equal(findingDetail(stamps, 'no such finding'), null);
  assert.equal(findingDetail(stamps, ''), null);
  assert.equal(findingDetail(stamps, null), null);
  assert.equal(findingDetail([], XSS_TITLE), null);
  // Case + whitespace-insensitive, like panelFindings.
  assert.ok(findingDetail(stamps, '  REFLECTED xss IN /vulnerabilities/xss_r NAME parameter  '));
  // A "PoC confirmed:" stamp is the same finding as the bare title.
  const pocOnly = [{ type: 'finding', title: `PoC confirmed: ${XSS_TITLE}`, severity: 'high', verified: true, verification: 'confirmed (all 4 steps passed)', cachedAt: XSS_AT, evidence: XSS_EVIDENCE }];
  const rec = findingDetail(pocOnly, XSS_TITLE);
  assert.ok(rec);
  assert.equal(rec.verified, true);
  assert.equal(rec.stamps, 1);
});

// (f) the route, mounted for real ----------------------------------------------
const OWNER = { id: 'owner-1', username: 'owner', role: 'admin' };
const HUNT_ID = 'h_lab_finding_detail';
const TARGET = 'http://172.17.0.1:3100/';

writeHuntMeta(HUNT_ID, {
  huntId: HUNT_ID, target: TARGET, userId: OWNER.id, state: 'paused', paused: true, iteration: 248,
});
appendHuntEvent(HUNT_ID, { type: 'finding', ...xssStamp() });
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
const ownerToken = issueToken({ id: OWNER.id, username: OWNER.username, role: OWNER.role });
const ownerHeaders = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
async function call(method, url, headers = ownerHeaders, body) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}

test('(f) route: GET findings/:title returns the full verified finding (title with / via encodeURIComponent)', async () => {
  try {
    const r = await call('GET', `${base}/findings/${encodeURIComponent(XSS_TITLE)}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.huntId, HUNT_ID);
    const f = r.json.finding;
    assert.equal(f.title, XSS_TITLE);
    assert.equal(f.severity, 'high');
    assert.equal(f.verified, true);
    assert.equal(f.verification, 'confirmed (all 4 steps passed)');
    assert.match(f.detail, /PBRN7719/);
    assert.equal(f.stamps, 1);
    assert.match(f.at, /^\d{4}-\d{2}-\d{2}T/, 'at is a real timestamp from the stored stamp');
    assert.match(f.firstSeen, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(f.lastSeen, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(f.evidence.request, 'python3 /opt/hunt/parent_brain_xss.py PBRN7719');
    assert.match(f.evidence.response, /PBRN7719/);
    assert.match(f.evidence.response, /REFLECTED LINE: <pre>Hello PBRN7719<sCrIpT>alert\(1\)<\/sCrIpT><\/pre>/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('(f) route: unknown title is 404 unknown_finding', async () => {
  const app2 = express();
  app2.use(express.json());
  app2.use('/api/v1/hunts', huntsRouter);
  const server2 = await new Promise((resolve) => {
    const s = app2.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const base2 = `http://127.0.0.1:${server2.address().port}/api/v1/hunts/${HUNT_ID}`;
    const r = await call('GET', `${base2}/findings/${encodeURIComponent('no such finding')}`);
    assert.equal(r.status, 404);
    assert.equal(r.json.ok, false);
    assert.equal(r.json.error, 'unknown_finding');
    assert.match(r.json.message, /no such finding/);
  } finally {
    await new Promise((resolve) => server2.close(resolve));
  }
});

test('(f) route: under-investigation finding returns 200, verified false, with its evidence', async () => {
  const app3 = express();
  app3.use(express.json());
  app3.use('/api/v1/hunts', huntsRouter);
  const server3 = await new Promise((resolve) => {
    const s = app3.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const base3 = `http://127.0.0.1:${server3.address().port}/api/v1/hunts/${HUNT_ID}`;
    const r = await call('GET', `${base3}/findings/${encodeURIComponent('possible sqli in login form')}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.finding.verified, false);
    assert.equal(r.json.finding.evidence.request, "POST /login.php user=' OR 1=1--");
    assert.match(r.json.finding.detail, /UNION probe/);
  } finally {
    await new Promise((resolve) => server3.close(resolve));
  }
});

test('(f) route: GETs are read-only — no event or meta mutation', async () => {
  const app4 = express();
  app4.use(express.json());
  app4.use('/api/v1/hunts', huntsRouter);
  const server4 = await new Promise((resolve) => {
    const s = app4.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const base4 = `http://127.0.0.1:${server4.address().port}/api/v1/hunts/${HUNT_ID}`;
    const eventsBefore = readHuntEvents(HUNT_ID);
    const metaBefore = readHuntMeta(HUNT_ID);
    await call('GET', `${base4}/findings/${encodeURIComponent(XSS_TITLE)}`);
    await call('GET', `${base4}/findings/${encodeURIComponent('possible sqli in login form')}`);
    await call('GET', `${base4}/findings/${encodeURIComponent('no such finding')}`);
    assert.deepEqual(readHuntEvents(HUNT_ID), eventsBefore, 'no event was appended by the reads');
    assert.deepEqual(readHuntMeta(HUNT_ID), metaBefore, 'meta untouched by the reads');
  } finally {
    await new Promise((resolve) => server4.close(resolve));
  }
});

test('(f) route: owner-only — a non-owner gets 403, an unknown hunt gets 404', async () => {
  const app5 = express();
  app5.use(express.json());
  app5.use('/api/v1/hunts', huntsRouter);
  const server5 = await new Promise((resolve) => {
    const s = app5.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const base5 = `http://127.0.0.1:${server5.address().port}/api/v1/hunts`;
    const otherToken = issueToken({ id: 'someone-else', username: 'other', role: 'member' });
    const otherHeaders = { Authorization: `Bearer ${otherToken}`, 'Content-Type': 'application/json' };
    const forbidden = await call('GET', `${base5}/${HUNT_ID}/findings/${encodeURIComponent(XSS_TITLE)}`, otherHeaders);
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.json.error, 'forbidden');
    const missing = await call('GET', `${base5}/h_nope/findings/${encodeURIComponent(XSS_TITLE)}`);
    assert.equal(missing.status, 404);
    assert.equal(missing.json.error, 'hunt_not_found');
  } finally {
    await new Promise((resolve) => server5.close(resolve));
  }
});
