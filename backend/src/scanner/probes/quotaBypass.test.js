// Tests for the limit / quota bypass probe
// (coverage row #81 [Medium] Limit / Quota Bypass, WSTG-BUSL;
// phase 103).
// No network, no lab — the probe talks to the shop only through
// the opts.fetchFn seam, stubbed here by a stateful fake API:
// GET /api/Products (and /api/Feedbacks) answer a JSON list.
// Behaviour flags flip the fake between a vulnerable API (no
// throttle at any volume) and a safe one (429 / Retry-After /
// refusal text / 500 at a chosen request).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeQuotaBypass,
  findApiRoutes,
  hasRetryAfter,
  assessApiResponse,
  assessQuotaBurst,
} from './quotaBypass.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/api/Products',
  'http://lab.local/rest/products/search',
  'http://lab.local/rest/user/login',
  'http://lab.local/api/Users',
  'http://other.local/api/Products',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- stateful fake API ------------------------------------------------------
// behavior is keyed by pathname: { throttleAt, retryAfterAt,
// refuseTextAt, error500At, control404 } — each counts GETs to
// that path INCLUDING the control GET (request 1), so throttleAt
// 5 means the control + 4 burst GETs succeed and the 5th burst
// GET is throttled.
function makeFakeApi(behaviorByPath = {}) {
  const state = { counts: {}, calls: [] };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    state.calls.push(`${method} ${u.pathname}`);
    state.counts[u.pathname] = (state.counts[u.pathname] || 0) + 1;
    const n = state.counts[u.pathname];
    const b = behaviorByPath[u.pathname] || {};
    const headers = (retryAfter) => ({
      get: (name) => (String(name).toLowerCase() === 'retry-after' ? retryAfter : null),
    });
    const json = (status, obj, retryAfter = null) => ({
      status,
      text: async () => JSON.stringify(obj),
      headers: headers(retryAfter),
    });
    if (b.control404 && n === 1) {
      return json(404, { status: 'error', message: 'not found' });
    }
    if (b.throttleAt && n === b.throttleAt) {
      return json(429, { status: 'error', message: 'Too many requests' });
    }
    if (b.retryAfterAt && n === b.retryAfterAt) {
      return json(200, { status: 'success', data: [{ id: 1 }] }, '60');
    }
    if (b.refuseTextAt && n === b.refuseTextAt) {
      return json(200, { status: 'error', message: 'Rate limit exceeded, slow down' });
    }
    if (b.error500At && n === b.error500At) {
      return json(500, { status: 'error', message: 'internal error' });
    }
    return json(200, { status: 'success', data: [{ id: 1 }, { id: 2 }] });
  };
  return { state, fetchFn };
}

// ---- pure assessors ---------------------------------------------------------

describe('assessApiResponse', () => {
  it('QB-1: a 2xx JSON answer is granted; an empty or HTML 2xx is other', () => {
    assert.equal(assessApiResponse(200, '{"status":"ok"}', null).kind, 'granted');
    assert.equal(assessApiResponse(200, '[{"id":1}]', null).kind, 'granted');
    assert.equal(assessApiResponse(200, '', null).kind, 'other');
    assert.equal(assessApiResponse(200, '<html><body>shop</body></html>', null).kind, 'other');
  });
  it('QB-2: throttle signals are throttled — 429, Retry-After, refusal text on any status', () => {
    assert.equal(assessApiResponse(429, '{"status":"error"}', null).kind, 'throttled');
    assert.equal(
      assessApiResponse(200, '{"status":"success"}', { get: (n) => (n === 'retry-after' ? '60' : null) }).kind,
      'throttled'
    );
    assert.equal(
      assessApiResponse(200, '{"status":"success"}', { 'Retry-After': '120' }).kind,
      'throttled'
    );
    assert.equal(
      assessApiResponse(200, '{"message":"Too many requests"}', null).kind,
      'throttled'
    );
    assert.equal(
      assessApiResponse(400, '{"message":"Rate limit exceeded"}', null).kind,
      'throttled'
    );
    assert.equal(
      assessApiResponse(200, '{"message":"quota exceeded for this key"}', null).kind,
      'throttled'
    );
  });
  it('QB-3: auth-required, missing and server-error answers are other', () => {
    assert.equal(assessApiResponse(401, '{"status":"error"}', null).kind, 'other');
    assert.equal(assessApiResponse(403, '{"status":"error"}', null).kind, 'other');
    assert.equal(assessApiResponse(404, '{"status":"error"}', null).kind, 'other');
    assert.equal(assessApiResponse(500, '{"status":"error"}', null).kind, 'other');
    assert.equal(assessApiResponse(302, '', null).kind, 'other');
  });
});

describe('hasRetryAfter', () => {
  it('QB-4: Headers-like, plain object and null are all handled', () => {
    assert.equal(hasRetryAfter(null), false);
    assert.equal(hasRetryAfter({ get: () => null }), false);
    assert.equal(hasRetryAfter({ get: (n) => (n === 'Retry-After' ? '30' : null) }), true);
    assert.equal(hasRetryAfter({ 'retry-after': '30' }), true);
    assert.equal(hasRetryAfter({ 'Retry-After': '30' }), true);
    assert.equal(hasRetryAfter({ 'Content-Type': 'application/json' }), false);
  });
});

