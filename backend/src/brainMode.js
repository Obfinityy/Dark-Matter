// Be a Brain (28 Oct 2026, owner order) — the owner IS the hunt brain.
//
// The AI loop is paused and the parent submits the next action himself,
// in the SAME shape the AI brain uses, through the SAME machinery the
// AI loop uses. Nothing here invents a second execution path:
//
//   shell          -> huntAgent.executeWithEvasion (the AI shell path),
//                    which rides execInHuntContainerWithRespawn
//   browser_open / browser_click / browser_type
//                  -> guiTools, bound to the same raw exec as the loop
//   recall         -> actionIndex.recallById / recallByHash (pure)
//   claim_finding  -> humanLoop.claimGateCheck, then the SAME pipeline
//                    verifier the AI's claims go through
//                    (huntAgent.assessResult: evidenceReproduced +
//                    verifyPipeline + the 404 error-page protection)
//
// Every executed parent action is recorded exactly like an AI action:
// a tool_call event (via 'be-a-brain', by 'parent') + a reasoning note,
// so it lands in the action index with a content-hash and can be
// recalled by #N or by hash like any other action.
//
// GATES — stated explicitly (see the header of executeBrainAction):
//   APPLY to a parent action: scope (out-of-scope URLs/commands are
//     refused, same as the AI), the claim completeness gate, the
//     pipeline verifier (evidenceReproduced + verifyPipeline), and
//     the 404 error-page protection inside that verifier.
//   BYPASSED, deliberately: the exact-repeat dedup gate, the
//     output-ledger recall shortcut, the auth-loop / exhausted-surface
//     / proof gates, and the heavy-scan pattern gate. The parent is a
//     human choosing to repeat — a dedup block on his own deliberate
//     repeat would be the bug this lane fixes, not a protection. The
//     heavy-scan patterns live unexported inside humanLoop.js, so
//     they cannot be reused without forking them; a follow-up lane
//     should export them and apply them here too.

import {
  buildActionIndex,
  recallByHash,
  recallById,
  parseRecallId,
  formatFullRecord,
  contentHash,
} from './actionIndex.js';
import {
  appendHuntEvent,
  readHuntEvents,
  readHuntMeta,
  writeHuntMeta,
  writeHuntMetaCheckpoint,
} from './store.js';
import { getAllReasoning, recordReasoning } from './reasoningMemory.js';
import { loopStateFor } from './humanLoopDriver.js';
import {
  EngineUnreachableError,
  EngineError,
  pauseEngineHunt,
  resumeEngineHunt,
} from './engine.js';
import {
  claimGateCheck,
  claimClassFromTitle,
  extractTaskBlock,
  scopeViolation,
  pendingPlannedProbes,
  targetHostsFor,
} from './humanLoop.js';
import { normaliseCoverageClass } from './coverageLedger.js';

export const BRAIN_MODES = ['ai', 'parent'];

// Module-level override seam for the loop-control deps (pause/resume
// engine calls, resumeInterruptedHunt) — same pattern as the
// brain-action seam below. Production never sets it. The lab script
// uses it so handing back to AI does not launch a real hunt loop in
// the sandbox; unit tests pass deps explicitly instead.
let brainModeOverrides = null;
export function configureBrainModeDeps(deps) {
  brainModeOverrides = { ...(brainModeOverrides || {}), ...(deps || {}) };
  return brainModeOverrides;
}
export function resetBrainModeDeps() { brainModeOverrides = null; }
function resolveModeDeps(deps = {}) {
  return { ...(brainModeOverrides || {}), ...deps };
}

/** The hunt's brain mode: 'ai' (default) or 'parent' (the owner). */
export function getBrainMode(meta) {
  return meta && meta.brainMode === 'parent' ? 'parent' : 'ai';
}

const isEngineDown = (err) =>
  err instanceof EngineUnreachableError || err instanceof EngineError;

