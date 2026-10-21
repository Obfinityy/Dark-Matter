// Test for the human-mode ALREADY-DONE GATE (Lane F, 21 Oct 2026).
//
// Live evidence it answers: the Ezviz human-mode hunt h_07c2709955d3
// logged 536 tool_call events of which only 214 were unique — 60%
// exact repeats (browser_open of the target root ×94, the identical
// search ×18). The prompt-level Repetition Check (Lane D) showed the
// hunter those counts and the 8B brain ignored them. This gate
// enforces the record in deterministic code instead:
//   - an action whose signature already appears >= 2 times in the
//     hunt's history is NOT executed;
//   - the block is recorded as a dedup_block event and the brain gets
//     an observation (count + last result when known) telling it to
//     choose a different action;
//   - the screen carries an "Already explored — do not repeat" digest
//     early, ahead of the memory briefing;
//   - first- and second-time actions, and every non-gated action
//     kind (note, write_file, claim_finding, snapshot, screenshot),
//     pass exactly as before.
//
// Like test-human-loop.mjs, the loop is driven end-to-end with
// injected fakes (scripted brain, fake GUI/search/shell). No Docker,
// no model. Run: node backend/scripts/test-human-dedupe.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-dedupe-'));
process.env.DATA_DIR = tmp;

const {
  humanIteration,
  actionSignature,
  normalisedActionDetail,
  buildActionHistory,
  exploredDigestLines,
  dedupeGateHit,
} = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// ---------------------------------------------------------------------------
// Signature normalisation units
// ---------------------------------------------------------------------------
check('sig: browser_open trailing slash + host case erased',
  actionSignature('browser_open', 'https://Open.Ys7.com/login/') === actionSignature('browser_open', 'https://open.ys7.com/login'));
check('sig: browser_open bare root == root slash',
  actionSignature('browser_open', 'https://open.ys7.com') === actionSignature('browser_open', 'https://open.ys7.com/'));
check('sig: browser_open different paths differ',
  actionSignature('browser_open', 'https://open.ys7.com/login') !== actionSignature('browser_open', 'https://open.ys7.com/register'));
check('sig: browser_open query string preserved',
  actionSignature('browser_open', 'https://open.ys7.com/s?a=1') !== actionSignature('browser_open', 'https://open.ys7.com/s?a=2'));
check('sig: search lowercased + whitespace collapsed',
  actionSignature('search', '  Site:Open.Ys7.com   Security   Headers ') === actionSignature('search', 'site:open.ys7.com security headers'));
check('sig: shell trimmed but case preserved',
  actionSignature('shell', '  curl -s https://x.test/ ') === actionSignature('shell', 'curl -s https://x.test/') &&
  actionSignature('shell', 'Curl -s https://x.test/') !== actionSignature('shell', 'curl -s https://x.test/'));
check('sig: click target trimmed only',
  normalisedActionDetail('browser_click', '  Sign in ') === 'Sign in');

// ---------------------------------------------------------------------------
// History + gate + digest units
// ---------------------------------------------------------------------------
const seedEvents = [];
for (let i = 0; i < 5; i++) seedEvents.push({ type: 'tool_call', tool: 'browser_open', detail: 'https://open.ys7.com/' });
seedEvents.push({ type: 'tool_call', tool: 'browser_open', detail: 'https://open.ys7.com/login/' });
seedEvents.push({ type: 'tool_call', tool: 'browser_open', detail: 'https://open.ys7.com/login' });
for (let i = 0; i < 4; i++) seedEvents.push({ type: 'tool_call', tool: 'search', detail: 'site:open.ys7.com security headers' });
for (let i = 0; i < 3; i++) seedEvents.push({ type: 'tool_call', tool: 'shell', detail: 'curl -s https://open.ys7.com/' });
for (let i = 0; i < 2; i++) seedEvents.push({ type: 'tool_call', tool: 'search', detail: 'a twice-run query' });
seedEvents.push({ type: 'tool_call', tool: 'browser_snapshot', detail: '' });
seedEvents.push({ type: 'tool_call', tool: 'claim_finding', detail: 'Some claim' });
seedEvents.push({ type: 'thinking', text: 'not an action' });

const hist = buildActionHistory(seedEvents);
check('history: slash variants merge into one entry (login ×2)',
  hist.get(actionSignature('browser_open', 'https://open.ys7.com/login')).count === 2);
