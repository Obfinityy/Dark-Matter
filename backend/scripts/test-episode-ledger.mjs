// Test for Job 6 stage 1 — the SQLite episode ledger (episodeStore.js).
// Run: node backend/scripts/test-episode-ledger.mjs
//
// Proves: (1) backfill mirrors a hunt's events.jsonl 1:1 (line index =
// source_idx), (2) re-running backfill is idempotent (INSERT OR IGNORE on
// (hunt_id, source_idx)), (3) a torn line becomes a tombstone episode and
// does not break alignment of later lines, (4) rule-based importance,
// (5) the store.js append path mirrors new events, (6) FTS search finds a
// past episode and bumps its access counter, (7) deterministic context
// assembly (same state -> same text).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-episodes-'));
process.env.DATA_DIR = tmp;

const store = await import('../src/episodeStore.js');
const { appendHuntEvent } = await import('../src/store.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

check('ledger enabled on this runtime (node:sqlite present)', store.episodeLedgerEnabled());

// --- Fixture: a pre-existing hunt log, as the JSONL source of truth --------
const huntId = 'h_test_ledger';
const huntDir = path.join(tmp, 'hunts', huntId);
fs.mkdirSync(huntDir, { recursive: true });
const seed = [
  { type: 'thinking', text: 'Starting the hunt against the lab target.', cachedAt: '2026-10-20T00:00:00.000Z' },
  { type: 'status', state: 'container_spawned', cachedAt: '2026-10-20T00:00:01.000Z' },
  { type: 'finding', class: 'agent_finding', title: 'XXE external-entity file disclosure on /file-upload', severity: 'high', url: 'http://172.17.0.1:3000/file-upload', verified: true, verification: 'confirmed (all 4 steps passed)', evidence: { request: 'curl -F file=@xxe.xml http://172.17.0.1:3000/file-upload', response: 'root:x:0:0:root:/root:/bin/bash' }, cachedAt: '2026-10-20T00:01:00.000Z' },
  { type: 'finding', class: 'agent_finding', title: 'basket-price', severity: 'medium', verified: false, verification: 'false_positive (payload_validation)', evidence: { request: 'curl http://172.17.0.1:3000/api/BasketItems', response: 'jq: parse error' }, cachedAt: '2026-10-20T00:02:00.000Z' },
  { type: 'memory_audit', iteration: 7, count: 3, keys: ['xxe|ecommerce'], cachedAt: '2026-10-20T00:03:00.000Z' },
];
const lines = seed.map((e) => JSON.stringify(e));
lines.push('{"type":"finding","title":"torn-write-never-finished'); // torn line at idx 5
fs.writeFileSync(path.join(huntDir, 'events.jsonl'), lines.join('\n') + '\n');

// --- Backfill ---------------------------------------------------------------
const r1 = store.backfillAllHunts();
check('backfill reports 1 hunt', r1.hunts === 1);
check('backfill mirrored all 6 lines (5 events + 1 torn)', r1.total === 6 && r1.inserted === 6);

const r2 = store.backfillAllHunts();
check('second backfill is idempotent (0 inserted, total unchanged)', r2.inserted === 0 && r2.total === 6);

// --- Importance + tombstone + mapping ---------------------------------------
const recent = store.getRecentEpisodes(huntId, 10);
check('torn line became a _torn tombstone at the end', recent[recent.length - 1].kind === '_torn');
const top = store.getTopEpisodes(huntId, 3);
check('verified finding has top rule importance (10)', top[0].importance === 10 && /XXE/.test(top[0].title));
check('verified finding outcome is "verified"', top[0].outcome === 'verified');
check('unverified finding importance is 8', top[1].importance === 8);
check(
  'importance rules: thinking 2 / status 1 / recall 6',
  store.importanceForEvent({ type: 'thinking' }) === 2 &&
    store.importanceForEvent({ type: 'status' }) === 1 &&
    store.importanceForEvent({ type: 'recall' }) === 6
);

// --- Append path (store.js hook -> scheduled flush -> mirror) ---------------
appendHuntEvent(huntId, { type: 'recall', query: 'xxe file upload', text: 'RECALL: xxe file upload' });
await new Promise((r) => setTimeout(r, 150)); // let the setImmediate flush run
const r3 = store.flushHuntEpisodes(huntId);
const stats = store.getEpisodeStats();
check('appended recall event mirrored (total 7)', stats.total === 7 && stats.perHunt[huntId] === 7);
check('flush after append is a no-op (already mirrored)', r3.inserted === 0);

// --- Search + access reinforcement -------------------------------------------
const hits = store.searchEpisodes('xxe file upload', { huntId, limit: 5 });
check('FTS search finds the XXE episode', hits.length > 0 && hits.some((h) => /XXE/.test(h.title || '')));
check('search bumped access_count on the hit', hits.length > 0 && hits[0].access_count >= 1);

// --- Deterministic context assembly -------------------------------------------
const ctx1 = store.assembleEpisodeContext(huntId);
const ctx2 = store.assembleEpisodeContext(huntId);
check('context assembly is deterministic', ctx1 === ctx2 && ctx1.length > 0);
check('context assembly reports the verified finding', /1 verified findings/.test(ctx1) && /XXE/.test(ctx1));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
