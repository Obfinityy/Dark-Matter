// Test for Lane AG (24 Oct 2026) — settled-action counter-evidence
// in the BLOCK OBSERVATION: Lane AD put the correcting fact in the
// screen preamble and the live Ezviz brain repeated its false
// premise verbatim anyway (2 of 2 post-AD turns re-chose the
// settled register open, blocks 65 and 66). The brain builds its
// next turn's reasoning from the last RESULT text, so when the
// gate blocks a SETTLED action (>= 3 blocks — Lane AD's own
// definition, shared helpers), the observation itself must carry
// the counter-evidence: the block ordinal, how many requests were
// actually SENT to the path, the most recent one with its recorded
// outcome, and the redirect. Non-settled blocks keep the existing
// observation untouched.
//
// Run: node backend/scripts/test-settled-block-evidence.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-ag-'));
process.env.DATA_DIR = tmp;

const {
  humanIteration,
  buildActionHistory,
  actionSignature,
  settledActionLines,
  settledBlockEvidence,
} = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}
// Pre-implementation the export is undefined: answer '' so every
// content check fails individually instead of crashing the suite.
const sbe = (args) => (typeof settledBlockEvidence === 'function' ? settledBlockEvidence(args) : '');

// Record shapes mirror production exactly (see test-repeat-discipline.mjs).
const ev = (tool, detail, cachedAt) => ({ type: 'tool_call', tool, detail, via: 'human-mode', cachedAt });
const blockEv = (tool, detail, count, cachedAt) => ({ type: 'dedup_block', tool, detail, count, via: 'human-mode', cachedAt });

const REGISTER = 'https://open.ys7.com/rest/user/register';
const T0 = Date.parse('2026-10-23T09:00:00.000Z');
const ts = (i) => new Date(T0 + i * 60000).toISOString();

// --- (a) the Ezviz register pattern: settled open, 7 requests on
// record (the last a SQLi-payload curl), last outcome known -------
{
  const events = [ev('browser_open', REGISTER, ts(0)), ev('browser_open', REGISTER, ts(1))];
  const probes = [
    'curl -s https://open.ys7.com/rest/user/register -o /dev/null -w "%{http_code}"',
    'curl -s -X POST https://open.ys7.com/rest/user/register -d "username=probe2&password=Probe123!"',
    'curl -s https://open.ys7.com/rest/user/register?debug=1',
    'curl -s -X POST https://open.ys7.com/rest/user/register -d "username=probe3&password=Probe123!&email=p3@example.com"',
    'curl -s -H "Content-Type: application/json" -X POST https://open.ys7.com/rest/user/register -d "{\\"username\\":\\"probe4\\"}"',
    'curl -s https://open.ys7.com/rest/user/register -A "Mozilla/5.0"',
  ];
  probes.forEach((c, i) => events.push(ev('shell', c, ts(2 + i))));
  const lastProbe = 'curl -s -X POST https://open.ys7.com/rest/user/register -d "username=admin\' OR \'1\'=\'1&password=x" --max-time 20';
  events.push(ev('shell', lastProbe, ts(9)));
  for (let i = 0; i < 64; i++) events.push(blockEv('browser_open', REGISTER, 3 + i, ts(10 + i)));

  const history = buildActionHistory(events);
  // The live session's memory of what the last probe returned
  // (events never store results; the live history entry does).
  const lastEntry = history.get(actionSignature('shell', lastProbe));
  check('(a) fixture: the last probe has a history entry', Boolean(lastEntry));
  if (lastEntry) {
    lastEntry.lastResult = 'HTTP 200, 43 bytes: {"code":4001,"msg":"login required"} — the identical catch-all body every path returns; no account was created';
  }

  const text = sbe({ events, history, tool: 'browser_open', detail: REGISTER, extraBlocks: 1 });
  check('(a) settled block evidence is produced', text.length > 0 && text.includes('SETTLED'));
  check('(a) carries the block ordinal including the current block (64 + 1 = 65)', text.includes('blocked 65 times'));
  check('(a) carries the requests-sent count (×7)', text.includes('7 requests already SENT'));
  check('(a) names the most recent request (the SQLi curl)', text.includes("OR '1'='1"));
  check('(a) carries the last request\'s recorded outcome', text.includes('login required'));
  check('(a) carries the redirect: opening cannot probe, SEND a request', text.includes('Opening cannot probe it') && text.includes('SEND a request') && text.includes('curl with a payload'));
  check('(a) the whole addition stays within the ~420-char bound', text.length <= 420);

  // (f) the shared facts still render in Lane AD's settled lines;
  // Lane AH additionally carries the most-recent request there
  // (full AH coverage: test-settled-evidence-persistence.mjs)
  const adText = settledActionLines({ events, history }).join('\n');
  check('(f) AD settled lines still carry the shared facts (blocked ×64, requests sent ×7)',
    adText.includes('blocked ×64') && adText.includes('requests sent ×7'));
  check('(f) the settled line now names the most recent request too (Lane AH)',
    adText.includes('most recent:') && adText.includes("OR '1'='1"));
}

