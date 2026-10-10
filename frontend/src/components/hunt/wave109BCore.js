/**
 * Wave 109B — Annotation & capture (ideas 54331-54340).
 *
 * Pure JS core logic for the Dark Matter / Hunt AI note system:
 * change annotations, health-incident postmortems, screenshot drawings,
 * voice-note attachments, deterministic extractive summarization,
 * note duplication/move, bulk export, print briefings and the global
 * note-composer keyboard shortcut.
 *
 * All exports are deterministic pure functions on plain objects.
 * Branding: Infinity AI / Dark Matter / Obfinity.
 */

export const WAVE109_B_IDEAS = [
  { id: 54331, title: 'Annotation on changes', summary: 'Marks detected changes with "expected deploy" or "investigating" notes.' },
  { id: 54332, title: 'Annotation on health incidents', summary: 'Records root-cause notes on downtime incidents for postmortems.' },
  { id: 54333, title: 'Drawing on screenshots', summary: 'Sketches arrows and boxes on attached screenshots to highlight areas.' },
  { id: 54334, title: 'Voice note attachments', summary: 'Records short audio notes for hands-busy field observations.' },
  { id: 54335, title: 'AI note summarization', summary: "Generates a one-paragraph brief from a target's full note history on demand." },
  { id: 54336, title: 'Note duplication', summary: "Copies a note's structure to another target when setups repeat." },
  { id: 54337, title: 'Note move between targets', summary: 'Relocates a misfiled note to the correct target preserving history.' },
  { id: 54338, title: 'Bulk note export', summary: 'Exports notes across a group or client selection for audits.' },
  { id: 54339, title: 'Note print view', summary: 'Renders a clean printable briefing from selected notes.' },
  { id: 54340, title: 'Note keyboard shortcut', summary: 'Opens the note composer from anywhere with a global shortcut.' },
];

const CHANGE_ANNOTATION_KINDS = ['expected-deploy', 'investigating', 'false-positive'];
const SHAPE_TYPES = ['arrow', 'box', 'circle'];
const MAX_VOICE_SECONDS = 120;
let drawSeq = 0;

/* ------------------------------------------------------------------ */
/* 54331 — Annotation on changes                                       */
/* ------------------------------------------------------------------ */

/** Adds an annotation to a detected change. kind ∈ expected-deploy|investigating|false-positive. */
export function annotateChange(change, { kind, text, author }) {
  if (!CHANGE_ANNOTATION_KINDS.includes(kind)) {
    throw new Error(`annotateChange: kind must be one of ${CHANGE_ANNOTATION_KINDS.join(', ')}`);
  }
  if (!change.annotations) change.annotations = [];
  const annotation = {
    id: `chg-${Date.now().toString(36)}-${(drawSeq += 1)}`,
    kind,
    text: String(text || '').trim(),
    author: author || 'analyst',
    at: new Date().toISOString(),
  };
  if (!annotation.text) throw new Error('annotateChange requires non-empty text');
  change.annotations.push(annotation);
  return annotation;
}

/** Counts annotations per kind for a change. */
export function changeAnnotationSummary(change) {
  const summary = { 'expected-deploy': 0, investigating: 0, 'false-positive': 0 };
  for (const a of change.annotations || []) {
    if (a.kind in summary) summary[a.kind] += 1;
  }
  return summary;
}

/* ------------------------------------------------------------------ */
/* 54332 — Annotation on health incidents                              */
/* ------------------------------------------------------------------ */

/**
 * Records a root-cause note on a health incident.
 * actionItems: array of { text, owner, done }.
 */
export function recordRootCause(incident, { cause, author, actionItems = [] }) {
  const text = String(cause || '').trim();
  if (!text) throw new Error('recordRootCause requires a non-empty cause');
  incident.rootCause = {
    cause: text,
    author: author || 'analyst',
    at: new Date().toISOString(),
    actionItems: actionItems.map((a) => ({
      text: String(a.text || '').trim(),
      owner: a.owner || 'unassigned',
      done: Boolean(a.done),
    })),
  };
  return incident.rootCause;
}

