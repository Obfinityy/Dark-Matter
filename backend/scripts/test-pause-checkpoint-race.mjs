// Test for lane B (21 Oct 2026) — the pause checkpoint-race fix.
// Run: node backend/scripts/test-pause-checkpoint-race.mjs
//
// Background: pausing a hunt persists { state:'paused', paused:true }
// (routes/hunts.js / routes/chat.js via plain writeHuntMeta). The hunt
// loop's per-iteration CHECKPOINT (huntAgent.js) then re-read the meta
// but forced state:'running' over it, so a pause set while an iteration
// was in flight flipped back to 'running' at the next iteration
// boundary. The hunt LOOKED running, and after any backend restart
// resumeInterruptedHunt saw state 'running', cleared the pause flags and
// relaunched the loop — the pause did not hold (observed live on lab
// hunt h_bench_d69e5746, 20 Oct 2026 ~19:55Z; parent root-caused it as a
// checkpoint race ~20:04 IST).
//
// The fix: store.writeHuntMetaCheckpoint(huntId, patch) — the loop-side
// writer. It merges the patch over the meta AS IT EXISTS AT WRITE TIME
// and preserves an owner-set hold (paused/stopped: state, paused,
// stopped, pausedReason) no matter what the patch says. All loop-side
// writers (checkpoint, loop-start, recon persist, mid-iteration meta
// updates, circuit-breaker pause, finished/failed, human-mode session
// checkpoint) go through it; lifecycle owners keep plain writeHuntMeta.
//
// Proves: (1) the exact race sequence — pause during an in-flight
// iteration, then the loop checkpoint — leaves the hunt paused while
// still recording progress; (2) the boot-resume consequence is closed
// (resumeInterruptedHunt refuses and does NOT clear the flags);
// (3) stop is equally protected, including against a late 'finished'
// write; (4) the normal paths are unchanged — owner resume works, the
// loop's own circuit-breaker pause works, an un-held checkpoint applies
// state:'running'; (5) a human-mode session checkpoint after a
// mid-session pause preserves the hold; (6) plain writeHuntMeta keeps
// its full-replace contract.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-pause-race-'));
process.env.DATA_DIR = tmp;