// --- pause / resume of the AI loop -----------------------------------------
// The SAME machinery POST /:id/pause and POST /:id/resume use: try the
// engine call first; when there is no engine on this box (host-side
// hunt), fall back to the meta flags + status event the loop honours.
// Deliberately NOT a hand-edit of meta.json: the fallback is the
// route's fallback, factored so both call sites stay identical.

export async function pauseHuntLoop(huntId, deps = {}) {
  deps = resolveModeDeps(deps);
  const pauseEngine = deps.pauseEngine || pauseEngineHunt;
  const readMeta = deps.readMeta || readHuntMeta;
  const writeMeta = deps.writeMeta || writeHuntMeta;
  const record = deps.record || appendHuntEvent;
  try {
    const data = await pauseEngine(huntId);
    return { ok: true, via: 'engine', engine: data ?? null };
  } catch (err) {
    if (!isEngineDown(err)) throw err;
    const m0 = readMeta(huntId) || {};
    writeMeta(huntId, { ...m0, huntId, paused: true, state: 'paused' });
    try { record(huntId, { type: 'status', state: 'paused', reason: 'brain_mode_parent', at: new Date().toISOString() }); } catch { /* best-effort */ }
    return { ok: true, via: 'host' };
  }
}

export async function resumeHuntLoop(huntId, deps = {}) {
  deps = resolveModeDeps(deps);
  const resumeEngine = deps.resumeEngine || resumeEngineHunt;
  const readMeta = deps.readMeta || readHuntMeta;
  const writeMeta = deps.writeMeta || writeHuntMeta;
  const record = deps.record || appendHuntEvent;
  try {
    const data = await resumeEngine(huntId);
    const effectiveId =
      data && typeof data.huntId === 'string' && data.huntId !== huntId ? data.huntId : huntId;
    return { ok: true, via: 'engine', huntId: effectiveId, engine: data ?? null };
  } catch (err) {
    if (!isEngineDown(err)) throw err;
    const m0 = readMeta(huntId) || {};
    if (['stopped', 'finished', 'failed'].includes(String(m0.state || '').toLowerCase())) {
      return { ok: false, error: 'hunt_terminal', state: m0.state };
    }
    writeMeta(huntId, { ...m0, huntId, paused: false, stopped: false, state: 'running' });
    try { record(huntId, { type: 'status', state: 'resumed', reason: 'brain_mode_ai', at: new Date().toISOString() }); } catch { /* best-effort */ }
    // Actually restart the agent loop from the checkpoint — flags
    // alone leave a "running" hunt that does nothing (same call the
    // POST /:id/resume host fallback makes). Injectable for tests.
    try {
      if (typeof deps.resumeInterruptedHunt === 'function') {
        await deps.resumeInterruptedHunt(huntId);
      } else {
        const { resumeInterruptedHunt } = await import('./huntAgent.js');
        resumeInterruptedHunt(huntId).catch((e) => {
          try { record(huntId, { type: 'status', state: 'failed', error: String((e && e.message) || e) }); } catch { /* best-effort */ }
        });
      }
    } catch (e) {
      try { record(huntId, { type: 'status', state: 'failed', error: String((e && e.message) || e) }); } catch { /* best-effort */ }
    }
    return { ok: true, via: 'host' };
  }
}

// --- brain-mode switching --------------------------------------------------

/**
 * Set who the brain is. Setting 'parent' PAUSES the AI loop via the
 * existing pause machinery; setting 'ai' hands the brain back and
 * resumes the AI loop from the checkpoint via the existing resume
 * machinery. The hunt stays paused while the parent is the brain, so
 * the AI loop can never interleave with the parent's actions.
 * Returns { ok, brainMode, state } (or { ok:false, error }).
 */
