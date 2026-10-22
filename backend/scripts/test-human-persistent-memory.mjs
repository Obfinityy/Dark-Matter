// Test for PERSISTENT MEMORY — the state-of-mind block (Lane O,
// 22 Oct 2026 — owner order: memory must be preserved in the backend
// and the hunter must always KNOW what it has done, what it knows,
// and what it has not done, like a real human).
//
// What the audit found before this lane:
//   - the brain's memory was fragmented over five stores and read
//     through one 7,500-char slice: dead ends capped at 8 lines,
//     researched-not-probed at 6, the coverage accounting on screen
//     at 8 lines, actions summarised by outcome counts only — on a
//     long hunt the essentials silently fell out of view;
//   - meta.humanLoop.leftOff exists only after a clean session end,
//     so a hunt with a long record but no persisted hand-off started
//     cold;
//   - DOSSIER.md is per-hunt, so a NEW hunt on a target with prior
//     hunts opened knowing nothing of them.
//
// This suite proves the huntMemory read path (loadHuntMemory +
// buildStateOfMind):
//   (i)   on a synthetic LONG hunt the essentials are all present —
//         beyond the old cap: the state-of-mind text outgrows 7,500
//         chars and the last open gap / last dead end still render,
//         while buildMemoryBriefing keeps its 7,500-char cap;
//   (ii)  restart / pause / resume state equality — the state of
//         mind rebuilt from disk alone is identical;
//   (iii) the WHAT I HAVE NOT DONE table is complete (every open
//         gap, every debt class, every unprobed endpoint);
//   (iv)  torn-line tolerance in every store;
//   (v)   a missing persisted leftOff is derived from the record;
//   (vi)  same-target inheritance: a new hunt opens with the prior
//         hunt's proven facts, ruled-out paths and open gaps — and
//         a retracted prior stamp is NOT inherited;
//   (vii) screen level: a real humanIteration screen carries the
//         block before the capped briefing.
//
// Run: node backend/scripts/test-human-persistent-memory.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-o-'));
process.env.DATA_DIR = tmp;

const { humanIteration, buildMemoryBriefing, researchedTopicStats, discoveredEndpoints, leftOffLines } =
  await import('../src/humanLoop.js');
