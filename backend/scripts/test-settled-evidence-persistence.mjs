// Test for Lane AH (24 Oct 2026) — settled-evidence PERSISTENCE:
// Lane AG's counter-evidence (the most recent request SENT to a
// settled action's path, with its recorded outcome) rides the
// block OBSERVATION, which the brain reads for exactly one
// session — sessions roll every 6 turns and on generation
// failures, and Ezviz's first evidence-receiving session died
// before its next choice, so the re-choice was made from a fresh
// screen carrying only Lane AD's counts. Lane AH puts the same
// specifics on AD's persistent settled lines (the one surface
// that survives every roll), rendered by the SAME formatter
// (lastRequestSnippet) so the two channels can never phrase the
// fact differently. Settled lines for actions with no request on
// record stay byte-for-byte Lane AD's; lines clip at the 420-char
// evidence cap only when evidence actually rides them.
//
// Run: node backend/scripts/test-settled-evidence-persistence.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-ah-'));
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

// Record shapes mirror production exactly (see test-repeat-discipline.mjs).
const ev = (tool, detail, cachedAt) => ({ type: 'tool_call', tool, detail, via: 'human-mode', cachedAt });
const blockEv = (tool, detail, count, cachedAt) => ({ type: 'dedup_block', tool, detail, count, via: 'human-mode', cachedAt });

const REGISTER = 'https://open.ys7.com/rest/user/register';
const T0 = Date.parse('2026-10-23T09:00:00.000Z');
const ts = (i) => new Date(T0 + i * 60000).toISOString();

// The Ezviz register pattern with a full request trail: opened
// ×2, 7 requests SENT (the last a SQLi-payload curl whose outcome
// the live history remembers), then blocked ×64.
function ezvizEventsWithTrail() {
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
  return { events, lastProbe };
}

// --- (a) the settled line carries the last request + outcome ----
{
  const { events, lastProbe } = ezvizEventsWithTrail();
  const history = buildActionHistory(events);
  const lastEntry = history.get(actionSignature('shell', lastProbe));
  check('(a) fixture: the last probe has a history entry', Boolean(lastEntry));
  if (lastEntry) {
    lastEntry.lastResult = 'HTTP 200, 43 bytes: {"code":4001,"msg":"login required"} — the identical catch-all body every path returns; no account was created';
  }
  const lines = settledActionLines({ events, history });
  const reg = lines.find((l) => l.includes(REGISTER)) || '';
  check('(a) settled line renders for the register open', reg.length > 0);
  check('(a) carries run/blocked counts (run ×2, blocked ×64)', reg.includes('run ×2') && reg.includes('blocked ×64'));
  check('(a) carries the requests-sent count (×7)', reg.includes('requests sent ×7'));
  check('(a) names the most recent request (the SQLi curl)', reg.includes('most recent:') && reg.includes("OR '1'='1"));
  check('(a) carries the last request\'s recorded outcome', reg.includes('→') && reg.includes('login required'));
  check('(a) still carries the redirect (opening probes nothing, SEND a request)',
    reg.includes('probes nothing') && reg.includes('SEND a request'));
  check('(a) the evidence-carrying line stays within the 420-char cap', reg.length <= 420);

  // (f) one formatter, two channels: the snippet the settled line
  // carries is character-identical to Lane AG's block evidence.
  const agText = settledBlockEvidence({ events, history, tool: 'browser_open', detail: REGISTER, extraBlocks: 1 });
  const grab = (t) => (t.match(/most recent: (.*?)\. Opening/) || [])[1] || '';
  check('(f) settled-line snippet is identical to the block-observation snippet',
    grab(reg) !== '' && grab(reg) === grab(agText));
}

// --- (b) cross-session: history rebuilt from events alone still
// names the request — and invents no outcome --------------------
{
  const { events } = ezvizEventsWithTrail();
  const lines = settledActionLines({ events }); // no live history: the next session's view
  const reg = lines.find((l) => l.includes(REGISTER)) || '';
  check('(b) events-only record still names the most recent request', reg.includes('most recent:') && reg.includes("OR '1'='1"));
  check('(b) no outcome is fabricated when the record holds none', !reg.includes('→'));
  check('(b) counts survive the roll too (blocked ×64, requests sent ×7)',
    reg.includes('blocked ×64') && reg.includes('requests sent ×7'));
}

// --- (c) fallback: a settled open with ZERO requests on record
// renders byte-for-byte the Lane AD line --------------------------
{
  const ORPHAN = 'https://open.ys7.com/rest/user/activate';
  const events = [ev('browser_open', ORPHAN, ts(0)), ev('browser_open', ORPHAN, ts(1))];
  for (let i = 0; i < 4; i++) events.push(blockEv('browser_open', ORPHAN, 3 + i, ts(2 + i)));
  const lines = settledActionLines({ events, history: buildActionHistory(events) });
  check('(c) header + exactly one entry render', lines.length === 2);
  check('(c) the entry is byte-for-byte the Lane AD line (no evidence, AD clip)',
    lines[1] === '- browser_open https://open.ys7.com/rest/user/activate — run ×2, blocked ×4. Opening probes nothing (same captured page). To test it, SEND a request: curl with a payload, or type + submit.');
}

