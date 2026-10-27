// BUDGET CAP lane (27 Oct 2026, owner order) — per-hunt spend budget.
//
//   parseBudgetUsd: validates what the user typed (number > 0, or null/0
//     to clear); checkBudget: the loop-top gate — at/above budget the
//     hunt pauses with a checkpoint + a budget_reached event, never stops.
//
// The lab for this lane (backend/scripts/lab-budget-cap.mjs) runs the
// real checkBudget against a temp DATA_DIR + a booted backend, with
// MOCKED Meta spend only — no live api.meta.ai call, no credit burn.
//
// Env is set BEFORE importing the modules (DATA_DIR points at a temp
// dir so the real store functions never touch live hunts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-cap-'));
process.env.DATA_DIR = tmpRoot;

const { parseBudgetUsd, checkBudget, BUDGET_MAX_USD } = await import('./budgetCap.js');
const { recordCost, getHuntCost, modelCostUsd } = await import('./costTracker.js');

// --- checkBudget with stub deps: no store touched --------------------------
function stubDeps({ budgetUsd = null, pausedReason = null, spentUsd = 0 } = {}) {
  const meta = { huntId: 'h_stub', budgetUsd, pausedReason };
  const writes = [];
  const thinks = [];
  const events = [];
  return {
    meta,
    writes,
    thinks,
    events,
    deps: {
      readMeta: () => ({ ...meta }),
      getCost: () => ({ totalUsd: spentUsd }),
      writeMeta: (h, patch) => {
        writes.push(patch);
        Object.assign(meta, patch);
      },
      thinkFn: (h, t) => thinks.push(t),
      recordFn: (h, ev) => events.push(ev),
    },
  };
}

test('parseBudgetUsd accepts a plain number and a numeric string', () => {
  assert.deepEqual(parseBudgetUsd(10), { ok: true, budgetUsd: 10 });
  assert.deepEqual(parseBudgetUsd('10'), { ok: true, budgetUsd: 10 });
  assert.deepEqual(parseBudgetUsd(10.005), { ok: true, budgetUsd: 10.01 });
  assert.deepEqual(parseBudgetUsd(BUDGET_MAX_USD), { ok: true, budgetUsd: BUDGET_MAX_USD });
});

test('parseBudgetUsd clears on null/0/empty', () => {
  assert.deepEqual(parseBudgetUsd(null), { ok: true, budgetUsd: null });
  assert.deepEqual(parseBudgetUsd(undefined), { ok: true, budgetUsd: null });
  assert.deepEqual(parseBudgetUsd(''), { ok: true, budgetUsd: null });
  assert.deepEqual(parseBudgetUsd(0), { ok: true, budgetUsd: null });
  assert.deepEqual(parseBudgetUsd('0'), { ok: true, budgetUsd: null });
});

test('parseBudgetUsd rejects negatives, junk and over the ceiling', () => {
  assert.equal(parseBudgetUsd(-5).ok, false);
  assert.equal(parseBudgetUsd('abc').ok, false);
  assert.equal(parseBudgetUsd(NaN).ok, false);
  assert.equal(parseBudgetUsd(BUDGET_MAX_USD + 1).ok, false);
  assert.equal(parseBudgetUsd({}).ok, false);
});

test('checkBudget passes with no budget set and writes nothing', () => {
  const s = stubDeps({});
  assert.equal(checkBudget('h_stub', s.deps), true);
  assert.equal(s.writes.length, 0);
  assert.equal(s.events.length, 0);
});

test('checkBudget passes below the budget', () => {
  const s = stubDeps({ budgetUsd: 10, spentUsd: 5 });
  assert.equal(checkBudget('h_stub', s.deps), true);
  assert.equal(s.writes.length, 0);
  assert.equal(s.events.length, 0);
});

test('checkBudget pauses AT the budget (not only above it)', () => {
  const s = stubDeps({ budgetUsd: 10, spentUsd: 10 });
  assert.equal(checkBudget('h_stub', s.deps), false);
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0].state, 'paused');
  assert.equal(s.writes[0].paused, true);
  assert.equal(s.writes[0].pausedReason, 'budget_reached');
  assert.equal(s.events.length, 1);
  assert.equal(s.events[0].type, 'status');
  assert.equal(s.events[0].reason, 'budget_reached');
  assert.equal(s.events[0].budgetUsd, 10);
  assert.equal(s.events[0].spentUsd, 10);
  assert.match(s.thinks[0], /Budget reached/);
});

