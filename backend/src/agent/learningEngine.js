import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Continuous Learning — the agent gets smarter with every hunt.
 *
 * Elite hunters build INTUITION:
 *   "WordPress sites usually have X"
 *   "This WAF blocks Y but not Z"
 *   "Fintech apps often miss business logic in coupon flows"
 *
 * This engine:
 * 1. Records hunt outcomes (what worked, what didn't)
 * 2. Builds per-target-type profiles (tech stack → effective techniques)
 * 3. Suggests techniques for new hunts based on past success
 * 4. Tracks false positive patterns to avoid repeating mistakes
 *
 * Persistence is REAL: state is written to <memoryDir>/learning.json on
 * every record call (when a memoryDir is given) and can be reloaded with
 * LearningEngine.load(memoryDir). Without a memoryDir it stays in-memory
 * only (tests, ephemeral runs).
 */

const STORE_FILE = 'learning.json';

export class LearningEngine {
  constructor(memoryDir = null) {
    this.memoryDir = memoryDir;
    // In-memory cache; persisted to disk
    this.profiles = new Map();      // techStack → { techniques: {name: {success, total}} }
    this.falsePositives = new Map(); // pattern → count
    this.targetHistory = [];         // recent hunts (max 100)
  }

  /**
   * Load persisted learning state from a memory directory. Returns a fresh
   * engine (empty state) when nothing was persisted yet.
   */
  static load(memoryDir) {
    const engine = new LearningEngine(memoryDir);
    if (!memoryDir) return engine;
    const path = join(memoryDir, STORE_FILE);
    try {
      if (!existsSync(path)) return engine;
      const data = JSON.parse(readFileSync(path, 'utf8'));
      if (data?.profiles) engine.profiles = new Map(Object.entries(data.profiles));
      if (data?.falsePositives) engine.falsePositives = new Map(Object.entries(data.falsePositives));
      if (Array.isArray(data?.targetHistory)) engine.targetHistory = data.targetHistory;
    } catch {
      // Corrupt store → start clean rather than crash the hunt.
    }
    return engine;
  }

  /**
   * Record a technique outcome.
   * @param {string} techStack - e.g. "wordpress", "react+nodejs"
   * @param {string} technique - e.g. "sqli_boolean", "xss_reflected"
   * @param {boolean} success - did it find a real vulnerability?
   */
  recordTechnique(techStack, technique, success) {
    const key = this._normStack(techStack);
    if (!this.profiles.has(key)) {
      this.profiles.set(key, { techniques: {}, hunts: 0 });
    }
    const profile = this.profiles.get(key);
    profile.hunts++;
    if (!profile.techniques[technique]) {
      profile.techniques[technique] = { success: 0, total: 0 };
    }
    profile.techniques[technique].total++;
    if (success) profile.techniques[technique].success++;
    this._persist();
  }

  /**
   * Record a false positive to avoid repeating it.
   */
  recordFalsePositive(pattern, context = '') {
    const key = `${pattern}::${context.slice(0, 50)}`;
    this.falsePositives.set(key, (this.falsePositives.get(key) || 0) + 1);
    this._persist();
  }

  /**
   * Check if a pattern was a false positive before.
   */
  wasFalsePositive(pattern, context = '') {
    const key = `${pattern}::${context.slice(0, 50)}`;
    return (this.falsePositives.get(key) || 0) >= 2;
  }

  /**
   * Suggest techniques for a new hunt, ordered by past success rate.
   * @param {string} techStack
   * @param {number} limit
   * @returns {string[]} technique names, best first
   */
  suggestTechniques(techStack, limit = 10) {
    const key = this._normStack(techStack);
    const profile = this.profiles.get(key);
    if (!profile) return [];

    return Object.entries(profile.techniques)
      .map(([name, stats]) => ({
        name,
        rate: stats.total > 0 ? stats.success / stats.total : 0,
        total: stats.total
      }))
      // Need at least 2 data points to trust
      .filter((t) => t.total >= 2)
      .sort((a, b) => b.rate - a.rate || b.total - a.total)
      .slice(0, limit)
      .map((t) => t.name);
  }

  /**
   * Record a completed hunt summary.
   */
  recordHunt({ target, techStack, findings, durationMs }) {
    this.targetHistory.push({
      target,
      techStack: this._normStack(techStack),
      findingCount: findings?.length || 0,
      severities: (findings || []).map((f) => f.severity),
      at: new Date().toISOString(),
      durationMs
    });
    if (this.targetHistory.length > 100) {
      this.targetHistory = this.targetHistory.slice(-100);
    }
    this._persist();
  }

  /**
   * Get learning insights for the brain's prompt.
   */
  getInsights(techStack) {
    const suggestions = this.suggestTechniques(techStack, 5);
    const profile = this.profiles.get(this._normStack(techStack));
    const lines = [];
    if (suggestions.length > 0) {
      lines.push(`Based on ${profile.hunts} past hunts on ${techStack}:`);
      lines.push(`Most effective techniques: ${suggestions.join(', ')}`);
    }
    if (this.falsePositives.size > 0) {
      lines.push(`Known false-positive patterns to double-check: ${this.falsePositives.size} recorded`);
    }
    return lines.join('\n');
  }

  _normStack(stack) {
    return String(stack || 'unknown').toLowerCase().trim() || 'unknown';
  }

  /**
   * Record a CONFIRMED finding so future hunts on the same tech stack
   * prioritize the technique that produced it. This is the main hook the
   * agent worker calls when a finding validates.
   *
   * @param {object} outcome — { techStack, technique, tool }
   */
  recordConfirmedFinding({ techStack, technique, tool = null }) {
    const name = tool ? `${technique}::${tool}` : technique;
    this.recordTechnique(techStack, name, true);
  }

  /** Where past learning biases the next hunt's tool priority. */
  _persist() {
    if (!this.memoryDir) return; // in-memory only mode
    try {
      mkdirSync(this.memoryDir, { recursive: true });
      writeFileSync(join(this.memoryDir, STORE_FILE), JSON.stringify(this.toJSON()), 'utf8');
    } catch {
      // Persistence is best-effort — a hunt must never die because the
      // learning store is unwritable.
    }
  }

  /** Serialize for persistence. */
  toJSON() {
    return {
      profiles: Object.fromEntries(this.profiles),
      falsePositives: Object.fromEntries(this.falsePositives),
      targetHistory: this.targetHistory
    };
  }

  /** Restore from persisted state. */
  static fromJSON(data) {
    const engine = new LearningEngine();
    if (data?.profiles) {
      engine.profiles = new Map(Object.entries(data.profiles));
    }
    if (data?.falsePositives) {
      engine.falsePositives = new Map(Object.entries(data.falsePositives));
    }
    if (data?.targetHistory) {
      engine.targetHistory = data.targetHistory;
    }
    return engine;
  }
}
