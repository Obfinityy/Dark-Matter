// Test for the STATE-OF-MIND TOTAL BUDGET (Lane Q, 23 Oct 2026).
//
// buildStateOfMind carried generous per-section caps but no bound on
// the SUM: measured live, the biggest hunt's block reached ~27k
// chars (137 know-items, 110 ruled-out), crowding the model's
// context window and slowing every turn's prefill. Lane Q adds a
// hard total budget (SOM_TOTAL_BUDGET = 12,000 chars): past it, only
// the lowest-priority tails give way — ruled-out lines first, then
// finding lines — each replaced by ONE explicit note carrying the
// dropped count, so the agent still knows how much more is on
// record. Left-off / done / not-done are never trimmed by the staged
// trims; an under-budget render is byte-identical to before.
//
// This suite drives buildStateOfMind directly over synthetic
// in-memory snapshots (the function is pure over the snapshot):
//   (a) a large memory (150 findings, 150 ruled-out, 800 actions)
//       renders within budget, with left-off + the complete
//       not-done table intact and trim notes whose counts reconcile
//       exactly with what was dropped;
//   (b) a small memory renders with no trim notes, no clip marker,
//       and every finding / ruled-out line present verbatim — the
//       pre-fix behaviour for anything under budget.
//
// Run: node backend/scripts/test-som-budget.mjs

const { buildStateOfMind, SOM_TOTAL_BUDGET } = await import('../src/huntMemory.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

check('budget constant is 12,000 chars', SOM_TOTAL_BUDGET === 12000);

const pad = (s, n) => (s.length >= n ? s : s + ' x'.repeat(Math.ceil((n - s.length) / 2)).slice(0, n - s.length));

// ---------------------------------------------------------------------------
// (a) Large synthetic memory — well over the budget before trimming.
// ---------------------------------------------------------------------------
function largeMemory() {
  const findings = [];
  for (let i = 1; i <= 75; i++) {
    findings.push({ title: pad(`Verified finding number ${i} — reflected input in the account settings form`, 84), severity: 'high', verified: true });
  }
  for (let i = 1; i <= 75; i++) {
    findings.push({ title: pad(`Claimed finding number ${i} — weak error handling in the partner API`, 84), severity: 'medium', verified: false });
  }
  const ruledOut = [];
  for (let i = 1; i <= 150; i++) {
    ruledOut.push({
      key: `dead-path-${i}`,
      title: `Dead path number ${i}`,
      lesson: pad(`Dead path number ${i}: the export endpoint ignores the tenant parameter entirely and returns the same public catalogue`, 118),
      id: i,
    });
  }
  const events = [];
  const tools = ['browser_open', 'search', 'shell', 'browser_click', 'browser_type'];
  for (let i = 0; i < 800; i++) events.push({ type: 'tool_call', tool: tools[i % tools.length], detail: `action ${i}` });
  const reasoningRows = [];
  for (let i = 0; i < 300; i++) {
    reasoningRows.push({ at: 't', hypothesis: '', action: `shell: curl -s https://t.test/p${i}`, why: '', result: 'HTTP 200', learned: '' });
  }
  const covRows = [];
  for (let i = 1; i <= 10; i++) {
    covRows.push({ surface: `https://t.test/gap${i}`, class: 'sqli', outcome: 'open_gap', evidence: `gap evidence ${i}`, updatedAt: 't' });
  }
  covRows.push({ surface: 'https://t.test/login', class: 'xss', outcome: 'probed_clean', evidence: 'ok', updatedAt: 't' });
  return {
    reasoningRows,
    events,
    findings,
    coverage: { rows: covRows, researchDebt: {} },
    ruledOut,
    hypothesisLedger: { dead: [] },
    leftOff: { lastThinking: 'LEFTOFF-MARKER: mid-way through the export checks', openThreads: ['- SSTI: researched, never probed'] },
    leftOffDerived: false,
    retractedCount: 0,
    meta: { iteration: 999 },
    priorHunts: [],
  };
}

const big = largeMemory();
const bigLines = buildStateOfMind(big);
const bigText = bigLines.join('\n');

check('large: renders within the total budget', bigText.length <= SOM_TOTAL_BUDGET);
check('large: left-off section intact', bigText.includes('WHERE I LEFT OFF:') && bigText.includes('LEFTOFF-MARKER'));
check('large: open threads intact', bigText.includes('Open threads you left (1)'));
check('large: done rollup intact', bigText.includes('Actions on record: 800') && bigText.includes('reasoning entries: 300'));
{
  let allGaps = true;
  for (let i = 1; i <= 10; i++) {
    if (!bigText.includes(`OPEN GAP: https://t.test/gap${i} ×`)) allGaps = false;
  }
  check('large: not-done table complete — every open gap survives trimming', allGaps);
}
check('large: no hard-clip marker (staged trims sufficed)', !bigText.includes('state of mind trimmed to budget'));

// Trim-note reconciliation: rendered lines + noted drops == record totals.
function sectionLines(text, headerPrefix, nextHeaderPrefixes) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(headerPrefix));
  if (start < 0) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (nextHeaderPrefixes.some((h) => lines[i].startsWith(h))) { end = i; break; }
  }
  return lines.slice(start, end);
}
const ruledSec = sectionLines(bigText, 'PATHS ALREADY RULED OUT', ['FROM YOUR EARLIER HUNTS']);
const ruledNote = ruledSec.find((l) => l.includes('more ruled-out paths on record'));
check('large: ruled-out trim note present', !!ruledNote);
{
  const noted = ruledNote ? Number((ruledNote.match(/…and (\d+) more/) || [])[1]) : 0;
  const rendered = ruledSec.filter((l) => l.startsWith('- ') && l !== ruledNote).length;
  check('large: ruled-out counts reconcile (rendered + noted = 150)', rendered + noted === 150);
  check('large: ruled-out actually trimmed (noted > 0)', noted > 0);
}
const knowSec = sectionLines(bigText, 'WHAT I KNOW:', ['WHAT I HAVE NOT DONE YET']);
const knowNote = knowSec.find((l) => l.includes('more findings on record'));
{
  const findingLines = knowSec.filter((l) => l.startsWith('- [VERIFIED] ') || l.startsWith('- [claimed, NOT verified] '));
  if (knowNote) {
    const noted = Number((knowNote.match(/…and (\d+) more/) || [])[1]);
    check('large: know counts reconcile (rendered + noted = 150)', findingLines.length + noted === 150);
  } else {
    check('large: know untrimmed renders all 150 findings', findingLines.length === 150);
  }
  check('large: first verified finding survives (verified render first, trimmed last)',
    bigText.includes('- [VERIFIED] Verified finding number 1'));
}

