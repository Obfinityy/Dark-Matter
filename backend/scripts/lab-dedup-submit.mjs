// Lab: dedup fresh-attempt exemption (dedup-submit lane, 28 Oct 2026).
//
// Replays the DVWA live shape through the REAL gate functions and the
// REAL humanIteration (stubbed GUI — no CDP desktop exists in the
// sandbox, so the click itself is stubbed; the gate verdicts, the
// block events and the loop flow are real).
//
// Live facts replayed (hunt h_830317bdc184, 28 Oct 2026):
//   - the UNION payload was TYPED successfully 03:34:52 IST, but the
//     Submit click was dedup-blocked 03:36:27 IST (and 8 more times:
//     03:40, 04:03, 05:55, 07:01, 08:20 IST, ...);
//   - the brain had looked at the page and typed a new marker since
//     the last Submit, so the 03:36 repeat was a FRESH attempt the
//     old gate could not see.
// The (A) checks use only these documented micro-sequences — no
// interleaving is invented. (C) runs the multi-turn flow end to end.
//
// Run: node scripts/lab-dedup-submit.mjs — exit 0 when all pass.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-dedupsubmit-'));
process.env.DATA_DIR = tmpRoot;
const {
  humanIteration,
  dedupeGateHit,
  freshAttemptSinceAction,
  buildActionHistory,
} = await import('../src/humanLoop.js');
const { evidenceReproduced, isHttpErrorPage } = await import('../src/hunt-intel/differential.js');

const TARGET = 'http://172.17.0.1:3100/';
const SQLI_URL = 'http://172.17.0.1:3100/vulnerabilities/sqli/';
const UNION = "1' UNION SELECT user,password FROM users#";
const SQLI_SNAP = { url: SQLI_URL, title: 'SQL Injection', text: 'SQL Injection page', elements: [] };

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
}
const tc = (tool, detail) => ({ type: 'tool_call', tool, detail });
const SUBMIT = tc('browser_click', 'Submit');
const SUBMIT_X2 = [SUBMIT, tc('browser_click', 'Submit')];
const SNAPSHOT = tc('browser_snapshot', '');
const RELOAD = tc('browser_open', SQLI_URL);
const TYPE_UNION = tc('browser_type', UNION);

// ---------------------------------------------------------------------------
// (A) The live 03:34 -> 03:36 micro-sequence, through the real gate.
// ---------------------------------------------------------------------------
console.log('(A) live shape: UNION typed 03:34:52, Submit blocked 03:36:27');
{
  // Two Submits already executed; the brain typed the UNION payload
  // after the last Submit (03:34:52), then clicked Submit (03:36:27).
  const events = [...SUBMIT_X2, TYPE_UNION];
  const history = buildActionHistory(events);
  check('the 03:34 type is fresh work since the last Submit', freshAttemptSinceAction(events, 'browser_click', 'Submit') === true);
  check('the OLD verdict would block (count 2, no exemption)', dedupeGateHit('browser_click', { text: 'Submit' }, history) !== null);
  check('the NEW gate lets the 03:36 Submit execute', dedupeGateHit('browser_click', { text: 'Submit' }, history, { events }) === null);
  // And the very next identical Submit, with nothing fresh since
  // the 03:36 execution, is still blocked — one fresh event buys
  // one extra execution, never a loop.
  const after = [...events, SUBMIT];
  const history2 = buildActionHistory(after);
  check('the next identical Submit (nothing fresh since) is still blocked', dedupeGateHit('browser_click', { text: 'Submit' }, history2, { events: after }) !== null);
}

// ---------------------------------------------------------------------------
// (B) 404 protection untouched.
// ---------------------------------------------------------------------------
console.log('\n(B) 404 error page still fails');
{
  const notFound = '<!DOCTYPE HTML><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL /rest/admin/application-version was not found on this server.</p></body></html>';
  check('the 404 page is detected as an error page', isHttpErrorPage(notFound) === true);
  check(
    'evidenceReproduced rejects the 404 re-run',
    evidenceReproduced('admin config', notFound, "curl -sk 'http://172.17.0.1:3100/rest/admin/application-version'") === false,
  );
}

// ---------------------------------------------------------------------------
// (C) Multi-turn flow through real humanIteration (stubbed GUI).
// ---------------------------------------------------------------------------
console.log('\n(C) blocked -> snapshot -> new marker -> Submit executes -> identical Submit blocked');
{
  const events = [...SUBMIT_X2];
  const recorded = [];
  const clickCalls = [];
  let n = 0;
  const replies = [
    `Looking at the SQLi page again.\n${JSON.stringify({ action: 'browser_snapshot' })}`,
    `Typing a fresh marker into the id field.\n${JSON.stringify({ action: 'browser_type', text: UNION })}`,
    `Submitting the payload in the visible browser.\n${JSON.stringify({ action: 'browser_click', text: 'Submit' })}`,
    `Submitting again.\n${JSON.stringify({ action: 'browser_click', text: 'Submit' })}`,
  ];
  let metaStore = {};
  const res = await humanIteration('h_test_lab_dedupsubmit', TARGET, {
    turns: 4,
    deps: {
      chat: async () => replies[n++],
      gui: {
        open: async (h, url) => ({ observation: `Page: ${url}\nSQL Injection page`, snapshot: SQLI_SNAP }),
        snapshot: async () => ({ observation: `Page: ${SQLI_URL}\nSQL Injection page — id field, Submit button`, snapshot: SQLI_SNAP }),
        click: async (h, text) => { clickCalls.push(String(text || '')); return { ok: true, observation: `Page: ${SQLI_URL}\nClicked ${text}.`, snapshot: SQLI_SNAP }; },
        type: async () => ({ ok: true, observation: `Page: ${SQLI_URL}\nTyped.`, snapshot: SQLI_SNAP }),
        screenshot: async () => ({ observation: 'shot', snapshot: SQLI_SNAP }),
      },
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      execRaw: async () => ({ stdout: '', stderr: '' }),
      record: (h, e) => { events.push(e); recorded.push(e); },
      recordNote: () => {},
      readMeta: () => metaStore,
      writeMeta: (h, patch) => { metaStore = { ...metaStore, ...(patch || {}) }; return metaStore; },
      readEvents: () => events,
      buildBriefing: async () => '',
      machineControlled: () => false,
      assess: null,
    },
  });
  check('four turns ran', res.turnsRun === 4);
  check('exactly one Submit executed (the fresh one)', clickCalls.length === 1 && clickCalls[0] === 'Submit');
  const blocks = recorded.filter((e) => e.type === 'dedup_block');
  check('exactly one dedup_block — the turn-4 identical repeat', blocks.length === 1);
  check('the fresh Submit returned the click observation', /Clicked Submit/.test(res.log[2].observation));
  check('the repeat was blocked with the already-done observation', /BLOCKED — ALREADY DONE/.test(res.log[3].observation));
}

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`} (${pass} passed, ${fail} failed)`);
process.exit(fail === 0 ? 0 : 1);
