/**
 * Wave 108D — Notes & collaboration workspace (ideas 54311-54320).
 *
 * Pure JS core logic for hunt notes in Dark Matter / Hunt AI:
 * file attachments with access controls, code snippet blocks, checklists,
 * @mentions, comment threads, version history with diffs, full-text search,
 * tags, private/shared visibility, and authorship display.
 *
 * No JSX, no side effects — every export is deterministic and testable with
 * plain objects. Branding: Infinity AI / Dark Matter / Obfinity.
 */

export const WAVE108_D_IDEAS = [
  { id: 54311, title: 'File attachments' },
  { id: 54312, title: 'Code snippet blocks' },
  { id: 54313, title: 'Checklists inside notes' },
  { id: 54314, title: '@mentions in notes' },
  { id: 54315, title: 'Note comment threads' },
  { id: 54316, title: 'Note version history' },
  { id: 54317, title: 'Full-text note search' },
  { id: 54318, title: 'Note tags' },
  { id: 54319, title: 'Private vs shared notes' },
  { id: 54320, title: 'Note authorship display' },
];

/**
 * Creates a blank note record. All collections start empty; visibility
 * defaults to shared with no role restriction.
 */
export function createNote({ id, title = '', body = '', authorId, authorName = '', now = new Date().toISOString() }) {
  if (!id || typeof id !== 'string') throw new Error('id is required');
  if (!authorId || typeof authorId !== 'string') throw new Error('authorId is required');
  return {
    id,
    title,
    body,
    authorId,
    authorName,
    createdAt: now,
    updatedAt: now,
    lastEditedBy: authorName || null,
    attachments: [],
    snippets: [],
    checklist: [],
    comments: [],
    revisions: [],
    tags: [],
    visibility: { mode: 'shared', roles: [] },
  };
}

/* ------------------------------------------------------------------ */
/* 54311 — File attachments                                             */
/* ------------------------------------------------------------------ */

export const ATTACHMENT_ALLOWLIST = ['pdf', 'txt', 'md', 'conf', 'ovpn', 'png', 'jpg', 'jpeg', 'log'];
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB
export const ATTACHMENT_ACCESS_LEVELS = ['anyone', 'roles'];

function extensionOf(name) {
  const base = String(name || '').split('/').pop().split('\\').pop();
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase();
}

function normalizeAccess(access) {
  if (typeof access === 'string') access = { level: access, roles: [] };
  const level = (access && access.level) || 'anyone';
  if (!ATTACHMENT_ACCESS_LEVELS.includes(level)) throw new Error(`unknown access level: ${level}`);
  return { level, roles: Array.isArray(access.roles) ? [...access.roles] : [] };
}

/**
 * Attaches a file to a note after validating extension and size.
 * @returns {{note: object, attachment: object}}
 */
export function attachFile(note, { name, mime = '', size = 0, access = { level: 'anyone', roles: [] } } = {}) {
  if (!note || typeof note !== 'object') throw new Error('note is required');
  if (!name || typeof name !== 'string') throw new Error('attachment name is required');
  const ext = extensionOf(name);
  if (!ATTACHMENT_ALLOWLIST.includes(ext)) {
    throw new Error(`file type not allowed: .${ext || '(none)'} — allowed: ${ATTACHMENT_ALLOWLIST.join(', ')}`);
  }
  const bytes = Number(size) || 0;
  if (bytes > MAX_ATTACHMENT_BYTES) {
    throw new Error(`file too large: ${bytes} bytes exceeds the ${MAX_ATTACHMENT_BYTES} byte limit`);
  }
  const attachment = {
    id: `attachment:${note.id || 'note'}:${(note.attachments || []).length + 1}`,
    name,
    ext,
    mime,
    size: bytes,
    access: normalizeAccess(access),
    attachedAt: new Date().toISOString(),
  };
  return {
    attachment,
    note: { ...note, attachments: [...(note.attachments || []), attachment], updatedAt: new Date().toISOString() },
  };
}

/**
 * Checks whether a user may open an attachment, honoring its access control.
 * user shape: { id, roles: [] }. Returns false for anonymous users on
 * role-restricted attachments.
 */
