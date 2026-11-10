// Tests for the insufficient anti-automation / bot abuse probe
// (coverage row #79 [Medium] Insufficient Anti-Automation / Bot
// Abuse, CWE-799; phase 'anti-automation').
// No network, no lab — the probe talks to the shop only through
// the opts.fetchFn seam, stubbed here by a stateful fake Juice
// Shop: POST /rest/user/login checks a password. Behaviour flags
// flip the fake between a vulnerable shop and a safe one.
// The bot-challenge flags are the negative controls for the #79
// detector: a probe that ignored bot challenges would confirm on
// the captcha-widget and challenge-page fakes, so those tests fail
// without the detector and pass with it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeAntiAutomation,
  detectBotChallenge,
  assessAutomationRun,
  __antiAutomationMeta,
} from './antiAutomation.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/rest/saveLoginIp',
  'http://other.local/rest/user/login',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- stateful fake Juice ----------------------------------------------------
// behavior flags: throttleAt (nth login POST answers 429),
// lockoutText (nth login POST answers 400 with a lockout message),
// userNotFound (login answers 'User not found'), always500 (every
// login POST answers 500), acceptPassword (login answers 200
// success on a wrong password), emailShapeRejected (an {email}
// body is answered 'username is required', a {username} body is
// answered 401 invalid — tests the shape fallback),
// captchaWidgetAt (nth login POST answers 200 with a reCAPTCHA
// widget marker in the body), challengePageAt (nth login POST
// answers 503 with a "Just a moment" challenge page),
// jsChallengeAt (nth login POST answers 200 with a Cloudflare
// JS-challenge marker in the body).
function makeFakeJuice(behavior = {}) {
  const state = { loginCount: 0, calls: [], bodies: [] };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    let body = null;
    try {
      body = init.body ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    state.calls.push(`${method} ${u.pathname}`);
    state.bodies.push(body);
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      state.loginCount += 1;
      const n = state.loginCount;
      if (behavior.throttleAt && n === behavior.throttleAt) {
        return json(429, { status: 'error', message: 'Too many requests' });
      }
      if (behavior.lockoutText && n === behavior.lockoutText) {
        return json(400, { status: 'error', message: 'Account locked: too many failed attempts' });
      }
      if (behavior.userNotFound) {
        return json(400, { status: 'error', message: 'User not found' });
      }
      if (behavior.always500) {
        return json(500, { status: 'error', message: 'internal error' });
      }
      if (behavior.acceptPassword) {
        return json(200, { status: 'success', authentication: { token: 'tok-2' } });
      }
      if (behavior.captchaWidgetAt && n === behavior.captchaWidgetAt) {
        return json(200, {
          status: 'error',
          message: 'Please complete the challenge',
          widget: '<div class="g-recaptcha" data-sitekey="fake-key"></div>',
        });
      }
      if (behavior.challengePageAt && n === behavior.challengePageAt) {
        return json(503, {
          status: 'error',
          message: 'Just a moment... checking your browser before accessing the shop.',
        });
      }
      if (behavior.jsChallengeAt && n === behavior.jsChallengeAt) {
        return json(200, { status: 'error', message: 'challenge', challenge: '_cf_chl_opt' });
      }
      if (behavior.emailShapeRejected && body && typeof body.email === 'string') {
        return json(400, { status: 'error', message: 'username is required' });
      }
      return json(401, { status: 'error', message: 'Invalid email or password.' });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure: bot-challenge detector -------------------------------------------

describe('detectBotChallenge', () => {
  it('AA-1: CAPTCHA widget markers are a challenge', () => {
    assert.equal(
      detectBotChallenge(200, { widget: '<div class="g-recaptcha"></div>' }).challenged,
      true
    );
    assert.equal(
      detectBotChallenge(200, { widget: '<div class="h-captcha"></div>' }).challenged,
      true
    );
    assert.equal(
      detectBotChallenge(200, { widget: '<div class="cf-turnstile"></div>' }).challenged,
      true
    );
    assert.equal(
      detectBotChallenge(200, { script: 'https://challenges.cloudflare.com/turnstile/v0/api.js' })
        .challenged,
      true
    );
    assert.equal(
      detectBotChallenge(200, { challenge: '_cf_chl_opt' }).challenged,
      true
    );
    assert.equal(
      detectBotChallenge(200, { message: 'Please complete the CAPTCHA' }).challenged,
      true
    );
  });
  it('AA-2: challenge-page wording is a challenge', () => {
    assert.equal(
      detectBotChallenge(503, { message: 'Just a moment... checking your browser.' }).challenged,
      true
    );
    assert.equal(
      detectBotChallenge(200, { message: 'Please verify you are human to continue.' })
        .challenged,
      true
    );
    assert.equal(
      detectBotChallenge(403, { message: 'Attention required — unusual traffic detected.' })
        .challenged,
      true
    );
  });
  it('AA-3: ordinary invalid-credential answers are NOT a challenge', () => {
    assert.equal(
      detectBotChallenge(401, { status: 'error', message: 'Invalid email or password.' })
        .challenged,
      false
    );
    assert.equal(
      detectBotChallenge(400, { status: 'error', message: 'Login failed' }).challenged,
      false
    );
    assert.equal(detectBotChallenge(401, null).challenged, false);
  });
  it('AA-4: a bare 429 with no marker is NOT a bot challenge (the throttle path owns it)', () => {
    assert.equal(
      detectBotChallenge(429, { status: 'error', message: 'Too many requests' }).challenged,
      false
    );
  });
});

// ---- pure: run assessor -----------------------------------------------------

describe('assessAutomationRun', () => {
  it('AA-5: 10/10 ordinary answers with no defense confirms', () => {
    assert.equal(assessAutomationRun(10, false, false).verdict, 'confirmed');
  });
  it('AA-6: a bot challenge vetoes the finding even at 10/10', () => {
    assert.equal(assessAutomationRun(10, false, true).verdict, 'rejected');
  });
  it('AA-7: a throttle vetoes the finding even at 10/10', () => {
    assert.equal(assessAutomationRun(10, true, false).verdict, 'rejected');
  });
  it('AA-8: zero invalid answers is uncalibrated, fewer than 10 is inconclusive', () => {
    assert.equal(assessAutomationRun(0, false, false).verdict, 'uncalibrated');
    assert.equal(assessAutomationRun(9, false, false).verdict, 'inconclusive');
  });
});

// ---- probe: vulnerable shop -------------------------------------------------

describe('probeAntiAutomation — vulnerable shop', () => {
  it('AA-9: 10/10 ordinary answers with no bot challenge CONFIRMS #79', async () => {
    const { state, fetchFn } = makeFakeJuice();
    const diag = {};
    const findings = await probeAntiAutomation('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /repeated automated attempts with no bot challenge/);
    assert.equal(findings[0].severity, 'medium');
    assert.equal(findings[0].class, 'anti_automation');
    assert.equal(findings[0].parameter, 'password');
    assert.equal(diag.loginRoutes, 1);
    assert.equal(diag.controlOk, true);
    assert.equal(diag.attempts, 10);
    assert.equal(state.loginCount, 10, 'exactly 10 login POSTs');
    assert.ok(state.calls.filter((c) => c === 'POST /rest/user/login').length === 10);
    const passwords = state.bodies.map((b) => b && b.password);
    assert.equal(new Set(passwords).size, 10, 'all 10 wrong passwords are distinct');
    assert.ok(!passwords.includes('canary-pass'), 'the real password must never be sent');
    assert.ok(passwords.every((p) => String(p).startsWith('dm-bot-pass-')), 'bot-probe passwords only');
    assert.equal(diag.botChallengeSeen, undefined, 'no bot challenge seen on the vulnerable shop');
  });
  it('AA-10: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeAntiAutomation('http://lab.local/', { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
  it('AA-11: email-shape rejection falls back to the username shape and still confirms', async () => {
    const { state, fetchFn } = makeFakeJuice({ emailShapeRejected: true });
    const findings = await probeAntiAutomation('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.equal(state.loginCount, 11, '1 rejected email-shape POST + 10 username-shape POSTs');
  });
});

// ---- probe: safe / uncalibrated shops (negative controls) -------------------

describe('probeAntiAutomation — safe shop', () => {
  it('AA-12: a CAPTCHA widget on the 5th attempt stops the probe with zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ captchaWidgetAt: 5 });
    const diag = {};
    const findings = await probeAntiAutomation('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 0, 'a bot challenge is a defense — no finding');
    assert.equal(diag.botChallengeSeen, true);
    assert.equal(diag.botChallengeKind, 'captcha-widget');
  });
  it('AA-13: a challenge page on the 3rd attempt stops the probe with zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ challengePageAt: 3 });
    const diag = {};
    const findings = await probeAntiAutomation('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 0, 'a challenge page is a defense — no finding');
    assert.equal(diag.botChallengeSeen, true);
    assert.equal(diag.botChallengeKind, 'challenge-page');
  });
  it('AA-14: a JS-challenge marker on the 2nd attempt stops the probe with zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ jsChallengeAt: 2 });
    const diag = {};
    const findings = await probeAntiAutomation('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      diagnostics: diag,
    });
    assert.equal(findings.length, 0, 'a JS challenge is a defense — no finding');
    assert.equal(diag.botChallengeSeen, true);
    assert.equal(diag.botChallengeKind, 'captcha-widget');
  });
  it('AA-15: a 429 on the 4th attempt stops the probe with zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ throttleAt: 4 });
    const findings = await probeAntiAutomation('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 0, 'a throttle signal is a defense — no finding');
  });
  it('AA-16: a lockout message on the 6th attempt stops the probe with zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ lockoutText: 6 });
    const findings = await probeAntiAutomation('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 0, 'a lockout message is a defense — no finding');
  });
  it('AA-17: an uncalibrated shop (user-not-found) yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ userNotFound: true });
    const findings = await probeAntiAutomation('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 0, 'no calibrated invalid-credentials signal — no finding');
  });
  it('AA-18: a 200 success on a wrong password yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ acceptPassword: true });
    const findings = await probeAntiAutomation('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 0, 'a success on a wrong password is not a bot-abuse signal');
  });
  it('AA-19: a 500 on every attempt yields zero findings', async () => {
    const { fetchFn } = makeFakeJuice({ always500: true });
    const findings = await probeAntiAutomation('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 0, 'a 500 is uncalibrated — no finding');
  });
});

// ---- probe: gates ------------------------------------------------------------

describe('probeAntiAutomation — gates', () => {
  it('AA-20: depth quick skips the probe', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeAntiAutomation('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      depth: 'quick',
    });
    assert.equal(findings.length, 0);
  });
  it('AA-21: no labCreds skips the probe', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeAntiAutomation('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      labCreds: null,
    });
    assert.equal(findings.length, 0);
  });
  it('AA-22: allowWrite false skips the probe', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeAntiAutomation('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      allowWrite: false,
    });
    assert.equal(findings.length, 0);
  });
  it('AA-23: a non-lab host skips the probe', async () => {
    const { fetchFn } = makeFakeJuice();
    const findings = await probeAntiAutomation('http://other.local/', {
      ...BASE_OPTS,
      fetchFn,
    });
    assert.equal(findings.length, 0);
  });
  it('AA-24: meta names the anti-automation phase and its depths', () => {
    assert.deepEqual(__antiAutomationMeta.phases, ['anti-automation']);
    assert.deepEqual(__antiAutomationMeta.depth, ['standard', 'deep']);
  });
});
