// Take Control of This Machine — lock + control-desktop tests.
//
// The lock is the safety core: exactly one holder per hunt, a
// double-take is rejected, a different user cannot release, an admin
// can force-release, and an abandoned lock expires. The VNC lifecycle
// is tested against injected exec fakes (no docker, no container).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  takeControl,
  releaseControl,
  getControl,
  isMachineControlled,
  resetControlLocks,
  startControlDesktop,
  stopControlDesktop,
  spawnControlTunnel,
  CONTROL_TTL_MS,
  CONTROL_VNC_PORT,
  CONTROL_FORWARDER_CODE,
} from './machineControl.js';

const OWNER = { id: 'u-owner', username: 'bhavesh189', role: 'admin' };
const OTHER = { id: 'u-other', username: 'someone', role: 'user' };

test('MC-1: take succeeds and the lock reports the holder', () => {
  resetControlLocks();
  const r = takeControl('h1', OWNER, 1000);
  assert.ok(r.ok);
  assert.equal(r.lock.username, 'bhavesh189');
  assert.equal(isMachineControlled('h1', 1000), true);
  const lock = getControl('h1', 1000);
  assert.equal(lock.userId, 'u-owner');
});

test('MC-2: double-take is rejected with the holder named', () => {
  resetControlLocks();
  takeControl('h1', OWNER, 1000);
  const r = takeControl('h1', OTHER, 2000);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'already_controlled');
  assert.equal(r.holder, 'bhavesh189');
  assert.equal(getControl('h1', 2000).userId, 'u-owner');
});

test('MC-3: release by a different (non-admin) user is rejected', () => {
  resetControlLocks();
  takeControl('h1', OWNER, 1000);
  const r = releaseControl('h1', OTHER, 2000);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'not_holder');
  assert.equal(isMachineControlled('h1', 2000), true);
});

test('MC-4: release by the holder frees the lock', () => {
  resetControlLocks();
  takeControl('h1', OWNER, 1000);
  const r = releaseControl('h1', OWNER, 2000);
  assert.equal(r.ok, true);
  assert.equal(isMachineControlled('h1', 2000), false);
  assert.equal(getControl('h1', 2000), null);
});

test('MC-5: release when nothing is held is rejected', () => {
  resetControlLocks();
  const r = releaseControl('h1', OWNER, 1000);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'not_controlled');
});

test('MC-6: an admin may force-release someone else\'s lock', () => {
  resetControlLocks();
  takeControl('h1', OTHER, 1000);
  const r = releaseControl('h1', OWNER, 2000);
  assert.equal(r.ok, true);
  assert.equal(isMachineControlled('h1', 2000), false);
});

test('MC-7: an abandoned lock expires after the TTL', () => {
  resetControlLocks();
  takeControl('h1', OWNER, 1000);
  assert.equal(isMachineControlled('h1', 1000 + CONTROL_TTL_MS - 1), true);
  assert.equal(isMachineControlled('h1', 1000 + CONTROL_TTL_MS + 1), false);
  // ...and the hunt can be taken again after expiry.
  const r = takeControl('h1', OTHER, 1000 + CONTROL_TTL_MS + 1);
  assert.ok(r.ok);
  assert.equal(r.lock.username, 'someone');
});

test('MC-8: locks are per-hunt (taking one hunt never blocks another)', () => {
  resetControlLocks();
  takeControl('h1', OWNER, 1000);
  const r = takeControl('h2', OTHER, 1000);
  assert.ok(r.ok);
});

