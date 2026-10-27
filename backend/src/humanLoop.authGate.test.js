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

// WRONG-PAGE GUARD (25 Oct 2026, AJ-12): the driver's own WRONG
// PAGE refusal is authoritative — it already names the page and the
// way back. The auth gate must pass it through untouched: a foreign
// URL can contain "/login" (our own frontend's login route), and
// the empty-snapshot check would otherwise swallow the refusal and
// send the agent snapshotting a page that is not the target.
test('AJ-12: a WRONG PAGE observation is never auth-gated', () => {
  const wrongBlank = 'WRONG PAGE — you are on about:blank, which is NOT your target. Do NOT type or click here.';
  assert.equal(authGateHit('browser_type', { text: 'obfinity-ml5eemlu' }, new Map(), wrongBlank), null);
  assert.equal(authGateHit('browser_click', { text: 'Sign in' }, new Map(), wrongBlank), null);
  const wrongLoginUrl = 'WRONG PAGE — you are on https://hack.thebhavesh.online/login, which is NOT your target. Do NOT type or click here.';
  assert.equal(authGateHit('browser_type', { text: 'obfinity-ml5eemlu' }, new Map(), wrongLoginUrl), null);
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

// FRESH ATTEMPT (visible-desktop lane, 27 Oct 2026 — live DVWA hunt
// h_830317bdc184, 23:44-23:48 IST): the brain typed 'admin' (22:50
// IST), typed 'password' (23:06 IST), snapshotted the form, reloaded
// it (browser_open login.php), worked shell login scripts for ~20
// min, then came back to the GUI and typed 'admin' again — into a
// form the reload had emptied. The gate blocked it 3x as auth_loop
// and the brain fell back to shell curls. A re-type after fresh GUI
// work (a fresh screen read, a click into the form, or a different
// text typed since) is a fresh attempt, not a loop.
const DVWA_LOGIN_EVENTS = [
  { type: 'tool_call', tool: 'browser_type', detail: 'admin' },
  { type: 'tool_call', tool: 'browser_type', detail: 'password' },
  { type: 'tool_call', tool: 'browser_snapshot', detail: '' },
  { type: 'tool_call', tool: 'browser_open', detail: 'http://172.17.0.1:3100/login.php' },
];

test('AJ-13: re-typing the username after the live DVWA fresh-look sequence is NOT blocked', () => {
  const history = buildActionHistory(DVWA_LOGIN_EVENTS);
  const hit = authGateHit('browser_type', { text: 'admin' }, history, LOGIN_OBS, { events: DVWA_LOGIN_EVENTS });
  assert.equal(hit, null, 'snapshot + password-type + reload since the last type = fresh attempt');
});

test('AJ-14: re-typing after typing a DIFFERENT text (password) is NOT blocked', () => {
  const events = [
    { type: 'tool_call', tool: 'browser_type', detail: 'admin' },
    { type: 'tool_call', tool: 'browser_type', detail: 'password' },
  ];
  const history = buildActionHistory(events);
  const hit = authGateHit('browser_type', { text: 'admin' }, history, LOGIN_OBS, { events });
  assert.equal(hit, null, 'the login sequence advanced past the username');
});

test('AJ-15: a re-type with only a page open since is STILL blocked (genuine loop)', () => {
  const events = [
    { type: 'tool_call', tool: 'browser_type', detail: 'admin' },
    { type: 'tool_call', tool: 'browser_open', detail: 'https://ksuite.infomaniak.com/dashboard' },
  ];
  const history = buildActionHistory(events);
  const hit = authGateHit('browser_type', { text: 'admin' }, history, LOGIN_OBS, { events });
  assert.ok(hit, 'an open that first shows the login page is not a reset');
  assert.equal(hit.reason, 'auth_loop');
});

test('AJ-16: without an events record the old rule holds (no ctx)', () => {
  const history = historyOf(['browser_type', 'admin']);
  const hit = authGateHit('browser_type', { text: 'admin' }, history, LOGIN_OBS);
  assert.ok(hit);
  assert.equal(hit.reason, 'auth_loop');
});

test('AJ-17: a shell detour alone does NOT make a re-type fresh', () => {
  const events = [
    { type: 'tool_call', tool: 'browser_type', detail: 'admin' },
    { type: 'tool_call', tool: 'shell', detail: 'curl -s http://172.17.0.1:3100/login.php' },
    { type: 'tool_call', tool: 'recall', detail: '#71' },
  ];
  const history = buildActionHistory(events);
  const hit = authGateHit('browser_type', { text: 'admin' }, history, LOGIN_OBS, { events });
  assert.ok(hit, 'shell/recall change nothing about the form');
  assert.equal(hit.reason, 'auth_loop');
});

test('AJ-18: a re-type after a fresh see_screen is NOT blocked', () => {
  const events = [
    { type: 'tool_call', tool: 'browser_type', detail: 'admin' },
    { type: 'tool_call', tool: 'see_screen', detail: '' },
  ];
  const history = buildActionHistory(events);
  const hit = authGateHit('browser_type', { text: 'admin' }, history, LOGIN_OBS, { events });
  assert.equal(hit, null, 'the brain looked at the desktop again before re-typing');
});

test('AJ-19 (wire-up): the DVWA fresh-attempt GUI login retry executes — gui.type runs, no auth_block', async () => {
  const recorded = [];
  const typeCalls = [];
  const LOGIN_OPEN_OBS =
    'Opened http://172.17.0.1:3100/login.php in your desktop browser.\n' +
    'Page: Login:: Damn Vulnerable Web Application — http://172.17.0.1:3100/login.php';
  const replies = [
    'I will reload the login page clean.\n{"action":"browser_open","url":"http://172.17.0.1:3100/login.php"}',
    'The form is empty after the reload — I will type the username again.\n{"action":"browser_type","text":"admin","submit":false}',
  ];
  let n = 0;
  const res = await humanIteration('h_test_aj19', 'http://172.17.0.1:3100/', {
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
      readEvents: () => DVWA_LOGIN_EVENTS,
      buildBriefing: async () => '',
      assess: null,
    },
  });
  assert.deepEqual(typeCalls, ['admin'], 'the fresh-attempt re-type must execute');
  assert.ok(!recorded.some((e) => e.type === 'auth_block'), 'no auth_block for the fresh-attempt re-type');
  assert.ok(res.log.some((e) => String(e.observation || '').includes('Typed.')), 'the turn observation must carry the executed type');
});
