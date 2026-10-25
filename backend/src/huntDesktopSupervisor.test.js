// Chromium supervisor — huntRunner.startHuntDesktop tests.
//
// 25 Oct 2026: Chromium died silently (11:35:11Z) while Xvfb and the
// ready file lived on, and nothing revived it — every consumer trusted
// the ready file alone. The starter now probes the ready file AND
// Chromium's CDP endpoint, and revives a dead Chromium instead of
// returning "already running". These tests run the ACTUAL starter
// (not a re-implementation of its decision) with an injected exec
// fake — no docker, no container — following the deps-seam convention
// guiTools uses (Lane Z/AB).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDesktopProbe,
  startHuntDesktop,
  checkChromiumWatchdog,
  resetDesktopStartFailures,
} from './huntRunner.js';

const CDP_VERSION =
  '{"Browser":"Chrome/150.0.7871.181","Protocol-Version":"1.3",' +
  '"User-Agent":"Mozilla/5.0","V8-Version":"13.0","WebKit-Version":"537.36",' +
  '"webSocketDebuggerUrl":"ws://127.0.0.1:9222/devtools/browser/abc"}';

// --- parseDesktopProbe (pure decision core) -------------------------------

test('CS-1: parseDesktopProbe — ready file + CDP answers is healthy', () => {
  assert.deepEqual(parseDesktopProbe(`DESKTOP_READY\n${CDP_VERSION}\n`), {
    ready: true,
    cdp: true,
  });
});

test('CS-2: parseDesktopProbe — ready file present, CDP silent is dead Chromium', () => {
  assert.deepEqual(parseDesktopProbe('DESKTOP_READY\n'), { ready: true, cdp: false });
});

test('CS-3: parseDesktopProbe — CDP answers but no ready file is a cold desktop', () => {
  assert.deepEqual(parseDesktopProbe(`${CDP_VERSION}\n`), { ready: false, cdp: true });
});

test('CS-4: parseDesktopProbe — neither present, empty and garbage input', () => {
  assert.deepEqual(parseDesktopProbe(''), { ready: false, cdp: false });
  assert.deepEqual(parseDesktopProbe('some unrelated output\n'), { ready: false, cdp: false });
  assert.deepEqual(parseDesktopProbe(null), { ready: false, cdp: false });
});

test('CS-5: parseDesktopProbe — "Browser" field alone counts as CDP (same marker as probeGui)', () => {
  assert.deepEqual(parseDesktopProbe('{"Browser":"Chrome/150.0.0"}'), {
    ready: false,
    cdp: true,
  });
});

// --- startHuntDesktop flow (actual starter, fake exec) --------------------

function fakeExec(responses) {
  const calls = [];
  let i = 0;
  const exec = async (huntId, cmd, timeoutMs, opts) => {
    calls.push(cmd);
    const res =
      typeof responses === 'function' ? responses(i, cmd) : responses[i];
    i += 1;
    return res || { stdout: '', stderr: '', code: 0 };
  };
  return { exec, calls };
}

const FAST_WAIT = { startWaitAttempts: 5, startWaitIntervalMs: 0 };

test('CS-6: startHuntDesktop — healthy desktop is a no-op (one probe, no script launch)', async () => {
  resetDesktopStartFailures();
  const { exec, calls } = fakeExec([{ stdout: `DESKTOP_READY\n${CDP_VERSION}\n`, code: 0 }]);
  const res = await startHuntDesktop('h-cs6', { exec, ...FAST_WAIT });
  assert.deepEqual(res, { ok: true, alreadyRunning: true });
  assert.equal(calls.length, 1, 'only the initial probe runs');
  assert.ok(!calls[0].includes('hunt-desktop.sh'), 'the start script is never launched');
});

test('CS-7: startHuntDesktop — dead Chromium (ready file, no CDP) is revived', async () => {
  resetDesktopStartFailures();
  const { exec, calls } = fakeExec((i) => {
    if (i === 0) return { stdout: 'DESKTOP_READY\n', code: 0 }; // probe: ready, CDP silent
    if (i === 1) return { stdout: 'launched\n', code: 0 }; // script launch
    if (i === 2) return { stdout: 'DESKTOP_READY\n', code: 0 }; // wait probe 1: still no CDP
    return { stdout: `DESKTOP_READY\n${CDP_VERSION}\n`, code: 0 }; // wait probe 2: CDP answers
  });
  const res = await startHuntDesktop('h-cs7', { exec, ...FAST_WAIT });
  assert.deepEqual(res, { ok: true });
  const launches = calls.filter((c) => c.includes('hunt-desktop.sh'));
  assert.equal(launches.length, 1, 'the start script runs exactly once');
  assert.equal(calls.length, 4, 'probe + launch + two wait probes');
});

