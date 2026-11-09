// Dedup fresh-attempt exemption (dedup-submit lane, 28 Oct 2026) —
// tests through a stubbed humanIteration.
//
// The live DVWA hunt h_830317bdc184 had its browser_click Submit
// blocked 9 times by the exact-repeat dedupe gate (Lane F,
// threshold 2) — 03:36, 03:40, 04:03, 05:55, 07:01, 08:20 IST and
// more — and re-typing the same UNION payload blocked too. The
// Submit click is IDENTICAL every time whatever was typed into
// the form, so each retry looked like a blind repeat even when
// the brain had looked at the page again, typed a NEW proof
// marker, or reloaded the page since the last Submit. The fix
// extends the fresh-attempt logic (184ec79) to the dedup gate: a
// repeat is a loop ONLY when nothing fresh happened since the
// last identical execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE humanLoop (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-dedupsubmit-'));
process.env.DATA_DIR = tmpRoot;
const {
  humanIteration,
  dedupeGateHit,
  freshAttemptSinceAction,
  FRESH_DEDUP_KINDS,
  buildActionHistory,
} = await import('./humanLoop.js');
const {
  evidenceReproduced,
  isHttpErrorPage,
  assessContentRelevance,
} = await import('./hunt-intel/differential.js');

const TARGET = 'http://172.17.0.1:3100/';
const SQLI_URL = 'http://172.17.0.1:3100/vulnerabilities/sqli/';
const UNION = "1' UNION SELECT user,password FROM users#";
const UNION_OLD = "1' UNION SELECT user,password FROM users -- ";
const MARKER_NEW = "1' UNION SELECT user,password FROM users# -- QXZ7719";

const SQLI_SNAP = {
  url: SQLI_URL,
  title: 'SQL Injection',
  text: 'SQL Injection page',
  elements: [{ tag: 'input', name: 'id' }, { tag: 'input', type: 'submit', value: 'Submit' }],
};

// The tool_call records the loop itself writes (toolCall): the
// shape the fresh-attempt check reads from the event record.
const tc = (tool, detail) => ({ type: 'tool_call', tool, detail });
const SUBMIT = tc('browser_click', 'Submit');
const SUBMIT_X2 = [SUBMIT, tc('browser_click', 'Submit')];
const SNAPSHOT = tc('browser_snapshot', '');
const SEE_SCREEN = tc('see_screen', '');
const DESKTOP_SNAP = tc('desktop_snapshot', '');
const RELOAD = tc('browser_open', SQLI_URL);
const TYPE_UNION = tc('browser_type', 'id ← ' + UNION);
const TYPE_MARKER_NEW = tc('browser_type', 'id ← ' + MARKER_NEW);
const CLICK_LOGIN = tc('browser_click', 'Login');
const SHELL_CURL = tc('shell', "curl -sk 'http://172.17.0.1:3100/vulnerabilities/sqli/?id=1'");
const SEARCH = tc('search', 'DVWA SQL injection');
const DEDUP_BLOCK = { type: 'dedup_block', tool: 'browser_click', detail: 'Submit', count: 2 };

// Pure: freshAttemptSinceAction.

test('freshAttemptSinceAction: a fresh screen read since the last Submit is fresh', () => {
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2, SNAPSHOT], 'browser_click', 'Submit'), true);
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2, SEE_SCREEN], 'browser_click', 'Submit'), true);
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2, DESKTOP_SNAP], 'browser_click', 'Submit'), true);
});

test('freshAttemptSinceAction: a new marker typed since the last Submit is fresh', () => {
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2, TYPE_MARKER_NEW], 'browser_click', 'Submit'), true);
});

test('freshAttemptSinceAction: a page reload since the last Submit is fresh', () => {
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2, RELOAD], 'browser_click', 'Submit'), true);
});

test('freshAttemptSinceAction: a different click since the last Submit is fresh', () => {
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2, CLICK_LOGIN], 'browser_click', 'Submit'), true);
});

test('freshAttemptSinceAction: nothing since the last identical execution is NOT fresh', () => {
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2], 'browser_click', 'Submit'), false);
  assert.equal(freshAttemptSinceAction([SUBMIT], 'browser_click', 'Submit'), false);
});

