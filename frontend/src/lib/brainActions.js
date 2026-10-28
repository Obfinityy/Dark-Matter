// ============================================================================
// Be a Brain — pure helpers for the Brain Console (28 Oct 2026).
// No React, no DOM, no fetch: BrainConsole.jsx and the node logic test
// (scripts/check-be-a-brain.mjs) both import from here, so the action
// payload shapes and the list/process derivations are tested for real
// instead of only grep-checked in JSX.
// ============================================================================

/** The action types the parent can submit as the brain — shell, browser,
 * recall, claim, and the full OS-control surface (28 Oct 2026): the
 * parent drives the whole Kali machine, exactly like the API brain. */
export const OS_BRAIN_ACTION_TYPES = [
  'browser_snapshot',
  'screenshot',
  'desktop_snapshot',
  'desktop_click',
  'desktop_key',
  'desktop_click_at',
  'desktop_click_control',
  'list_controls',
  'desktop_screenshot',
  'see_screen',
  'desktop_terminal',
  'launch_tool',
  'download_tool',
  'proxy_start',
  'intercept_list',
  'intercept_read',
  'intercept_replay',
];
export const BRAIN_ACTION_TYPES = [
  'shell',
  'browser_open',
  'browser_click',
  'browser_type',
  'recall',
  'claim_finding',
  ...OS_BRAIN_ACTION_TYPES,
];

/** Human label per action type (composer + index rows). */
export const BRAIN_ACTION_LABELS = {
  shell: 'Run a shell command',
  browser_open: 'Open a URL in the browser',
  browser_click: 'Click a page element',
  browser_type: 'Type into a page element',
  recall: 'Recall a saved action by id',
  claim_finding: 'File a finding',
  browser_snapshot: 'See the current page (snapshot)',
  screenshot: 'Screenshot the browser',
  desktop_snapshot: 'See the whole desktop (windows)',
  desktop_click: 'Focus a desktop window by title',
  desktop_key: 'Send keys / type to the focused window',
  desktop_click_at: 'Click a point on the screen (from see_screen)',
  desktop_click_control: 'Click a named control in a GUI app',
  list_controls: 'List a window’s named controls',
  desktop_screenshot: 'Screenshot the whole desktop',
  see_screen: 'Look at the screen (vision: text map + photo)',
  desktop_terminal: 'Run a command in the visible terminal',
  launch_tool: 'Launch a named tool (Burp, ZAP, nmap…)',
  download_tool: 'Install a missing tool',
  proxy_start: 'Start the intercept proxy',
  intercept_list: 'List captured requests',
  intercept_read: 'Read one captured request',
  intercept_replay: 'Replay a captured request (Burp Repeater)',
};

const SEVERITIES = ['critical', 'high', 'medium', 'low'];

/**
 * Build the `action` object for POST /hunts/:id/brain-action from the
 * composer's raw fields. Returns { action } on success or
 * { error } naming the missing field — the composer shows the error
 * instead of sending a malformed action.
 *
 * Shapes (per the backend contract, 28 Oct 2026):
 *   shell         { action:'shell', command }
 *   browser_open  { action:'browser_open', url }
 *   browser_click { action:'browser_click', selector }
 *   browser_type  { action:'browser_type', selector, text }
 *   recall        { action:'recall', id }
 *   claim_finding { action:'claim_finding', title, severity, detail }
 */
