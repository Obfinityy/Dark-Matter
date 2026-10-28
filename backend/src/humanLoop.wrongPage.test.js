// Wrong-page guard (25 Oct 2026) — the hunt agent typed its probes
// into about:blank / our own frontend instead of the target login,
// and the dedupe gate permanently blocked every re-navigation back.
//
// Fix 2 seeds lastObservation from the previous session's leftOff,
// fix 4 exempts a return-to-target browser_open while the live tab
// is provably off-target, and fix 5 takes a deterministic turn-start
// snapshot so a session never starts blind. Pure helpers are tested
// directly; the seeding, exemption (and its narrowness), and
// turn-start snapshot are tested wire-up through humanIteration
// with stubbed deps, in the same shape as humanLoop.authGate.test.js
// (AJ-10/AJ-11).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  humanIteration,
  targetHostsFor,
  isOnTargetHosts,
  isReturnToTarget,
  pageUrlFromObservation,
  lastActionResultOfLeftOff,
} from './humanLoop.js';

const TARGET = 'https://ksuite.infomaniak.com';
const SCOPE = { inScope: ['login.infomaniak.com', 'ksuite.infomaniak.com'] };
const LOGIN_URL = 'https://ksuite.infomaniak.com/login';
const REAL_SNAP =
  'Page: Infomaniak — Sign in — https://ksuite.infomaniak.com/login\n--- visible text ---\nEmail address\n--- clickable / typeable elements ---\n- [input type=email] "Email address"';
const WRONG_BLANK =
  'WRONG PAGE — you are on about:blank, which is NOT your target. Do NOT type or click here: nothing you do on this page reaches the target. Open your target with browser_open https://ksuite.infomaniak.com first, then take browser_snapshot and work there.';

// --- pure helpers ---

test('HL-1: targetHostsFor is the target host plus inScope, deduped', () => {
  assert.deepEqual(targetHostsFor(TARGET, SCOPE), ['ksuite.infomaniak.com', 'login.infomaniak.com']);
  assert.deepEqual(targetHostsFor(TARGET, null), ['ksuite.infomaniak.com']);
  assert.deepEqual(targetHostsFor('not a url', null), []);
});

test('HL-2: isOnTargetHosts uses the scope host rule (subdomains in, lookalikes out)', () => {
  assert.equal(isOnTargetHosts(LOGIN_URL, TARGET, SCOPE), true);
  assert.equal(isOnTargetHosts('https://login.infomaniak.com/en/login', TARGET, SCOPE), true);
  assert.equal(isOnTargetHosts('https://sub.ksuite.infomaniak.com/x', TARGET, SCOPE), true);
  assert.equal(isOnTargetHosts('https://hack.thebhavesh.online/', TARGET, SCOPE), false);
  assert.equal(isOnTargetHosts('about:blank', TARGET, SCOPE), false);
  assert.equal(isOnTargetHosts('https://ksuite.infomaniak.com.evil.example/', TARGET, SCOPE), false);
  assert.equal(isOnTargetHosts('', TARGET, SCOPE), false);
});

test('HL-3: isReturnToTarget fires only for a target open while provably off-target', () => {
  const open = { url: LOGIN_URL };
  assert.equal(isReturnToTarget('browser_open', open, 'about:blank', TARGET, SCOPE), true);
  assert.equal(isReturnToTarget('browser_open', open, 'https://hack.thebhavesh.online/', TARGET, SCOPE), true);
  // Already on the target: no exemption — dedupe still applies.
  assert.equal(isReturnToTarget('browser_open', open, LOGIN_URL, TARGET, SCOPE), false);
  // Unknown current page: NO exemption (a broken tracker must never
  // open a re-open-forever loophole).
  assert.equal(isReturnToTarget('browser_open', open, '', TARGET, SCOPE), false);
  // Not a navigation, or not a target URL: no exemption.
  assert.equal(isReturnToTarget('browser_type', { text: 'x' }, 'about:blank', TARGET, SCOPE), false);
  assert.equal(isReturnToTarget('browser_open', { url: 'https://hack.thebhavesh.online/' }, 'about:blank', TARGET, SCOPE), false);
});

test('HL-4: pageUrlFromObservation reads the snapshot line and the refusal prose', () => {
  assert.equal(pageUrlFromObservation(REAL_SNAP), LOGIN_URL);
  assert.equal(pageUrlFromObservation(WRONG_BLANK), 'about:blank');
  assert.equal(
    pageUrlFromObservation('WRONG PAGE — you are on https://hack.thebhavesh.online/, which is NOT your target. Open your target with browser_open https://ksuite.infomaniak.com first.'),
    'https://hack.thebhavesh.online/'
  );
  assert.equal(pageUrlFromObservation('some shell output with no url'), '');
  assert.equal(pageUrlFromObservation(''), '');
});

test('HL-5: lastActionResultOfLeftOff returns the last usable result, skipping empty snapshots', () => {
  const leftOff = {
    lastActions: [
      { tool: 'shell', detail: 'ls', result: 'file list' },
      { tool: 'browser_snapshot', detail: '', result: 'Page: (untitled) — about:blank\n(empty page snapshot)' },
    ],
  };
  assert.equal(lastActionResultOfLeftOff(leftOff), 'file list');
  assert.equal(lastActionResultOfLeftOff({ lastActions: [] }), '');
  assert.equal(lastActionResultOfLeftOff(null), '');
  assert.equal(lastActionResultOfLeftOff({ lastActions: [{ tool: 'x', result: '  ' }] }), '');
});

