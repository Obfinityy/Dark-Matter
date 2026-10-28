// Keyword-Index Memory (27 Oct 2026, owner order) — the Action Index.
//
// One short specific line per action the hunter took in THIS hunt,
// numbered sequentially (#1, #2, #3… — array position, O(1) access),
// each carrying a content-hash that doubles as the dedup key.
// Format: `what | where | variant | outcome | #N`
//   e.g. `JWT alg-none | POST /login | 401 fail | #7`
//
// Pure functions over the hunt's own events + reasoning rows. No I/O
// and no imports from the loop — the index can never see another
// hunt's memory even if called wrong: it only knows the arrays it
// is handed. The Full Record (events.jsonl + reasoning.jsonl) stays
// the source of truth; the index is a derived, bounded view of it.

import { actionSignature, contentHash } from './actionIdentity.js';

export { contentHash } from './actionIdentity.js';

export const INDEX_BUDGET_CHARS = 2000; // per-turn screen budget for the index
export const INDEX_RECENT_N = 12; // newest entries rendered in full

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

// Area grouping. A deliberate small mirror of the PROBE_TOPICS ids in
// humanLoop.js (same ids, same matchers) — display-only: a topic the
// mirror misses falls into its tool family, never into silence. The
// caller may pass its own topic list; the default keeps this module
// import-free of the loop (no import cycle).
export const DEFAULT_TOPICS = [
  { id: 'ssti', label: 'SSTI', re: /\bssti\b|template injection/i },
  { id: 'xss', label: 'XSS', re: /\bxss\b|cross[- ]site scripting/i },
  { id: 'sqli', label: 'SQL injection', re: /\bsqli\b|sql injection/i },
  { id: 'ssrf', label: 'SSRF', re: /\bssrf\b|server[- ]side request forgery/i },
  { id: 'xxe', label: 'XXE', re: /\bxxe\b|xml external entit/i },
  { id: 'lfi', label: 'LFI / path traversal', re: /\blfi\b|path traversal|directory traversal|local file inclusion/i },
  { id: 'cmdi', label: 'command injection', re: /command injection|\bos command\b/i },
  { id: 'jwt', label: 'JWT', re: /\bjwt\b|json web token/i },
  { id: 'cors', label: 'CORS', re: /\bcors\b|cross-origin/i },
  { id: 'headers', label: 'security headers', re: /security headers|content-security-policy|\bcsp\b|clickjacking/i },
  { id: 'openredirect', label: 'open redirect', re: /open redirect/i },
  { id: 'graphql', label: 'GraphQL', re: /graphql/i },
  { id: 'fileupload', label: 'file upload', re: /file upload|upload vulnerab|unrestricted upload/i },
];

const FAMILY_LABELS = {
  browser: 'browser',
  shell: 'shell',
  search: 'search',
  desktop: 'desktop',
  memory: 'memory',
  auth: 'accounts',
  plan: 'plan',
  coverage: 'coverage',
};

function familyOf(tool) {
  const t = String(tool || '');
  if (t.startsWith('browser_') || t === 'browser_open') return 'browser';
  if (t === 'shell' || t === 'desktop_terminal') return 'shell';
  if (t === 'search') return 'search';
  if (t.startsWith('desktop_') || t === 'see_screen') return 'desktop';
  if (t === 'recall' || t === 'note') return 'memory';
  if (t === 'save_credential' || t === 'use_saved_credential' || t === 'fetch_verification_code' || t === 'request_details') return 'auth';
  if (t === 'hunt_plan') return 'plan';
  if (t === 'record_coverage') return 'coverage';
  return 'other';
}

/** Area of one entry: a vuln topic when the detail names one, else its tool family. */
export function groupArea(entry, topics = DEFAULT_TOPICS) {
  const hay = `${entry.label || ''} ${entry.detail || ''}`;
  for (const t of topics || []) {
    if (t && t.re && t.re.test(hay)) return { id: t.id, label: t.label || t.id };
  }
  const fam = familyOf(entry.tool);
  return { id: fam, label: FAMILY_LABELS[fam] || fam };
}

// --- outcome word ---------------------------------------------------------
// A label shortcut, never a verdict: the Full Record is authoritative.
// Classified from the reasoning note written for the action.

function classifyOutcome(tool, note) {
  if (tool === 'claim_finding') return 'claimed';
  const r = String((note && note.result) || '');
  if (/dedup|repeat blocked|already run/i.test(r)) return 'blocked';
  if (/verified|confirmed/i.test(r)) return 'verified';
  // Negatives first: "no bypass found" found nothing — it must not
  // classify as 'found' on the word "found" alone.
  if (/no .* found|not found|nothing found|fail|error|refused|denied/i.test(r)) return 'fail';
  if (/found|discovered/i.test(r)) return 'found';
  return 'done';
}

