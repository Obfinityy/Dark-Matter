// Tests for the workflow data-exposure probe
// (coverage row #375 [Medium] Logic — Excessive data exposure in
// workflows, CWE-200 | OWASP A04:2021; phase 103,
// 'workflow-data-exposure').
//
// The probe walks an authenticated workflow (login -> basket ->
// whoami -> address -> checkout) against a stateful fake Juice
// Shop and inspects each step's genuine server response for fields
// beyond the step's need. Behaviour flags flip the fake between a
// leaky shop and a safe one: secretInBasket (a TOTP secret rides
// in the basket response), otherUserInWhoami (another user's email
// rides in the whoami response), secretInCheckout (an API key
// rides in the checkout response), secretInLogin (a password hash
// rides in the login response), maskedSecret (a masked password
// hash — never a finding), emptyBasket (seed path),
// loginWithoutBid (whoami fallback).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeWorkflowDataExposure,
  findAddressRoutes,
  flattenFields,
  normalizeKey,
  classifyExposedField,
  assessWorkflowExposure,
  __wdeMeta,
} from './workflowDataExposure.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/rest/basket/dmprobe1_ab12?e=dmprobe2_cd34',
  'http://lab.local/api/BasketItems',
  'http://lab.local/api/BasketItems/dmprobe3_ef56',
  'http://lab.local/rest/basket/dmprobe1_ab12/checkout',
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/api/Products',
  'http://lab.local/api/Address',
  'http://other.local/api/Address',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// Fake secret-shaped values — clearly-fake fixtures, never real
// secrets: a well-known example TOTP secret, a deadbeef hash, a
// lab-prefixed key.
const FAKE_TOTP = 'JBSWY3DPEHPK3PXP';
const FAKE_HASH = 'deadbeefdeadbeefdeadbeef';
const FAKE_API_KEY = 'lab-fake-key-1234';

// ---- stateful fake Juice ----------------------------------------------------