export function canAccess(attachment, user) {
  const access = (attachment && attachment.access) || { level: 'anyone', roles: [] };
  if (access.level === 'anyone') return true;
  if (access.level === 'roles') {
    if (!user || !Array.isArray(user.roles)) return false;
    return access.roles.some((role) => user.roles.includes(role));
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* 54312 — Code snippet blocks                                          */
/* ------------------------------------------------------------------ */

export const SUPPORTED_LANGUAGES = [
  'bash', 'sh', 'curl', 'http', 'json', 'yaml', 'yml',
  'python', 'javascript', 'sql', 'text', 'xml', 'html',
];

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Creates a syntax snippet block with safely escaped HTML for display.
 */
export function createSnippet(language, code) {
  if (typeof code !== 'string' || code.length === 0) throw new Error('code is required');
  const lang = String(language || 'text').toLowerCase();
  if (!SUPPORTED_LANGUAGES.includes(lang)) throw new Error(`unsupported language: ${language}`);
  return {
    id: `snippet:${lang}:${code.length}`,
    language: lang,
    code,
    escapedHtml: escapeHtml(code),
    createdAt: new Date().toISOString(),
  };
}

const SNIPPET_KEYWORDS = {
  bash: ['curl', 'wget', 'nmap', 'sqlmap', 'gobuster', 'ffuf', 'echo', 'export', 'sudo', 'if', 'then', 'else', 'fi', 'for', 'while', 'do', 'done', 'in', 'function', 'return', 'exit', 'set', 'cat', 'grep', 'awk', 'sed', 'chmod', 'ssh', 'scp', 'python3'],
  sh: ['curl', 'wget', 'echo', 'export', 'if', 'then', 'else', 'fi', 'for', 'while', 'do', 'done'],
  curl: ['curl', 'get', 'post', 'put', 'delete', 'patch', 'head'],
  sql: ['select', 'from', 'where', 'union', 'insert', 'update', 'delete', 'join', 'on', 'and', 'or', 'not', 'like', 'order', 'by', 'group', 'having', 'limit', 'as', 'table', 'database'],
  python: ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'with', 'as', 'try', 'except', 'finally', 'raise', 'lambda', 'none', 'true', 'false', 'pass', 'yield', 'async', 'await', 'print'],
  javascript: ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'import', 'from', 'export', 'new', 'await', 'async', 'true', 'false', 'null', 'typeof'],
  http: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'http', 'https', 'host', 'authorization', 'content-type'],
};

/**
 * Tokenizes snippet source into [{ text, kind }] for syntax highlighting.
 * Kinds: 'plain' | 'comment' | 'string' | 'flag' | 'keyword'.
 * Deterministic, dependency-free, safe on escaped or raw source.
 */
export function tokenizeSnippet(code, language = 'text') {
  const text = String(code ?? '');
  const keywords = SNIPPET_KEYWORDS[String(language || 'text').toLowerCase()] || [];
  const tokens = [];
  let buf = '';
  const flush = () => { if (buf) { tokens.push({ text: buf, kind: 'plain' }); buf = ''; } };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1] || '';
    // comments: #..., //..., or SQL-style "-- " (dash-dash followed by space)
    const isLineComment = ch === '#' || (ch === '/' && next === '/') ||
      (ch === '-' && next === '-' && /[\s]/.test(text[i + 2] || ' '));
    if (isLineComment) {
      flush();
      let j = i;
      while (j < text.length && text[j] !== '\n') j += 1;
      tokens.push({ text: text.slice(i, j), kind: 'comment' });
      i = j;
      continue;
    }
    // strings: '...', "...", `...` with backslash escapes
    if (ch === '"' || ch === "'" || ch === '`') {
      flush();
      let j = i + 1;
      while (j < text.length && text[j] !== ch) {
        if (text[j] === '\\') j += 1;
        j += 1;
      }
      j = Math.min(j + 1, text.length);
      tokens.push({ text: text.slice(i, j), kind: 'string' });
      i = j;
      continue;
    }
    // flags: -x or --long-flag
    if (ch === '-' && /[A-Za-z]/.test(next)) {
      flush();
      let j = i + 1;
      if (text[j] === '-') j += 1;
      while (j < text.length && /[A-Za-z0-9-]/.test(text[j])) j += 1;
      tokens.push({ text: text.slice(i, j), kind: 'flag' });
      i = j;
      continue;
    }
    // words: keyword lookup, otherwise plain text
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < text.length && /[\w]/.test(text[j])) j += 1;
      const word = text.slice(i, j);
      if (keywords.includes(word) || keywords.includes(word.toLowerCase())) {
        flush();
        tokens.push({ text: word, kind: 'keyword' });
      } else {
        buf += word;
      }
      i = j;
      continue;
    }
    buf += ch;
    i += 1;
  }
  flush();
  return tokens;
}

