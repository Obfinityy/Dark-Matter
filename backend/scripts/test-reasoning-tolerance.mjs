// Driver test for Lane H — tolerant reasoning.jsonl parsing.
// Run: node backend/scripts/test-reasoning-tolerance.mjs
// Proves: one torn line can no longer make the whole notebook invisible
// (live root cause on h_07c2709955d3: line 450 held two concatenated JSON
// objects, the old all-or-nothing .map(JSON.parse) threw, and the brain's
// briefing read "ACTIONS YOU HAVE TAKEN (0 total)" despite 541 rows).
// parseReasoningText is a pure function over raw file text, so the exact
// live failure shape is reproduced here without the filesystem.
// Implemented recovery behaviour (asserted explicitly below): a line of
// two+ concatenated complete objects IS recovered into its rows, in
// order; any other torn line is skipped and its neighbours survive.
import { parseReasoningText } from '../src/reasoningMemory.js';

let failures = 0;
let total = 0;
function check(name, cond) {
  total++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const row = (n) => ({
  at: `2026-10-21T00:00:${String(n).padStart(2, '0')}.000Z`,
  hypothesis: `Hypothesis ${n}`,
  action: `Action ${n}`,
  why: 'curiosity',
  result: `Result ${n}`,
  learned: '',
  followUp: '',
});
const line = (n) => JSON.stringify(row(n));

// --- 1. Well-formed text parses fully, in order ------------------------------
{
  const text = [line(1), line(2), line(3)].join('\n') + '\n';
  const rows = parseReasoningText(text);
  check('well-formed: all 3 rows parse', rows.length === 3);
  check('well-formed: order preserved', rows.map((r) => r.action).join(',') === 'Action 1,Action 2,Action 3');
  check('well-formed: fields intact', rows[1].hypothesis === 'Hypothesis 2' && rows[1].result === 'Result 2');
}

// --- 2. Blank lines / empty text are inert ------------------------------------
{
  check('empty text → []', parseReasoningText('').length === 0);
  check('null text → []', parseReasoningText(null).length === 0);
  const rows = parseReasoningText('\n' + line(1) + '\n\n   \n' + line(2) + '\n');
  check('blank lines skipped, 2 rows survive', rows.length === 2 && rows[0].action === 'Action 1' && rows[1].action === 'Action 2');
}

// --- 3. A torn middle line is skipped; rows before/after survive in order -----
{
  const torn = '{"at":"2026-10-21T00:00:09.000Z","hypothesis":"Hypothesis 9","action":"Acti'; // truncated mid-write
  const text = [line(1), line(2), torn, line(3), line(4)].join('\n');
  const rows = parseReasoningText(text);
  check('torn middle line: 4 valid rows survive', rows.length === 4);
  check('torn middle line: neighbours keep order', rows.map((r) => r.action).join(',') === 'Action 1,Action 2,Action 3,Action 4');
}

// --- 4. Garbage / non-object lines never poison the file ----------------------
{
  const text = [line(1), 'not json at all', '42', '"a string"', '[1,2,3]', '{"unclosed": ', line(2)].join('\n');
  const rows = parseReasoningText(text);
  check('garbage lines: only the 2 object rows survive', rows.length === 2);
  check('garbage lines: survivors are the real rows', rows[0].action === 'Action 1' && rows[1].action === 'Action 2');
}

// --- 5. The live torn shape: two objects concatenated on ONE line -------------
// Implemented behaviour: RECOVERED (both rows, in order) — asserted here.
{
  const text = [line(1), line(2) + line(3), line(4)].join('\n'); // line "2" and "3" fused, no separator
  const rows = parseReasoningText(text);
  check('concatenated line: recovered — 4 rows total', rows.length === 4);
  check('concatenated line: both objects recovered in order', rows.map((r) => r.action).join(',') === 'Action 1,Action 2,Action 3,Action 4');
  check('concatenated line: recovered rows are complete objects', rows[1].hypothesis === 'Hypothesis 2' && rows[2].result === 'Result 3');
}

// --- 6. Concatenated recovery stays conservative ------------------------------
{
  // Three fused objects also recover.
  const rows3 = parseReasoningText(line(1) + line(2) + line(3));
  check('three fused objects recover', rows3.length === 3 && rows3[2].action === 'Action 3');
  // One valid object fused with a broken half: NOTHING is recovered from
  // that line (no partial/phantom rows); the line is skipped whole.
  const rowsBad = parseReasoningText([line(1), line(2) + '{"broken": ', line(3)].join('\n'));
  check('fused-with-broken line skipped whole (no partial recovery)', rowsBad.length === 2 && rowsBad[0].action === 'Action 1' && rowsBad[1].action === 'Action 3');
  // A "}{" inside a string value must not invent rows: the line parses
  // normally as one object and is returned as exactly one row.
  const tricky = JSON.stringify({ ...row(7), action: 'payload }{ test' });
  const rowsTricky = parseReasoningText(tricky);
  check('"}{" inside a string value stays one row', rowsTricky.length === 1 && rowsTricky[0].action === 'payload }{ test');
}

// --- 7. getReasoningHistory-style slicing: last N VALID rows ------------------
{
  // Mirrors getReasoningHistory: parseReasoningText(content).slice(-limit).
  // The torn line sits INSIDE the last-N window — the old code sliced raw
  // lines first, so it both lost rows and then threw on the torn one.
  const text = [line(1), line(2), '{"torn": ', line(3), line(4), line(5)].join('\n');
  const last3 = parseReasoningText(text).slice(-3);
  check('last-N slicing returns N valid rows despite torn line in window', last3.length === 3);
  check('last-N slicing returns the NEWEST valid rows', last3.map((r) => r.action).join(',') === 'Action 3,Action 4,Action 5');
  const last10 = parseReasoningText(text).slice(-10);
  check('limit larger than valid count returns all valid rows', last10.length === 5);
}

// --- 8. Scale check echoing the live file: 541 rows, torn line at #450 --------
{
  const lines = [];
  for (let i = 1; i <= 541; i++) lines.push(line(i));
  lines[449] = line(450) + line(451); // the live shape: rows 450+451 fused on line 450
  lines.splice(450, 1); // the fused line replaces both originals (file has 540 physical lines)
  const rows = parseReasoningText(lines.join('\n'));
  check('live-shape file: all 541 rows recovered (not 0)', rows.length === 541);
  check('live-shape file: row 450 and 451 both present', rows[449].action === 'Action 450' && rows[450].action === 'Action 451');
  check('live-shape file: last row intact', rows[540].action === 'Action 541');
}

console.log(`\n${total - failures}/${total} checks passed`);
process.exit(failures ? 1 : 0);