export async function setBrainMode(huntId, mode, deps = {}) {
  deps = resolveModeDeps(deps);
  const readMeta = deps.readMeta || readHuntMeta;
  const writeMeta = deps.writeMeta || writeHuntMeta;
  const record = deps.record || appendHuntEvent;
  const m = String(mode || '').trim().toLowerCase();
  if (!BRAIN_MODES.includes(m)) {
    return { ok: false, error: 'invalid_mode', message: "mode must be 'parent' or 'ai'" };
  }
  const meta = readMeta(huntId);
  if (!meta) return { ok: false, error: 'hunt_not_found' };
  if (getBrainMode(meta) === m) {
    return { ok: true, brainMode: m, state: meta.state || null, unchanged: true };
  }
  if (m === 'parent') {
    const paused = await pauseHuntLoop(huntId, deps);
    if (!paused.ok) return { ok: false, error: paused.error || 'pause_failed' };
  } else {
    const resumed = await resumeHuntLoop(huntId, deps);
    if (!resumed.ok) {
      return { ok: false, error: resumed.error || 'resume_failed', state: resumed.state || null };
    }
    if (resumed.huntId && resumed.huntId !== huntId) {
      // Engine resume-via-recreate: the NEW hunt id is the live one.
      // The mode switch belongs on it; the old hunt stays as it was.
      const newMeta = readMeta(resumed.huntId) || {};
      writeMeta(resumed.huntId, { ...newMeta, huntId: resumed.huntId, brainMode: m, paused: false, stopped: false, state: 'running' });
      try { record(resumed.huntId, { type: 'status', state: 'brain_mode', brainMode: m, at: new Date().toISOString() }); } catch { /* best-effort */ }
      return { ok: true, brainMode: m, state: 'running', huntId: resumed.huntId };
    }
  }
  // Re-read AFTER the pause/resume wrote its flags, so this write
  // cannot clobber them with the stale pre-switch meta. The loop
  // flags are (re-)asserted here on purpose: the ENGINE pause path
  // never touches meta, but the host loop driver reads meta.paused
  // / meta.state to decide whether to run — and the requirement is
  // that the hunt STAYS paused while the parent is the brain, on
  // every path, not just the host fallback.
  const fresh = readMeta(huntId) || meta;
  const loopFlags = m === 'parent'
    ? { paused: true, state: 'paused' }
    : { paused: false, stopped: false, state: 'running' };
  writeMeta(huntId, { ...fresh, huntId, brainMode: m, ...loopFlags });
  try { record(huntId, { type: 'status', state: 'brain_mode', brainMode: m, at: new Date().toISOString() }); } catch { /* best-effort */ }
  const after = readMeta(huntId) || fresh;
  return { ok: true, brainMode: m, state: after.state || null };
}

// --- action index listing --------------------------------------------------
//
// Status derivation (defined here, nowhere else):
//   'failed' — the index outcome for the action is 'blocked' or
//     'fail' (the reasoning note recorded an error, a block or a
//     rejection for it), or the action is claim_finding whose note
//     says it was not verified.
//   'running' — the MOST RECENT index entry, and ONLY when the AI
//     loop is currently running AND the hunt's very last event is
//     that action's own tool_call: it was dispatched and no later
//     event (thinking, task_complete, status, dedup_block, …) has
//     recorded anything after it yet. In practice a tool_call is
//     followed almost immediately by its reasoning note, so 'running'
//     is a brief transient state, never a stale label: a paused hunt
//     never reports 'running', and any later event retires it.
//   'done' — everything else: the action executed and its record
//     stands (including 'verified' / 'found' / 'claimed' outcomes).

export function entryStatus(entry, { huntRunning = false, isLastEvent = false } = {}) {
  if (entry && (entry.outcome === 'blocked' || entry.outcome === 'fail')) return 'failed';
  if (huntRunning && isLastEvent) return 'running';
  return 'done';
}

function publicEntry(entry, status) {
  return {
    n: entry.n,
    hash: entry.hash,
    tool: entry.tool,
    label: entry.label,
    detail: entry.detail,
    at: entry.at || '',
    outcome: entry.outcome || '',
    status,
  };
}

export function listBrainActions(events, reasoningRows = [], { huntRunning = false } = {}) {
  const entries = buildActionIndex(events, reasoningRows);
  const lastEvent = (events || []).length ? events[events.length - 1] : null;
  return entries.map((entry, i) => {
    const isLast = i === entries.length - 1 && !!lastEvent &&
      lastEvent.type === 'tool_call' && lastEvent === entry.event;
    return publicEntry(entry, entryStatus(entry, { huntRunning, isLastEvent: isLast }));
  });
}

