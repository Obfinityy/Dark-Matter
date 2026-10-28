// Brain JSON reply — validator + dispatch mapping (28 Oct 2026,
// brain-json lane).
//
// The brain (AI or parent) sends ONE reply per turn as JSON:
//   { task, goal, progress, recall?, action }
// See brainReply.schema.json — the documented, human-readable,
// editable contract. This module validates a reply object against
// it by hand (NO new npm dependency — the schema file is the
// contract, this is the enforcer; both must be kept in step).
//
//   validateBrainReply(reply) -> { ok: true }
//                            or { ok: false, errors: [{field, message}] }
//     Every error names the bad field, using the schema's JSON paths
//     (e.g. 'action.command', 'recall', 'action.type').
//
//   brainReplyToAction(reply) -> { action, task }
//     Maps the reply's action onto the shape executeBrainAction
//     (brainMode.js) already dispatches: 'click' -> 'browser_click'
//     (selector is the clickable text), 'type' -> 'browser_type';
//     the rest keep their names. Attaches the reply's
//     task/goal/progress as the structured task block, so the live
//     process view shows the step and the hunt memory records it.
//
// Guards are NOT re-implemented here: scope, the claim completeness
// gate, the pipeline verifier and the 404 error-page protection all
// live in executeBrainAction and apply to JSON replies exactly as
// to form-composer actions. This validator only checks SHAPE —
// that the reply is complete enough to dispatch.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'brainReply.schema.json');

let schemaCache = null;
/** The parsed schema document (the contract), loaded lazily once. */
export function loadBrainReplySchema() {
  if (!schemaCache) schemaCache = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return schemaCache;
}

// OS-CONTROL types (28 Oct 2026): the parent brain drives the whole
// Kali machine — the same surface the AI brain has. Long names pass
// through to executeBrainAction unchanged (see brainReplyToAction).
export const OS_REPLY_ACTION_TYPES = ['browser_snapshot', 'screenshot', 'desktop_snapshot', 'desktop_click', 'desktop_key', 'desktop_click_at', 'desktop_click_control', 'list_controls', 'desktop_screenshot', 'see_screen', 'desktop_terminal', 'launch_tool', 'download_tool', 'proxy_start', 'intercept_list', 'intercept_read', 'intercept_replay'];
export const BRAIN_ACTION_TYPES = ['shell', 'browser_open', 'click', 'type', 'recall', 'claim_finding', ...OS_REPLY_ACTION_TYPES];
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const CONFIDENCES = new Set(['high', 'medium', 'low']);

