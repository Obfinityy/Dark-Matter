// Test for solver #458 — resume-guard against the 60 s resume-timer noise.
// Run: node backend/scripts/test-resume-guard.mjs
//
// Background: server.js scanAndResumeRunningHunts calls
// resumeInterruptedHunt for EVERY hunt whose meta says 'running', every
// 60 s — including the hunt the live driver is actively driving.
// resumeInterruptedHunt had no already-driving check: each call appended
// a spurious 'resumed_from_checkpoint' status event, launched
// runAutonomousHunt only for the loop mutex to refuse it with a think
// line, and still returned true, so the scan logged a successful
// "resumed from checkpoint" every minute for a hunt that was never
// interrupted. The fix: isDriverActive() (activeLoops in this process,
// or a driver.lock whose pid is alive AND heartbeat fresh — the same
// liveness rule tryAcquireDriverLock uses) makes resumeInterruptedHunt
// return false BEFORE any side effect when a driver is genuinely active.
//
// Proves: (1) the liveness probe's four corners (no lock / live+fresh /
// dead pid / stale heartbeat / corrupt file), (2) with a live driver the
// resume is refused with ZERO side effects (no event, meta untouched),
// (3) with only a stale lock the guard steps aside and the pre-existing
// resume path runs (pause flags cleared), (4) non-running and unknown
// hunts are refused exactly as before.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-resume-guard-'));
process.env.DATA_DIR = tmp;

const store = await import('../src/store.js');
const ha = await import('../src/huntAgent.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const STALE_MS = 90 * 60 * 1000;
function writeLock(huntId, lock) {
  const dir = store.huntDir(huntId);
  if (lock === null) return;
  fs.writeFileSync(path.join(dir, 'driver.lock'), typeof lock === 'string' ? lock : JSON.stringify(lock));
}
function resumedEvents(huntId) {
  return store.readHuntEvents(huntId).filter((e) => e.state === 'resumed_from_checkpoint');
}

// — isDriverActive corners —
store.writeHuntMeta('h_g_nolock', { huntId: 'h_g_nolock', state: 'running', target: 'http://127.0.0.1:9', iteration: 3 });
check('no lock file -> driver not active', ha.isDriverActive('h_g_nolock') === false);

writeLock('h_g_live', { pid: process.pid, startedAt: new Date().toISOString(), heartbeatAt: Date.now() });
check('live pid + fresh heartbeat -> active', ha.isDriverActive('h_g_live') === true);

writeLock('h_g_dead', { pid: 2147483646, startedAt: new Date().toISOString(), heartbeatAt: Date.now() });
check('dead pid + fresh heartbeat -> not active', ha.isDriverActive('h_g_dead') === false);

writeLock('h_g_stale', { pid: process.pid, startedAt: new Date().toISOString(), heartbeatAt: Date.now() - STALE_MS - 60000 });
check('live pid + stale heartbeat -> not active', ha.isDriverActive('h_g_stale') === false);

writeLock('h_g_corrupt', '{not json');
check('corrupt lock file -> not active', ha.isDriverActive('h_g_corrupt') === false);

// — resume refused, zero side effects, while a driver is live —
store.writeHuntMeta('h_g_live', { huntId: 'h_g_live', state: 'running', target: 'http://127.0.0.1:9', iteration: 7, paused: true, pausedReason: 'test' });
const liveResult = await ha.resumeInterruptedHunt('h_g_live');
check('live driver: resume returns false', liveResult === false);
check('live driver: no resumed_from_checkpoint event written', resumedEvents('h_g_live').length === 0);
const liveMeta = store.readHuntMeta('h_g_live');
check('live driver: meta untouched (pause flags NOT cleared)', liveMeta.paused === true && liveMeta.pausedReason === 'test');

// — stale lock: guard steps aside, pre-existing resume path runs —
// (no target on purpose: the path then returns false at the target check
// AFTER clearing pause flags — proving it got past the guard — without
// launching a real loop.)
store.writeHuntMeta('h_g_stale', { huntId: 'h_g_stale', state: 'running', iteration: 4, paused: true, pausedReason: 'test' });
const staleResult = await ha.resumeInterruptedHunt('h_g_stale');
check('stale lock: resume returns false (no target to resume)', staleResult === false);
const staleMeta = store.readHuntMeta('h_g_stale');
check('stale lock: guard passed — pause flags cleared by resume path', staleMeta.paused === false && staleMeta.pausedReason === null);
check('stale lock: no resumed_from_checkpoint event (no target)', resumedEvents('h_g_stale').length === 0);

// — unchanged refusals —
store.writeHuntMeta('h_g_paused', { huntId: 'h_g_paused', state: 'paused', target: 'http://127.0.0.1:9', iteration: 2 });
check('paused-state hunt: resume returns false', (await ha.resumeInterruptedHunt('h_g_paused')) === false);
check('unknown hunt: resume returns false', (await ha.resumeInterruptedHunt('h_g_missing')) === false);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
