// COST TRACKER tests (BUDGET CAP lane, 27 Oct 2026).
//
// The budget cap reads per-hunt spend from here, so Meta spend must
// price correctly (it was recorded as $0 before this lane: recordCost
// only priced kind 'bedrock'). Env is set BEFORE importing the
// module (DATA_DIR points at a temp dir).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cost-tracker-'));
process.env.DATA_DIR = tmpRoot;

const { recordCost, getHuntCost, getUserCosts, modelCostUsd, MODEL_PRICING } = await import('./costTracker.js');

test('MODEL_PRICING carries the Meta Spark rates', () => {
  assert.deepEqual(MODEL_PRICING['muse-spark-1.3'], { input: 1.25, output: 4.25 });
  assert.deepEqual(MODEL_PRICING['muse-spark-1.3-contributor'], { input: 0.1, output: 0.2 });
});

test('modelCostUsd prices Bedrock exactly as before', () => {
  // Sonnet: 1M in + 1M out = $3 + $15.
  assert.equal(modelCostUsd('anthropic.claude-3-5-sonnet-20241022-v2:0', 1_000_000, 1_000_000), 18);
  // Unknown model still falls back to the Sonnet default.
  assert.equal(modelCostUsd('no-such-model', 1_000_000, 0), 3);
});

test('recordCost prices kind meta and splits it out in getHuntCost', () => {
  const huntId = 'h_cost_meta';
  recordCost({ userId: 'u1', huntId, kind: 'meta', model: 'muse-spark-1.3', inputTokens: 4000, outputTokens: 2000 });
  const c = getHuntCost(huntId);
  // 4000/1e6*1.25 + 2000/1e6*4.25 = 0.005 + 0.0085 = 0.0135.
  assert.equal(c.totalUsd, 0.0135);
  assert.equal(c.metaUsd, 0.0135);
  assert.equal(c.bedrockUsd, 0);
  assert.equal(c.ec2Usd, 0);
  assert.equal(c.events, 1);
});

test('recordCost keeps bedrock + meta separate per hunt', () => {
  const huntId = 'h_cost_mixed';
  recordCost({ userId: 'u1', huntId, kind: 'bedrock', model: 'amazon.nova-micro-v1:0', inputTokens: 1_000_000, outputTokens: 0 });
  recordCost({ userId: 'u1', huntId, kind: 'meta', model: 'muse-spark-1.3-contributor', inputTokens: 1_000_000, outputTokens: 0 });
  const c = getHuntCost(huntId);
  assert.equal(c.bedrockUsd, 0.035);
  assert.equal(c.metaUsd, 0.1);
  assert.equal(c.totalUsd, 0.135);
});

test('recordCost with an explicit amountUsd still works (ec2/ollama kinds)', () => {
  const huntId = 'h_cost_explicit';
  recordCost({ userId: 'u1', huntId, kind: 'ec2', amountUsd: 0.5, note: 'hourly' });
  const c = getHuntCost(huntId);
  assert.equal(c.totalUsd, 0.5);
  assert.equal(c.ec2Usd, 0.5);
  assert.equal(c.metaUsd, 0);
});

test('getUserCosts totals meta spend across hunts', () => {
  const u = getUserCosts('u1');
  // h_cost_meta 0.0135 + h_cost_mixed 0.1 + h_cost_explicit 0 (no meta).
  assert.equal(u.metaUsd, 0.1135);
  assert.ok(u.totalUsd > u.metaUsd);
});
