// Dark Matter — Episode Ledger (Job 6, stage 1: REAL-HUMAN MEMORY REBUILD).
//
// Design authority: research report §5 item 1 (Generative Agents memory
// stream + OpenHands event-log-as-state), re-implemented in Node on SQLite —
// no off-the-shelf memory framework fits an 8B brain on this box, and every
// memory decision that can be made by code is made by code, never the model.
//
//   * APPEND-ONLY: every hunt event becomes exactly one episode row.
//     Nothing is ever rewritten or deleted (access counters aside).
//   * The per-hunt events.jsonl files remain the SOURCE OF TRUTH. This
//     ledger is an idempotent mirror keyed on (hunt_id, source_idx), where
//     source_idx is the event's line index in its events.jsonl — re-scanning
//     a hunt is always safe, and a torn line becomes a tombstone episode
//     instead of breaking index alignment.
//   * Importance is RULE-BASED: verified finding 10, finding 8, recall 6,
//     executed test 4, other events 3, thinking/briefing 2, status 1.
//   * If node:sqlite is unavailable (Node < 22.5) the ledger disables
//     itself: every export becomes a safe no-op and the JSONL pipeline is
//     completely unaffected.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { config } from './config.js';

const TITLE_CAP = 200;
const BODY_CAP = 4000;

let DatabaseSync = null;
let loadError = null;
try {
  ({ DatabaseSync } = createRequire(import.meta.url)('node:sqlite'));
} catch (err) {
  loadError = err;
}

export function episodeLedgerEnabled() {
  return !!DatabaseSync;
}

let db = null;
let ftsAvailable = false;

function getDb() {
  if (!DatabaseSync) return null;
  if (db) return db;
  try {
    const file = path.join(config.dataDir, 'episodes.db');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY,
        ts TEXT NOT NULL,
        hunt_id TEXT NOT NULL,
        source_idx INTEGER NOT NULL,
        iteration INTEGER,
        kind TEXT NOT NULL,
        actor TEXT,
        title TEXT,
        body TEXT,
        outcome TEXT,
        importance INTEGER NOT NULL DEFAULT 1,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed_at TEXT,
        UNIQUE(hunt_id, source_idx)
      );
      CREATE INDEX IF NOT EXISTS idx_episodes_hunt ON episodes(hunt_id, id);
      CREATE INDEX IF NOT EXISTS idx_episodes_kind ON episodes(kind, importance);
      CREATE TABLE IF NOT EXISTS mirror_state (
        hunt_id TEXT PRIMARY KEY,
        next_idx INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS episode_embeddings (
        episode_id INTEGER PRIMARY KEY,
        model TEXT NOT NULL,
        dims INTEGER NOT NULL,
        vec BLOB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ruled_out (
        id INTEGER PRIMARY KEY,
        ts TEXT NOT NULL,
        hunt_id TEXT NOT NULL,
        key TEXT NOT NULL,
        technique TEXT,
        lesson TEXT NOT NULL,
        reason TEXT,
        episode_id INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_ruled_out_hunt_key ON ruled_out(hunt_id, key);
    `);
    try {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts
          USING fts5(title, body, content='episodes', content_rowid='id');
        CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
          INSERT INTO episodes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
        END;
      `);
      ftsAvailable = true;
    } catch {
      ftsAvailable = false; // LIKE fallback in searchEpisodes
    }
    return db;
  } catch (err) {
    loadError = err;
    return null;
  }
}

// ---- Event → episode mapping (pure, exported for tests) --------------------

/** Rule-based importance — code decides, never the model. */
export function importanceForEvent(event) {
  const kind = String(event?.type || 'unknown');
  if (kind === 'finding') return event.verified === true ? 10 : 8;
  if (kind === 'consolidation') return 7;
  if (kind === 'recall') return 6;
  if (kind === 'test' || kind === 'tool_call') return 4;
  if (kind === 'thinking' || kind === 'briefing') return 2;
  if (kind === 'status') return 1;
  return 3;
}

function clip(s, n) {
  const str = s == null ? '' : String(s);
  return str.length > n ? str.slice(0, n) : str;
}