function makeFakeJuice(behavior = {}) {
  const state = {
    items: behavior.emptyBasket
      ? []
      : [{ basketItemId: '11', productId: 1, quantity: 1, unitPrice: 1.99 }],
    nextItemId: 12,
    calls: [],
  };
  const subtotal = () => state.items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const basketBody = () => {
    const data = {
      id: 7,
      Products: state.items.map((i) => ({
        id: i.productId,
        name: `Product ${i.productId}`,
        description: 'A test product for the lab workflow.',
        price: i.unitPrice,
        totalPrice: i.quantity * i.unitPrice,
        BasketItem: { id: Number(i.basketItemId), quantity: i.quantity, BasketId: 7, ProductId: i.productId },
      })),
      totalPrice: subtotal(),
    };
    if (behavior.secretInBasket) {
      data.User = { id: 7, email: 'canary@lab.local', totpSecret: FAKE_TOTP };
    }
    if (behavior.maskedSecret) {
      data.User = { id: 7, email: 'canary@lab.local', passwordHash: '********' };
    }
    return { status: 'success', data };
  };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    state.calls.push(`${method} ${u.pathname}`);
    let body = null;
    try {
      body = init.body ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    const html = (status, text) => ({ status, text: async () => text });
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      const auth = { token: 'tok-1', umail: 'canary@lab.local' };
      if (!behavior.loginWithoutBid) auth.bid = 7;
      if (behavior.secretInLogin) auth.passwordHash = FAKE_HASH;
      return json(200, { status: 'success', authentication: auth });
    }
    if (method === 'GET' && u.pathname === '/rest/user/whoami') {
      const data = { user: { id: 7, email: 'canary@lab.local' } };
      if (behavior.otherUserInWhoami) {
        data.users = [{ id: 8, email: 'other.user@lab.local' }];
      }
      return json(200, { status: 'success', data });
    }
    if (method === 'GET' && /^\/rest\/basket\/\d+$/.test(u.pathname)) {
      return json(200, basketBody());
    }
    if (method === 'GET' && u.pathname === '/api/Products') {
      return json(200, {
        status: 'success',
        data: [
          { id: 1, name: 'Apple Juice (1000ml)', price: 1.99 },
          { id: 2, name: 'Orange Juice (1000ml)', price: 3.5 },
        ],
      });
    }
    if (method === 'GET' && u.pathname === '/api/Address') {
      if (behavior.addressHtml) return html(200, '<html><body>shop</body></html>');
      return json(200, {
        status: 'success',
        data: [{ id: 1, UserId: 7, fullName: 'Canary', city: 'Labtown', country: 'IN' }],
      });
    }
    if (method === 'POST' && u.pathname === '/api/BasketItems') {
      const pid = body ? body.ProductId ?? body.productId : null;
      const qty = body ? Number(body.quantity) : NaN;
      if (pid == null || !Number.isFinite(qty)) return json(400, { status: 'error' });
      const existing = state.items.find((i) => String(i.productId) === String(pid));
      if (existing) {
        existing.quantity += qty;
      } else {
        state.items.push({
          basketItemId: String(state.nextItemId++),
          productId: pid,
          quantity: qty,
          unitPrice: 1.99,
        });
      }
      return json(201, { status: 'success', data: { id: state.nextItemId - 1 } });
    }
    if (method === 'POST' && /^\/rest\/basket\/\d+\/checkout$/.test(u.pathname)) {
      state.items = [];
      const data = { orderId: 99, totalPrice: subtotal() };
      if (behavior.secretInCheckout) data.apiKey = FAKE_API_KEY;
      return json(200, { status: 'success', data });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

// ---- route discovery + pure helpers -----------------------------------------

describe('findAddressRoutes / flattenFields / normalizeKey', () => {
  it('WDE-1: address route found, non-address + cross-origin excluded', () => {
    assert.deepEqual(findAddressRoutes(ROUTES, ORIGIN), ['http://lab.local/api/Address']);
    assert.deepEqual(findAddressRoutes(['http://lab.local/api/Products'], ORIGIN), []);
    assert.deepEqual(findAddressRoutes(['http://other.local/api/Address'], ORIGIN), []);
  });
  it('WDE-2: flattenFields walks nested objects + arrays, depth-capped', () => {
    const fields = flattenFields({
      data: { user: { id: 7, email: 'a@b.co', tags: ['x', 'y'] }, total: 1.99 },
    });
    const paths = fields.map((f) => f.path);
    assert.ok(paths.includes('data.user.id'));
    assert.ok(paths.includes('data.user.email'));
    assert.ok(paths.includes('data.user.tags[0]'));
    assert.ok(paths.includes('data.total'));
    assert.deepEqual(flattenFields({ a: { b: { c: { d: { e: { f: 'deep' } } } } } }), []);
    assert.deepEqual(flattenFields(null), []);
    assert.deepEqual(flattenFields('plain'), []);
  });
  it('WDE-3: normalizeKey strips separators + case', () => {
    assert.equal(normalizeKey('passwordHash'), 'passwordhash');
    assert.equal(normalizeKey('password_hash'), 'passwordhash');
    assert.equal(normalizeKey('API-Key'), 'apikey');
    assert.equal(normalizeKey('totpSecret'), 'totpsecret');
  });
});

// ---- field classification ---------------------------------------------------

describe('classifyExposedField', () => {
  it('WDE-4: secret keys classify as secret; token / id / role never do', () => {
    for (const key of ['passwordHash', 'password_hash', 'passwd', 'totpSecret', 'setupToken', 'apiKey', 'privateKey']) {
      const judged = classifyExposedField({ path: `data.${key}`, key, value: 'some-value-here' }, 'canary@lab.local');
      assert.ok(judged && judged.kind === 'secret', `${key} must classify as secret`);
    }
    const card = classifyExposedField({ path: 'data.cardNumber', key: 'cardNumber', value: '4111111111111111' }, null);
    assert.ok(card && card.kind === 'secret');
    for (const key of ['token', 'accessToken', 'jwt', 'id', 'userId', 'basketId', 'role', 'isAdmin', 'email']) {
      assert.equal(
        classifyExposedField({ path: `data.${key}`, key, value: 'some-value-here' }, 'canary@lab.local'),
        null,
        `${key} must never classify`
      );
    }
  });
  it('WDE-5: masked / short / non-card values never classify', () => {
    assert.equal(
      classifyExposedField({ path: 'data.passwordHash', key: 'passwordHash', value: '********' }, null),
      null
    );
    assert.equal(classifyExposedField({ path: 'data.passwordHash', key: 'passwordHash', value: 'abc' }, null), null);
    assert.equal(classifyExposedField({ path: 'data.passwordHash', key: 'passwordHash', value: '' }, null), null);
    assert.equal(
      classifyExposedField({ path: 'data.cardNumber', key: 'cardNumber', value: '1234' }, null),
      null
    );
    assert.equal(
      classifyExposedField({ path: 'data.cardNumber', key: 'cardNumber', value: 'not-a-card' }, null),
      null
    );
  });
  it('WDE-6: another user\u2019s email classifies; own email, unknown reference, display text never do', () => {
    const other = classifyExposedField(
      { path: 'data.users[0].email', key: 'email', value: 'other.user@lab.local' },
      'canary@lab.local'
    );
    assert.ok(other && other.kind === 'other-user');
    assert.equal(
      classifyExposedField({ path: 'data.user.email', key: 'email', value: 'canary@lab.local' }, 'canary@lab.local'),
      null
    );
    assert.equal(
      classifyExposedField({ path: 'data.user.email', key: 'email', value: 'CANARY@LAB.LOCAL' }, 'canary@lab.local'),
      null
    );
    // No calibrated reference: any email could be the canary's own.
    assert.equal(
      classifyExposedField({ path: 'data.user.email', key: 'email', value: 'other.user@lab.local' }, null),
      null
    );
    // An email inside display text is not an identity record.
    assert.equal(
      classifyExposedField(
        { path: 'data.Products[0].description', key: 'description', value: 'mail support@lab.local for help' },
        'canary@lab.local'
      ),
      null
    );
  });
});

// ---- step judgement ---------------------------------------------------------

describe('assessWorkflowExposure', () => {
  it('WDE-7: confirmed on an excessive field, rejected on a clean step, unconfirmed off-JSON', () => {
    const conf = assessWorkflowExposure('basket', 200, { data: { User: { totpSecret: FAKE_TOTP } } }, 'canary@lab.local');
    assert.equal(conf.verdict, 'confirmed');
    assert.equal(conf.exposed.length, 1);
    assert.equal(conf.exposed[0].kind, 'secret');
    assert.equal(
      assessWorkflowExposure('basket', 200, { data: { id: 7, totalPrice: 1.99 } }, 'canary@lab.local').verdict,
      'rejected'
    );
    assert.equal(assessWorkflowExposure('basket', 404, { status: 'error' }, null).verdict, 'unconfirmed');
    assert.equal(assessWorkflowExposure('basket', 200, null, null).verdict, 'unconfirmed');
    assert.equal(assessWorkflowExposure('basket', 200, 'not json', null).verdict, 'unconfirmed');
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeWorkflowDataExposure — leaky shop', () => {
  it('WDE-8: a TOTP secret in the basket response fires exactly once', async () => {
    const { state, fetchFn } = makeFakeJuice({ secretInBasket: true });
    const diag = {};
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /exposes data beyond the step/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].class, 'business_logic');
    assert.equal(findings[0].parameter, 'data.User.totpSecret');
    assert.equal(diag.controlOk, true);
    assert.ok(diag.workflowRoutes >= 1);
    assert.ok(diag.stepsInspected >= 2, 'login + basket must both be inspected');
    assert.equal(diag.exposedKind, 'secret');
    assert.ok(state.calls.some((c) => c === 'GET /rest/basket/7'), 'basket GET must use the canary id 7');
    assert.ok(!state.calls.some((c) => /dmprobe/.test(c)), 'no filler id may reach the shop');
  });
  it('WDE-9: another user\u2019s email in the whoami response fires', async () => {
    const { fetchFn } = makeFakeJuice({ otherUserInWhoami: true });
    const diag = {};
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /exposes data beyond the step/);
    assert.equal(findings[0].parameter, 'data.users[0].email');
    assert.equal(diag.exposedKind, 'other-user');
  });
  it('WDE-10: an API key in the checkout response fires (checkout step inspected)', async () => {
    const { state, fetchFn } = makeFakeJuice({ secretInCheckout: true });
    const diag = {};
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.equal(findings[0].parameter, 'data.apiKey');
    assert.equal(diag.exposedKind, 'secret');
    assert.ok(state.calls.some((c) => c === 'POST /rest/basket/7/checkout'), 'checkout step must run');
  });
  it('WDE-11: a password hash in the login response fires at step 1', async () => {
    const { fetchFn } = makeFakeJuice({ secretInLogin: true });
    const diag = {};
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.equal(findings[0].parameter, 'authentication.passwordHash');
    assert.equal(diag.stepsInspected, 1, 'the probe must stop at the first confirmed step');
  });
  it('WDE-16: an empty basket is seeded, then the checkout secret fires', async () => {
    const { state, fetchFn } = makeFakeJuice({ secretInCheckout: true, emptyBasket: true });
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'data.apiKey');
    assert.ok(state.calls.some((c) => c === 'GET /api/Products'), 'seed path must fetch the product list');
    assert.ok(state.calls.some((c) => c === 'POST /api/BasketItems'), 'seed path must add an item');
  });
  it('WDE-17: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeJuice({ secretInBasket: true });
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
  it('WDE-19: login without a basket id falls back to the whoami user id, then the leak fires', async () => {
    const { state, fetchFn } = makeFakeJuice({ secretInBasket: true, loginWithoutBid: true });
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.ok(state.calls.some((c) => c === 'GET /rest/user/whoami'), 'whoami fallback must run');
    assert.ok(state.calls.some((c) => c === 'GET /rest/basket/7'), 'basket id must come from whoami');
  });
});

describe('probeWorkflowDataExposure — safe shop', () => {
  it('WDE-12: a clean workflow yields zero findings and inspects every step', async () => {
    const { state, fetchFn } = makeFakeJuice();
    const diag = {};
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.stepsInspected, 5, 'login + basket + whoami + address + checkout must all be inspected');
    assert.ok(state.calls.some((c) => c === 'GET /api/Address'), 'address step must run');
    assert.ok(state.calls.some((c) => c === 'POST /rest/basket/7/checkout'), 'checkout step must run');
  });
  it('WDE-13: the canary\u2019s own email everywhere yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
  it('WDE-14: session-token fields in the login response yield zero findings', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
  it('WDE-15: a masked password hash yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ maskedSecret: true });
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
  it('WDE-21: a non-JSON step response is skipped, not treated as exposure', async () => {
    const { fetchFn } = makeFakeJuice({ addressHtml: true });
    const diag = {};
    const findings = await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.stepsInspected, 4, 'the HTML address step must not count as inspected');
  });
});

describe('probeWorkflowDataExposure — gates', () => {
  it('WDE-18: no lab creds, no write, non-lab host, quick depth, or no routes — all silent', async () => {
    const { fetchFn } = makeFakeJuice({ secretInBasket: true });
    assert.deepEqual(await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, labCreds: null }), []);
    assert.deepEqual(await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
    assert.deepEqual(await probeWorkflowDataExposure('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] }), []);
  });
  it('WDE-20: no workflow routes at all yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ secretInBasket: true });
    const diag = {};
    const findings = await probeWorkflowDataExposure('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
      apiRoutes: ['http://lab.local/api/Products'],
    });
    assert.deepEqual(findings, []);
    assert.equal(diag.workflowRoutes, 0);
  });
});

describe('workflow-data-exposure meta', () => {
  it('WDE-22: phase 103 registration metadata', () => {
    assert.deepEqual(__wdeMeta, { phases: ['workflow-data-exposure'], depth: ['standard', 'deep'] });
  });
});
