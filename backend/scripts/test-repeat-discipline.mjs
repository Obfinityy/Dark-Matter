// Test for Lane AD (24 Oct 2026) — brain-side repeat discipline:
// actions the already-done gate has blocked MANY times must be
// carried in the screen's never-trimmed region as SETTLED facts
// that correct the brain's stale premise, and a load_skill name
// that already failed ("No skill card named X") must be answered
// from the record on a verbatim repeat instead of re-running the
// lookup.
//
// Live evidence (measured from EC2 reasoning logs, 24 Oct 2026):
//   Ezviz h_07c2709955d3: 173 of 791 human turns (21.9%) were
//     dedup_block repeats. browser_open of
//     https://open.ys7.com/rest/user/register alone was re-chosen
//     ×62 AFTER the gate had already blocked it — every turn the
//     brain re-derived "the registration endpoint has been visited
//     multiple times without being probed" from a State of Mind
//     that never said the question was settled, nor that re-opening
//     cannot probe anything.
//   Juice h_bench_d69e5746: load_skill "ftp" returned "No skill
//     card named \"ftp\"" (with the full available list) and was
//     re-chosen verbatim the very next turn — load_skill is
//     deliberately ungated, so nothing answered from the record.
//
// Lane AH (24 Oct 2026) extends section (1): a settled line for an
// action WITH requests on record now also names the most recent
// request (the persistent form of Lane AG's evidence), so the
// ≤220-char expectation became the ≤420 evidence cap for that line
// only — the login entry (no requests on record) is asserted
// byte-for-byte identical to the Lane AD rendering. The full AH
// suite is test-settled-evidence-persistence.mjs.
//
// Run: node backend/scripts/test-repeat-discipline.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-ad-'));
process.env.DATA_DIR = tmp;

const {
  humanIteration,
  buildActionHistory,
  settledActionLines,
  failedSkillAsks,
} = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// Record shapes mirror production exactly: tool_call events carry
// {tool, detail, via, cachedAt}; dedup_block events are recorded by
// the gate as {type:'dedup_block', tool, detail, count, via};
// reasoning rows are recordReasoning's {at, hypothesis, action,
// why, result, learned, followUp}.
const ev = (tool, detail, cachedAt) => ({ type: 'tool_call', tool, detail, via: 'human-mode', cachedAt });
const blockEv = (tool, detail, count, cachedAt) => ({ type: 'dedup_block', tool, detail, count, via: 'human-mode', cachedAt });
const row = (action, result, at) => ({ at, hypothesis: '', action, why: 'fixture', result, learned: '', followUp: '' });

const REGISTER = 'https://open.ys7.com/rest/user/register';
const LOGIN = 'https://open.ys7.com/rest/user/login';
const T0 = Date.parse('2026-10-23T09:00:00.000Z');
const ts = (i) => new Date(T0 + i * 60000).toISOString();

// The Ezviz record, distilled: register opened ×2 (executed), then
// re-chosen and blocked ×62; login opened ×2, blocked ×38; one real
// shell request WAS sent to the register path along the way.
function ezvizEvents() {
  const events = [
    ev('browser_open', REGISTER, ts(0)),
    ev('browser_open', REGISTER, ts(1)),
    ev('browser_open', LOGIN, ts(2)),
    ev('browser_open', LOGIN, ts(3)),
    ev('shell', `curl -s -X POST https://open.ys7.com/rest/user/register -d "username=probe1&password=Probe123!"`, ts(4)),
  ];
  for (let i = 0; i < 62; i++) events.push(blockEv('browser_open', REGISTER, 3 + i, ts(10 + i)));
  for (let i = 0; i < 38; i++) events.push(blockEv('browser_open', LOGIN, 3 + i, ts(100 + i)));
  return events;
}

