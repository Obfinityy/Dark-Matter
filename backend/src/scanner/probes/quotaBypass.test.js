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
  deriveCollectionUrl,
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
// refuseTextAt, error500At, control404, always } — each counts GETs to
// that path INCLUDING the control GET (request 1), so throttleAt
// 5 means the control + 4 burst GETs succeed and the 5th burst
// GET is throttled. `always` answers every GET to the path with
// that status (a 401-gated collection, a 500-broken one) — the
// live Juice shape, where /api/Users + /api/BasketItems 401 and
// /rest/track-order 500s on every request.
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
    if (b.always) {
      return json(b.always, { status: 'error', message: 'not granted' });
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
    // Control-pass cap is MAX_CANDIDATES (12): every valid route is
    // a candidate and the probe control-probes them in order, so
    // /api/Users survives the list (its control fails live, 401).
    assert.deepEqual(findApiRoutes(routes, ORIGIN), [
      'http://lab.local/api/Products',
      'http://lab.local/rest/products/search',
      'http://lab.local/api/Users',
    ]);
    assert.deepEqual(findApiRoutes([], ORIGIN), []);
  });
  it('QB-26: findApiRoutes keeps twelve derived collections — the old cap of two cut the list', () => {
    const feed = Array.from({ length: 13 }, (_, i) => `http://lab.local/api/Items${i}/dmprobe${i}_aa11`);
    const got = findApiRoutes(feed, ORIGIN);
    assert.equal(got.length, 12);
    assert.equal(got[0], 'http://lab.local/api/Items0');
    assert.equal(got[11], 'http://lab.local/api/Items11');
  });
});

describe('deriveCollectionUrl', () => {
  it('QB-17: a filler last segment yields the parent collection; real names, bare collections and non-API parents yield null', () => {
    assert.equal(
      deriveCollectionUrl('http://lab.local/api/Feedbacks/dmprobe4_2e69'),
      'http://lab.local/api/Feedbacks'
    );
    assert.equal(deriveCollectionUrl('http://lab.local/api/Products/123'), 'http://lab.local/api/Products');
    assert.equal(
      deriveCollectionUrl('http://lab.local/api/Users/550e8400-e29b-41d4-a716-446655440000'),
      'http://lab.local/api/Users'
    );
    assert.equal(deriveCollectionUrl('http://lab.local/rest/items/a1b2c3d4e5f6'), 'http://lab.local/rest/items');
    assert.equal(deriveCollectionUrl('http://lab.local/api/Orders/x7k9m2pq'), 'http://lab.local/api/Orders');
    assert.equal(
      deriveCollectionUrl('http://lab.local/api/Feedbacks/dmprobe4_2e69?x=1'),
      'http://lab.local/api/Feedbacks'
    );
    assert.equal(deriveCollectionUrl('http://lab.local/api/Products'), null);
    assert.equal(deriveCollectionUrl('http://lab.local/api/Products/apple-juice'), null);
    assert.equal(deriveCollectionUrl('http://lab.local/rest/products/search'), null);
    assert.equal(deriveCollectionUrl('http://lab.local/shop/Feedbacks/dmprobe4_2e69'), null);
    assert.equal(deriveCollectionUrl('http://lab.local/api/dmprobe4_2e69'), null);
    assert.equal(deriveCollectionUrl('http://lab.local/api/Baskets/123'), null);
    assert.equal(deriveCollectionUrl('not a url'), null);
  });
  it('QB-18: findApiRoutes puts derived collections first; the templated item URLs follow behind them', () => {
    assert.deepEqual(
      findApiRoutes(
        ['http://lab.local/api/Feedbacks/dmprobe4_2e69', 'http://lab.local/api/Products/123'],
        ORIGIN
      ),
      [
        'http://lab.local/api/Feedbacks',
        'http://lab.local/api/Products',
        'http://lab.local/api/Feedbacks/dmprobe4_2e69',
        'http://lab.local/api/Products/123',
      ]
    );
    assert.deepEqual(
      findApiRoutes(
        ['http://lab.local/api/Products', 'http://lab.local/api/Feedbacks/dmprobe4_2e69'],
        ORIGIN
      ),
      [
        'http://lab.local/api/Feedbacks',
        'http://lab.local/api/Products',
        'http://lab.local/api/Feedbacks/dmprobe4_2e69',
      ]
    );
    assert.deepEqual(
      findApiRoutes(
        ['http://lab.local/api/Feedbacks', 'http://lab.local/api/Feedbacks/dmprobe4_2e69'],
        ORIGIN
      ),
      ['http://lab.local/api/Feedbacks', 'http://lab.local/api/Feedbacks/dmprobe4_2e69']
    );
    // Three templated routes derive three collections — the old
    // cap of 2 cut the third; the control-pass cap keeps all of
    // them (derived first, then the item URLs) and the probe
    // control-probes in order.
    assert.deepEqual(
      findApiRoutes(
        [
          'http://lab.local/api/Feedbacks/dmprobe1_aa11',
          'http://lab.local/api/Products/123',
          'http://lab.local/rest/items/a1b2c3d4',
        ],
        ORIGIN
      ),
      [
        'http://lab.local/api/Feedbacks',
        'http://lab.local/api/Products',
        'http://lab.local/rest/items',
        'http://lab.local/api/Feedbacks/dmprobe1_aa11',
        'http://lab.local/api/Products/123',
        'http://lab.local/rest/items/a1b2c3d4',
      ]
    );
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
    assert.equal(diag.apiRoutes, 3, 'Products + search + Users are all candidates now');
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

  it('QB-19: Juice shape — only a templated write target is mined, its derived collection grants and the burst confirms', async () => {
    const { state, fetchFn } = makeFakeApi({
      '/api/Feedbacks/dmprobe4_2e69': { control404: true },
    });
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ['http://lab.local/api/Feedbacks/dmprobe4_2e69'],
      diagnostics: diag,
    });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.equal(findings[0].url, 'http://lab.local/api/Feedbacks');
    assert.equal(findings[0].class, 'business_logic');
    assert.equal(diag.apiRoutes, 2, 'collection + templated item URL are both candidates');
    assert.equal(diag.derivedCollections, 1, 'the collection was derived, never mined directly');
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 15);
    assert.equal(diag.bypassKind, 'no-rate-limit');
    assert.equal(state.counts['/api/Feedbacks'], 16, '1 control + 15 burst GETs on the collection');
    assert.equal(state.counts['/api/Feedbacks/dmprobe4_2e69'], undefined, 'the templated item URL is never fetched');
  });
  it('QB-20: a derived collection that also fails to grant stays uncalibrated — zero findings', async () => {
    const { fetchFn } = makeFakeApi({
      '/api/Feedbacks/dmprobe4_2e69': { control404: true },
      '/api/Feedbacks': { control404: true },
    });
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ['http://lab.local/api/Feedbacks/dmprobe4_2e69'],
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, undefined);
    assert.equal(diag.derivedCollections, 1);
  });
  it('QB-21: a throttling derived collection proves the limit — zero findings, moves on', async () => {
    const { fetchFn } = makeFakeApi({
      '/api/Feedbacks': { throttleAt: 3 },
      '/api/Feedbacks/dmprobe4_2e69': { control404: true },
    });
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: ['http://lab.local/api/Feedbacks/dmprobe4_2e69'],
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.throttled, true);
    assert.equal(diag.attempts, 2, 'control + 1 burst grant, then the 429 stops the burst');
  });
});