test('checkBudget pauses above the budget', () => {
  const s = stubDeps({ budgetUsd: 10, spentUsd: 12.5 });
  assert.equal(checkBudget('h_stub', s.deps), false);
  assert.equal(s.events[0].spentUsd, 12.5);
});

test('checkBudget re-pauses on resume while the budget still stands', () => {
  const s = stubDeps({ budgetUsd: 10, spentUsd: 10, pausedReason: 'budget_reached' });
  // First call: already paused — the check still fires (resume clears
  // the flags, the loop re-checks, the budget still stands).
  assert.equal(checkBudget('h_stub', s.deps), false);
  assert.equal(s.events.length, 1);
  assert.equal(s.events[0].reason, 'budget_reached');
});

test('checkBudget clears a stale budget_reached reason once under budget', () => {
  const s = stubDeps({ budgetUsd: 10, spentUsd: 5, pausedReason: 'budget_reached' });
  assert.equal(checkBudget('h_stub', s.deps), true);
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0].pausedReason, null);
});

test('checkBudget fails open on a store read error', () => {
  const s = stubDeps({ budgetUsd: 10, spentUsd: 99 });
  s.deps.readMeta = () => {
    throw new Error('disk gone');
  };
  assert.equal(checkBudget('h_stub', s.deps), true);
  assert.equal(s.events.length, 0);
});

// --- Meta pricing math (the numbers the owner was quoted) ------------------
test('Meta pricing: a typical cycle costs ~$0.007 (Standard)', () => {
  // Typical cycle: 2,000 input + 1,000 output tokens on muse-spark-1.3.
  const cost = modelCostUsd('muse-spark-1.3', 2000, 1000);
  assert.ok(Math.abs(cost - 0.00675) < 1e-9, `expected 0.00675, got ${cost}`);
});

test('Meta pricing: contributor tier is ~$0.0004 a cycle', () => {
  const cost = modelCostUsd('muse-spark-1.3-contributor', 2000, 1000);
  assert.ok(Math.abs(cost - 0.0004) < 1e-9, `expected 0.0004, got ${cost}`);
});

test('Meta pricing: $10 buys ~1,400 typical cycles', () => {
  const perCycle = modelCostUsd('muse-spark-1.3', 2000, 1000);
  const cycles = Math.floor(10 / perCycle);
  assert.ok(cycles >= 1400 && cycles <= 1500, `expected ~1481, got ${cycles}`);
});

// --- recordCost prices Meta spend into the real store -----------------------
test('recordCost prices kind meta from MODEL_PRICING into getHuntCost', () => {
  const huntId = 'h_meta_cost';
  recordCost({ userId: 'u1', huntId, kind: 'meta', model: 'muse-spark-1.3', inputTokens: 2000, outputTokens: 1000, note: 'meta-model-api' });
  recordCost({ userId: 'u1', huntId, kind: 'meta', model: 'muse-spark-1.3', inputTokens: 2000, outputTokens: 1000, note: 'meta-model-api' });
  const c = getHuntCost(huntId);
  // Two cycles at $0.00675 = $0.0135 (totals round to 4dp).
  assert.equal(c.totalUsd, 0.0135);
  assert.equal(c.metaUsd, 0.0135);
  assert.equal(c.bedrockUsd, 0);
  assert.equal(c.events, 2);
});

test('checkBudget reads the real store: recorded Meta spend trips the cap', async () => {
  const { writeHuntMeta, readHuntMeta, readHuntEvents } = await import('./store.js');
  const { checkBudget: realCheck } = await import('./budgetCap.js');
  const huntId = 'h_real_store';
  writeHuntMeta(huntId, { huntId, target: 'https://example.com', state: 'running', iteration: 42, budgetUsd: 0.01 });
  recordCost({ userId: 'u1', huntId, kind: 'meta', model: 'muse-spark-1.3', inputTokens: 2000, outputTokens: 1000 });
  recordCost({ userId: 'u1', huntId, kind: 'meta', model: 'muse-spark-1.3', inputTokens: 2000, outputTokens: 1000 });
  // Spent $0.0135 >= $0.01 budget -> pause, checkpoint kept (iteration 42).
  assert.equal(realCheck(huntId), false);
  const meta = readHuntMeta(huntId);
  assert.equal(meta.state, 'paused');
  assert.equal(meta.paused, true);
  assert.equal(meta.pausedReason, 'budget_reached');
  assert.equal(meta.iteration, 42);
  const evts = readHuntEvents(huntId);
  assert.ok(evts.some((e) => e.type === 'status' && e.reason === 'budget_reached' && e.spentUsd === 0.0135));
});
