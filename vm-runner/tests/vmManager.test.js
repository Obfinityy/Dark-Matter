import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import {
  VmManager,
  validateSessionId,
  pidAlive,
  resolveVmHome,
} from '../src/vmManager.js';

let home;
before(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), 'vm-mgr-test-'));
});

const mgr = () =>
  new VmManager({
    vmHome: home,
    qemuPath: null,
    accel: null,
    getGoldenImagePath: async () => path.join(home, 'images', 'kali.qcow2'),
  });

describe('session id validation', () => {
  it('accepts valid ids', () => {
    assert.equal(validateSessionId('abc-123_XYZ'), 'abc-123_XYZ');
  });
  it('rejects invalid ids', () => {
    for (const bad of ['', '../x', 'a/b', 'x'.repeat(65), 'has space']) {
      assert.throws(() => validateSessionId(bad), /sessionId must be/, bad);
    }
  });
});

describe('pidAlive', () => {
  it('detects the current process as alive', () => {
    assert.equal(pidAlive(process.pid), true);
  });
  it('treats bogus pids as dead', () => {
    assert.equal(pidAlive(0), false);
    assert.equal(pidAlive(-1), false);
    assert.equal(pidAlive(2147483647), false);
  });
});

describe('resolveVmHome', () => {
  it('honors the env override', () => {
    process.env.INFINITY_VM_RUNNER_HOME = '/tmp/custom-vm-home';
    assert.equal(resolveVmHome(), '/tmp/custom-vm-home');
    delete process.env.INFINITY_VM_RUNNER_HOME;
  });
});

describe('VmManager without QEMU', () => {
  it('start() fails with qemu_missing when QEMU is absent', async () => {
    await assert.rejects(() => mgr().start({ sessionId: 's1' }), /qemu_missing/);
  });

  it('status() of an unknown session reports stopped', async () => {
    const st = await mgr().status('no-such-session');
    assert.equal(st.state, 'stopped');
    assert.equal(st.pid, null);
  });

  it('stop() of an unknown session is a no-op success', async () => {
    assert.deepEqual(await mgr().stop('no-such-session'), { ok: true });
  });

  it('getSession returns null for unknown sessions', async () => {
    assert.equal(await mgr().getSession('no-such-session'), null);
  });
});
