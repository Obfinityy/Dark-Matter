// Test for DEGRADED-EXECUTION GATE ACCOUNTING (Lane AF, 24 Oct 2026).
//
// Live evidence it answers: the DVWA hunt h_bfb7a3a66bc8 opened its
// target root twice while the hunt container's desktop was down —
// both executions returned the headless LOOK-ONLY fallback text, so
// the hunter never actually saw the interactive page. The Lane F
// gate counted those two degraded observations as full executions
// and blocked the third open — the very action whose execution path
// (guiTools probe -> Lane Z/AB desktop recovery) would have brought
// the desktop back. The hunt sat in the trap for two more turns.
//
// This lane makes the gate execution-quality aware:
//   - guiTools marks every result whose observation is the headless
//     look-only fallback with `degraded: true` — the execution
//     layer's own signal, composed at the same single place the
//     fallback text is;
//   - a degraded execution is recorded in the gate's history as
//     DEGRADED (a paired tool_degraded event, so a rebuilt history
//     replays the same accounting): it does NOT count toward the
//     full-execution threshold of 2;
//   - 4 degraded executions of one signature since the last full
//     execution DO block (no infinite fallback loop), and a full
//     execution resets the degraded streak;
//   - full executions behave exactly as Lane F built them (the
//     Ezviz register ×62 accounting is unchanged), and a blocked
//     browser_open's observation names the unblocked variations
//     (browser_snapshot / a deeper URL).
//
// Run: node backend/scripts/test-degraded-execution-gate.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-af-'));
process.env.DATA_DIR = tmp;

