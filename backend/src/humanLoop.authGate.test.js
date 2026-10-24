// Lane AJ (24 Oct 2026) — auth-loop gate tests.
//
// Observed failure (Infomaniak hunt, live): the hunter typed a saved
// username into a page whose snapshot it had itself called EMPTY,
// then claimed "I've just logged in" while its own next observation
// showed the dashboard redirecting back to the sign-in page — and
// re-typed the same username. The gate blocks both deterministically:
// never type/click blind, and never re-type the same credential
// while still on the sign-in page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { authGateHit, buildActionHistory, humanIteration } from './humanLoop.js';

const LOGIN_OBS =
  'Opened https://ksuite.infomaniak.com/dashboard in your desktop browser.\n' +
  'Page: Infomaniak — https://login.infomaniak.com/en/login?client=abc&oa2=1';
const DASHBOARD_OBS =
  'Opened https://ksuite.infomaniak.com/dashboard in your desktop browser.\n' +
  'Page: kSuite — https://ksuite.infomaniak.com/dashboard';
const EMPTY_OBS = '(empty page snapshot)';

function historyOf(...toolCalls) {
  const events = toolCalls.map(([tool, detail]) => ({ type: 'tool_call', tool, detail }));
  return buildActionHistory(events);
}

test('AJ-1: browser_type on an empty snapshot is blocked (empty_snapshot)', () => {
  const hit = authGateHit('browser_type', { text: 'obfinity-ml5eemlu' }, new Map(), EMPTY_OBS);
  assert.ok(hit);
  assert.equal(hit.reason, 'empty_snapshot');
  assert.match(hit.redirect, /browser_snapshot first/);
});

test('AJ-2: browser_click on an empty snapshot is blocked', () => {
  const hit = authGateHit('browser_click', { text: 'Sign in' }, new Map(), EMPTY_OBS);
  assert.ok(hit);
  assert.equal(hit.reason, 'empty_snapshot');
});

test('AJ-3: browser_type with no observation yet is blocked (page never seen)', () => {
  const hit = authGateHit('browser_type', { text: 'user@example.com' }, new Map(), '');
  assert.ok(hit);
  assert.equal(hit.reason, 'empty_snapshot');
});

test('AJ-4: browser_type after a real snapshot is allowed', () => {
  const hit = authGateHit('browser_type', { text: 'obfinity-ml5eemlu' }, new Map(), DASHBOARD_OBS);
  assert.equal(hit, null);
});

test('AJ-5: re-typing the same username on the sign-in page is blocked (auth_loop)', () => {
  const history = historyOf(['browser_type', 'obfinity-ml5eemlu']);
  const hit = authGateHit('browser_type', { text: 'obfinity-ml5eemlu' }, history, LOGIN_OBS);
  assert.ok(hit);
  assert.equal(hit.reason, 'auth_loop');
  assert.match(hit.redirect, /NOT logged in/);
  assert.match(hit.redirect, /Create an account/);
});

test('AJ-6: same text on a non-login page is NOT auth-gated', () => {
  const history = historyOf(['browser_type', 'obfinity-ml5eemlu']);
  const hit = authGateHit('browser_type', { text: 'obfinity-ml5eemlu' }, history, DASHBOARD_OBS);
  assert.equal(hit, null);
});

test('AJ-7: typing a DIFFERENT text (password) on the login page is allowed', () => {
  const history = historyOf(['browser_type', 'obfinity-ml5eemlu']);
  const hit = authGateHit('browser_type', { text: 's3cret-password' }, history, LOGIN_OBS);
  assert.equal(hit, null);
});

test('AJ-8: first type on the login page is allowed (nothing typed yet)', () => {
  const hit = authGateHit('browser_type', { text: 'obfinity-ml5eemlu' }, new Map(), LOGIN_OBS);
  assert.equal(hit, null);
});

test('AJ-9: shell/search/snapshot actions are never auth-gated', () => {
  assert.equal(authGateHit('shell', { command: 'curl -s https://example.com' }, new Map(), EMPTY_OBS), null);
  assert.equal(authGateHit('search', { query: 'x' }, new Map(), EMPTY_OBS), null);
  assert.equal(authGateHit('browser_snapshot', {}, new Map(), EMPTY_OBS), null);
});