const store = await import('../src/store.js');
const ha = await import('../src/huntAgent.js');
const { humanIteration } = await import('../src/humanLoop.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

// Writers exactly as the production code issues them.
const ownerPause = (id) =>
  store.writeHuntMeta(id, { ...(store.readHuntMeta(id) || {}), paused: true, state: 'paused' }); // routes/hunts.js pause
const ownerStop = (id) =>
  store.writeHuntMeta(id, { ...(store.readHuntMeta(id) || {}), stopped: true, paused: false, state: 'stopped' }); // routes/hunts.js stop
const ownerResume = (id) =>
  store.writeHuntMeta(id, { ...(store.readHuntMeta(id) || {}), paused: false, stopped: false, state: 'running' }); // routes/hunts.js resume
const loopCheckpoint = (id, i) =>
  store.writeHuntMetaCheckpoint(id, { iteration: i, phase: 'hunting', state: 'running', checkpointAt: new Date().toISOString() }); // huntAgent.js loop checkpoint

// — isHeldMeta corners —
check('isHeldMeta: null -> false', store.isHeldMeta(null) === false);
check('isHeldMeta: running -> false', store.isHeldMeta({ state: 'running' }) === false);
check('isHeldMeta: finished -> false', store.isHeldMeta({ state: 'finished' }) === false);
check('isHeldMeta: state paused -> true', store.isHeldMeta({ state: 'paused' }) === true);
check('isHeldMeta: paused flag -> true', store.isHeldMeta({ state: 'running', paused: true }) === true);
check('isHeldMeta: stopped flag -> true', store.isHeldMeta({ stopped: true }) === true);

// — (1) THE RACE: pause lands mid-iteration; the next checkpoint must not stomp it —
const H = 'h_race_main';
store.writeHuntMeta(H, {
  huntId: H, state: 'running', iteration: 41, target: 'http://127.0.0.1:9', userId: 'u1',
  humanLoop: { sessions: 3, turnsTotal: 17 },
});
const inflightSnapshot = store.readHuntMeta(H); // what the in-flight iteration read before its long LLM call
check('setup: snapshot is the running meta', inflightSnapshot.state === 'running' && inflightSnapshot.iteration === 41);
ownerPause(H); // owner pauses while iteration 41 is still executing
loopCheckpoint(H, 42); // iteration returns; loop-top checkpoint for iteration 42 fires
const afterRace = store.readHuntMeta(H);
check('race: state stays paused after checkpoint', afterRace.state === 'paused');
check('race: paused flag survives checkpoint', afterRace.paused === true);
check('race: checkpoint progress still recorded (iteration)', afterRace.iteration === 42);
check('race: checkpoint progress still recorded (checkpointAt)', typeof afterRace.checkpointAt === 'string');
check('race: unrelated meta fields preserved (humanLoop)', afterRace.humanLoop && afterRace.humanLoop.turnsTotal === 17);

// — (2) boot-resume consequence closed: a paused hunt is NOT an interrupted-running hunt —
const resumeResult = await ha.resumeInterruptedHunt(H);
check('boot-resume: refuses a paused hunt', resumeResult === false);
const afterBootScan = store.readHuntMeta(H);
check('boot-resume: pause flags NOT cleared', afterBootScan.paused === true && afterBootScan.state === 'paused');

// — (3) stop is protected too, including against a late terminal write —
const HS = 'h_race_stop';
store.writeHuntMeta(HS, { huntId: HS, state: 'running', iteration: 9, target: 'http://127.0.0.1:9' });
ownerStop(HS);
loopCheckpoint(HS, 10);
let mStop = store.readHuntMeta(HS);
check('stop: checkpoint cannot resurrect (state)', mStop.state === 'stopped');
check('stop: checkpoint cannot resurrect (flag)', mStop.stopped === true);
store.writeHuntMetaCheckpoint(HS, { state: 'finished' }); // loop's final write after breaking on isStopped
mStop = store.readHuntMeta(HS);
check('stop: late finished write cannot overwrite stopped', mStop.state === 'stopped' && mStop.stopped === true);

// — (4) normal paths unchanged —
ownerResume(H); // lifecycle owner clears the hold with plain writeHuntMeta
loopCheckpoint(H, 43);
const afterResume = store.readHuntMeta(H);
check('resume: hold cleared by owner write', afterResume.paused === false && afterResume.state === 'running');
check('resume: checkpoint applies running again', afterResume.state === 'running' && afterResume.iteration === 43);

const HB = 'h_race_breaker';
store.writeHuntMeta(HB, { huntId: HB, state: 'running', iteration: 5, target: 'http://127.0.0.1:9' });
store.writeHuntMetaCheckpoint(HB, { state: 'paused', pausedReason: 'ai_no_reply' }); // circuit-breaker pause write
const mBreaker = store.readHuntMeta(HB);
check('circuit-breaker: loop can still pause an un-held hunt', mBreaker.state === 'paused' && mBreaker.pausedReason === 'ai_no_reply');

const HF = 'h_race_flagonly';
store.writeHuntMeta(HF, { huntId: HF, state: 'running', paused: true, iteration: 3, target: 'http://127.0.0.1:9' }); // artefact shape the old bug produced
loopCheckpoint(HF, 4);
const mFlag = store.readHuntMeta(HF);
check('flag-only hold: state normalized to paused, flag kept', mFlag.state === 'paused' && mFlag.paused === true && mFlag.iteration === 4);

// — stale-snapshot class: a mid-iteration patch merges over write-time meta —
const HM = 'h_race_merge';
store.writeHuntMeta(HM, { huntId: HM, state: 'running', iteration: 7, target: 'http://127.0.0.1:9', variantSweep: { backfilled: true, classes: [] } });
store.readHuntMeta(HM); // iteration's snapshot (would have been spread back wholesale before the fix)
ownerPause(HM);
store.writeHuntMeta(HM, { ...(store.readHuntMeta(HM) || {}), pausedBy: 'owner' }); // a field set after the snapshot
store.writeHuntMetaCheckpoint(HM, { variantSweep: { backfilled: true, classes: ['sqli'] } }); // mid-iteration patch
const mMerge = store.readHuntMeta(HM);
check('merge: patch field applied', mMerge.variantSweep && mMerge.variantSweep.classes.includes('sqli'));
check('merge: post-snapshot field survives (no stale spread)', mMerge.pausedBy === 'owner');
check('merge: hold survives the patch', mMerge.state === 'paused' && mMerge.paused === true);

// — (5) human-mode session checkpoint after a mid-session pause —
const HH = 'h_race_human';
store.writeHuntMeta(HH, {
  huntId: HH, state: 'paused', paused: true, target: 'http://target.test',
  humanLoop: { sessions: 1, turnsTotal: 6, lastTurnAt: '2026-10-20T00:00:00.000Z' },
});
let chatCalls = 0;
const hRes = await humanIteration(HH, 'http://target.test', {
  turns: 6,
  findings: [],
  deps: {
    chat: async () => { chatCalls++; return '{"action":"note","text":"should never run"}'; },
    execRaw: async () => ({ stdout: '/root', stderr: '', code: 0 }),
    record: () => {},
    recordNote: () => {},
    buildBriefing: async () => '',
    assess: null,
    // readMeta / writeMeta intentionally NOT injected: the real store
    // defaults (incl. the guarded checkpoint writer) are under test.
  },
});
check('human: paused session runs no turns', hRes.turnsRun === 0 && chatCalls === 0);
const mHuman = store.readHuntMeta(HH);
check('human: session checkpoint preserves paused state', mHuman.state === 'paused' && mHuman.paused === true);
check('human: session checkpoint still recorded totals', mHuman.humanLoop && mHuman.humanLoop.sessions === 2 && mHuman.humanLoop.turnsTotal === 6);

// — (6) plain writeHuntMeta contract unchanged (lifecycle owners keep full control) —
store.writeHuntMeta('h_race_plain', { huntId: 'h_race_plain', state: 'running', dropMe: 1 });
store.writeHuntMeta('h_race_plain', { huntId: 'h_race_plain', state: 'paused', paused: true });
const mPlain = store.readHuntMeta('h_race_plain');
check('plain writer: still a full replace', mPlain.dropMe === undefined && mPlain.state === 'paused');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