export function buildBrainAction(type, fields = {}) {
  const f = fields || {};
  const need = (key, label) => {
    const v = typeof f[key] === 'string' ? f[key].trim() : f[key];
    if (v === undefined || v === null || v === '') return { error: `${label} is required.` };
    return { value: v };
  };
  switch (type) {
    case 'shell': {
      const c = need('command', 'Command');
      if (c.error) return c;
      return { action: { action: 'shell', command: c.value } };
    }
    case 'browser_open': {
      const u = need('url', 'URL');
      if (u.error) return u;
      return { action: { action: 'browser_open', url: u.value } };
    }
    case 'browser_click': {
      const s = need('selector', 'Element (selector or visible text)');
      if (s.error) return s;
      // The GUI click driver clicks by visible TEXT (executeBrainAction
      // reads action.text, never selector) — the form used to send
      // selector-only, so every form click failed with empty_command
      // while the JSON path (which maps selector -> text) worked.
      // Send both: selector is the target, text is what is clicked.
      return { action: { action: 'browser_click', selector: s.value, text: s.value } };
    }
    case 'browser_type': {
      const s = need('selector', 'Element (selector or visible text)');
      if (s.error) return s;
      const t = need('text', 'Text to type');
      if (t.error) return t;
      return { action: { action: 'browser_type', selector: s.value, text: t.value } };
    }
    case 'browser_snapshot':
    case 'screenshot':
    case 'desktop_snapshot':
    case 'desktop_screenshot':
    case 'see_screen':
    case 'proxy_start':
    case 'intercept_list':
      return { action: { action: type } };
    case 'desktop_click': {
      const w = need('window', 'Window title');
      if (w.error) return w;
      return { action: { action: 'desktop_click', window: w.value } };
    }
    case 'desktop_key': {
      const keys = typeof f.keys === 'string' ? f.keys.trim() : '';
      const text = typeof f.text === 'string' ? f.text.trim() : '';
      if (!keys && !text) return { error: 'Keys (e.g. "ctrl+l") or Text to type is required.' };
      return { action: { action: 'desktop_key', ...(keys ? { keys } : {}), ...(text ? { text } : {}) } };
    }
    case 'desktop_click_at': {
      const x = Number(f.x);
      const y = Number(f.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: 'X and Y are required — a point from the see_screen map.' };
      return { action: { action: 'desktop_click_at', x, y } };
    }
    case 'desktop_click_control': {
      const c = need('control', 'Control name');
      if (c.error) return c;
      const w = typeof f.window === 'string' ? f.window.trim() : '';
      return { action: { action: 'desktop_click_control', control: c.value, ...(w ? { window: w } : {}) } };
    }
    case 'list_controls': {
      const w = typeof f.window === 'string' ? f.window.trim() : '';
      return { action: { action: 'list_controls', ...(w ? { window: w } : {}) } };
    }
    case 'desktop_terminal': {
      const c = need('command', 'Command');
      if (c.error) return c;
      return { action: { action: 'desktop_terminal', command: c.value } };
    }
    case 'launch_tool':
    case 'download_tool': {
      const t = need('tool', 'Tool name');
      if (t.error) return t;
      return { action: { action: type, tool: t.value } };
    }
    case 'intercept_read':
    case 'intercept_replay': {
      const n = Number(f.index);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return { error: 'Capture # must be a whole number, 1 or more (from intercept_list).' };
      const u = typeof f.url === 'string' ? f.url.trim() : '';
      return { action: { action: type, index: n, ...(u && type === 'intercept_replay' ? { url: u } : {}) } };
    }
    case 'recall': {
      const n = Number(f.id);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        return { error: 'Recall id must be a whole number, 1 or more (the action # from the index).' };
      }
      return { action: { action: 'recall', id: n } };
    }
    case 'claim_finding': {
      const t = need('title', 'Finding title');
      if (t.error) return t;
      const severity = SEVERITIES.includes(f.severity) ? f.severity : 'medium';
      const detail = typeof f.detail === 'string' ? f.detail.trim() : '';
      // BRAIN JSON (28 Oct 2026): the backend's claim gate reads
      // `evidence` / `command` / `counterevidence` — the form used to
      // send only `detail`, which the gate never reads, so every
      // form claim bounced as incomplete while the JSON path (which
      // sends evidence) would have passed the gate. The form is a
      // friendly view of the canonical JSON reply, so it sends the
      // same proof package: `evidence` mirrors the detail textarea,
      // plus the reproduce command and the counter-evidence. `detail`
      // stays for the recorded action label.
      const command = typeof f.claimCommand === 'string' ? f.claimCommand.trim()
        : (typeof f.command === 'string' ? f.command.trim() : '');
      const counterevidence = typeof f.counterevidence === 'string' ? f.counterevidence.trim() : '';
      // The claim gate requires confidence (high/medium/low) — a form
      // claim without it bounced while the JSON path (which requires
      // it) passed the gate. confidence_rationale is required by the
      // gate whenever confidence is not high.
      const confidence = ['high', 'medium', 'low'].includes(String(f.confidence || '').trim().toLowerCase())
        ? String(f.confidence).trim().toLowerCase() : 'medium';
      const confidenceRationale = typeof f.confidenceRationale === 'string' ? f.confidenceRationale.trim() : '';
      return { action: { action: 'claim_finding', title: t.value, severity, detail, command, evidence: detail, counterevidence, confidence, confidence_rationale: confidenceRationale } };
    }
    default:
      return { error: `Unknown action type: ${type}` };
  }
}

