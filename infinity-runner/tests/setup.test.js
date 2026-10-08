/**
 * setup.test.js — first-time provisioning (fake doctor/fetch/spawn, temp dirs).
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

const setup = require('../main/setup.js');

function doctorFetch(overrides = {}) {
  const doctor = {
    vmHome: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vmhome-'))),
    qemuPath: null,
    accel: null,
    kaliImage: { present: false },
    problems: [],
    ...overrides,
  };
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (url.endsWith('/doctor')) return { ok: true, json: async () => doctor };
    throw new Error('unexpected url ' + url);
  };
  return { fetchImpl, doctor, get calls() { return calls; } };
}

test('readiness(): reports per-step status from /doctor', async () => {
  const { fetchImpl } = doctorFetch({
    qemuPath: 'C:\\Program Files\\qemu\\qemu-system-x86_64.exe',
    accel: 'whpx',
    kaliImage: { present: true, bytes: 3_500_000_000 },
  });
  const r = await setup.readiness({ fetchImpl });
  assert.deepEqual(r.steps.map((s) => s.status), ['ready', 'ready', 'ready']);
  assert.equal(r.qemuMissing, false);

  const missing = doctorFetch();
  const r2 = await setup.readiness({ fetchImpl: missing.fetchImpl });
  assert.deepEqual(r2.steps.map((s) => s.status), ['missing', 'action-needed', 'missing']);
  assert.equal(r2.kaliMissing, true);
});

test('ensureQemu(): skips install when QEMU already present', async () => {
  const { fetchImpl } = doctorFetch({ qemuPath: '/usr/bin/qemu-system-x86_64' });
  let spawned = false;
  const r = await setup.ensureQemu({ fetchImpl, spawnImpl: async () => { spawned = true; } });
  assert.equal(r.ok, true);
  assert.equal(spawned, false);
});

test('ensureQemu(): installs via winget on Windows when missing', async () => {
  const d = doctorFetch();
  const cmds = [];
  const spawnImpl = async (cmd, args) => {
    cmds.push([cmd, args]);
    d.doctor.qemuPath = 'C:\\Program Files\\qemu\\qemu-system-x86_64.exe'; // install "worked"
  };
  const r = await setup.ensureQemu({ fetchImpl: d.fetchImpl, spawnImpl, platform: 'win32' });
  assert.equal(r.ok, true);
  assert.equal(cmds[0][0], 'winget');
  assert.ok(cmds[0][1].includes('SoftwareFreedomConservancy.QEMU'));
});

test('ensureQemu(): falls back to a manual link when winget fails', async () => {
  const { fetchImpl } = doctorFetch();
  const r = await setup.ensureQemu({
    fetchImpl,
    spawnImpl: async () => { throw new Error('winget not found'); },
    platform: 'win32',
  });
  assert.equal(r.ok, false);
  assert.ok(r.manualUrl.includes('qemu.org'));
});

test('whpxEnableArgv(): returns an elevated PowerShell command', () => {
  const { command, args } = setup.whpxEnableArgv();
  assert.equal(command, 'powershell.exe');
  assert.ok(args.join(' ').includes('HypervisorPlatform'));
  assert.ok(args.join(' ').includes('RunAs'));
});

function fakeResourcesDir(sha256) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'res-'));
  const imgDir = path.join(dir, 'vm-runner', 'images');
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(imgDir, 'kali.json'), JSON.stringify({
    url: 'https://example.test/kali.7z',
    sha256,
    fileName: 'kali-test.7z',
    innerImage: 'kali-test.qcow2',
  }));
  return dir;
}

function downloadFetch(bytes) {
  return async (url) => {
    if (url.endsWith('/doctor')) {
      return { ok: true, json: async () => ({ vmHome: global.__vmHome, kaliImage: { present: false }, problems: [] }) };
    }
    const stream = Readable.from([bytes]);
    return {
      ok: true,
      headers: { get: (h) => (h === 'content-length' ? String(bytes.length) : null) },
      body: stream,
    };
  };
}

test('ensureKaliImage(): skips when already present', async () => {
  const { fetchImpl } = doctorFetch({ kaliImage: { present: true } });
  const r = await setup.ensureKaliImage({ fetchImpl, resourcesDir: fakeResourcesDir('x') });
  assert.equal(r.alreadyPresent, true);
});

test('ensureKaliImage(): downloads, verifies, extracts, cleans up', async () => {
  const payload = Buffer.from('fake-kali-bytes');
  const sha = crypto.createHash('sha256').update(payload).digest('hex');
  const resourcesDir = fakeResourcesDir(sha);
  global.__vmHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vmhome-'));
  const spawns = [];
  const spawnImpl = async (cmd, args) => {
    spawns.push([cmd, args]);
    // fake 7za: write the inner image
    const imagesDir = path.join(global.__vmHome, 'images');
    fs.writeFileSync(path.join(imagesDir, 'kali-test.qcow2'), 'fake-qcow2');
  };
  const progress = [];
  const r = await setup.ensureKaliImage({
    fetchImpl: downloadFetch(payload),
    resourcesDir,
    sevenZipPath: '/fake/7za',
    spawnImpl,
    onProgress: (p) => progress.push(p),
  });
  assert.equal(r.ok, true);
  assert.ok(fs.existsSync(path.join(global.__vmHome, 'images', 'kali-test.qcow2')));
  assert.ok(!fs.existsSync(path.join(global.__vmHome, 'images', 'kali-test.7z')), 'archive cleaned up');
  assert.ok(spawns.length === 1 && spawns[0][0] === '/fake/7za');
  assert.ok(progress.some((p) => p.status === 'downloading'));
  assert.ok(progress.some((p) => p.status === 'done'));
});

test('ensureKaliImage(): rejects a tampered download (SHA256 mismatch)', async () => {
  const resourcesDir = fakeResourcesDir('0'.repeat(64)); // wrong hash on purpose
  global.__vmHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vmhome-'));
  await assert.rejects(
    () => setup.ensureKaliImage({
      fetchImpl: downloadFetch(Buffer.from('tampered')),
      resourcesDir,
      sevenZipPath: '/fake/7za',
      spawnImpl: async () => {},
    }),
    /SHA256 mismatch/
  );
  assert.ok(!fs.existsSync(path.join(global.__vmHome, 'images', 'kali-test.7z')), 'bad archive removed');
});
