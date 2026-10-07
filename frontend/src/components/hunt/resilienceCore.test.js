/**
 * resilienceCore.test.js — Forge wave 10, ideas 50361–50400.
 * Run: node --test frontend/src/components/hunt/resilienceCore.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESILIENCE_STATE_IDEAS,
  formatBytes,
  formatRetryCountdown,
  clockLabel,
  compareVersions,
  makeErrorId,
  buildDiagnosticsText,
  offlineQueueLabel,
  timelineGapLabel,
  diffLinesToView,
  diffSummary,
  staleIndexMessage,
  buildFilterConflictMessage,
  summarizeBulkResult,
  aggregateCsvErrors,
  detectTimezoneMismatch,
  reconnectDelayMs,
  diskQuotaAdvice,
  shareLinkStatus,
  duplicateHuntMessage,
  parseRegexError,
} from './resilienceCore.js';

test('registry covers all 34 resilience ideas 50361–50394', () => {
  assert.equal(RESILIENCE_STATE_IDEAS.length, 34);
  assert.equal(RESILIENCE_STATE_IDEAS[0].idea, 50361);
  assert.equal(RESILIENCE_STATE_IDEAS[33].idea, 50394);
  const nums = RESILIENCE_STATE_IDEAS.map((e) => e.idea);
  assert.deepEqual(nums, Array.from({ length: 34 }, (_, i) => 50361 + i));
});

test('formatBytes scales units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
});

test('formatRetryCountdown renders mm:ss', () => {
  assert.equal(formatRetryCountdown(90000), '01:30');
  assert.equal(formatRetryCountdown(0), '00:00');
  assert.equal(formatRetryCountdown(-500), '00:00');
});

test('clockLabel formats HH:MM', () => {
  assert.match(clockLabel(new Date(2026, 9, 7, 14, 2).getTime()), /^\d{2}:\d{2}$/);
  assert.equal(clockLabel('not-a-date'), '??:??');
});

test('compareVersions detects backend drift', () => {
  const r = compareVersions('2.4.0', '2.3.1');
  assert.equal(r.drift, true);
  assert.equal(r.behind, 'backend');
  assert.match(r.message, /needs backend ≥2\.4/);
});

test('compareVersions detects frontend drift', () => {
  const r = compareVersions('2.3.0', '2.5.0');
  assert.equal(r.drift, true);
  assert.equal(r.behind, 'frontend');
});

test('compareVersions is quiet when in sync', () => {
  const r = compareVersions('2.4.0', '2.4.7');
  assert.equal(r.drift, false);
  assert.equal(r.message, '');
});

test('makeErrorId is unique and prefixed', () => {
  const a = makeErrorId();
  const b = makeErrorId();
  assert.ok(a.startsWith('ERR-'));
  assert.notEqual(a, b);
});

test('buildDiagnosticsText includes all fields', () => {
  const t = buildDiagnosticsText({ errorId: 'ERR-1', route: '/api/hunt', statusCode: 500 });
  assert.match(t, /ERR-1/);
  assert.match(t, /\/api\/hunt/);
  assert.match(t, /500/);
});

test('offlineQueueLabel pluralizes', () => {
  assert.equal(offlineQueueLabel(0), 'Queue is empty — nothing waiting to sync.');
  assert.equal(offlineQueueLabel(1), "1 action will sync when you're back online.");
  assert.equal(offlineQueueLabel(3), "3 actions will sync when you're back online.");
});

test('timelineGapLabel names the missing window', () => {
  const label = timelineGapLabel({
    gapStart: new Date(2026, 9, 7, 14, 2).getTime(),
    gapEnd: new Date(2026, 9, 7, 14, 7).getTime(),
  });
  assert.match(label, /^events missing \d{2}:\d{2}–\d{2}:\d{2}$/);
});

test('diffLinesToView aligns expected vs actual', () => {
  const rows = diffLinesToView('a\nb\nc', 'a\nB');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].same, true);
  assert.equal(rows[1].same, false);
  assert.equal(rows[1].expected, 'b');
  assert.equal(rows[1].actual, 'B');
  assert.equal(rows[2].actual, '');
});

test('diffSummary counts changed lines', () => {
  assert.equal(diffSummary(diffLinesToView('a\nb', 'a\nc')), '1 of 2 lines differ');
  assert.equal(diffSummary(diffLinesToView('a', 'a')), '0 of 1 line differ');
});

test('staleIndexMessage handles fresh and stale', () => {
  assert.match(staleIndexMessage(0), /fresh/);
  assert.equal(staleIndexMessage(5), 'Results may be up to 5 min old.');
});

test('buildFilterConflictMessage names the conflict', () => {
  const m = buildFilterConflictMessage({
    filters: ['critical', 'informational'],
    conflictingPair: ['severity:critical', 'severity:informational'],
    suggestion: 'Drop one severity filter.',
  });
  assert.match(m.detail, /contradict/);
  assert.equal(m.suggestion, 'Drop one severity filter.');
});

test('summarizeBulkResult reports X of Y — Z failed', () => {
  const s = summarizeBulkResult([
    { id: '1', label: 'Finding 1', ok: true },
    { id: '2', label: 'Finding 2', ok: false, reason: 'Locked by owner' },
    { id: '3', label: 'Finding 3', ok: false },
  ]);
  assert.equal(s.headline, '1 of 3 updated — 2 failed');
  assert.equal(s.failures.length, 2);
  assert.equal(s.failures[0].reason, 'Locked by owner');
  assert.equal(s.failures[1].reason, 'Unknown error');
});

test('aggregateCsvErrors groups and builds a report', () => {
  const a = aggregateCsvErrors([
    { row: 2, column: 'target', value: 'htp://x', message: 'Invalid URL' },
    { row: 5, column: 'target', value: '', message: 'Missing value' },
  ], 'targets.csv');
  assert.equal(a.count, 2);
  assert.equal(a.byColumn.target, 2);
  assert.match(a.reportText, /targets\.csv/);
  assert.match(a.reportText, /Row 2, column "target"/);
});

test('detectTimezoneMismatch flags drift only', () => {
  const hit = detectTimezoneMismatch({ userTimezone: 'Asia/Kolkata', detectedTimezone: 'UTC' });
  assert.equal(hit.mismatched, true);
  assert.match(hit.message, /Asia\/Kolkata/);
  assert.equal(detectTimezoneMismatch({ userTimezone: 'UTC', detectedTimezone: 'UTC' }).mismatched, false);
});

test('reconnectDelayMs backs off exponentially, capped', () => {
  assert.equal(reconnectDelayMs(0), 2000);
  assert.equal(reconnectDelayMs(2), 8000);
  assert.equal(reconnectDelayMs(99), 60000);
});

test('diskQuotaAdvice names the biggest consumer', () => {
  const a = diskQuotaAdvice({
    usedBytes: 9 * 1024 ** 3,
    quotaBytes: 10 * 1024 ** 3,
    breakdown: [
      { label: 'Screenshots', bytes: 6 * 1024 ** 3 },
      { label: 'Reports', bytes: 2 * 1024 ** 3 },
    ],
  });
  assert.equal(a.pct, 90);
  assert.equal(a.biggest.label, 'Screenshots');
  assert.match(a.message, /90% full/);
});

test('shareLinkStatus detects expiry', () => {
  const past = shareLinkStatus({ expiresAt: '2020-01-01T00:00:00Z', now: Date.now() });
  assert.equal(past.expired, true);
  assert.match(past.message, /expired/);
  const future = shareLinkStatus({ expiresAt: '2099-01-01T00:00:00Z', now: Date.now() });
  assert.equal(future.expired, false);
});

test('duplicateHuntMessage references the existing hunt', () => {
  const m = duplicateHuntMessage({ existingHunt: { title: 'Shop scan', target: 'shop.example.com' } });
  assert.match(m.detail, /Shop scan/);
  assert.match(m.detail, /shop\.example\.com/);
});

test('parseRegexError extracts pattern and reason', () => {
  const p = parseRegexError(new Error('Invalid regular expression: /(/: Unterminated group'));
  assert.equal(p.pattern, '/(/');
  assert.match(p.reason, /Unterminated group/);
  const withPos = parseRegexError('Invalid regex at position 4: bad quantifier');
  assert.equal(withPos.position, 4);
});
