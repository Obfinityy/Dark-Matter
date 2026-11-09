// CAPTCHA bypass probe tests (row #40 [Medium] CAPTCHA Bypass /
// Missing CAPTCHA, Technique (no single CVE) | OWASP A07:2021;
// phase 95, 'captcha').
//
// The probe is two tiers: tier 1 mines first-party code for CAPTCHA
// services (zero surfaces = proven true negative, nothing to
// bypass); tier 2 drives the feedback math-CAPTCHA flow — control
// with a solved CAPTCHA, then a missing-CAPTCHA submission, then a
// wrong-answer submission — and confirms ONLY when the control was
// accepted AND a bypass submission was accepted with the same
// success signal (2xx + created feedback id).
//
// The fake API is keyed on the request: login returns a bearer
// token (401 in 'login-fail' mode); whoami returns user id 7; the
// captcha endpoint issues rotating math CAPTCHAs ('2+3-9' then
// '5+5'); feedback POSTs are accepted or refused by mode and by
// whether the submitted captcha matches the latest issued one.
// Modes: 'missing-bypass' (missing accepted), 'wrong-bypass'
// (missing refused, wrong accepted), 'enforced' (both refused),
// 'control-rejected' (even the solved control is refused),
// 'login-fail', 'captcha-get-fail'.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCaptcha,
  findCaptchaSurfaces,
  assessCaptchaSurfaces,
  solveMathCaptcha,
  feedbackRoute,
  whoamiRoute,
  assessFeedbackResponse,
  assessCaptchaBypass,
  __capMeta,
} from './captcha.js';
import { assessConfirmation } from '../../hunt-intel/differential.js';

const PAGE_URL = 'http://172.17.0.1:3000/';
const BUNDLE_URL = 'http://172.17.0.1:3000/main.js';
const VENDOR_URL = 'http://172.17.0.1:3000/vendor.js';
const labOpts = {
  labCreds: { username: 'lab-user', password: 'lab-pass' },
  labTargets: ['172.17.0.1:3000'],
};
const API_ROUTES = [
  'http://172.17.0.1:3000/rest/user/login',
  'http://172.17.0.1:3000/api/Feedbacks',
  'http://172.17.0.1:3000/rest/user/whoami',
  'http://172.17.0.1:3000/rest/captcha/',
];

// Fixtures are built by concatenation so no single literal in this
// file is a secret-shaped string.
const BUNDLE_CLEAN =
  'function render(){ var el = document.createElement(\'div\');' +
  ' el.textContent = window.location.search; document.body.appendChild(el); }';
const BUNDLE_MATH =
  'var CaptchaService = { getCaptcha: function() {' +
  ' return http.get(host + "/rest/captcha/"); } };' +
  ' var c = null; service.getCaptcha().subscribe(function(e) {' +
  ' c = e.captcha; var cid = e.captchaId; });';
const BUNDLE_IMAGE =
  'var ImageCaptchaService = { getCaptcha: function() {' +
  ' return http.get(host + "/rest/image-captcha/"); } };';
const BUNDLE_GENERIC =
  'var d = document.createElement("div");' +
  ' d.className = "g-recaptcha";' +
  ' document.body.appendChild(d);' +
  ' var s = document.createElement("script");' +
  ' s.src = "https://www.google.com/recaptcha/api.js";' +
  ' document.head.appendChild(s);';
const BUNDLE_BOTH = BUNDLE_MATH + ' ' + BUNDLE_IMAGE;
const BUNDLE_FRAMEWORK =
  'function bypassSecurityTrustHtml(v) { return v; }' +
  ' var c = http.get(host + "/rest/captcha/");';

function targetsWith(bundleUrl = BUNDLE_URL) {
  return { bundles: [bundleUrl], inline: [] };
}

function jsonRes(status, body) {
  return { status, text: async () => JSON.stringify(body) };
}