test('CS-8: startHuntDesktop — cold start (no ready file, no CDP) launches and waits for CDP', async () => {
  resetDesktopStartFailures();
  const { exec, calls } = fakeExec((i) => {
    if (i === 0) return { stdout: '', code: 0 }; // probe: nothing up
    if (i === 1) return { stdout: 'launched\n', code: 0 }; // script launch
    return { stdout: `DESKTOP_READY\n${CDP_VERSION}\n`, code: 0 }; // wait probe: CDP answers
  });
  const res = await startHuntDesktop('h-cs8', { exec, ...FAST_WAIT });
  assert.deepEqual(res, { ok: true });
  assert.equal(calls.filter((c) => c.includes('hunt-desktop.sh')).length, 1);
});

test('CS-9: startHuntDesktop — missing desktop script reports desktop_not_installed', async () => {
  resetDesktopStartFailures();
  const { exec } = fakeExec([
    { stdout: '', code: 0 }, // probe: nothing up
    { stdout: '', stderr: 'sh: 1: /usr/local/bin/hunt-desktop.sh: not found', code: 127 },
  ]);
  const res = await startHuntDesktop('h-cs9', { exec, ...FAST_WAIT });
  assert.deepEqual(res, { ok: false, error: 'desktop_not_installed' });
});

test('CS-10: startHuntDesktop — CDP never answers times out and throttles the next call', async () => {
  resetDesktopStartFailures();
  const { exec, calls } = fakeExec((i) => {
    if (i === 0) return { stdout: 'DESKTOP_READY\n', code: 0 }; // probe: ready, CDP silent
    if (i === 1) return { stdout: 'launched\n', code: 0 }; // script launch
    return { stdout: 'DESKTOP_READY\n', code: 0 }; // wait probes: CDP never answers
  });
  const res = await startHuntDesktop('h-cs10', {
    exec,
    startWaitAttempts: 3,
    startWaitIntervalMs: 0,
  });
  assert.deepEqual(res, { ok: false, error: 'desktop_start_timeout' });
  // The failure is recorded in the shared cache: the very next call is
  // throttled without spending another start attempt.
  const callsBefore = calls.length;
  const throttled = await startHuntDesktop('h-cs10', { exec, ...FAST_WAIT });
  assert.deepEqual(throttled, { ok: false, error: 'desktop_unavailable' });
  assert.equal(calls.length, callsBefore, 'throttled call performs no exec');
});

// --- checkChromiumWatchdog (actual check logic, fake I/O boundary) ------
// The watchdog closes the unwatched gap: the supervisor only runs when
// the screenshot poller (owner watching) or a browser action calls the
// starter, and the Live Machine now defaults to collapsed. These tests
// run the ACTUAL watchdog loop with a fake hunt list, fake exec probe
// and (mostly) a fake starter — the decision of which hunts to probe,
// revive or skip is the real code.

function probeExecByHunt(byHunt) {
  const calls = [];
  const exec = async (huntId, cmd) => {
    calls.push({ huntId, cmd });
    const res = byHunt[huntId];
    if (typeof res === 'function') return res();
    return res || { stdout: '', code: 0 };
  };
  return { exec, calls };
}

const HEALTHY_PROBE = { stdout: `DESKTOP_READY\n${CDP_VERSION}\n`, code: 0 };
const DEAD_PROBE = { stdout: 'DESKTOP_READY\n', code: 0 };
const NO_DESKTOP_PROBE = { stdout: '', code: 0 };

test('CW-1: checkChromiumWatchdog — healthy running hunt is a no-op (starter never called)', async () => {
  resetDesktopStartFailures();
  const { exec, calls } = probeExecByHunt({ 'h-cw1': HEALTHY_PROBE });
  const started = [];
  const res = await checkChromiumWatchdog({
    listMetas: async () => [{ huntId: 'h-cw1', state: 'running' }],
    exec,
    startDesktop: async (id) => {
      started.push(id);
      return { ok: true };
    },
  });
  assert.deepEqual(res, { checked: 1, healthy: 1, revived: 0, failed: 0, skipped: 0 });
  assert.equal(calls.length, 1, 'one probe for the one running hunt');
  assert.deepEqual(started, [], 'the starter is never called for a healthy desktop');
});

test('CW-2: checkChromiumWatchdog — dead Chromium (ready, no CDP) revives via the starter exactly once', async () => {
  resetDesktopStartFailures();
  const { exec } = probeExecByHunt({ 'h-cw2': DEAD_PROBE });
  const started = [];
  const res = await checkChromiumWatchdog({
    listMetas: async () => [{ huntId: 'h-cw2', state: 'running' }],
    exec,
    startDesktop: async (id) => {
      started.push(id);
      return { ok: true };
    },
  });
  assert.deepEqual(res, { checked: 1, healthy: 0, revived: 1, failed: 0, skipped: 0 });
  assert.deepEqual(started, ['h-cw2'], 'the starter runs exactly once');
});