// --- output by hash --------------------------------------------------------
// recallByHash was COMPLETE as found — it returns {entry, event, note}
// for the first action with that hash, or {error}. This wrapper only
// shapes it into the route's contract; no fix was needed.

export function outputByHash(events, reasoningRows = [], hash) {
  const rec = recallByHash(events, reasoningRows, hash);
  if (!rec || rec.error) {
    return { ok: false, error: 'unknown_hash', message: String((rec && rec.error) || 'unknown hash') };
  }
  return {
    ok: true,
    hash: rec.entry.hash,
    output: formatFullRecord(rec),
    entry: publicEntry(rec.entry, 'done'),
  };
}

// --- live process state ----------------------------------------------------
// Derived from LIVE sources only — nothing is invented:
//   meta.loop (humanLoopDriver.loopStateFor) — loop enabled/cycles
//   meta.currentTask — the in-progress structured task block the loop
//     persists at each checkpoint; else the newest task_complete
//     event (a finished task, with its goal/progress/summary)
//   the action index — done = labels of executed actions
//   pendingPlannedProbes — skill cards pulled with no probe sent yet
//     (the loop's own pending-work derivation)
// No separate process-state record was needed: every field has a
// live source. The one write this lane adds is the parent's own task
// block (see executeBrainAction): a parent-submitted in_progress
// task block is persisted to meta.currentTask via the guarded
// checkpoint writer, and a complete one is recorded as a
// task_complete event — the same two places the AI loop writes.

export function deriveProcessState(huntId, { meta = {}, events = [], reasoningRows = [] } = {}) {
  const brainMode = getBrainMode(meta);
  const state = String(meta.state || meta.status || 'unknown');
  const running = state === 'running' && meta.paused !== true && meta.stopped !== true;
  const loop = loopStateFor(huntId, meta);

  let task = null;
  let goal = null;
  let progress = null;
  let summary = null;
  let taskStatus = null;
  const current = meta.currentTask && typeof meta.currentTask === 'object' ? meta.currentTask : null;
  if (current && (current.task || current.goal)) {
    task = current.task || null;
    goal = current.goal || null;
    progress = current.progress || null;
    summary = current.summary || null;
    taskStatus = 'in_progress';
  } else {
    for (let i = (events || []).length - 1; i >= 0; i--) {
      const e = events[i];
      if (e && e.type === 'task_complete') {
        task = e.task || null;
        goal = e.goal || null;
        progress = e.progress || null;
        summary = e.summary || null;
        taskStatus = 'complete';
        break;
      }
    }
  }

  const actions = listBrainActions(events, reasoningRows, { huntRunning: running });
  const done = actions.filter((a) => a.status === 'done').map((a) => a.label).slice(-20);
  const pending = pendingPlannedProbes({ events, reasoningRows })
    .map((p) => `${p.topic.label} — skill "${p.skill}" pulled ${p.when}, no probe sent yet`)
    .slice(0, 20);

  return {
    ok: true,
    running,
    task,
    goal,
    progress,
    summary,
    taskStatus,
    done,
    pending,
    brainMode,
    state,
    iteration: meta.iteration ?? (meta.humanLoop && meta.humanLoop.turnsTotal) ?? null,
    loop: { enabled: loop.enabled, cycles: loop.cycles, lastCycleAt: loop.lastCycleAt, running: loop.running },
  };
}

// --- parent action execution -----------------------------------------------

const OBS_BUDGET = 3500;
const COMMAND_CAP = 4000;

// Module-level override seam for the lab script (a fake container shim
// — no docker in this sandbox) and for tests that mount the real
// router. Production never sets it: the defaults below are the real
// machinery. configureBrainActionDeps replaces individual deps only;
// resetBrainActionDeps restores the real defaults.
let brainActionOverrides = null;
export function configureBrainActionDeps(deps) {
  brainActionOverrides = { ...(brainActionOverrides || {}), ...(deps || {}) };
  return brainActionOverrides;
}
export function resetBrainActionDeps() { brainActionOverrides = null; }

