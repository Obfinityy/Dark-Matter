// Test for the human-mode MEMORY BRIEFING (Lane G, 21 Oct 2026).
//
// The Ezviz audit found the human-mode hunter repeating work it had
// already done (60% exact repeats) and researching techniques it never
// probed (SSTI searched ~16x, probed 0x) — while the system's memory
// (dead-end registry, hunt record, global lessons) mostly never
// reached its perception prompt. This test proves the briefing now
// ALWAYS carries, in priority order inside the existing 7,500-char cap:
//   (a) DEAD ENDS ON THIS TARGET — validator ruled_out lessons + this
//       hunt's rejected claims;
//   (b) RESEARCHED BUT NEVER PROBED — topics searched/noted with no
//       probe action in the hunt's own record, as next-action lines;
//   (c) LESSONS FROM ALL PAST HUNTS — distilled global-memory lessons;
// followed by the full-history ledger filling the remaining budget.
// Empty sources omit their section silently (no placeholder text).
//
// Run: node backend/scripts/test-human-memory-briefing.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-g-'));
process.env.DATA_DIR = tmp;

const {
  humanIteration,
  buildMemoryBriefing,
  deadEndLines,
  researchedNotProbedLines,
  globalLessonLines,
  assembleMemoryBriefing,
} = await import('../src/humanLoop.js');
const { recordRuledOut } = await import('../src/episodeStore.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// ---------------------------------------------------------------------------
// (a) deadEndLines units
// ---------------------------------------------------------------------------
const ruled = [
  { id: 9, key: 'ftp exposure', lesson: 'Tried FTP exposure → got banner echo → do: pivot', technique: 'ftp' },
  { id: 7, key: 'ftp exposure', lesson: 'Tried FTP exposure → older lesson', technique: 'ftp' },
  { id: 8, key: 'ftp exposure', lesson: 'Tried FTP exposure → got banner echo → do: pivot', technique: 'ftp' },
];
const claimEvents = [
  { type: 'finding', title: 'FTP exposure', verified: false, verification: 'NOT verified: duplicate of registry entry' },
  { type: 'finding', title: 'Reflected XSS in search', verified: false, verification: 'NOT verified: payload not reflected' },
  { type: 'finding', title: 'Real verified bug', verified: true, verification: 'VERIFIED' },
  { type: 'thinking', text: 'not a finding' },
];
const de = deadEndLines({ ruledOut: ruled, events: claimEvents });
check('dead-ends: registry lesson present once, latest text, with count', de.length === 2 && de[0].includes('Tried FTP exposure') && de[0].includes('×3'));
check('dead-ends: registry-covered rejected claim not duplicated', de.filter((l) => l.includes('FTP')).length === 1);
check('dead-ends: uncovered rejected claim listed with its verdict', de.some((l) => l.includes('Reflected XSS in search') && l.includes('payload not reflected')));
check('dead-ends: verified finding never listed as a dead end', !de.some((l) => l.includes('Real verified bug')));
check('dead-ends: empty sources -> no lines', deadEndLines({ ruledOut: [], events: [] }).length === 0 && deadEndLines({}).length === 0);

// ---------------------------------------------------------------------------
// (b) researchedNotProbedLines units
// ---------------------------------------------------------------------------
const evSearch = (tool, detail) => ({ type: 'tool_call', tool, detail });
const unprobed = researchedNotProbedLines({
  events: [
    evSearch('search', 'SSTI template injection jinja2 bypass'),
    evSearch('search', 'SSTI template injection jinja2 bypass'),
    evSearch('search', 'how to test CORS misconfiguration'),
    evSearch('search', 'reflected XSS payload list'),
    evSearch('shell', 'curl -s https://t.test/search?q=<script>alert(1)</script>'),
    evSearch('shell', 'curl -s https://t.test/'),
  ],
  reasoningRows: [
    { action: 'search: SSTI template injection jinja2 bypass', why: '', result: '', learned: '' },
    { action: 'search: SSTI template injection jinja2 bypass', why: '', result: '', learned: '' },
    { action: 'note to self', why: 'Look into JWT attacks on the API tokens next', result: 'recorded', learned: '' },
  ],
});
check('unprobed: SSTI listed (searched, never probed)', unprobed.some((l) => l.includes('SSTI')));
check('unprobed: SSTI count counts each search once (event+row mirror deduplicated)', unprobed.some((l) => l.includes('SSTI') && l.includes('×2')));
check('unprobed: CORS listed from search alone', unprobed.some((l) => l.includes('CORS')));
check('unprobed: JWT listed from a note', unprobed.some((l) => l.includes('JWT')));
check('unprobed: XSS NOT listed — a real <script> probe ran', !unprobed.some((l) => l.includes('XSS')));
check('unprobed: each line is an explicit next-action candidate', unprobed.every((l) => l.includes('candidate next action')));
check('unprobed: empty record -> no lines', researchedNotProbedLines({ events: [], reasoningRows: [] }).length === 0);
const sqliProbed = researchedNotProbedLines({
  events: [evSearch('search', 'sql injection login bypass'), evSearch('shell', "curl -s \"https://t.test/login?id=1' OR 1=1--\"")],
  reasoningRows: [],
});
check('unprobed: SQLi NOT listed once a real SQLi probe ran', !sqliProbed.some((l) => l.includes('SQL injection')));

// ---------------------------------------------------------------------------
// (c) globalLessonLines + assembly units
// ---------------------------------------------------------------------------
const gmLines = globalLessonLines([
  { type: 'technique', technique: 'ssti', appType: 'web', context: 'Jinja2 error oracle', successes: 2, attempts: 5 },
  { type: 'fingerprint', technique: 'recon', appType: 'web', note: 'Login walls hide the API surface', successes: 0, attempts: 0 },
]);
check('global lessons: one compact line per memory', gmLines.length === 2 && gmLines.every((l) => l.startsWith('- ')));
check('global lessons: empty store -> no lines', globalLessonLines([]).length === 0);

const assembled = assembleMemoryBriefing({
  deadEnds: ['- dead one'],
  unprobed: ['- unprobed one'],
  globalLessons: ['- global one'],
  ledgerText: 'LEDGER-TEXT',
});
check('assembly: priority order dead-ends < unprobed < global < ledger',
  assembled.indexOf('DEAD ENDS ON THIS TARGET') < assembled.indexOf('RESEARCHED BUT NEVER PROBED') &&
  assembled.indexOf('RESEARCHED BUT NEVER PROBED') < assembled.indexOf('LESSONS FROM ALL PAST HUNTS') &&
  assembled.indexOf('LESSONS FROM ALL PAST HUNTS') < assembled.indexOf('LEDGER-TEXT'));
check('assembly: all sources empty -> empty briefing, no placeholders',
  assembleMemoryBriefing({}) === '' && !assembleMemoryBriefing({ ledgerText: 'L' }).includes('DEAD ENDS'));
check('assembly: cap respected with an oversized ledger',
  assembleMemoryBriefing({ deadEnds: ['- d'], ledgerText: 'x'.repeat(50000) }).length <= 7500);

// ---------------------------------------------------------------------------
// End-to-end: buildMemoryBriefing over real hunt files (the production path)
// ---------------------------------------------------------------------------
const HUNT = 'h_briefing_test';
const huntDir = path.join(tmp, 'hunts', HUNT);
fs.mkdirSync(huntDir, { recursive: true });
const events = [];
for (let i = 0; i < 16; i++) events.push({ type: 'tool_call', tool: 'search', detail: 'SSTI template injection jinja2 bypass', via: 'human-mode' });
for (let i = 0; i < 12; i++) events.push({ type: 'tool_call', tool: 'shell', detail: 'curl -s https://t.test/api/token', via: 'human-mode' });
events.push({ type: 'finding', title: 'FTP directory listing exposure', severity: 'high', verified: false, verification: 'NOT verified: canary control negative', via: 'human-mode' });
fs.writeFileSync(path.join(huntDir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
const rows = [];
for (let i = 0; i < 16; i++) rows.push({ at: 't', hypothesis: '', action: 'search: SSTI template injection jinja2 bypass', why: '', result: 'No results.', learned: '' });
for (let i = 0; i < 12; i++) rows.push({ at: 't', hypothesis: '', action: 'shell: curl -s https://t.test/api/token', why: '', result: '{"retcode":1000}', learned: '' });
fs.writeFileSync(path.join(huntDir, 'reasoning.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(tmp, 'global-memory.jsonl'), [
  { type: 'technique', technique: 'ssti', appType: 'web', techStack: ['python'], context: 'Jinja2 error oracle on form fields', note: '', successes: 2, attempts: 5, ts: 't' },
].map((g) => JSON.stringify(g)).join('\n') + '\n');
for (let i = 0; i < 3; i++) recordRuledOut({ huntId: HUNT, title: 'FTP directory listing exposure', family: 'payload_validation', detail: 'banner echo', technique: 'ftp' });

const meta = { huntId: HUNT, target: 'https://t.test', appFingerprint: { appType: 'web', techStack: ['python'] } };
const briefing = buildMemoryBriefing(HUNT, 'https://t.test', meta);
check('e2e briefing: (a) dead ends present', briefing.includes('DEAD ENDS ON THIS TARGET') && briefing.includes('FTP directory listing exposure'));
check('e2e briefing: (b) researched-not-probed present with the real count', briefing.includes('RESEARCHED BUT NEVER PROBED') && briefing.includes('SSTI') && briefing.includes('×16'));
check('e2e briefing: (c) global lessons present', briefing.includes('LESSONS FROM ALL PAST HUNTS') && briefing.includes('Jinja2'));
check('e2e briefing: full-history ledger still follows', briefing.includes('FULL HISTORY'));
check('e2e briefing: priority order holds end-to-end',
  briefing.indexOf('DEAD ENDS ON THIS TARGET') < briefing.indexOf('RESEARCHED BUT NEVER PROBED') &&
  briefing.indexOf('RESEARCHED BUT NEVER PROBED') < briefing.indexOf('LESSONS FROM ALL PAST HUNTS') &&
  briefing.indexOf('LESSONS FROM ALL PAST HUNTS') < briefing.indexOf('FULL HISTORY'));
check('e2e briefing: within the existing 7,500-char cap', briefing.length <= 7500);

// Empty hunt: the hunt-local sections are omitted silently. (Section (c)
// is cross-hunt by design — a fresh hunt still inherits global lessons;
// its omit-when-empty case is proven at the builder level above, where
// an empty global store yields no lines.)
const emptyBriefing = buildMemoryBriefing('h_does_not_exist', 'https://t.test', {});
check('e2e briefing: empty hunt omits both hunt-local sections (no placeholders)',
  !emptyBriefing.includes('DEAD ENDS ON THIS TARGET') &&
  !emptyBriefing.includes('RESEARCHED BUT NEVER PROBED'));

// Cap stress: a long hunt must not push the priority head out.
const BIG = 'h_briefing_big';
const bigDir = path.join(tmp, 'hunts', BIG);
fs.mkdirSync(bigDir, { recursive: true });
const bigRows = [];
for (let i = 0; i < 400; i++) bigRows.push({ at: 't', hypothesis: '', action: `shell: curl -s https://t.test/p${i}`, why: '', result: 'some output line', learned: '' });
bigRows.push({ at: 't', hypothesis: '', action: 'search: SSRF internal metadata endpoint', why: '', result: 'results', learned: '' });
fs.writeFileSync(path.join(bigDir, 'reasoning.jsonl'), bigRows.map((r) => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(bigDir, 'events.jsonl'), JSON.stringify({ type: 'tool_call', tool: 'search', detail: 'SSRF internal metadata endpoint', via: 'human-mode' }) + '\n');
recordRuledOut({ huntId: BIG, title: 'SSRF to metadata endpoint', family: 'reachability', detail: 'no answer', technique: 'ssrf' });
const bigBriefing = buildMemoryBriefing(BIG, 'https://t.test', meta);
check('cap stress: briefing still within cap at 400 actions', bigBriefing.length <= 7500);
check('cap stress: dead ends survive the cap (priority head first)', bigBriefing.includes('DEAD ENDS ON THIS TARGET'));
check('cap stress: researched-not-probed survives the cap', bigBriefing.includes('RESEARCHED BUT NEVER PROBED'));

// ---------------------------------------------------------------------------
// Screen level: a real humanIteration turn carries all three sections
// ---------------------------------------------------------------------------
fs.writeFileSync(path.join(huntDir, 'meta.json'), JSON.stringify({ huntId: HUNT, target: 'https://t.test', mode: 'human', humanMode: true, parsedScope: null, appFingerprint: { appType: 'web', techStack: ['python'] } }));
const screens = [];
await humanIteration(HUNT, 'https://t.test', {
  turns: 1,
  deps: {
    chat: async (msgs) => { screens.push(msgs[0].text); return 'Looking.\n{"action":"note","text":"ok"}'; },
    execRaw: async () => ({ stdout: '/root', stderr: '', code: 0 }),
    exec: async () => ({ stdout: '', stderr: '', code: 0 }),
    assess: null,
    sleep: async () => {},
    // buildBriefing deliberately NOT injected — the production default runs.
  },
});
const screen = screens[0] || '';
check('screen: carries all three memory sections',
  screen.includes('DEAD ENDS ON THIS TARGET') && screen.includes('RESEARCHED BUT NEVER PROBED') && screen.includes('LESSONS FROM ALL PAST HUNTS'));
check('screen: sections sit inside the WHAT YOU KNOW briefing, in priority order',
  screen.indexOf('WHAT YOU KNOW') < screen.indexOf('DEAD ENDS ON THIS TARGET') &&
  screen.indexOf('DEAD ENDS ON THIS TARGET') < screen.indexOf('RESEARCHED BUT NEVER PROBED') &&
  screen.indexOf('RESEARCHED BUT NEVER PROBED') < screen.indexOf('LESSONS FROM ALL PAST HUNTS') &&
  screen.indexOf('LESSONS FROM ALL PAST HUNTS') < screen.indexOf('=== FINDINGS SO FAR'));
const knowStart = screen.indexOf('=== WHAT YOU KNOW');
const knowEnd = screen.indexOf('=== FINDINGS SO FAR');
check('screen: briefing block within cap', knowStart >= 0 && knowEnd > knowStart && (knowEnd - knowStart) <= 7500 + 120);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
