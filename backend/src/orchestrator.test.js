// Orchestrator findings persistence (zero-genuine lane, 27 Oct 2026).
//
// Asserted here (hunt meta under a tmp DATA_DIR, no network, no Meta):
//   - (e) A fresh orchestrator's saveState() NEVER wipes persisted
//     findings: meta.json orchestrator.findings went 2 → 0 live
//     (21:19 → 21:28 IST) because a fresh instance persisted its
//     empty in-memory list over the stored one. saveState now
//     MERGES (union, deduped by title+url) via the guarded
//     checkpoint writer.
//   - The merge is a union: persisted + new findings both survive;
//     the same finding twice dedupes to one.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR must be set BEFORE store/config is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-orch-'));
process.env.DATA_DIR = tmpRoot;

const { mergeOrchestratorState, HuntOrchestrator } = await import('./orchestrator.js');
const { readHuntMeta, writeHuntMetaCheckpoint } = await import('./store.js');

const F1 = { title: 'Reflected XSS via search', url: 'http://172.17.0.1:3100/vulnerabilities/xss_r/', verified: true };
const F2 = { title: 'SQLi on login', url: 'http://172.17.0.1:3100/login.php', verified: true };
const F3 = { title: 'Command injection', url: 'http://172.17.0.1:3100/vulnerabilities/exec/', verified: true };

test('merge is a union that never drops persisted findings', () => {
  const merged = mergeOrchestratorState(
    { missions: [], findings: [F1, F2] },
    { missions: [], findings: [] },
  );
  assert.deepEqual(merged.findings, [F1, F2]);
  const withNew = mergeOrchestratorState(
    { missions: [], findings: [F1, F2] },
    { missions: [], findings: [F2, F3] },
  );
  assert.equal(withNew.findings.length, 3);
  assert.deepEqual(withNew.findings, [F1, F2, F3]);
  assert.deepEqual(mergeOrchestratorState(null, null).findings, []);
  assert.deepEqual(mergeOrchestratorState(undefined, { findings: [F1] }).findings, [F1]);
});

test('a fresh orchestrator saveState keeps persisted findings and adds its own', () => {
  const huntId = 'h_save_loss';
  writeHuntMetaCheckpoint(huntId, {
    target: 'http://172.17.0.1:3100/',
    orchestrator: { missions: [], findings: [F1, F2] },
  });
  const head = new HuntOrchestrator(huntId, 'http://172.17.0.1:3100/');
  assert.deepEqual(head.findings, []);
  head.findings.push(F3);
  head.saveState();
  const meta = readHuntMeta(huntId);
  assert.equal(meta.orchestrator.findings.length, 3);
  assert.deepEqual(
    meta.orchestrator.findings.map((f) => f.title),
    [F1.title, F2.title, F3.title],
  );
  // A second fresh instance with nothing new still keeps all three.
  const head2 = new HuntOrchestrator(huntId, 'http://172.17.0.1:3100/');
  head2.saveState();
  assert.equal(readHuntMeta(huntId).orchestrator.findings.length, 3);
});