function resolveDeps(deps = {}) {
  return { ...(brainActionOverrides || {}), ...deps };
}

function detailForAction(kind, action) {
  switch (kind) {
    case 'shell': return String(action.command || '').slice(0, COMMAND_CAP);
    case 'browser_open': return String(action.url || '');
    case 'browser_click': return String(action.text || '');
    case 'browser_type': return String(action.text || '').slice(0, 80);
    case 'claim_finding': return String(action.title || '').slice(0, 200);
    case 'recall': {
      if (action.id != null) return `#${String(action.id).replace(/^#/, '')}`;
      if (action.hash) return `hash:${String(action.hash).slice(0, 32)}`;
      return String(action.query || '').slice(0, 200);
    }
    default: return '';
  }
}

async function defaultExec(huntId, target, command, deps) {
  if (typeof deps.exec === 'function') return deps.exec(huntId, target, command);
  const { executeWithEvasion } = await import('./huntAgent.js');
  return executeWithEvasion(huntId, target, command);
}

async function defaultGui(huntId, target, parsedScope, deps) {
  if (deps.gui) return deps.gui;
  const { guiBrowserOpen, guiBrowserClick, guiBrowserType } = await import('./guiTools.js');
  const execRaw = deps.execRaw || ((h, c, t, o) => import('./huntRunner.js').then((hr) => hr.execInHuntContainerWithRespawn(h, c, t, o)));
  const targetHosts = targetHostsFor(target, parsedScope);
  return {
    open: (h, url) => guiBrowserOpen(h, url, { exec: execRaw, targetHosts, targetUrl: target }),
    click: (h, text) => guiBrowserClick(h, text, { exec: execRaw, targetHosts, targetUrl: target }),
    type: (h, text, submit) => guiBrowserType(h, text, submit, { exec: execRaw, targetHosts, targetUrl: target }),
  };
}

async function defaultAssess(deps) {
  if ('assess' in deps) return deps.assess; // null = disabled, fn = stub
  const { assessResult } = await import('./huntAgent.js');
  return assessResult || null;
}

/**
 * Execute ONE parent-submitted action, in the AI brain's shape.
 *
 * GATE LIST (explicit — see the module header for the reasons):
 *   APPLY: scope (scopeViolation on shell commands / browser_open
 *     URLs — out-of-scope is refused, nothing is sent or opened);
 *     claim completeness gate (claimGateCheck); the pipeline
 *     verifier (assessResult — evidenceReproduced, verifyPipeline,
 *     and its 404 error-page protection, exactly as for an AI
 *     claim); the 404 protection is never weakened.
 *   BYPASSED: the exact-repeat dedup gate (dedupeGateHit is never
 *     consulted — the parent is a human deliberately repeating);
 *     the output-ledger recall shortcut (a repeat re-executes and
 *     returns fresh output; the saved output stays recallable by
 *     hash); the auth-loop, exhausted-surface and proof gates (all
 *     three exist to stop an AI looping blindly — the parent sees
 *     the page and chooses); the heavy-scan pattern gate (its
 *     patterns are unexported inside humanLoop.js — cannot be
 *     reused without forking; follow-up lane should export them).
 *   The take-control (VNC) lock is a different concept (who holds
 *   the desktop) and is not consulted here: brain-mode already
 *   guarantees the AI loop is paused, so no driver can interleave.
 *
 * Returns { ok, hash, output, entry } on execution (plus
 * { verified, finding } for a claim), or { ok:false, error, ... }
 * for a refusal (brain_mode_ai, unknown_action, out_of_scope,
 * claim_incomplete, empty_command).
 */