// --- (1) settled lines: the Ezviz register pattern --------------------------
{
  const events = ezvizEvents();
  const history = buildActionHistory(events);
  const lines = settledActionLines({ events, history });
  const text = lines.join('\n');
  check('settled block renders with its header', lines.length >= 3 && text.includes('SETTLED'));
  const reg = lines.find((l) => l.includes(REGISTER)) || '';
  check('register entry states the executed count (run ×2)', reg.includes('run ×2'));
  check('register entry states the block count (blocked ×62)', reg.includes('blocked ×62'));
  check('register entry states the requests already sent to it (premise correction)', reg.includes('requests sent ×1'));
  check('register entry carries the redirect: opening probes nothing, SEND a request', reg.includes('probes nothing') && reg.includes('SEND a request'));
  const login = lines.find((l) => l.includes(LOGIN)) || '';
  check('login entry present with its block count (blocked ×38)', login.includes('blocked ×38'));
  check('entries are ordered most-blocked first', text.indexOf(REGISTER) >= 0 && text.indexOf(REGISTER) < text.indexOf(LOGIN));
  check('register entry names the most recent request sent (Lane AH evidence)', reg.includes('most recent:') && reg.includes('username=probe1'));
  check('every settled entry is ≤ 420 chars (Lane AH evidence cap)', lines.slice(1).every((l) => l.length <= 420));
  check('login entry (no requests on record) is byte-for-byte the Lane AD line',
    login === '- browser_open https://open.ys7.com/rest/user/login — run ×2, blocked ×38. Opening probes nothing (same captured page). To test it, SEND a request: curl with a payload, or type + submit.');
}

// --- (2) thresholds and bounds ----------------------------------------------
{
  const few = [ev('browser_open', REGISTER, ts(0)), ev('browser_open', REGISTER, ts(1)),
    blockEv('browser_open', REGISTER, 3, ts(2)), blockEv('browser_open', REGISTER, 4, ts(3))];
  check('blocked ×2 is NOT settled yet (threshold is 3 blocks)',
    settledActionLines({ events: few, history: buildActionHistory(few) }).length === 0);
  check('no blocks at all renders nothing',
    settledActionLines({ events: [ev('browser_open', REGISTER, ts(0))], history: buildActionHistory([ev('browser_open', REGISTER, ts(0))]) }).length === 0);

  const many = [];
  for (let s = 0; s < 7; s++) {
    const url = `https://open.ys7.com/p${s}`;
    many.push(ev('browser_open', url, ts(s)), ev('browser_open', url, ts(50 + s)));
    for (let b = 0; b < 3 + s; b++) many.push(blockEv('browser_open', url, 3 + b, ts(100 + s * 20 + b)));
  }
  const lines = settledActionLines({ events: many, history: buildActionHistory(many) });
  check('at most 5 settled entries render (top by block count)', lines.length === 1 + 5);
  check('the most-blocked signature leads', (lines[1] || '').includes('/p6') && (lines[1] || '').includes('blocked ×9'));

  const skillBlocks = [blockEv('load_skill', 'ftp', 1, ts(0)), blockEv('load_skill', 'ftp', 2, ts(1)),
    blockEv('load_skill', 'ftp', 3, ts(2)), blockEv('load_skill', 'ftp', 4, ts(3)), blockEv('load_skill', 'ftp', 5, ts(4))];
  check('load_skill blocks never render as settled actions (separate mechanism, no executed history)',
    settledActionLines({ events: skillBlocks, history: buildActionHistory(skillBlocks) }).length === 0);
}

// --- (3) failedSkillAsks: the Juice ftp pattern ------------------------------
{
  const failedFtp = row('load_skill: ftp',
    'No skill card named "ftp". Available skill cards — pull one with {"action":"load_skill","skill":"<name>"}:\n- sqli: SQL injection — boolean differential first…',
    '2026-10-23T20:08:33.384Z');
  const blockedFtp = row('dedup_block: load_skill ftp',
    'repeat blocked — no skill card named "ftp" (asked ×2)',
    '2026-10-23T20:29:18.194Z');
  const okSqli = row('load_skill: sqli', '# SQL injection\nAttack surface…', '2026-10-23T20:10:00.000Z');
  const asks = failedSkillAsks([failedFtp, blockedFtp, okSqli]);
  check('failed ftp ask is remembered', asks.has('ftp'));
  check('ask count includes the original failure AND the blocked repeat', (asks.get('ftp') || {}).asks === 2);
  check('display name is the name the hunter asked for', (asks.get('ftp') || {}).name === 'ftp');
  check('a successful card pull is never remembered as failed', !asks.has('sqli'));
  const caseFold = failedSkillAsks([row('load_skill: FTP!', 'No skill card named "FTP!". Available skill cards…', '2026-10-23T21:00:00.000Z')]);
  check('name folding matches skillCards resolution (case/punct-insensitive)', caseFold.has('ftp'));
  check('no failed asks renders an empty map', failedSkillAsks([okSqli]).size === 0 && failedSkillAsks([]).size === 0);
}

