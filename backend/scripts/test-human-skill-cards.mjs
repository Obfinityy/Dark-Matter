// Test for human-mode SKILL CARDS + the load_skill action
// (Lane M, 22 Oct 2026 — Research Lane K proposal P2, re-implemented
// by reference from the Strix skill shape; all card content is ours).
//
// Live failure this attacks (Lane J diagnosis, Ezviz hunt): the
// brain researches a vuln class with open-ended web searches — 53%
// of tool calls, and after a search the next action was another
// search 62% of the time. A skill card makes research arrive as a
// compact procedure with an end state: the hunter pulls ONE card
// when it opens a class, and the card's numbered steps + proof bar
// are the turn's observation.
//
// This suite proves:
//   (a) every PROBE_TOPICS class has exactly one card and vice
//       versa (no orphans either way);
//   (b) every card respects the hard size cap and carries all five
//       sections, with a 5–8 step numbered methodology and a
//       "Probed and proven means:" validation bar;
//   (c) loadSkill returns the right card (frontmatter stripped),
//       resolves the names a brain plausibly uses, and degrades to
//       the index on unknown/empty names without throwing;
//   (d) Lane J consistency: each card's canonical first probe is
//       the same one the UNPROBED LEADS show — the SQLi card's first
//       methodology step is the ' OR 1=1 vs ' OR 1=2 differential;
//   (e) a real humanIteration screen carries the compact index
//       (names + one-liners, no card bodies), and a load_skill
//       action returns the card as its observation;
//   (f) load_skill is NOT dedupe-gated: three pulls of the same
//       card in one session all execute.
//
// Run: node backend/scripts/test-human-skill-cards.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-lane-m-'));
process.env.DATA_DIR = tmp;

const { listSkills, loadSkill, resolveSkillName, loadSkillCards, SKILL_CARD_MAX_CHARS } = await import('../src/skillCards.js');
const { humanIteration, PROBE_TOPICS, skillCardLines } = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const CARDS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'skill-cards');
const SECTIONS = ['## Attack surface', '## Detection channels', '## Testing methodology', '## Validation', '## False positives'];

function section(text, from, to) {
  const a = text.indexOf(from);
  const b = to ? text.indexOf(to, a + from.length) : text.length;
  return a < 0 ? '' : text.slice(a, b < 0 ? text.length : b);
}

// ---------------------------------------------------------------------------
// (a) + (b) inventory, size discipline, card shape
// ---------------------------------------------------------------------------
const topicIds = PROBE_TOPICS.map((t) => t.id).sort();
const skillNames = listSkills().map((s) => s.name).sort();
check('bijection: every PROBE_TOPICS class has a card and vice versa',
  JSON.stringify(topicIds) === JSON.stringify(skillNames));
