// Test for Job 6 stage 3 — consolidation jobs + per-target dossier.
// Run: node backend/scripts/test-consolidation.mjs
//
// Proves: (1) the dossier is assembled from validator-stamped records
// only (verified facts with urls, rejected with reasons, dead hypotheses
// from the ledger), (2) SECRETS never reach the dossier — a chainContext
// token value planted in meta must NOT appear, only the key name,
// (3) the consolidation is recorded as a first-class episode (kind
// 'consolidation', rule importance 7) that retrieval/FTS can find,
// (4) the threshold gate: a second run with too few new episodes no-ops.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-consol-'));
process.env.DATA_DIR = tmp;

const episodes = await import('../src/episodeStore.js');
const consol = await import('../src/consolidation.js');
const { writeHuntMeta } = await import('../src/store.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const H = 'h_consol_test';
const dir = path.join(tmp, 'hunts', H);
fs.mkdirSync(dir, { recursive: true });
const SECRET = 'FAKE-SECRET-TOKEN-VALUE-12345';
writeHuntMeta(H, {
  huntId: H,
  target: 'http://172.17.0.1:3000',
  state: 'running',
  iteration: 12,
  chainContext: { adminJwt: SECRET },
});
fs.writeFileSync(path.join(dir, 'events.jsonl'), [
  { type: 'thinking', text: 'starting work on the lab target', cachedAt: '2026-10-20T00:00:00.000Z' },
  { type: 'finding', class: 'agent_finding', title: 'SQLi authentication bypass on login', severity: 'critical', url: 'http://172.17.0.1:3000/rest/user/login', verified: true, verification: 'confirmed (all 4 steps passed)', evidence: { request: 'POST /rest/user/login', response: 'admin token issued' }, cachedAt: '2026-10-20T00:01:00.000Z' },
  { type: 'finding', class: 'agent_finding', title: 'basket-price', severity: 'medium', url: 'http://172.17.0.1:3000/api/BasketItems', verified: false, verification: 'false_positive (payload_validation: FAILED)', evidence: { request: 'curl', response: 'jq parse error' }, cachedAt: '2026-10-20T00:02:00.000Z' },
  { type: 'finding', class: 'agent_finding', title: 'possible IDOR on orders', severity: 'medium', verified: undefined, evidence: {}, cachedAt: '2026-10-20T00:03:00.000Z' },
].map((e) => JSON.stringify(e)).join('\n') + '\n');
// A hypothesis that failed 5x -> DEAD in the hypothesis ledger.
const deadRows = Array.from({ length: 5 }, (_, i) => ({
  at: `2026-10-20T00:0${i}:00.000Z`, hypothesis: 'Blind SQLi via timing on search', action: 'timing probe', why: 'wondered', result: 'not verified — no assessment signal', learned: 'nothing', followUp: '',
}));
fs.writeFileSync(path.join(dir, 'reasoning.jsonl'), deadRows.map((r) => JSON.stringify(r)).join('\n') + '\n');
// One more reasoning row carrying the next step.
fs.appendFileSync(path.join(dir, 'reasoning.jsonl'), JSON.stringify({ at: '2026-10-20T00:09:00.000Z', hypothesis: 'IDOR', action: 'fetch order 1002 as user B', why: 'ids look sequential', result: 'pending', learned: '', followUp: 'Re-run the IDOR fetch with the second account token' }) + '\n');

episodes.backfillAllHunts();

// --- Consolidation run ---------------------------------------------------------
const r1 = consol.runConsolidation(H, { force: true });
check('forced consolidation completes', r1.done === true);
const dossierPath = path.join(dir, 'DOSSIER.md');
check('DOSSIER.md written into the hunt dir', fs.existsSync(dossierPath));
const text = fs.readFileSync(dossierPath, 'utf8');
check('dossier names the target', /172\.17\.0\.1:3000/.test(text));
check('confirmed facts carry the verified finding + url', /SQLi authentication bypass on login/.test(text) && /rest\/user\/login/.test(text));
check('ruled-out section carries the rejected finding + reason', /basket-price/.test(text) && /false_positive/.test(text));
check('dead hypothesis from the ledger is listed', /DEAD hypothesis \(failed 5×\): Blind SQLi via timing/.test(text));
check('open lead is listed', /possible IDOR on orders/.test(text));
check('next step comes from the last reasoning row', /Re-run the IDOR fetch/.test(text));
check('SECRET token value NEVER appears in the dossier', !text.includes(SECRET));
check('chain state reports key presence only', /adminJwt: present/.test(text));

// --- Consolidation is a first-class, retrievable episode -----------------------
const consolEps = episodes.queryEpisodes(H, { kind: 'consolidation' });
check('consolidation episode exists in the ledger', consolEps.length === 1);
check('consolidation episode has rule importance 7', consolEps.length === 1 && consolEps[0].importance === 7);
const hits = episodes.searchEpisodes('consolidated episodes DOSSIER', { huntId: H, limit: 5 });
check('FTS can find the consolidation episode', hits.some((h) => h.kind === 'consolidation'));

// --- Threshold gate ---------------------------------------------------------------
const r2 = consol.runConsolidation(H, {});
check('second run below threshold is a no-op', r2.done === false && r2.reason === 'below-threshold');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