/**
 * The display string for a failed brain-action call. The JSON route's
 * 400 carries a structured `errors: [{field, message}]` array with no
 * top-level message — the first error names the bad field, so show
 * that ("action.command: ...") instead of the bare 'invalid_reply'
 * code. Anything else falls back to the api wrapper's error string.
 */
export function formatBrainError(res) {
  const errs = res && res.data && Array.isArray(res.data.errors) ? res.data.errors : [];
  if (errs.length && errs[0] && errs[0].field) {
    return `${errs[0].field}: ${errs[0].message || 'invalid value.'}`;
  }
  return (res && res.error) || 'The backend did not accept this action.';
}

/** Short display form of an action hash (first 8 chars). */
export function shortHash(hash) {
  const h = String(hash || '');
  return h.length > 8 ? h.slice(0, 8) : h;
}

/**
 * One compact line for an action-index row: "shell — ls /tmp" etc.
 * Falls back to the tool name when the label/detail is empty.
 */
export function actionLabel(a) {
  if (!a) return '';
  const tool = a.tool || a.action || 'action';
  const label = (a.label || a.detail || '').trim();
  return label ? `${tool} — ${label}` : tool;
}

/** Find one action in the index by its hash (exact match). */
export function findActionByHash(actions, hash) {
  if (!Array.isArray(actions) || !hash) return null;
  return actions.find((a) => a && a.hash === hash) || null;
}

/**
 * Derive the process panel's display values from a GET /process body.
 * Missing fields degrade to honest empties — the panel says "nothing
 * reported yet" instead of inventing a task.
 *
 * `status` is the process status the panel shows. The backend
 * (deriveProcessState, brain-json lane) sends a one-word
 * `processStatus` — running / failed / done / pending — which is
 * authoritative when present ('done' is shown as 'complete', the
 * brief's word; 'pending' as 'idle', "nothing reported yet" only
 * when there genuinely is no step). Without it, fall back to the
 * backend's taskStatus (in_progress/complete/failed): a task/goal
 * with no stamp still counts as running — the brain submitted it,
 * so the process is live even before the backend stamps a status
 * on it. `error` is the failure reason when the backend reports
 * one (p.error); never invented here.
 */
export function processSummary(proc) {
  const p = proc || {};
  const taskStatus = typeof p.taskStatus === 'string' ? p.taskStatus : '';
  const task = typeof p.task === 'string' ? p.task : '';
  const goal = typeof p.goal === 'string' ? p.goal : '';
  const progress = typeof p.progress === 'string' ? p.progress : '';
  const processStatus = typeof p.processStatus === 'string' ? p.processStatus : '';
  let status = 'idle';
  if (processStatus === 'failed' || taskStatus === 'failed') status = 'failed';
  else if (processStatus === 'running' || taskStatus === 'in_progress') status = 'running';
  else if (processStatus === 'done' || taskStatus === 'complete') status = 'complete';
  else if (processStatus === 'pending') status = 'idle';
  else if (task || goal || progress) status = 'running';
  return {
    running: p.running === true,
    task,
    goal,
    progress,
    summary: typeof p.summary === 'string' ? p.summary : '',
    taskStatus,
    processStatus,
    status,
    error: typeof p.error === 'string' ? p.error : (typeof p.taskError === 'string' ? p.taskError : ''),
    done: Array.isArray(p.done) ? p.done : [],
    pending: Array.isArray(p.pending) ? p.pending : [],
    brainMode: p.brainMode || '',
    state: p.state || '',
    iteration: typeof p.iteration === 'number' ? p.iteration : null,
    // LIVE UI (28 Oct 2026): the backend's live truth — the process
    // boolean, the one-line activity, the newest action, the newest
    // screenshot artifact, and the last known desktop. Passed through
    // unchanged; missing fields degrade to honest empties.
    in_process: p.in_process === true,
    activity: typeof p.activity === 'string' ? p.activity : '',
    lastAction: (p.lastAction && typeof p.lastAction === 'object') ? p.lastAction : null,
    lastScreenshot: (p.lastScreenshot && typeof p.lastScreenshot === 'object') ? p.lastScreenshot : null,
    desktop: (p.desktop && typeof p.desktop === 'object') ? p.desktop : null,
  };
}

