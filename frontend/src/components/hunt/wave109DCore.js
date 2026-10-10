/**
 * Wave 109D — Target organization (ideas 54351-54360).
 *
 * Pure JS core logic for the Dark Matter / Hunt AI inventory organization:
 * URL-anchored notes, severity flags, cross-target note search,
 * note completeness suggestions, client/program folders, custom groups,
 * nested hierarchies and smart groups (query + tag driven).
 *
 * All exports are deterministic pure functions on plain objects.
 * Branding: Infinity AI / Dark Matter / Obfinity.
 */

export const WAVE109_D_IDEAS = [
  { id: 54351, title: 'Note anchoring to URLs', summary: 'Ties a note to a specific URL or endpoint within the target.' },
  { id: 54352, title: 'Note severity flags', summary: 'Marks notes as info, warning, or blocker for triage visibility.' },
  { id: 54353, title: 'Cross-target note search', summary: 'Finds every note mentioning a keyword across the whole inventory.' },
  { id: 54354, title: 'Note completeness suggestions', summary: 'Suggests missing note types per target (credentials? contacts? caveats?).' },
  { id: 54355, title: 'Client folders', summary: 'Organizes targets under client records with client-level dashboards and rollups.' },
  { id: 54356, title: 'Program folders', summary: 'Groups targets by bounty program with program rules inherited downward.' },
  { id: 54357, title: 'Custom groups', summary: 'Creates free-form groups like "Q4 focus" or "APAC retail" with drag-drop membership.' },
  { id: 54358, title: 'Nested group hierarchy', summary: 'Nests groups (Client → Program → Environment) with breadcrumb navigation.' },
  { id: 54359, title: 'Smart groups by query', summary: 'Auto-populates groups from saved search queries that re-evaluate on change.' },
  { id: 54360, title: 'Smart groups by tag', summary: 'Keeps groups in sync automatically as tags are added or removed.' },
];

const SEVERITIES = ['info', 'warning', 'blocker'];
const SEVERITY_RANK = { info: 0, warning: 1, blocker: 2 };
const EXPECTED_NOTE_TYPES = ['credentials', 'contacts', 'scope-caveats', 'access-notes', 'handoff'];
let orgSeq = 0;

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${(orgSeq += 1)}`;
}

/* ------------------------------------------------------------------ */
/* 54351 — Note anchoring to URLs                                      */
/* ------------------------------------------------------------------ */

/** Normalizes a URL for anchoring (lowercases host, strips trailing slash, drops fragment). */
export function normalizeUrl(url) {
  try {
    const u = new URL(String(url || '').trim());
    u.hash = '';
    let s = `${u.protocol}//${u.host}${u.pathname}${u.search}`;
    if (s.endsWith('/') && u.pathname === '/') s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return String(url || '').trim().toLowerCase().replace(/#.*$/, '');
  }
}

/** Anchors a note to a URL/endpoint. Multiple anchors allowed. */
export function anchorNote(note, url) {
  const norm = normalizeUrl(url);
  if (!norm) throw new Error('anchorNote requires a non-empty URL');
  if (!note.urlAnchors) note.urlAnchors = [];
  if (!note.urlAnchors.includes(norm)) note.urlAnchors.push(norm);
  note.updatedAt = new Date().toISOString();
  return note;
}

/** Removes a URL anchor. Returns true when removed. */
export function unanchorNote(note, url) {
  const norm = normalizeUrl(url);
  const anchors = note.urlAnchors || [];
  const idx = anchors.indexOf(norm);
  if (idx === -1) return false;
  anchors.splice(idx, 1);
  return true;
}

/** Returns notes anchored to the given URL (after normalization). */
export function notesForUrl(notes, url) {
  const norm = normalizeUrl(url);
  return (notes || []).filter((n) => (n.urlAnchors || []).includes(norm));
}

/* ------------------------------------------------------------------ */
/* 54352 — Note severity flags                                         */
/* ------------------------------------------------------------------ */

/** Sets a note's severity flag. */
export function setSeverity(note, severity) {
  if (!SEVERITIES.includes(severity)) {
    throw new Error(`setSeverity: severity must be one of ${SEVERITIES.join(', ')}`);
  }
  note.severity = severity;
  note.updatedAt = new Date().toISOString();
  return note;
}

/** Sorts notes blockers first, then warnings, then info (stable). */
export function sortBySeverity(notes) {
  return [...(notes || [])].sort((a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0));
}

