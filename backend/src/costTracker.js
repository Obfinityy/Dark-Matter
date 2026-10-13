// Dark Matter — cost / burn tracker.
//
// Records every dollar burnt: Bedrock tokens (per model pricing) and an
// optional EC2 hourly rate for the hunt engine. Backs the "money burnt"
// display in the UI — per hunt and lifetime total.
//
// Storage: JSON file under DATA_DIR (same durability story as hunts).

import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './paths.js';

// USD per 1M tokens — update when AWS changes pricing.
const MODEL_PRICING = {
  'anthropic.claude-3-5-sonnet-20241022-v2:0': { input: 3.0, output: 15.0 },
  'anthropic.claude-3-5-sonnet-20240620-v1:0': { input: 3.0, output: 15.0 },
  'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.25, output: 1.25 },
  'amazon.nova-micro-v1:0': { input: 0.035, output: 0.14 },
  'amazon.nova-lite-v1:0': { input: 0.06, output: 0.24 },
  'amazon.nova-pro-v1:0': { input: 0.8, output: 3.2 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 }; // assume Sonnet if unknown

function costFile() {
  return path.join(dataDir(), 'costs.json');
}

function readCosts() {
  try {
    const raw = fs.readFileSync(costFile(), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.entries) ? data : { entries: [] };
  } catch {
    return { entries: [] };
  }
}

function writeCosts(data) {
  fs.mkdirSync(path.dirname(costFile()), { recursive: true });
  fs.writeFileSync(costFile(), JSON.stringify(data, null, 2));
}

export function modelCostUsd(model, inputTokens, outputTokens) {
  const p = MODEL_PRICING[model] || DEFAULT_PRICING;
  return ((inputTokens || 0) / 1e6) * p.input + ((outputTokens || 0) / 1e6) * p.output;
}

/**
 * Record a spend event.
 * @param {{userId, huntId?, kind: 'bedrock'|'ec2', model?, inputTokens?, outputTokens?, amountUsd?, note?}} evt
 */
export function recordCost(evt) {
  const data = readCosts();
  let amountUsd = evt.amountUsd;
  if (evt.kind === 'bedrock') {
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
  const ec2 = sumFor(mine.filter((e) => e.kind === 'ec2'));
  return {
    totalUsd: sumFor(mine),
    bedrockUsd: bedrock,
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
    ec2Usd: sumFor(mine.filter((e) => e.kind === 'ec2')),
    events: mine.length,
  };
}

export { MODEL_PRICING };