function makeFakeApi(mode) {
  const calls = [];
  let captchaSeq = 0;
  let latest = null;
  let nextFeedbackId = 101;
  const issueCaptcha = () => {
    captchaSeq += 1;
    latest =
      captchaSeq === 1
        ? { captchaId: 11, captcha: '2+3-9', answer: -4 }
        : { captchaId: 12, captcha: '5+5', answer: 10 };
    return { captchaId: latest.captchaId, captcha: latest.captcha };
  };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    let body = null;
    try {
      body = init.body ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    calls.push({ method, url: String(url), body });
    const u = String(url);
    if (u.includes('/rest/user/login') && method === 'POST') {
      if (mode === 'login-fail') {
        return jsonRes(401, { status: 'error', message: 'Invalid email or password' });
      }
      return jsonRes(200, { authentication: { token: 'fake-token', bid: 1 } });
    }
    if (u.includes('/rest/user/whoami')) {
      return jsonRes(200, { user: { id: 7, email: 'lab-user' } });
    }
    if (u.includes('/rest/image-captcha')) {
      return jsonRes(200, { image: 'data:image/png;base64,AAAA', captchaId: 99 });
    }
    if (u.includes('/rest/captcha')) {
      if (mode === 'captcha-get-fail') {
        return jsonRes(500, { status: 'error', message: 'captcha service down' });
      }
      return jsonRes(200, issueCaptcha());
    }
    if (u.includes('/api/Feedbacks') && method === 'POST') {
      const hasCaptcha = body && body.captchaId != null && body.captcha != null;
      const solved =
        hasCaptcha && latest && body.captchaId === latest.captchaId && String(body.captcha) === String(latest.answer);
      if (!hasCaptcha) {
        if (mode === 'missing-bypass') {
          const id = nextFeedbackId;
          nextFeedbackId += 1;
          return jsonRes(201, { status: 'success', data: { id, comment: body.comment } });
        }
        return jsonRes(400, { status: 'error', message: 'captcha is required' });
      }
      if (solved) {
        if (mode === 'control-rejected') {
          return jsonRes(400, { status: 'error', message: 'Invalid captcha' });
        }
        const id = nextFeedbackId;
        nextFeedbackId += 1;
        return jsonRes(201, { status: 'success', data: { id, comment: body.comment } });
      }
      // Wrong answer.
      if (mode === 'wrong-bypass') {
        const id = nextFeedbackId;
        nextFeedbackId += 1;
        return jsonRes(201, { status: 'success', data: { id, comment: body.comment } });
      }
      return jsonRes(400, { status: 'error', message: 'Invalid captcha' });
    }
    return jsonRes(404, { status: 'error', message: 'not found' });
  };
  return { fetchFn, calls };
}

async function probeWithFake(mode, targets, extra = {}) {
  const { fetchFn, calls } = makeFakeApi(mode);
  const diagnostics = {};
  let fetched = 0;
  const opts = {
    labCreds: labOpts.labCreds,
    allowWrite: true,
    labTargets: labOpts.labTargets,
    depth: 'standard',
    apiRoutes: API_ROUTES,
    fetchPage: async () => {
      fetched += 1;
      return { status: 200, body: BUNDLE_MATH };
    },
    fetchFn,
    diagnostics,
    ...extra,
  };
  const findings = await probeCaptcha(PAGE_URL, targets, opts);
  return { findings, diagnostics, calls, fetched };
}

// ---- tier 1: the static mine (pure) -----------------------------------------

test('CAP-1: mine finds math, image and generic CAPTCHA markers; clean code has none', () => {
  const math = findCaptchaSurfaces(BUNDLE_MATH);
  assert.equal(math.length, 1);
  assert.equal(math[0].kind, 'math');
  assert.equal(math[0].endpoint, '/rest/captcha/');
  assert.ok(math[0].line >= 1);
  assert.ok(math[0].snippet.length > 0);

  const image = findCaptchaSurfaces(BUNDLE_IMAGE);
  assert.equal(image.length, 1);
  assert.equal(image[0].kind, 'image');
  assert.equal(image[0].endpoint, '/rest/image-captcha/');

  const generic = findCaptchaSurfaces(BUNDLE_GENERIC);
  assert.equal(generic.length, 1);
  assert.equal(generic[0].kind, 'generic');

  const both = findCaptchaSurfaces(BUNDLE_BOTH);
  assert.equal(both.length, 2);
  assert.deepEqual(
    both.map((s) => s.kind).sort(),
    ['image', 'math']
  );

  assert.deepEqual(findCaptchaSurfaces(BUNDLE_CLEAN), []);
  assert.deepEqual(findCaptchaSurfaces(''), []);
  assert.deepEqual(findCaptchaSurfaces(null), []);
});