const {
  humanIteration,
  actionSignature,
  buildActionHistory,
  dedupeGateHit,
} = await import('../src/humanLoop.js');
const {
  guiBrowserOpen, guiBrowserClick, guiBrowserType, guiBrowserSnapshot, resetGuiProbeCache,
} = await import('../src/guiTools.js');
const { resetDesktopStartFailures } = await import('../src/huntRunner.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// ===========================================================================
// Part 1 — guiTools carries the degradation signal on the fallback itself
// ===========================================================================
const PAGE_HTML = '<html><head><title>Fallback Page</title></head><body><h1>Headless view text</h1><a href="/login">Sign in</a></body></html>';
const CDP_SNAP = {
  url: 'http://dvwa.test/', title: 'Login :: DVWA',
  text: 'Username Password Login',
  elements: [{ tag: 'input', type: 'text', label: '', href: '', id: '', name: 'username', placeholder: '' }],
};

// A fake hunt container whose desktop is either up (cdpUp) or down.
// When down, the injected starter always fails — the desktop never
// recovers, so every browser action lands on the fallback.
function makeFakeExec(state) {
  return async (h, cmd) => {
    if (cmd.includes('command -v chromium')) {
      return {
        stdout: `chrome=/usr/bin/chromium\ncdp=${state.cdpUp ? '{"Browser":"fake-chrome"}' : ''}\nxsock=${state.cdpUp ? 'X0' : ''}\n`,
        stderr: '', code: 0,
      };
    }
    if (cmd.includes('cdp.mjs') && cmd.includes('base64 -d')) {
      return { stdout: '4321', stderr: '', code: 0 }; // length > 1000 = driver installed
    }
    if (cmd.includes('cdp.mjs navigate')) {
      return { stdout: JSON.stringify({ ...CDP_SNAP, url: state.currentUrl || CDP_SNAP.url }), stderr: '', code: 0 };
    }
    if (cmd.includes('cdp.mjs snapshot')) {
      return { stdout: JSON.stringify(CDP_SNAP), stderr: '', code: 0 };
    }
    if (cmd.includes('cdp.mjs click')) {
      return { stdout: JSON.stringify({ ok: true, clicked: 'Login', snapshot: CDP_SNAP }), stderr: '', code: 0 };
    }
    if (cmd.includes('cdp.mjs type')) {
      return { stdout: JSON.stringify({ ok: true, typed: 'x', snapshot: CDP_SNAP }), stderr: '', code: 0 };
    }
    if (cmd.includes('--dump-dom')) return { stdout: PAGE_HTML, stderr: '', code: 0 };
    if (cmd.includes('state.json')) {
      if (cmd.includes('base64 -d')) {
        try { state.currentUrl = JSON.parse(Buffer.from((/'([A-Za-z0-9+/=]+)'/.exec(cmd) || [])[1] || '', 'base64').toString('utf8')).currentUrl || ''; } catch { /* ignore */ }
        return { stdout: '', stderr: '', code: 0 };
      }
      return { stdout: state.currentUrl ? JSON.stringify({ currentUrl: state.currentUrl }) : '', stderr: '', code: 0 };
    }
    return { stdout: '', stderr: '', code: 0 };
  };
}

function resetAll() {
  resetGuiProbeCache();
  resetDesktopStartFailures();
}

// (1a) Desktop down, starter fails: open lands on the look-only
// fallback AND says so on the result object.
{
  resetAll();
  const state = { cdpUp: false, currentUrl: '' };
  const deps = { exec: makeFakeExec(state), startDesktop: async () => ({ ok: false, error: 'cannot start' }) };
  const res = await guiBrowserOpen('h_af_down', 'http://dvwa.test/', deps);
  check('gui(1a): fallback open observation is the look-only text', res.observation.includes('look-only'));
  check('gui(1a): fallback open is flagged degraded', res.degraded === true);
}

// (1b) Same dead desktop: click and type refusals are degraded too —
// the action did not happen on any real page.
{
  resetAll();
  const state = { cdpUp: false, currentUrl: '' };
  const deps = { exec: makeFakeExec(state), startDesktop: async () => ({ ok: false, error: 'cannot start' }) };
  const click = await guiBrowserClick('h_af_down2', 'Login', deps);
  check('gui(1b): click refusal is flagged degraded', click.degraded === true && click.ok === false);
  const type = await guiBrowserType('h_af_down2', 'admin', false, deps);
  check('gui(1b): type refusal is flagged degraded', type.degraded === true && type.ok === false);
  // A page must be open before a snapshot can fall back to the
  // headless view (with none open it returns the open-first state
  // error instead, which is not the fallback).
  await guiBrowserOpen('h_af_down2', 'http://dvwa.test/', deps);
  const snap = await guiBrowserSnapshot('h_af_down2', deps);
  check('gui(1b): headless snapshot is flagged degraded', snap.degraded === true && snap.observation.includes('Look-only headless view'));
}

// (1c) Desktop up: real executions carry NO degraded flag.
{
  resetAll();
  const state = { cdpUp: true, currentUrl: '' };
  const deps = { exec: makeFakeExec(state), startDesktop: async () => ({ ok: true }) };
  const open = await guiBrowserOpen('h_af_up', 'http://dvwa.test/', deps);
  check('gui(1c): CDP open is not degraded', open.ok === true && open.degraded !== true && open.observation.includes('in your desktop browser'));
  const click = await guiBrowserClick('h_af_up', 'Login', deps);
  check('gui(1c): CDP click is not degraded', click.ok === true && click.degraded !== true);
}

// ===========================================================================
// Part 2 — history + gate accounting units
// ===========================================================================
const URL1 = 'http://dvwa.test/';
const tc = (detail = URL1) => ({ type: 'tool_call', tool: 'browser_open', detail });
const td = (detail = URL1) => ({ type: 'tool_degraded', tool: 'browser_open', detail });
const sig = actionSignature('browser_open', URL1);
const gateFor = (events) => dedupeGateHit('browser_open', { url: URL1 }, buildActionHistory(events));

// Two degraded opens (the DVWA T1/T3 record): gate must NOT hit.
{
  const h = buildActionHistory([tc(), td(), tc(), td()]);
  const e = h.get(sig);
  check('hist: 2 degraded opens counted as runs ×2 total', e && e.count === 2);
  check('hist: 2 degraded opens are 0 full executions', e && e.fullCount === 0);
  check('hist: degraded streak is 2', e && e.degradedStreak === 2);
  check('gate: 2 degraded opens do NOT block (the DVWA trap)', gateFor([tc(), td(), tc(), td()]) === null);
}

// Four degraded opens in a row: the gate DOES eventually block —
// a fallback that never recovers is still a loop.
{
  const evts = [tc(), td(), tc(), td(), tc(), td(), tc(), td()];
  const hit = gateFor(evts);
  check('gate: 4 degraded opens block', !!hit);
  check('gate: degraded block reports total count ×4', hit && hit.count === 4);
  check('gate: degraded block reports the streak', hit && hit.degradedStreak === 4 && hit.fullCount === 0);
}

// A full execution resets the degraded streak.
{
  const evts = [tc(), td(), tc(), td(), tc(), td(), tc(), tc(), td(), tc(), td(), tc(), td()];
  // D D D F D D D -> full 1, streak 3: no block.
  const h = buildActionHistory(evts);
  const e = h.get(sig);
  check('hist: full execution resets the degraded streak', e && e.fullCount === 1 && e.degradedStreak === 3);
  check('gate: reset streak does not block', gateFor(evts) === null);
}

// Pre-Lane-AF records (tool_call events with no tool_degraded
// partners) are all full executions — Ezviz semantics unchanged.
{
  const evts = [];
  for (let i = 0; i < 5; i++) evts.push({ type: 'tool_call', tool: 'browser_open', detail: 'https://open.ys7.com/rest/user/register' });
  const h = buildActionHistory(evts);
  const e = h.get(actionSignature('browser_open', 'https://open.ys7.com/rest/user/register'));
  check('hist: legacy record counts every run as full', e && e.count === 5 && e.fullCount === 5 && e.degradedStreak === 0);
  const hit = dedupeGateHit('browser_open', { url: 'https://open.ys7.com/rest/user/register' }, h);
  check('gate: legacy ×2+ full runs block exactly as Lane F', !!hit && hit.count === 5);
}

// A stray tool_degraded with no matching execution is inert.
{
  const h = buildActionHistory([td(), { type: 'tool_degraded', tool: 'shell', detail: 'curl -s http://dvwa.test/' }]);
  check('hist: orphan tool_degraded creates no entry and no crash', h.size === 0);
}

// Mixed spellings still merge (normalisation applies to the pair).
{
  const h = buildActionHistory([
    { type: 'tool_call', tool: 'browser_open', detail: 'HTTP://DVWA.test/' },
    { type: 'tool_degraded', tool: 'browser_open', detail: 'http://dvwa.test' },
  ]);
  const e = h.get(sig);
  check('hist: degraded pair merges across URL spellings', e && e.count === 1 && e.fullCount === 0 && e.degradedStreak === 1);
}

// ===========================================================================
// Part 3 — the DVWA T1–T5 fixture, driven through the real loop
// ===========================================================================
function makeDeps({ replies, pastEvents = [], openImpl }) {
  const state = {
    screens: [],
    events: [],
    guiOpens: [],
    meta: { huntId: 'h_af_test', target: URL1, mode: 'human', humanMode: true },
  };
  const queue = [...replies];
  state.deps = {
    chat: async (messages) => {
      state.screens.push(messages[0].text);
      return queue.length ? queue.shift() : null;
    },
    exec: async (h, t, command) => ({ stdout: `ran: ${command}`, stderr: '', code: 0 }),
    execRaw: async () => ({ stdout: '/root\n---\nnotes.txt', stderr: '', code: 0 }),
    search: async () => [{ title: 'result', url: 'https://example.org/r', snippet: 'snip' }],
    writeFile: async (h, name, content) => ({ name, chars: content.length }),
    spill: () => 'spilled.log',
    record: (h, ev) => state.events.push(ev),
    readMeta: () => state.meta,
    writeMeta: (h, m) => { state.meta = m; },
    readEvents: () => pastEvents,
    recordNote: () => {},
    assess: null,
    gui: {
      open: async (h, url) => {
        state.guiOpens.push(url);
        return openImpl(state.guiOpens.length, url);
      },
      snapshot: async () => ({ ok: true, observation: 'snapshot' }),
      click: async () => ({ ok: true, observation: 'clicked' }),
      type: async () => ({ ok: true, observation: 'typed' }),
      screenshot: async () => ({ ok: true, observation: 'shot' }),
    },
    sleep: async () => {},
    now: () => Date.now(),
    buildBriefing: async () => 'BRIEFING-MARKER: memory briefing text.',
  };
  return state;
}

const FALLBACK = {
  ok: true, degraded: true,
  observation: 'Opened http://dvwa.test/ (headless preview — this browser is look-only: the clickable desktop is not running in this environment and nothing you install can change that. You can SEE pages here; to interact with a page, use shell + curl).\nPage: Login :: DVWA',
};
const REAL = { ok: true, observation: 'Opened http://dvwa.test/ in your desktop browser.\nPage: Login :: DVWA — Username Password Login' };
const openReply = (n) => `Open the target (try ${n}).\n{"action":"browser_open","url":"http://dvwa.test/"}`;

// (3a) The trap itself: two degraded opens, then the desktop
// recovers on the third execution — the third open must EXECUTE,
// and only genuinely-full repeats block afterwards (at ×2 full,
// exactly as today).
{
  const s = makeDeps({
    replies: [openReply(1), openReply(2), openReply(3), openReply(4), openReply(5), 'Noted.\n{"action":"note","text":"ok"}'],
    openImpl: (n) => (n <= 2 ? FALLBACK : REAL),
  });
  await humanIteration('h_af_test', URL1, { turns: 6, deps: s.deps });
  check('loop(3a): degraded opens 1-2 executed', s.guiOpens.length >= 2);
  check('loop(3a): third open EXECUTES after two degraded (trap gone)', s.guiOpens.length >= 3);
  check('loop(3a): opens stop once 2 FULL executions are on record', s.guiOpens.length === 4);
  check('loop(3a): exactly one dedup_block, at total ×4', (() => {
    const b = s.events.filter((e) => e.type === 'dedup_block');
    return b.length === 1 && b[0].count === 4;
  })());
  check('loop(3a): two tool_degraded events recorded', s.events.filter((e) => e.type === 'tool_degraded').length === 2);
  check('loop(3a): tool_degraded events carry tool + detail', (() => {
    const d = s.events.find((e) => e.type === 'tool_degraded');
    return d && d.tool === 'browser_open' && d.detail === 'http://dvwa.test/' && d.via === 'human-mode';
  })());
  check('loop(3a): block observation names the unblocked variations',
    s.screens.some((t) => t.includes('BLOCKED — ALREADY DONE') && t.includes('browser_snapshot') && t.includes('deeper URL')));
}

// (3b) The desktop NEVER recovers: four degraded opens execute,
// the fifth is blocked — no infinite fallback loop.
{
  const s = makeDeps({
    replies: [openReply(1), openReply(2), openReply(3), openReply(4), openReply(5), 'Noted.\n{"action":"note","text":"ok"}'],
    openImpl: () => FALLBACK,
  });
  await humanIteration('h_af_test', URL1, { turns: 6, deps: s.deps });
  check('loop(3b): four degraded opens execute', s.guiOpens.length === 4);
  check('loop(3b): fifth degraded open is blocked', s.events.filter((e) => e.type === 'dedup_block').length === 1);
  check('loop(3b): four tool_degraded events recorded', s.events.filter((e) => e.type === 'tool_degraded').length === 4);
}

// (3c) Cross-session: a previous session's record holds the two
// degraded opens (tool_call + tool_degraded pairs). The next
// session's first open must EXECUTE — this is the exact T4/T5
// failure, where later sessions inherited the trap.
{
  const past = [tc(), td(), tc(), td()];
  const s = makeDeps({
    pastEvents: past,
    replies: [openReply(1), 'Noted.\n{"action":"note","text":"ok"}'],
    openImpl: () => REAL,
  });
  await humanIteration('h_af_test', URL1, { turns: 2, deps: s.deps });
  check('loop(3c): inherited degraded record does not block the new session', s.guiOpens.length === 1);
  check('loop(3c): no dedup_block recorded', !s.events.some((e) => e.type === 'dedup_block'));
}

// (3d) Cross-session opposite: four inherited degraded opens DO
// block the new session's first attempt.
{
  const past = [tc(), td(), tc(), td(), tc(), td(), tc(), td()];
  const s = makeDeps({
    pastEvents: past,
    replies: [openReply(1), 'Noted.\n{"action":"note","text":"ok"}'],
    openImpl: () => REAL,
  });
  await humanIteration('h_af_test', URL1, { turns: 2, deps: s.deps });
  check('loop(3d): inherited ×4 degraded streak blocks', s.guiOpens.length === 0 && s.events.some((e) => e.type === 'dedup_block'));
}

// (3e) Ezviz regression: full executions from the start behave
// EXACTLY as Lane F — two execute, the third blocks, and no
// tool_degraded events appear.
{
  const s = makeDeps({
    replies: [openReply(1), openReply(2), openReply(3), 'Noted.\n{"action":"note","text":"ok"}'],
    openImpl: () => REAL,
  });
  await humanIteration('h_af_test', URL1, { turns: 4, deps: s.deps });
  check('loop(3e): two full opens execute, third blocked (Lane F unchanged)', s.guiOpens.length === 2 &&
    s.events.filter((e) => e.type === 'dedup_block').length === 1);
  check('loop(3e): no tool_degraded events for full executions', !s.events.some((e) => e.type === 'tool_degraded'));
  check('loop(3e): block observation names the variations for browser_open',
    s.screens.some((t) => t.includes('BLOCKED — ALREADY DONE') && t.includes('browser_snapshot')));
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
