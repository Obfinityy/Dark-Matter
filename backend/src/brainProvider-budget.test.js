// API-budget enforcement tests (#365, gaps 2 + 3).
// Env is set BEFORE importing brainProvider: small ceilings so the
// caps are hit fast. DATA_DIR points at a temp dir so the real
// store functions never touch live hunts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-budget-'));
process.env.DATA_DIR = tmpRoot;
process.env.API_MAX_TOKENS_PER_REQUEST = '2000';
process.env.API_MAX_REQUESTS_PER_HUNT = '3';
process.env.API_MAX_REQUESTS_PER_HOUR = '2';
process.env.API_MAX_SPEND_USD_PER_HUNT = '1.00';
process.env.API_REQUEST_TIMEOUT_MS = '50';
delete process.env.META_API_KEY;
delete process.env.OPENROUTER_API_KEY;

const {
  API_BUDGET_DEFAULTS,
  callBrain,
  callChatMeta,
  callMetaModel,
  checkApiBudget,
  listBrainModels,
  noteApiRequest,
  resetApiUsage,
  setBrainModel,
} = await import('./brainProvider.js');
const { readHuntMeta, writeHuntMeta, readHuntEvents } = await import('./store.js');

let huntSeq = 0;
const freshHunt = () => `h_budget_${++huntSeq}`;
const switches = (h) => readHuntEvents(h).filter((e) => e.type === 'model_switch');

async function withKeys(keys, fn) {
  const prev = {};
  for (const k of Object.keys(keys)) {
    prev[k] = process.env[k];
    if (keys[k] === undefined) delete process.env[k];
    else process.env[k] = keys[k];
  }
  try {
    await fn();
  } finally {
    for (const k of Object.keys(keys)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test('budget ceilings load from env', () => {
  assert.equal(API_BUDGET_DEFAULTS.maxTokensPerRequest, 2000);
  assert.equal(API_BUDGET_DEFAULTS.maxRequestsPerHunt, 3);
  assert.equal(API_BUDGET_DEFAULTS.maxRequestsPerHour, 2);
  assert.equal(API_BUDGET_DEFAULTS.maxSpendUsdPerHunt, 1);
  assert.equal(API_BUDGET_DEFAULTS.requestTimeoutMs, 50);
});

test('setBrainModel refuses OpenRouter without a key, accepts it with one', async () => {
  const HUNT = freshHunt();
  await withKeys({ OPENROUTER_API_KEY: undefined }, async () => {
    const refused = setBrainModel(HUNT, 'openrouter-free', { manual: true });
    assert.equal(refused.ok, false);
    assert.equal(refused.error, 'openrouter_unavailable');
  });
  await withKeys({ OPENROUTER_API_KEY: 'or-test-key' }, async () => {
    const allowed = setBrainModel(HUNT, 'openrouter-free', { manual: true });
    assert.equal(allowed.ok, true);
    assert.equal(allowed.brain.selected, 'openrouter-free');
  });
});

test('listBrainModels reports OpenRouter availability from the key', async () => {
  await withKeys({ OPENROUTER_API_KEY: undefined }, async () => {
    assert.equal(listBrainModels().find((m) => m.id === 'openrouter-free').available, false);
  });
  await withKeys({ OPENROUTER_API_KEY: 'or-test-key' }, async () => {
    assert.equal(listBrainModels().find((m) => m.id === 'openrouter-free').available, true);
  });
});

test('checkApiBudget enforces the spend ceiling and fails closed on cost errors', () => {
  const HUNT = freshHunt();
  assert.equal(checkApiBudget(HUNT, { getCost: () => ({ totalUsd: 0.5 }) }).ok, true);
  const over = checkApiBudget(HUNT, { getCost: () => ({ totalUsd: 2.0 }) });
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'api_budget_spend');
  const broken = checkApiBudget(HUNT, { getCost: () => { throw new Error('corrupt'); } });
  assert.equal(broken.ok, false);
  assert.equal(broken.reason, 'api_budget_cost_store');
  const free = checkApiBudget(null, { getCost: () => { throw new Error('must not be read'); } });
  assert.equal(free.ok, true, 'hunt-less callers skip the counted ceilings');
});

test('checkApiBudget enforces per-hunt and per-hour caps, and the hour window resets', () => {
  const HUNT = freshHunt();
  const noSpend = { getCost: () => ({ totalUsd: 0 }) };
  noteApiRequest(HUNT, { now: 1000 });
  noteApiRequest(HUNT, { now: 2000 });
  const hourHit = checkApiBudget(HUNT, { ...noSpend, now: 3000 });
  assert.equal(hourHit.ok, false);
  assert.equal(hourHit.reason, 'api_budget_hour');
  const reset = checkApiBudget(HUNT, { ...noSpend, now: 1000 + 3600001 });
  assert.equal(reset.ok, true, 'a new hour window lifts the hourly cap');
  noteApiRequest(HUNT, { now: 1000 + 3600002 });
  const huntHit = checkApiBudget(HUNT, { ...noSpend, now: 1000 + 3600003 });
  assert.equal(huntHit.ok, false);
  assert.equal(huntHit.reason, 'api_budget_hunt', '3 total requests hit the per-hunt cap');
  resetApiUsage();
});

test('callMetaModel clamps max_tokens to the ceiling', async () => {
  await withKeys({ META_API_KEY: 'meta-test-key' }, async () => {
    let seenBody = null;
    const fetchOk = async (url, opts) => {
      seenBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'hello' } }], usage: {} }) };
    };
    const res = await callMetaModel([{ role: 'user', text: 'hi' }], 'sys', {}, { model: 'muse-spark-1.3', maxTokens: 5000, fetchFn: fetchOk });
    assert.equal(res.ok, true);
    assert.equal(seenBody.max_tokens, 2000, '5000 requested, 2000 ceiling enforced');
  });
});

