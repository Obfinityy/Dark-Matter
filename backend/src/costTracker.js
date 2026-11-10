// Dark Matter — cost / burn tracker.
//
// Records every dollar burnt: Bedrock tokens, Meta Model API tokens
// (per model pricing) and an optional EC2 hourly rate for the hunt
// engine. Backs the "money burnt" display in the UI — per hunt and
// lifetime total. The per-hunt totals are what the budget cap
// (budgetCap.js) compares against the user's budget.
//
// Storage: JSON file under DATA_DIR (same durability story as hunts).

import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './store.js';
import { atomicWriteJson } from './atomicWrite.js';

// USD per 1M tokens — update when a provider changes pricing.
// Meta Spark 1.3 (Standard): $1.25 in / $4.25 out; contributor tier
// $0.10 in / $0.20 out (public Meta rate card, Sep 2026).
const MODEL_PRICING = {
  'anthropic.claude-3-5-sonnet-20241022-v2:0': { input: 3.0, output: 15.0 },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': { input: 3.0, output: 15.0 },
  'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.25, output: 1.25 },
  'amazon.nova-micro-v1:0': { input: 0.035, output: 0.14 },
  'amazon.nova-lite-v1:0': { input: 0.06, output: 0.24 },
  'amazon.nova-pro-v1:0': { input: 0.8, output: 3.2 },
  'muse-spark-1.3': { input: 1.25, output: 4.25 },
  'muse-spark-1.3-contributor': { input: 0.1, output: 0.2 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 }; // assume Sonnet if unknown

function costFile() {
  return path.join(dataDir(), 'costs.json');
}

function backupFile() {
  return path.join(dataDir(), 'costs.bak.json');
}

function parseCosts(raw) {
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.entries)) throw new Error('bad costs shape');
  return data;
}

function readCosts() {
  // Missing main file = first run, not corruption.
  let mainRaw = null;
  try { mainRaw = fs.readFileSync(costFile(), 'utf8'); } catch { mainRaw = null; }
  if (mainRaw !== null) {
    try { return parseCosts(mainRaw); } catch { /* corrupt main: try backup */ }
  }
  // Main missing (first run) or corrupt: fall back to the previous-good
  // backup, so a torn/corrupt write never resets spend to $0 (#328).
  try {
    const bakRaw = fs.readFileSync(backupFile(), 'utf8');
    return parseCosts(bakRaw);
  } catch { /* no usable backup */ }
  if (mainRaw !== null) {
    // Main existed but is corrupt AND no usable backup: true data loss.
    // Never silently return $0 — the caller (budget check) fails closed.
    throw new Error('costs store unreadable: main corrupt, no usable backup');
  }
  return { entries: [] };
}

function writeCosts(data) {
  const dir = path.dirname(costFile());
  fs.mkdirSync(dir, { recursive: true });
  // Rotate first: the previous good main becomes the backup BEFORE the
  // new main lands, so a crash mid-write can never leave both corrupt.
  try {
    if (fs.existsSync(costFile())) fs.renameSync(costFile(), backupFile());
  } catch { /* rotation is best-effort; the atomic write below still lands */ }
  atomicWriteJson(costFile(), data);
}

export function modelCostUsd(model, inputTokens, outputTokens) {
  const p = MODEL_PRICING[model] || DEFAULT_PRICING;
  return ((inputTokens || 0) / 1e6) * p.input + ((outputTokens || 0) / 1e6) * p.output;
}

/**
 * Record a spend event. Token-priced kinds ('bedrock', 'meta') price
 * from MODEL_PRICING; other kinds carry an explicit amountUsd.
 * @param {{userId, huntId?, kind: 'bedrock'|'meta'|'ec2'|'ollama', model?, inputTokens?, outputTokens?, amountUsd?, note?}} evt
 */
export function recordCost(evt) {
  const data = readCosts();
  let amountUsd = evt.amountUsd;
  if (evt.kind === 'bedrock' || evt.kind === 'meta') {
    amountUsd = modelCostUsd(evt.model, evt.inputTokens, evt.outputTokens);
  }
  data.entries.push({
    ts: new Date().toISOString(),
    userId: evt.userId || null,
    huntId: evt.huntId || null,
    kind: evt.kind,
    model: evt.model || null,
    inputTokens: evt.inputTokens || 0,
    outputTokens: evt.outputTokens || 0,
    amountUsd: Number((amountUsd || 0).toFixed(6)),
    note: evt.note || null,
  });
  // Keep the file bounded — last 50k entries.
  if (data.entries.length > 50000) data.entries = data.entries.slice(-50000);
  writeCosts(data);
  return amountUsd;
}

/**
 * Record a cost event without ever breaking the caller: a failure in the
 * ledger (missing dir, corrupt file, disk error) is warned about once and
 * swallowed. This is the one place the nested `try { console.warn(...) }
 * catch {}` pattern lives — the llm/brain call sites used to repeat it.
 * @param {() => unknown} record - the recordCost call (with its argument
 *   computation, which is part of the guarded region) to attempt.
 */
export function recordCostSafe(record) {
  try {
    record();
  } catch (e) {
    try { console.warn('[cost] recordCost failed:', (e && e.message) || e); } catch {}
    /* cost tracking must never break chat */
  }
}

function sumFor(entries) {
  return Number(entries.reduce((s, e) => s + (e.amountUsd || 0), 0).toFixed(4));
}

export function getUserCosts(userId) {
  const data = readCosts();
  const mine = data.entries.filter((e) => !userId || e.userId === userId);
  const byHunt = {};
  for (const e of mine) {
    if (!e.huntId) continue;
    byHunt[e.huntId] = (byHunt[e.huntId] || 0) + (e.amountUsd || 0);
  }
  const bedrock = sumFor(mine.filter((e) => e.kind === 'bedrock'));
  const meta = sumFor(mine.filter((e) => e.kind === 'meta'));
  const ec2 = sumFor(mine.filter((e) => e.kind === 'ec2'));
  return {
    totalUsd: sumFor(mine),
    bedrockUsd: bedrock,
    metaUsd: meta,
    ec2Usd: ec2,
    hunts: Object.fromEntries(
      Object.entries(byHunt).map(([k, v]) => [k, Number(v.toFixed(4))]),
    ),
    events: mine.length,
  };
}

export function getHuntCost(huntId) {
  const data = readCosts();
  const mine = data.entries.filter((e) => e.huntId === huntId);
  return {
    huntId,
    totalUsd: sumFor(mine),
    bedrockUsd: sumFor(mine.filter((e) => e.kind === 'bedrock')),
    metaUsd: sumFor(mine.filter((e) => e.kind === 'meta')),
    ec2Usd: sumFor(mine.filter((e) => e.kind === 'ec2')),
    events: mine.length,
  };
}

export { MODEL_PRICING };