/* ------------------------------------------------------------------ */
/* 54313 — Checklists inside notes                                      */
/* ------------------------------------------------------------------ */

/**
 * Builds a checklist from text lines; blank lines are skipped.
 */
export function checklistFromLines(lines) {
  const arr = Array.isArray(lines) ? lines : String(lines ?? '').split('\n');
  return arr
    .map((line) => String(line).trim())
    .filter(Boolean)
    .map((text, idx) => ({ id: `item:${idx + 1}`, text, done: false }));
}

/**
 * Toggles a checklist item's done state. Returns a new list; throws when
 * the id is unknown.
 */
export function toggleChecklistItem(list, id) {
  let found = false;
  const next = (list || []).map((item) => {
    if (item.id !== id) return item;
    found = true;
    return { ...item, done: !item.done };
  });
  if (!found) throw new Error(`checklist item not found: ${id}`);
  return next;
}

/**
 * Completion percentage of a checklist, 0-100 (rounded). Empty list → 0.
 */
export function checklistProgress(list) {
  const items = list || [];
  if (items.length === 0) return 0;
  const done = items.filter((item) => item.done).length;
  return Math.round((done / items.length) * 100);
}

/* ------------------------------------------------------------------ */
/* 54314 — @mentions in notes                                           */
/* ------------------------------------------------------------------ */

const MENTION_RE = /@[A-Za-z0-9][A-Za-z0-9._-]*/g;

/**
 * Extracts unique @handles from text, in order of first appearance.
 * Trailing punctuation dots are stripped so "@ana." matches "@ana".
 */
export function parseMentions(text) {
  const seen = new Set();
  const handles = [];
  for (const match of String(text ?? '').matchAll(MENTION_RE)) {
    const handle = match[0].replace(/[.]+$/, '');
    if (!seen.has(handle)) {
      seen.add(handle);
      handles.push(handle);
    }
  }
  return handles;
}

function mentionExcerpt(body, handles) {
  const lower = String(body).toLowerCase();
  let idx = -1;
  let found = '';
  for (const handle of handles) {
    const at = lower.indexOf(handle.toLowerCase());
    if (at !== -1 && (idx === -1 || at < idx)) {
      idx = at;
      found = handle;
    }
  }
  if (idx === -1) return String(body).slice(0, 120);
  const start = Math.max(0, idx - 40);
  const end = Math.min(String(body).length, idx + found.length + 80);
  return `${start > 0 ? '…' : ''}${String(body).slice(start, end)}${end < String(body).length ? '…' : ''}`;
}

/**
 * Builds inbox notifications for every user whose @handle is mentioned in
 * the note title, body, or comments. users: [{ id, handle }].
 */
export function buildMentionNotifications(note, users) {
  const haystack = [
    note.title || '',
    note.body || '',
    ...((note.comments || []).map((c) => c.body || '')),
  ].join('\n');
  const handles = parseMentions(haystack);
  return (users || [])
    .filter((user) => handles.includes(`@${user.handle}`))
    .map((user) => ({
      userId: user.id,
      handle: user.handle,
      noteId: note.id,
      message: `You were mentioned in note "${note.title || note.id}"`,
      excerpt: mentionExcerpt(note.body || '', handles),
      createdAt: new Date().toISOString(),
    }));
}

/* ------------------------------------------------------------------ */
/* 54315 — Note comment threads                                         */
/* ------------------------------------------------------------------ */

/**
 * Appends a comment to a note's inline thread. Returns the updated note.
 */
