// Tests for actionPlan.js — Mission Stage 3: structured action plans.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, fallbackLine } from './actionPlan.js';

test('parsePlan: absent plan is valid null', () => {
  const r = parsePlan(undefined);
  assert.equal(r.valid, true);
  assert.equal(r.plan, null);
  const r2 = parsePlan(null);
  assert.equal(r2.valid, true);
});

test('parsePlan: accepts all fields, trims to max length', () => {
  const r = parsePlan({
    objective: 'log in',
    state: 'on login page',
    expected: 'dashboard',
    risk: 'low',
    fallback: 'retry',
    extra_future_field: 'ignored',
  });
  assert.equal(r.valid, true);
  assert.equal(r.plan.objective, 'log in');
  assert.equal(r.plan.fallback, 'retry');
  assert.equal(r.plan.extra_future_field, undefined);
});

test('parsePlan: truncates overlong fields', () => {
  const r = parsePlan({ objective: 'x'.repeat(600) });
  assert.equal(r.valid, true);
  assert.equal(r.plan.objective.length, 500);
});

test('parsePlan: rejects non-object plan', () => {
  const r = parsePlan('do the thing');
  assert.equal(r.valid, false);
  assert.equal(r.plan, null);
  assert.ok(r.errors.length > 0);
});

test('parsePlan: rejects non-string fields', () => {
  const r = parsePlan({ objective: 42, risk: 'low' });
  assert.equal(r.valid, false);
  assert.equal(r.plan.risk, 'low');
  assert.ok(r.errors.some((e) => e.includes('objective')));
});

test('parsePlan: empty object yields null plan', () => {
  const r = parsePlan({});
  assert.equal(r.valid, true);
  assert.equal(r.plan, null);
});

test('parsePlan: never throws on garbage', () => {
  const r = parsePlan(null);
  assert.equal(r.valid, true);
  const r2 = parsePlan(42);
  assert.equal(r2.valid, false);
});

test('fallbackLine: returns fallback text when present', () => {
  assert.equal(fallbackLine({ fallback: 'retry with re-typed password' }), '[FALLBACK] retry with re-typed password');
});

test('fallbackLine: empty when no fallback', () => {
  assert.equal(fallbackLine(null), '');
  assert.equal(fallbackLine({}), '');
  assert.equal(fallbackLine({ fallback: '  ' }), '');
});