const filesOnDisk = fs.readdirSync(CARDS_DIR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();
check('bijection: card files on disk match the index exactly',
  JSON.stringify(filesOnDisk) === JSON.stringify(skillNames));

const cards = loadSkillCards();
for (const [name, card] of cards) {
  const raw = fs.readFileSync(path.join(CARDS_DIR, `${name}.md`), 'utf8');
  check(`card ${name}: within the hard size cap (${card.chars} <= ${SKILL_CARD_MAX_CHARS})`,
    card.chars <= SKILL_CARD_MAX_CHARS && raw.length === card.chars);
  check(`card ${name}: carries all five sections`,
    SECTIONS.every((s) => card.body.includes(s)));
  const method = section(card.body, '## Testing methodology', '## Validation');
  const steps = method.split('\n').filter((l) => /^\d+\.\s/.test(l.trim()));
  check(`card ${name}: methodology has 5-8 numbered steps (has ${steps.length})`,
    steps.length >= 5 && steps.length <= 8);
  check(`card ${name}: validation states the proof bar`,
    section(card.body, '## Validation', '## False positives').includes('Probed and proven means:'));
  check(`card ${name}: index one-liner present and compact`,
    card.description.length > 0 && card.description.length <= 95);
}

// ---------------------------------------------------------------------------
// (c) loader behaviour
// ---------------------------------------------------------------------------
const sqli = loadSkill('sqli');
check('loadSkill: returns the card body with the sections',
  sqli.includes('## Testing methodology') && sqli.includes('## Validation'));
check('loadSkill: frontmatter is stripped (no name:/description: lines)',
  !/^name:/m.test(sqli) && !/^description:/m.test(sqli) && !sqli.startsWith('---'));
check('loadSkill: resolves the descriptive name a brain would use',
  resolveSkillName('sql_injection') === 'sqli' && loadSkill('sql_injection') === sqli);
check('loadSkill: resolves other plausible spellings',
  resolveSkillName('command injection') === 'cmdi' && resolveSkillName('File Upload') === 'fileupload' &&
  resolveSkillName('security-headers') === 'headers' && resolveSkillName('path traversal') === 'lfi');
const unknown = loadSkill('definitely-not-a-class');
check('loadSkill: unknown name degrades to the index, never throws',
  unknown.includes('Available skill cards') && unknown.includes('- sqli:') && unknown.includes('- graphql:'));
check('loadSkill: empty name degrades to the index',
  loadSkill('').includes('Available skill cards') && loadSkill(undefined).includes('Available skill cards'));

// ---------------------------------------------------------------------------
// (d) Lane J consistency — the canonical first probes agree
// ---------------------------------------------------------------------------
const sqliMethod = section(sqli, '## Testing methodology', '## Validation');
const firstStep = sqliMethod.split('\n').map((l) => l.trim()).find((l) => /^1\.\s/.test(l)) || '';
check("consistency: SQLi first methodology step is the Lane J differential pair (' OR 1=1 vs ' OR 1=2)",
  firstStep.includes("' OR 1=1") && firstStep.includes("' OR 1=2"));
const CANONICAL = {
  ssti: ['{{7*7}}', '49'],
  xss: ['<script>alert(1)</script>'],
  ssrf: ['http://169.254.169.254/latest/meta-data/'],
  xxe: ['<!ENTITY xxe SYSTEM "file:///etc/passwd">'],
  lfi: ['../../etc/passwd'],
  cmdi: ['test; id', 'uid='],
  jwt: ['alg', 'none'],
  cors: ['https://evil.example', 'Access-Control-Allow-Credentials'],
  headers: ['curl -s -I'],
  openredirect: ['https://example.com'],
  graphql: ['{__schema{types{name}}}'],
  fileupload: ['curl -F'],
};
for (const [name, needles] of Object.entries(CANONICAL)) {
  const body = loadSkill(name);
  check(`consistency: ${name} card carries its canonical first probe`,
    needles.every((n) => body.includes(n)));
}
// Where the topic's lead test value is a literal payload (not a prose
// description), the card must use that exact value verbatim.
for (const id of ['ssti', 'xss', 'sqli', 'ssrf', 'lfi', 'openredirect', 'graphql']) {
  const topic = PROBE_TOPICS.find((t) => t.id === id);
  check(`consistency: ${id} card uses the lead's exact test value`,
    loadSkill(id).includes(topic.testValue));
}

// ---------------------------------------------------------------------------
// (e) + (f) screen level: index advertised, load_skill executes, no gate
// ---------------------------------------------------------------------------
const TARGET = 'https://t.test';
function scriptedDeps(replies) {
  const screens = [];
  const queue = [...replies];
  return {
    screens,
    deps: {
      chat: async (msgs) => { screens.push(msgs[0].text); return queue.length ? queue.shift() : 'Thinking.\n{"action":"note","text":"ok"}'; },
      execRaw: async () => ({ stdout: '/root', stderr: '', code: 0 }),
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      search: async () => [],
      writeFile: async () => ({ name: 'x', chars: 0 }),
      spill: () => '',
      record: () => {},
      readMeta: () => ({}),
      writeMeta: () => {},
      readEvents: () => [],
      recordNote: () => {},
      assess: null,
      sleep: async () => {},
      buildBriefing: async () => 'BRIEFING-BODY',
    },
  };
}

const advert = skillCardLines();
check('advert: the index block is compact (single short block)',
  advert.length > 0 && advert.join('\n').length <= 1400);
check('advert: names every card and inlines NO card body',
  skillNames.every((n) => advert.some((l) => l.startsWith(`- ${n}:`))) && !advert.join('\n').includes('## Testing methodology'));

const s1 = scriptedDeps([
  'Opening SQL injection — pulling the card first.\n{"action":"load_skill","skill":"sqli"}',
  'Noted.\n{"action":"note","text":"ok"}',
]);
const r1 = await humanIteration('h_lane_m_screen', TARGET, { turns: 2, deps: s1.deps });
const screen1 = s1.screens[0] || '';
const screen2 = s1.screens[1] || '';
check('screen: turn 1 carries the SKILL CARDS index before the memory briefing',
  screen1.includes('SKILL CARDS — PULL A PROCEDURE INSTEAD OF SEARCHING') &&
  screen1.indexOf('SKILL CARDS') < screen1.indexOf('=== WHAT YOU KNOW'));
check('screen: the load_skill action is in the log with its detail',
  r1.log.length >= 1 && r1.log[0].action === 'load_skill' && r1.log[0].detail === 'sqli');
check('screen: the card returns as the load_skill observation on the next screen',
  screen2.includes('=== RESULT OF YOUR LAST ACTION ===') && screen2.includes('## Testing methodology') &&
  screen2.includes("' OR 1=1") && screen2.includes('Probed and proven means:'));
check('screen: exactly one card body in play — no second card leaked onto the screen',
  !screen2.includes('## Attack surface\nAny parser that accepts XML'));

const s2 = scriptedDeps([
  '{"action":"load_skill","skill":"sqli"}',
  '{"action":"load_skill","skill":"sqli"}',
  '{"action":"load_skill","skill":"sql_injection"}',
]);
const r2 = await humanIteration('h_lane_m_gate', TARGET, { turns: 3, deps: s2.deps });
check('gate: repeated pulls of the same card are NOT dedupe-gated',
  r2.log.length === 3 && r2.log.every((l) => l.action === 'load_skill') &&
  !s2.screens.some((s) => s.includes('BLOCKED — ALREADY DONE')));
check('gate: every pull returned the card (alias included)',
  r2.log.every((l) => String(l.observation || '').length > 0) &&
  (s2.screens[2] || '').includes('## Testing methodology'));

const s3 = scriptedDeps([
  '{"action":"load_skill","skill":"wat"}',
  '{"action":"note","text":"ok"}',
]);
await humanIteration('h_lane_m_unknown', TARGET, { turns: 2, deps: s3.deps });
check('screen: an unknown skill answers with the index, not an error',
  (s3.screens[1] || '').includes('Available skill cards'));

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
