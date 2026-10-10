/**
 * Wave 109A — Note management core (ideas 54321-54330).
 *
 * Pure JS core logic for the Dark Matter / Hunt AI note system:
 * per-target note export, quick notes, hunt-time capture, [[target]] linking,
 * reminders, archiving, trash/restore, permissions, and annotations pinned to
 * scope rules and findings.
 *
 * All exports are deterministic pure functions operating on plain objects.
 * A tiny in-memory store (createNoteStore) keeps demo state; nothing persists
 * outside the caller's objects.
 * Branding: Infinity AI / Dark Matter / Obfinity.
 */

export const WAVE109_A_IDEAS = [
  { id: 54321, title: 'Note export per target', summary: "Downloads all notes for a target as Markdown or PDF-ready text for handoffs." },
  { id: 54322, title: 'Quick-note from dashboard', summary: 'Adds a note to any target from its card via keyboard shortcut.' },
  { id: 54323, title: 'Quick-note during hunt', summary: "Captures observations mid-hunt that land on the target's timeline automatically." },
  { id: 54324, title: 'Note linking between targets', summary: 'References another target with [[target]] syntax to build cross-target context.' },
  { id: 54325, title: 'Note reminders', summary: 'Sets a follow-up date on a note that pings the author when due.' },
  { id: 54326, title: 'Note archiving', summary: 'Archives outdated notes out of the main view while keeping them searchable.' },
  { id: 54327, title: 'Note trash and restore', summary: 'Soft-deletes notes with 30-day restore instead of permanent loss.' },
  { id: 54328, title: 'Note permissions', summary: 'Controls who can create, edit, or delete notes per target or group.' },
  { id: 54329, title: 'Annotation on scope rules', summary: 'Pins explanatory notes directly onto individual scope rules.' },
  { id: 54330, title: 'Annotation on findings', summary: 'Adds analyst context notes onto findings from the target view.' },
];

const NOTE_STATUSES = ['active', 'archived', 'trashed'];
const TRASH_RETENTION_DAYS = 30;

/* ------------------------------------------------------------------ */
/* Store + note model                                                  */
/* ------------------------------------------------------------------ */

let noteSeq = 0;

/** Creates an empty in-memory note store: { notes: Map, reminders: Set }. */
export function createNoteStore() {
  return { notes: new Map() };
}

/** Normalizes a note object, filling defaults. Does not mutate the input. */
export function normalizeNote(input = {}) {
  const note = {
    id: input.id || `note-${Date.now().toString(36)}-${(noteSeq += 1)}`,
    targetId: input.targetId || 'unassigned',
    author: input.author || 'analyst',
    title: input.title || 'Untitled note',
    body: input.body || '',
    tags: Array.isArray(input.tags) ? [...input.tags] : [],
    status: NOTE_STATUSES.includes(input.status) ? input.status : 'active',
    pinned: Boolean(input.pinned),
    severity: input.severity || 'info',
    reminderAt: input.reminderAt || null,
    reminderDismissed: Boolean(input.reminderDismissed),
    trashedAt: input.trashedAt || null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
    history: Array.isArray(input.history) ? [...input.history] : [],
    linkedTargets: Array.isArray(input.linkedTargets) ? [...input.linkedTargets] : [],
  };
  return note;
}

/** Adds a normalized note to the store. Returns the stored note. */
export function addNote(store, input) {
  const note = normalizeNote(input);
  store.notes.set(note.id, note);
  return note;
}

/** Returns a note by id, or null. */
export function getNote(store, id) {
  return store.notes.get(id) || null;
}

/** Returns all notes as an array, in insertion order. */
export function listNotes(store) {
  return [...store.notes.values()];
}

/* ------------------------------------------------------------------ */
/* 54321 — Note export per target                                       */
/* ------------------------------------------------------------------ */

/** Renders one note as Markdown. */
export function noteToMarkdown(note) {
  const n = normalizeNote(note);
  const lines = [
    `## ${n.title}`,
    '',
    `Author: ${n.author} · Updated: ${n.updatedAt.slice(0, 10)} · Status: ${n.status}`,
    ...(n.pinned ? ['Pinned: yes'] : []),
    ...(n.tags.length ? [`Tags: ${n.tags.join(', ')}`] : []),
    '',
    n.body,
  ];
  return lines.join('\n');
}

/**
 * Builds a per-target Markdown export of all non-trashed notes.
 * Returns { targetId, filename, markdown, noteCount }.
 */