/** Counts notes per severity. */
export function severityCounts(notes) {
  const counts = { info: 0, warning: 0, blocker: 0 };
  for (const n of notes || []) {
    const s = SEVERITIES.includes(n.severity) ? n.severity : 'info';
    counts[s] += 1;
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/* 54353 — Cross-target note search                                    */
/* ------------------------------------------------------------------ */

/** Builds a ~80-char snippet around the first match. */
export function snippet(text, query, radius = 40) {
  const t = String(text || '');
  const q = String(query || '').toLowerCase();
  const idx = t.toLowerCase().indexOf(q);
  if (idx === -1 || !q) return t.slice(0, 80);
  const start = Math.max(0, idx - radius);
  const end = Math.min(t.length, idx + q.length + radius);
  return (start > 0 ? '…' : '') + t.slice(start, end) + (end < t.length ? '…' : '');
}

/**
 * Searches every note across targets for a keyword.
 * Returns [{ targetId, noteId, title, snippet }] ordered by targetId then note id.
 */
export function searchAllNotes(notes, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  return (notes || [])
    .filter((n) => n.status !== 'trashed' && ((n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q)))
    .map((n) => ({ targetId: n.targetId, noteId: n.id, title: n.title, snippet: snippet(n.body, q) }))
    .sort((a, b) => String(a.targetId).localeCompare(String(b.targetId)) || String(a.noteId).localeCompare(String(b.noteId)));
}

/* ------------------------------------------------------------------ */
/* 54354 — Note completeness suggestions                               */
/* ------------------------------------------------------------------ */

/** Note types present on a target (from note tags). */
export function presentNoteTypes(notes, targetId) {
  const types = new Set();
  for (const n of notes || []) {
    if (n.targetId !== targetId || n.status === 'trashed') continue;
    for (const t of n.tags || []) {
      if (EXPECTED_NOTE_TYPES.includes(t)) types.add(t);
    }
  }
  return [...types];
}

/** Suggests missing note types per target. */
export function suggestNoteTypes(notes, targetId) {
  const present = new Set(presentNoteTypes(notes, targetId));
  return EXPECTED_NOTE_TYPES.filter((t) => !present.has(t)).map((type) => ({
    type,
    hint: {
      credentials: 'Store access credentials or rotation notes.',
      contacts: 'Add a security contact for this target.',
      'scope-caveats': 'Record any scope limitations or exclusions.',
      'access-notes': 'Document how testers get access (VPN, accounts).',
      handoff: 'Write a handoff summary for the next analyst.',
    }[type],
  }));
}

/** Completeness score 0-100 for a target's note coverage. */
export function completenessScore(notes, targetId) {
  const present = presentNoteTypes(notes, targetId).length;
  return Math.round((present / EXPECTED_NOTE_TYPES.length) * 100);
}

/* ------------------------------------------------------------------ */
/* 54355 — Client folders                                              */
/* ------------------------------------------------------------------ */

/** Creates a client folder record. */
export function createClientFolder({ name, owner = 'analyst' }) {
  if (!name || !String(name).trim()) throw new Error('createClientFolder requires a name');
  return { id: uid('client'), name: String(name).trim(), owner, targetIds: [], createdAt: new Date().toISOString() };
}

/** Assigns a target to a client folder (idempotent). */
export function assignTargetToClient(folder, targetId) {
  if (!targetId) throw new Error('assignTargetToClient requires targetId');
  if (!folder.targetIds.includes(targetId)) folder.targetIds.push(targetId);
  return folder;
}

/** Removes a target from a client folder. Returns true when removed. */
export function removeTargetFromClient(folder, targetId) {
  const idx = folder.targetIds.indexOf(targetId);
  if (idx === -1) return false;
  folder.targetIds.splice(idx, 1);
  return true;
}

/** Client-level dashboard rollup: target count + note/finding totals. */
export function clientDashboard(folder, targets, notes) {
  const member = new Set(folder.targetIds);
  const folderTargets = (targets || []).filter((t) => member.has(t.id));
  const folderNotes = (notes || []).filter((n) => member.has(n.targetId) && n.status !== 'trashed');
  return {
    clientId: folder.id,
    clientName: folder.name,
    targetCount: folderTargets.length,
    noteCount: folderNotes.length,
    findingCount: folderTargets.reduce((sum, t) => sum + (Number(t.findings) || 0), 0),
  };
}

/* ------------------------------------------------------------------ */
/* 54356 — Program folders                                             */
/* ------------------------------------------------------------------ */

/** Creates a program folder with inherited rules. rules: [{ key, value, source }]. */
export function createProgramFolder({ name, rules = [] }) {
  if (!name || !String(name).trim()) throw new Error('createProgramFolder requires a name');
  return { id: uid('program'), name: String(name).trim(), rules: rules.map((r) => ({ ...r })), targetIds: [], createdAt: new Date().toISOString() };
}

/** Assigns a target to a program (idempotent). */
export function assignTargetToProgram(program, targetId) {
  if (!program.targetIds.includes(targetId)) program.targetIds.push(targetId);
  return program;
}

/**
 * Computes effective rules for a target: program rules inherited downward,
 * target-local rules override by key.
 */
export function effectiveRules(program, targetRules = []) {
  const merged = new Map();
  for (const r of program.rules || []) merged.set(r.key, { ...r, inherited: true });
  for (const r of targetRules) merged.set(r.key, { ...r, inherited: false });
  return [...merged.values()];
}

/* ------------------------------------------------------------------ */
/* 54357 — Custom groups                                               */
/* ------------------------------------------------------------------ */

/** Creates a free-form group. */
export function createGroup({ name, color = '#6d5cff' }) {
  if (!name || !String(name).trim()) throw new Error('createGroup requires a name');
  return { id: uid('group'), name: String(name).trim(), color, memberIds: [], createdAt: new Date().toISOString() };
}

/** Adds a target to a group (idempotent). */
export function addToGroup(group, targetId) {
  if (!group.memberIds.includes(targetId)) group.memberIds.push(targetId);
  return group;
}

/** Removes a target from a group. Returns true when removed. */
export function removeFromGroup(group, targetId) {
  const idx = group.memberIds.indexOf(targetId);
  if (idx === -1) return false;
  group.memberIds.splice(idx, 1);
  return true;
}

/** Drag-drop reorder: moves a member to a new index. */
export function reorderGroup(group, targetId, toIndex) {
  const from = group.memberIds.indexOf(targetId);
  if (from === -1) throw new Error('reorderGroup: member not in group');
  const idx = Math.max(0, Math.min(toIndex, group.memberIds.length - 1));
  const [moved] = group.memberIds.splice(from, 1);
  group.memberIds.splice(idx, 0, moved);
  return group;
}

/* ------------------------------------------------------------------ */
/* 54358 — Nested group hierarchy                                      */
/* ------------------------------------------------------------------ */

/** Creates a hierarchy node: type ∈ client|program|environment|group. */
export function createNode({ name, type = 'group', parentId = null }) {
  if (!['client', 'program', 'environment', 'group'].includes(type)) throw new Error('createNode: invalid type');
  return { id: uid('node'), name: String(name || 'Untitled'), type, parentId, children: [] };
}

/** Attaches a child node to a parent (sets parentId). */
export function addChild(parent, child) {
  child.parentId = parent.id;
  parent.children.push(child);
  return child;
}

/**
 * Builds breadcrumb names from the root to the node.
 * nodesById: Map of id → node.
 */
export function breadcrumbs(nodeId, nodesById) {
  const trail = [];
  let cur = nodesById.get(nodeId);
  while (cur) {
    trail.unshift(cur.name);
    cur = cur.parentId ? nodesById.get(cur.parentId) : null;
  }
  return trail;
}

/** Flattens a hierarchy depth-first into [{ node, depth }]. */
export function flattenHierarchy(root) {
  const out = [];
  const walk = (node, depth) => {
    out.push({ node, depth });
    for (const c of node.children || []) walk(c, depth + 1);
  };
  walk(root, 0);
  return out;
}

/* ------------------------------------------------------------------ */
/* 54359 — Smart groups by query                                       */
/* ------------------------------------------------------------------ */

const QUERY_OPS = ['eq', 'neq', 'contains', 'gte', 'lte'];

/**
 * Creates a smart group with a deterministic predicate query:
 * query: { field, op: eq|neq|contains|gte|lte, value }.
 */
export function createSmartGroup({ name, query }) {
  if (!name || !String(name).trim()) throw new Error('createSmartGroup requires a name');
  if (!query || !QUERY_OPS.includes(query.op)) throw new Error('createSmartGroup: query.op must be one of ' + QUERY_OPS.join(', '));
  return { id: uid('smart'), name: String(name).trim(), kind: 'query', query: { ...query }, memberIds: [], updatedAt: null };
}

/** Evaluates one predicate against a target. */
export function matchesQuery(target, query) {
  const v = target[query.field];
  switch (query.op) {
    case 'eq': return v === query.value;
    case 'neq': return v !== query.value;
    case 'contains': return String(v || '').toLowerCase().includes(String(query.value).toLowerCase());
    case 'gte': return Number(v) >= Number(query.value);
    case 'lte': return Number(v) <= Number(query.value);
    default: return false;
  }
}

/** Re-evaluates membership; returns the updated group. */
export function evaluateSmartGroup(group, targets) {
  group.memberIds = (targets || []).filter((t) => matchesQuery(t, group.query)).map((t) => t.id);
  group.updatedAt = new Date().toISOString();
  return group;
}

/* ------------------------------------------------------------------ */
/* 54360 — Smart groups by tag                                         */
/* ------------------------------------------------------------------ */

/** Creates a tag-driven smart group. */
export function createTagGroup({ name, tag }) {
  if (!tag || !String(tag).trim()) throw new Error('createTagGroup requires a tag');
  return { id: uid('taggroup'), name: String(name || `Tagged: ${tag}`).trim(), kind: 'tag', tag: String(tag).trim(), memberIds: [], updatedAt: null };
}

/**
 * Re-syncs tag groups against target tags. targets: [{ id, tags: [] }].
 * Returns the updated groups.
 */
export function syncTagGroups(groups, targets) {
  for (const g of groups || []) {
    g.memberIds = (targets || []).filter((t) => (t.tags || []).includes(g.tag)).map((t) => t.id);
    g.updatedAt = new Date().toISOString();
  }
  return groups;
}