test('CAP-2: assessCaptchaSurfaces dedupes and drives only on a math surface', () => {
  assert.deepEqual(assessCaptchaSurfaces([]), {
    surfaces: 0,
    math: 0,
    image: 0,
    generic: 0,
    mathEndpoint: null,
    drivable: false,
  });
  const imageOnly = assessCaptchaSurfaces(findCaptchaSurfaces(BUNDLE_IMAGE));
  assert.equal(imageOnly.drivable, false);
  assert.equal(imageOnly.image, 1);
  assert.equal(imageOnly.math, 0);
  const math = assessCaptchaSurfaces(findCaptchaSurfaces(BUNDLE_MATH));
  assert.equal(math.drivable, true);
  assert.equal(math.math, 1);
  assert.equal(math.mathEndpoint, '/rest/captcha/');
  // The same endpoint twice is one surface.
  const dup = assessCaptchaSurfaces([...findCaptchaSurfaces(BUNDLE_MATH), ...findCaptchaSurfaces(BUNDLE_MATH)]);
  assert.equal(dup.surfaces, 1);
  assert.equal(dup.math, 1);
});

test('CAP-3: solveMathCaptcha computes small integer expressions, rejects the rest', () => {
  assert.equal(solveMathCaptcha('2+3-9'), -4);
  assert.equal(solveMathCaptcha(' 5 + 5 '), 10);
  assert.equal(solveMathCaptcha('10*2+3'), 23);
  assert.equal(solveMathCaptcha('8/2'), 4);
  assert.equal(solveMathCaptcha('2*3*4'), 24);
  assert.equal(solveMathCaptcha('-4+10'), 6);
  assert.equal(solveMathCaptcha('2++3'), null);
  assert.equal(solveMathCaptcha('abc'), null);
  assert.equal(solveMathCaptcha(''), null);
  assert.equal(solveMathCaptcha(null), null);
  assert.equal(solveMathCaptcha('5/2'), null);
  assert.equal(solveMathCaptcha('4/0'), null);
  assert.equal(solveMathCaptcha('2+'), null);
});

test('CAP-4: feedbackRoute and whoamiRoute pick same-origin routes, ignore the rest', () => {
  const routes = [
    'https://other.example.com/api/Feedbacks',
    'http://172.17.0.1:3000/api/Feedbacks?x=1',
    'http://172.17.0.1:3000/rest/user/whoami',
  ];
  assert.equal(feedbackRoute(routes, 'http://172.17.0.1:3000'), 'http://172.17.0.1:3000/api/Feedbacks?x=1');
  assert.equal(whoamiRoute(routes, 'http://172.17.0.1:3000'), 'http://172.17.0.1:3000/rest/user/whoami');
  assert.equal(feedbackRoute([], 'http://172.17.0.1:3000'), null);
  assert.equal(whoamiRoute([], 'http://172.17.0.1:3000'), null);
  assert.equal(feedbackRoute(['not a url'], 'http://172.17.0.1:3000'), null);
});

test('CAP-5: assessFeedbackResponse — accepted, captcha-error, other', () => {
  assert.equal(
    assessFeedbackResponse(201, { status: 'success', data: { id: 101 } }).kind,
    'accepted'
  );
  assert.equal(
    assessFeedbackResponse(200, { status: 'success', data: { id: 5 } }).kind,
    'accepted'
  );
  assert.equal(
    assessFeedbackResponse(400, { status: 'error', message: 'captcha is required' }).kind,
    'captcha-error'
  );
  assert.equal(
    assessFeedbackResponse(200, { status: 'error', message: 'Invalid captcha' }).kind,
    'captcha-error'
  );
  assert.equal(assessFeedbackResponse(500, { status: 'error', message: 'boom' }).kind, 'other');
  assert.equal(assessFeedbackResponse(404, { status: 'error', message: 'not found' }).kind, 'other');
  assert.equal(assessFeedbackResponse(200, { status: 'success', data: {} }).kind, 'other');
  assert.equal(assessFeedbackResponse(200, null).kind, 'other');
});