function titleFor(event, kind) {
  switch (kind) {
    case 'finding':
      return clip(event.title || event.class || 'finding', TITLE_CAP);
    case 'thinking':
    case 'briefing':
      return clip(String(event.text || kind).split('\n')[0], TITLE_CAP) || kind;
    case 'status':
      return clip(`status: ${event.state || ''}`, TITLE_CAP);
    case 'orchestrator':
      return clip(
        `${event.action || 'orchestrator'} ${event.role || ''} — ${event.mission || ''}`,
        TITLE_CAP
      );
    case 'memory_audit':
      return clip(`memory audit @iter ${event.iteration ?? '?'} (${event.count ?? 0} keys)`, TITLE_CAP);
    case 'recon_intel':
      return clip(`recon intel: techs=${(event.techs || []).join(',') || 'none'}`, TITLE_CAP);
    case 'recall':
      return clip(`recall: ${event.query || event.text || ''}`, TITLE_CAP);
    default: {
      const first = event.title || event.text || event.action || event.state || '';
      return clip(`${kind}${first ? `: ${String(first).split('\n')[0]}` : ''}`, TITLE_CAP);
    }
  }
}

function bodyFor(event, kind) {
  if (kind === 'finding') {
    const ev = event.evidence || {};
    return clip(
      JSON.stringify({
        class: event.class || null,
        severity: event.severity || null,
        url: event.url || null,
        verified: event.verified ?? null,
        verification: clip(event.verification || '', 300),
        evidenceStatus: event.evidenceStatus || null,
        request: clip(ev.request || event.poc_command || '', 600),
        response: clip(ev.response || '', 1200),
        poc_output: clip(event.poc_output || ev.poc_output || '', 600),
        impact_demo: clip(ev.impact_demo || event.impact_demo || '', 400),
      }),
      BODY_CAP
    );
  }
  if (kind === 'thinking' || kind === 'briefing') return clip(event.text || '', BODY_CAP);
  const rest = { ...event };
  delete rest.cachedAt;
  return clip(JSON.stringify(rest), BODY_CAP);
}

function outcomeFor(event, kind) {
  if (kind === 'finding') {
    return event.verified === true ? 'verified' : event.verified === false ? 'rejected' : 'unverified';
  }
  if (kind === 'status') return event.state || null;
  return event.outcome || null;
}

/** Map one parsed events.jsonl line to an episode row (pure). */
export function episodeFromEvent(huntId, sourceIdx, event) {
  const kind = String(event?.type || 'unknown');
  return {
    ts: event.cachedAt || event.at || new Date().toISOString(),
    hunt_id: String(huntId),
    source_idx: sourceIdx,
    iteration: Number.isInteger(event.iteration) ? event.iteration : null,
    kind,
    actor: event.source || event.actor || (kind === 'finding' ? event.class || 'agent' : 'system'),
    title: titleFor(event, kind),
    body: bodyFor(event, kind),
    outcome: outcomeFor(event, kind),
    importance: importanceForEvent(event),
  };
}

function tombstone(huntId, sourceIdx, rawLine) {
  return {
    ts: new Date().toISOString(),
    hunt_id: String(huntId),
    source_idx: sourceIdx,
    iteration: null,
    kind: '_torn',
    actor: 'system',
    title: 'torn line (unparseable) in events.jsonl',
    body: clip(rawLine, 500),
    outcome: null,
    importance: 0,
  };
}

// ---- Mirror (idempotent; JSONL is the source of truth) ----------------------