// ============================================================================
// Brain JSON — the parent brain's structured reply (28 Oct 2026).
// The JSON composer in BrainConsole.jsx validates with these pure
// helpers (same file the node guard imports for real), so a malformed
// reply is caught before it ever leaves the browser, with the bad
// field named. The schema file src/lib/brainReply.schema.json is a
// BYTE-IDENTICAL copy of backend/src/brainReply.schema.json (the
// backend file is the authority); these helpers mirror the backend
// validator backend/src/brainReply.js rule for rule —
// scripts/check-brain-json.mjs asserts they stay in sync, including
// against the backend file itself.
// ============================================================================

/** The action.type enum of a JSON brain reply (per the schema). */
export const BRAIN_REPLY_ACTION_TYPES = [
  'shell',
  'browser_open',
  'click',
  'type',
  'recall',
  'claim_finding',
  ...OS_BRAIN_ACTION_TYPES,
];

/**
 * Short JSON names -> the backend dispatch types executeBrainAction
 * accepts (SUPPORTED: shell, browser_open, browser_click,
 * browser_type, recall, claim_finding). The JSON reply says "click"
 * / "type"; the dispatch says "browser_click" / "browser_type" —
 * brainReplyToAction normalises, so the JSON path dispatches the
 * identical action object the form composer builds. The long names
 * are also accepted as input (lenient in, strict out).
 */
export const BRAIN_REPLY_ACTION_ALIASES = {
  click: 'browser_click',
  type: 'browser_type',
  browser_click: 'browser_click',
  browser_type: 'browser_type',
};

/** Canonical dispatch type for a JSON action.type (or null if unknown). */
export function canonicalBrainActionType(type) {
  if (type === 'shell' || type === 'browser_open' || type === 'recall' || type === 'claim_finding') return type;
  if (OS_BRAIN_ACTION_TYPES.includes(type)) return type; // OS-control long names pass through unchanged
  return BRAIN_REPLY_ACTION_ALIASES[type] || null;
}

/**
 * Parse the JSON composer's textarea. Returns { reply } or
 * { error } naming the syntax problem — the composer shows the
 * error instead of sending unparseable text.
 */