const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
// A recall id: 7, '7' or '#7'.
const isRecallId = (v) =>
  (typeof v === 'number' && Number.isInteger(v) && v >= 1) ||
  (typeof v === 'string' && /^#?\d+$/.test(v.trim()) && parseInt(v.trim().replace(/^#/, ''), 10) >= 1);

/**
 * Validate one brain reply. Checks, in order: the reply is an
 * object; task/goal/progress are present non-empty strings; an
 * optional top-level recall carries exactly one of hash/id; the
 * action is an object whose type is in the enum; the per-type
 * required fields are present. The claim package is checked
 * against what the claim completeness gate needs (title, severity,
 * command, evidence, counterevidence, confidence) — a reply that
 * passed here but missed one of those would only ever bounce at
 * the gate, so the schema refuses it up front, naming the field.
 */
export function validateBrainReply(reply) {
  const errors = [];
  const bad = (field, message) => errors.push({ field, message });

  if (!isObj(reply)) {
    return { ok: false, errors: [{ field: 'reply', message: 'Send a JSON reply object {task, goal, progress, action}.' }] };
  }
  for (const field of ['task', 'goal', 'progress']) {
    if (!isNonEmptyString(reply[field])) {
      bad(field, `"${field}" is required — a non-empty string (one line for task, the step's goal for goal, titles-only progress for progress).`);
    }
  }

  // Top-level recall: fetch this before acting. Exactly one of hash/id.
  if (reply.recall !== undefined && reply.recall !== null) {
    if (!isObj(reply.recall)) {
      bad('recall', '"recall" must be an object: {hash: "..."} or {id: N}.');
    } else {
      const hasHash = isNonEmptyString(reply.recall.hash);
      const hasId = isRecallId(reply.recall.id);
      const hashPresent = reply.recall.hash !== undefined && reply.recall.hash !== null;
      const idPresent = reply.recall.id !== undefined && reply.recall.id !== null;
      if (hashPresent && idPresent) {
        bad('recall', '"recall" needs exactly one of hash/id — send one, not both.');
      } else if (!hashPresent && !idPresent) {
        bad('recall', '"recall" needs exactly one of hash/id — send {hash: "..."} or {id: N}.');
      } else if (hashPresent && !hasHash) {
        bad('recall.hash', '"recall.hash" must be a non-empty string.');
      } else if (idPresent && !hasId) {
        bad('recall.id', '"recall.id" must an action number — 7, "7" or "#7".');
      }
      // RECALL WITH A REASON (28 Oct 2026, owner order): when the brain
      // needs past data it says WHY. The reason is optional in the
      // validator (never block a recall over it — the parent's live
      // hunting must not stall on a missing field), but the prompt
      // tells the brain to always give it, and the process file records
      // '(no reason given)' when it does not.
      if (reply.recall.reason !== undefined && reply.recall.reason !== null
        && (typeof reply.recall.reason !== 'string' || !reply.recall.reason.trim() || reply.recall.reason.length > 300)) {
        bad('recall.reason', '"recall.reason" must be a short string saying why you need this data (max 300 chars).');
      }
    }
  }

  // Action: one action, type in the enum, per-type fields present.
  const action = reply.action;
  if (!isObj(action)) {
    bad('action', '"action" is required — one action object with a "type".');
    return { ok: false, errors };
  }
  if (!isNonEmptyString(action.type)) {
    bad('action.type', '"action.type" is required.');
  } else if (!BRAIN_ACTION_TYPES.includes(action.type.trim())) {
    bad('action.type', `"action.type" must be one of: ${BRAIN_ACTION_TYPES.join(', ')}.`);
  } else {
    const type = action.type.trim();
    const need = (field, what) => {
      if (!isNonEmptyString(action[field])) bad(`action.${field}`, `"action.${field}" is required for a ${type} action — ${what}.`);
    };
    if (type === 'shell') need('command', 'the command to run');
    if (type === 'browser_open') need('url', 'the URL to open (must be in scope)');
    if (type === 'click') {
      if (!isNonEmptyString(action.selector) && !isNonEmptyString(action.text)) {
        bad('action.selector', 'a click action needs "selector" (the text/selector of what to click) — "text" is accepted in its place.');
      }
    }
    if (type === 'type') {
      // GUI-TYPE-TARGET (28 Oct 2026): 'selector' is REQUIRED for
      // type — it names the field to type into. The old rule made it
      // optional, so a reply could type blind; the driver then put
      // the text into whatever was focused (the DVWA login put
      // 'password' into the username field) and still reported
      // success. A type without a field is refused up front, naming
      // the field — exactly like a click without a target.
      need('selector', 'the field to type into — its visible label, name, or CSS selector (e.g. "Username" or "input[name=password]")');
      need('text', 'the text to type');
    }
    if (type === 'desktop_click') need('window', 'the window title to focus (take desktop_snapshot first if you do not know the titles)');
    if (type === 'desktop_key') {
      if (!isNonEmptyString(action.keys) && !isNonEmptyString(action.text)) {
        bad('action.keys', '"action.keys" (e.g. "ctrl+l") or "action.text" (words to type) is required for a desktop_key action.');
      }
    }
    if (type === 'desktop_click_at') {
      if (action.x === undefined || action.x === null || action.x === '') bad('action.x', '"action.x" is required for a desktop_click_at action — a point from the see_screen map.');
      if (action.y === undefined || action.y === null || action.y === '') bad('action.y', '"action.y" is required for a desktop_click_at action — a point from the see_screen map.');
    }
    if (type === 'desktop_click_control') need('control', "the control's visible name (e.g. \"Repeater\")");
    if (type === 'desktop_terminal') need('command', 'the command to run in the visible terminal');
    if (type === 'launch_tool' || type === 'download_tool') need('tool', 'the tool name (e.g. "burp")');
    if (type === 'intercept_read' || type === 'intercept_replay') {
      if (action.index === undefined || action.index === null || String(action.index).trim() === '') bad('action.index', '"action.index" is required — the # from intercept_list.');
    }
    if (type === 'recall') {
      const hashPresent = action.hash !== undefined && action.hash !== null;
      const idPresent = action.id !== undefined && action.id !== null;
      if (hashPresent && idPresent) {
        bad('action.recall', 'a recall action needs exactly one of hash/id — send one, not both.');
      } else if (!hashPresent && !idPresent) {
        bad('action.hash', 'a recall action needs {hash: "..."} or {id: N}.');
      } else if (hashPresent && !isNonEmptyString(action.hash)) {
        bad('action.hash', '"action.hash" must be a non-empty string.');
      } else if (idPresent && !isRecallId(action.id)) {
        bad('action.id', '"action.id" must be an action number — 7, "7" or "#7".');
      }
    }
    if (type === 'claim_finding') {
      need('title', 'one line naming the vulnerability');
      if (!isNonEmptyString(action.severity)) {
        bad('action.severity', '"action.severity" is required for a claim — critical, high, medium or low.');
      } else if (!SEVERITIES.has(String(action.severity).trim().toLowerCase())) {
        bad('action.severity', '"action.severity" must be one of: critical, high, medium, low.');
      }
      need('command', 'the exact command that reproduces it (the verifier re-runs it)');
      need('evidence', 'the exact output that proves it — a real excerpt, not a summary');
      need('counterevidence', 'what was checked that could have disproved this — the control/baseline result');
      if (!isNonEmptyString(action.confidence)) {
        bad('action.confidence', '"action.confidence" is required for a claim — high, medium or low (the claim gate requires it).');
      } else if (!CONFIDENCES.has(String(action.confidence).trim().toLowerCase())) {
        bad('action.confidence', '"action.confidence" must be one of: high, medium, low.');
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Map a VALIDATED reply onto the executeBrainAction dispatch shape.
 * Throws nothing — call validateBrainReply first; a reply that was
 * never validated still maps defensively (missing fields pass
 * through and the dispatch refuses them with its own errors).
 */
export function brainReplyToAction(reply) {
  const a = (reply && reply.action) || {};
  const type = String(a.type || '').trim();
  const task = {
    task: String(reply.task || '').trim(),
    goal: String(reply.goal || '').trim(),
    progress: String(reply.progress || '').trim(),
    status: 'in_progress',
  };
  const base = { task };
  switch (type) {
    case 'shell':
      return { action: { ...base, action: 'shell', command: a.command }, task };
    case 'browser_open':
      return { action: { ...base, action: 'browser_open', url: a.url }, task };
    case 'click':
      // The GUI click driver clicks by visible text; the reply's
      // selector IS that text (a CSS selector is not actionable by
      // the driver, so it is passed through as the click target).
      return { action: { ...base, action: 'browser_click', text: a.selector || a.text, selector: a.selector || undefined }, task };
    case 'type':
      return { action: { ...base, action: 'browser_type', text: a.text, selector: a.selector || undefined, submit: a.submit === true }, task };
    case 'browser_snapshot':
    case 'screenshot':
    case 'desktop_snapshot':
    case 'desktop_screenshot':
    case 'see_screen':
    case 'proxy_start':
    case 'intercept_list':
      return { action: { ...base, action: type }, task };
    case 'desktop_click':
      return { action: { ...base, action: type, window: a.window }, task };
    case 'desktop_key':
      return { action: { ...base, action: type, keys: a.keys || undefined, text: a.text || undefined }, task };
    case 'desktop_click_at':
      return { action: { ...base, action: type, x: a.x, y: a.y }, task };
    case 'desktop_click_control':
      return { action: { ...base, action: type, control: a.control, window: a.window || undefined }, task };
    case 'list_controls':
      return { action: { ...base, action: type, window: a.window || undefined }, task };
    case 'desktop_terminal':
      return { action: { ...base, action: type, command: a.command }, task };
    case 'launch_tool':
    case 'download_tool':
      return { action: { ...base, action: type, tool: a.tool }, task };
    case 'intercept_read':
      return { action: { ...base, action: type, index: a.index }, task };
    case 'intercept_replay':
      return { action: { ...base, action: type, index: a.index, url: a.url || undefined, headers: a.headers || undefined, body: a.body || undefined }, task };
    case 'recall':
      return { action: { ...base, action: 'recall', ...(a.hash ? { hash: a.hash } : { id: a.id }) }, task };
    case 'claim_finding':
      return {
        action: {
          ...base,
          action: 'claim_finding',
          title: a.title,
          severity: String(a.severity || '').trim().toLowerCase(),
          class: a.class || undefined,
          command: a.command,
          evidence: a.evidence,
          counterevidence: a.counterevidence,
          confidence: String(a.confidence || '').trim().toLowerCase(),
          confidence_rationale: a.confidence_rationale || undefined,
          poc: a.poc || undefined,
        },
        task,
      };
    default:
      return { action: { ...base, action: type || a.action || '' }, task };
  }
}