function insertEpisodes(rows) {
  const d = getDb();
  if (!d || rows.length === 0) return 0;
  const stmt = d.prepare(`
    INSERT OR IGNORE INTO episodes
      (ts, hunt_id, source_idx, iteration, kind, actor, title, body, outcome, importance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let inserted = 0;
  d.exec('BEGIN');
  try {
    for (const r of rows) {
      const res = stmt.run(
        r.ts, r.hunt_id, r.source_idx, r.iteration, r.kind, r.actor, r.title, r.body, r.outcome, r.importance
      );
      inserted += Number(res.changes || 0);
    }
    d.exec('COMMIT');
  } catch (err) {
    try { d.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }
  return inserted;
}

function getWatermark(huntId) {
  const d = getDb();
  if (!d) return 0;
  const row = d.prepare('SELECT next_idx FROM mirror_state WHERE hunt_id = ?').get(String(huntId));
  return row ? row.next_idx : 0;
}

function setWatermark(huntId, nextIdx) {
  const d = getDb();
  if (!d) return;
  d.prepare(
    `INSERT INTO mirror_state (hunt_id, next_idx, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(hunt_id) DO UPDATE SET next_idx = excluded.next_idx, updated_at = excluded.updated_at`
  ).run(String(huntId), nextIdx, new Date().toISOString());
}

export function huntEventsFile(huntId) {
  return path.join(config.dataDir, 'hunts', String(huntId), 'events.jsonl');
}

/** Mirror any not-yet-mirrored lines of one hunt's events.jsonl. */
export function flushHuntEpisodes(huntId) {
  const d = getDb();
  if (!d) return { inserted: 0, total: 0 };
  let raw;
  try {
    raw = fs.readFileSync(huntEventsFile(huntId), 'utf8');
  } catch {
    return { inserted: 0, total: 0 };
  }
  const lines = raw.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  let next = getWatermark(huntId);
  if (next > lines.length) {
    console.warn(`[episodes] ${huntId}: watermark ${next} beyond file length ${lines.length}; resyncing`);
    next = 0;
  }
  if (next >= lines.length) return { inserted: 0, total: lines.length };
  const rows = [];
  for (let i = next; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      rows.push(tombstone(huntId, i, line));
      continue;
    }
    try {
      rows.push(episodeFromEvent(huntId, i, JSON.parse(line)));
    } catch {
      rows.push(tombstone(huntId, i, line));
    }
  }
  const inserted = insertEpisodes(rows);
  setWatermark(huntId, lines.length);
  return { inserted, total: lines.length };
}

/** Mirror every hunt under data/hunts. Returns { hunts, inserted, total }. */
export function backfillAllHunts() {
  const out = { hunts: 0, inserted: 0, total: 0 };
  if (!getDb()) return out;
  let names = [];
  try {
    names = fs.readdirSync(path.join(config.dataDir, 'hunts'));
  } catch {
    return out;
  }
  for (const name of names) {
    if (!fs.existsSync(huntEventsFile(name))) continue;
    const r = flushHuntEpisodes(name);
    out.hunts++;
    out.inserted += r.inserted;
    const c = getDb()
      .prepare('SELECT COUNT(*) AS n FROM episodes WHERE hunt_id = ?')
      .get(name);
    out.total += c ? c.n : 0;
  }
  return out;
}

// Coalesced flush for the append hot path — never blocks the request path.
const pendingFlush = new Set();
export function scheduleEpisodeFlush(huntId) {
  if (!episodeLedgerEnabled()) return;
  const key = String(huntId);
  if (pendingFlush.has(key)) return;
  pendingFlush.add(key);
  setImmediate(() => {
    pendingFlush.delete(key);
    try {
      flushHuntEpisodes(key);
    } catch {
      // mirror is best-effort; the JSONL remains the source of truth
    }
  });
}

// ---- Reads (stage 1 surface; stage 2 builds scored retrieval on top) -------

export function getEpisodeStats() {
  const d = getDb();
  if (!d) return { enabled: false, error: loadError ? String(loadError.message || loadError) : 'unavailable', total: 0, perHunt: {}, fts: false };
  const total = d.prepare('SELECT COUNT(*) AS n FROM episodes').get().n;
  const perHunt = {};
  for (const row of d.prepare('SELECT hunt_id, COUNT(*) AS n FROM episodes GROUP BY hunt_id').all()) {
    perHunt[row.hunt_id] = row.n;
  }
  return { enabled: true, total, perHunt, fts: ftsAvailable };
}

export function getRecentEpisodes(huntId, limit = 20) {
  const d = getDb();
  if (!d) return [];
  return d
    .prepare('SELECT * FROM episodes WHERE hunt_id = ? ORDER BY id DESC LIMIT ?')
    .all(String(huntId), limit)
    .reverse();
}

/** Generic episode query for stage-3+ consumers (dossier, eval). */
export function queryEpisodes(huntId, { kind = null, outcome = null, limit = 50 } = {}) {
  const d = getDb();
  if (!d) return [];
  let sql = 'SELECT * FROM episodes WHERE hunt_id = ?';
  const args = [String(huntId)];
  if (kind) { sql += ' AND kind = ?'; args.push(kind); }
  if (outcome) { sql += ' AND outcome = ?'; args.push(outcome); }
  sql += ' ORDER BY importance DESC, id DESC LIMIT ?';
  args.push(limit);
  return d.prepare(sql).all(...args);
}

/** Verified finding episodes across ALL hunts after a timestamp (promotion gate evidence). */
export function getVerifiedFindingsSince(tsIso, limit = 200) {
  const d = getDb();
  if (!d) return [];
  return d
    .prepare(
      "SELECT * FROM episodes WHERE kind = 'finding' AND outcome = 'verified' AND ts > ? ORDER BY id ASC LIMIT ?"
    )
    .all(String(tsIso), limit);
}

/** Highest mirrored source_idx for a hunt (-1 when the ledger is empty). */
export function maxSourceIdx(huntId) {
  const d = getDb();
  if (!d) return -1;
  const row = d.prepare('SELECT MAX(source_idx) AS m FROM episodes WHERE hunt_id = ?').get(String(huntId));
  return row && row.m != null ? row.m : -1;
}

/** source_idx of the newest consolidation episode for a hunt (-1 if none). */
export function lastConsolidationIdx(huntId) {
  const d = getDb();
  if (!d) return -1;
  const row = d
    .prepare("SELECT MAX(source_idx) AS m FROM episodes WHERE hunt_id = ? AND kind = 'consolidation'")
    .get(String(huntId));
  return row && row.m != null ? row.m : -1;
}

export function getTopEpisodes(huntId, limit = 20) {
  const d = getDb();
  if (!d) return [];
  return d
    .prepare('SELECT * FROM episodes WHERE hunt_id = ? ORDER BY importance DESC, id DESC LIMIT ?')
    .all(String(huntId), limit);
}

export function recordEpisodeAccess(ids) {
  const d = getDb();
  if (!d || !ids.length) return;
  const now = new Date().toISOString();
  const stmt = d.prepare(
    'UPDATE episodes SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?'
  );
  for (const id of ids) stmt.run(now, id);
}

/** Keyword search over episode titles/bodies (FTS5 when available, else LIKE). */
export function searchEpisodes(query, { huntId = null, limit = 8 } = {}) {
  const d = getDb();
  if (!d) return [];
  const tokens = String(query || '').toLowerCase().match(/[a-z0-9_./:-]+/g) || [];
  if (!tokens.length) return [];
  let rows = [];
  if (ftsAvailable) {
    const match = tokens.map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ');
    const sql = huntId
      ? `SELECT e.* FROM episodes_fts f JOIN episodes e ON e.id = f.rowid
           WHERE episodes_fts MATCH ? AND e.hunt_id = ? ORDER BY f.rank LIMIT ?`
      : `SELECT e.* FROM episodes_fts f JOIN episodes e ON e.id = f.rowid
           WHERE episodes_fts MATCH ? ORDER BY f.rank LIMIT ?`;
    rows = huntId ? d.prepare(sql).all(match, String(huntId), limit) : d.prepare(sql).all(match, limit);
  } else {
    const like = `%${tokens[0]}%`;
    const sql = huntId
      ? 'SELECT * FROM episodes WHERE hunt_id = ? AND (title LIKE ? OR body LIKE ?) ORDER BY importance DESC, id DESC LIMIT ?'
      : 'SELECT * FROM episodes WHERE (title LIKE ? OR body LIKE ?) ORDER BY importance DESC, id DESC LIMIT ?';
    rows = huntId ? d.prepare(sql).all(String(huntId), like, like, limit) : d.prepare(sql).all(like, like, limit);
  }
  if (rows.length) {
    recordEpisodeAccess(rows.map((r) => r.id));
    // Returned rows were materialised before the bump — reflect it so
    // callers (and stage-2 scoring) see the post-access counts.
    for (const r of rows) r.access_count = (r.access_count || 0) + 1;
  }
  return rows;
}

/**
 * Deterministic context assembly (stage 1): the same ledger state always
 * produces the same briefing text — header counts, top episodes by rule
 * importance, then the most recent episodes. No LLM involved.
 */
export function assembleEpisodeContext(huntId, { budgetChars = 6000, topN = 8, recentN = 8 } = {}) {
  const d = getDb();
  if (!d) return '';
  const hid = String(huntId);
  const counts = d
    .prepare('SELECT kind, COUNT(*) AS n FROM episodes WHERE hunt_id = ? GROUP BY kind ORDER BY n DESC')
    .all(hid);
  const total = counts.reduce((a, c) => a + c.n, 0);
  if (!total) return '';
  const verified = d
    .prepare("SELECT COUNT(*) AS n FROM episodes WHERE hunt_id = ? AND kind = 'finding' AND outcome = 'verified'")
    .get(hid).n;
  const header =
    `EPISODE LEDGER — ${hid}: ${total} episodes (${verified} verified findings; ` +
    counts.map((c) => `${c.kind} ${c.n}`).join(', ') + ')';
  const line = (e) =>
    `- [imp ${e.importance} · ${e.kind}${e.outcome ? ` · ${e.outcome}` : ''} · ${e.ts}] ${clip(e.title, 140)}`;
  const seen = new Set();
  const lines = [header, 'TOP EPISODES (rule importance, then recency):'];
  for (const e of getTopEpisodes(hid, topN)) {
    lines.push(line(e));
    seen.add(e.id);
  }
  lines.push('MOST RECENT:');
  for (const e of getRecentEpisodes(hid, recentN * 2)) {
    if (seen.has(e.id)) continue;
    lines.push(line(e));
    if (lines.length > topN + recentN + 2) break;
  }
  let out = '';
  for (const l of lines) {
    if (out.length + l.length + 1 > budgetChars) break;
    out += (out ? '\n' : '') + l;
  }
  return out;
}

// ---- Stage 2: hybrid retrieval, scored entirely by code ---------------------
//
// Research report §5 item 2 (Generative Agents retrieval formula + Mem0
// multi-signal retrieval + EM-LLM temporal neighbours + MemoryBank access
// reinforcement), re-implemented:
//   score = 1.0 * relevance          (FTS5 position + embedding cosine)
//         + 0.6 * importance/10      (rule-based, stage 1)
//         + 0.4 * recency            (exp decay, 48h half-life, access-aware)
//         + entity boost             (paths / IPs / hosts / keywords in text)
// Cross-hunt hits are discounted x0.85. Selected hits attach their temporal
// neighbours (source_idx +/- 1) and get an access-count reinforcement.
// ZERO LLM calls anywhere in scoring — the only model call is the tiny
// nomic-embed-text embedding of the query and of new episodes, via Ollama.

export const EMBED_MODEL = process.env.EPISODE_EMBED_MODEL || 'nomic-embed-text';
export const RETRIEVAL_WEIGHTS = {
  relevance: 1.0,
  importance: 0.6,
  recency: 0.4,
  entityPerHit: 0.15,
  entityCap: 0.45,
  crossHuntFactor: 0.85,
  halfLifeHours: 48,
  accessBoostMax: 0.1,
};

let embedTransport = null;
/** Tests inject a fake transport: async (texts) => number[][]. */
export function setEmbeddingTransport(fn) {
  embedTransport = fn;
}

async function defaultEmbedTransport(texts) {
  const base = String(process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
  const res = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`embed HTTP ${res.status}`);
  const j = await res.json();
  return j.embeddings;
}

export async function embedTexts(texts) {
  return (embedTransport || defaultEmbedTransport)(texts);
}

function episodeEmbedText(row) {
  return `${row.title || ''} — ${clip(row.body || '', 500)}`;
}

/**
 * Embed episodes that lack a vector for the current model, most important
 * first. Bounded per call so it never competes with the hunt brain; safe to
 * run on a timer. Never throws — Ollama being busy just defers to next tick.
 */
export async function runEmbeddingBackfill({ maxEpisodes = 64, batchSize = 8 } = {}) {
  const d = getDb();
  if (!d) return { embedded: 0, remaining: 0 };
  const missingSql = `
    SELECT COUNT(*) AS n FROM episodes e
    LEFT JOIN episode_embeddings em ON em.episode_id = e.id AND em.model = ?
    WHERE em.episode_id IS NULL`;
  const rows = d
    .prepare(
      `SELECT e.id, e.title, e.body FROM episodes e
       LEFT JOIN episode_embeddings em ON em.episode_id = e.id AND em.model = ?
       WHERE em.episode_id IS NULL
       ORDER BY e.importance DESC, e.id ASC LIMIT ?`
    )
    .all(EMBED_MODEL, maxEpisodes);
  const ins = d.prepare(
    'INSERT OR REPLACE INTO episode_embeddings (episode_id, model, dims, vec) VALUES (?, ?, ?, ?)'
  );
  let embedded = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    let vecs;
    try {
      vecs = await embedTexts(batch.map(episodeEmbedText));
    } catch {
      break; // Ollama busy/down — retry next tick
    }
    if (!Array.isArray(vecs) || vecs.length !== batch.length) break;
    for (let j = 0; j < batch.length; j++) {
      const v = vecs[j];
      if (!Array.isArray(v) || !v.length) continue;
      ins.run(batch[j].id, EMBED_MODEL, v.length, Buffer.from(new Float32Array(v).buffer));
      embedded++;
    }
  }
  const remaining = d.prepare(missingSql).get(EMBED_MODEL).n;
  return { embedded, remaining };
}

export function getEmbeddingStats() {
  const d = getDb();
  if (!d) return { embedded: 0, total: 0, model: EMBED_MODEL };
  const total = d.prepare('SELECT COUNT(*) AS n FROM episodes').get().n;
  const embedded = d
    .prepare('SELECT COUNT(*) AS n FROM episode_embeddings WHERE model = ?')
    .get(EMBED_MODEL).n;
  return { embedded, total, model: EMBED_MODEL };
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Entities worth boosting: URL paths, IPv4s, hostnames, long keywords. */
export function extractEntities(query) {
  const q = String(query || '');
  const out = new Set();
  for (const m of q.match(/\/[a-z0-9._~/-]+/gi) || []) if (m.length > 2) out.add(m.toLowerCase());
  for (const m of q.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) || []) out.add(m);
  for (const m of q.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi) || []) out.add(m.toLowerCase());
  for (const m of q.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) || []) out.add(m);
  return [...out];
}

function ftsCandidates(query, huntId, crossHunt, limit) {
  const d = getDb();
  if (!d || !ftsAvailable) return [];
  const tokens = String(query || '').toLowerCase().match(/[a-z0-9_./:-]+/g) || [];
  if (!tokens.length) return [];
  const match = tokens.map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ');
  try {
    if (huntId && !crossHunt) {
      return d
        .prepare(
          `SELECT e.* FROM episodes_fts f JOIN episodes e ON e.id = f.rowid
           WHERE episodes_fts MATCH ? AND e.hunt_id = ? ORDER BY f.rank LIMIT ?`
        )
        .all(match, String(huntId), limit);
    }
    return d
      .prepare(
        `SELECT e.* FROM episodes_fts f JOIN episodes e ON e.id = f.rowid
         WHERE episodes_fts MATCH ? ORDER BY f.rank LIMIT ?`
      )
      .all(match, limit);
  } catch {
    return [];
  }
}

/**
 * Hybrid retrieval over the episode ledger. All scoring is arithmetic —
 * no LLM calls. Returns { query, results: [{...episode, score, parts,
 * neighbours}], signals } sorted by score desc.
 */
export async function retrieveEpisodes(query, { huntId = null, crossHunt = false, limit = 8, now = Date.now() } = {}) {
  const d = getDb();
  if (!d) return { query, results: [], signals: { fts: 0, vec: 0 } };
  const W = RETRIEVAL_WEIGHTS;
  const candidates = new Map(); // id -> { row, ftsPos, cos }

  const fts = ftsCandidates(query, huntId, crossHunt, 60);
  fts.forEach((row, pos) => candidates.set(row.id, { row, ftsPos: pos, cos: null }));

  // Vector signal (best-effort — a busy Ollama must never break retrieval).
  let vecCount = 0;
  try {
    const [qv] = await embedTexts([String(query || '').slice(0, 1000)]);
    if (Array.isArray(qv) && qv.length) {
      const scopeSql = huntId && !crossHunt
        ? `SELECT e.*, em.vec FROM episode_embeddings em JOIN episodes e ON e.id = em.episode_id
             WHERE em.model = ? AND e.hunt_id = ?`
        : `SELECT e.*, em.vec FROM episode_embeddings em JOIN episodes e ON e.id = em.episode_id
             WHERE em.model = ?`;
      const rows = huntId && !crossHunt ? d.prepare(scopeSql).all(EMBED_MODEL, String(huntId)) : d.prepare(scopeSql).all(EMBED_MODEL);
      const scored = [];
      for (const r of rows) {
        const vec = new Float32Array(r.vec.buffer, r.vec.byteOffset, r.vec.byteLength / 4);
        scored.push({ row: r, cos: cosine(vec, qv) });
      }
      scored.sort((a, b) => b.cos - a.cos);
      for (const s of scored.slice(0, 60)) {
        vecCount++;
        const existing = candidates.get(s.row.id);
        if (existing) existing.cos = s.cos;
        else candidates.set(s.row.id, { row: s.row, ftsPos: null, cos: s.cos });
      }
    }
  } catch { /* vector signal unavailable this call */ }

  // Recency/importance pool guarantees a non-empty, sane result set even
  // when both relevance signals miss.
  const poolSql = huntId && !crossHunt
    ? 'SELECT * FROM episodes WHERE hunt_id = ? ORDER BY importance DESC, id DESC LIMIT 20'
    : 'SELECT * FROM episodes ORDER BY importance DESC, id DESC LIMIT 20';
  const pool = huntId && !crossHunt ? d.prepare(poolSql).all(String(huntId)) : d.prepare(poolSql).all();
  for (const row of pool) {
    if (!candidates.has(row.id)) candidates.set(row.id, { row, ftsPos: null, cos: null });
  }

  const entities = extractEntities(query);
  const results = [];
  for (const { row, ftsPos, cos } of candidates.values()) {
    const ftsScore = ftsPos == null ? null : 1 / (1 + ftsPos);
    const vecScore = cos == null ? null : Math.max(0, Math.min(1, (cos + 1) / 2));
    const relevance = ftsScore != null && vecScore != null
      ? 0.5 * ftsScore + 0.5 * vecScore
      : (ftsScore ?? vecScore ?? 0);
    // Recency is a property of the EPISODE, not of its retrieval history —
    // folding last_accessed_at in here made retrieval non-idempotent (the
    // act of retrieving reshuffled the next retrieval). MemoryBank-style
    // reinforcement enters separately as a small saturating access boost.
    const tsMs = Date.parse(row.ts || '');
    const ageHours = Number.isFinite(tsMs) ? Math.max(0, (now - tsMs) / 3600000) : 9999;
    const recency = Math.pow(0.5, ageHours / W.halfLifeHours);
    const ac = row.access_count || 0;
    const accessBoost = W.accessBoostMax * (ac / (ac + 3));
    const importanceScore = (row.importance || 0) / 10;
    const text = `${row.title || ''}\n${row.body || ''}`.toLowerCase();
    let entityHits = 0;
    for (const e of entities) if (text.includes(e)) entityHits++;
    const entityBoost = Math.min(W.entityCap, entityHits * W.entityPerHit);
    let score = W.relevance * relevance + W.importance * importanceScore + W.recency * recency + entityBoost + accessBoost;
    if (crossHunt && huntId && row.hunt_id !== String(huntId)) score *= W.crossHuntFactor;
    results.push({ ...row, score, parts: { relevance, ftsScore, vecScore, importanceScore, recency, entityBoost, accessBoost }, neighbours: [] });
  }
  results.sort((a, b) => b.score - a.score || b.id - a.id);
  const selected = results.slice(0, limit);

  // Temporal neighbours (EM-LLM): what happened immediately around a hit
  // is usually part of the same episode.
  const nStmt = d.prepare('SELECT * FROM episodes WHERE hunt_id = ? AND source_idx IN (?, ?)');
  for (const hit of selected) {
    try {
      hit.neighbours = nStmt.all(hit.hunt_id, hit.source_idx - 1, hit.source_idx + 1);
    } catch { hit.neighbours = []; }
  }
  if (selected.length) recordEpisodeAccess(selected.map((r) => r.id));
  return { query, results: selected, signals: { fts: fts.length, vec: vecCount } };
}

/** Format retrieval results for the planning prompt (placed at its END). */
export function formatRetrievalForPrompt(results, { budgetChars = 4200, query = '' } = {}) {
  if (!results || !results.length) return '';
  const squash = (s, n) => clip(String(s || '').replace(/\s+/g, ' '), n);
  const lines = [
    `--- RETRIEVED MEMORY (code-scored recall of your past episodes${query ? ` for: "${squash(query, 100)}"` : ''} — most relevant first) ---`,
  ];
  for (const r of results) {
    lines.push(
      `[${r.score.toFixed(2)} · ${r.kind}${r.outcome ? ` · ${r.outcome}` : ''} · ${r.ts} · ${r.hunt_id}] ${squash(r.title, 140)} — ${squash(r.body, 200)}`
    );
    for (const n of r.neighbours || []) {
      lines.push(`  ↳ ${n.source_idx < r.source_idx ? 'before' : 'after'}: [${n.kind}] ${squash(n.title, 120)}`);
    }
  }
  let out = '';
  for (const l of lines) {
    if (out.length + l.length + 1 > budgetChars) break;
    out += (out ? '\n' : '') + l;
  }
  return out;
}

// ---- Stage 4: validator-gated Reflexion + dead-end registry -----------------
//
// Research report §5 item 4 (Reflexion + PentAGI's reflector/limits),
// re-implemented for an 8B brain: a lesson is written ONLY when a
// deterministic validator speaks — a finding rejection with a verdict
// string, or the execution-failure gate discarding a probe. Never
// self-graded. The lesson is composed BY CODE from the validator's own
// structured output ("Tried X → got Y → do W", hard-capped at 240 chars
// ≈ 40 tokens), stored in `ruled_out`, and checked BY CODE in the plan
// filter: after RETRY_BUDGET rejections of the same normalised test, the
// plan is skipped and a forced pivot is logged. Historical rejected
// findings already sitting in the episode ledger can seed the registry
// (backfillRuledOutFromEpisodes) — the verdicts were validator-written
// at the time, so the lessons stay validator-gated, just recognised late.

export const RETRY_BUDGET = 3;

/** Mirrors reasoningMemory.normalizeHypothesis (kept local to avoid an import cycle). */
export function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Compose a ≤40-token lesson from a validator outcome. Pure. */
export function composeLesson({ title, family, detail }) {
  const X = clip(String(title || 'unnamed probe').replace(/\s+/g, ' '), 70);
  let Y;
  let W;
  switch (family) {
    case 'execution-failed':
      Y = `the command failed to execute (${clip(String(detail || 'no exit detail'), 40)})`;
      W = 'fix the command form before retrying this probe';
      break;
    case 'payload_validation':
      Y = 'the payload did not validate at the sink';
      W = 'vary the payload or endpoint — this instance is ruled out';
      break;
    case 'exploit_confirmation':
      Y = 'the effect could not be confirmed on re-run';
      W = 'get a reproducible signal or pivot technique';
      break;
    case 'impact_assessment':
      Y = 'no demonstrable impact';
      W = 'pivot to a surface with real impact';
      break;
    case 'reachability':
      Y = 'the target did not answer meaningfully';
      W = 're-check reachability before spending probes here';
      break;
    default:
      Y = clip(String(detail || 'the validator rejected it').replace(/\s+/g, ' '), 70);
      W = 'pivot — this instance is ruled out';
  }
  return clip(`Tried ${X} → got ${Y} → do: ${W}`, 240);
}

/**
 * Record one validator-gated lesson. `linkEpisode` ties the lesson to the
 * newest finding episode (used when the lesson comes from a finding
 * verdict — the episode was just mirrored); execution-gate discards have
 * no finding episode and pass false.
 */
export function recordRuledOut({ huntId, title, family, detail, technique = null, linkEpisode = false, ts = null, episodeId = null }) {
  const d = getDb();
  if (!d) return null;
  let epId = episodeId;
  if (epId == null && linkEpisode) {
    try {
      flushHuntEpisodes(huntId);
      const row = d
        .prepare("SELECT id FROM episodes WHERE hunt_id = ? AND kind = 'finding' ORDER BY id DESC LIMIT 1")
        .get(String(huntId));
      epId = row ? row.id : null;
    } catch { epId = null; }
  }
  const lesson = composeLesson({ title, family, detail });
  const info = d
    .prepare('INSERT INTO ruled_out (ts, hunt_id, key, technique, lesson, reason, episode_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(ts || new Date().toISOString(), String(huntId), normalizeKey(title), technique, lesson, family || null, epId);
  return { id: Number(info.lastInsertRowid), lesson };
}

/** Map of normalised key -> rejection count for one hunt. */
export function getRuledOutCounts(huntId) {
  const d = getDb();
  const out = new Map();
  if (!d) return out;
  for (const row of d.prepare('SELECT key, COUNT(*) AS c FROM ruled_out WHERE hunt_id = ? GROUP BY key').all(String(huntId))) {
    out.set(row.key, row.c);
  }
  return out;
}

export function getRuledOut(huntId, limit = 50) {
  const d = getDb();
  if (!d) return [];
  return d.prepare('SELECT * FROM ruled_out WHERE hunt_id = ? ORDER BY id DESC LIMIT ?').all(String(huntId), limit);
}

/**
 * Seed the registry from historical REJECTED finding episodes (their
 * verdict strings were written by the validators when the findings were
 * assessed). Idempotent: an episode that already has a lesson is skipped.
 */
export function backfillRuledOutFromEpisodes() {
  const d = getDb();
  if (!d) return { recorded: 0 };
  const have = new Set(d.prepare('SELECT episode_id FROM ruled_out WHERE episode_id IS NOT NULL').all().map((r) => r.episode_id));
  const rows = d
    .prepare("SELECT id, hunt_id, title, body, ts FROM episodes WHERE kind = 'finding' AND outcome = 'rejected' ORDER BY id ASC")
    .all();
  let recorded = 0;
  for (const r of rows) {
    if (have.has(r.id)) continue;
    const vm = /"verification"\s*:\s*"([^"]*)"/.exec(String(r.body || ''));
    const verdict = vm ? vm[1] : '';
    const fm = /\((\w+)[::]/.exec(verdict);
    recordRuledOut({
      huntId: r.hunt_id,
      title: r.title || 'finding',
      family: fm ? fm[1] : 'validator',
      detail: verdict,
      ts: r.ts,
      episodeId: r.id,
    });
    recorded++;
  }
  return { recorded };
}

/** Compact lessons block for the planning prompt (grouped, worst first). */
export function formatLessonsForPrompt(huntId, { limit = 8, budgetChars = 1500 } = {}) {
  const d = getDb();
  if (!d) return '';
  const rows = d
    .prepare(
      `SELECT key, COUNT(*) AS c, MAX(id) AS newest FROM ruled_out
       WHERE hunt_id = ? GROUP BY key ORDER BY c DESC, newest DESC LIMIT ?`
    )
    .all(String(huntId), limit);
  if (!rows.length) return '';
  const latest = d.prepare('SELECT lesson FROM ruled_out WHERE hunt_id = ? AND key = ? ORDER BY id DESC LIMIT 1');
  const lines = [
    `\n--- LESSONS FROM FAILURES (validator-written; a test is RULED OUT after ${RETRY_BUDGET} rejections and will be skipped — pivot instead) ---`,
  ];
  for (const r of rows) {
    const row = latest.get(String(huntId), r.key);
    if (row) lines.push(`- ${row.lesson} (×${r.c})`);
  }
  let out = '';
  for (const l of lines) {
    if (out.length + l.length + 1 > budgetChars) break;
    out += (out ? '\n' : '') + l;
  }
  return out;
}
