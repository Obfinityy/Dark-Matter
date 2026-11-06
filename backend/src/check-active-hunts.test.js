// Lane deploy-workflow (6 Nov 2026) — the restart gate over-counted.
//
// Root cause: check-active-hunts.mjs counted 'paused' (plus 'created' /
// 'starting') as blocking, so with 10 paused hunts on EC2 the workflow
// SKIPPED the restart on EVERY deploy, and the SKIP path's one-shot health
// check then raced the manual restart the SKIP forced (runs 42217388113 +
// 42218258225, both red on that curl in the same second as the restart).
// The fix: the gate calls store.js countRunningHunts() — 'running' only,
// the same rule the queue already uses (20 Oct 2026).
//
// These tests spawn the script as a subprocess with DATA_DIR pointed at a
// temp dir, so nothing can touch the real backend/data tree.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(backendDir, 'scripts', 'check-active-hunts.mjs');

function seedMetas(tmpRoot, states) {
  const huntsDir = path.join(tmpRoot, 'hunts');
  states.forEach(([id, state], i) => {
    const dir = path.join(huntsDir, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
      id,
      state,
      createdAt: `2026-11-0${1 + (i % 5)}T00:00:00.000Z`,
    }));
  });
}

async function runGate(tmpRoot) {
  const { stdout } = await execFileAsync(process.execPath, [script], {
    env: { ...process.env, DATA_DIR: tmpRoot },
    cwd: backendDir,
    timeout: 15000,
  });
  return stdout.trim();
}

test('gate counts only running hunts (mixed census)', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  seedMetas(tmpRoot, [
    ['h_run1', 'running'],
    ['h_p1', 'paused'], ['h_p2', 'paused'],
    ['h_c1', 'created'], ['h_s1', 'starting'],
    ['h_stop', 'stopped'], ['h_fin', 'finished'], ['h_fail', 'failed'],
  ]);
  assert.equal(await runGate(tmpRoot), '1');
  // Seeded metas live only under tmp — the real tree is never touched.
  assert.equal(fs.existsSync(path.join(backendDir, 'data', 'hunts', 'h_run1')), false);
});

test('gate prints 0 for the live EC2 shape: 10 paused, 0 running', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  seedMetas(tmpRoot, Array.from({ length: 10 }, (_, i) => [`h_paused_${i}`, 'paused']));
  assert.equal(await runGate(tmpRoot), '0');
});

test('gate prints 0 with no hunts at all', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  assert.equal(await runGate(tmpRoot), '0');
});

test('gate counts every running hunt', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  seedMetas(tmpRoot, [['h_r1', 'running'], ['h_r2', 'running'], ['h_p', 'paused']]);
  assert.equal(await runGate(tmpRoot), '2');
});
