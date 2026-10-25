// Driver-lock tests.
//
// 25 Oct 2026, ~21:30 IST — the Infomaniak hunt sat idle ~2h at iter 74
// while the backend stayed up: every driver attempt was refused with
// "Loop driver already active ... (cross-process lock: lost race for
// fresh lock)" (125 refusals). The live driver.lock was 0 BYTES, and
// tryAcquireDriverLock() treated an unparseable lock as free but then
// called writeExclusive() with flag 'wx' — which FAILS with EEXIST
// when the file already exists, even an empty one. A 0-byte/corrupt
// lock was therefore a PERMANENT poison pill: no driver could ever
// acquire it again, through any number of backend restarts. The fix
// unlinks the unparseable file first, mirroring the steal path.
//
// These tests run the ACTUAL tryAcquireDriverLock against real lock
// files in a temp DATA_DIR (no mocks of the lock logic).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

// DATA_DIR must be set BEFORE huntAgent (via store/config) is imported.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-driver-lock-'));
process.env.DATA_DIR = tmpRoot;
const { tryAcquireDriverLock, releaseDriverLock } = await import('./huntAgent.js');

const lockPath = (huntId) => path.join(tmpRoot, 'hunts', huntId, 'driver.lock');
const writeLock = (huntId, content) => {
  fs.mkdirSync(path.dirname(lockPath(huntId)), { recursive: true });
  fs.writeFileSync(lockPath(huntId), content);
};
const readLock = (huntId) => JSON.parse(fs.readFileSync(lockPath(huntId), 'utf8'));

// A pid that is certainly dead: spawn a child, kill it, wait for exit.
async function deadPid() {
  const child = spawn(process.execPath, ['-e', 'setTimeout(()=>{},60000)'], {
    stdio: 'ignore',
  });
  const pid = child.pid;
  child.kill('SIGKILL');
  await new Promise((resolve) => child.once('exit', resolve));
  assert.throws(() => process.kill(pid, 0), 'pid must be dead before use');
  return pid;
}

test('no lock file: acquire succeeds and writes our pid', () => {
  const r = tryAcquireDriverLock('h-no-lock');
  assert.equal(r.ok, true);
  assert.equal(readLock('h-no-lock').pid, process.pid);
  releaseDriverLock('h-no-lock');
  assert.equal(fs.existsSync(lockPath('h-no-lock')), false);
});

test('REGRESSION (25 Oct stall): 0-byte driver.lock can be acquired', () => {
  writeLock('h-empty', '');
  const r = tryAcquireDriverLock('h-empty');
  assert.equal(r.ok, true, `0-byte lock must be acquirable, got ${JSON.stringify(r)}`);
  assert.equal(readLock('h-empty').pid, process.pid);
  releaseDriverLock('h-empty');
});

test('corrupt non-JSON driver.lock can be acquired', () => {
  writeLock('h-corrupt', '{not json,,,');
  const r = tryAcquireDriverLock('h-corrupt');
  assert.equal(r.ok, true, `corrupt lock must be acquirable, got ${JSON.stringify(r)}`);
  assert.equal(readLock('h-corrupt').pid, process.pid);
  releaseDriverLock('h-corrupt');
});

test('valid lock, live pid + fresh heartbeat: still REFUSED (mutex intact)', () => {
  writeLock(
    'h-live',
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), heartbeatAt: Date.now() }),
  );
  const r = tryAcquireDriverLock('h-live');
  assert.equal(r.ok, false);
  assert.match(r.reason, /alive/);
  // The live holder's lock file must be untouched.
  assert.equal(readLock('h-live').pid, process.pid);
  assert.equal(readLock('h-live').heartbeatAt > 0, true);
});

test('valid lock, dead pid: stolen', async () => {
  const pid = await deadPid();
  writeLock(
    'h-dead',
    JSON.stringify({ pid, startedAt: new Date().toISOString(), heartbeatAt: Date.now() }),
  );
  const r = tryAcquireDriverLock('h-dead');
  assert.equal(r.ok, true);
  assert.equal(r.stole, true);
  assert.equal(readLock('h-dead').pid, process.pid);
  releaseDriverLock('h-dead');
});

test('valid lock, live pid but ancient heartbeat: stolen', () => {
  writeLock(
    'h-stale-beat',
    JSON.stringify({
      pid: process.pid,
      startedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      heartbeatAt: Date.now() - 120 * 60 * 1000, // older than the 90-min staleness bound
    }),
  );
  const r = tryAcquireDriverLock('h-stale-beat');
  assert.equal(r.ok, true);
  assert.equal(r.stole, true);
  assert.equal(readLock('h-stale-beat').pid, process.pid);
  releaseDriverLock('h-stale-beat');
});

test('acquire then release frees the lock for a second acquire', () => {
  assert.equal(tryAcquireDriverLock('h-roundtrip').ok, true);
  releaseDriverLock('h-roundtrip');
  assert.equal(fs.existsSync(lockPath('h-roundtrip')), false);
  assert.equal(tryAcquireDriverLock('h-roundtrip').ok, true);
  releaseDriverLock('h-roundtrip');
});

test.after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
