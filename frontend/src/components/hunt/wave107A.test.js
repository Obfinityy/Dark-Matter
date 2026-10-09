/**
 * Wave 107A tests — change lifecycle management (ideas 54241-54250).
 * Run: node --test frontend/src/components/hunt/wave107A.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const corePath = join(here, 'wave107ACore.js');
const jsxPath = join(here, 'Wave107A.jsx');
const cssPath = join(here, 'Wave107.css');

import {
  WAVE107_A_IDEAS,
  createBaseline,
  compareToBaseline,
  scheduleRebaseline,
  addIgnoreRule,
  isChangeIgnored,
  routeForApproval,
  triageTicket,
  queueHuntOnChange,
  addAnnotation,
  getAnnotations,
  compareScreenshots,
  screenshotDiffSummary,
  buildWebhookPayload,
  parseWebhookDelivery,
  applyRetentionPolicy,
  evidenceExpiry,
  isEvidenceExpired,
  bulkReview,
} from './wave107ACore.js';

const EXPECTED_TITLES = {
  54241: 'Baseline snapshot management',
  54242: 'Scheduled re-baselining',
  54243: 'Ignore list for noisy changes',
  54244: 'Change approval workflow (targets)',
  54245: 'Change-triggered hunts (targets)',
  54246: 'Change annotations',
  54247: 'Change comparison screenshots',
  54248: 'Change webhooks and API',
  54249: 'Change retention policy',
  54250: 'Bulk change review',
};

/* ---------- idea registry ---------- */
test('WAVE107_A_IDEAS has exactly 10 entries, ids 54241-54250, titles matching the idea bank', () => {
  assert.equal(WAVE107_A_IDEAS.length, 10);
  const ids = WAVE107_A_IDEAS.map((i) => i.id);
  for (let id = 54241; id <= 54250; id += 1) {
    assert.ok(ids.includes(id), `missing id ${id}`);
  }
  for (const idea of WAVE107_A_IDEAS) {
    assert.equal(idea.title, EXPECTED_TITLES[idea.id], `title mismatch for ${idea.id}`);
  }
});

/* ---------- 54241 baseline ---------- */
test('54241: createBaseline + compareToBaseline detect changed keys', () => {
  const b = createBaseline({ targetId: 't1', label: 'rel', state: { title: 'a', endpoint: '/x' } });
  assert.equal(b.id, 'baseline:t1:rel');
  const diff = compareToBaseline(b, { title: 'b', endpoint: '/x' });
  assert.equal(diff.changedCount, 1);
  assert.equal(diff.changed[0].key, 'title');
  assert.equal(diff.changed[0].before, 'a');
  assert.equal(diff.changed[0].after, 'b');
});

test('54241: compareToBaseline reports no changes when state identical', () => {
  const b = createBaseline({ targetId: 't1', label: 'rel', state: { title: 'a' } });
  assert.equal(compareToBaseline(b, { title: 'a' }).changedCount, 0);
});

/* ---------- 54242 scheduled re-baselining ---------- */
test('54242: scheduleRebaseline flags eligibility after N quiet days', () => {
  const r = scheduleRebaseline({ baseline: { createdAt: '2026-09-01T00:00:00.000Z' }, quietDays: 9, thresholdDays: 7 });
  assert.equal(r.shouldRebaseline, true);
  assert.equal(r.nextEligibleAt, null);
  const r2 = scheduleRebaseline({ baseline: { createdAt: '2026-09-01T00:00:00.000Z' }, quietDays: 3, thresholdDays: 7 });
  assert.equal(r2.shouldRebaseline, false);
  assert.ok(r2.nextEligibleAt);
});

/* ---------- 54243 ignore list ---------- */
test('54243: addIgnoreRule + isChangeIgnored mute noisy patterns with reason codes', () => {
  let rules = addIgnoreRule([], { pattern: 'csrf-token', reason: 'rotating-token' });
  assert.equal(rules.length, 1);
  assert.equal(rules[0].reason, 'rotating-token');
  assert.equal(isChangeIgnored(rules, { key: 'csrf-token', after: 'tok_x9' }), true);
  assert.equal(isChangeIgnored(rules, { key: 'title', after: 'New Title' }), false);
});

/* ---------- 54244 approval workflow ---------- */
test('54244: routeForApproval routes high/critical, triageTicket decides outcome', () => {
  const routed = routeForApproval({ id: 'c1', targetId: 't1', severity: 'high' }, { t1: 'owner@example.com' });
  assert.equal(routed.routed, true);
  assert.equal(routed.owner, 'owner@example.com');
  assert.deepEqual(routed.ticket.options, ['acknowledge', 'investigate']);
  const done = triageTicket(routed.ticket, 'investigate');
  assert.equal(done.status, 'investigating');
  const low = routeForApproval({ id: 'c2', targetId: 't1', severity: 'low' }, {});
  assert.equal(low.routed, false);
  assert.equal(low.action, 'auto-acknowledge');
});