/** Renders a plain-text postmortem from an incident with a recorded root cause. */
export function incidentPostmortem(incident) {
  const rc = incident.rootCause;
  if (!rc) throw new Error('incidentPostmortem requires a recorded root cause');
  const items = rc.actionItems.map((a) => `- [${a.done ? 'x' : ' '}] ${a.text} (${a.owner})`).join('\n');
  return [
    `# Postmortem — ${incident.title || incident.id}`,
    '',
    `Root cause (${rc.author}, ${rc.at.slice(0, 10)}):`,
    rc.cause,
    '',
    'Action items:',
    items || 'None recorded.',
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* 54333 — Drawing on screenshots                                      */
/* ------------------------------------------------------------------ */

/**
 * Adds a highlight shape to a screenshot. Coordinates are normalized 0-1000.
 * type ∈ arrow|box|circle.
 */
export function addShape(screenshot, { type, x1, y1, x2, y2, label = '' }) {
  if (!SHAPE_TYPES.includes(type)) throw new Error(`addShape: type must be one of ${SHAPE_TYPES.join(', ')}`);
  for (const [k, v] of Object.entries({ x1, y1, x2, y2 })) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1000) throw new Error(`addShape: ${k} must be a number in 0-1000`);
  }
  if (!screenshot.shapes) screenshot.shapes = [];
  const shape = {
    id: `shp-${Date.now().toString(36)}-${(drawSeq += 1)}`,
    type,
    x1: Number(x1), y1: Number(y1), x2: Number(x2), y2: Number(y2),
    label: String(label).slice(0, 80),
  };
  screenshot.shapes.push(shape);
  return shape;
}

/** Removes a shape by id. Returns true when something was removed. */
export function removeShape(screenshot, shapeId) {
  const shapes = screenshot.shapes || [];
  const idx = shapes.findIndex((s) => s.id === shapeId);
  if (idx === -1) return false;
  shapes.splice(idx, 1);
  return true;
}

/** Serializes shapes to a compact JSON string for storage/transport. */
export function serializeShapes(screenshot) {
  return JSON.stringify((screenshot.shapes || []).map(({ id, type, x1, y1, x2, y2, label }) => ({ id, type, x1, y1, x2, y2, label })));
}

/* ------------------------------------------------------------------ */
/* 54334 — Voice note attachments                                      */
/* ------------------------------------------------------------------ */

/** Creates a voice-note attachment record (≤120s). */
export function createVoiceNote({ noteId, author, durationSec, storageRef }) {
  const dur = Number(durationSec);
  if (!Number.isFinite(dur) || dur <= 0) throw new Error('createVoiceNote requires a positive durationSec');
  if (dur > MAX_VOICE_SECONDS) throw new Error(`createVoiceNote: max ${MAX_VOICE_SECONDS}s exceeded`);
  return {
    id: `vn-${Date.now().toString(36)}-${(drawSeq += 1)}`,
    noteId: noteId || null,
    author: author || 'analyst',
    durationSec: Math.round(dur),
    storageRef: storageRef || null,
    at: new Date().toISOString(),
  };
}