test('freshAttemptSinceAction: shell / search since the last Submit do NOT make it fresh', () => {
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2, SHELL_CURL], 'browser_click', 'Submit'), false);
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2, SEARCH], 'browser_click', 'Submit'), false);
});

test('freshAttemptSinceAction: a blocked action since the last Submit does NOT make it fresh', () => {
  assert.equal(freshAttemptSinceAction([...SUBMIT_X2, DEDUP_BLOCK], 'browser_click', 'Submit'), false);
});

test('freshAttemptSinceAction: no such execution in the record is NOT fresh', () => {
  assert.equal(freshAttemptSinceAction([SNAPSHOT], 'browser_click', 'Submit'), false);
  assert.equal(freshAttemptSinceAction([], 'browser_click', 'Submit'), false);
  assert.equal(freshAttemptSinceAction(null, 'browser_click', 'Submit'), false);
});

test('freshAttemptSinceAction: fresh work BEFORE the last identical execution does NOT count', () => {
  // The snapshot predates the latest Submit — the brain looked,
  // then submitted, and has done nothing fresh since THAT submit.
  assert.equal(freshAttemptSinceAction([SNAPSHOT, ...SUBMIT_X2], 'browser_click', 'Submit'), false);
  assert.equal(freshAttemptSinceAction([TYPE_MARKER_NEW, ...SUBMIT_X2], 'browser_click', 'Submit'), false);
});

test('freshAttemptSinceAction: only work AFTER the last identical type counts for a re-type', () => {
  assert.equal(freshAttemptSinceAction([TYPE_UNION, TYPE_UNION, RELOAD], 'browser_type', 'id ← ' + UNION), true);
  assert.equal(freshAttemptSinceAction([TYPE_UNION, TYPE_UNION, SHELL_CURL], 'browser_type', 'id ← ' + UNION), false);
  assert.equal(
    freshAttemptSinceAction([TYPE_UNION, tc('browser_type', 'id ← ' + UNION_OLD)], 'browser_type', 'id ← ' + UNION),
    true,
    'typing a DIFFERENT payload since the last identical type is fresh work',
  );
});

// Pure: dedupeGateHit with the fresh-attempt exemption.

function historyOf(events) {
  return buildActionHistory(events);
}

test('dedupeGateHit: a Submit at count 2 after a fresh screen read is allowed', () => {
  const h = historyOf(SUBMIT_X2);
  assert.equal(dedupeGateHit('browser_click', { text: 'Submit' }, h, { events: [...SUBMIT_X2, SNAPSHOT] }), null);
});

test('dedupeGateHit: a Submit at count 2 with nothing fresh since is still blocked', () => {
  const h = historyOf(SUBMIT_X2);
  const hit = dedupeGateHit('browser_click', { text: 'Submit' }, h, { events: SUBMIT_X2 });
  assert.ok(hit, 'identical repeat with nothing changed since is still a loop');
  assert.equal(hit.tool, 'browser_click');
  assert.equal(hit.count, 2);
});

test('dedupeGateHit: without an events record the old rule holds unchanged', () => {
  const h = historyOf(SUBMIT_X2);
  assert.ok(dedupeGateHit('browser_click', { text: 'Submit' }, h), 'no ctx — old behaviour');
  assert.ok(dedupeGateHit('browser_click', { text: 'Submit' }, h, {}), 'empty ctx — old behaviour');
});

test('dedupeGateHit: shell is NOT fresh-eligible — a snapshot does not unblock a shell repeat', () => {
  const cmd = "curl -sk 'http://172.17.0.1:3100/vulnerabilities/sqli/?id=1'";
  const h = historyOf([tc('shell', cmd), tc('shell', cmd)]);
  const hit = dedupeGateHit('shell', { command: cmd }, h, { events: [tc('shell', cmd), tc('shell', cmd), SNAPSHOT] });
  assert.ok(hit, 'a screen read changes nothing about what a curl returns');
  assert.equal(hit.tool, 'shell');
});

test('dedupeGateHit: a re-type at count 2 after a reload is allowed; after shell only it is blocked', () => {
  const h = historyOf([TYPE_UNION, TYPE_UNION]);
  assert.equal(
    dedupeGateHit('browser_type', { target: 'id', text: UNION }, h, { events: [TYPE_UNION, TYPE_UNION, RELOAD] }),
    null,
    'the reload emptied the form, so the re-type acts on a fresh form',
  );
  assert.ok(
    dedupeGateHit('browser_type', { target: 'id', text: UNION }, h, { events: [TYPE_UNION, TYPE_UNION, SHELL_CURL] }),
    'shell changes nothing about the form',
  );
});