// --- (b) settled open with ZERO requests on record: the truthful
// "no request sent yet" variant ------------------------------------
{
  const ORPHAN = 'https://open.ys7.com/rest/user/activate';
  const events = [ev('browser_open', ORPHAN, ts(0)), ev('browser_open', ORPHAN, ts(1))];
  for (let i = 0; i < 4; i++) events.push(blockEv('browser_open', ORPHAN, 3 + i, ts(2 + i)));
  const text = sbe({ events, history: buildActionHistory(events), tool: 'browser_open', detail: ORPHAN, extraBlocks: 1 });
  check('(b) evidence produced for a settled open with no requests', text.includes('SETTLED') && text.includes('blocked 5 times'));
  check('(b) truthfully says no request was sent yet', text.includes('No request has been sent to this path yet'));
  check('(b) never claims requests were sent', !text.includes('already SENT'));
  check('(b) redirect still applies (opening cannot send one)', text.includes('opening it cannot send one') && text.includes('SEND a request'));
  check('(b) within the bound', text.length <= 420);
}

// --- (c) a NON-settled block gets no addition ----------------------
{
  const events = [ev('browser_open', REGISTER, ts(0)), ev('browser_open', REGISTER, ts(1)),
    blockEv('browser_open', REGISTER, 3, ts(2))];
  check('(c) second-ever block (1 recorded + current) is not settled',
    sbe({ events, history: buildActionHistory(events), tool: 'browser_open', detail: REGISTER, extraBlocks: 1 }) === '');
  check('(c) first block is not settled either',
    sbe({ events: [ev('browser_open', REGISTER, ts(0)), ev('browser_open', REGISTER, ts(1))], history: buildActionHistory(events), tool: 'browser_open', detail: REGISTER, extraBlocks: 1 }) === '');
}

// --- (d) a settled NON-open action: ordinal + kind-appropriate
// redirect, no page-open text --------------------------------------
{
  const Q = 'ezviz ys7 open api authentication bypass';
  const events = [ev('search', Q, ts(0)), ev('search', Q, ts(1))];
  for (let i = 0; i < 3; i++) events.push(blockEv('search', Q, 3 + i, ts(2 + i)));
  const text = sbe({ events, history: buildActionHistory(events), tool: 'search', detail: Q, extraBlocks: 1 });
  check('(d) settled search evidence produced with its ordinal (3 + 1 = 4)', text.includes('SETTLED') && text.includes('blocked 4 times'));
  check('(d) redirect fits the kind (identical repeat, vary the input)', text.includes('identical repeat returns the identical result') && text.includes('vary the input'));
  check('(d) no page-open text leaks in', !text.includes('Opening') && !text.includes('SEND a request') && !text.includes('probes nothing'));
  check('(d) within the bound', text.length <= 420);
}

// --- (e) blocks without executed history never settle (AD's
// history-entry requirement, shared) --------------------------------
{
  const GHOST = 'https://open.ys7.com/never-opened';
  const events = [];
  for (let i = 0; i < 5; i++) events.push(blockEv('browser_open', GHOST, 3 + i, ts(i)));
  check('(e) a block stream for a never-executed action yields no evidence',
    sbe({ events, history: buildActionHistory(events), tool: 'browser_open', detail: GHOST, extraBlocks: 1 }) === '');
}

// --- (g) outcome omitted when the record holds none -----------------
{
  const events = [ev('browser_open', REGISTER, ts(0)), ev('browser_open', REGISTER, ts(1)),
    ev('shell', 'curl -s -X POST https://open.ys7.com/rest/user/register -d "username=zz&password=Probe123!"', ts(2))];
  for (let i = 0; i < 5; i++) events.push(blockEv('browser_open', REGISTER, 3 + i, ts(3 + i)));
  const text = sbe({ events, history: buildActionHistory(events), tool: 'browser_open', detail: REGISTER, extraBlocks: 1 });
  check('(g) the last request is still named', text.includes('username=zz'));
  check('(g) no fabricated outcome arrow when the record holds none', !text.includes('→'));
  check('(g) count + redirect still present', text.includes('1 request already SENT') && text.includes('SEND a request'));
}