export function notesToMarkdown(notes, targetId, targetName = targetId) {
  const selected = (notes || []).filter((n) => n.targetId === targetId && n.status !== 'trashed');
  const body = selected.map(noteToMarkdown).join('\n\n---\n\n');
  const safe = String(targetName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'target';
  return {
    targetId,
    filename: `dark-matter-notes-${safe}.md`,
    markdown: `# Notes — ${targetName}\n\nExported by Infinity AI · ${new Date().toISOString().slice(0, 10)}\n\n${body}`,
    noteCount: selected.length,
  };
}

/* ------------------------------------------------------------------ */
/* 54322 — Quick-note from dashboard                                    */
/* ------------------------------------------------------------------ */

export const QUICK_NOTE_SHORTCUT = 'n';

/**
 * Creates a quick note from a dashboard target card.
 * Returns the stored note (title defaults to the first line of the body).
 */
export function createQuickNote(store, { targetId, author, body }) {
  if (!targetId) throw new Error('createQuickNote requires targetId');
  const text = String(body || '').trim();
  if (!text) throw new Error('createQuickNote requires a non-empty body');
  const title = text.split('\n')[0].slice(0, 60) || 'Quick note';
  return addNote(store, { targetId, author, title, body: text, tags: ['quick-note'] });
}

/* ------------------------------------------------------------------ */
/* 54323 — Quick-note during hunt (lands on target timeline)            */
/* ------------------------------------------------------------------ */

/**
 * Captures a mid-hunt observation. The note carries a timeline entry so the
 * hunt view can render it in chronological order automatically.
 */
export function captureHuntObservation(store, { targetId, author, body, huntStep = 0 }) {
  const note = createQuickNote(store, { targetId, author, body });
  note.tags.push('hunt-observation');
  note.history.push({ at: new Date().toISOString(), by: author, event: 'hunt-observation', huntStep });
  return note;
}

/** Filters notes to those that should appear on a target's timeline. */
export function timelineNotes(notes, targetId) {
  return (notes || [])
    .filter((n) => n.targetId === targetId && n.status === 'active')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/* ------------------------------------------------------------------ */
/* 54324 — Note linking between targets ([[target]] syntax)            */
/* ------------------------------------------------------------------ */

/** Extracts [[target-id]] references from note body text. */
export function parseTargetLinks(body) {
  const refs = [];
  const re = /\[\[([A-Za-z0-9][A-Za-z0-9._-]{0,63})\]\]/g;
  let m;
  while ((m = re.exec(String(body || ''))) !== null) {
    if (!refs.includes(m[1])) refs.push(m[1]);
  }
  return refs;
}

/**
 * Resolves a note's [[target]] references against a list of known targets.
 * Mutates note.linkedTargets. Returns { linked, unknown }.
 */
export function resolveLinks(note, targets) {
  const refs = parseTargetLinks(note.body);
  const known = new Set((targets || []).map((t) => t.id));
  const linked = refs.filter((r) => known.has(r));
  const unknown = refs.filter((r) => !known.has(r));
  note.linkedTargets = linked;
  note.updatedAt = new Date().toISOString();
  return { linked, unknown };
}

/* ------------------------------------------------------------------ */
/* 54325 — Note reminders                                              */
/* ------------------------------------------------------------------ */

/** Sets (or clears with null) a follow-up reminder date on a note. */
export function setReminder(note, isoDate) {
  if (isoDate !== null && Number.isNaN(Date.parse(isoDate))) {
    throw new Error('setReminder requires a valid ISO date or null');
  }
  note.reminderAt = isoDate;
  note.reminderDismissed = false;
  note.updatedAt = new Date().toISOString();
  return note;
}

/** Marks the reminder as dismissed without clearing the date. */
export function dismissReminder(note) {
  note.reminderDismissed = true;
  note.updatedAt = new Date().toISOString();
  return note;
}

/** Returns notes whose reminder is due at `now` (not dismissed, not trashed). */
export function dueReminders(notes, now = new Date()) {
  const t = new Date(now).getTime();
  return (notes || []).filter(
    (n) => n.status !== 'trashed' && n.reminderAt && !n.reminderDismissed && new Date(n.reminderAt).getTime() <= t
  );
}

/* ------------------------------------------------------------------ */
/* 54326 — Note archiving                                              */
/* ------------------------------------------------------------------ */

/** Archives a note (out of main view, still searchable). */
export function archiveNote(note) {
  note.status = 'archived';
  note.updatedAt = new Date().toISOString();
  note.history.push({ at: note.updatedAt, by: note.author, event: 'archived' });
  return note;
}

/** Restores an archived note to active. */
export function unarchiveNote(note) {
  if (note.status === 'archived') {
    note.status = 'active';
    note.updatedAt = new Date().toISOString();
    note.history.push({ at: note.updatedAt, by: note.author, event: 'unarchived' });
  }
  return note;
}

/** Returns only active notes (main view). */
export function activeNotes(notes) {
  return (notes || []).filter((n) => n.status === 'active');
}

/** Case-insensitive search across all non-trashed notes, including archived. */
export function searchNotes(notes, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  return (notes || []).filter(
    (n) =>
      n.status !== 'trashed' &&
      (n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)))
  );
}

