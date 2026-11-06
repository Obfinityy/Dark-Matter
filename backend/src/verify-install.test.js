// Lane @smithy first-start (6 Nov 2026) — install verification guard.
//
// 8db79ede deploy: a restart landed inside `npm ci`'s reinstall window
// and the first backend start died on `Cannot find module
// '@smithy/core/retry'`. verify-install.mjs is the fail-closed layer that
// proves the tree about to go live actually resolves and loads, before
// any restart happens.
//
// These tests spawn the script as a subprocess against fixture backend
// dirs (a minimal package.json + stub node_modules), so nothing can touch
// the real backend tree — except the one test that verifies the real
// tree itself, which only reads it.

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
const script = path.join(backendDir, 'scripts', 'verify-install.mjs');

function writePkg(dir, name, main = 'index.js') {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', main }));
  fs.writeFileSync(path.join(dir, main), 'module.exports = {};\n');
}

// Fixture backend: one direct dep + stub node_modules for the script's
// pinned extra list (@aws-sdk clients + @smithy/core/retry). The stubs
// are loadable CJS modules, so the script's import check exercises them
// exactly like the real packages.
function fixtureBackend({ withSmithyRetry = true, missingDep = null } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-install-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
    name: 'fixture-backend',
    version: '1.0.0',
    dependencies: { 'fixture-dep': '^1.0.0' },
  }));
  const nm = path.join(tmp, 'node_modules');
  if (missingDep !== 'fixture-dep') writePkg(path.join(nm, 'fixture-dep'), 'fixture-dep');
  writePkg(path.join(nm, '@aws-sdk', 'client-bedrock-runtime'), '@aws-sdk/client-bedrock-runtime');
  writePkg(path.join(nm, '@aws-sdk', 'client-sagemaker-runtime'), '@aws-sdk/client-sagemaker-runtime');
  const core = path.join(nm, '@smithy', 'core');
  writePkg(core, '@smithy/core');
  if (withSmithyRetry) fs.writeFileSync(path.join(core, 'retry.js'), 'module.exports = {};\n');
  return tmp;
}

async function runVerify(dir) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [script, dir], { timeout: 15000 });
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.code, out: (err.stdout || '') + (err.stderr || '') };
  }
}

test('VI-1: complete fixture tree verifies (exit 0)', async () => {
  const dir = fixtureBackend();
  const r = await runVerify(dir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /OK/);
});

test('VI-2: a missing production dep fails closed and names it', async () => {
  const dir = fixtureBackend({ missingDep: 'fixture-dep' });
  const r = await runVerify(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /fixture-dep/);
});

test('VI-3: @smithy/core without its retry subpath fails closed (the 8db79ede shape)', async () => {
  const dir = fixtureBackend({ withSmithyRetry: false });
  const r = await runVerify(dir);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /@smithy\/core\/retry/);
});

test('VI-4: the real backend tree verifies (read-only)', async () => {
  const r = await runVerify(backendDir);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /OK/);
});

test('VI-5: unreadable backend dir exits 2 (usage error, not a silent pass)', async () => {
  const r = await runVerify(path.join(os.tmpdir(), 'verify-install-does-not-exist'));
  assert.equal(r.code, 2, r.out);
});
