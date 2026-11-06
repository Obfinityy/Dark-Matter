// Lane HN (6 Nov 2026) — read-path mkdir leak (h_nope).
//
// Root cause: store.js huntDir() called ensureDir() on EVERY call, and
// every load*/read* helper in the codebase builds its file path through
// it — so a pure READ of a nonexistent hunt (a 404 negative-path check,
// an agent-chat reply, a coverage load) created hunts/<id>/ on disk.
// On 3 Nov a deploy-test lane ran negative-path tests against the LIVE
// backend and left hunts/h_nope + hunts/h_nope_does_not_exist behind;
// listArtifacts() even mkdir'd hunts/<id>/artifacts/ on read.
// The fix: huntDir() and artifactsDir() are pure path builders now;
// writers call ensureHuntDir()/ensureArtifactsDir() explicitly.
//
// DATA_DIR isolation (fixture-pollution pattern): config resolves
// dataDir at import time, so the temp dir must be set BEFORE the
// dynamic imports below. Without this, the write half of this test
// would land in the REAL backend/data tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hn-'));
process.env.DATA_DIR = tmpRoot;

const { config } = await import('./config.js');
const { readHuntMeta, readHuntEvents, writeHuntMeta, appendHuntEvent, huntDir } = await import('./store.js');
const { loadHuntPlan, saveHuntPlan, emptyHuntPlan } = await import('./huntPlan.js');
const { loadOutputs, saveOutputs } = await import('./outputMemory.js');
const { loadPageState, savePageState } = await import('./pageState.js');
const { loadCoverage, saveCoverage, emptyCoverage } = await import('./coverageLedger.js');
const { readMemoryFile, readProcessFile, readOutputFile, startProcess, recordBrainOutput } = await import('./brainFiles.js');
const { pendingChatQuestions, queueChatQuestion } = await import('./chatQueue.js');
const { listArtifacts, artifactInfo, readArtifact, writeArtifact } = await import('./artifacts.js');
const { loadHuntMemory } = await import('./huntMemory.js');
const { setBrainMode } = await import('./brainMode.js');
const { isDriverActive, tryAcquireDriverLock, releaseDriverLock } = await import('./huntAgent.js');
const { recordReasoning } = await import('./reasoningMemory.js');

const NOPE = 'h_nope';
const huntsDir = path.join(tmpRoot, 'hunts');
const nopeDir = path.join(huntsDir, NOPE);

test('HN-1: pure reads of a missing hunt create no hunt dir', async () => {
  assert.equal(config.dataDir, tmpRoot, 'DATA_DIR isolation must be active in this process');
  assert.equal(fs.existsSync(huntsDir), false, 'no hunts/ dir before any read');
  assert.equal(readHuntMeta(NOPE), null);
  assert.deepEqual(readHuntEvents(NOPE), []);
  // emptyHuntPlan() stamps fresh createdAt/updatedAt per call, so the
  // empty plan is compared structurally, never with deepEqual.
  const plan = loadHuntPlan(NOPE);
  assert.deepEqual(plan.steps, []);
  assert.equal(plan.revised, 0);
  assert.equal(loadOutputs(NOPE).entries && typeof loadOutputs(NOPE).entries, 'object');
  loadPageState(NOPE);
  assert.deepEqual(loadCoverage(NOPE), emptyCoverage());
  readMemoryFile(NOPE);
  readProcessFile(NOPE);
  readOutputFile(NOPE);
  assert.deepEqual(pendingChatQuestions(NOPE), []);
  assert.deepEqual(listArtifacts(NOPE), []);
  assert.equal(artifactInfo(NOPE, 'note.txt'), null);
  assert.throws(() => readArtifact(NOPE, 'note.txt'), 'missing artifact still throws');
  assert.equal(isDriverActive(NOPE), false);
  assert.deepEqual(loadHuntMemory(NOPE).findings, []);
  assert.deepEqual(await setBrainMode(NOPE, 'parent', {}), { ok: false, error: 'hunt_not_found' });
  assert.equal(fs.existsSync(nopeDir), false, 'reads must not create hunts/h_nope');
  assert.equal(fs.existsSync(huntsDir), false, 'reads must not create hunts/ at all');
});

test('HN-2: writers still create the hunt dir and their files', () => {
  const W = 'h_writes';
  const dir = path.join(huntsDir, W);
  assert.equal(fs.existsSync(dir), false);
  writeHuntMeta(W, { huntId: W, state: 'running', target: 'http://127.0.0.1:9', iteration: 1 });
  assert.ok(fs.existsSync(path.join(dir, 'meta.json')), 'writeHuntMeta creates meta.json');
  appendHuntEvent(W, { type: 'status', state: 'created' });
  assert.ok(fs.existsSync(path.join(dir, 'events.jsonl')), 'appendHuntEvent creates events.jsonl');
  assert.equal(saveHuntPlan(W, emptyHuntPlan()), true);
  assert.ok(fs.existsSync(path.join(dir, 'huntPlan.json')), 'saveHuntPlan writes the plan');
  assert.equal(saveOutputs(W, { entries: {} }), true);
  assert.ok(fs.existsSync(path.join(dir, 'outputs.json')), 'saveOutputs writes outputs');
  assert.equal(savePageState(W, { pages: {} }), true);
  assert.ok(fs.existsSync(path.join(dir, 'pageState.json')), 'savePageState writes page state');
  assert.equal(saveCoverage(W, emptyCoverage()), true);
  assert.ok(fs.existsSync(path.join(dir, 'coverage.json')), 'saveCoverage writes coverage');
  assert.equal(queueChatQuestion(W, { chatId: 'c1', userId: 'u1', text: 'hi?' }).queued, true);
  assert.ok(fs.existsSync(path.join(dir, 'chat-queue.json')), 'queueChatQuestion writes the queue');
  startProcess(W, { task: 't', goal: 'g', progress: 'p' });
  assert.ok(fs.existsSync(path.join(dir, 'process.json')), 'startProcess writes the process file');
  recordBrainOutput(W, { hash: 'abc', title: 't', output: 'o' });
  assert.ok(fs.existsSync(path.join(dir, 'output.json')), 'recordBrainOutput writes the output file');
  recordReasoning(W, { hypothesis: 'h', action: 'a', why: 'w', result: 'r', learned: 'l' });
  assert.ok(fs.existsSync(path.join(dir, 'reasoning.jsonl')), 'recordReasoning appends reasoning');
  const wrote = writeArtifact(W, 'note.txt', 'hello');
  assert.equal(wrote.name, 'note.txt');
  assert.ok(fs.existsSync(path.join(dir, 'artifacts', 'note.txt')), 'writeArtifact creates the artifact');
  assert.deepEqual(tryAcquireDriverLock(W), { ok: true });
  assert.ok(fs.existsSync(path.join(dir, 'driver.lock')), 'tryAcquireDriverLock writes the lock');
  releaseDriverLock(W);
  // The path helper itself stays pure even after writes exist.
  assert.equal(huntDir(NOPE), path.join(tmpRoot, 'hunts', NOPE));
  assert.equal(fs.existsSync(nopeDir), false, 'the missing hunt stays absent after writes to another hunt');
});