// --- label ----------------------------------------------------------------
// `what | where | variant | outcome` — specific, never just "JWT done".
// The variant is whatever distinguishes this action from its siblings
// (the query, the payload shape, the command, the clicked text); the
// where is the surface it touched. Nothing is invented: a field the
// record does not have renders as '—'.
//
// labelParts is the structured form (what/where/variant/outcome);
// titleFor is the human title for the same action — the one-line
// name the process view and the action list show ("SQL Injection
// UNION dump", not a bare tool name). Both are pure over
// (tool, detail, outcome).

function hostPathOf(url) {
  try {
    const u = new URL(String(url || '').trim());
    return `${u.host}${u.pathname && u.pathname !== '/' ? u.pathname : ''}`;
  } catch {
    return '';
  }
}

function hostOfHandle(handle) {
  const m = /^cred:([^:]+):[0-9a-f]+$/i.exec(String(handle || '').trim());
  return m ? m[1] : '';
}

// Payload class of a shell command, from the command text alone —
// the short phrase that says WHAT the probe was trying. Only the
// patterns below are named; anything else falls through to the
// command's own tokens, never to an invented label.
function shellPayloadLabel(d) {
  if (/union(\s|\+|%20)+select/i.test(d)) return 'UNION SELECT dump';
  if (/<script/i.test(d)) return 'script-tag payload';
  if (/['"]\s*or\s+['"]?1['"]?\s*=\s*['"]?1/i.test(d)) return "' OR 1=1 probe";
  if (/\.\.\/|\.\.\\/.test(d)) return 'traversal payload';
  if (/\bselect\b.+\bfrom\b/i.test(d)) return 'SELECT probe';
  return null;
}

function shellParts(d) {
  const urlMatch = String(d || '').match(/https?:\/\/[^\s'"<>)|\]]+/i);
  const where = urlMatch ? clip(hostPathOf(urlMatch[0]) || urlMatch[0], 60) : '—';
  let variant = shellPayloadLabel(d);
  if (!variant && urlMatch) {
    try {
      const u = new URL(urlMatch[0]);
      variant = u.search ? clip(u.search, 40) : clip(u.pathname, 40);
    } catch { variant = null; }
  }
  if (!variant) variant = clip(String(d || '').split(/\s+/).slice(0, 2).join(' '), 40);
  return { where, variant: variant || '—' };
}

export function labelParts(tool, detail, outcome) {
  const t = String(tool || '?');
  const d = String(detail || '');
  let where = '—';
  let variant = '—';
  if (t === 'browser_open') {
    where = clip(hostPathOf(d) || d, 60);
    try { const u = new URL(d.trim()); if (u.search) variant = clip(u.search, 40); } catch { /* no query */ }
  } else if (t === 'record_coverage') {
    const parts = d.split(/\s+/);
    where = clip(parts[0] || '', 60);
    variant = clip(parts[1] || '', 40);
  } else if (t === 'browser_click') {
    variant = clip(d, 40);
  } else if (t === 'desktop_click') {
    where = clip(d, 60);
  } else if (t === 'desktop_click_control') {
    variant = clip(d, 40);
  } else if (t === 'shell' || t === 'desktop_terminal') {
    ({ where, variant } = shellParts(d));
  } else if (t === 'search' || t === 'browser_type' || t === 'recall' || t === 'claim_finding' || t === 'load_skill' || t === 'request_details' || t === 'hunt_plan' || t === 'task_complete') {
    variant = clip(d, 40);
  } else if (t === 'save_credential') {
    where = clip(hostPathOf(d) || d, 60);
  } else if (t === 'use_saved_credential' || t === 'fetch_verification_code') {
    where = clip(hostOfHandle(d) || d, 60);
  } else {
    variant = clip(d, 40);
  }
  return { what: t, where, variant, outcome };
}

export function labelFor(tool, detail, outcome) {
  const p = labelParts(tool, detail, outcome);
  return `${p.what} | ${p.where} | ${p.variant} | ${p.outcome}`;
}

/**
 * The human title of one action — what the list and the process
 * view show first. A shell probe names its payload class and
 * surface ("SQL Injection UNION dump"), a browser step names its
 * target ("Open 172.17.0.1:3100/vulnerabilities/sqli/"), a claim
 * IS its title. A bare tool name is never a title: anything the
 * patterns do not recognise falls back to the tool + its detail.
 */
export function titleFor(tool, detail, outcome) {
  const t = String(tool || '?');
  const d = String(detail || '').trim();
  if (t === 'shell' || t === 'desktop_terminal') {
    if (/union(\s|\+|%20)+select/i.test(d)) return 'SQL Injection UNION dump';
    if (/<script/i.test(d)) return 'XSS probe (script tag)';
    if (/['"]\s*or\s+['"]?1['"]?\s*=\s*['"]?1/i.test(d)) return 'SQL Injection auth-bypass probe';
    if (/\.\.\/|\.\.\\/.test(d)) return 'Path traversal probe';
    if (/\bselect\b.+\bfrom\b/i.test(d)) return 'SQL Injection probe';
    const urlMatch = d.match(/https?:\/\/[^\s'"<>)|\]]+/i);
    if (urlMatch) {
      const hp = hostPathOf(urlMatch[0]) || urlMatch[0];
      return `Fetch ${clip(hp, 60)}`;
    }
    const first = d.split(/\s+/)[0] || t;
    return `Run ${clip(d.split(/\s+/).slice(0, 3).join(' '), 60) || first}`;
  }
  if (t === 'browser_open') return `Open ${clip(hostPathOf(d) || d, 60)}`;
  if (t === 'browser_click' || t === 'desktop_click') return `Click "${clip(d, 50)}"`;
  if (t === 'browser_type') return `Type "${clip(d, 50)}"`;
  if (t === 'recall') return `Recall ${clip(d, 40)}`;
  if (t === 'claim_finding') return clip(d, 80) || 'Claim a finding';
  if (t === 'task_complete') return clip(d, 80) || 'Task complete';
  if (t === 'search') return `Search "${clip(d, 50)}"`;
  if (t === 'see_screen') return 'See the screen';
  return clip(d, 80) ? `${t}: ${clip(d, 60)}` : t;
}

// --- note matching --------------------------------------------------------
// The loop writes a reasoning note per action with action
// `<tool>: <detail>` (bare tool name for detail-less actions).
// Notes are chronological, like events: scan forward from the cursor
// and take the first unconsumed note naming this tool + detail.
// save_credential is the exception — its tool_call records the site
// while its note records the vault handle, so it matches on the tool
// prefix alone.

function matchNote(notes, cursor, tool, detail) {
  const prefix = `${tool}:`;
  for (let i = cursor; i < notes.length; i++) {
    const a = String((notes[i] && notes[i].action) || '');
    if (a !== tool && !a.startsWith(prefix)) continue;
    if (tool === 'save_credential') return { note: notes[i], next: i + 1 };
    const rest = a.startsWith(prefix) ? a.slice(prefix.length).trim() : '';
    if (rest && detail) {
      const needle = String(detail).slice(0, 30);
      if (needle && !rest.includes(needle) && !String(detail).includes(rest.slice(0, 30))) continue;
    }
    return { note: notes[i], next: i + 1 };
  }
  return { note: null, next: cursor };
}

// --- index ----------------------------------------------------------------

/**
 * The Action Index for one hunt, derived from its own events.
 * One entry per executed `tool_call` (in record order) + one per
 * `task_complete` milestone. `n` is the sequential 1-based position
 * — the fetch key. `hash` is the content-hash — the dedup key.
 * The entry keeps the raw event + its reasoning note, so recall by
 * id can return the Full Record without a second read.
 */
export function buildActionIndex(events, reasoningRows = []) {
  const notes = Array.isArray(reasoningRows) ? reasoningRows : [];
  const entries = [];
  let cursor = 0;
  for (const e of events || []) {
    if (!e) continue;
    if (e.type === 'tool_call') {
      const tool = String(e.tool || '?');
      const detail = String(e.detail || '');
      const { note, next } = matchNote(notes, cursor, tool, detail);
      cursor = next;
      const outcome = classifyOutcome(tool, note);
      const parts = labelParts(tool, detail, outcome);
      entries.push({
        n: entries.length + 1,
        tool,
        detail,
        hash: contentHash(tool, detail),
        label: labelFor(tool, detail, outcome),
        title: titleFor(tool, detail, outcome),
        variant: parts.variant,
        outcome,
        at: e.cachedAt || '',
        event: e,
        note,
      });
    } else if (e.type === 'task_complete') {
      const task = String(e.task || '');
      entries.push({
        n: entries.length + 1,
        tool: 'task_complete',
        detail: task,
        hash: contentHash('task_complete', task),
        label: labelFor('task_complete', task, 'done'),
        title: titleFor('task_complete', task, 'done'),
        variant: labelParts('task_complete', task, 'done').variant,
        outcome: 'done',
        at: e.cachedAt || '',
        event: e,
        note: null,
      });
    }
  }
  return entries;
}

/**
 * Bounded rendering of the index for the per-turn screen.
 * The newest `recentN` entries render in full; older entries roll
 * into one summary line per area (counts + first/last #N + up to two
 * variant examples). The whole block stays within `budgetChars`;
 * anything dropped is named by count, never silently.
 */
export function indexLines(entries, { budgetChars = INDEX_BUDGET_CHARS, recentN = INDEX_RECENT_N, topics = DEFAULT_TOPICS } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return [];
  const header = '=== ACTION INDEX — what you have done in THIS hunt (one line per action; #N is the lookup — {"action":"recall","id":N} returns the full record) ===';
  const recent = list.slice(-recentN);
  const older = list.slice(0, Math.max(0, list.length - recentN));
  const lines = [header];
  if (older.length) {
    const byArea = new Map();
    for (const e of older) {
      const area = groupArea(e, topics);
      let g = byArea.get(area.id);
      if (!g) { g = { label: area.label, count: 0, first: e.n, last: e.n, variants: [] }; byArea.set(area.id, g); }
      g.count++;
      g.last = e.n;
      const v = String(e.label || '').split(' | ')[2] || '';
      if (v && v !== '—' && !g.variants.includes(v) && g.variants.length < 2) g.variants.push(v);
    }
    for (const g of [...byArea.values()].sort((a, b) => b.count - a.count)) {
      lines.push(`earlier: ${g.label} ×${g.count} (#${g.first}–#${g.last})${g.variants.length ? ` — e.g. ${g.variants.join(', ')}` : ''}`);
    }
  }
  for (const e of recent) lines.push(`#${e.n} ${e.label}`);
  // Budget: drop oldest summary lines first, then oldest recent
  // lines; the header and the dropped-count note always survive.
  let dropped = 0;
  const total = () => lines.join('\n').length;
  while (total() > budgetChars && lines.length > 2) {
    // summary lines sit right after the header (index 1..); drop the
    // oldest summary first, else the oldest recent line.
    const summaryIdx = lines.findIndex((l, i) => i > 0 && l.startsWith('earlier:'));
    if (summaryIdx >= 0) lines.splice(summaryIdx, 1);
    else lines.splice(1, 1);
    dropped++;
  }
  if (dropped > 0) lines.push(`…and ${dropped} more action line(s) on record — recall #N for any line`);
  return lines;
}

// --- recall ---------------------------------------------------------------

/** Parse a recall id: 7, '7' or '#7' → 7; anything else → null. */
export function parseRecallId(raw) {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim().replace(/^#/, '');
    if (/^\d+$/.test(t)) return parseInt(t, 10);
  }
  return null;
}

/**
 * Recall by sequential id — O(1): the Nth action of THIS hunt's
 * index, with its full stored record (the tool_call event + the
 * reasoning note written for it). Out of range → an error naming
 * how many actions the index holds. Never another hunt's data: the
 * entries come only from the events handed in.
 */
export function recallById(events, reasoningRows, id) {
  const entries = buildActionIndex(events, reasoningRows);
  const n = parseRecallId(id);
  if (!n || n < 1 || n > entries.length) {
    return { error: `no action #${String(id ?? '')} — this hunt's index holds ${entries.length} action(s)`, count: entries.length };
  }
  const entry = entries[n - 1];
  return { entry, event: entry.event, note: entry.note };
}

/** Recall by content-hash — the first action in this hunt with that hash. */
export function recallByHash(events, reasoningRows, hash) {
  const h = String(hash || '').trim().toLowerCase();
  if (!h) return { error: 'empty hash', count: 0 };
  const entries = buildActionIndex(events, reasoningRows);
  const entry = entries.find((e) => e.hash === h);
  if (!entry) return { error: `no action with hash ${h} in this hunt`, count: entries.length };
  return { entry, event: entry.event, note: entry.note };
}

/**
 * The index number of the FIRST run of an identical action in this
 * hunt (same tool + canonical detail), or null when it never ran.
 * The dedup-block observation names it: the brain is told WHERE its
 * repeat already lives instead of just being refused.
 */
export function firstRunNumber(events, tool, detail) {
  const sig = actionSignature(tool, detail);
  const entries = buildActionIndex(events);
  for (const e of entries) {
    if (e.tool === String(tool || '').toLowerCase() && actionSignature(e.tool, e.detail) === sig) return e.n;
  }
  return null;
}

/** The full stored record of a recalled action, as an observation (~1,500 chars). */
export function formatFullRecord(rec) {
  if (!rec || rec.error) return rec && rec.error ? rec.error : 'Recall returned nothing.';
  const { entry, note } = rec;
  const lines = [
    `#${entry.n} ${entry.tool} — ${entry.detail || '(no detail)'}`,
    `hash ${entry.hash} · when: ${entry.at || 'unknown'}`,
  ];
  if (note) {
    if (note.why) lines.push(`why: ${String(note.why).slice(0, 400)}`);
    if (note.result) lines.push(`result: ${String(note.result).slice(0, 500)}`);
    if (note.learned) lines.push(`learned: ${String(note.learned).slice(0, 300)}`);
  } else {
    lines.push('(no reasoning note was written for this action — the event above is the full record.)');
  }
  return lines.join('\n').slice(0, 1500);
}