export function parseBrainReplyJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { error: 'Paste a JSON reply first — the textarea is empty.' };
  }
  try {
    return { reply: JSON.parse(text) };
  } catch (err) {
    return { error: `Not valid JSON: ${String((err && err.message) || err)}` };
  }
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const CONFIDENCES = ['high', 'medium', 'low'];
// A recall id, exactly as the backend accepts it: 7, "7" or "#7".
function isRecallId(v) {
  return (typeof v === 'number' && Number.isInteger(v) && v >= 1)
    || (typeof v === 'string' && /^#?\d+$/.test(v.trim()) && parseInt(v.trim().replace(/^#/, ''), 10) >= 1);
}

/**
 * Validate a parsed JSON brain reply against the schema — the same
 * rules as backend/src/brainReply.js validateBrainReply. Returns
 * { reply } (the reply, trimmed) on success or { error } naming the
 * bad field, e.g. "task is required." / "action.type must be one
 * of: shell, browser_open, click, type, recall, claim_finding." /
 * "action.command is required for a shell action.".
 *
 * Required top-level: task, goal, progress (non-empty strings),
 * action (object). recall is optional — exactly one of {hash} or
 * {id}. Per-type required fields (the same proof the backend gate
 * needs): shell: command; browser_open: url; click: selector or
 * text; type: selector AND text (the selector names the field —
 * GUI-TYPE-TARGET, 28 Oct 2026: a type without a field is refused);
 * recall: exactly one of hash/id; claim_finding: title, severity,
 * command, evidence, counterevidence, confidence (class/poc/
 * confidence_rationale optional). The first bad field wins — one
 * clear error, not a list.
 */
export function validateBrainReply(reply) {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) {
    return { error: 'reply must be a JSON object with task, goal, progress and action.' };
  }
  for (const field of ['task', 'goal', 'progress']) {
    if (!isNonEmptyString(reply[field])) return { error: `${field} is required — a non-empty string.` };
  }
  if (reply.recall !== undefined && reply.recall !== null) {
    const rec = reply.recall;
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
      return { error: 'recall must be an object — {"hash": "..."} or {"id": 42}.' };
    }
    const hashPresent = rec.hash !== undefined && rec.hash !== null;
    const idPresent = rec.id !== undefined && rec.id !== null;
    if (hashPresent && idPresent) return { error: 'recall needs exactly one of hash/id — send one, not both.' };
    if (!hashPresent && !idPresent) return { error: 'recall needs exactly one of hash/id — {"hash": "..."} or {"id": 42}.' };
    if (hashPresent && !isNonEmptyString(rec.hash)) return { error: 'recall.hash must be a non-empty string.' };
    if (idPresent && !isRecallId(rec.id)) return { error: 'recall.id must be an action number — 7, "7" or "#7".' };
    // RECALL WITH A REASON (28 Oct 2026): the reason is optional in
    // validation (never block a recall over it), but the prompt tells
    // the brain to always give it. Mirror of backend/src/brainReply.js.
    if (rec.reason !== undefined && rec.reason !== null
      && (typeof rec.reason !== 'string' || !rec.reason.trim() || rec.reason.length > 300)) {
      return { error: 'recall.reason must be a short string saying why you need this data (max 300 chars).' };
    }
  }
  const action = reply.action;
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return { error: 'action is required — an object with a type and its fields.' };
  }
  if (!isNonEmptyString(action.type)) return { error: 'action.type is required.' };
  const kind = canonicalBrainActionType(action.type.trim());
  if (!kind) {
    return { error: `action.type must be one of: ${BRAIN_REPLY_ACTION_TYPES.join(', ')}.` };
  }
  const need = (key, label) => {
    if (!isNonEmptyString(action[key])) return { error: `action.${key} is required for a ${action.type} action (${label}).` };
    return { value: action[key].trim() };
  };
  switch (kind) {
    case 'shell': {
      const c = need('command', 'the command to run');
      if (c.error) return c;
      break;
    }
    case 'browser_open': {
      const u = need('url', 'the URL to open');
      if (u.error) return u;
      break;
    }
    case 'browser_click': {
      // The backend accepts selector OR text for a click (the GUI
      // driver clicks by visible text; selector IS that text).
      if (!isNonEmptyString(action.selector) && !isNonEmptyString(action.text)) {
        return { error: 'action.selector is required for a click action — the text/selector of what to click ("text" is accepted in its place).' };
      }
      break;
    }
    case 'browser_type': {
      // GUI-TYPE-TARGET (28 Oct 2026): 'selector' is REQUIRED for
      // type — it names the field. The old rule made it optional,
      // so a reply could type blind and the driver put the text into
      // whatever was focused (the DVWA login failure). Mirror of
      // backend/src/brainReply.js — the node guard asserts they stay
      // in sync.
      const s = need('selector', 'the field to type into (its label or CSS selector)');
      if (s.error) return s;
      const t = need('text', 'the text to type');
      if (t.error) return t;
      break;
    }
    // OS CONTROL (28 Oct 2026): same per-type requirements as the
    // backend validator — mirror of backend/src/brainReply.js.
    // No-field OS actions need nothing more than a known type.
    case 'browser_snapshot':
    case 'screenshot':
    case 'desktop_snapshot':
    case 'desktop_screenshot':
    case 'see_screen':
    case 'proxy_start':
    case 'intercept_list':
    case 'list_controls':
      break;
    case 'desktop_click': {
      const w = need('window', 'the window title to focus (take desktop_snapshot first if you do not know the titles)');
      if (w.error) return w;
      break;
    }
    case 'desktop_key': {
      if (!isNonEmptyString(action.keys) && !isNonEmptyString(action.text)) {
        return { error: 'action.keys is required for a desktop_key action — "keys" (e.g. "ctrl+l") or "text" (words to type).' };
      }
      break;
    }
    case 'desktop_click_at': {
      if (action.x === undefined || action.x === null || action.x === '') return { error: 'action.x is required for a desktop_click_at action — a point from the see_screen map.' };
      if (action.y === undefined || action.y === null || action.y === '') return { error: 'action.y is required for a desktop_click_at action — a point from the see_screen map.' };
      break;
    }
    case 'desktop_click_control': {
      const c = need('control', 'the control’s visible name (e.g. "Repeater")');
      if (c.error) return c;
      break;
    }
    case 'desktop_terminal': {
      const c = need('command', 'the command to run in the visible terminal');
      if (c.error) return c;
      break;
    }
    case 'launch_tool':
    case 'download_tool': {
      const t = need('tool', 'the tool name (e.g. "burp")');
      if (t.error) return t;
      break;
    }
    case 'intercept_read':
    case 'intercept_replay': {
      if (action.index === undefined || action.index === null || String(action.index).trim() === '') {
        return { error: 'action.index is required for an intercept_read/intercept_replay action — the # from intercept_list.' };
      }
      break;
    }
    case 'recall': {
      const hashPresent = action.hash !== undefined && action.hash !== null;
      const idPresent = action.id !== undefined && action.id !== null;
      if (hashPresent && idPresent) return { error: 'action.recall needs exactly one of hash/id — send one, not both.' };
      if (!hashPresent && !idPresent) return { error: 'action.hash is required for a recall action — {"type": "recall", "hash": "..."} or {"type": "recall", "id": 42}.' };
      if (hashPresent && !isNonEmptyString(action.hash)) return { error: 'action.hash must be a non-empty string.' };
      if (idPresent && !isRecallId(action.id)) return { error: 'action.id must be an action number — 7, "7" or "#7".' };
      break;
    }
    case 'claim_finding': {
      for (const [key, label] of [
        ['title', 'one line naming the vulnerability'],
        ['command', 'the exact command that reproduces it'],
        ['evidence', 'the exact output that proves it'],
        ['counterevidence', 'what you checked that could have disproved it'],
      ]) {
        const v = need(key, label);
        if (v.error) return v;
      }
      if (!isNonEmptyString(action.severity)) {
        return { error: 'action.severity is required for a claim — critical, high, medium or low.' };
      }
      if (!SEVERITIES.includes(String(action.severity).trim().toLowerCase())) {
        return { error: 'action.severity must be one of: critical, high, medium, low.' };
      }
      if (!isNonEmptyString(action.confidence)) {
        return { error: 'action.confidence is required for a claim — high, medium or low (the claim gate requires it).' };
      }
      if (!CONFIDENCES.includes(String(action.confidence).trim().toLowerCase())) {
        return { error: 'action.confidence must be one of: high, medium, low.' };
      }
      break;
    }
    default:
      return { error: `Unknown action type: ${action.type}` };
  }
  // The validated reply, trimmed — what the composer submits.
  const out = {
    task: reply.task.trim(),
    goal: reply.goal.trim(),
    progress: reply.progress.trim(),
    action: { ...action, type: action.type.trim() },
  };
  if (reply.recall !== undefined && reply.recall !== null) out.recall = reply.recall;
  return { reply: out };
}

