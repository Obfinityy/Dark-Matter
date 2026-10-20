// Test for Job 6 stage 4 — validator-gated Reflexion + dead-end registry.
// Run: node backend/scripts/test-dead-ends.mjs
//
// Proves: (1) lessons are composed by code from validator outcomes in the
// "Tried X → got Y → do W" form, capped at 240 chars, (2) the registry
// counts rejections per normalised test key and the retry budget (3) is
// reachable, (3) a lesson written from a finding verdict links to that
// finding's episode, (4) the historical backfill seeds lessons from
// rejected finding EPISODES exactly once (idempotent), with families
// parsed from the verdict strings, (5) the prompt lessons block groups
// by key with counts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-deadends-'));
process.env.DATA_DIR = tmp;

const store = await import('../src/episodeStore.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// --- Lesson composition (pure) ---------------------------------------------
const l1 = store.composeLesson({ title: 'SQLi on search', family: 'payload_validation', detail: 'whatever' });
check('lesson has the Reflexion form', /^Tried .+ → got .+ → do: .+/.test(l1));
check('payload_validation lesson carries its rule', /vary the payload/.test(l1));
check('lesson is capped at 240 chars (~40 tokens)', l1.length <= 240);
const l2 = store.composeLesson({ title: 'x'.repeat(300), family: 'execution-failed', detail: 'exit 1' });
check('long titles are clipped, cap still holds', l2.length <= 240 && /command form/.test(l2));

// --- Registry counting + budget ----------------------------------------------
const H = 'h_deadends';
for (let i = 0; i < 3; i++) {
  store.recordRuledOut({ huntId: H, title: 'Basket Price  Tamper', family: 'payload_validation', detail: 'false_positive (payload_validation: FAILED)' });
}
store.recordRuledOut({ huntId: H, title: 'basket price tamper', family: 'payload_validation', detail: 'again' });
const counts = store.getRuledOutCounts(H);
check('keys are normalised (case/space-insensitive)', counts.get('basket price tamper') === 4);
check('count reaches the retry budget', (counts.get('basket price tamper') || 0) >= store.RETRY_BUDGET && store.RETRY_BUDGET === 3);

// --- Episode linking -----------------------------------------------------------
const dir = path.join(tmp, 'hunts', H);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'events.jsonl'), JSON.stringify({
  type: 'finding', class: 'agent_finding', title: 'XXE upload probe', verified: false,
  verification: 'false_positive (exploit_confirmation: not reproduced)', evidence: {}, cachedAt: '2026-10-20T00:00:00.000Z',
}) + '\n');
const rec = store.recordRuledOut({ huntId: H, title: 'XXE upload probe', family: 'exploit_confirmation', detail: 'x', linkEpisode: true });
const rows = store.getRuledOut(H, 10);
const linked = rows.find((r) => r.id === rec.id);
check('finding-verdict lesson links to the finding episode', !!linked && linked.episode_id != null);

// --- Historical backfill from rejected episodes ---------------------------------
const H2 = 'h_deadends_hist';
const dir2 = path.join(tmp, 'hunts', H2);
fs.mkdirSync(dir2, { recursive: true });
fs.writeFileSync(path.join(dir2, 'events.jsonl'), [
  { type: 'finding', title: 'old rejected one', verified: false, verification: 'false_positive (payload_validation: FAILED)', evidence: {}, cachedAt: '2026-10-19T00:00:00.000Z' },
  { type: 'finding', title: 'old rejected one', verified: false, verification: 'false_positive (payload_validation: FAILED)', evidence: {}, cachedAt: '2026-10-19T01:00:00.000Z' },
  { type: 'finding', title: 'old verified one', verified: true, verification: 'confirmed (all 4 steps passed)', evidence: {}, cachedAt: '2026-10-19T02:00:00.000Z' },
].map((e) => JSON.stringify(e)).join('\n') + '\n');
store.backfillAllHunts();
const b1 = store.backfillRuledOutFromEpisodes();
check('backfill records one lesson per rejected episode (verified skipped)', b1.recorded === 2);
const b2 = store.backfillRuledOutFromEpisodes();
check('backfill is idempotent', b2.recorded === 0);
check('backfilled family parsed from the verdict string', store.getRuledOut(H2, 5).every((r) => r.reason === 'payload_validation'));

// --- Prompt block ------------------------------------------------------------------
const block = store.formatLessonsForPrompt(H);
check('prompt block groups lessons with counts', /LESSONS FROM FAILURES/.test(block) && /×4/.test(block) && /basket price tamper/i.test(block));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
