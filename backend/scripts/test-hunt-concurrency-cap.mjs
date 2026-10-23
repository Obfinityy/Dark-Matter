// Regression test for the hunt concurrency cap (24 Oct 2026, Lane X).
// Run: node backend/scripts/test-hunt-concurrency-cap.mjs
//
// Bug this pins (live on production before the fix): POST /api/v1/hunts
// enforced ONE running hunt globally — any 'running' meta sent a new
// hunt to the FIFO queue, and queued hunts only start when a running
// hunt ENDS. Hunts are unlimited by design, so the queue never drained:
// a new lab hunt (DVWA) queued forever behind the running Ezviz hunt,
// even though several hunts already ran concurrently in practice
// (boot-resume restarts every 'running' hunt).
//
// The fix: a shared cap decision in store.js — huntConcurrencyCap()
// (MAX_CONCURRENT_HUNTS env, default 3), countRunningHunts() (only
// state 'running' counts; paused/stopped/finished never do — the
// 20 Oct 2026 semantics), and huntQueueFull() used by BOTH the create
// route and the hunt-end queue drain.
import fs from 'node:fs';
import {
  DEFAULT_MAX_CONCURRENT_HUNTS,
  huntConcurrencyCap,
  countRunningHunts,
  huntQueueFull,
} from '../src/store.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const meta = (huntId, state) => ({ huntId, state, target: `https://${huntId}.example` });
const running = (n) => Array.from({ length: n }, (_, i) => meta(`h_run_${i}`, 'running'));

// ---- huntConcurrencyCap ------------------------------------------------------
check('default cap is 3', DEFAULT_MAX_CONCURRENT_HUNTS === 3);
check('missing env → default 3', huntConcurrencyCap({}) === 3);
check('env "1" → 1', huntConcurrencyCap({ MAX_CONCURRENT_HUNTS: '1' }) === 1);
check('env "5" → 5', huntConcurrencyCap({ MAX_CONCURRENT_HUNTS: '5' }) === 5);
check('env "0" → default (non-positive)', huntConcurrencyCap({ MAX_CONCURRENT_HUNTS: '0' }) === 3);
check('env "-2" → default (non-positive)', huntConcurrencyCap({ MAX_CONCURRENT_HUNTS: '-2' }) === 3);
check('env "abc" → default (garbage)', huntConcurrencyCap({ MAX_CONCURRENT_HUNTS: 'abc' }) === 3);
check('env "" → default (empty)', huntConcurrencyCap({ MAX_CONCURRENT_HUNTS: '' }) === 3);
check('env " 4 " → 4 (whitespace tolerated)', huntConcurrencyCap({ MAX_CONCURRENT_HUNTS: ' 4 ' }) === 4);
check('no-arg call returns a positive int', Number.isInteger(huntConcurrencyCap()) && huntConcurrencyCap() > 0);

// ---- countRunningHunts -------------------------------------------------------
check('no metas → 0 running', countRunningHunts([]) === 0);
check('null/undefined list → 0 running', countRunningHunts(null) === 0 && countRunningHunts(undefined) === 0);
check('counts only state "running"',
  countRunningHunts([...running(2), meta('h_p', 'paused'), meta('h_s', 'stopped'), meta('h_f', 'finished')]) === 2);
check('paused hunts are NEVER counted (20 Oct rule)',
  countRunningHunts([meta('h_p1', 'paused'), meta('h_p2', 'paused'), meta('h_p3', 'paused')]) === 0);
check('ragged entries are skipped', countRunningHunts([null, meta('h_r', 'running'), {}]) === 1);

// ---- huntQueueFull: the decision both call sites share -----------------------
check('0 running → start (not full)', huntQueueFull([], {}) === false);
check('cap-1 running (2 of 3) → start (not full)', huntQueueFull(running(2), {}) === false);
check('cap running (3 of 3) → queue (full)', huntQueueFull(running(3), {}) === true);
check('over cap (5 of 3) → queue (full)', huntQueueFull(running(5), {}) === true);
check('env override 1: 1 running → queue (full)', huntQueueFull(running(1), { MAX_CONCURRENT_HUNTS: '1' }) === true);
check('env override 1: 0 running → start (not full)', huntQueueFull([], { MAX_CONCURRENT_HUNTS: '1' }) === false);
check('env override 5: 4 running → start (not full)', huntQueueFull(running(4), { MAX_CONCURRENT_HUNTS: '5' }) === false);
check('env garbage falls back to default 3: 2 running → start',
  huntQueueFull(running(2), { MAX_CONCURRENT_HUNTS: 'xyz' }) === false);
check('env garbage falls back to default 3: 3 running → queue',
  huntQueueFull(running(3), { MAX_CONCURRENT_HUNTS: 'xyz' }) === true);
check('paused/stopped backlog never fills the cap',
  huntQueueFull([meta('h_p', 'paused'), meta('h_s', 'stopped'), meta('h_f', 'finished')], {}) === false);
check('the live 23 Oct shape: Ezviz running + lab running + paused bench → DVWA starts',
  huntQueueFull([...running(2), meta('h_bench_paused', 'paused')], {}) === false);

// ---- wiring: both call sites use the shared helper ---------------------------
const huntsSrc = fs.readFileSync(new URL('../src/routes/hunts.js', import.meta.url), 'utf8');
const agentSrc = fs.readFileSync(new URL('../src/huntAgent.js', import.meta.url), 'utf8');
check('POST /hunts route decides via huntQueueFull(metas)', huntsSrc.includes('huntQueueFull(metas)'));
check('hunt-end drain decides via huntQueueFull() before dequeuing',
  agentSrc.includes('huntQueueFull() ? null : dequeueNextHunt()'));
check('old any-running queue condition is gone from the route',
  !huntsSrc.includes("const active = listHuntMetas().find((h) => h.state === 'running');"));
check('old singular queue message is gone', !huntsSrc.includes('when the current one finishes'));

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS');
process.exit(failures ? 1 : 0);