check('history: root counted ×5', hist.get(actionSignature('browser_open', 'https://open.ys7.com')).count === 5);
check('history: detail-less + non-gated tools skipped',
  ![...hist.values()].some((e) => e.tool === 'browser_snapshot' || e.tool === 'claim_finding'));
check('gate: 1 prior run passes', dedupeGateHit('search', { query: 'a once-run query' }, buildActionHistory([{ type: 'tool_call', tool: 'search', detail: 'a once-run query' }])) === null);
check('gate: 2 prior runs block', (() => {
  const hit = dedupeGateHit('browser_open', { url: 'https://open.ys7.com/login/' }, hist);
  return hit && hit.count === 2 && hit.tool === 'browser_open';
})());
check('gate: non-gated kinds never blocked', dedupeGateHit('note', { text: 'x' }, hist) === null && dedupeGateHit('claim_finding', { title: 'Some claim' }, hist) === null);
check('gate: empty detail never blocked', dedupeGateHit('browser_open', { url: '' }, hist) === null);

const digest = exploredDigestLines(hist).join('\n');
check('digest: header present', digest.includes('ALREADY EXPLORED — DO NOT REPEAT'));
check('digest: shows ×5 root + ×4 search + ×3 shell',
  digest.includes('https://open.ys7.com/ — ×5') && digest.includes('site:open.ys7.com security headers — ×4') && digest.includes('curl -s https://open.ys7.com/ — ×3'));
check('digest: ×2 items not listed (below digest threshold)', !digest.includes('a twice-run query') && !digest.includes('login — ×2'));
check('digest: empty history -> no lines', exploredDigestLines(new Map()).length === 0);

// ---------------------------------------------------------------------------
// Session harness
// ---------------------------------------------------------------------------
function makeDeps({ replies, pastEvents = [] }) {
  const state = {
    screens: [],
    events: [],
    guiOpens: [],
    searches: [],
    shellRuns: [],
    clicks: [],
    meta: { huntId: 'h_dedupe_test', target: 'https://open.ys7.com', mode: 'human', humanMode: true },
  };
  const queue = [...replies];
  state.deps = {
    chat: async (messages) => {
      state.screens.push(messages[0].text);
      return queue.length ? queue.shift() : null;
    },
    exec: async (h, t, command) => {
      state.shellRuns.push(command);
      return { stdout: `ran: ${command}`, stderr: '', code: 0 };
    },
    execRaw: async () => ({ stdout: '/root\n---\nnotes.txt', stderr: '', code: 0 }),
    search: async (q) => {
      state.searches.push(q);
      return [{ title: 'result', url: 'https://example.org/r', snippet: 'snip' }];
    },
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
        return { ok: true, observation: `Opened ${url} in your desktop browser.` };
      },
      snapshot: async () => ({ ok: true, observation: 'snapshot' }),
      click: async (h, text) => {
        state.clicks.push(text);
        return { ok: true, observation: `clicked ${text}` };
      },
      type: async () => ({ ok: true, observation: 'typed' }),
      screenshot: async () => ({ ok: true, observation: 'shot' }),
    },
    sleep: async () => {},
    now: () => Date.now(),
    buildBriefing: async () => 'BRIEFING-MARKER: memory briefing text.',
  };
  return state;
}

const TARGET = 'https://open.ys7.com';

// ---------------------------------------------------------------------------
// (a) 3rd identical browser_open is blocked and NOT executed
// (history seeded with 2 prior runs, one spelled with a trailing slash)
// ---------------------------------------------------------------------------
{
  const s = makeDeps({
    pastEvents: [
      { type: 'tool_call', tool: 'browser_open', detail: 'https://open.ys7.com/login' },
      { type: 'tool_call', tool: 'browser_open', detail: 'https://open.ys7.com/login/' },
    ],
    replies: [
      'Back to the login page.\n{"action":"browser_open","url":"https://open.ys7.com/login"}',
      'Noted.\n{"action":"note","text":"blocked, moving on"}',
    ],
  });
  await humanIteration('h_dedupe_test', TARGET, { turns: 2, deps: s.deps });
  check('(a) blocked browser_open never reaches the GUI', s.guiOpens.length === 0);
  check('(a) no tool_call recorded for the blocked action',
    !s.events.some((e) => e.type === 'tool_call' && e.tool === 'browser_open'));
  check('(a) dedup_block event recorded with tool + count', (() => {
    const b = s.events.find((e) => e.type === 'dedup_block');
    return b && b.tool === 'browser_open' && b.count === 2 && b.via === 'human-mode';
  })());
  check('(a) block observation on the next screen (count + must differ)',
    s.screens[1].includes('BLOCKED — ALREADY DONE') && s.screens[1].includes('2 times') && s.screens[1].includes('DIFFERENT action'));
}