test('CAP-6: assessCaptchaBypass — confirmed, rejected, uncalibrated', () => {
  assert.equal(
    assessCaptchaBypass({ controlOk: true, bypassAccepted: true, bypassKind: 'missing' }).verdict,
    'confirmed'
  );
  assert.equal(
    assessCaptchaBypass({ controlOk: true, bypassAccepted: true, bypassKind: 'wrong-answer' }).verdict,
    'confirmed'
  );
  assert.equal(
    assessCaptchaBypass({ controlOk: true, bypassAccepted: false, bypassKind: 'missing' }).verdict,
    'rejected'
  );
  assert.equal(
    assessCaptchaBypass({ controlOk: false, bypassAccepted: true, bypassKind: 'missing' }).verdict,
    'uncalibrated'
  );
  assert.equal(
    assessCaptchaBypass({ controlOk: false, bypassAccepted: false, bypassKind: null }).verdict,
    'uncalibrated'
  );
});

// ---- gates ------------------------------------------------------------------

test('CAP-7: no labCreds — no findings, no bundle fetch, no API calls', async () => {
  let fetched = 0;
  const { fetchFn, calls } = makeFakeApi('missing-bypass');
  const findings = await probeCaptcha(PAGE_URL, targetsWith(), {
    labCreds: null,
    allowWrite: true,
    labTargets: labOpts.labTargets,
    depth: 'standard',
    apiRoutes: API_ROUTES,
    fetchPage: async () => {
      fetched += 1;
      return { status: 200, body: BUNDLE_MATH };
    },
    fetchFn,
  });
  assert.deepEqual(findings, []);
  assert.equal(fetched, 0);
  assert.equal(calls.length, 0);
});

test('CAP-8: allowWrite false — no findings (control with allowWrite true confirms)', async () => {
  const control = await probeWithFake('missing-bypass', targetsWith());
  assert.equal(control.findings.length, 1);
  const gated = await probeWithFake('missing-bypass', targetsWith(), { allowWrite: false });
  assert.deepEqual(gated.findings, []);
});

test('CAP-9: non-lab target — no findings', async () => {
  const { findings } = await probeWithFake('missing-bypass', targetsWith(), {
    labTargets: ['juice.lab'],
  });
  assert.deepEqual(findings, []);
});

test('CAP-10: depth quick — no findings', async () => {
  const { findings } = await probeWithFake('missing-bypass', targetsWith(), { depth: 'quick' });
  assert.deepEqual(findings, []);
});

// ---- probe outcomes ----------------------------------------------------------

test('CAP-11: true negative — no CAPTCHA surfaces in bundles, no login attempted', async () => {
  let fetchedCount = 0;
  const { findings, diagnostics, calls } = await probeWithFake('missing-bypass', targetsWith(), {
    fetchPage: async () => {
      fetchedCount += 1;
      return { status: 200, body: BUNDLE_CLEAN };
    },
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.captchaSurfaces, 0);
  assert.equal(diagnostics.mathSurfaces, 0);
  assert.equal(fetchedCount, 1);
  assert.equal(
    calls.some((c) => c.url.includes('/rest/user/login')),
    false
  );
});

test('CAP-12: math surface but no feedback route — no findings', async () => {
  const { findings, diagnostics } = await probeWithFake('missing-bypass', targetsWith(), {
    apiRoutes: ['http://172.17.0.1:3000/rest/user/login'],
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.mathSurfaces, 1);
  assert.equal(diagnostics.feedbackRoutes, undefined);
});

test('CAP-13: feedback route present but login fails — no findings, uncalibrated', async () => {
  const { findings, diagnostics, calls } = await probeWithFake('login-fail', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
  assert.equal(
    calls.some((c) => c.url.includes('/api/Feedbacks')),
    false
  );
});

test('CAP-14: control rejected even with a solved CAPTCHA — no findings, uncalibrated', async () => {
  const { findings, diagnostics } = await probeWithFake('control-rejected', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
});

test('CAP-15: missing-CAPTCHA bypass — exactly one medium captcha_bypass finding', async () => {
  const { findings, diagnostics, calls } = await probeWithFake('missing-bypass', targetsWith());
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'captcha_bypass');
  assert.equal(f.severity, 'medium');
  assert.ok(f.title.includes('CAPTCHA bypass'), f.title);
  assert.ok(f.title.includes('MEDIUM'), f.title);
  assert.equal(f.url, 'http://172.17.0.1:3000/api/Feedbacks');
  assert.equal(f.parameter, 'captcha');
  assert.ok(f.evidence.request.includes('/api/Feedbacks'), f.evidence.request);
  assert.ok(f.evidence.response.includes('101'), f.evidence.response);
  assert.ok(f.evidence.response.includes('102'), f.evidence.response);
  assert.equal(f.evidence.signalCorrelated, true);
  assert.equal(f.evidence.bypassWorks, true);
  assert.equal(diagnostics.captchaSurfaces, 1);
  assert.equal(diagnostics.mathSurfaces, 1);
  assert.equal(diagnostics.feedbackRoutes, 1);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 2);
  assert.equal(diagnostics.bypassKind, 'missing');
  assert.equal(
    calls.filter((c) => c.method === 'POST' && c.url.includes('/api/Feedbacks')).length,
    2
  );
});

test('CAP-16: missing refused, wrong answer accepted — bypassKind wrong-answer', async () => {
  const { findings, diagnostics, calls } = await probeWithFake('wrong-bypass', targetsWith());
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.class, 'captcha_bypass');
  assert.equal(f.severity, 'medium');
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.attempts, 3);
  assert.equal(diagnostics.bypassKind, 'wrong-answer');
  assert.ok(f.evidence.response.includes('wrong-answer'), f.evidence.response);
  assert.equal(
    calls.filter((c) => c.method === 'POST' && c.url.includes('/api/Feedbacks')).length,
    3
  );
});

