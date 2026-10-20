// Driver test for the solver #443 full-history ledger + RECALL builders.
// Run: node backend/scripts/test-full-history.mjs
// Proves: findings are never dropped (even verified ones under a tiny
// budget), oldest actions compress into counts-by-outcome (never silently),
// dead ends are derived, artifacts render, and RECALL retrieves matching
// records from events + reasoning + global memory.
import { buildFullHistoryLedger, searchRecall } from '../src/reasoningMemory.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// --- Fixtures ---------------------------------------------------------------
const rows = [];
for (let i = 1; i <= 300; i++) {
  rows.push({
    hypothesis: i <= 40 ? 'NoSQL operator injection on login' : `Hypothesis ${i}`,
    action: `Test number ${i} against /rest/resource/${i}`,
    why: 'curiosity',
    result: i <= 40 ? 'Payload reached the application but was not verified — input appears sanitized' : (i === 299 ? 'VERIFIED: SQL injection authentication bypass (admin JWT issued)' : 'Executed; response recorded, no assessment triggered'),
    learned: '',
  });
}
const findings = [
  { title: 'SQL injection authentication bypass', severity: 'critical', verified: true },
  { title: 'FTP directory listing exposes incident-support.kdbx', severity: 'low', verified: true },
  { title: 'admin panel timing anomaly', severity: 'medium', verified: false },
];
const chainContext = { artifacts: { jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature' }, chainPath: ['data_read', 'auth_bypass', 'priv_esc'], fromFinding: 'SQL injection authentication bypass' };

// --- Ledger under a small budget ---------------------------------------------
const { text, stats } = buildFullHistoryLedger({ reasoningRows: rows, findings, chainContext, budgetChars: 6000 });
check('stats count all 300 actions', stats.actions === 300);
check('oldest actions summarised under small budget', stats.summarised > 0);
check('summary line present with counts', /earliest actions summarised: \d+ verified, \d+ failed, \d+ done/.test(text));
check('ALL findings render despite tiny budget', findings.every((f) => text.includes(f.title)));
check('verified findings tagged', text.includes('[VERIFIED] SQL injection authentication bypass'));
check('unverified findings tagged', text.includes('[unverified] admin panel timing anomaly'));
check('newest action line kept in full', text.includes('Test number 300 against'));
check('dead end derived (40x failed hypothesis)', text.includes('NoSQL operator injection on login') && /DEAD ENDS/.test(text));
check('captured artifact rendered', text.includes('jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
check('chain path rendered', text.includes('data_read → auth_bypass → priv_esc'));

// --- Ledger with a generous budget: nothing summarised ------------------------
const big = buildFullHistoryLedger({ reasoningRows: rows.slice(0, 10), findings, chainContext: null, budgetChars: 100000 });
check('generous budget summarises nothing', big.stats.summarised === 0 && big.stats.shown === 10);

// --- RECALL -------------------------------------------------------------------
const events = [
  { type: 'finding', title: 'XXE external entity file disclosure', verified: true, evidence: { request: 'curl -F file=@xxe.xml http://target/file-upload', response: 'root:x:0:0:root:/root:/bin/bash' } },
  { type: 'finding', title: 'admin panel timing anomaly', verified: false, evidence: { request: 'curl http://target/admin', response: 'Time taken: 0.14 seconds' } },
  { type: 'thinking', text: 'Considering the upload flow' },
];
const gm = [
  { type: 'technique', technique: 'xxe-fileupload-error-v1', appType: 'e-commerce', context: 'XXE via file upload error reflection', note: '', successes: 1, attempts: 1 },
  { type: 'technique', technique: 'sqli-login', appType: 'e-commerce', context: 'Login SQLi', note: '', successes: 3, attempts: 4 },
];
const rec = searchRecall({ events, reasoningRows: rows, globalMemories: gm, query: 'xxe file upload', limit: 8 });
check('RECALL finds the XXE records', rec.hits >= 2 && rec.text.includes('XXE external entity file disclosure'));
check('RECALL includes the global-memory lesson', rec.text.includes('xxe-fileupload-error-v1'));
check('RECALL ranks the verified finding in output', rec.text.includes('[VERIFIED]'));
const none = searchRecall({ events, reasoningRows: rows, globalMemories: gm, query: 'zzzqqq nonexistent', limit: 8 });
check('RECALL with no match reports 0 hits honestly', none.hits === 0 && /No past records match/.test(none.text));

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
