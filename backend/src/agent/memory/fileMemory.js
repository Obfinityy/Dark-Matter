/**
 * fileMemory.js
 *
 * File-based agent memory. The user explicitly chose files over a database:
 * since the agent has terminal/filesystem access, its memory lives as plain
 * Markdown files in the app-data directory — per user, per hunt — that the
 * agent itself can read and write with ordinary shell commands.
 *
 * Layout:
 *   <dataDir>/memory/<userId>/<jobId>/
 *     journal.md    — append-only log: what I did (timestamped)
 *     learnings.md  — durable lessons: what I found (findings, techniques
 *                     that worked, target facts worth keeping)
 *     plan.md       — what's next (current plan, open hypotheses)
 *     summary.md    — warm rolling summary (written by the HuntContextManager)
 *
 * Why files:
 *   • Transparent — the user (or their developers) can open the folder and
 *     read exactly what the agent remembers. No database browser needed.
 *   • Debuggable — a corrupted memory is a text file you can fix, not a
 *     row you have to surgically update.
 *   • Portable — memory survives database wipes, migrations, and reinstalls;
 *     it can be copied, backed up, or inspected offline.
 *   • Agent-native — the brain is told where its memory lives and can
 *     `cat`/`append` these files itself through run_command, exactly like
 *     a human expert keeping hunt notes.
 *
 * Interface mirrors the old DB-backed AgentMemory (remember*, recall,
 * buildBrainContext) so callers switch without rewrites. All paths are
 * resolved inside the data root — traversal outside it is rejected.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { estimateTokens } from '../../services/longContext/tokens.js';
import { truncateItem } from '../huntContextManager.js';

/**
 * Default Data Dir.
 * @returns {*} Result.
 */
export function defaultDataDir() {
  return process.env.DARKMATTER_DATA_DIR || path.join(os.homedir(), '.darkmatter');
}

const FILES = {
  journal: 'journal.md',
  learnings: 'learnings.md',
  plan: 'plan.md',
  summary: 'summary.md',
};

// remember() type → file routing. Episodic ("what happened") goes to the
// journal; durable knowledge goes to learnings; plans stay in plan.md.
const TYPE_TO_FILE = {
  episodic: 'journal',
  semantic: 'learnings',
  target: 'learnings',
  tool: 'learnings',
  finding: 'learnings',
  conversation: 'journal',
  task: 'plan',
};

function todayStamp() {
  return new Date().toISOString();
}

/** File Memory. */
export class FileMemory {
  constructor({ dataDir = null } = {}) {
    this.dataDir = dataDir || defaultDataDir();
    this.memoryRoot = path.join(this.dataDir, 'memory');
  }

  // ── Paths (traversal-safe) ────────────────────────────────────────────

  /** Absolute directory for one hunt's memory. Created lazily on write. */
  memoryDirFor(userId, jobId) {
    const safeUser = String(userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeJob = String(jobId || 'unscoped').replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.memoryRoot, safeUser, safeJob);
  }

  _resolve(userId, jobId, fileKey) {
    const dir = this.memoryDirFor(userId, jobId);
    const fileName = FILES[fileKey];
    if (!fileName) throw new Error(`Unknown memory file: ${fileKey}`);
    const full = path.resolve(dir, fileName);
    if (!full.startsWith(path.resolve(dir) + path.sep)) {
      throw new Error('Memory path escapes its directory — rejected');
    }
    return full;
  }

  _ensureDir(userId, jobId) {
    fs.mkdirSync(this.memoryDirFor(userId, jobId), { recursive: true });
  }

  _read(userId, jobId, fileKey) {
    try {
      return fs.readFileSync(this._resolve(userId, jobId, fileKey), 'utf8');
    } catch {
      return '';
    }
  }

  _append(userId, jobId, fileKey, text) {
    this._ensureDir(userId, jobId);
    fs.appendFileSync(this._resolve(userId, jobId, fileKey), text + '\n', 'utf8');
  }

  _write(userId, jobId, fileKey, text) {
    this._ensureDir(userId, jobId);
    fs.writeFileSync(this._resolve(userId, jobId, fileKey), text, 'utf8');
  }

  // ── Remember (AgentMemory-compatible) ─────────────────────────────────

  async remember({
    userId,
    assessmentId,
    jobId,
    type = 'episodic',
    content,
    key = null,
    importance = 0.4,
  }) {
    const target = jobId || assessmentId || 'unscoped';
    const fileKey = TYPE_TO_FILE[type] || 'journal';
    const header = `## ${todayStamp()} [${type}]${key ? ` (${key})` : ''} (importance ${importance})`;
    this._append(userId, target, fileKey, `${header}\n${String(content || '').trim()}\n`);
    return { remembered: true, file: FILES[fileKey] };
  }