test('MC-9: startControlDesktop starts the desktop stack, then the interactive VNC', async () => {
  const cmds = [];
  const deps = {
    startDesktop: async (huntId) => { cmds.push(['startDesktop', huntId]); return { ok: true }; },
    exec: async (huntId, cmd, timeout, opts) => {
      cmds.push(['exec', cmd]);
      assert.equal(opts && opts.bypassTmux, true, 'control VNC start must bypass tmux');
      return { stdout: 'started\n', stderr: '', code: 0 };
    },
  };
  const r = await startControlDesktop('h1', deps);
  assert.ok(r.ok);
  assert.equal(cmds[0][0], 'startDesktop');
  const vncCmd = cmds[1][1];
  assert.match(vncCmd, new RegExp(`rfbport ${CONTROL_VNC_PORT}`));
  assert.match(vncCmd, /-localhost/, 'control VNC stays loopback-only');
  assert.doesNotMatch(vncCmd, /-viewonly/, 'control VNC must NOT be view-only');
  assert.match(vncCmd, /x11vnc -display :99/);
});

test('MC-10: startControlDesktop is a no-op when the control VNC already runs', async () => {
  const deps = {
    startDesktop: async () => ({ ok: true }),
    exec: async () => ({ stdout: 'running\n', stderr: '', code: 0 }),
  };
  const r = await startControlDesktop('h1', deps);
  assert.ok(r.ok);
  assert.equal(r.alreadyRunning, true);
});

test('MC-11: startControlDesktop fails honestly when the desktop stack is down', async () => {
  let execCalled = false;
  const deps = {
    startDesktop: async () => ({ ok: false, error: 'desktop_not_installed' }),
    exec: async () => { execCalled = true; return { stdout: '', stderr: '', code: 0 }; },
  };
  const r = await startControlDesktop('h1', deps);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'desktop_not_installed');
  assert.equal(execCalled, false, 'no VNC start without a desktop');
});

test('MC-12: startControlDesktop fails honestly when the container is gone', async () => {
  const deps = {
    startDesktop: async () => ({ ok: true }),
    exec: async () => ({ stdout: '', stderr: 'DM_CONTAINER_MISSING', code: 127, containerMissing: true }),
  };
  const r = await startControlDesktop('h1', deps);
  assert.equal(r.ok, false);
  assert.equal(r.error, 'container_not_running');
});

test('MC-13: stopControlDesktop kills by PID file and never throws', async () => {
  const cmds = [];
  const deps = {
    exec: async (huntId, cmd) => { cmds.push(cmd); return { stdout: 'stopped\n', stderr: '', code: 0 }; },
  };
  const r = await stopControlDesktop('h1', deps);
  assert.ok(r.ok);
  assert.match(cmds[0], /dm-control-vnc\.pid/);
  // Bracket trick: the pkill pattern must not match its own sh -c line.
  assert.match(cmds[0], /x11vn\[c\]/);
  assert.doesNotMatch(cmds[0], /pkill -f 'x11vnc /);
});

test('MC-14: spawnControlTunnel runs docker exec -i with the python forwarder', () => {
  let got = null;
  const fakeSpawn = (cmd, args, opts) => {
    got = { cmd, args, opts };
    return { pid: 1234 };
  };
  const proc = spawnControlTunnel('h_abc123', { spawn: fakeSpawn });
  assert.equal(proc.pid, 1234);
  assert.equal(got.cmd, 'docker');
  assert.deepEqual(got.args.slice(0, 3), ['exec', '-i', 'dm-hunt-h_abc123']);
  assert.equal(got.args[3], 'python3');
  assert.equal(got.args[4], '-c');
  assert.equal(got.args[5], CONTROL_FORWARDER_CODE);
  assert.deepEqual(got.opts.stdio, ['pipe', 'pipe', 'pipe']);
});

test('MC-15: the forwarder connects to the loopback control VNC only', () => {
  assert.match(CONTROL_FORWARDER_CODE, new RegExp(`127\\.0\\.0\\.1', ${CONTROL_VNC_PORT}`));
  assert.doesNotMatch(CONTROL_FORWARDER_CODE, /0\.0\.0\.0/);
  assert.doesNotMatch(CONTROL_FORWARDER_CODE, /websockify|6080|5900/);
});