/* ------------------------------------------------------------------ */
/* 54327 — Note trash and restore                                      */
/* ------------------------------------------------------------------ */

/** Soft-deletes a note; restorable within TRASH_RETENTION_DAYS. */
export function trashNote(note) {
  note.status = 'trashed';
  note.trashedAt = new Date().toISOString();
  note.updatedAt = note.trashedAt;
  note.history.push({ at: note.trashedAt, by: note.author, event: 'trashed' });
  return note;
}

/** Restores a trashed note to active. */
export function restoreNote(note) {
  if (note.status === 'trashed') {
    note.status = 'active';
    note.trashedAt = null;
    note.updatedAt = new Date().toISOString();
    note.history.push({ at: note.updatedAt, by: note.author, event: 'restored' });
  }
  return note;
}

/** Returns trashed notes whose retention window has expired (purge-eligible). */
export function purgeEligible(notes, now = new Date(), days = TRASH_RETENTION_DAYS) {
  const t = new Date(now).getTime();
  return (notes || []).filter(
    (n) => n.status === 'trashed' && n.trashedAt && t - new Date(n.trashedAt).getTime() > days * 86400000
  );
}

/** Days remaining before a trashed note becomes purge-eligible. */
export function trashDaysRemaining(note, now = new Date(), days = TRASH_RETENTION_DAYS) {
  if (note.status !== 'trashed' || !note.trashedAt) return 0;
  const elapsed = (new Date(now).getTime() - new Date(note.trashedAt).getTime()) / 86400000;
  return Math.max(0, Math.ceil(days - elapsed));
}

/* ------------------------------------------------------------------ */
/* 54328 — Note permissions                                            */
/* ------------------------------------------------------------------ */

const ROLE_RANK = { viewer: 1, analyst: 2, owner: 3 };

/**
 * Creates a permission policy.
 * overrides: { [targetId]: { create: [roles], edit: [roles], delete: [roles] } }
 * defaults: { create: ['analyst','owner'], edit: ['analyst','owner'], delete: ['owner'] }
 */
export function createPolicy(overrides = {}) {
  return {
    defaults: { create: ['analyst', 'owner'], edit: ['analyst', 'owner'], delete: ['owner'] },
    overrides,
  };
}

function allowedRoles(policy, targetId, action) {
  const ov = (policy.overrides || {})[targetId];
  if (ov && Array.isArray(ov[action])) return ov[action];
  return policy.defaults[action];
}

/** True when the actor's role list contains a role allowed for the action. */
export function canPerform(policy, { roles = [], targetId, action }) {
  const allowed = allowedRoles(policy, targetId, action);
  return roles.some((r) => allowed.includes(r));
}

export function canCreate(policy, opts) { return canPerform(policy, { ...opts, action: 'create' }); }
export function canEdit(policy, opts) { return canPerform(policy, { ...opts, action: 'edit' }); }
export function canDelete(policy, opts) { return canPerform(policy, { ...opts, action: 'delete' }); }

/** Returns the role rank (for UI badges); unknown roles rank 0. */
export function roleRank(role) {
  return ROLE_RANK[role] || 0;
}

/* ------------------------------------------------------------------ */
/* 54329 — Annotation on scope rules                                   */
/* ------------------------------------------------------------------ */

/** Pins an explanatory annotation onto a scope rule. */
export function annotateScopeRule(rule, { text, author }) {
  if (!rule.annotations) rule.annotations = [];
  const annotation = {
    id: `ann-${Date.now().toString(36)}-${(noteSeq += 1)}`,
    text: String(text || '').trim(),
    author: author || 'analyst',
    at: new Date().toISOString(),
  };
  if (!annotation.text) throw new Error('annotateScopeRule requires non-empty text');
  rule.annotations.push(annotation);
  return annotation;
}

/** Lists annotations on a scope rule, newest first. */
export function listScopeAnnotations(rule) {
  return [...(rule.annotations || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
}

/* ------------------------------------------------------------------ */
/* 54330 — Annotation on findings                                      */
/* ------------------------------------------------------------------ */

/** Adds analyst context to a finding. */
export function annotateFinding(finding, { text, author }) {
  if (!finding.contextNotes) finding.contextNotes = [];
  const note = {
    id: `ctx-${Date.now().toString(36)}-${(noteSeq += 1)}`,
    text: String(text || '').trim(),
    author: author || 'analyst',
    at: new Date().toISOString(),
  };
  if (!note.text) throw new Error('annotateFinding requires non-empty text');
  finding.contextNotes.push(note);
  return note;
}

/** Latest analyst context line for a finding, or null. Ties break by insertion order (last wins). */
export function latestFindingContext(finding) {
  const notes = finding.contextNotes || [];
  if (!notes.length) return null;
  return notes.reduce((a, b) => (new Date(a.at) > new Date(b.at) ? a : b));
}