test('dedupeGateHit: below the threshold nothing is blocked, fresh or not', () => {
  const h = historyOf([SUBMIT]);
  assert.equal(dedupeGateHit('browser_click', { text: 'Submit' }, h, { events: [SUBMIT] }), null);
});

test('FRESH_DEDUP_KINDS covers the GUI actions and excludes shell and search', () => {
  for (const k of ['browser_click', 'browser_type', 'browser_open', 'desktop_click', 'desktop_click_at', 'desktop_click_control', 'desktop_key']) {
    assert.ok(FRESH_DEDUP_KINDS.has(k), `${k} must be fresh-eligible`);
  }
  assert.ok(!FRESH_DEDUP_KINDS.has('shell'), 'shell stays under the old rule');
  assert.ok(!FRESH_DEDUP_KINDS.has('search'), 'search stays under the old rule');
  assert.ok(!FRESH_DEDUP_KINDS.has('launch_tool'), 'launch_tool stays under the old rule');
});

// Integration: stubbed humanIteration, DVWA live shape.

function stubDedupSession(replies, seedEvents) {
  const events = [...(seedEvents || [])];
  const recorded = [];
  const clickCalls = [];
  const typeCalls = [];
  let n = 0;
  let metaStore = {};
  return {
    events,
    recorded,
    clickCalls,
    typeCalls,
    get meta() { return metaStore; },
    run: (turns) => humanIteration('h_test_dedupsubmit', TARGET, {
      turns: turns ?? replies.length,
      deps: {
        chat: async () => replies[n++],
        gui: {
          open: async (h, url) => ({ observation: `Page: ${url}\nSQL Injection page`, snapshot: SQLI_SNAP }),
          snapshot: async () => ({ observation: `Page: ${SQLI_URL}\nSQL Injection page — id field, Submit button`, snapshot: SQLI_SNAP }),
          click: async (h, text) => { clickCalls.push(String(text || '')); return { ok: true, observation: `Page: ${SQLI_URL}\nClicked ${text}.`, snapshot: SQLI_SNAP }; },
          type: async (h, target, text) => { typeCalls.push(String(text || '')); return { ok: true, observation: `Page: ${SQLI_URL}\nTyped.`, snapshot: SQLI_SNAP }; },
          screenshot: async () => ({ observation: 'shot', snapshot: SQLI_SNAP }),
        },
        exec: async () => ({ stdout: '', stderr: '', code: 0 }),
        execRaw: async () => ({ stdout: '', stderr: '' }),
        // The record IS the hunt's event store here: executed tool
        // calls join it, so the next turn's fresh-attempt check
        // reads this session's own GUI work exactly like the live
        // backend re-reading events.jsonl.
        record: (h, e) => { events.push(e); recorded.push(e); },
        recordNote: () => {},
        readMeta: () => metaStore,
        writeMeta: (h, patch) => { metaStore = { ...metaStore, ...(patch || {}) }; return metaStore; },
        readEvents: () => events,
        buildBriefing: async () => '',
        machineControlled: () => false,
        assess: null,
      },
    }),
  };
}

const clickSubmitReply = (thinking) => `${thinking || 'Submitting the payload in the visible browser.'}\n${JSON.stringify({ action: 'browser_click', text: 'Submit' })}`;
const snapshotReply = () => `Looking at the SQLi page again.\n${JSON.stringify({ action: 'browser_snapshot' })}`;
const typeReply = (text) => `Typing the payload into the id field.\n${JSON.stringify({ action: 'browser_type', target: 'id', text })}`;

test('DS-1: a Submit after a fresh screen read and a new marker executes — the live 03:36 block is lifted', async () => {
  const seed = [...SUBMIT_X2, SNAPSHOT, TYPE_MARKER_NEW];
  const s = stubDedupSession([clickSubmitReply()], seed);
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  assert.equal(s.clickCalls.length, 1, 'the Submit must execute — the form holds a new marker since the last Submit');
  assert.equal(s.clickCalls[0], 'Submit');
  assert.ok(!s.recorded.some((e) => e.type === 'dedup_block'), 'no dedup_block on a fresh attempt');
  assert.match(res.log[0].observation, /Clicked Submit/);
});

