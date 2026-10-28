// ============================================================================
// Be a Brain — pure helpers for the Brain Console (28 Oct 2026).
// No React, no DOM, no fetch: BrainConsole.jsx and the node logic test
// (scripts/check-be-a-brain.mjs) both import from here, so the action
// payload shapes and the list/process derivations are tested for real
// instead of only grep-checked in JSX.
// ============================================================================

/** The six action types the parent can submit as the brain. */
export const BRAIN_ACTION_TYPES = [
  'shell',
  'browser_open',
  'browser_click',
  'browser_type',
  'recall',
  'claim_finding',
];

/** Human label per action type (composer + index rows). */
export const BRAIN_ACTION_LABELS = {
  shell: 'Run a shell command',
  browser_open: 'Open a URL in the browser',
  browser_click: 'Click a page element',
  browser_type: 'Type into a page element',
  recall: 'Recall a saved action by id',
  claim_finding: 'File a finding',
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
      return { action: { action: 'browser_click', selector: s.value } };
    }
    case 'browser_type': {
      const s = need('selector', 'Element (selector or visible text)');
      if (s.error) return s;
      const t = need('text', 'Text to type');
      if (t.error) return t;
      return { action: { action: 'browser_type', selector: s.value, text: t.value } };
    }
    case 'recall': {
      const n = Number(f.id);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        return { error: 'Recall id must be a whole number (the action # from the index).' };
      }
      return { action: { action: 'recall', id: n } };
    }
    case 'claim_finding': {
      const t = need('title', 'Finding title');
      if (t.error) return t;
      const severity = SEVERITIES.includes(f.severity) ? f.severity : 'medium';
      const detail = typeof f.detail === 'string' ? f.detail.trim() : '';
      return { action: { action: 'claim_finding', title: t.value, severity, detail } };
    }
    default:
      return { error: `Unknown action type: ${type}` };
  }
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
 */
export function processSummary(proc) {
  const p = proc || {};
  return {
    running: p.running === true,
    task: typeof p.task === 'string' ? p.task : '',
    goal: typeof p.goal === 'string' ? p.goal : '',
    progress: typeof p.progress === 'string' ? p.progress : '',
    done: Array.isArray(p.done) ? p.done : [],
    pending: Array.isArray(p.pending) ? p.pending : [],
    brainMode: p.brainMode || '',
    state: p.state || '',
    iteration: typeof p.iteration === 'number' ? p.iteration : null,
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