// ---------------------------------------------------------------------------
// (b) Small memory — under budget: byte-for-byte the pre-fix render.
// ---------------------------------------------------------------------------
function smallMemory() {
  return {
    reasoningRows: [
      { at: 't', hypothesis: '', action: 'shell: curl -s https://t.test/login', why: '', result: 'HTTP 200', learned: '' },
    ],
    events: [{ type: 'tool_call', tool: 'shell', detail: 'curl -s https://t.test/login' }],
    findings: [
      { title: 'Genuine SQL injection in login', severity: 'high', verified: true },
      { title: 'Genuine SQL injection in login', severity: 'high', verified: true },
      { title: 'Weak session cookie flags', severity: 'low', verified: false },
    ],
    coverage: {
      rows: [{ surface: 'https://t.test/gap', class: 'sqli', outcome: 'open_gap', evidence: 'not probed', updatedAt: 't' }],
      researchDebt: {},
    },
    ruledOut: [
      { key: 'dead-1', title: 'Dead path one', lesson: 'Dead path one: the webhook ignores unsigned posts', id: 1 },
      { key: 'dead-2', title: 'Dead path two', lesson: 'Dead path two: the export requires a server-side token', id: 2 },
    ],
    hypothesisLedger: { dead: [] },
    leftOff: { lastThinking: 'SMALL-LEFTOFF-MARKER', openThreads: [] },
    leftOffDerived: false,
    retractedCount: 0,
    meta: { iteration: 7 },
    priorHunts: [],
  };
}

const smallText = buildStateOfMind(smallMemory()).join('\n');
check('small: renders under budget', smallText.length <= SOM_TOTAL_BUDGET);
check('small: no ruled-out trim note', !smallText.includes('more ruled-out paths on record'));
check('small: no findings trim note', !smallText.includes('more findings on record'));
check('small: no hard-clip marker', !smallText.includes('state of mind trimmed to budget'));
check('small: verified finding renders deduped with count', smallText.includes('- [VERIFIED] Genuine SQL injection in login (high) ×2'));
check('small: claimed finding renders', smallText.includes('- [claimed, NOT verified] Weak session cookie flags (low)'));
check('small: both ruled-out lessons render verbatim',
  smallText.includes('- Dead path one: the webhook ignores unsigned posts (ruled out ×1)') &&
  smallText.includes('- Dead path two: the export requires a server-side token (ruled out ×1)'));
check('small: left-off and open gap render', smallText.includes('SMALL-LEFTOFF-MARKER') && smallText.includes('OPEN GAP: https://t.test/gap ×'));

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