test('callMetaModel clamps the timeout to the ceiling', async () => {
  await withKeys({ META_API_KEY: 'meta-test-key' }, async () => {
    const fetchSlow = (url, opts) => new Promise((resolve, reject) => {
      const signal = opts.signal;
      if (signal) signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' })));
      setTimeout(() => resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'late' } }] }) }), 200);
    });
    const res = await callMetaModel([{ role: 'user', text: 'hi' }], 'sys', {}, { model: 'muse-spark-1.3', timeoutMs: 60000, fetchFn: fetchSlow });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'timeout', '60s requested but the 50ms ceiling aborts first');
  });
});

test('callBrain gates a Meta attempt once the per-hunt cap is hit', async () => {
  await withKeys({ META_API_KEY: 'meta-test-key' }, async () => {
    const HUNT = freshHunt();
    const switched = setBrainModel(HUNT, 'muse-spark-1.3', { manual: true });
    assert.equal(switched.ok, true);
    noteApiRequest(HUNT);
    noteApiRequest(HUNT);
    noteApiRequest(HUNT);
    let metaCalls = 0;
    const eightCalls = [];
    const reply = await callBrain([{ role: 'user', text: 'hi' }], 'sys', { huntId: HUNT }, {
      huntId: HUNT,
      chatFn: async () => { eightCalls.push(1); return '8B-ANSWER'; },
      metaFn: async () => { metaCalls++; return { ok: true, text: 'META-ANSWER' }; },
    });
    assert.equal(reply, '8B-ANSWER');
    assert.equal(metaCalls, 0, 'gated attempt never reaches Meta');
    assert.equal(eightCalls.length, 1);
    const gated = switches(HUNT).filter((e) => e.reason === 'api_budget_hunt');
    assert.equal(gated.length, 1);
    resetApiUsage();
  });
});

test('callChatMeta returns null once the per-hunt cap is hit', async () => {
  await withKeys({ META_API_KEY: 'meta-test-key' }, async () => {
    const HUNT = freshHunt();
    noteApiRequest(HUNT);
    noteApiRequest(HUNT);
    noteApiRequest(HUNT);
    const reply = await callChatMeta([{ role: 'user', text: 'hi' }], 'sys', { huntId: HUNT }, {});
    assert.equal(reply, null, 'gated chat falls back to the caller\'s deterministic record');
    resetApiUsage();
  });
});