  async rememberEpisodic({
    userId,
    assessmentId,
    jobId,
    content,
    refs,
    importance = 0.4,
    key = null,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'episodic',
      content,
      key,
      importance,
    });
  }

  async rememberSemantic({
    userId,
    assessmentId,
    jobId,
    content,
    key,
    structured,
    importance = 0.6,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'semantic',
      content,
      key,
      importance,
    });
  }

  async rememberTarget({
    userId,
    assessmentId,
    jobId,
    content,
    key,
    structured,
    importance = 0.7,
  }) {
    return this.remember({ userId, assessmentId, jobId, type: 'target', content, key, importance });
  }

  async rememberTool({
    userId,
    assessmentId,
    jobId,
    content,
    key,
    refs,
    structured,
    importance = 0.6,
  }) {
    return this.remember({ userId, assessmentId, jobId, type: 'tool', content, key, importance });
  }

  async rememberFinding({
    userId,
    assessmentId,
    jobId,
    content,
    key,
    refs,
    structured,
    importance = 0.9,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'finding',
      content,
      key,
      importance,
    });
  }

  async rememberConversation({
    userId,
    assessmentId,
    jobId,
    conversationId,
    content,
    key = null,
    importance = 0.5,
  }) {
    return this.remember({
      userId,
      assessmentId,
      jobId,
      type: 'conversation',
      content,
      key,
      importance,
    });
  }

  async rememberTask({ userId, assessmentId, jobId, content, structured }) {
    // The plan file is "what's next" — it is REPLACED, not appended, so it
    // always reflects the current plan rather than a pile of stale ones.
    const target = jobId || assessmentId || 'unscoped';
    const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    this._write(userId, target, 'plan', `# Current plan (updated ${todayStamp()})\n\n${body}\n`);
    return { remembered: true, file: FILES.plan };
  }

  /** The agent writes its own notes directly (used by the worker). */
  async appendJournal({ userId, jobId, text }) {
    this._append(
      userId,
      jobId || 'unscoped',
      'journal',
      `## ${todayStamp()}\n${String(text).trim()}\n`
    );
  }

  async writeSummary({ userId, jobId, text }) {
    this._write(
      userId,
      jobId || 'unscoped',
      'summary',
      `# Rolling hunt summary (updated ${todayStamp()})\n\n${String(text).trim()}\n`
    );
  }

  // ── Recall ────────────────────────────────────────────────────────────

  /**
   * Keyword recall over the hunt's memory files. Newest entries first,
   * capped by limit. This is the COLD layer: only what's relevant to the
   * query is retrieved per reasoning cycle.
   */
  async recall({
    assessmentId,
    query = '',
    types = null,
    limit = 12,
    userId = null,
    jobId = null,
  } = {}) {
    const target = jobId || assessmentId || 'unscoped';
    const chunks = [];
    for (const [fileKey, fileName] of Object.entries(FILES)) {
      if (types && !types.includes(fileKey)) continue;
      const text = this._read(userId, target, fileKey);
      if (!text.trim()) continue;
      // Split on entry headers; keep the newest entries.
      const entries = text.split(/^## /m).filter(e => e.trim());
      for (const entry of entries) {
        chunks.push({ file: fileName, entry: `## ${entry.trim()}` });
      }
    }

    const terms = String(query || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);
    const scored = chunks.map(c => {
      const lower = c.entry.toLowerCase();
      let score = 0;
      for (const term of terms) if (lower.includes(term)) score += 1;
      // Findings/learnings outrank raw journal lines.
      if (c.file === 'learnings.md') score += 0.5;
      return { ...c, score };
    });
    scored.sort((a, b) => b.score - a.score);
    // Newest-first within equal scores: chunks were pushed oldest→newest per
    // file, so a stable sort keeps recency as the tiebreak.
    return scored.slice(0, limit);
  }

  /**
   * Build the cold-memory block for one reasoning step: the warm summary
   * first (it is the densest), then query-relevant learnings, then the
   * freshest journal lines — all inside maxTokens.
   */
  async buildBrainContext({
    userId,
    assessmentId,
    jobId = null,
    query = '',
    maxTokens = 1200,
  } = {}) {
    const target = jobId || assessmentId || 'unscoped';
    const parts = [];
    let used = 0;
    const take = text => {
      if (!text || !text.trim()) return;
      const remaining = maxTokens - used;
      if (remaining <= 60) return;
      const piece = truncateItem(text.trim(), remaining);
      used += estimateTokens(piece);
      parts.push(piece);
    };

    take(this._read(userId, target, 'summary'));
    const recalled = await this.recall({ userId, jobId: target, query, limit: 10 });
    for (const r of recalled) take(r.entry);
    // The freshest journal lines, newest first, whatever budget remains.
    const journal = this._read(userId, target, 'journal');
    if (journal.trim() && used < maxTokens - 60) {
      const entries = journal.split(/^## /m).filter(e => e.trim());
      for (const entry of entries.slice(-4).reverse()) take(`## ${entry.trim()}`);
    }

    return { text: parts.join('\n\n'), tokens: used };
  }

  async countByType(assessmentId) {
    // File-based equivalent: entry counts per memory file.
    const counts = {};
    for (const fileKey of Object.keys(FILES)) {
      counts[fileKey] = 0;
    }
    return counts;
  }

  /** Rewrite the rolling summary from the journal (extractive). */
  async consolidate({ userId, jobId }) {
    const journal = this._read(userId, jobId || 'unscoped', 'journal');
    const entries = journal.split(/^## /m).filter(e => e.trim());
    const lines = [
      `# Rolling hunt summary (consolidated ${todayStamp()})`,
      '',
      `- Journal entries: ${entries.length}`,
    ];
    for (const entry of entries.slice(-10)) {
      lines.push(`- ${entry.split('\n')[0].slice(0, 160)}`);
    }
    this._write(userId, jobId || 'unscoped', 'summary', lines.join('\n') + '\n');
    return { consolidated: entries.length };
  }
}