/**
 * Convert a validated JSON brain reply into the backend action
 * object — the SAME mapping backend/src/brainReply.js
 * brainReplyToAction performs, so the frontend's equivalence proof
 * (JSON path vs form composer) tests the real dispatch shape:
 * click/type -> browser_click/browser_type; the reply's
 * task/goal/progress ride on the action as the structured task
 * block (status in_progress), so the live process view shows the
 * step; the top-level recall stays on the reply — the JSON route
 * fetches it before acting, it is not part of the dispatched
 * action.
 */
export function brainReplyToAction(reply) {
  const validated = validateBrainReply(reply);
  if (validated.error) return { error: validated.error };
  const r = validated.reply;
  const a = r.action;
  const kind = canonicalBrainActionType(a.type);
  const task = { task: r.task, goal: r.goal, progress: r.progress, status: 'in_progress' };
  let action;
  switch (kind) {
    case 'shell':
      action = { task, action: 'shell', command: a.command.trim() };
      break;
    case 'browser_open':
      action = { task, action: 'browser_open', url: a.url.trim() };
      break;
    case 'browser_click':
      // The GUI click driver clicks by visible text; the reply's
      // selector IS that text.
      action = { task, action: 'browser_click', text: (a.selector || a.text).trim(), selector: a.selector ? a.selector.trim() : undefined };
      break;
    case 'browser_type':
      action = { task, action: 'browser_type', text: a.text.trim(), selector: a.selector ? a.selector.trim() : undefined, submit: a.submit === true };
      break;
    case 'browser_snapshot':
    case 'screenshot':
    case 'desktop_snapshot':
    case 'desktop_screenshot':
    case 'see_screen':
    case 'proxy_start':
    case 'intercept_list':
      action = { task, action: kind };
      break;
    case 'desktop_click':
      action = { task, action: kind, window: a.window };
      break;
    case 'desktop_key':
      action = { task, action: kind, keys: a.keys || undefined, text: a.text || undefined };
      break;
    case 'desktop_click_at':
      action = { task, action: kind, x: a.x, y: a.y };
      break;
    case 'desktop_click_control':
      action = { task, action: kind, control: a.control, window: a.window || undefined };
      break;
    case 'list_controls':
      action = { task, action: kind, window: a.window || undefined };
      break;
    case 'desktop_terminal':
      action = { task, action: kind, command: a.command };
      break;
    case 'launch_tool':
    case 'download_tool':
      action = { task, action: kind, tool: a.tool };
      break;
    case 'intercept_read':
      action = { task, action: kind, index: a.index };
      break;
    case 'intercept_replay':
      action = { task, action: kind, index: a.index, url: a.url || undefined, headers: a.headers || undefined, body: a.body || undefined };
      break;
    case 'recall':
      action = isNonEmptyString(a.hash)
        ? { task, action: 'recall', hash: a.hash.trim() }
        : { task, action: 'recall', id: a.id };
      break;
    case 'claim_finding':
      action = {
        task,
        action: 'claim_finding',
        title: a.title.trim(),
        severity: String(a.severity).trim().toLowerCase(),
        class: a.class || undefined,
        command: a.command.trim(),
        evidence: a.evidence.trim(),
        counterevidence: a.counterevidence.trim(),
        confidence: String(a.confidence).trim().toLowerCase(),
        confidence_rationale: a.confidence_rationale || undefined,
        poc: a.poc || undefined,
      };
      break;
    default:
      return { error: `Unknown action type: ${a.type}` };
  }
  return { action, task };
}

