// Referer-based access control probe tests (row #496 [High]
// Access control — Referer-based access control, CWE-862; phase
// 'referer-access-control').
//
// The probe confirms only on a five-leg differential on a mined
// admin route: the admin control must grant, a benign Referer
// must be denied, a Referer forged to the admin path must grant
// twice, and a nonsense Referer must be denied. The tests run the
// full flow — admin login, throwaway low-privilege registration
// and login, then the five legs — against a real local node:http
// listener with NO injected fetchFn, so the default
// rawHeaderFetch transport is proven to transmit the forged
// Referer verbatim end to end. The listener is lab-gated the same
// way the probe is: labTargets ['127.0.0.1'].

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeRefererAccessControl,
  forgedAdminReferer,
  benignReferer,
  nonsenseReferer,
  assessRefererAccess,
  __refererAccessControlMeta,
} from './refererAccessControl.js';
import { verifyFindings } from '../verifier.js';

const ADMIN_USER = 'admin@lab.local';
const ADMIN_PASS = 'admin-pass-01';
// Must match the probe's throwaway-account canary password.
const LOW_PRIV_PASSWORD = 'dm-referer-low-pass-01';

// Mock lab: login + registration + one admin route. `mode` picks
// how the admin route treats a low-privilege token:
//   'vulnerable'  — grants only with a Referer on the admin path
//   'secure'      — denies every low-privilege request
//   'public'      — grants every low-privilege request
//   'any-referer' — grants with any Referer at all (benign too)
//   'flaky'       — grants the forged Referer once, then denies
async function startLab(mode) {
  const registered = new Set();
  let forgedGrants = 0;
  let hits = 0;
  const srv = http.createServer((req, res) => {
    hits += 1;
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch {
        body = {};
      }
      const send = (status, obj) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      const u = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'POST' && u.pathname === '/api/login') {
        const who = body.email || body.username;
        if (who === ADMIN_USER && body.password === ADMIN_PASS) {
          return send(200, { authentication: { token: 'admin-token' } });
        }
        if (registered.has(who) && body.password === LOW_PRIV_PASSWORD) {
          return send(200, { authentication: { token: 'low-token' } });
        }
        return send(401, { error: 'bad credentials' });
      }
      if (req.method === 'POST' && u.pathname === '/api/Users') {
        if (typeof body.email === 'string' && body.email) {
          registered.add(body.email);
          return send(201, { id: 1, email: body.email });
        }
        return send(400, { error: 'email required' });
      }
      if (req.method === 'POST' && u.pathname === '/admin/users') {
        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        const referer = req.headers.referer || '';
        if (token === 'admin-token') return send(200, { users: [{ id: 1 }] });
        if (token !== 'low-token') return send(403, { error: 'forbidden' });
        if (mode === 'secure') return send(403, { error: 'forbidden' });
        if (mode === 'public') return send(200, { result: 'admin action done', users: [] });
        if (mode === 'any-referer') {
          return referer ? send(200, { result: 'admin action done', users: [] }) : send(403, { error: 'forbidden' });
        }
        if (mode === 'flaky') {
          if (referer.endsWith('/admin') && forgedGrants === 0) {
            forgedGrants += 1;
            return send(200, { result: 'admin action done', users: [] });
          }
          return send(403, { error: 'forbidden' });
        }
        // 'vulnerable': only a Referer on the admin path grants.
        return referer.endsWith('/admin')
          ? send(200, { result: 'admin action done', users: [] })
          : send(403, { error: 'forbidden' });
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });
  });
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${srv.address().port}`;
  return {
    origin,
    url: `${origin}/`,
    close: () => srv.close(),
    hits: () => hits,
    apiRoutes: [`${origin}/api/login`, `${origin}/api/Users`, `${origin}/admin/users`],
  };
}

function probeOpts(lab, extra = {}) {
  return {
    allowWrite: true,
    labTargets: ['127.0.0.1'],
    labCreds: { username: ADMIN_USER, password: ADMIN_PASS },
    apiRoutes: lab.apiRoutes,
    depth: 'standard',
    ...extra,
  };
}

// ---- pure helpers ------------------------------------------------------------

test('RA-1: forgedAdminReferer points at the origin admin path', () => {
  assert.equal(forgedAdminReferer('http://lab.local'), 'http://lab.local/admin');
  assert.equal(forgedAdminReferer('http://lab.local/'), 'http://lab.local/admin');
});

test('RA-2: benignReferer is the site home', () => {
  assert.equal(benignReferer('http://lab.local'), 'http://lab.local/');
  assert.equal(benignReferer('http://lab.local/'), 'http://lab.local/');
});

test('RA-3: nonsenseReferer is a fresh random non-admin path each call', () => {
  const a = nonsenseReferer('http://lab.local');
  const b = nonsenseReferer('http://lab.local');
  assert.match(a, /^http:\/\/lab\.local\/dm-nonsense-/);
  assert.notEqual(a, b);
  assert.doesNotMatch(a, /\/admin/);
});

test('RA-4: assessRefererAccess confirms the full clean matrix', () => {
  const v = assessRefererAccess({
    adminKind: 'granted',
    benignKind: 'refused',
    forgedKind: 'granted',
    forgedRepeatKind: 'granted',
    nonsenseKind: 'refused',
  });
  assert.equal(v.verdict, 'confirmed');
});

test('RA-5: assessRefererAccess is uncalibrated without a granting admin control', () => {
  assert.equal(
    assessRefererAccess({ adminKind: 'refused', benignKind: 'refused', forgedKind: 'granted', forgedRepeatKind: 'granted', nonsenseKind: 'refused' }).verdict,
    'uncalibrated',
  );
});

test('RA-6: assessRefererAccess rejects when the benign Referer is also granted', () => {
  assert.equal(
    assessRefererAccess({ adminKind: 'granted', benignKind: 'granted', forgedKind: 'granted', forgedRepeatKind: 'granted', nonsenseKind: 'refused' }).verdict,
    'rejected',
  );
});

test('RA-7: assessRefererAccess is uncalibrated on an inconclusive benign leg', () => {
  assert.equal(
    assessRefererAccess({ adminKind: 'granted', benignKind: 'other', forgedKind: 'granted', forgedRepeatKind: 'granted', nonsenseKind: 'refused' }).verdict,
    'uncalibrated',
  );
});

test('RA-8: assessRefererAccess rejects when the forged Referer is refused', () => {
  assert.equal(
    assessRefererAccess({ adminKind: 'granted', benignKind: 'refused', forgedKind: 'refused', forgedRepeatKind: 'refused', nonsenseKind: 'refused' }).verdict,
    'rejected',
  );
});

test('RA-9: assessRefererAccess is unconfirmed when the forged success does not repeat', () => {
  assert.equal(
    assessRefererAccess({ adminKind: 'granted', benignKind: 'refused', forgedKind: 'granted', forgedRepeatKind: 'refused', nonsenseKind: 'refused' }).verdict,
    'unconfirmed',
  );
});

test('RA-10: assessRefererAccess rejects when a nonsense Referer is also granted', () => {
  assert.equal(
    assessRefererAccess({ adminKind: 'granted', benignKind: 'refused', forgedKind: 'granted', forgedRepeatKind: 'granted', nonsenseKind: 'granted' }).verdict,
    'rejected',
  );
});

test('RA-11: assessRefererAccess is uncalibrated on an inconclusive nonsense leg', () => {
  assert.equal(
    assessRefererAccess({ adminKind: 'granted', benignKind: 'refused', forgedKind: 'granted', forgedRepeatKind: 'granted', nonsenseKind: 'other' }).verdict,
    'uncalibrated',
  );
});

test('RA-12: probe meta names the phase and its depths', () => {
  assert.deepEqual(__refererAccessControlMeta.phases, ['referer-access-control']);
  assert.deepEqual(__refererAccessControlMeta.depth, ['standard', 'deep']);
});

// ---- gates -------------------------------------------------------------------

test('RA-13: gate — no labCreds means no requests at all', async () => {
  const lab = await startLab('vulnerable');
  try {
    const findings = await probeRefererAccessControl(lab.url, {
      allowWrite: true,
      labTargets: ['127.0.0.1'],
      apiRoutes: lab.apiRoutes,
    });
    assert.equal(findings.length, 0);
    assert.equal(lab.hits(), 0);
  } finally {
    lab.close();
  }
});

test('RA-14: gate — allowWrite false means no requests at all', async () => {
  const lab = await startLab('vulnerable');
  try {
    const findings = await probeRefererAccessControl(lab.url, probeOpts(lab, { allowWrite: false }));
    assert.equal(findings.length, 0);
    assert.equal(lab.hits(), 0);
  } finally {
    lab.close();
  }
});

test('RA-15: gate — non-lab host means no requests at all', async () => {
  const lab = await startLab('vulnerable');
  try {
    const findings = await probeRefererAccessControl(lab.url, probeOpts(lab, { labTargets: ['10.0.0.99'] }));
    assert.equal(findings.length, 0);
    assert.equal(lab.hits(), 0);
  } finally {
    lab.close();
  }
});

test('RA-16: gate — quick depth skips the probe', async () => {
  const lab = await startLab('vulnerable');
  try {
    const findings = await probeRefererAccessControl(lab.url, probeOpts(lab, { depth: 'quick' }));
    assert.equal(findings.length, 0);
    assert.equal(lab.hits(), 0);
  } finally {
    lab.close();
  }
});

// ---- probe behaviour (real lab listener, default transport) ------------------

test('RA-17: Referer-gated admin route confirms', async () => {
  const lab = await startLab('vulnerable');
  try {
    const diag = {};
    const findings = await probeRefererAccessControl(lab.url, { ...probeOpts(lab), diagnostics: diag });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'referer_access_control');
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].param, 'Referer');
    assert.equal(findings[0].url, `${lab.origin}/admin/users`);
    assert.match(findings[0].title, /forged Referer/);
    assert.equal(findings[0].evidence.signalCorrelated, true);
    assert.equal(findings[0].evidence.bypassWorks, true);
    assert.equal(diag.adminRoutes, 2); // /api/Users is mined as an admin route too (Juice user list), but its admin control answers 400 so the probe skips it and confirms on /admin/users
    assert.equal(diag.registerOk, true);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.bypassKind, 'forged-referer-admin-path');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.filter((f) => f.class === 'referer_access_control').length, 1);
  } finally {
    lab.close();
  }
});

test('RA-18: properly authorized admin route stays quiet', async () => {
  const lab = await startLab('secure');
  try {
    const findings = await probeRefererAccessControl(lab.url, probeOpts(lab));
    assert.equal(findings.length, 0);
  } finally {
    lab.close();
  }
});

test('RA-19: public admin route stays quiet (benign Referer veto)', async () => {
  const lab = await startLab('public');
  try {
    const findings = await probeRefererAccessControl(lab.url, probeOpts(lab));
    assert.equal(findings.length, 0);
  } finally {
    lab.close();
  }
});

test('RA-20: any-Referer gate stays quiet (nonsense/benign veto)', async () => {
  const lab = await startLab('any-referer');
  try {
    const findings = await probeRefererAccessControl(lab.url, probeOpts(lab));
    assert.equal(findings.length, 0);
  } finally {
    lab.close();
  }
});

test('RA-21: forged success that does not repeat stays quiet', async () => {
  const lab = await startLab('flaky');
  try {
    const findings = await probeRefererAccessControl(lab.url, probeOpts(lab));
    assert.equal(findings.length, 0);
  } finally {
    lab.close();
  }
});

test('RA-22: no admin route in the route set stays quiet', async () => {
  const lab = await startLab('vulnerable');
  try {
    const findings = await probeRefererAccessControl(
      lab.url,
      probeOpts(lab, { apiRoutes: [`${lab.origin}/api/login`, `${lab.origin}/api/Users`] }),
    );
    assert.equal(findings.length, 0);
  } finally {
    lab.close();
  }
});

test('RA-23: network errors never crash the probe', async () => {
  const findings = await probeRefererAccessControl('http://127.0.0.1:1/', {
    allowWrite: true,
    labTargets: ['127.0.0.1'],
    labCreds: { username: ADMIN_USER, password: ADMIN_PASS },
    apiRoutes: ['http://127.0.0.1:1/api/login', 'http://127.0.0.1:1/api/Users', 'http://127.0.0.1:1/admin/users'],
  });
  assert.equal(findings.length, 0);
});
