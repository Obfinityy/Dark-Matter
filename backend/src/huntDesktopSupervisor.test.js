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
