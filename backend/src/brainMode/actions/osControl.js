// Split out of brainMode.js by the P3 professionalization lane (split-only, no behaviour change).
// Dispatch branches of executeBrainAction, moved verbatim except that
// dispatcher locals are read through the h context object.

import { executeOsAction, OS_CONTROL_ACTIONS, osControlDetail } from '../../osControl.js';
import { COMMAND_CAP, OBS_BUDGET, defaultAssess, defaultExec, defaultGui } from './common.js';

export async function executeOsControlAction(huntId, action, h) {
  // FULL OS CONTROL (28 Oct 2026, owner order): the parent brain
  // drives the whole Kali machine through the same OS-control layer
  // the AI loop's actions use (osControl.js). The ctx hands it the
  // same raw exec, the same GUI binding, the same screenshot /
  // desktop starters and the same meta access the loop gets. A
  // refused/failed OS action is a FAILED step (gui_failed), never
  // a task_complete — the DVWA login rule, applied to the desktop.
  const execRaw = h.d.execRaw || ((h, c, t, o) => import('../../huntRunner.js').then((hr) => hr.execInHuntContainerWithRespawn(h, c, t, o)));
  const gui = await defaultGui(huntId, h.target, h.parsedScope, h.d);
  let res = null;
  try {
    res = await executeOsAction(huntId, h.kind, action, {
      target: h.target,
      parsedScope: h.parsedScope,
      execRaw,
      exec: (h, t, c) => defaultExec(h, t, c, h.d),
      gui,
      readMeta: h.readMeta,
      writeMeta: h.writeMetaCheckpoint,
    });
  } catch (err) {
    res = { ok: false, observation: String((err && err.message) || err) };
  }
  h.observation = (res && res.observation) || '(no observation)';
  if (res && res.ok === false) {
    h.recordExecuted();
    h.failProcess('gui_failed', h.observation);
    return { ok: false, error: 'gui_failed', message: String(h.observation).slice(0, 300), output: h.observation };
  }
  // LIVE UI: remember what the machine last showed, so GET
  // /process can render it without re-running anything.
  try {
    const patch = {};
    if (res && res.artifact) patch.lastScreenshot = { name: res.artifact, kind: h.kind, at: new Date().toISOString() };
    if (res && res.desktopState) {
      patch.lastDesktopState = {
        windows: (res.desktopState.windows || []).map((w) => w.title).filter(Boolean),
        activeTitle: res.desktopState.activeTitle || '',
        at: new Date().toISOString(),
      };
    }
    if (Object.keys(patch).length) h.writeMetaCheckpoint(huntId, patch);
  } catch { /* live-state persistence is best-effort */ }
  h.recordExecuted();
  const done = h.finish();
  if (res && res.artifact) done.artifact = res.artifact;
  return done;
}
