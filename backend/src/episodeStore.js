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