describe('assessQuotaBurst', () => {
  it('QB-5: 15 granted burst answers confirm; one throttled rejects; other answers are uncalibrated', () => {
    assert.equal(assessQuotaBurst('granted', Array(15).fill('granted')).verdict, 'confirmed');
    assert.equal(
      assessQuotaBurst('granted', [...Array(4).fill('granted'), 'throttled']).verdict,
      'rejected'
    );
    assert.equal(assessQuotaBurst('other', Array(15).fill('granted')).verdict, 'uncalibrated');
    assert.equal(
      assessQuotaBurst('granted', [...Array(9).fill('granted'), 'other']).verdict,
      'uncalibrated'
    );
    assert.equal(assessQuotaBurst('granted', []).verdict, 'uncalibrated');
  });
});

describe('findApiRoutes', () => {
  it('QB-6: mines /api and /rest data routes; skips auth, basket, admin and off-origin routes', () => {
    const routes = [
      'http://lab.local/api/Products',
      'http://lab.local/rest/products/search',
      'http://lab.local/rest/user/login',
      'http://lab.local/api/Users',
      'http://lab.local/rest/basket/1',
      'http://lab.local/api/Coupons',
      'http://lab.local/rest/admin/application-version',
      'http://lab.local/api/Products?x=1',
      'http://other.local/api/Products',
      'http://lab.local/',
    ];
    assert.deepEqual(findApiRoutes(routes, ORIGIN), [
      'http://lab.local/api/Products',
      'http://lab.local/rest/products/search',
    ]);
    assert.deepEqual(findApiRoutes([], ORIGIN), []);
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeQuotaBypass — vulnerable API', () => {
  it('QB-7: a control + 15 identical GETs with no throttle fires exactly one [Medium] business_logic finding', async () => {
    const { state, fetchFn } = makeFakeApi();
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /without rate limiting/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].class, 'business_logic');
    assert.equal(findings[0].parameter, 'rate-limit');
    assert.equal(findings[0].url, 'http://lab.local/api/Products');
    assert.equal(diag.apiRoutes, 2);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 15);
    assert.equal(diag.bypassKind, 'no-rate-limit');
    assert.equal(state.counts['/api/Products'], 16, '1 control + 15 burst GETs');
    assert.ok(state.calls.every((c) => c.startsWith('GET ')), 'the burst is GETs only — no writes');
  });
  it('QB-8: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeApi();
    const findings = await probeQuotaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
});

describe('probeQuotaBypass — throttling API', () => {
  it('QB-9: a 429 on the 5th burst GET stops the probe with zero findings', async () => {
    const { state, fetchFn } = makeFakeApi({ '/api/Products': { throttleAt: 6 } });
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ['http://lab.local/api/Products'],
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.throttled, true);
    assert.equal(diag.attempts, 5, 'stops on the throttle, never retries');
    assert.equal(state.counts['/api/Products'], 6, '1 control + 5 burst GETs, then stop');
  });
  it('QB-10: a Retry-After header on a burst answer stops the probe with zero findings', async () => {
    const { fetchFn } = makeFakeApi({ '/api/Products': { retryAfterAt: 4 } });
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ['http://lab.local/api/Products'],
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.throttled, true);
  });
  it('QB-11: a rate-limit refusal text in a burst body stops the probe with zero findings', async () => {
    const { fetchFn } = makeFakeApi({ '/api/Products': { refuseTextAt: 3 } });
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ['http://lab.local/api/Products'],
    });
    assert.deepEqual(findings, []);
  });
});

describe('probeQuotaBypass — uncalibrated and multi-candidate', () => {
  it('QB-12: a 404 control is uncalibrated — zero findings, control never set', async () => {
    const { fetchFn } = makeFakeApi({ '/api/Products': { control404: true } });
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ['http://lab.local/api/Products'],
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
  });
  it('QB-13: a 500 mid-burst is inconclusive — zero findings (all-granted rule)', async () => {
    const { state, fetchFn } = makeFakeApi({ '/api/Products': { error500At: 11 } });
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ['http://lab.local/api/Products'],
    });
    assert.deepEqual(findings, []);
    assert.equal(state.counts['/api/Products'], 16, 'control + 15 burst GETs, the 10th burst is the 500');
  });
  it('QB-14: a throttled first candidate falls through to a confirming second candidate', async () => {
    const { fetchFn } = makeFakeApi({
      '/api/Products': { throttleAt: 3 },
      '/rest/products/search': {},
    });
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, 'http://lab.local/rest/products/search');
    assert.equal(diag.throttled, true, 'the first route throttled');
    assert.equal(diag.bypassKind, 'no-rate-limit');
  });
});

describe('probeQuotaBypass — missing surface and gates', () => {
  it('QB-15: no API route yields zero findings', async () => {
    const { fetchFn } = makeFakeApi();
    const routes = ROUTES.filter((r) => !/api|rest/i.test(r) || /login/i.test(r));
    assert.deepEqual(await probeQuotaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: routes }), []);
  });
  it('QB-16: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { fetchFn } = makeFakeApi();
    assert.deepEqual(await probeQuotaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeQuotaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeQuotaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeQuotaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeQuotaBypass('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
  });
});