const { loadHuntMemory, buildStateOfMind, deriveLeftOffFromRecord } = await import('../src/huntMemory.js');
const { recordRuledOut } = await import('../src/episodeStore.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const TARGET = 'https://t.test';
const huntPath = (id, file) => path.join(tmp, 'hunts', id, file);
function writeHuntFile(id, file, text) {
  fs.mkdirSync(path.join(tmp, 'hunts', id), { recursive: true });
  fs.writeFileSync(huntPath(id, file), text);
}
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

// ---------------------------------------------------------------------------
// The long-hunt fixture (modelled on the live Ezviz shape, scaled up
// until the old cap would bite): 300 reasoning rows, 24 open gaps,
// 20 ruled-out lessons, duplicated + retracted findings.
// ---------------------------------------------------------------------------
const GAP_CLASSES = ['sqli', 'xss', 'ssti', 'ssrf', 'xxe', 'lfi', 'cmdi', 'jwt', 'cors', 'headers', 'openredirect', 'graphql'];
function makeLongHunt(id) {
  const events = [];
  // research: SQLi x5, JWT x3, file upload x3 (searches)
  for (let i = 0; i < 5; i++) events.push({ type: 'tool_call', tool: 'search', detail: 'sql injection login bypass techniques', via: 'human-mode' });
  for (let i = 0; i < 3; i++) events.push({ type: 'tool_call', tool: 'search', detail: 'jwt attacks alg none token forgery', via: 'human-mode' });
  for (let i = 0; i < 3; i++) events.push({ type: 'tool_call', tool: 'search', detail: 'file upload vulnerability exploitation', via: 'human-mode' });
  // surface traffic
  events.push({ type: 'tool_call', tool: 'shell', detail: `curl -s -d 'username=test&password=<redacted>' https://t.test/login`, via: 'human-mode' });
  events.push({ type: 'tool_call', tool: 'shell', detail: `curl -s "https://t.test/login?username=' OR 1=1--"`, via: 'human-mode' }); // one real SQLi probe
  events.push({ type: 'tool_call', tool: 'browser_open', detail: 'https://t.test/upload', via: 'human-mode' });
  events.push({ type: 'tool_call', tool: 'browser_open', detail: 'https://t.test/upload', via: 'human-mode' });
  events.push({ type: 'tool_call', tool: 'shell', detail: 'curl -s https://t.test/api/items', via: 'human-mode' });
  events.push({ type: 'tool_call', tool: 'shell', detail: 'curl -s https://t.test/api/items', via: 'human-mode' });
  // findings: one verified x3 (same instance re-proven), one verified,
  // one unverified claim, one retracted false stamp
  for (let i = 0; i < 3; i++) events.push({ type: 'finding', title: 'Genuine SQL injection in login', severity: 'high', verified: true, verification: 'VERIFIED', via: 'human-mode' });
  events.push({ type: 'finding', title: 'Stored XSS in profile', severity: 'medium', verified: true, verification: 'VERIFIED', via: 'human-mode' });
  events.push({ type: 'finding', title: 'Weak session cookie flags', severity: 'low', verified: false, verification: 'NOT verified: flags present on other cookies', via: 'human-mode' });
  events.push({ type: 'finding', title: 'RETRACTED-FALSE-MARKER directory listing', severity: 'high', verified: true, verification: 'VERIFIED', via: 'human-mode' });
  events.push({ type: 'retraction', findingTitle: 'RETRACTED-FALSE-MARKER directory listing', via: 'human-mode' });
  writeHuntFile(id, 'events.jsonl', jsonl(events));

  const rows = [];
  for (let i = 0; i < 295; i++) {
    rows.push({ at: 't', hypothesis: '', action: `shell: curl -s https://t.test/p${i % 20}`, why: '', result: 'HTTP 200, 43 bytes', learned: '' });
  }
  for (let i = 0; i < 5; i++) {
    rows.push({ at: 't', hypothesis: '', action: 'search: sql injection login bypass techniques', why: '', result: 'results', learned: '' });
  }
  writeHuntFile(id, 'reasoning.jsonl', jsonl(rows));

  const covRows = [];
  for (let i = 1; i <= 24; i++) {
    covRows.push({
      surface: `https://t.test/p${i}`,
      class: GAP_CLASSES[(i - 1) % GAP_CLASSES.length],
      outcome: 'open_gap',
      evidence: `Researched with no probe; opened by session-end reconciliation (fixture gap ${i}).`,
      updatedAt: '2026-10-22T10:00:00.000Z',
    });
  }
  covRows.push({ surface: 'https://t.test/login', class: 'headers', outcome: 'probed_clean', evidence: 'curl -I showed CSP present', updatedAt: '2026-10-22T10:00:00.000Z' });
  covRows.push({ surface: 'https://t.test/search', class: 'xss', outcome: 'confirmed', evidence: 'marker reflected unescaped', updatedAt: '2026-10-22T10:00:00.000Z' });
  writeHuntFile(id, 'coverage.json', JSON.stringify({
    version: 1,
    rows: covRows,
    researchDebt: {
      cmdi: { researched: 19, probed: false, sessionsResearched: 7, lastResearchedAt: '2026-10-22T10:00:00.000Z' },
      idor: { researched: 3, probed: false, sessionsResearched: 2, lastResearchedAt: '2026-10-22T10:00:00.000Z' },
      sqli: { researched: 11, probed: true, sessionsResearched: 6, lastResearchedAt: '2026-10-22T10:00:00.000Z' },
    },
    updatedAt: '2026-10-22T10:00:00.000Z',
  }, null, 2));

  for (let i = 1; i <= 20; i++) {
    recordRuledOut({ huntId: id, title: `Dead path number ${i} on the API`, family: 'payload_validation', detail: 'no signal', technique: 'fixture' });
  }

  writeHuntFile(id, 'meta.json', JSON.stringify({
    huntId: id,
    target: TARGET,
    state: 'running',
    iteration: 321,
    createdAt: '2026-10-22T12:00:00.000Z',
    appFingerprint: { appType: 'web', techStack: ['php'] },
    chainContext: { jwt: 'SECRET-VALUE-NEVER-PRINTED' },
    humanLoop: {
      sessions: 9,
      leftOff: {
        at: '2026-10-22T11:00:00.000Z',
        lastThinking: 'LEFTOFF-THINKING-MARKER: I was mid-way through the login token checks',
        lastActions: [{ tool: 'shell', detail: 'curl -s https://t.test/login', result: '200 OK' }],
        lastNote: 'LEFTOFF-NOTE-MARKER',
        openThreads: ['- SSTI: researched ×2, never probed'],
      },
    },
  }));
}

function stateOfMindFor(id, target = TARGET) {
  const memory = loadHuntMemory(id, { target });
  const lines = buildStateOfMind(memory, {
    topicStats: researchedTopicStats({ events: memory.events, reasoningRows: memory.reasoningRows }),
    endpoints: discoveredEndpoints(memory.events, target),
  });
  return { memory, lines, text: lines.join('\n') };
}

// ---------------------------------------------------------------------------
// (i) Long hunt: completeness beyond the old cap
// ---------------------------------------------------------------------------
makeLongHunt('h_long');
const long1 = stateOfMindFor('h_long');
check('long: state of mind renders', long1.lines.length > 0 && long1.text.includes('STATE OF MIND'));
check('long: (a) left off present with the brain\'s own train of thought',
  long1.text.includes('WHERE I LEFT OFF') && long1.text.includes('LEFTOFF-THINKING-MARKER'));
check('long: persisted leftOff used (not derived)', long1.memory.leftOffDerived === false);
check('long: (b) done rollup counts the record', long1.text.includes('Actions on record:') && long1.text.includes('reasoning entries: 300'));
check('long: (b) tested rows render as done', long1.text.includes('Tested: https://t.test/login × security headers → probed_clean'));
check('long: (b) probed class from payload actions renders', long1.text.includes('SQL injection: probed (payload actions in your record'));
check('long: (c) verified findings deduped with counts',
  long1.text.includes('[VERIFIED] Genuine SQL injection in login (high) ×3') && long1.text.includes('[VERIFIED] Stored XSS in profile'));
check('long: (c) unverified claim labelled as not verified', long1.text.includes('[claimed, NOT verified] Weak session cookie flags'));
check('long: (c) retracted stamp is NOT knowledge', !long1.text.includes('RETRACTED-FALSE-MARKER'));
check('long: (c) retraction is accounted for', long1.text.includes('1 earlier claim(s) were retracted'));
check('long: (c) captured artefacts by key presence only — value never printed',
  long1.text.includes('Captured artefacts on hand: jwt') && !long1.text.includes('SECRET-VALUE-NEVER-PRINTED'));
check('long: essentials outgrow the old 7,500-char cap', long1.text.length > 7500);
check('long: the capped briefing keeps its cap on the same hunt', buildMemoryBriefing('h_long', TARGET, null).length <= 7500);

// (iii) not-done completeness — every single open gap, debt class,
// researched-not-probed class and unprobed endpoint is listed.
{
  const notDoneStart = long1.text.indexOf('WHAT I HAVE NOT DONE YET');
  const notDoneEnd = long1.text.indexOf('PATHS ALREADY RULED OUT');
  const notDone = long1.text.slice(notDoneStart, notDoneEnd > notDoneStart ? notDoneEnd : undefined);
  let allGaps = notDoneStart >= 0;
  for (let i = 1; i <= 24; i++) {
    if (!notDone.includes(`OPEN GAP: https://t.test/p${i} ×`)) allGaps = false;
  }
  check('not-done: all 24 open gaps listed (the table is never sliced)', allGaps);
  check('not-done: the LAST gap survives (no tail truncation)', notDone.includes('OPEN GAP: https://t.test/p24 ×'));
  check('not-done: research-debt class with no coverage row listed', notDone.includes('RESEARCHED, NEVER PROBED: idor') && notDone.includes('researched ×3'));
  check('not-done: researched-not-probed topic with no row and no debt listed', notDone.includes('file upload: researched ×3, never probed'));
  check('not-done: discovered-but-unprobed endpoints listed',
    notDone.includes('https://t.test/upload') && notDone.includes('never probed') && notDone.includes('https://t.test/api/items'));
  check('not-done: a probed debt class is not listed as outstanding', !notDone.includes('researched ×11'));
}

// (e) ruled out — complete, beyond the briefing's 8-line cap.
{
  let allDead = true;
  for (let i = 1; i <= 20; i++) {
    if (!long1.text.includes(`Dead path number ${i} on the API`)) allDead = false;
  }
  check('ruled-out: all 20 dead paths listed (beyond the old 8-line cap)', allDead);
  check('ruled-out: rejected claim listed with its verdict',
    long1.text.includes('Claim rejected: "Weak session cookie flags"'));
}

// ---------------------------------------------------------------------------
// (ii) Restart / pause / resume: the picture is rebuilt from disk
// alone and identical — no in-memory state is involved anywhere.
// ---------------------------------------------------------------------------
{
  const again = stateOfMindFor('h_long');
  check('restart: state of mind identical after a fresh load', again.text === long1.text);
  check('restart: briefing identical after a fresh load',
    buildMemoryBriefing('h_long', TARGET, null) === buildMemoryBriefing('h_long', TARGET, null));

  const metaFile = huntPath('h_long', 'meta.json');
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  fs.writeFileSync(metaFile, JSON.stringify({ ...meta, state: 'paused', paused: true }));
  const paused = stateOfMindFor('h_long');
  fs.writeFileSync(metaFile, JSON.stringify({ ...meta, state: 'running' }));
  const resumed = stateOfMindFor('h_long');
  check('pause/resume: state of mind unchanged across the hold', paused.text === long1.text && resumed.text === long1.text);
}

// ---------------------------------------------------------------------------
// (v) Missing persisted leftOff -> derived from the record
// ---------------------------------------------------------------------------
{
  const id = 'h_noleftoff';
  const target2 = 'https://other.test';
  writeHuntFile(id, 'events.jsonl', jsonl([
    { type: 'tool_call', tool: 'shell', detail: 'curl -s https://other.test/api', via: 'human-mode' },
    { type: 'thinking', text: 'DERIVE-THINKING-MARKER: mid-way through the API token checks', via: 'human-mode' },
  ]));
  const rows = [];
  for (let i = 0; i < 8; i++) rows.push({ at: 't', hypothesis: '', action: `shell: curl -s https://other.test/r${i}`, why: '', result: 'ok', learned: '' });
  rows.push({ at: 't', hypothesis: '', action: 'note to self', why: '', result: '', learned: 'DERIVE-NOTE-MARKER: token scope is the open question' });
  writeHuntFile(id, 'reasoning.jsonl', jsonl(rows));
  writeHuntFile(id, 'coverage.json', JSON.stringify({
    version: 1,
    rows: [{ surface: 'https://other.test/api', class: 'sqli', outcome: 'open_gap', evidence: 'fixture', updatedAt: 't' }],
    researchDebt: { ssti: { researched: 5, probed: false, sessionsResearched: 2, lastResearchedAt: 't' } },
    updatedAt: 't',
  }));
  writeHuntFile(id, 'meta.json', JSON.stringify({ huntId: id, target: target2, state: 'paused', iteration: 40, createdAt: '2026-10-21T00:00:00.000Z' }));

  const memory = loadHuntMemory(id, { target: target2 });
  check('derived: leftOff rebuilt when the persisted hand-off is missing', memory.leftOffDerived === true && Boolean(memory.leftOff));
  check('derived: train of thought recovered from the record', String(memory.leftOff.lastThinking).includes('DERIVE-THINKING-MARKER'));
  check('derived: last actions recovered (tool + detail)', memory.leftOff.lastActions.length === 5 &&
    memory.leftOff.lastActions.some((a) => a.detail.includes('/r7')));
  check('derived: open threads recovered from the coverage ledger',
    memory.leftOff.openThreads.some((t) => t.includes('SSTI')) && memory.leftOff.openThreads.some((t) => t.includes('Open gap')));
  const rendered = leftOffLines(memory.leftOff).join('\n');
  check('derived: the standard renderer shows the hand-off', rendered.includes('WHERE YOU LEFT OFF') && rendered.includes('DERIVE-THINKING-MARKER'));
  const direct = deriveLeftOffFromRecord({ reasoningRows: [], events: [], coverage: null });
  check('derived: empty record -> no hand-off invented', direct === null);
}

// ---------------------------------------------------------------------------
// (iv) Torn-line tolerance in every store
// ---------------------------------------------------------------------------
{
  const id = 'h_torn';
  const target3 = 'https://torn.test';
  const good1 = JSON.stringify({ at: 't', hypothesis: '', action: 'shell: curl -s https://torn.test/a', why: '', result: 'ok', learned: '' });
  const good2 = JSON.stringify({ at: 't', hypothesis: '', action: 'search: ssti template injection', why: '', result: 'results', learned: '' });
  const good3 = JSON.stringify({ at: 't', hypothesis: '', action: 'note to self', why: '', result: '', learned: 'note' });
  const torn = '{"at":"t","action":"shell: curl -s https://torn.test/cut-off-mid-obje';
  writeHuntFile(id, 'reasoning.jsonl', [good1, torn, good2 + good3, good1].join('\n') + '\n'); // torn + concatenated pair
  writeHuntFile(id, 'events.jsonl', [
    JSON.stringify({ type: 'tool_call', tool: 'shell', detail: 'curl -s https://torn.test/a', via: 'human-mode' }),
    '{"type":"tool_call","tool":"shell","detail":"cut off mid-line',
    JSON.stringify({ type: 'tool_call', tool: 'search', detail: 'ssti template injection', via: 'human-mode' }),
  ].join('\n') + '\n');
  writeHuntFile(id, 'coverage.json', '{ this is not json');

  let memory = null;
  let threw = false;
  try {
    memory = loadHuntMemory(id, { target: target3 });
  } catch { threw = true; }
  check('torn: loadHuntMemory never throws', !threw && Boolean(memory));
  check('torn: valid reasoning rows survive (torn skipped, concatenated recovered)', memory.reasoningRows.length === 4);
  check('torn: valid events survive', memory.events.length === 2);
  check('torn: corrupt coverage degrades to an empty ledger', memory.coverage.rows.length === 0);
  const { text } = stateOfMindFor(id, target3);
  check('torn: state of mind still renders from the surviving record', text.includes('Actions on record: 2') && text.includes('reasoning entries: 4'));
  check('torn: briefing still builds', typeof buildMemoryBriefing(id, target3, {}) === 'string');
  check('empty hunt: no record and no prior hunts -> no state-of-mind block, no placeholders',
    buildStateOfMind(loadHuntMemory('h_does_not_exist', { target: 'https://nowhere.test' })).length === 0);
  check('empty hunt on a known target still inherits (that is the point of inheritance)',
    buildStateOfMind(loadHuntMemory('h_does_not_exist', { target: TARGET })).join('\n').includes('FROM YOUR EARLIER HUNTS ON THIS TARGET'));
}

// ---------------------------------------------------------------------------
// (vi) Same-target inheritance
// ---------------------------------------------------------------------------
{
  const prior = 'h_prior';
  writeHuntFile(prior, 'meta.json', JSON.stringify({ huntId: prior, target: TARGET, state: 'paused', iteration: 88, createdAt: '2026-10-20T00:00:00.000Z' }));
  writeHuntFile(prior, 'DOSSIER.md', [
    '# Target dossier — https://t.test',
    '- Hunt: h_prior · State: paused · Iteration: 88',
    '',
    '## Goal',
    'Hunt https://t.test for exploitable vulnerabilities; only validator-confirmed findings count.',
    '',
    '## Confirmed facts (validator-stamped only)',
    '- [verified · high] PRIOR-VERIFIED-MARKER SQL injection in login — https://t.test/login (episode #12)',
    '- [verified · medium] PRIOR-RETRACTED-MARKER FTP directory listing (episode #13)',
    '',
    '## Tried and ruled out',
    '- PRIOR-DEAD-MARKER exposure — rejected: catch-all 200 answered everything (episode #20)',
    '',
    '## Open threads',
    '- Unverified lead: PRIOR-THREAD-MARKER token scope question (episode #42)',
    '',
    '## Next step',
    '- PRIOR-NEXT-MARKER: probe the token endpoint',
    '',
  ].join('\n'));
  writeHuntFile(prior, 'events.jsonl', jsonl([
    { type: 'finding', title: 'PRIOR-RETRACTED-MARKER FTP directory listing', severity: 'medium', verified: true },
    { type: 'retraction', findingTitle: 'PRIOR-RETRACTED-MARKER FTP directory listing' },
  ]));
  writeHuntFile(prior, 'coverage.json', JSON.stringify({
    version: 1,
    rows: [{ surface: 'https://t.test/admin', class: 'xss', outcome: 'open_gap', evidence: 'fixture', updatedAt: 't' }],
    researchDebt: {},
    updatedAt: 't',
  }));

  const fresh = 'h_new';
  writeHuntFile(fresh, 'meta.json', JSON.stringify({ huntId: fresh, target: TARGET, state: 'running', iteration: 1, createdAt: '2026-10-23T00:00:00.000Z' }));
  writeHuntFile(fresh, 'reasoning.jsonl', jsonl([
    { at: 't', hypothesis: '', action: 'shell: curl -s https://t.test/', why: 'first look', result: '200', learned: '' },
  ]));
  writeHuntFile(fresh, 'events.jsonl', jsonl([
    { type: 'tool_call', tool: 'shell', detail: 'curl -s https://t.test/', via: 'human-mode' },
  ]));

  const memory = loadHuntMemory(fresh, { target: TARGET });
  check('inheritance: prior hunt of the same target found', memory.priorHunts.some((p) => p.huntId === prior));
  const packet = memory.priorHunts.find((p) => p.huntId === prior) || { confirmedFacts: [] };
  check('inheritance: proven facts carried over', packet.confirmedFacts.some((t) => t.includes('PRIOR-VERIFIED-MARKER')));
  check('inheritance: retracted prior stamp NOT inherited as fact', !packet.confirmedFacts.some((t) => t.includes('PRIOR-RETRACTED-MARKER')));
  const { text } = stateOfMindFor(fresh);
  check('inheritance: state of mind carries the earlier hunt',
    text.includes('FROM YOUR EARLIER HUNTS ON THIS TARGET') && text.includes('PRIOR-VERIFIED-MARKER') &&
    text.includes('PRIOR-DEAD-MARKER') && text.includes('PRIOR-THREAD-MARKER') && text.includes('PRIOR-NEXT-MARKER'));
  check('inheritance: prior open gap carried over', text.includes('Left open there: https://t.test/admin × XSS'));
  check('inheritance: retracted marker appears nowhere on the new hunt\'s screen memory', !text.includes('PRIOR-RETRACTED-MARKER'));
}

// ---------------------------------------------------------------------------
// (vii) Screen level: a real humanIteration screen carries the block
// before the capped briefing, complete.
// ---------------------------------------------------------------------------
{
  makeLongHunt('h_screen');
  const screens = [];
  await humanIteration('h_screen', TARGET, {
    turns: 1,
    deps: {
      chat: async (msgs) => { screens.push(msgs[0].text); return 'Looking.\n{"action":"note","text":"ok"}'; },
      execRaw: async () => ({ stdout: '/root', stderr: '', code: 0 }),
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      assess: null,
      sleep: async () => {},
      // buildBriefing / buildStateOfMind deliberately NOT injected — production paths run.
    },
  });
  const screen = screens[0] || '';
  check('screen: state-of-mind block present', screen.includes('STATE OF MIND') && screen.includes('WHAT I HAVE NOT DONE YET'));
  check('screen: block sits before the capped briefing (outside its cap)',
    screen.indexOf('STATE OF MIND') >= 0 && screen.indexOf('STATE OF MIND') < screen.indexOf('=== WHAT YOU KNOW'));
  check('screen: the not-done table is complete on the live screen', screen.includes('OPEN GAP: https://t.test/p24 ×'));
  const knowStart = screen.indexOf('=== WHAT YOU KNOW');
  const knowEnd = screen.indexOf('=== FINDINGS SO FAR');
  check('screen: the briefing block itself stays within its cap',
    knowStart >= 0 && knowEnd > knowStart && (knowEnd - knowStart) <= 7500 + 120);
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