// ---------------------------------------------------------------------------
// (a2) In-session repeats count too: open ×2 live, the 3rd is blocked
// ---------------------------------------------------------------------------
{
  const s = makeDeps({
    replies: [
      'Open root.\n{"action":"browser_open","url":"https://open.ys7.com"}',
      'Open root again.\n{"action":"browser_open","url":"https://open.ys7.com/"}',
      'And again.\n{"action":"browser_open","url":"https://open.ys7.com"}',
      'Noted.\n{"action":"note","text":"ok"}',
    ],
  });
  await humanIteration('h_dedupe_test', TARGET, { turns: 4, deps: s.deps });
  check('(a2) first + second in-session opens execute', s.guiOpens.length === 2);
  check('(a2) third in-session open blocked with dedup_block event',
    s.events.filter((e) => e.type === 'dedup_block').length === 1);
  check('(a2) block observation carries the last result',
    s.screens[3].includes('Last result:') && s.screens[3].includes('Opened https://open.ys7.com'));
}

// ---------------------------------------------------------------------------
// (b) 3rd identical search is blocked (case/whitespace respelling)
// ---------------------------------------------------------------------------
{
  const s = makeDeps({
    pastEvents: [
      { type: 'tool_call', tool: 'search', detail: 'site:open.ys7.com security headers' },
      { type: 'tool_call', tool: 'search', detail: 'Site:Open.Ys7.com  security   headers' },
    ],
    replies: [
      'Same research again.\n{"action":"search","query":"site:open.ys7.com security headers"}',
      'Noted.\n{"action":"note","text":"ok"}',
    ],
  });
  await humanIteration('h_dedupe_test', TARGET, { turns: 2, deps: s.deps });
  check('(b) blocked search never runs', s.searches.length === 0);
  check('(b) dedup_block event recorded for search',
    s.events.some((e) => e.type === 'dedup_block' && e.tool === 'search' && e.count === 2));
  check('(b) block observation on the next screen', s.screens[1].includes('BLOCKED — ALREADY DONE'));
}

// ---------------------------------------------------------------------------
// (c) Genuinely new actions execute normally (even with a rich history)
// ---------------------------------------------------------------------------
{
  const s = makeDeps({
    pastEvents: seedEvents,
    replies: [
      'A page I have not visited.\n{"action":"browser_open","url":"https://open.ys7.com/api/docs"}',
      'A fresh search.\n{"action":"search","query":"ezviz open platform api authentication"}',
      'A fresh probe.\n{"action":"shell","command":"curl -s https://open.ys7.com/robots.txt"}',
      'Second run of the fresh probe still passes (gate is at 2 prior runs).\n{"action":"shell","command":"curl -s https://open.ys7.com/robots.txt"}',
    ],
  });
  await humanIteration('h_dedupe_test', TARGET, { turns: 4, deps: s.deps });
  check('(c) new browser_open executes', s.guiOpens.length === 1 && s.guiOpens[0] === 'https://open.ys7.com/api/docs');
  check('(c) new search executes', s.searches.length === 1);
  check('(c) new shell executes, and its 2nd-ever run also passes', s.shellRuns.length === 2);
  check('(c) nothing blocked in this session', !s.events.some((e) => e.type === 'dedup_block'));
}

// ---------------------------------------------------------------------------
// (d) The digest appears in the perception, EARLY (before the briefing)
// ---------------------------------------------------------------------------
{
  const s = makeDeps({
    pastEvents: seedEvents,
    replies: ['Looking around.\n{"action":"note","text":"ok"}'],
  });
  await humanIteration('h_dedupe_test', TARGET, { turns: 1, deps: s.deps });
  const screen = s.screens[0];
  check('(d) digest header on the screen', screen.includes('ALREADY EXPLORED — DO NOT REPEAT'));
  check('(d) digest lists the most-repeated page with its count', screen.includes('https://open.ys7.com/ — ×5'));
  check('(d) digest sits before the memory briefing',
    screen.indexOf('ALREADY EXPLORED — DO NOT REPEAT') > -1 &&
    screen.indexOf('ALREADY EXPLORED — DO NOT REPEAT') < screen.indexOf('BRIEFING-MARKER'));
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
