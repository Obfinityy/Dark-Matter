// Split out of brainMode.js by the P3 professionalization lane (split-only, no behaviour change).
// Dispatch branches of executeBrainAction, moved verbatim except that
// dispatcher locals are read through the h context object.

import {
  claimGateCheck,
  claimClassFromTitle,
  extractTaskBlock,
  scopeViolation,
  pendingPlannedProbes,
  targetHostsFor,
} from '../../humanLoop.js';
import { COMMAND_CAP, OBS_BUDGET, defaultAssess, defaultExec, defaultGui } from './common.js';

export async function executeBrowserOpenAction(huntId, action, h) {
  const url = String(action.url || '');
  if (!url.trim()) { h.failProcess('empty_command', 'browser_open needs a url.'); return { ok: false, error: 'empty_command', message: 'browser_open needs a url.' }; }
  const bad = scopeViolation(url, h.target, h.parsedScope);
  if (bad) {
    const msg = `BLOCKED — OUT OF SCOPE: ${bad} is not part of this programme. Nothing was opened.`;
    try { h.record(huntId, { type: 'scope_block', tool: 'browser_open', detail: url.slice(0, 300), via: 'be-a-brain' }); } catch { /* best-effort */ }
    h.failProcess('out_of_scope', msg);
    return { ok: false, error: 'out_of_scope', output: msg };
  }
  const gui = await defaultGui(huntId, h.target, h.parsedScope, h.d);
  let res = null;
  try { res = await gui.open(huntId, url); } catch (err) { res = { ok: false, observation: String((err && err.message) || err) }; }
  h.observation = (res && res.observation) || '(no observation)';
  h.recordExecuted();
  return h.finish();
}

export async function executeBrowserAction(huntId, action, h) {
  const text = String(action.text || '');
  if (!text.trim()) { h.failProcess('empty_command', `${h.kind} needs text.`); return { ok: false, error: 'empty_command', message: `${h.kind} needs text.` }; }
  // GUI-TYPE-TARGET (28 Oct 2026): a type names its field — the
  // form composer and the JSON reply both send `selector` for it,
  // and the old code read only `action.text`, so the selector was
  // silently dropped and the driver typed blind. A type without a
  // field target is refused before anything runs.
  let fieldTarget = '';
  if (h.kind === 'browser_type') {
    fieldTarget = String(action.selector || action.target || '').trim();
    if (!fieldTarget) {
      const msg = 'browser_type needs a field target — the label or CSS selector of the field to type into (e.g. "Username" or "input[name=password]"). Take a browser_snapshot and name the field; never type blind.';
      h.failProcess('missing_target', msg);
      return { ok: false, error: 'missing_target', message: msg };
    }
  }
  const gui = await defaultGui(huntId, h.target, h.parsedScope, h.d);
  // FIX (#367, gap 2): clicks/types had no scope gate — they act on
  // the CURRENT page, so gate on the current page's URL (from a
  // snapshot) before acting, mirroring browser_open's gate. The CDP
  // layer's wrong_page guard stays the backstop for tabs it picks.
  // When the current URL cannot be determined (a stub gui without
  // snapshot, or a snapshot failure), the gate is skipped and the
  // backstop is the only guard — the click then still refuses via
  // wrong_page when no tab is on target.
  let currentUrl = null;
  try {
    if (typeof gui.snapshot === 'function') {
      const snap = await gui.snapshot(huntId);
      currentUrl = (snap && snap.snapshot && snap.snapshot.url) || null;
    }
  } catch { currentUrl = null; }
  if (currentUrl) {
    const bad = scopeViolation(currentUrl, h.target, h.parsedScope);
    if (bad) {
      const msg = `BLOCKED — OUT OF SCOPE: ${bad} is not part of this programme. Nothing was clicked or typed.`;
      try { h.record(huntId, { type: 'scope_block', tool: h.kind, detail: String(currentUrl).slice(0, 300), via: 'be-a-brain' }); } catch { /* best-effort */ }
      h.failProcess('out_of_scope', msg);
      return { ok: false, error: 'out_of_scope', output: msg };
    }
  }
  let res = null;
  try {
    res = h.kind === 'browser_click'
      ? await gui.click(huntId, text)
      : await gui.type(huntId, fieldTarget, text, action.submit === true);
  } catch (err) { res = { ok: false, observation: String((err && err.message) || err) }; }
  h.observation = (res && res.observation) || '(no observation)';
  // NO FAKE SUCCESS (28 Oct 2026, the DVWA login failure): a GUI
  // action the driver refused is a FAILED step, not a completed
  // one. The attempt itself is recorded (tool_call + note, so the
  // action index keeps it recallable with its failure as output),
  // but the process is marked failed and the console gets an
  // error — the old code called finish() unconditionally, so every
  // failed click/type still showed task_complete.
  if (res && res.ok === false) {
    h.recordExecuted();
    h.failProcess('gui_failed', h.observation);
    return { ok: false, error: 'gui_failed', message: String(h.observation).slice(0, 300), output: h.observation };
  }
  h.recordExecuted();
  return h.finish();
}