// --- wire-up through humanIteration ---

function stubSession(replies, { gui, events = [], meta = {} } = {}) {
  const recorded = [];
  const guiCalls = [];
  let n = 0;
  const wrappedGui = {
    open: async (h, url) => { guiCalls.push(['open', url]); return gui.open ? gui.open(h, url) : { observation: 'opened' }; },
    snapshot: async (h) => { guiCalls.push(['snapshot']); return gui.snapshot ? gui.snapshot(h) : { observation: 'snap' }; },
    click: async (h, text) => { guiCalls.push(['click', text]); return gui.click ? gui.click(h, text) : { observation: 'clicked' }; },
    type: async (h, target, text, submit) => { guiCalls.push(['type', text]); return gui.type ? gui.type(h, target, text, submit) : { observation: 'Typed.' }; },
    screenshot: async (h) => { guiCalls.push(['screenshot']); return gui.screenshot ? gui.screenshot(h) : { observation: 'shot' }; },
  };
  return {
    recorded,
    guiCalls,
    run: () => humanIteration('h_test_wp', TARGET, {
      turns: replies.length,
      deps: {
        chat: async () => replies[n++],
        gui: wrappedGui,
        execRaw: async () => ({ stdout: '', stderr: '' }),
        record: (h, e) => { recorded.push(e); },
        recordNote: () => {},
        readMeta: () => meta,
        readEvents: () => events,
        buildBriefing: async () => '',
        machineControlled: () => false,
        assess: null,
      },
    }),
  };
}

test('HL-6 (wire-up): the turn-start snapshot seeds the session, so the first type RUNS', async () => {
  const s = stubSession(
    ['I will type the username.\n{"action":"browser_type","target":"Email address","text":"test@example.com","submit":true}'],
    { gui: { snapshot: async () => ({ observation: REAL_SNAP }) } },
  );
  const res = await s.run();
  // Without the turn-start snapshot this type would be
  // empty_snapshot-blocked (lastObservation starts as ''). The
  // second snapshot is the per-turn desktop heartbeat (read-only,
  // same as the turn-start one).
  assert.deepEqual(s.guiCalls, [['snapshot'], ['snapshot'], ['type', 'test@example.com']]);
  assert.ok(!s.recorded.some((e) => e.type === 'auth_block'), 'no auth_block for a type after a real snapshot');
  assert.ok(res.log.some((e) => String(e.observation || '').includes('Typed.')), 'the type observation must reach the log');
});

test('HL-7 (wire-up): a return-to-target open is exempt from dedupe while on about:blank', async () => {
  // Trap 4 as recorded live: browser_open of the login already ran
  // x2, so the plain dedupe gate would block the way home forever.
  const priorOpens = [
    { type: 'tool_call', tool: 'browser_open', detail: LOGIN_URL },
    { type: 'tool_call', tool: 'browser_open', detail: LOGIN_URL },
  ];
  const s = stubSession(
    ['I am on the wrong page. I will open the target login.\n{"action":"browser_open","url":"https://ksuite.infomaniak.com/login"}'],
    {
      events: priorOpens,
      gui: {
        snapshot: async () => ({ observation: WRONG_BLANK }),
        open: async () => ({ observation: REAL_SNAP }),
      },
    },
  );
  await s.run();
  assert.ok(s.guiCalls.some(([k]) => k === 'open'), 'the return-to-target open must execute');
  assert.ok(!s.recorded.some((e) => e.type === 'dedup_block'), 'no dedup_block for an exempt return');
});

test('HL-8 (wire-up): the exemption is narrow — the same re-open IS blocked while already on target', async () => {
  const priorOpens = [
    { type: 'tool_call', tool: 'browser_open', detail: LOGIN_URL },
    { type: 'tool_call', tool: 'browser_open', detail: LOGIN_URL },
  ];
  const s = stubSession(
    ['I will open the login again.\n{"action":"browser_open","url":"https://ksuite.infomaniak.com/login"}'],
    {
      events: priorOpens,
      gui: {
        snapshot: async () => ({ observation: REAL_SNAP }),
        open: async () => ({ observation: REAL_SNAP }),
      },
    },
  );
  const res = await s.run();
  assert.ok(!s.guiCalls.some(([k]) => k === 'open'), 'no open may run while already on the target');
  assert.ok(s.recorded.some((e) => e.type === 'dedup_block'), 'the repeat must still be dedup-blocked on-target');
  assert.ok(res.log.some((e) => String(e.observation || '').includes('BLOCKED — ALREADY DONE')));
});

test('HL-9 (wire-up): lastObservation seeds from the previous session leftOff when the snapshot yields nothing', async () => {
  const meta = {
    humanLoop: {
      leftOff: {
        lastActions: [
          { tool: 'browser_snapshot', detail: '', result: REAL_SNAP },
        ],
      },
    },
  };
  const s = stubSession(
    ['I will type the username.\n{"action":"browser_type","target":"Email address","text":"test@example.com","submit":true}'],
    {
      meta,
      gui: { snapshot: async () => ({}), type: async () => ({ observation: 'Typed.' }) },
    },
  );
  await s.run();
  // The turn-start snapshot returned no observation, so only the
  // leftOff seed can have let this type past the auth gate.
  assert.ok(s.guiCalls.some(([k]) => k === 'type'), 'the seeded type must run');
  assert.ok(!s.recorded.some((e) => e.type === 'auth_block'), 'no empty_snapshot block when seeded');
});