/** Human-friendly duration, e.g. 75 → "1:15". */
export function voiceNoteLabel(durationSec) {
  const s = Math.max(0, Math.round(Number(durationSec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* 54335 — AI note summarization (deterministic extractive summary)    */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set(
  'a,an,the,and,or,but,if,then,else,for,of,to,in,on,at,by,with,from,as,is,are,was,were,be,been,it,its,this,that,these,those,we,you,they,he,she,not,no,do,does,did,have,has,had,will,would,can,could,should,may,might,our,your,their,my,his,her,all,any,each,more,most,other,some,such,only,own,same,so,than,too,very,just'.split(',')
);

function sentenceScores(text) {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const freq = {};
  for (const w of String(text || '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (w && !STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return sentences.map((s, i) => {
    const words = s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOPWORDS.has(w));
    const score = words.reduce((sum, w) => sum + (freq[w] || 0), 0) / Math.max(1, words.length);
    return { sentence: s, score, index: i };
  });
}

/**
 * Generates a deterministic extractive brief from a note history.
 * Picks the highest-scoring sentences across all bodies, keeps source order.
 */
export function summarizeNotes(notes, { maxSentences = 3 } = {}) {
  const bodies = (notes || []).map((n) => n.body || '').filter(Boolean);
  if (!bodies.length) return { summary: '', sentenceCount: 0, noteCount: 0 };
  const all = sentenceScores(bodies.join('\n'));
  const picked = [...all].sort((a, b) => b.score - a.score).slice(0, Math.max(1, maxSentences));
  picked.sort((a, b) => a.index - b.index);
  return {
    summary: picked.map((p) => p.sentence).join(' '),
    sentenceCount: picked.length,
    noteCount: bodies.length,
  };
}

/* ------------------------------------------------------------------ */
/* 54336 — Note duplication                                            */
/* ------------------------------------------------------------------ */

/** Copies a note's structure to another target. History records the clone source. */
export function duplicateNote(note, { targetId, author }) {
  if (!targetId) throw new Error('duplicateNote requires targetId');
  const now = new Date().toISOString();
  return {
    ...JSON.parse(JSON.stringify(note)),
    id: `note-${Date.now().toString(36)}-${(drawSeq += 1)}`,
    targetId,
    author: author || note.author,
    status: 'active',
    reminderAt: null,
    reminderDismissed: false,
    trashedAt: null,
    createdAt: now,
    updatedAt: now,
    history: [...(note.history || []), { at: now, by: author || note.author, event: 'duplicated-from', sourceId: note.id }],
  };
}

/* ------------------------------------------------------------------ */
/* 54337 — Note move between targets                                   */
/* ------------------------------------------------------------------ */

/** Relocates a note to another target, preserving its history. */
export function moveNote(note, newTargetId) {
  if (!newTargetId) throw new Error('moveNote requires newTargetId');
  const from = note.targetId;
  note.targetId = newTargetId;
  note.updatedAt = new Date().toISOString();
  note.history.push({ at: note.updatedAt, by: note.author, event: 'moved', from, to: newTargetId });
  return note;
}

/* ------------------------------------------------------------------ */
/* 54338 — Bulk note export                                            */
/* ------------------------------------------------------------------ */

/**
 * Exports notes across a group/client selection.
 * format: 'md' → concatenated Markdown; 'json' → JSON array.
 */
export function bulkExportNotes(notes, { targetIds, format = 'md' } = {}) {
  const selected = (notes || []).filter(
    (n) => n.status !== 'trashed' && (!targetIds || targetIds.includes(n.targetId))
  );
  if (format === 'json') {
    return { format: 'json', filename: 'dark-matter-notes-bulk.json', count: selected.length, data: JSON.stringify(selected, null, 2) };
  }
  const md = selected
    .map((n) => `## ${n.title} (${n.targetId})\n\n${n.body}`)
    .join('\n\n---\n\n');
  return { format: 'md', filename: 'dark-matter-notes-bulk.md', count: selected.length, data: `# Bulk notes export — Infinity AI\n\n${md}` };
}

/* ------------------------------------------------------------------ */
/* 54339 — Note print view                                             */
/* ------------------------------------------------------------------ */

/** Renders a clean printable briefing (plain text) from selected notes. */
export function printableBriefing(notes, { title = 'Notes briefing', author = 'Infinity AI' } = {}) {
  const selected = (notes || []).filter((n) => n.status !== 'trashed');
  const lines = [
    title,
    `Prepared by ${author} · ${new Date().toISOString().slice(0, 10)}`,
    '='.repeat(Math.max(title.length, 20)),
    '',
  ];
  for (const n of selected) {
    lines.push(n.title, '-'.repeat(Math.min(n.title.length, 40)), n.body || '(empty)', '');
  }
  return { title, noteCount: selected.length, text: lines.join('\n') };
}

/* ------------------------------------------------------------------ */
/* 54340 — Note keyboard shortcut                                      */
/* ------------------------------------------------------------------ */

export const DEFAULT_NOTE_SHORTCUT = 'ctrl+shift+n';

/** Parses "ctrl+shift+n" into { ctrl, shift, alt, key }. */
export function parseShortcut(str) {
  const parts = String(str || '').toLowerCase().split('+').map((p) => p.trim()).filter(Boolean);
  const mods = { ctrl: false, shift: false, alt: false };
  let key = null;
  for (const p of parts) {
    if (p === 'ctrl' || p === 'control') mods.ctrl = true;
    else if (p === 'shift') mods.shift = true;
    else if (p === 'alt' || p === 'option') mods.alt = true;
    else if (!key) key = p;
    else throw new Error(`parseShortcut: ambiguous key in "${str}"`);
  }
  if (!key) throw new Error(`parseShortcut: no key in "${str}"`);
  return { ...mods, key };
}

/** Normalizes a shortcut back to canonical "ctrl+shift+n" form. */
export function shortcutLabel({ ctrl, shift, alt, key }) {
  return [ctrl && 'ctrl', shift && 'shift', alt && 'alt', key].filter(Boolean).join('+');
}

/** True when the shortcut collides with common browser/system bindings. */
export function isReservedShortcut(str) {
  const reserved = new Set(['ctrl+t', 'ctrl+w', 'ctrl+n', 'ctrl+s', 'ctrl+p', 'ctrl+f', 'ctrl+r', 'ctrl+l', 'ctrl+q']);
  try {
    return reserved.has(shortcutLabel(parseShortcut(str)));
  } catch {
    return false;
  }
}
