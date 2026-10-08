import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertQemuSafePath,
  buildQemuArgs,
  cpuFlagForAccel,
  detectAccel,
} from '../src/qemu.js';

const baseOpts = {
  accel: 'whpx',
  sessionId: 'sess-1',
  sessionDir: 'C:/Users/test/DarkMatter/vm/sessions/sess-1',
  goldenImagePath: 'C:/Users/test/DarkMatter/vm/images/kali.qcow2',
  overlayPath: 'C:/Users/test/DarkMatter/vm/sessions/sess-1/overlay.qcow2',
  cpus: 2,
  memoryMiB: 2048,
  guestPort: 14101,
  vncPort: 5910,
  sessionToken: 'test-token',
  serialLogPath: 'C:/Users/test/DarkMatter/vm/sessions/sess-1/serial.log',
};

describe('qemu args builder', () => {
  it('builds the expected WHPX command line', () => {
    const args = buildQemuArgs(baseOpts);
    assert.ok(args.includes('-accel') && args[args.indexOf('-accel') + 1] === 'whpx');
    const cpuIdx = args.indexOf('-cpu');
    assert.equal(args[cpuIdx + 1], 'host,-vmx,-svm');
    const driveIdx = args.indexOf('-drive');
    assert.match(args[driveIdx + 1], /file=.*overlay\.qcow2,if=virtio,format=qcow2/);
    const netdevIdx = args.indexOf('-netdev');
    assert.match(args[netdevIdx + 1], /hostfwd=tcp:127\.0\.0\.1:14101-:1024/);
    const vncIdx = args.indexOf('-vnc');
    assert.equal(args[vncIdx + 1], '127.0.0.1:10'); // 5910 - 5900
    const fwIdx = args.indexOf('-fw_cfg');
    assert.equal(args[fwIdx + 1], 'name=opt/infinity/session-token,string=test-token');
  });

  it('uses plain host cpu flag for KVM', () => {
    const args = buildQemuArgs({ ...baseOpts, accel: 'kvm' });
    assert.equal(args[args.indexOf('-cpu') + 1], 'host');
  });

  it('rejects missing accelerator and bad ports', () => {
    assert.throws(() => buildQemuArgs({ ...baseOpts, accel: null }), /accel is required/);
    assert.throws(() => buildQemuArgs({ ...baseOpts, guestPort: 0 }), /valid guestPort/);
    assert.throws(() => buildQemuArgs({ ...baseOpts, vncPort: 6000 }), /VNC range/);
  });
});

describe('qemu path safety', () => {
  it('accepts plain ASCII paths', () => {
    assert.equal(assertQemuSafePath('C:/Users/test/vm'), 'C:/Users/test/vm');
  });

  it('rejects non-ASCII paths with a remediation hint', () => {
    assert.throws(
      () => assertQemuSafePath('C:/Users/tëst/vm'),
      /non-ASCII.*INFINITY_VM_RUNNER_HOME/s,
    );
  });

  it('rejects paths containing commas', () => {
    assert.throws(() => assertQemuSafePath('C:/Users/a,b/vm'), /comma/);
  });
});

describe('cpu flags', () => {
  it('returns the WHPX workaround flag', () => {
    assert.equal(cpuFlagForAccel('whpx'), 'host,-vmx,-svm');
  });
  it('returns host for kvm', () => {
    assert.equal(cpuFlagForAccel('kvm'), 'host');
  });
  it('throws for unknown accelerators', () => {
    assert.throws(() => cpuFlagForAccel('tcg'), /unsupported accelerator/);
  });
});

describe('accel detection', () => {
  it('returns null on unsupported platforms', async () => {
    assert.equal(await detectAccel('darwin'), null);
  });
  it('does not throw on linux without /dev/kvm in odd environments', async () => {
    const accel = await detectAccel('linux');
    assert.ok(accel === 'kvm' || accel === null);
  });
});
