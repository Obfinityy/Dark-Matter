/**
 * Wave 109C — Note collaboration (ideas 54341-54350).
 *
 * Pure JS core logic for the Dark Matter / Hunt AI note system:
 * word counts, last-edited indicators, collaborative editing presence,
 * edit conflict resolution, the Notes API surface, activity logs,
 * translation records, pinned-note digests, note templates and scheduled
 * stale-note prompts.
 *
 * All exports are deterministic pure functions on plain objects.
 * Branding: Infinity AI / Dark Matter / Obfinity.
 */

export const WAVE109_C_IDEAS = [
  { id: 54341, title: 'Note word count', summary: 'Shows length stats to keep handoff notes appropriately detailed.' },
  { id: 54342, title: 'Last-edited indicator', summary: 'Badges notes edited in the last 24 hours so fresh context stands out.' },
  { id: 54343, title: 'Collaborative editing', summary: 'Shows live cursors when two teammates edit the same note.' },
  { id: 54344, title: 'Edit conflict resolution', summary: 'Merges or picks versions when simultaneous edits collide.' },
  { id: 54345, title: 'Notes API', summary: 'Creates and reads notes programmatically for migration and automation.' },
  { id: 54346, title: 'Note activity log', summary: 'Records note views, edits, and shares for sensitive-target auditing.' },
  { id: 54347, title: 'Note translation', summary: 'Translates notes between team languages while keeping the original.' },
  { id: 54348, title: 'Pinned-note digest', summary: 'Emails owners a weekly digest of pinned notes across their targets.' },
  { id: 54349, title: 'Note templates library', summary: 'Shares organization-wide note templates with versioning.' },
  { id: 54350, title: 'Scheduled note prompts', summary: 'Nudges owners monthly to refresh stale access notes.' },
];

const ACTIVITY_ACTIONS = ['view', 'edit', 'share'];
const TEMPLATE_VAR_RE = /\{\{\s*([A-Za-z0-9_]{1,40})\s*\}\}/g;

/* ------------------------------------------------------------------ */
/* 54341 — Note word count                                             */
/* ------------------------------------------------------------------ */

/** Counts words in a text (sequences of letters/digits). */
export function wordCount(text) {
  const words = String(text || '').trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return words.length;
}

/** Estimated reading time in seconds at 200 wpm, minimum 1s. */
export function readingTimeSec(text) {
  return Math.max(1, Math.ceil((wordCount(text) / 200) * 60));
}

/** Length stats for a note: words, characters, reading seconds. */
export function noteStats(note) {
  const body = note.body || '';
  return { words: wordCount(body), chars: body.length, readingSec: readingTimeSec(body) };
}

/* ------------------------------------------------------------------ */
/* 54342 — Last-edited indicator                                       */
/* ------------------------------------------------------------------ */

/** True when the note was updated within the last `hours` (default 24). */
export function isRecentlyEdited(note, now = new Date(), hours = 24) {
  if (!note.updatedAt) return false;
  return new Date(now).getTime() - new Date(note.updatedAt).getTime() <= hours * 3600000;
}