/**
 * The reverse view: a form-built action as the canonical JSON reply
 * (task/goal/progress supplied by the caller — the form composer has
 * no task fields, so it passes the current process values or '').
 * Used by the node guard to prove both composers describe the same
 * action, and by the console to prefill the JSON composer from the
 * form. browser_click/browser_type are written back as the JSON
 * reply's short names (click/type); claim detail becomes evidence.
 */
export function brainActionToReply(action, taskBlock = {}) {
  if (!action || typeof action !== 'object') return null;
  const kind = String(action.action || '').trim();
  const short = kind === 'browser_click' ? 'click' : kind === 'browser_type' ? 'type' : kind;
  const a = { type: short };
  if (kind === 'shell') a.command = action.command || '';
  if (kind === 'browser_open') a.url = action.url || '';
  if (kind === 'browser_click') {
    a.selector = action.selector || action.text || '';
    if (action.text && action.text !== action.selector) a.text = action.text;
  }
  if (kind === 'browser_type') {
    a.text = action.text || '';
    if (action.selector) a.selector = action.selector;
    if (action.submit === true) a.submit = true;
  }
  if (kind === 'recall') {
    if (action.hash) a.hash = action.hash;
    else if (action.id !== undefined) a.id = action.id;
  }
  if (kind === 'claim_finding') {
    a.title = action.title || '';
    a.severity = action.severity || 'medium';
    a.command = action.command || '';
    a.evidence = action.evidence || action.detail || '';
    a.counterevidence = action.counterevidence || '';
    a.confidence = action.confidence || 'medium';
    if (action.confidence_rationale) a.confidence_rationale = action.confidence_rationale;
    if (action.class) a.class = action.class;
    if (action.poc) a.poc = action.poc;
  }
  return {
    task: typeof taskBlock.task === 'string' ? taskBlock.task : '',
    goal: typeof taskBlock.goal === 'string' ? taskBlock.goal : '',
    progress: typeof taskBlock.progress === 'string' ? taskBlock.progress : '',
    action: a,
  };
}

/** Status pill class for an action-index row. */
export function actionStatusClass(status) {
  switch (status) {
    case 'done': return 'brain-action-status done';
    case 'failed': return 'brain-action-status failed';
    case 'running': return 'brain-action-status running';
    default: return 'brain-action-status';
  }
}
