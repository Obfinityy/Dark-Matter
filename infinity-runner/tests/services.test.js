/**
 * services.test.js — ServiceManager lifecycle (Electron-agnostic, faked spawner).
 */
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { ServiceManager } = require('../main/services.js');

function makeFakeSpawner() {
  const spawned = [];
  const spawnService = (entryPath, { env } = {}) => {
    const child = new EventEmitter();
    child.entryPath = entryPath;
    child.env = env;
    child.killed = false;
    child.kill = () => { child.killed = true; };
    spawned.push(child);
    return child;
  };
  return { spawned, spawnService };
}

function makeManager(spawner, token = '') {
  return new ServiceManager({
    spawnService: spawner.spawnService,
    resourcesDir: '/fake/resources',
    pollerEnv: () => ({ POLLER_TOKEN: token }),
    fetchImpl: async () => { throw new Error('no network in tests'); },
    restartDelays: [50, 100, 200],
  });
}

beforeEach(() => { /* fresh fakes per test via makeFakeSpawner */ });

test('start(): vm-runner launches; poller waits for sign-in when no token', async () => {
  const spawner = makeFakeSpawner();
  const m = makeManager(spawner, '');
  await m.start();
  assert.equal(spawner.spawned.length, 1);
  assert.match(spawner.spawned[0].entryPath, /vm-runner/);
  const s = m.status();
  assert.equal(s.runner, 'running');
  assert.equal(s.poller, 'waiting-signin');
  await m.stop();
});

test('start(): poller launches when a token exists, with the token in env', async () => {
  const spawner = makeFakeSpawner();
  const m = makeManager(spawner, 'tok-123');
  await m.start();
  assert.equal(spawner.spawned.length, 2);
  const poller = spawner.spawned.find((c) => /agent-poller/.test(c.entryPath));
  assert.ok(poller);
  assert.equal(poller.env.POLLER_TOKEN, 'tok-123');
  assert.equal(m.status().poller, 'running');
  await m.stop();
});

test('unexpected exit schedules a restart', async () => {
  const spawner = makeFakeSpawner();
  const m = makeManager(spawner, '');
  await m.start();
  const first = spawner.spawned[0];
  first.emit('exit', 1);
  // restart is scheduled with backoff (first delay 1000ms); fast-forward
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(spawner.spawned.length, 2, 'service should have been relaunched');
  assert.equal(m.status().runner, 'running');
  await m.stop();
});

test('rapid repeated crashes give up with a clear state', async () => {
  const spawner = makeFakeSpawner();
  const m = makeManager(spawner, '');
  // shrink backoff by failing fast: emit exit on every new child quickly
  const origLaunch = m.launch.bind(m);
  m.launch = (def) => {
    origLaunch(def);
    const child = spawner.spawned[spawner.spawned.length - 1];
    setImmediate(() => child.emit('exit', 1));
  };
  await m.start();
  await new Promise((r) => setTimeout(r, 2500));
  const s = m.status();
  assert.equal(s.runner, 'crashed');
  assert.match(s.runnerDetail, /repeatedly/);
  const count = spawner.spawned.length;
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(spawner.spawned.length, count, 'no more restarts after giving up');
  await m.stop();
});

test('stop(): kills processes and does not restart them', async () => {
  const spawner = makeFakeSpawner();
  const m = makeManager(spawner, 'tok');
  await m.start();
  assert.equal(spawner.spawned.length, 2);
  await m.stop();
  assert.ok(spawner.spawned.every((c) => c.killed));
  assert.deepEqual([m.status().runner, m.status().poller], ['stopped', 'stopped']);
  const count = spawner.spawned.length;
  spawner.spawned.forEach((c) => c.emit('exit', 0));
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(spawner.spawned.length, count, 'stopped services must not restart');
});

test('refreshPoller(): starts the poller after sign-in, stops it after sign-out', async () => {
  const spawner = makeFakeSpawner();
  let token = '';
  const m = new ServiceManager({
    spawnService: spawner.spawnService,
    resourcesDir: '/fake/resources',
    pollerEnv: () => ({ POLLER_TOKEN: token }),
    fetchImpl: async () => { throw new Error('no network'); },
    restartDelays: [50, 100, 200],
  });
  await m.start();
  assert.equal(m.status().poller, 'waiting-signin');
  token = 'tok-abc';
  m.refreshPoller();
  assert.equal(m.status().poller, 'running');
  token = '';
  m.refreshPoller();
  assert.equal(m.status().poller, 'stopped');
  await m.stop();
});

test('probeRunnerHealth(): reports up/down without throwing', async () => {
  const okFetch = async () => ({ ok: true, json: async () => ({ version: '0.1.0', qemu: { accel: 'wHPX' } }) });
  const m = new ServiceManager({
    spawnService: makeFakeSpawner().spawnService,
    resourcesDir: '/x',
    pollerEnv: () => ({}),
    fetchImpl: okFetch,
  });
  const up = await m.probeRunnerHealth(500);
  assert.equal(up.up, true);
  assert.equal(up.version, '0.1.0');

  const downFetch = async () => { throw new Error('ECONNREFUSED'); };
  const m2 = new ServiceManager({
    spawnService: makeFakeSpawner().spawnService,
    resourcesDir: '/x',
    pollerEnv: () => ({}),
    fetchImpl: downFetch,
  });
  const down = await m2.probeRunnerHealth(500);
  assert.equal(down.up, false);
});
