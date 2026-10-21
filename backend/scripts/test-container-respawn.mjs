// Test for the human-mode container self-heal (Lane E, 21 Oct 2026).
//
// The bug (proven live by Lane C): pipeline mode respawned a missing
// hunt container before retrying, but every human-mode path — the
// shell executor, humanLoop's raw exec, the GUI tools, the desktop
// starter — called execInHuntContainer directly, so a container removed
// for an image swap (or lost to a crash) NEVER came back. The loop
// kept "running" while every action degraded to DM_CONTAINER_MISSING
// and the owner's live view 404'd with container_not_running.
//
// This VM has no Docker, so the heal is proven with injected fakes via
// huntRunner's _impl seam (the same DI style as humanLoop's deps):
//   - container present       -> exec passes through, no spawn;
//   - container missing       -> spawn called once, exec retried once,
//                                result carries the real output;
//   - target not passed       -> resolved from the hunt meta;
//   - spawn failure           -> the original container-missing result
//                                returns with respawnFailed + the spawn
//                                error in stderr (a clear observation
//                                for the brain) — never a throw;
//   - still missing post-spawn-> exactly one retry, no loop;
//   - concurrent ensure calls -> one shared spawn;
//   - humanLoop end-to-end    -> a session whose container starts dead
//                                heals on the perceive probe and its
//                                shell action returns real output; with
//                                a failing spawn the session still
//                                completes and the brain sees why;
//   - guiTools end-to-end     -> browser_open through the respawn exec
//                                heals the container and returns a page.
//
// Run: node backend/scripts/test-container-respawn.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-respawn-'));
process.env.DATA_DIR = tmp;

const { execInHuntContainerWithRespawn, ensureHuntContainer } = await import('../src/huntRunner.js');
const { humanIteration } = await import('../src/humanLoop.js');
const { guiBrowserOpen, resetGuiProbeCache } = await import('../src/guiTools.js');

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const TARGET = 'http://target.test';
const MISSING = { stdout: '', stderr: 'DM_CONTAINER_MISSING: hunt container not running', code: 127, containerMissing: true };

// A fake docker world: a container that is up or down, a spawn that
// heals it (or fails, or "succeeds" without healing), and a meta.
function makeWorld({ up = false, spawnFails = false, spawnHeals = true, spawnDelayMs = 0, meta } = {}) {
  const w = { up, spawnCalls: 0, execCalls: 0, spawnArgs: [] };
  w.impl = {
    exec: async (h, cmd) => {
      w.execCalls++;
      if (!w.up) return { ...MISSING };
      return { stdout: `ran: ${cmd}`, stderr: '', code: 0 };
    },
    running: async () => w.up,
    spawn: async (h, target, o) => {
      w.spawnCalls++;
      w.spawnArgs.push({ h, target, o });
      if (spawnDelayMs) await new Promise((r) => setTimeout(r, spawnDelayMs));
      if (spawnFails) throw new Error('docker boom');
      if (spawnHeals) w.up = true;
      return { container: `dm-hunt-${h}` };
    },
    readMeta: async () => (meta === undefined ? { target: TARGET, mode: 'human', state: 'running' } : meta),
  };
  return w;
}

// ---------------------------------------------------------------------------
// execInHuntContainerWithRespawn units
// ---------------------------------------------------------------------------
{
  const w = makeWorld({ up: true });
  const r = await execInHuntContainerWithRespawn('h_up', 'id', 1000, { target: TARGET, _impl: w.impl });
  check('present: exec passes through', r.stdout === 'ran: id' && r.code === 0);
  check('present: no spawn, single exec, no respawn flags', w.spawnCalls === 0 && w.execCalls === 1 && !r.respawned && !r.respawnFailed);
}
{
  const w = makeWorld({ up: false });
  const r = await execInHuntContainerWithRespawn('h_heal', 'id', 1000, { target: TARGET, _impl: w.impl });
  check('missing->heal: retried exec returns real output', r.stdout === 'ran: id' && r.code === 0);
  check('missing->heal: exactly one spawn, two execs', w.spawnCalls === 1 && w.execCalls === 2);
  check('missing->heal: result marked respawned, spawn got the target', r.respawned === true && w.spawnArgs[0].target === TARGET);
}
{
  const w = makeWorld({ up: false });
  const r = await execInHuntContainerWithRespawn('h_meta', 'id', 1000, { _impl: w.impl });
  check('missing->heal: target resolved from hunt meta when not passed', r.respawned === true && w.spawnArgs[0].target === TARGET && w.spawnArgs[0].o.mode === 'human');
}
{
  const w = makeWorld({ up: false, spawnFails: true });
  const r = await execInHuntContainerWithRespawn('h_fail', 'id', 1000, { target: TARGET, _impl: w.impl });
  check('spawn failure: original missing result, no retry', r.containerMissing === true && w.execCalls === 1 && w.spawnCalls === 1);
  check('spawn failure: respawnFailed flag + spawn error in stderr', r.respawnFailed === true && /automatic respawn failed/.test(r.stderr) && /docker boom/.test(r.stderr));
}
{
  const w = makeWorld({ up: false, spawnHeals: false });
  const r = await execInHuntContainerWithRespawn('h_still', 'id', 1000, { target: TARGET, _impl: w.impl });
  check('still missing after spawn: exactly one retry, no loop', r.containerMissing === true && w.execCalls === 2 && w.spawnCalls === 1);
}