describe('probeQuotaBypass — live Juice feed (proof #34)', () => {
  // The EXACT feed the scanner mined live from Juice Shop on 9 Nov
  // 2026 (EC2 repro, 4 bundles, 20 GET targets + 20 write targets),
  // origin swapped to lab.local. Nine derived collections; the
  // /api/Feedbacks collection is 8th in derived order. The old
  // cap of 2 tried only /api/Users + /api/BasketItems (both 401
  // live) and the probe ended attempts 0 — proof #34 INCONCLUSIVE.
  const JUICE_FEED = [
    'http://lab.local/',
    'http://lab.local/api/Users/dmprobe1_4732?e=dmprobe1_4732',
    'http://lab.local/rest/basket/dmprobe2_8d6c?e=dmprobe2_8d6c',
    'http://lab.local/api/BasketItems/dmprobe3_23d3?e=dmprobe3_23d3',
    'http://lab.local/api/BasketItems',
    'http://lab.local/rest/user/whoami',
    'http://lab.local/rest/saveLoginIp',
    'http://lab.local/rest/2fa/status',
    'http://lab.local/api/Challenges/?key=dmprobe4_1a89',
    'http://lab.local/rest/track-order/dmprobe5_9532?e=dmprobe5_9532',
    'http://lab.local/rest/products/dmprobe6_2936/reviews?e=dmprobe6_2936',
    'http://lab.local/rest/products/search?q=dmprobe7_621a',
    'http://lab.local/api/Products/dmprobe8_5d36?d=dmprobe9_2fbe&e=dmprobe8_5d36',
    'http://lab.local/api/Addresss/dmprobe10_3061?e=dmprobe10_3061',
    'http://lab.local/api/Deliverys/dmprobe11_f4bd?e=dmprobe11_f4bd',
    'http://lab.local/api/Cards/dmprobe12_b739?e=dmprobe12_b739',
    'http://lab.local/snippets/dmprobe13_ffdf?e=dmprobe13_ffdf',
    'http://lab.local/snippets/fixes/dmprobe14_5c9d?e=dmprobe14_5c9d',
    'http://lab.local/rest/web3',
    'http://lab.local/api/Challenges',
    'http://lab.local/api/Users',
    'http://lab.local/api/Users/',
    'http://lab.local/rest/user/login',
    'http://lab.local/api/BasketItems/',
    'http://lab.local/rest/basket/dmprobe1_b898/checkout',
    'http://lab.local/rest/basket/dmprobe2_7a90/coupon/dmprobe3_b5e4',
    'http://lab.local/rest/memories',
    'http://lab.local/snippets/fixes',
    'http://lab.local/snippets/verdict',
    'http://lab.local/rest/web3/submitKey',
    'http://lab.local/rest/web3/walletNFTVerify',
    'http://lab.local/rest/web3/walletExploitAddress',
    'http://lab.local/rest/user/reset-password',
    'http://lab.local/api/Feedbacks/dmprobe4_dc2c',
    'http://lab.local/api/SecurityAnswers/',
    'http://lab.local/rest/products/reviews',
    'http://lab.local/api/Quantitys/dmprobe5_218d',
    'http://lab.local/api/Complaints/',
    'http://lab.local/rest/chatbot/respond',
    'http://lab.local/api/Addresss/',
    'http://lab.local/rest/2fa/verify',
  ];
  it('QB-22: live Juice feed — nine derived collections, /api/Feedbacks 8th; the control pass reaches the granting /api/Products past the 401s', async () => {
    const { state, fetchFn } = makeFakeApi({
      '/api/Users': { always: 401 },
      '/api/BasketItems': { always: 401 },
      '/rest/track-order': { always: 500 },
    });
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: JUICE_FEED,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.equal(findings[0].url, 'http://lab.local/api/Products');
    assert.equal(findings[0].class, 'business_logic');
    assert.equal(diag.apiRoutes, 12, '9 derived + 3 originals under the control-pass cap');
    assert.equal(
      diag.derivedCollections,
      7,
      '7 of the 9 derived collections were never mined bare — /api/Users + /api/BasketItems were also mined as bare GET targets, so they do not count as derived-only'
    );
    assert.deepEqual(diag.candidates.slice(0, 9), [
      'http://lab.local/api/Users',
      'http://lab.local/api/BasketItems',
      'http://lab.local/rest/track-order',
      'http://lab.local/api/Products',
      'http://lab.local/api/Addresss',
      'http://lab.local/api/Deliverys',
      'http://lab.local/api/Cards',
      'http://lab.local/api/Feedbacks',
      'http://lab.local/api/Quantitys',
    ]);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 15);
    assert.equal(diag.bypassKind, 'no-rate-limit');
    assert.equal(state.calls.length, 19, '3 failed controls + 1 control + 15 burst GETs');
    assert.equal(state.counts['/api/Products'], 16, '1 control + 15 burst GETs on the collection');
    assert.equal(state.counts['/api/Feedbacks'], undefined, 'the probe stops at the first confirming route');
  });
  it('QB-23: live Juice feed with every earlier collection gated — the control pass walks all the way to /api/Feedbacks and confirms there', async () => {
    const { state, fetchFn } = makeFakeApi({
      '/api/Users': { always: 401 },
      '/api/BasketItems': { always: 401 },
      '/rest/track-order': { always: 500 },
      '/api/Products': { control404: true },
      '/api/Addresss': { always: 401 },
      '/api/Deliverys': { control404: true },
      '/api/Cards': { always: 401 },
    });
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: JUICE_FEED,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.equal(findings[0].url, 'http://lab.local/api/Feedbacks');
    assert.equal(diag.derivedCollections, 7, 'see QB-22: Users + BasketItems were also mined bare');
    assert.equal(diag.attempts, 15);
    assert.equal(state.calls.length, 23, '7 failed controls + 1 control + 15 burst GETs');
    assert.equal(state.counts['/api/Feedbacks'], 16, '1 control + 15 burst GETs on the collection');
  });
  it('QB-24: budget — twelve failing controls cost twelve GETs and nothing more', async () => {
    const feed = Array.from({ length: 12 }, (_, i) => `http://lab.local/api/Items${i}/dmprobe${i}_aa11`);
    const behavior = {};
    for (let i = 0; i < 12; i++) behavior[`/api/Items${i}`] = { control404: true };
    const { state, fetchFn } = makeFakeApi(behavior);
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: feed,
      diagnostics: diag,
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.apiRoutes, 12);
    assert.equal(diag.derivedCollections, 12);
    assert.equal(diag.controlOk, undefined);
    assert.equal(state.calls.length, 12, 'one control GET per candidate, no burst without a grant');
  });
  it('QB-25: budget — a granting collection in the 12th slot still confirms within 32 GETs', async () => {
    const feed = Array.from({ length: 12 }, (_, i) => `http://lab.local/api/Items${i}/dmprobe${i}_aa11`);
    const behavior = {};
    for (let i = 0; i < 11; i++) behavior[`/api/Items${i}`] = { control404: true };
    const { state, fetchFn } = makeFakeApi(behavior);
    const diag = {};
    const findings = await probeQuotaBypass('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: feed,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.equal(findings[0].url, 'http://lab.local/api/Items11');
    assert.equal(diag.attempts, 15);
    assert.equal(state.calls.length, 27, '11 failed controls + 1 control + 15 burst GETs, inside the 32 budget');
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