test('DS-2: an identical Submit with nothing changed since is still blocked', async () => {
  const s = stubDedupSession([clickSubmitReply()], [...SUBMIT_X2]);
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  assert.equal(s.clickCalls.length, 0, 'the repeat must never execute');
  const block = s.recorded.find((e) => e.type === 'dedup_block');
  assert.ok(block, 'a dedup_block event must be recorded');
  assert.equal(block.tool, 'browser_click');
  assert.equal(block.count, 2);
  assert.match(res.log[0].observation, /BLOCKED — ALREADY DONE/);
});

test('DS-3: a Submit after a page reload executes', async () => {
  const seed = [...SUBMIT_X2, RELOAD];
  const s = stubDedupSession([clickSubmitReply()], seed);
  const res = await s.run();
  assert.equal(res.turnsRun, 1);
  assert.equal(s.clickCalls.length, 1, 'the reload emptied the form — the re-submit acts on a fresh page');
  assert.ok(!s.recorded.some((e) => e.type === 'dedup_block'));
});

test('DS-4: one snapshot buys exactly one extra Submit — the next identical repeat is blocked again', async () => {
  const s = stubDedupSession(
    [snapshotReply(), clickSubmitReply(), clickSubmitReply('Submitting again.')],
    [...SUBMIT_X2],
  );
  const res = await s.run(3);
  assert.equal(res.turnsRun, 3);
  // Turn 1 snapshots (a read, never gated); turn 2 submits (fresh
  // since the snapshot); turn 3 submits again with nothing fresh
  // since turn 2's Submit — the earlier snapshot is now BEFORE the
  // latest execution and no longer counts.
  assert.equal(s.clickCalls.length, 1, 'only the fresh Submit executes');
  const blocks = s.recorded.filter((e) => e.type === 'dedup_block');
  assert.equal(blocks.length, 1, 'exactly one block — the turn-3 repeat');
  assert.equal(blocks[0].count, 3, 'the count now carries the fresh execution');
  assert.match(res.log[1].observation, /Clicked Submit/);
  assert.match(res.log[2].observation, /BLOCKED — ALREADY DONE/);
});

test('DS-5: a re-type after a reload executes, and the next identical re-type without fresh work is blocked', async () => {
  const seed = [TYPE_UNION, TYPE_UNION, RELOAD];
  const s = stubDedupSession(
    [typeReply(UNION), typeReply(UNION)],
    seed,
  );
  const res = await s.run(2);
  assert.equal(res.turnsRun, 2);
  assert.equal(s.typeCalls.length, 1, 'only the fresh re-type executes');
  assert.equal(s.typeCalls[0], UNION);
  const blocks = s.recorded.filter((e) => e.type === 'dedup_block');
  assert.equal(blocks.length, 1, 'the second identical re-type is blocked — the reload was spent on the first');
  assert.match(res.log[0].observation, /Typed\./);
  assert.match(res.log[1].observation, /BLOCKED — ALREADY DONE/);
});

// The 404 protection is untouched: the verification path is not modified by this lane, and these pins fail if anyone weakens it.

const NOT_FOUND_PAGE = '<!DOCTYPE HTML><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL /rest/admin/application-version was not found on this server.</p></body></html>';

test('DS-6 (404 pin): an HTTP error page still can never confirm — the step-2 rejection is intact', () => {
  assert.equal(isHttpErrorPage(NOT_FOUND_PAGE), true);
  const evidence = 'admin application-version endpoint returned the admin config';
  assert.equal(
    evidenceReproduced(evidence, NOT_FOUND_PAGE, "curl -sk 'http://172.17.0.1:3100/rest/admin/application-version'"),
    false,
    'a 404 re-run reproduces nothing, however many signal words its body carries',
  );
  const rel = assessContentRelevance({
    command: "curl -sk 'http://172.17.0.1:3100/rest/admin/application-version'",
    target: TARGET,
    output: NOT_FOUND_PAGE,
    baselines: [],
  });
  assert.equal(rel.relevant, false);
  assert.match(rel.reason, /HTTP 404 error page/);
});