/* ---------- 54245 change-triggered hunts ---------- */
test('54245: queueHuntOnChange queues focused hunt for high-interest change', () => {
  const hunt = queueHuntOnChange({ id: 'c9', targetId: 't1', key: 'new-endpoint', severity: 'high' }, { id: 't1' });
  assert.ok(hunt);
  assert.equal(hunt.triggerChangeId, 'c9');
  assert.equal(hunt.priority, 'p1');
  const none = queueHuntOnChange({ id: 'c8', targetId: 't1', key: 'title', severity: 'low' }, { id: 't1' });
  assert.equal(none, null);
});

/* ---------- 54246 annotations ---------- */
test('54246: addAnnotation + getAnnotations store analyst notes per change', () => {
  let notes = addAnnotation([], { changeId: 'c1', author: 'ana', note: 'Planned deploy' });
  notes = addAnnotation(notes, { changeId: 'c2', author: 'ana', note: 'other' });
  assert.equal(getAnnotations(notes, 'c1').length, 1);
  assert.equal(getAnnotations(notes, 'c1')[0].note, 'Planned deploy');
});

/* ---------- 54247 screenshots ---------- */
test('54247: compareScreenshots builds side-by-side pair; summary flags missing halves', () => {
  const pair = compareScreenshots({ changeId: 'c1', beforeUrl: 'a.png', afterUrl: 'b.png' });
  assert.equal(pair.layout, 'side-by-side');
  assert.deepEqual(screenshotDiffSummary(pair), { changeId: 'c1', complete: true, missing: [] });
  const incomplete = { changeId: 'c1', before: { url: 'a.png' }, after: { url: null } };
  assert.equal(screenshotDiffSummary(incomplete).complete, false);
  assert.deepEqual(screenshotDiffSummary(incomplete).missing, ['after']);
});

/* ---------- 54248 webhooks ---------- */
test('54248: buildWebhookPayload emits structured Infinity AI event; delivery parser ok', () => {
  const p = buildWebhookPayload(
    { id: 'c1', targetId: 't1', key: 'new-endpoint', severity: 'high', before: null, after: '/x' },
    { id: 't1', name: 'Acme' }
  );
  assert.equal(p.event, 'change.detected');
  assert.equal(p.provider, 'Infinity AI');
  assert.equal(p.change.id, 'c1');
  assert.equal(p.target.name, 'Acme');
  assert.deepEqual(parseWebhookDelivery(202), { delivered: true, status: 202, nextRetry: null });
  assert.equal(parseWebhookDelivery(503).delivered, false);
});

/* ---------- 54249 retention policy ---------- */
test('54249: applyRetentionPolicy computes days; expiry and expired checks work', () => {
  const policy = applyRetentionPolicy({ clientId: 'acme', program: 'main', amount: 2, unit: 'weeks' });
  assert.equal(policy.days, 14);
  const expiry = evidenceExpiry('2026-09-01T00:00:00.000Z', policy);
  assert.equal(expiry, '2026-09-15T00:00:00.000Z');
  assert.equal(isEvidenceExpired('2026-09-01T00:00:00.000Z', policy, new Date('2026-10-10T00:00:00.000Z')), true);
  assert.equal(isEvidenceExpired('2026-10-01T00:00:00.000Z', policy, new Date('2026-10-10T00:00:00.000Z')), false);
});

/* ---------- 54250 bulk review ---------- */
test('54250: bulkReview acknowledges and snoozes only selected changes', () => {
  const changes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const ack = bulkReview(changes, ['a', 'b'], 'acknowledge');
  assert.deepEqual(ack.counts, { acknowledged: 2, snoozed: 0, skipped: 1 });
  assert.equal(ack.results.length, 2);
  assert.equal(ack.results[0].status, 'acknowledged');
  const snooze = bulkReview(changes, ['c'], 'snooze', { snoozedUntil: '2026-10-17T00:00:00.000Z' });
  assert.deepEqual(snooze.counts, { acknowledged: 0, snoozed: 1, skipped: 2 });
  assert.equal(snooze.results[0].snoozedUntil, '2026-10-17T00:00:00.000Z');
});

/* ---------- file existence ---------- */
test('all 4 deliverable files exist', () => {
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave107A.test.js')]) {
    assert.ok(existsSync(p), `missing file: ${p}`);
  }
});

/* ---------- branding ---------- */
test('no branding leak: forbidden brand string appears in none of the wave 107A files', () => {
  const forbidden = 'Mu' + 'se'; // built without the literal string in source
  for (const p of [corePath, jsxPath, cssPath, join(here, 'wave107A.test.js')]) {
    const text = readFileSync(p, 'utf8');
    assert.ok(!text.includes(forbidden), `forbidden brand string found in ${p}`);
  }
});