export async function executeBrainAction(huntId, action, deps = {}) {
  const d = resolveDeps(deps);
  const record = d.record || appendHuntEvent;
  const recordNote = d.recordNote || recordReasoning;
  const readMeta = d.readMeta || readHuntMeta;
  const readEvents = d.readEvents || readHuntEvents;
  const readReasoning = d.readReasoning || getAllReasoning;
  const writeMetaCheckpoint = d.writeMeta || writeHuntMetaCheckpoint;

  if (!action || typeof action !== 'object' || typeof action.action !== 'string' || !action.action.trim()) {
    return { ok: false, error: 'unknown_action', message: 'Send {action: <tool>, ...} in the AI brain\'s shape.' };
  }
  const kind = action.action.trim().toLowerCase();
  const SUPPORTED = new Set(['shell', 'browser_open', 'browser_click', 'browser_type', 'recall', 'claim_finding']);
  if (!SUPPORTED.has(kind)) {
    return { ok: false, error: 'unknown_action', message: `Unknown action "${kind}". Supported: ${[...SUPPORTED].join(', ')}.` };
  }

  const meta = readMeta(huntId) || {};
  if (getBrainMode(meta) !== 'parent') {
    return {
      ok: false,
      error: 'brain_mode_ai',
      message: 'The AI is the brain right now — switch to parent mode (POST /:id/brain-mode {mode:"parent"}) before submitting an action.',
    };
  }
  const target = String(meta.target || '');
  const parsedScope = meta.parsedScope || null;

  // The parent's own structured task block, recorded exactly like
  // the AI's (humanLoop.js ~4200): complete -> task_complete event
  // now; in_progress -> meta.currentTask, so the process state and
  // the next AI screen resume it instead of starting fresh.
  const taskBlock = extractTaskBlock(action);
  if (taskBlock) {
    try {
      if (taskBlock.status === 'complete') {
        record(huntId, { type: 'task_complete', task: taskBlock.task || '', goal: taskBlock.goal || '', progress: taskBlock.progress || '', summary: taskBlock.summary || '', via: 'be-a-brain' });
      } else {
        writeMetaCheckpoint(huntId, { currentTask: { ...taskBlock, status: 'in_progress', updatedAt: new Date().toISOString() } });
      }
    } catch { /* task-block persistence is best-effort */ }
  }

  const detail = detailForAction(kind, action);
  const tool = kind;
  let observation = '';
  let verified = undefined;
  let finding = undefined;

  // Record the executed action exactly like the AI loop's toolCall:
  // a tool_call event + a reasoning note, so the action index picks
  // it up with a content-hash. (claim_bounce and scope refusals do
  // NOT get a tool_call — same as the AI loop, which never records
  // a refused action as executed.)
  const recordExecuted = () => {
    try { record(huntId, { type: 'tool_call', tool, detail: String(detail || '').slice(0, 300), via: 'be-a-brain', by: 'parent' }); } catch { /* best-effort */ }
    try {
      recordNote(huntId, {
        action: `${tool}: ${String(detail || '').slice(0, 160)}`,
        why: String(action.why || 'parent brain action').slice(0, 300),
        result: String(observation || '').slice(0, 300),
        learned: '',
      });
    } catch { /* best-effort */ }
  };
  const finish = () => {
    const hash = contentHash(tool, String(detail || '').slice(0, 300));
    let entry = null;
    try {
      const entries = buildActionIndex(readEvents(huntId) || [], readReasoning(huntId) || []);
      const match = entries.filter((e) => e.hash === hash);
      if (match.length) entry = publicEntry(match[match.length - 1], 'done');
    } catch { /* index read is best-effort */ }
    return {
      ok: true,
      hash,
      output: observation,
      entry: entry || { n: null, hash, tool, label: `${tool} | — | ${String(detail || '').slice(0, 40)} | done`, detail, at: '', outcome: 'done', status: 'done' },
      ...(verified !== undefined ? { verified } : {}),
      ...(finding ? { finding } : {}),
    };
  };

  if (kind === 'shell') {
    const command = String(action.command || '').slice(0, COMMAND_CAP);
    if (!command.trim()) return { ok: false, error: 'empty_command', message: 'shell needs a command.' };
    const badUrl = (() => {
      try {
        const urls = command.match(/https?:\/\/[^\s'"<>)|\]]+/gi) || [];
        for (const u of urls) {
          const v = scopeViolation(u, target, parsedScope);
          if (v) return v;
        }
        return null;
      } catch { return null; }
    })();
    if (badUrl) {
      const msg = `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. Only test ${target} and its listed assets. Nothing was sent.`;
      try { record(huntId, { type: 'scope_block', tool: 'shell', detail: command.slice(0, 300), via: 'be-a-brain' }); } catch { /* best-effort */ }
      return { ok: false, error: 'out_of_scope', output: msg };
    }
    // The tool_call + note are recorded AFTER execution (recordExecuted
    // below), so the note carries the real result.
    let result;
    try {
      result = await defaultExec(huntId, target, command, d);
    } catch (err) {
      result = { stdout: '', stderr: String((err && err.message) || err), code: 1 };
    }
    const combined = `${(result && result.stdout) || ''}\n${(result && result.stderr) || ''}`.trim();
    observation = combined.length > OBS_BUDGET
      ? `${combined.slice(0, OBS_BUDGET)}\n[output truncated on screen — ${combined.length} chars total]`
      : (combined || `(command finished with no output, exit code ${(result && result.code) ?? 0})`);
    if (result && result.code && result.code !== 0) observation += `\n[exit code ${result.code}]`;
    recordExecuted();
    return finish();
  }

  if (kind === 'browser_open') {
    const url = String(action.url || '');
    if (!url.trim()) return { ok: false, error: 'empty_command', message: 'browser_open needs a url.' };
    const bad = scopeViolation(url, target, parsedScope);
    if (bad) {
      const msg = `BLOCKED — OUT OF SCOPE: ${bad} is not part of this programme. Nothing was opened.`;
      try { record(huntId, { type: 'scope_block', tool: 'browser_open', detail: url.slice(0, 300), via: 'be-a-brain' }); } catch { /* best-effort */ }
      return { ok: false, error: 'out_of_scope', output: msg };
    }
    const gui = await defaultGui(huntId, target, parsedScope, d);
    let res = null;
    try { res = await gui.open(huntId, url); } catch (err) { res = { ok: false, observation: String((err && err.message) || err) }; }
    observation = (res && res.observation) || '(no observation)';
    recordExecuted();
    return finish();
  }

  if (kind === 'browser_click' || kind === 'browser_type') {
    const text = String(action.text || '');
    if (!text.trim()) return { ok: false, error: 'empty_command', message: `${kind} needs text.` };
    const gui = await defaultGui(huntId, target, parsedScope, d);
    let res = null;
    try {
      res = kind === 'browser_click'
        ? await gui.click(huntId, text)
        : await gui.type(huntId, text, action.submit === true);
    } catch (err) { res = { ok: false, observation: String((err && err.message) || err) }; }
    observation = (res && res.observation) || '(no observation)';
    recordExecuted();
    return finish();
  }

  if (kind === 'recall') {
    let rec = null;
    const idRaw = action.id;
    if (idRaw !== undefined && idRaw !== null && String(idRaw).trim() !== '') {
      const n = parseRecallId(idRaw);
      if (n == null) return { ok: false, error: 'unknown_action', message: 'recall needs an id like 7 or "#7", or a hash.' };
      rec = recallById(readEvents(huntId) || [], readReasoning(huntId) || [], n);
    } else if (action.hash) {
      rec = recallByHash(readEvents(huntId) || [], readReasoning(huntId) || [], action.hash);
    } else {
      return { ok: false, error: 'unknown_action', message: 'recall needs {id: N} or {hash: "..."}.' };
    }
    if (!rec || rec.error) {
      return { ok: false, error: 'unknown_hash', output: String(rec && rec.error ? rec.error : 'nothing recalled') };
    }
    observation = formatFullRecord(rec);
    recordExecuted();
    // The recall's own tool_call must not shadow the recalled
    // entry: return the RECALLED record as the entry, with the
    // recall's hash carried alongside.
    const recalledEntry = publicEntry(rec.entry, 'done');
    const own = finish();
    return { ...own, output: observation, entry: recalledEntry, recalledHash: rec.entry.hash };
  }

  if (kind === 'claim_finding') {
    const rawTitle = String(action.title || '');
    const title = String(rawTitle.trim() ? rawTitle : 'Untitled claim').slice(0, 200);
    const evidence = String(action.evidence || '');
    const command = String(action.command || '').slice(0, COMMAND_CAP);
    let pocExists = false;
    const poc = String(action.poc || '').trim().slice(0, 120);
    if (poc) {
      try {
        if (typeof d.pocExists === 'function') pocExists = Boolean(d.pocExists(huntId, poc));
        else {
          const { artifactInfo } = await import('./artifacts.js');
          pocExists = Boolean(artifactInfo(huntId, poc));
        }
      } catch { pocExists = false; }
    }
    // COMPLETE-THE-PROOF GATE — same as the AI loop: an incomplete
    // claim is bounced UNRECORDED (claim_bounce event), the verifier
    // never sees it.
    const gate = claimGateCheck({
      title: rawTitle,
      cls: normaliseCoverageClass(action.class) || claimClassFromTitle(rawTitle),
      command,
      poc,
      pocExists,
      evidence,
      counterevidence: action.counterevidence,
      confidence: action.confidence,
      rationale: action.confidence_rationale,
    });
    if (!gate.ok) {
      try { record(huntId, { type: 'claim_bounce', tool: 'claim_finding', detail: title, missing: gate.missing.map((x) => x.field), via: 'be-a-brain' }); } catch { /* best-effort */ }
      return {
        ok: false,
        error: 'claim_incomplete',
        missing: gate.missing.map((x) => x.field),
        output: 'CLAIM NOT RECORDED — the proof package is incomplete, so the verifier never saw it. Missing: ' +
          gate.missing.map((x) => x.hint).join('; ') +
          '. Complete every piece and claim again.',
      };
    }
    // The filing itself goes through the SAME verifier as an AI
    // claim: assessResult re-runs the command, applies the evidence
    // gate, evidenceReproduced, the 4-step verifyPipeline and the
    // 404 error-page protection — and records the finding event.
    // The tool_call + note are recorded below, once the verdict is
    // known, so the note carries it.
    const assess = await defaultAssess(d);
    if (!assess) {
      try {
        record(huntId, {
          type: 'finding', class: 'agent_finding', title, severity: 'medium', url: target,
          evidence: { request: command, response: evidence.slice(0, 3000) },
          verified: false, verification: 'be-a-brain parent claim — pending pipeline verification', via: 'be-a-brain',
        });
      } catch { /* best-effort */ }
      observation = 'Recorded as an UNVERIFIED claim (no pipeline verifier is wired into this session). It does not count as a finding until the verifier confirms it.';
      verified = false;
    } else {
      const plan = {
        test: title,
        command,
        why: 'Be-a-Brain parent claim — the owner reproduced this himself and asked for independent verification.',
        hypothesis: title,
      };
      const result = { stdout: evidence, stderr: '', code: 0 };
      let rec = null;
      try {
        rec = await assess(huntId, target, plan, result);
      } catch (err) {
        observation = `Verification could not run (${String((err && err.message) || err)}). Your claim was NOT verified — reproduce it cleanly and claim again with the exact command + output.`;
        verified = false;
      }
      if (rec) {
        verified = Boolean(rec.verified);
        finding = rec;
        observation = rec.verified
          ? `VERIFIED by the independent verifier: "${rec.title}" (${rec.severity}). It counts.`
          : `NOT verified: ${rec.verification || 'the verifier rejected the claim'}. A rejected claim is a dead end, not a finding — either your evidence does not prove it, or the command does not reproduce it. Do not re-claim the same thing; dig for real proof or move on.`;
      } else if (observation === '') {
        observation = 'Verification returned nothing — the claim was NOT verified.';
        verified = false;
      }
    }
    recordExecuted();
    return finish();
  }

  return { ok: false, error: 'unknown_action', message: `Unknown action "${kind}".` };
}
