// Lane @smithy first-start (6 Nov 2026) — staged install race test.
//
// 8db79ede deploy: the workflow's `npm ci` ran 12:31:08.313–12:31:09.991 UTC
// while a manual fallback restart landed at 12:31:09; the first start died
// on `Cannot find module '@smithy/core/retry'`. `npm ci` deletes
// node_modules FIRST and then reinstalls, so ANY node start inside the
// ~2s window fails module resolution. install-deps.sh installs into a
// staging tree and swaps it in with one atomic RENAME_EXCHANGE, so the
// live tree is never observed half-built.
//
// These tests run the REAL script (and, as a control, the REAL plain
// `npm ci`) against a fixture backend dir holding the repo's actual
// package.json + package-lock.json, and probe the exact import chain that
// died on EC2 with fresh node starts while the install runs. Fixtures are
// removed afterwards so /tmp (512M tmpfs) does not fill up.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const installDeps = path.join(backendDir, 'scripts', 'install-deps.sh');

// A fresh node start resolving the exact import chain that died on EC2
// (llm.js:27 statically imports @aws-sdk/client-bedrock-runtime, whose
// @aws-sdk/core submodule requires @smithy/core/retry). The per-probe
// timeout bounds the run: one unbounded probe run during this lane's repro
// spun at ~75% CPU and never returned, cause unexplained — a probe must
// never be able to hang the test.
async function probeOnce(dir) {
  try {
    await execFileAsync(process.execPath,
      ['--input-type=module', '-e', "await import('@aws-sdk/client-bedrock-runtime')"],
      { cwd: dir, timeout: 10000 });
    return { code: 0, err: '' };
  } catch (err) {
    const stderr = (err.stderr || '').trim();
    // Keep the first few lines: the "Cannot find module/package" message
    // sits below the loader-frame line in the stack trace.
    return { code: err.code ?? 'timeout', err: stderr.split('\n').slice(0, 5).join(' ') || String(err.code ?? 'timeout') };
  }
}

async function seedFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-deps-'));
  fs.copyFileSync(path.join(backendDir, 'package.json'), path.join(dir, 'package.json'));
  fs.copyFileSync(path.join(backendDir, 'package-lock.json'), path.join(dir, 'package-lock.json'));
  // Live tree from the previous "deploy".
  await execFileAsync('npm', ['ci', '--omit=dev'], { cwd: dir, timeout: 120000 });
  const sanity = await probeOnce(dir);
  assert.equal(sanity.code, 0, `fixture tree must resolve before the test: ${sanity.err}`);
  return dir;
}

// Probe in a loop until the child exits; returns the probe tally.
async function probeWhile(child, dir) {
  let probes = 0;
  let fails = 0;
  const failures = [];
  const closed = new Promise((resolve) => child.on('close', (code) => resolve(code)));
  const deadline = Date.now() + 90000;
  while (child.exitCode === null && Date.now() < deadline && probes < 300) {
    probes += 1;
    const r = await probeOnce(dir);
    if (r.code !== 0) {
      fails += 1;
      if (failures.length < 3) failures.push(r.err);
    }
  }
  const code = await closed;
  return { probes, fails, failures, code };
}

test('ID-1: install-deps.sh keeps the tree resolvable for every node start during the install', async () => {
  const dir = await seedFixture();
  try {
    const child = spawn('bash', [installDeps, dir], { cwd: dir });
    const r = await probeWhile(child, dir);
    assert.equal(r.code, 0, 'install-deps.sh must exit 0');
    assert.ok(r.probes >= 2, `expected several probes during the install, got ${r.probes}`);
    assert.equal(r.fails, 0, `probes failed during install-deps.sh: ${r.failures.join(' | ')}`);
    // Tree is complete after the swap, and no staging leftovers remain.
    const after = await probeOnce(dir);
    assert.equal(after.code, 0, after.err);
    assert.equal(fs.existsSync(path.join(dir, '.node_modules.staging')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}, { timeout: 120000 });

test('ID-2: plain npm ci in place breaks resolution mid-install (the bug install-deps.sh fixes)', async () => {
  const dir = await seedFixture();
  try {
    const child = spawn('npm', ['ci', '--omit=dev'], { cwd: dir });
    const r = await probeWhile(child, dir);
    assert.equal(r.code, 0, 'npm ci itself must succeed');
    assert.ok(r.probes >= 2, `expected several probes during the install, got ${r.probes}`);
    // The probe loop MUST catch failures here: if it cannot, it cannot
    // prove anything about ID-1 either.
    assert.ok(r.fails > 0, 'expected probes to fail during in-place npm ci — the loop is not sensitive to the race');
    assert.match(r.failures[0], /Cannot find (package|module)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}, { timeout: 120000 });
