// Dark Matter — Code-owned plan tree (Job 6, stage 6).
//
// Research report §5 item 6 (Generative Agents planning + PentAGI task
// planning/monitoring; Cognition's single-thread principle),
// re-implemented: the plan is a persisted tree (goal → phases → leaves)
// in SQLite, owned by CODE. The model proposes leaf tasks as it always
// has (its per-iteration plans); code attaches them to the active phase,
// records their validator outcomes, advances phases, and fires re-plan
// triggers from COUNTERS, not vibes:
//   * a leaf fails twice            -> the leaf is parked (failed)
//   * a phase collects 2+ failures -> re-plan trigger for that phase
//   * a phase's leaves all resolve -> the phase closes, the next opens
//   * every phase closes            -> mission-tree-complete trigger
// The tree renders into the planning prompt as a compact checklist so
// the model fills only the next leaf instead of re-planning from
// scratch every iteration — the classic small-model failure this kills.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { config } from './config.js';

let DatabaseSync = null;
try {
  ({ DatabaseSync } = createRequire(import.meta.url)('node:sqlite'));
} catch { /* disabled on runtimes without node:sqlite */ }

export function planTreeEnabled() {
  return !!DatabaseSync;
}

let db = null;
function getDb() {
  if (!DatabaseSync) return null;
  if (db) return db;
  try {
    const file = path.join(config.dataDir, 'plans.db');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    db = new DatabaseSync(file);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS plan_nodes (
        id INTEGER PRIMARY KEY,
        hunt_id TEXT NOT NULL,
        parent_id INTEGER,
        kind TEXT NOT NULL,
        text TEXT NOT NULL,
        key TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        fail_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_plan_hunt ON plan_nodes(hunt_id, parent_id);
      CREATE INDEX IF NOT EXISTS idx_plan_key ON plan_nodes(hunt_id, key);
    `);
    return db;
  } catch {
    return null;
  }
}

export const DEFAULT_PHASES = [
  'Map the surface (recon, endpoints, fingerprint)',
  'Authentication & session',
  'File handling & uploads',
  'Business logic & data access',
  'Chaining & impact demonstration',
];

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const now = () => new Date().toISOString();

/** Create the goal + phase skeleton for a hunt if it has none. Idempotent. */
export function ensurePlanTree(huntId, { target = '', phases = DEFAULT_PHASES } = {}) {
  const d = getDb();
  if (!d) return null;
  const hid = String(huntId);
  const existing = d.prepare("SELECT id FROM plan_nodes WHERE hunt_id = ? AND kind = 'goal'").get(hid);
  if (existing) return existing.id;
  const goal = d
    .prepare('INSERT INTO plan_nodes (hunt_id, parent_id, kind, text, status, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?)')
    .run(hid, 'goal', `Hunt ${target} — only validator-confirmed findings count`, 'active', now(), now());
  const ins = d.prepare('INSERT INTO plan_nodes (hunt_id, parent_id, kind, text, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  phases.forEach((p, i) => ins.run(hid, Number(goal.lastInsertRowid), 'phase', p, i === 0 ? 'active' : 'pending', now(), now()));
  return Number(goal.lastInsertRowid);
}

export function getPhases(huntId) {
  const d = getDb();
  if (!d) return [];
  return d.prepare("SELECT * FROM plan_nodes WHERE hunt_id = ? AND kind = 'phase' ORDER BY id ASC").all(String(huntId));
}

export function getLeaves(huntId, phaseId = null) {
  const d = getDb();
  if (!d) return [];
  if (phaseId != null) {
    return d.prepare("SELECT * FROM plan_nodes WHERE hunt_id = ? AND kind = 'leaf' AND parent_id = ? ORDER BY id ASC").all(String(huntId), phaseId);
  }
  return d.prepare("SELECT * FROM plan_nodes WHERE hunt_id = ? AND kind = 'leaf' ORDER BY id ASC").all(String(huntId));
}

function activePhase(huntId) {
  const phases = getPhases(huntId);
  return phases.find((p) => p.status === 'active') || phases.find((p) => p.status === 'pending') || null;
}

/**
 * Record the validator outcome of one executed plan. Attaches the leaf
 * under the active phase on first sight (deduped by normalised text).
 * outcome: 'verified' | 'rejected' | 'no-assessment'.
 */
export function recordPlanOutcome(huntId, planText, outcome) {
  const d = getDb();
  if (!d || !planText) return null;
  const hid = String(huntId);
  ensurePlanTree(hid, {});
  const key = norm(planText);
  let leaf = d.prepare("SELECT * FROM plan_nodes WHERE hunt_id = ? AND kind = 'leaf' AND key = ?").get(hid, key);
  if (!leaf) {
    const phase = activePhase(hid);
    if (!phase) return null;
    const ins = d
      .prepare('INSERT INTO plan_nodes (hunt_id, parent_id, kind, text, key, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(hid, phase.id, 'leaf', String(planText).slice(0, 140), key, 'active', now(), now());
    leaf = d.prepare('SELECT * FROM plan_nodes WHERE id = ?').get(Number(ins.lastInsertRowid));
  }
  if (outcome === 'verified') {
    d.prepare("UPDATE plan_nodes SET status = 'done', updated_at = ? WHERE id = ?").run(now(), leaf.id);
  } else {
    const fails = (leaf.fail_count || 0) + 1;
    d.prepare('UPDATE plan_nodes SET fail_count = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(fails, fails >= 2 ? 'failed' : 'active', now(), leaf.id);
  }
  advancePhases(hid);
  return leaf.id;
}

/** Close phases whose leaves all resolved; activate the next pending one. */
export function advancePhases(huntId) {
  const d = getDb();
  if (!d) return;
  const hid = String(huntId);
  for (const phase of getPhases(hid)) {
    if (phase.status === 'done') continue;
    const leaves = getLeaves(hid, phase.id);
    // A phase closes when every leaf resolved AND it either produced a
    // verified result or exhausted itself (3+ leaves, all failed). A
    // phase whose first leaf merely died stays open — closing it would
    // skip the re-plan the failure is supposed to trigger.
    const resolved = leaves.length && leaves.every((l) => l.status === 'done' || l.status === 'failed');
    const closes = resolved && (leaves.some((l) => l.status === 'done') || leaves.length >= 3);
    if (closes) {
      d.prepare("UPDATE plan_nodes SET status = 'done', updated_at = ? WHERE id = ?").run(now(), phase.id);
      const next = getPhases(hid).find((p) => p.status === 'pending');
      if (next) d.prepare("UPDATE plan_nodes SET status = 'active', updated_at = ? WHERE id = ?").run(now(), next.id);
    }
  }
}

/** Counter-based re-plan triggers — evaluated fresh at render time. */
export function getReplanTriggers(huntId) {
  const triggers = [];
  const phases = getPhases(huntId);
  if (!phases.length) return triggers;
  for (const phase of phases) {
    const leaves = getLeaves(huntId, phase.id);
    const failed = leaves.filter((l) => l.status === 'failed');
    if (failed.length >= 2 && phase.status !== 'done') {
      triggers.push({ phase: phase.text, reason: `${failed.length} leaves failed twice in this phase — propose a NEW angle, not a retry` });
    } else if (leaves.length && leaves.every((l) => l.status === 'done' || l.status === 'failed') && phase.status !== 'done') {
      triggers.push({ phase: phase.text, reason: 'all leaves resolved — close the phase or open a new angle' });
    }
  }
  if (phases.every((p) => p.status === 'done')) {
    triggers.push({ phase: '(mission)', reason: 'plan tree complete — propose a new goal decomposition from the dossier' });
  }
  return triggers;
}

const MARK = { done: '[x]', active: '[>]', pending: '[ ]', failed: '[!]' };

/** Compact checklist rendering for the planning prompt. */
export function renderPlanTree(huntId, { budgetChars = 1800 } = {}) {
  const d = getDb();
  if (!d) return '';
  const hid = String(huntId);
  const goal = d.prepare("SELECT * FROM plan_nodes WHERE hunt_id = ? AND kind = 'goal'").get(hid);
  if (!goal) return '';
  const lines = ['\n--- PLAN TREE (code-owned: phases advance on validator outcomes; you fill only the next leaf) ---', `GOAL: ${goal.text}`];
  for (const phase of getPhases(hid)) {
    lines.push(`${MARK[phase.status] || '[ ]'} ${phase.text}${phase.status === 'active' ? ' (active)' : ''}`);
    for (const leaf of getLeaves(hid, phase.id)) {
      const suffix = leaf.status === 'done' ? ' — VERIFIED' : leaf.status === 'failed' ? ` — failed ×${leaf.fail_count} (parked)` : '';
      lines.push(`  - ${MARK[leaf.status] || '[ ]'} ${leaf.text}${suffix}`);
    }
  }
  for (const t of getReplanTriggers(hid)) {
    lines.push(`⚠ RE-PLAN (${t.phase}): ${t.reason}.`);
  }
  let out = '';
  for (const l of lines) {
    if (out.length + l.length + 1 > budgetChars) break;
    out += (out ? '\n' : '') + l;
  }
  return out;
}
