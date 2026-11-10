// PLUGIN-SALT tests (#402 follow-up, 10 Nov 2026).
//
// The passphrase-stretching salt lives at DATA_DIR/.plugin-salt. These
// tests pin the contract loadOrGenerateSalt() must keep:
//
//   * A zero-length (or whitespace-only) salt file is treated as missing:
//     it is removed, a real salt is generated and persisted, and boot
//     emits no "could NOT be persisted" warning.
//   * The derived key is stable across boots: a secret encrypted by one
//     boot decrypts under the next, because the salt on disk is the same.
//   * A valid persisted salt is never overwritten.
//   * When the salt genuinely cannot be persisted, the key IS ephemeral:
//     isEphemeralMasterKey() reports true, boot warns, and a secret
//     encrypted by one boot does not decrypt under the next.
//
// The master key resolves at import time from DATA_DIR +
// PLUGIN_MASTER_KEY, so both are set before the first import and every
// scenario re-imports the module with a cache-busting query to re-run
// that resolution against the current salt file. Tests in this file run
// sequentially and share one temp DATA_DIR.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-salt-'));
const dataDir = path.join(tmpRoot, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const saltFile = path.join(dataDir, '.plugin-salt');

process.env.DATA_DIR = dataDir;
process.env.PLUGIN_MASTER_KEY = 'test-passphrase-for-salt-tests';

let importSeq = 0;

async function freshCrypto() {
  return import(`./crypto.js?run=${++importSeq}`);
}

// Imports the module with console.warn captured, so boot warnings are
// assertions rather than noise in the suite log.
async function importWithWarnings() {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => { warnings.push(args.join(' ')); };
  try {
    return { mod: await freshCrypto(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function readSalt() {
  return fs.readFileSync(saltFile, 'utf8');
}

function assertValidSaltFile() {
  assert.match(readSalt(), /^[0-9a-f]{32}$/);
  assert.equal(fs.statSync(saltFile).mode & 0o777, 0o600);
}

test('a 0-byte .plugin-salt is treated as missing: cleaned up, persisted, no warning', async () => {
  fs.writeFileSync(saltFile, '');
  const { mod, warnings } = await importWithWarnings();

  assert.deepEqual(warnings, []);
  assert.equal(mod.isEphemeralMasterKey(), false);
  assertValidSaltFile();
  const saltAfterFirstBoot = readSalt();

  // The key must survive a reboot: a secret encrypted by the first boot
  // decrypts under a second boot reading the same salt file.
  const envelope = mod.encryptSecret('plugin-key-1');
  const { mod: secondBoot, warnings: secondWarnings } = await importWithWarnings();
  assert.deepEqual(secondWarnings, []);
  assert.equal(readSalt(), saltAfterFirstBoot);
  assert.equal(secondBoot.decryptSecret(envelope), 'plugin-key-1');
  assert.equal(secondBoot.isEphemeralMasterKey(), false);
});

test('a whitespace-only .plugin-salt is treated as missing too', async () => {
  const previousSalt = readSalt();
  fs.writeFileSync(saltFile, '  \n\t\n');
  const { mod, warnings } = await importWithWarnings();

  assert.deepEqual(warnings, []);
  assert.equal(mod.isEphemeralMasterKey(), false);
  assertValidSaltFile();
  assert.notEqual(readSalt(), previousSalt);
});

test('a valid persisted salt is never overwritten', async () => {
  const saltBefore = readSalt();
  const mtimeBefore = fs.statSync(saltFile).mtimeMs;
  const { mod, warnings } = await importWithWarnings();

  assert.deepEqual(warnings, []);
  assert.equal(readSalt(), saltBefore);
  assert.equal(fs.statSync(saltFile).mtimeMs, mtimeBefore);
  const envelope = mod.encryptSecret('plugin-key-2');
  const { mod: nextBoot } = await importWithWarnings();
  assert.equal(nextBoot.decryptSecret(envelope), 'plugin-key-2');
});

test('an unpersistable salt is honestly ephemeral: warns, reports true, key does not survive a reboot', async () => {
  fs.rmSync(saltFile);
  fs.mkdirSync(saltFile); // a directory where the salt file should be
  const { mod, warnings } = await importWithWarnings();

  assert.match(warnings.join('\n'), /could NOT be persisted/);
  assert.equal(mod.isEphemeralMasterKey(), true);
  const envelope = mod.encryptSecret('plugin-key-3');
  assert.equal(mod.decryptSecret(envelope), 'plugin-key-3');

  // A fresh boot derives a different key from a new random salt, so
  // the previous boot's ciphertext is unreadable — that is what
  // "ephemeral" means, and it must be reported as such.
  const { mod: nextBoot, warnings: nextWarnings } = await importWithWarnings();
  assert.match(nextWarnings.join('\n'), /could NOT be persisted/);
  assert.equal(nextBoot.isEphemeralMasterKey(), true);
  assert.throws(() => nextBoot.decryptSecret(envelope));
});