test('AJ-10 (wire-up): a stubbed session blocks the blind re-type and never calls gui.type', async () => {
  const recorded = [];
  const typeCalls = [];
  const replies = [
    'The page looks empty in my last snapshot. I will look again.\n{"action":"browser_snapshot"}',
    'I will type the username I saved.\n{"action":"browser_type","text":"obfinity-ml5eemlu","submit":true}',
  ];
  let n = 0;
  const res = await humanIteration('h_test_aj', 'https://ksuite.infomaniak.com', {
    turns: 2,
    deps: {
      chat: async () => replies[n++],
      gui: {
        open: async () => ({ observation: 'opened' }),
        snapshot: async () => ({ observation: EMPTY_OBS }),
        click: async () => ({ observation: 'clicked' }),
        type: async (h, text) => { typeCalls.push(text); return { observation: 'Typed.' }; },
        screenshot: async () => ({ observation: 'shot' }),
      },
      execRaw: async () => ({ stdout: '', stderr: '' }),
      record: (h, e) => { recorded.push(e); },
      recordNote: () => {},
      readMeta: () => ({}),
      readEvents: () => [],
      buildBriefing: async () => '',
      assess: null,
    },
  });
  assert.equal(typeCalls.length, 0, 'gui.type must never run for the blocked action');
  const blocked = res.log.find((e) => String(e.observation || '').includes('BLOCKED'));
  assert.ok(blocked, 'a turn observation must carry the BLOCKED verdict');
  assert.match(blocked.observation, /sign-in page|empty/i);
  assert.ok(recorded.some((e) => e.type === 'auth_block'), 'an auth_block event must be recorded');
});

test('AJ-11 (precedence): when dedupe AND auth both apply, the auth redirect wins', async () => {
  const recorded = [];
  const typeCalls = [];
  const LOGIN_OPEN_OBS =
    'Opened https://ksuite.infomaniak.com/dashboard in your desktop browser.\n' +
    'Page: Infomaniak — https://login.infomaniak.com/en/login?client=abc&oa2=1';
  const replies = [
    'I will open the dashboard.\n{"action":"browser_open","url":"https://ksuite.infomaniak.com/dashboard"}',
    'I will type the username again.\n{"action":"browser_type","text":"obfinity-ml5eemlu","submit":true}',
  ];
  let n = 0;
  const priorType = { type: 'tool_call', tool: 'browser_type', detail: 'obfinity-ml5eemlu' };
  const res = await humanIteration('h_test_aj11', 'https://ksuite.infomaniak.com', {
    turns: 2,
    deps: {
      chat: async () => replies[n++],
      gui: {
        open: async () => ({ observation: LOGIN_OPEN_OBS }),
        snapshot: async () => ({ observation: LOGIN_OPEN_OBS }),
        click: async () => ({ observation: 'clicked' }),
        type: async (h, text) => { typeCalls.push(text); return { observation: 'Typed.' }; },
        screenshot: async () => ({ observation: 'shot' }),
      },
      execRaw: async () => ({ stdout: '', stderr: '' }),
      record: (h, e) => { recorded.push(e); },
      recordNote: () => {},
      readMeta: () => ({}),
      readEvents: () => [priorType, { ...priorType }],
      buildBriefing: async () => '',
      assess: null,
    },
  });
  assert.equal(typeCalls.length, 0, 'gui.type must never run for the blocked re-type');
  const blocked = res.log.find((e) => String(e.observation || '').includes('STILL ON THE SIGN-IN PAGE'));
  assert.ok(blocked, 'the turn observation must carry the AJ redirect, not the generic dedupe block');
  assert.ok(recorded.some((e) => e.type === 'auth_block'), 'an auth_block event must be recorded');
  assert.ok(!recorded.some((e) => e.type === 'dedup_block'), 'no dedup_block for the turn the auth gate took');
});