// ---------------------------------------------------------------------------
// ensureHuntContainer units
// ---------------------------------------------------------------------------
{
  const w = makeWorld({ up: true });
  const e = await ensureHuntContainer('h_ensure_up', { target: TARGET, _impl: w.impl });
  check('ensure: already running -> ok, not spawned', e.ok === true && e.spawned === false && w.spawnCalls === 0);
}
{
  const w = makeWorld({ up: false, meta: {} });
  const e = await ensureHuntContainer('h_ensure_notarget', { _impl: w.impl });
  check('ensure: no target anywhere -> honest failure, no spawn', e.ok === false && e.error === 'no_target_for_respawn' && w.spawnCalls === 0);
}
{
  const w = makeWorld({ up: false, spawnDelayMs: 30 });
  const [a, b] = await Promise.all([
    ensureHuntContainer('h_ensure_race', { target: TARGET, _impl: w.impl }),
    ensureHuntContainer('h_ensure_race', { target: TARGET, _impl: w.impl }),
  ]);
  check('ensure: concurrent callers share one spawn', a.ok === true && b.ok === true && w.spawnCalls === 1);
}

// ---------------------------------------------------------------------------
// humanLoop end-to-end: the session heals its own machine
// ---------------------------------------------------------------------------
function loopDeps(w, replies) {
  const queue = [...replies];
  return {
    chat: async () => (queue.length ? queue.shift() : null),
    exec: async (h, t, command) => execInHuntContainerWithRespawn(h, command, 1000, { target: TARGET, _impl: w.impl }),
    execRaw: (h, c, t, o) => execInHuntContainerWithRespawn(h, c, t, { ...(o || {}), target: TARGET, _impl: w.impl }),
    search: async () => [],
    writeFile: async (h, name) => ({ name, chars: 0 }),
    spill: () => 'spilled.log',
    record: () => {},
    readMeta: () => ({ huntId: 'h_loop', parsedScope: null }),
    writeMeta: () => {},
    readEvents: () => [],
    recordNote: () => {},
    assess: null,
    buildBriefing: async () => '',
    sleep: async () => {},
    now: () => Date.now(),
  };
}
{
  const w = makeWorld({ up: false });
  const res = await humanIteration('h_loop_heal', TARGET, {
    turns: 2,
    deps: loopDeps(w, [
      'Let me look at who I am on this machine.\n{"action":"shell","command":"id"}',
      'Noted.\n{"action":"note","text":"machine healed itself"}',
    ]),
  });
  check('loop heal: session completes with aiOk', res.aiOk === true && res.turnsRun === 2);
  check('loop heal: one spawn for the whole session', w.spawnCalls === 1);
  check('loop heal: shell observation is the retried real output', (res.log[0].observation || '').includes('ran: id'));
}
{
  const w = makeWorld({ up: false, spawnFails: true });
  const res = await humanIteration('h_loop_fail', TARGET, {
    turns: 2,
    deps: loopDeps(w, [
      'Trying the shell anyway.\n{"action":"shell","command":"id"}',
      'Understood, machine is down.\n{"action":"note","text":"container down"}',
    ]),
  });
  check('loop spawn-failure: session still completes (never throws dead)', res.aiOk === true && res.turnsRun === 2);
  check('loop spawn-failure: brain sees the clear respawn-failed observation', /automatic respawn failed/.test(res.log[0].observation || ''));
}

// ---------------------------------------------------------------------------
// guiTools end-to-end: browser_open through the respawn exec
// ---------------------------------------------------------------------------
{
  resetGuiProbeCache();
  const w = makeWorld({ up: false });
  const guiImpl = {
    ...w.impl,
    exec: async (h, cmd) => {
      w.execCalls++;
      if (!w.up) return { ...MISSING };
      if (cmd.includes('command -v chromium')) {
        return { stdout: 'chrome=/usr/bin/chromium\ncdp=\nxsock=X99\n', stderr: '', code: 0 };
      }
      if (cmd.includes('--dump-dom')) {
        return { stdout: '<html><head><title>Login</title></head><body>Sign in to continue</body></html>', stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    },
  };
  const guiExec = (h, c, t, o) => execInHuntContainerWithRespawn(h, c, t, { ...(o || {}), _impl: guiImpl });
  const res = await guiBrowserOpen('h_gui_heal', 'http://target.test/login', { exec: guiExec });
  check('gui heal: browser_open succeeds after respawn', res.ok === true && w.spawnCalls === 1);
  check('gui heal: observation is the healed page snapshot', /headless preview/.test(res.observation || '') && /Login/.test(res.observation || ''));
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