export function addComment(note, { author, body, parentId = null } = {}) {
  if (!author || typeof author !== 'string') throw new Error('author is required');
  if (!body || typeof body !== 'string') throw new Error('body is required');
  const comments = note.comments || [];
  if (parentId && !comments.some((c) => c.id === parentId)) {
    throw new Error(`parent comment not found: ${parentId}`);
  }
  const comment = {
    id: `comment:${note.id || 'note'}:${comments.length + 1}`,
    author,
    body,
    parentId,
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
  };
  return {
    ...note,
    comments: [...comments, comment],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Marks a comment thread resolved, recording who resolved it and when.
 */
export function resolveComment(note, commentId, resolver) {
  let found = false;
  const comments = (note.comments || []).map((comment) => {
    if (comment.id !== commentId) return comment;
    found = true;
    return {
      ...comment,
      resolved: true,
      resolvedBy: resolver || comment.resolvedBy || null,
      resolvedAt: new Date().toISOString(),
    };
  });
  if (!found) throw new Error(`comment not found: ${commentId}`);
  return { ...note, comments };
}

/* ------------------------------------------------------------------ */
/* 54316 — Note version history                                         */
/* ------------------------------------------------------------------ */

/**
 * Saves the current body as a revision snapshot, then applies newBody.
 * Returns the updated note.
 */
export function saveRevision(note, newBody, author) {
  if (typeof newBody !== 'string') throw new Error('newBody must be a string');
  if (!author || typeof author !== 'string') throw new Error('author is required');
  const revisions = note.revisions || [];
  const snapshot = {
    id: `rev:${note.id || 'note'}:${revisions.length + 1}`,
    body: note.body ?? '',
    author: note.lastEditedBy || note.authorName || author,
    createdAt: note.updatedAt || note.createdAt || new Date().toISOString(),
  };
  return {
    ...note,
    body: newBody,
    revisions: [...revisions, snapshot],
    lastEditedBy: author,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Restores a note body from a revision. The pre-restore body is archived
 * as a fresh revision first, so restores are themselves reversible.
 * @returns {{note: object, restored: object}} updated note + restored revision
 */
export function restoreRevision(note, revId, actor) {
  const target = (note.revisions || []).find((rev) => rev.id === revId);
  if (!target) throw new Error(`revision not found: ${revId}`);
  const restored = saveRevision(note, target.body, actor || 'system');
  return { note: { ...restored, restoredFrom: revId }, restored: target };
}

/**
 * Line-based diff between two note bodies (LCS alignment).
 * @returns {{added: string[], removed: string[], segments: Array<{type:'same'|'add'|'del', line:string}>, addedCount:number, removedCount:number}}
 */
export function revisionDiff(oldBody, newBody) {
  const a = String(oldBody ?? '').split('\n');
  const b = String(newBody ?? '').split('\n');
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segments = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      segments.push({ type: 'same', line: a[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      segments.push({ type: 'del', line: a[i] });
      i += 1;
    } else {
      segments.push({ type: 'add', line: b[j] });
      j += 1;
    }
  }
  while (i < m) { segments.push({ type: 'del', line: a[i] }); i += 1; }
  while (j < n) { segments.push({ type: 'add', line: b[j] }); j += 1; }
  const added = segments.filter((s) => s.type === 'add').map((s) => s.line);
  const removed = segments.filter((s) => s.type === 'del').map((s) => s.line);
  return { added, removed, segments, addedCount: added.length, removedCount: removed.length };
}

/* ------------------------------------------------------------------ */
/* 54317 — Full-text note search                                        */
/* ------------------------------------------------------------------ */

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSnippet(text, query, context) {
  const lower = String(text).toLowerCase();
  const needle = String(query).toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx === -1) return String(text).slice(0, context * 2);
  const start = Math.max(0, idx - context);
  const end = Math.min(String(text).length, idx + query.length + context);
  const window = String(text).slice(start, end);
  const highlighted = window.replace(
    new RegExp(escapeRegExp(query), 'gi'),
    (match) => `<<${match}>>`
  );
  return `${start > 0 ? '…' : ''}${highlighted}${end < String(text).length ? '…' : ''}`;
}

/**
 * Full-text search across notes. Matches title (weight 3), body and tags.
 * @returns {Array<{note, score, field, snippet}>} ranked hits with <<highlighted>> snippets
 */
export function searchNotes(notes, query, { fields = ['title', 'body', 'tags'], context = 40, maxResults = 25 } = {}) {
  const q = String(query ?? '').trim();
  if (!q) return [];
  const needle = q.toLowerCase();
  const hits = [];
  for (const note of notes || []) {
    let score = 0;
    let matchField = null;
    let matchText = '';
    for (const field of fields) {
      const raw = field === 'tags' ? (note.tags || []).join(' ') : String(note[field] ?? '');
      if (raw.toLowerCase().includes(needle)) {
        score += field === 'title' ? 3 : 1;
        if (matchField === null) {
          matchField = field;
          matchText = raw;
        }
      }
    }
    if (score === 0) continue;
    hits.push({
      note,
      score,
      field: matchField,
      snippet: buildSnippet(matchText, q, context),
    });
  }
  hits.sort((x, y) => y.score - x.score);
  return hits.slice(0, maxResults);
}

/* ------------------------------------------------------------------ */
/* 54318 — Note tags                                                    */
/* ------------------------------------------------------------------ */

export const SUGGESTED_TAGS = ['credential', 'scope', 'access', 'contact'];

export function normalizeTag(tag) {
  return String(tag ?? '').trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Adds a tag to a note (normalized, de-duplicated). Returns the updated note.
 */
export function tagNote(note, tag) {
  const normalized = normalizeTag(tag);
  if (!normalized) throw new Error('tag is required');
  const tags = note.tags || [];
  return { ...note, tags: tags.includes(normalized) ? tags : [...tags, normalized] };
}

export function untagNote(note, tag) {
  const normalized = normalizeTag(tag);
  return { ...note, tags: (note.tags || []).filter((t) => t !== normalized) };
}

/**
 * Returns notes carrying the given tag (case-insensitive).
 */
export function filterNotesByTag(notes, tag) {
  const normalized = normalizeTag(tag);
  return (notes || []).filter((note) => (note.tags || []).includes(normalized));
}

/* ------------------------------------------------------------------ */
/* 54319 — Private vs shared notes                                      */
/* ------------------------------------------------------------------ */

export const VISIBILITY_MODES = ['private', 'shared'];

/**
 * Sets a note's visibility. 'private' = author only. 'shared' = anyone, or
 * only users holding one of the given roles when roles are provided.
 */
export function setVisibility(note, mode, roles = []) {
  if (!VISIBILITY_MODES.includes(mode)) throw new Error(`invalid visibility: ${mode}`);
  return {
    ...note,
    visibility: { mode, roles: Array.isArray(roles) ? [...roles] : [] },
  };
}

/**
 * Checks whether a user may view a note under its visibility rules.
 * user shape: { id, roles: [] }.
 */
export function canView(note, user) {
  const visibility = note.visibility || { mode: 'shared', roles: [] };
  if (visibility.mode === 'private') {
    return Boolean(user) && user.id === note.authorId;
  }
  if (visibility.mode === 'shared') {
    if (!visibility.roles || visibility.roles.length === 0) return Boolean(user);
    if (!user || !Array.isArray(user.roles)) return false;
    return visibility.roles.some((role) => user.roles.includes(role));
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* 54320 — Note authorship display                                      */
/* ------------------------------------------------------------------ */

/**
 * Human-friendly relative timestamp: "just now", "5m ago", "2h ago",
 * "3d ago", "2w ago", or an ISO date for older stamps.
 * Pass `now` for deterministic output in tests.
 */
export function relativeTime(ts, now = new Date()) {
  const then = new Date(ts).getTime();
  const base = new Date(now).getTime();
  const seconds = Math.max(0, Math.floor((base - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(then).toISOString().slice(0, 10);
}

/**
 * One-line authorship summary, e.g. "Written by Ana · edited by Raj 2h ago".
 */
export function authorshipLine(note, now = new Date()) {
  const author = note.authorName || note.authorId || 'unknown';
  const edited = Boolean(note.lastEditedBy) &&
    note.updatedAt && note.createdAt && note.updatedAt !== note.createdAt;
  if (edited) {
    return `Written by ${author} · edited by ${note.lastEditedBy} ${relativeTime(note.updatedAt, now)}`;
  }
  return `Written by ${author} · ${relativeTime(note.createdAt, now)}`;
}