test('CAP-17: CAPTCHA enforced on both bypass attempts — no findings, true negative', async () => {
  const { findings, diagnostics } = await probeWithFake('enforced', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, true);
  assert.equal(diagnostics.bypassKind, undefined);
  assert.equal(diagnostics.attempts, 3);
});

test('CAP-18: assessConfirmation judges the finding confirmed', async () => {
  const { findings } = await probeWithFake('missing-bypass', targetsWith());
  assert.equal(findings.length, 1);
  const { verdict } = assessConfirmation(findings[0]);
  assert.equal(verdict, 'confirmed');
});

test('CAP-19: finding class is captcha_bypass and routes to auth_bypass, never xss', async () => {
  const { findings } = await probeWithFake('missing-bypass', targetsWith());
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'captcha_bypass');
  assert.ok(findings[0].class.includes('bypass'));
  assert.ok(!findings[0].class.includes('xss'));
});

test('CAP-20: image-only surface — noted, never driven, no findings', async () => {
  const { findings, diagnostics, calls } = await probeWithFake('missing-bypass', targetsWith(), {
    fetchPage: async () => ({ status: 200, body: BUNDLE_IMAGE }),
  });
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.captchaSurfaces, 1);
  assert.equal(diagnostics.mathSurfaces, 0);
  assert.equal(diagnostics.imageSurfaces, 1);
  assert.equal(
    calls.some((c) => c.url.includes('/rest/user/login')),
    false
  );
});

test('CAP-21: vendor bundle is excluded from the mine', async () => {
  const { findings, diagnostics, calls } = await probeWithFake('missing-bypass', targetsWith(VENDOR_URL));
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.captchaSurfaces, 0);
  assert.equal(
    calls.some((c) => c.url.includes('/rest/user/login')),
    false
  );
});

test('CAP-22: a math surface in an inline script counts — no feedback route, no findings', async () => {
  const { findings, diagnostics } = await probeWithFake(
    'missing-bypass',
    { bundles: [], inline: [BUNDLE_MATH] },
    {
      apiRoutes: [],
      fetchPage: async () => ({ status: 200, body: BUNDLE_CLEAN }),
    }
  );
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.captchaSurfaces, 1);
  assert.equal(diagnostics.mathSurfaces, 1);
});

test('CAP-23: captcha GET failure — no findings, uncalibrated', async () => {
  const { findings, diagnostics } = await probeWithFake('captcha-get-fail', targetsWith());
  assert.deepEqual(findings, []);
  assert.equal(diagnostics.controlOk, undefined);
});

test('CAP-meta: phase 95 registration metadata', () => {
  assert.deepEqual(__capMeta, { phases: ['captcha'], depth: ['standard', 'deep'] });
});
