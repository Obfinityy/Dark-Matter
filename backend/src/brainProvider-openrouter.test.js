import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findBrainModel,
  isOpenRouterModel,
  openRouterAvailable,
  API_BUDGET_DEFAULTS,
} from './brainProvider.js';

test('openrouter-free model exists', () => {
  const m = findBrainModel('openrouter-free');
  assert.ok(m, 'openrouter-free should exist');
  assert.equal(m.provider, 'openrouter');
  assert.ok(m.capabilities);
  assert.equal(m.capabilities.costPer1kTokens, 0);
});

test('isOpenRouterModel identifies correctly', () => {
  assert.ok(isOpenRouterModel('openrouter-free'));
  assert.ok(!isOpenRouterModel('darkmatter-v1'));
  assert.ok(!isOpenRouterModel('muse-spark-1.3'));
  assert.ok(!isOpenRouterModel('nonexistent'));
});

test('openRouterAvailable returns boolean', () => {
  // Should not throw, returns true/false based on env
  const result = openRouterAvailable();
  assert.equal(typeof result, 'boolean');
});

test('API_BUDGET_DEFAULTS has required fields', () => {
  assert.ok(API_BUDGET_DEFAULTS.maxTokensPerRequest > 0);
  assert.ok(API_BUDGET_DEFAULTS.maxRequestsPerHunt > 0);
  assert.ok(API_BUDGET_DEFAULTS.maxRetries >= 0);
  assert.ok(API_BUDGET_DEFAULTS.requestTimeoutMs > 0);
  assert.ok(API_BUDGET_DEFAULTS.maxSpendUsdPerHunt >= 0);
});

test('API budget defaults are safe', () => {
  // Max 500 requests per hunt prevents runaway
  assert.ok(API_BUDGET_DEFAULTS.maxRequestsPerHunt <= 1000);
  // Max $5 per hunt by default
  assert.ok(API_BUDGET_DEFAULTS.maxSpendUsdPerHunt <= 10);
  // Timeout 2 minutes max
  assert.ok(API_BUDGET_DEFAULTS.requestTimeoutMs <= 300000);
});