// Screen-level harness (mirrors test-failed-action-followthrough.mjs).
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

// --- (4) screen level: settled entry rides the never-trimmed region ---------
{
  const HUNT = 'h_settled_test';
  const TARGET = 'https://open.ys7.com';
  fs.mkdirSync(path.join(tmp, 'hunts', HUNT), { recursive: true });
  const state = { screens: [], events: ezvizEvents(), meta: baseMeta(HUNT, TARGET) };
  const deps = makeDeps(state, ['Noted — moving on.\n{"action":"note","text":"settled noted"}']);
  const res = await humanIteration(HUNT, TARGET, { turns: 1, deps });
  check('screen-level session ran', res.turnsRun === 1);
  const s1 = state.screens[0] || '';
  check('screen carries the settled entry for register with its block count',
    s1.includes('SETTLED') && s1.includes(REGISTER) && s1.includes('blocked ×62'));
  check('settled block sits in the never-trimmed region (before the capped briefing)',
    s1.indexOf('SETTLED') >= 0 && s1.indexOf('SETTLED') < s1.indexOf('WHAT YOU KNOW'));
}

// --- (5) load_skill repeat: answered from the record, lookup NOT re-run -----
{
  const HUNT = 'h_skill_repeat_test';
  const TARGET = 'http://172.17.0.1:3000';
  fs.mkdirSync(path.join(tmp, 'hunts', HUNT), { recursive: true });
  const state = { screens: [], events: [], meta: baseMeta(HUNT, TARGET) };
  const queue = [
    'I need the FTP procedure card.\n{"action":"load_skill","skill":"ftp"}',
    'Pulling the FTP card again.\n{"action":"load_skill","skill":"ftp"}',
    'Noted.\n{"action":"note","text":"no ftp card exists"}',
  ];
  const deps = makeDeps(state, queue);
  const res = await humanIteration(HUNT, TARGET, { turns: 3, deps });
  check('skill-repeat session ran 3 turns', res.turnsRun === 3);
  check('first ask really executed (its failure is the next screen\'s last result)',
    (state.screens[1] || '').includes('No skill card named "ftp"'));
  const skillCalls = state.events.filter((e) => e.type === 'tool_call' && e.tool === 'load_skill');
  check('the lookup ran exactly ONCE (the verbatim repeat never executed)', skillCalls.length === 1);
  const block = state.events.find((e) => e.type === 'dedup_block' && e.tool === 'load_skill');
  check('the repeat was recorded as a dedup_block for load_skill', Boolean(block));
  const s3 = state.screens[2] || '';
  check('the repeat\'s answer comes from the record (BLOCKED — NO SUCH SKILL CARD)',
    s3.includes('BLOCKED — NO SUCH SKILL CARD') && s3.includes('"ftp"'));
  check('the blocked answer still names a real card to pull instead', s3.includes('sqli'));
  const reasoningFile = path.join(tmp, 'hunts', HUNT, 'reasoning.jsonl');
  const rowsOnDisk = fs.existsSync(reasoningFile)
    ? fs.readFileSync(reasoningFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  check('the blocked repeat is in the reasoning record with the dedup_block label',
    rowsOnDisk.some((r) => String(r.action || '').startsWith('dedup_block: load_skill')));
  check('failedSkillAsks over the hunt\'s own record now counts both asks',
    (failedSkillAsks(rowsOnDisk).get('ftp') || {}).asks === 2);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
