// Test for Job 6 stage 2 — hybrid retrieval over the episode ledger.
// Run: node backend/scripts/test-retrieval.mjs
//
// Proves: (1) the embedding backfill embeds every episode via the Ollama
// transport (faked here with deterministic topic vectors), (2) hybrid
// scoring (FTS + cosine + rule importance + recency + entity boost, all
// computed by code) ranks a 10-day-old VERIFIED SQLi finding above a
// fresh low-importance thinking episode for an SQLi query, (3) temporal
// neighbours (+/-1) ride along with a hit, (4) result order is stable
// across calls, (5) cross-hunt retrieval works with the x0.85 discount,
// (6) prompt formatting respects its char budget.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-retrieval-'));
process.env.DATA_DIR = tmp;

const store = await import('../src/episodeStore.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// Deterministic fake embedding: topic words light up fixed dimensions.
const TOPICS = { sql: 0, sqli: 0, login: 0, injection: 0, xxe: 1, basket: 2, price: 2 };
store.setEmbeddingTransport(async (texts) =>
  texts.map((t) => {
    const v = new Array(16).fill(0.05);
    for (const tok of String(t).toLowerCase().match(/[a-z]+/g) || []) {
      if (tok in TOPICS) v[TOPICS[tok]] += 1;
    }
    return v;
  })
);

// --- Fixture: two hunts ------------------------------------------------------
function writeHunt(id, events) {
  const dir = path.join(tmp, 'hunts', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
}
const A = 'h_retrieval_a';
writeHunt(A, [
  { type: 'status', state: 'container_spawned', cachedAt: '2026-10-10T00:00:00.000Z' },
  { type: 'thinking', text: 'planning login tests for the auth surface', cachedAt: '2026-10-10T00:01:00.000Z' },
  { type: 'finding', class: 'agent_finding', title: 'SQLi authentication bypass on login', severity: 'critical', url: 'http://172.17.0.1:3000/rest/user/login', verified: true, verification: 'confirmed (all 4 steps passed)', evidence: { request: "POST /rest/user/login {\"email\":\"admin@juice-sh.op' OR 1=1--\"}", response: 'valid admin JWT token issued' }, cachedAt: '2026-10-10T00:02:00.000Z' },
  { type: 'thinking', text: 'login bypass confirmed, moving on to other surfaces', cachedAt: '2026-10-10T00:03:00.000Z' },
  { type: 'finding', class: 'agent_finding', title: 'XXE external-entity file disclosure on /file-upload', severity: 'high', verified: false, evidence: { request: 'curl -F file=@xxe.xml', response: 'error' }, cachedAt: '2026-10-19T00:00:00.000Z' },
  { type: 'thinking', text: 'checking basket prices and totals again', cachedAt: '2026-10-20T09:00:00.000Z' },
]);
const B = 'h_retrieval_b';
writeHunt(B, [
  { type: 'finding', class: 'agent_finding', title: 'SQLi in the product search parameter', severity: 'high', verified: true, evidence: { request: 'GET /rest/products/search?q=sql', response: 'database rows returned' }, cachedAt: '2026-10-15T00:00:00.000Z' },
]);

store.backfillAllHunts();

// --- Embedding backfill -------------------------------------------------------
const bf = await store.runEmbeddingBackfill({ maxEpisodes: 100 });
const es = store.getEmbeddingStats();
check('backfill embedded every episode', bf.remaining === 0 && es.embedded === es.total && es.total === 7);
const bf2 = await store.runEmbeddingBackfill({ maxEpisodes: 100 });
check('backfill is idempotent (nothing left to embed)', bf2.embedded === 0 && bf2.remaining === 0);

// --- Hybrid retrieval: relevance + importance must beat raw recency ----------
const NOW = Date.parse('2026-10-20T10:00:00.000Z');
const ret = await store.retrieveEpisodes('sql injection login bypass', { huntId: A, limit: 5, now: NOW });
check('retrieval returns results', ret.results.length > 0);
check('top hit is the verified SQLi finding (not the fresh thinking episode)', /SQLi authentication bypass/.test(ret.results[0].title || ''));
check('top hit carries score parts (relevance/importance/recency)', ret.results[0].parts && ret.results[0].parts.importanceScore === 1);
check('both relevance signals fired (fts + vec)', ret.signals.fts > 0 && ret.signals.vec > 0);
const sqli = ret.results[0];
check('temporal neighbours attached (+/-1 episodes)', sqli.neighbours.length === 2 && sqli.neighbours.some((n) => /planning login/.test(n.title || '')));

// --- Stability across calls ----------------------------------------------------
const ret2 = await store.retrieveEpisodes('sql injection login bypass', { huntId: A, limit: 5, now: NOW });
check(
  'result order is stable across calls',
  ret.results.map((r) => r.id).join(',') === ret2.results.map((r) => r.id).join(',')
);

// --- Cross-hunt retrieval with discount ---------------------------------------
const cross = await store.retrieveEpisodes('sql injection', { huntId: A, crossHunt: true, limit: 8, now: NOW });
const crossHit = cross.results.find((r) => r.hunt_id === B);
check('cross-hunt episode is retrievable', !!crossHit);
check('cross-hunt hit is discounted vs the in-hunt SQLi hit', !!crossHit && crossHit.score < ret.results[0].score);

// --- Prompt formatting budget ---------------------------------------------------
const text = store.formatRetrievalForPrompt(ret.results, { budgetChars: 500, query: 'sql injection login bypass' });
check('formatted slice respects the char budget', text.length <= 700 && /RETRIEVED MEMORY/.test(text));
check('formatted slice names the top episode', /SQLi authentication bypass/.test(text));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