/** Filters notes to those edited within the window, newest first. */
export function recentlyEdited(notes, now = new Date(), hours = 24) {
  return (notes || [])
    .filter((n) => isRecentlyEdited(n, now, hours))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/* ------------------------------------------------------------------ */
/* 54343 — Collaborative editing (presence)                            */
/* ------------------------------------------------------------------ */

/** Creates an editing session record for one note. */
export function createSession(noteId) {
  return { noteId, participants: {} };
}

/**
 * Adds/refreshes a participant's cursor. cursor: { line, col }.
 * Returns the participant record.
 */
export function joinSession(session, { userId, userName, cursor = { line: 0, col: 0 } }) {
  if (!userId) throw new Error('joinSession requires userId');
  const record = {
    userId,
    userName: userName || userId,
    cursor: { line: Math.max(0, Number(cursor.line) || 0), col: Math.max(0, Number(cursor.col) || 0) },
    lastSeen: new Date().toISOString(),
  };
  session.participants[userId] = record;
  return record;
}

/** Removes a participant. Returns true when removed. */
export function leaveSession(session, userId) {
  if (!(userId in session.participants)) return false;
  delete session.participants[userId];
  return true;
}

/** Active cursors excluding the given user (what THEY see rendered). */
export function activeCursors(session, excludeUserId = null) {
  return Object.values(session.participants)
    .filter((p) => p.userId !== excludeUserId)
    .map((p) => ({ userId: p.userId, userName: p.userName, cursor: p.cursor }));
}

/* ------------------------------------------------------------------ */
/* 54344 — Edit conflict resolution                                    */
/* ------------------------------------------------------------------ */

/**
 * Detects a conflict: both sides changed body since baseRevision.
 * Revisions: { body, rev } — rev increments per edit.
 */
export function hasConflict(base, local, remote) {
  return local.rev !== base.rev && remote.rev !== base.rev && local.body !== remote.body;
}

/**
 * Resolves a conflict. strategy:
 *  - 'newest-wins': later updatedAt wins (ties → remote).
 *  - 'manual-merge': returns merged body with conflict markers for review.
 */
export function resolveConflict(base, local, remote, strategy = 'newest-wins') {
  if (!hasConflict(base, local, remote)) {
    return local.rev !== base.rev ? local : remote;
  }
  if (strategy === 'manual-merge') {
    return {
      ...local,
      body: `<<<<<<< local (${local.author || 'you'})\n${local.body}\n=======\n${remote.body}\n>>>>>>> remote (${remote.author || 'peer'})`,
      rev: Math.max(local.rev, remote.rev) + 1,
      conflict: true,
    };
  }
  const winner = new Date(local.updatedAt || 0) > new Date(remote.updatedAt || 0) ? local : remote;
  return { ...winner, rev: Math.max(local.rev, remote.rev) + 1, conflict: false };
}

/* ------------------------------------------------------------------ */
/* 54345 — Notes API                                                   */
/* ------------------------------------------------------------------ */

const API_REQUIRED = ['targetId', 'title', 'body'];

/** Validates an API create payload; throws on missing/invalid fields. */
export function apiCreateNote(payload) {
  const p = payload || {};
  for (const f of API_REQUIRED) {
    if (p[f] === undefined || p[f] === null || String(p[f]).trim() === '') {
      throw new Error(`apiCreateNote: missing required field "${f}"`);
    }
  }
  return {
    targetId: String(p.targetId),
    title: String(p.title).slice(0, 200),
    body: String(p.body),
    author: String(p.author || 'api'),
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    pinned: Boolean(p.pinned),
  };
}

/** Parses list filters from API query params. */
export function parseApiFilters(query = {}) {
  return {
    targetId: query.targetId ? String(query.targetId) : null,
    tag: query.tag ? String(query.tag) : null,
    status: ['active', 'archived', 'trashed'].includes(query.status) ? query.status : null,
    limit: Math.min(200, Math.max(1, Number(query.limit) || 50)),
  };
}

/** Applies API filters to a note list. */
export function apiNoteList(notes, filters) {
  const f = filters || {};
  return (notes || [])
    .filter((n) => !f.targetId || n.targetId === f.targetId)
    .filter((n) => !f.tag || (n.tags || []).includes(f.tag))
    .filter((n) => !f.status || n.status === f.status)
    .slice(0, f.limit || 50);
}

/** Shapes a note as a JSON API response (strips nothing sensitive here; notes are internal). */
export function apiNoteToResponse(note) {
  return {
    id: note.id,
    targetId: note.targetId,
    title: note.title,
    body: note.body,
    author: note.author,
    tags: note.tags || [],
    status: note.status,
    pinned: Boolean(note.pinned),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* 54346 — Note activity log                                           */
/* ------------------------------------------------------------------ */

/** Appends an activity entry (view/edit/share) to a note. */
export function logActivity(note, { action, actor, at = new Date().toISOString() }) {
  if (!ACTIVITY_ACTIONS.includes(action)) {
    throw new Error(`logActivity: action must be one of ${ACTIVITY_ACTIONS.join(', ')}`);
  }
  if (!note.activity) note.activity = [];
  const entry = { action, actor: actor || 'unknown', at };
  note.activity.push(entry);
  return entry;
}

/** Counts activity by action for audit views. */
export function activitySummary(note) {
  const summary = { view: 0, edit: 0, share: 0 };
  for (const e of note.activity || []) {
    if (e.action in summary) summary[e.action] += 1;
  }
  return summary;
}

/* ------------------------------------------------------------------ */
/* 54347 — Note translation                                             */
/* ------------------------------------------------------------------ */

/**
 * Stores a translation of the note body. Original is always preserved.
 * translations: { [lang]: { text, translator, at } }.
 */
export function translateNote(note, { lang, text, translator = 'auto' }) {
  const l = String(lang || '').toLowerCase().trim();
  if (!l) throw new Error('translateNote requires lang');
  const t = String(text || '').trim();
  if (!t) throw new Error('translateNote requires non-empty text');
  if (!note.translations) note.translations = {};
  note.translations[l] = { text: t, translator, at: new Date().toISOString() };
  return note.translations[l];
}

/** Returns the translated text when available, else the original body. */
export function bestText(note, lang) {
  const l = String(lang || '').toLowerCase();
  const tr = (note.translations || {})[l];
  return tr ? tr.text : note.body;
}

/* ------------------------------------------------------------------ */
/* 54348 — Pinned-note digest                                           */
/* ------------------------------------------------------------------ */

/**
 * Builds a weekly digest of pinned notes updated since `since`.
 * Returns { subject, body, noteCount, recipients }.
 */
export function pinnedDigest(notes, { since, recipients = [] } = {}) {
  const sinceT = since ? new Date(since).getTime() : 0;
  const pinned = (notes || []).filter(
    (n) => n.pinned && n.status === 'active' && new Date(n.updatedAt || 0).getTime() >= sinceT
  );
  const lines = pinned.map((n) => `- ${n.title} [${n.targetId}]: ${(n.body || '').slice(0, 120)}`);
  return {
    subject: `Infinity AI pinned-notes digest — ${pinned.length} notes`,
    body: lines.length ? lines.join('\n') : 'No pinned notes updated this week.',
    noteCount: pinned.length,
    recipients,
  };
}

/* ------------------------------------------------------------------ */
/* 54349 — Note templates library                                      */
/* ------------------------------------------------------------------ */

/** Creates an org-wide note template with versioning. */
export function createTemplate({ name, body, author = 'org' }) {
  if (!name || !String(name).trim()) throw new Error('createTemplate requires a name');
  return {
    id: `tpl-${Date.now().toString(36)}`,
    name: String(name).trim(),
    body: String(body || ''),
    version: 1,
    author,
    createdAt: new Date().toISOString(),
  };
}

/** Applies a template, substituting {{var}} placeholders (missing vars stay as-is). */
export function applyTemplate(template, vars = {}) {
  return String(template.body || '').replace(TEMPLATE_VAR_RE, (m, key) =>
    key in vars ? String(vars[key]) : m
  );
}

/** Bumps a template version (returns a new object; original untouched). */
export function bumpTemplateVersion(template, newBody) {
  return {
    ...template,
    body: newBody !== undefined ? String(newBody) : template.body,
    version: template.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* 54350 — Scheduled note prompts                                       */
/* ------------------------------------------------------------------ */

/**
 * Finds active notes not updated in `daysStale` days → owners to nudge.
 * Returns [{ noteId, title, owner, daysStale }] sorted by stalest first.
 */
export function staleNotePrompts(notes, now = new Date(), daysStale = 30) {
  const t = new Date(now).getTime();
  return (notes || [])
    .filter((n) => n.status === 'active')
    .map((n) => ({
      noteId: n.id,
      title: n.title,
      owner: n.author,
      daysStale: Math.floor((t - new Date(n.updatedAt || n.createdAt).getTime()) / 86400000),
    }))
    .filter((p) => p.daysStale >= daysStale)
    .sort((a, b) => b.daysStale - a.daysStale);
}

/** Computes the next prompt date given the last one and an interval in days. */
export function nextPromptDate(lastPromptIso, intervalDays = 30) {
  const base = lastPromptIso ? new Date(lastPromptIso).getTime() : Date.now();
  return new Date(base + intervalDays * 86400000).toISOString();
}