test('CW-3: checkChromiumWatchdog — paused hunt is skipped without any probe', async () => {
  resetDesktopStartFailures();
  const { exec, calls } = probeExecByHunt({ 'h-cw3': DEAD_PROBE });
  const started = [];
  const res = await checkChromiumWatchdog({
    listMetas: async () => [{ huntId: 'h-cw3', state: 'paused' }],
    exec,
    startDesktop: async (id) => {
      started.push(id);
      return { ok: true };
    },
  });
  assert.deepEqual(res, { checked: 0, healthy: 0, revived: 0, failed: 0, skipped: 1 });
  assert.equal(calls.length, 0, 'a paused hunt is never probed');
  assert.deepEqual(started, []);
});

test('CW-4: checkChromiumWatchdog — running hunt that never started a desktop is skipped, never created', async () => {
  resetDesktopStartFailures();
  const { exec, calls } = probeExecByHunt({ 'h-cw4': NO_DESKTOP_PROBE });
  const started = [];
  const res = await checkChromiumWatchdog({
    listMetas: async () => [{ huntId: 'h-cw4', state: 'running' }],
    exec,
    startDesktop: async (id) => {
      started.push(id);
      return { ok: true };
    },
  });
  assert.deepEqual(res, { checked: 0, healthy: 0, revived: 0, failed: 0, skipped: 1 });
  assert.equal(calls.length, 1, 'the probe runs (to learn there is no desktop)');
  assert.deepEqual(started, [], 'the starter never runs — no desktop is created');
});

test('CW-5: checkChromiumWatchdog — missing container is skipped, never respawned by the watchdog', async () => {
  resetDesktopStartFailures();
  const { exec } = probeExecByHunt({
    'h-cw5': { stdout: '', code: 0, containerMissing: true },
  });
  const started = [];
  const res = await checkChromiumWatchdog({
    listMetas: async () => [{ huntId: 'h-cw5', state: 'running' }],
    exec,
    startDesktop: async (id) => {
      started.push(id);
      return { ok: true };
    },
  });
  assert.deepEqual(res, { checked: 0, healthy: 0, revived: 0, failed: 0, skipped: 1 });
  assert.deepEqual(started, [], 'a missing container is never respawned here');
});

test('CW-6: checkChromiumWatchdog — mixed hunts: only the dead running one is revived', async () => {
  resetDesktopStartFailures();
  const { exec } = probeExecByHunt({
    'h-cw6-healthy': HEALTHY_PROBE,
    'h-cw6-dead': DEAD_PROBE,
    'h-cw6-never': NO_DESKTOP_PROBE,
  });
  const started = [];
  const res = await checkChromiumWatchdog({
    listMetas: async () => [
      { huntId: 'h-cw6-healthy', state: 'running' },
      { huntId: 'h-cw6-dead', state: 'running' },
      { huntId: 'h-cw6-never', state: 'running' },
      { huntId: 'h-cw6-paused', state: 'paused' },
    ],
    exec,
    startDesktop: async (id) => {
      started.push(id);
      return { ok: true };
    },
  });
  assert.deepEqual(res, { checked: 2, healthy: 1, revived: 1, failed: 0, skipped: 2 });
  assert.deepEqual(started, ['h-cw6-dead'], 'only the dead running hunt is revived');
});

test('CW-7: checkChromiumWatchdog — throttle respected with the REAL starter (failed revive is not retried)', async () => {
  resetDesktopStartFailures();
  // First pass: probe finds a dead Chromium, the real starter runs the
  // script, the script is missing (code 127) — the failure is recorded
  // in the shared 30s cache.
  const { exec, calls } = fakeExec((i) => {
    if (i === 0) return DEAD_PROBE; // watchdog probe: ready, CDP silent
    if (i === 1) return { stdout: '', stderr: 'sh: 1: /usr/local/bin/hunt-desktop.sh: not found', code: 127 }; // script launch
    return DEAD_PROBE; // later watchdog probes: still dead
  });
  const listMetas = async () => [{ huntId: 'h-cw7', state: 'running' }];
  const first = await checkChromiumWatchdog({
    listMetas,
    exec,
    startWaitAttempts: 5,
    startWaitIntervalMs: 0,
  });
  assert.deepEqual(first, { checked: 1, healthy: 0, revived: 0, failed: 1, skipped: 0 });
  const launchesAfterFirst = calls.filter((c) => c.includes('hunt-desktop.sh')).length;
  assert.equal(launchesAfterFirst, 1, 'the script runs once on the first pass');
  // Second pass inside the throttle window: the watchdog short-circuits
  // on the shared cache before spending even the probe — no exec at
  // all, and the real starter is never reached.
  const callsAfterFirst = calls.length;
  const second = await checkChromiumWatchdog({
    listMetas,
    exec,
    startWaitAttempts: 5,
    startWaitIntervalMs: 0,
  });
  assert.deepEqual(second, { checked: 0, healthy: 0, revived: 0, failed: 0, skipped: 1 });
  assert.equal(calls.length, callsAfterFirst, 'throttled pass performs no exec');
});
