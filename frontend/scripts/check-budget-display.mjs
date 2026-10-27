// Budget-display regression check (27 Oct 2026) — no test framework in
// the frontend, so this is a dependency-free node guard over HuntCard.jsx
// plus a simulation of the exact cost-state derivation the card uses.
//
// The bug it guards: api.js wraps every response as {ok, status, data},
// but HuntCard stored the whole envelope in `cost`, so cost.budgetUsd
// was undefined forever — the "Budget $X" chip and the "Spent $X of $Y"
// line could never render, and the input fell back to a literal '10'
// placeholder (which is what the 18:39 IST browser verification saw:
// input "10" after reload, no "Budget $10.00" / "Spent $0.00 of $10.00").
//
// Run: node scripts/check-budget-display.mjs   (exit 0 = all checks pass)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, '..', 'src', 'components', 'HuntCard.jsx'), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// 1. No envelope stored anywhere: setCost(res) must be gone.
check('no setCost(res) envelope store remains', !/setCost\(res\)/.test(src));
// 2. All three cost loads store the payload: refreshCost + mount + 30s poll.
const dataStores = (src.match(/setCost\(res\.data\)/g) || []).length;
check('setCost(res.data) at all three cost loads', dataStores === 3, `found ${dataStores}`);
// 3. saveBudget applies the POST response to cost state at once.
check('saveBudget merges POST data into cost state', /setCost\(\(prev\)/.test(src) && /res\.data\.budgetUsd/.test(src));
// 4. Input keeps the saved value; blanking only happens on clear (null).
const clearTernary = (src.match(/setBudgetInput\(value === null \? '' :/g) || []).length;
const directBlank = (src.match(/setBudgetInput\(['"]{2}\)/g) || []).length;
check("input blanked only on clear (value === null ? '' : …)", clearTernary === 1 && directBlank === 0, `ternary=${clearTernary} direct=${directBlank}`);
// 5. Placeholder never implies a budget value.
check("no literal '10' placeholder", !/placeholder=\{[^}]*'10'\}/.test(src));
check("placeholder says 'No budget set'", src.includes("'No budget set'"));
// 6. The spent line still renders whenever a budget is set.
check('"Spent $X of $Y" renders when budgetUsd !== null',
  src.includes('hunt-budget-spent') && /budgetUsd !== null && \([\s\S]{0,120}?hunt-budget-spent/.test(src));

// 7. Simulate the derivation with a real GET /:id/cost envelope.
//    Backend returns body {ok, totalUsd, budgetUsd, pausedReason}; api.js
//    wraps it as {ok, status, data: body}.
const envelope = { ok: true, status: 200, data: { ok: true, totalUsd: 0, budgetUsd: 5, pausedReason: null } };
const derive = (cost) => (cost && typeof cost.budgetUsd === 'number' ? cost.budgetUsd : null);
check('OLD path (envelope stored) hides the budget', derive(envelope) === null, `budgetUsd=${derive(envelope)}`);
check('NEW path (res.data stored) shows $5', derive(envelope.data) === 5, `budgetUsd=${derive(envelope.data)}`);

// 8. Simulate saveBudget's POST merge: POST /budget returns
//    {ok, huntId, budgetUsd, spentUsd}; the card maps spentUsd->totalUsd.
const postData = { ok: true, huntId: 'h_new', budgetUsd: 5, spentUsd: 0 };
const merged = {
  ...(null || {}),
  budgetUsd: typeof postData.budgetUsd === 'number' ? postData.budgetUsd : null,
  totalUsd: typeof postData.spentUsd === 'number' ? postData.spentUsd : 0,
};
const spentUsd = merged && merged.totalUsd ? merged.totalUsd : 0;
const spentLine = merged.budgetUsd !== null ? `Spent $${spentUsd.toFixed(2)} of $${merged.budgetUsd.toFixed(2)}` : null;
check('POST merge yields "Spent $0.00 of $5.00" at once', spentLine === 'Spent $0.00 of $5.00', spentLine);

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll budget-display checks passed.');