// --- (d) fallback: a settled NON-open action renders byte-for-byte
// the Lane AD line (no page-open evidence ever attaches) ---------
{
  const Q = 'ezviz ys7 open api authentication bypass';
  const events = [ev('search', Q, ts(0)), ev('search', Q, ts(1))];
  for (let i = 0; i < 3; i++) events.push(blockEv('search', Q, 3 + i, ts(2 + i)));
  const lines = settledActionLines({ events, history: buildActionHistory(events) });
  check('(d) the search entry is byte-for-byte the Lane AD line',
    lines[1] === '- search ezviz ys7 open api authentication bypass — run ×2, blocked ×3. An identical repeat returns the identical result — vary the input or move on.');
  check('(d) no request evidence leaks into a non-open entry', !lines[1].includes('most recent'));
}

// --- (e) caps hold with MANY settled actions, all carrying long
// evidence: top-5 limit, per-line evidence cap -------------------
{
  const events = [];
  const history = new Map();
  for (let s = 0; s < 7; s++) {
    const url = `https://open.ys7.com/lab${s}`;
    events.push(ev('browser_open', url, ts(s)), ev('browser_open', url, ts(50 + s)));
    const cmd = `curl -s -X POST https://open.ys7.com/lab${s} -d "${'payload='.repeat(30)}probe${s}"`;
    events.push(ev('shell', cmd, ts(60 + s)));
    for (let b = 0; b < 3 + s; b++) events.push(blockEv('browser_open', url, 3 + b, ts(100 + s * 20 + b)));
  }
  const built = buildActionHistory(events);
  for (const [sig, entry] of built) {
    if (entry.tool === 'shell') entry.lastResult = `HTTP 500 ${'x'.repeat(200)} lab outcome ${sig}`;
    history.set(sig, entry);
  }
  const lines = settledActionLines({ events, history });
  check('(e) at most 5 settled entries render (top by block count)', lines.length === 1 + 5);
  check('(e) every evidence-carrying entry is ≤ 420 chars', lines.slice(1).every((l) => l.length <= 420));
  check('(e) the evidence rides even under the cap (most recent named)', lines.slice(1).every((l) => l.includes('most recent:')));
  check('(e) a long request detail is clipped, not carried whole (tail absent)',
    !lines.join('\n').includes('payload='.repeat(30)));
  check('(e) the most-blocked signature still leads', (lines[1] || '').includes('/lab6') && (lines[1] || '').includes('blocked ×9'));
}

// --- (g) nothing settled → nothing rendered (non-settled screens
// untouched), unchanged from Lane AD -----------------------------
{
  const events = [ev('browser_open', REGISTER, ts(0)), ev('browser_open', REGISTER, ts(1)),
    blockEv('browser_open', REGISTER, 3, ts(2)), blockEv('browser_open', REGISTER, 4, ts(3))];
  check('(g) blocked ×2 renders nothing (threshold is 3 blocks)',
    settledActionLines({ events, history: buildActionHistory(events) }).length === 0);
  check('(g) an empty record renders nothing', settledActionLines({ events: [] }).length === 0);
}

// Screen-level harness (mirrors test-repeat-discipline.mjs).
function makeDeps(state, queue) {
  return {
    chat: async (messages) => {
      state.screens.push(messages[0].text);
      return queue.length ? queue.shift() : null;
    },
    exec: async () => ({ stdout: '', stderr: '', code: 0 }),
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

// --- (h) screen level: the evidence rides the never-trimmed
// settled region of a FRESH session's screen -----------------------
{
  const HUNT = 'h_settled_evidence_test';
  const TARGET = 'https://open.ys7.com';
  fs.mkdirSync(path.join(tmp, 'hunts', HUNT), { recursive: true });
  const seed = [
    ev('browser_open', REGISTER, ts(0)),
    ev('browser_open', REGISTER, ts(1)),
    ev('shell', 'curl -s -X POST https://open.ys7.com/rest/user/register -d "username=probe1&password=Probe123!"', ts(2)),
  ];
  for (let i = 0; i < 62; i++) seed.push(blockEv('browser_open', REGISTER, 3 + i, ts(10 + i)));
  const state = { screens: [], events: seed, meta: baseMeta(HUNT, TARGET) };
  const deps = makeDeps(state, ['Noted — moving on.\n{"action":"note","text":"settled noted"}']);
  const res = await humanIteration(HUNT, TARGET, { turns: 1, deps });
  check('(h) screen-level session ran', res.turnsRun === 1);
  const s1 = state.screens[0] || '';
  const settledAt = s1.indexOf('SETTLED');
  const regLine = (s1.split('\n').find((l) => l.includes(REGISTER) && l.includes('most recent')) || '');
  check('(h) the screen\'s settled entry names the most recent request', regLine.includes('username=probe1'));
  check('(h) the evidence sits in the never-trimmed region (before the capped briefing)',
    settledAt >= 0 && settledAt < s1.indexOf('WHAT YOU KNOW'));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