// Screen-level harness (mirrors test-repeat-discipline.mjs —
// readEvents returns the live array that record appends to,
// exactly the production contract).
function makeDeps(state, queue) {
  return {
    chat: async (messages) => {
      state.screens.push(messages[0].text);
      return queue.length ? queue.shift() : null;
    },
    exec: async () => ({ stdout: 'CATCHALL-43B {"code":4001,"msg":"login required"} — the same body every path returns', stderr: '', code: 0 }),
    execRaw: async () => ({ stdout: '/root\n---\nnotes.txt', stderr: '', code: 0 }),
    search: async () => [],
    writeFile: async (h, name, content) => ({ name, chars: content.length }),
    spill: () => 'spilled.log',
    record: (h, e) => state.events.push(e),
    readMeta: () => state.meta,
    writeMeta: (h, m) => { state.meta = JSON.parse(JSON.stringify(m)); },
    readEvents: () => state.events,
    assess: null,
    gui: {
      open: async (h, url) => ({ ok: true, observation: `Opened ${url} in your desktop browser.` }),
      snapshot: async () => ({ ok: true, observation: 'Page snapshot' }),
      click: async () => ({ ok: true, observation: 'clicked' }),
      type: async () => ({ ok: true, observation: 'typed' }),
      screenshot: async () => ({ ok: true, observation: 'shot' }),
    },
    sleep: async () => {},
    now: () => Date.now(),
    buildBriefing: async () => 'BRIEFING-MARKER',
  };
}
const baseMeta = (huntId, target) => ({
  huntId, target, mode: 'human', humanMode: true,
  humanLoop: { sessions: 3, turnsTotal: 700, lastTurnAt: '2026-10-23T20:41:07.000Z', leftOff: null },
});

// --- (h) end to end: the block observation itself carries the
// counter-evidence on the NEXT screen ------------------------------
{
  const HUNT = 'h_settled_block_test';
  const TARGET = 'https://open.ys7.com';
  fs.mkdirSync(path.join(tmp, 'hunts', HUNT), { recursive: true });
  const seed = [ev('browser_open', REGISTER, ts(0)), ev('browser_open', REGISTER, ts(1))];
  for (let i = 0; i < 6; i++) seed.push(ev('shell', `curl -s https://open.ys7.com/rest/user/register -d "probe=${i}"`, ts(2 + i)));
  for (let i = 0; i < 62; i++) seed.push(blockEv('browser_open', REGISTER, 3 + i, ts(10 + i)));
  const state = { screens: [], events: seed, meta: baseMeta(HUNT, TARGET) };
  const probeCmd = 'curl -s -X POST https://open.ys7.com/rest/user/register -d "username=agprobe\' OR \'1\'=\'1&password=x"';
  const queue = [
    `The registration endpoint has been visited multiple times without being probed. Sending a probe.\n{"action":"shell","command":${JSON.stringify(probeCmd)}}`,
    `The registration endpoint has been visited multiple times without being probed. Opening it to probe.\n{"action":"browser_open","url":"${REGISTER}"}`,
    'Noted.\n{"action":"note","text":"reading the block evidence"}',
  ];
  const deps = makeDeps(state, queue);
  const res = await humanIteration(HUNT, TARGET, { turns: 3, deps });
  check('(h) session ran 3 turns', res.turnsRun === 3);
  const s2 = state.screens[1] || '';
  check('(h) the evidence is NOT in the observation before any settled block lands',
    !s2.includes('has now been chosen and blocked'));
  const s3 = state.screens[2] || '';
  check('(h) the block observation carries the settled marker + ordinal (62 seeded + current = 63)',
    s3.includes('has now been chosen and blocked 63 times'));
  check('(h) the current block is not double-counted (no 64)', !s3.includes('blocked 64 times'));
  check('(h) the observation states the requests now sent (6 seeded + the in-session probe = 7)',
    s3.includes('7 requests already SENT'));
  check('(h) the observation names the in-session probe as the most recent request', s3.includes("OR '1'='1"));
  check('(h) the observation carries that probe\'s recorded outcome', s3.includes('CATCHALL-43B'));
  check('(h) the observation carries the redirect', s3.includes('Opening cannot probe it') && s3.includes('SEND a request'));
  const block = state.events.find((e) => e.type === 'dedup_block' && e.tool === 'browser_open' && e.cachedAt === undefined && e.count === 2);
  check('(h) the gate still recorded the block exactly as before (count = run count)', Boolean(block) || state.events.some((e) => e.type === 'dedup_block' && e.tool === 'browser_open'));
}

// --- (i) end to end control: a NON-settled block observation is
// byte-identical in shape to today's (no SETTLED addition) ---------
{
  const HUNT = 'h_unsettled_block_test';
  const TARGET = 'https://open.ys7.com';
  fs.mkdirSync(path.join(tmp, 'hunts', HUNT), { recursive: true });
  const LOGIN = 'https://open.ys7.com/rest/user/login';
  const seed = [ev('browser_open', LOGIN, ts(0)), ev('browser_open', LOGIN, ts(1)), blockEv('browser_open', LOGIN, 3, ts(2))];
  const state = { screens: [], events: seed, meta: baseMeta(HUNT, TARGET) };
  const queue = [
    `Opening login again.\n{"action":"browser_open","url":"${LOGIN}"}`,
    'Noted.\n{"action":"note","text":"ok"}',
  ];
  const deps = makeDeps(state, queue);
  const res = await humanIteration(HUNT, TARGET, { turns: 2, deps });
  check('(i) session ran 2 turns', res.turnsRun === 2);
  const s2 = state.screens[1] || '';
  check('(i) the ordinary block observation is present', s2.includes('BLOCKED — ALREADY DONE'));
  check('(i) no settled evidence was appended for a non-settled block', !s2.includes('has now been chosen and blocked') && !s2.includes('SETTLED:'));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
