/**
 * wave9.test.js — Forge wave 9, ideas 50321–50360.
 *
 * Node-runnable checks (pure logic + registry honesty + export presence).
 * Run: node --test frontend/src/components/hunt/wave9.test.js
 * (Must be run from repo root; resolves via relative paths.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const core = await import('./errorCore.js');

// EmptyStates.jsx / ErrorStates.jsx import CSS (not node-importable),
// so parse their registries from source instead of executing them.
function extractIdeas(src, varName) {
  const block = src.match(new RegExp(`export const ${varName} = \\[([\\s\\S]*?)\\];`));
  assert.ok(block, `${varName} registry not found in source`);
  return [...block[1].matchAll(/\{\s*idea:\s*(\d+),\s*name:\s*'([^']+)'\s*\}/g)].map(
    (m) => ({ idea: Number(m[1]), name: m[2] })
  );
}

const emptySrc = fs.readFileSync(path.join(here, 'EmptyStates.jsx'), 'utf8');
const errorSrc = fs.readFileSync(path.join(here, 'ErrorStates.jsx'), 'utf8');
const EMPTY_STATE_IDEAS = extractIdeas(emptySrc, 'EMPTY_STATE_IDEAS');
const ERROR_STATE_IDEAS = extractIdeas(errorSrc, 'ERROR_STATE_IDEAS');

/* ---------- registry completeness: all 40 wave-9 ideas covered ---------- */

test('all ideas 50321-50360 are registered exactly once', () => {
  const all = [...EMPTY_STATE_IDEAS, ...ERROR_STATE_IDEAS];
  const inRange = all.filter((e) => e.idea >= 50321 && e.idea <= 50360);
  assert.equal(inRange.length, 40, `expected 40 wave-9 ideas, got ${inRange.length}`);
  const ids = inRange.map((e) => e.idea).sort((a, b) => a - b);
  for (let i = 0; i < 40; i++) {
    assert.equal(ids[i], 50321 + i, `idea ${50321 + i} missing or duplicated`);
  }
});

test('50321-50340 live in EmptyStates.jsx, 50341-50360 in ErrorStates.jsx', () => {
  const emptyIds = EMPTY_STATE_IDEAS.filter((e) => e.idea >= 50321 && e.idea <= 50360).map((e) => e.idea).sort((a, b) => a - b);
  const errorIds = ERROR_STATE_IDEAS.filter((e) => e.idea >= 50341 && e.idea <= 50360).map((e) => e.idea).sort((a, b) => a - b);
  assert.equal(emptyIds.length, 20);
  assert.equal(errorIds.length, 20);
  assert.equal(emptyIds[0], 50321);
  assert.equal(emptyIds[19], 50340);
  assert.equal(errorIds[0], 50341);
  assert.equal(errorIds[19], 50360);
});

test('every wave-9 named component is exported in its source file', () => {
  const emptyNames = EMPTY_STATE_IDEAS.filter((e) => e.idea >= 50321).map((e) => e.name);
  const errorNames = ERROR_STATE_IDEAS.map((e) => e.name);
  for (const n of emptyNames) {
    assert.match(emptySrc, new RegExp(`export function ${n}\\b`), `EmptyStates.jsx missing export ${n}`);
  }
  for (const n of errorNames) {
    assert.match(errorSrc, new RegExp(`export function ${n}\\b`), `ErrorStates.jsx missing export ${n}`);
  }
});

test('no component is a dead shell — each ErrorStates component takes CTA props', () => {
  const noProps = ['InlineUrlValidation', 'AgentStallError'].map(
    (n) => new RegExp(`export function ${n}\\({ [a-zA-Z, ]* }\\)`)
  );
  assert.ok(noProps[0].test(errorSrc), 'InlineUrlValidation export shape drifted');
  assert.ok(noProps[1].test(errorSrc), 'AgentStallError export shape drifted');
});

/* ---------- errorCore logic ------------------------------------------- */

test('formatBytes', () => {
  assert.equal(core.formatBytes(0), '0 B');
  assert.equal(core.formatBytes(512), '512 B');
  assert.equal(core.formatBytes(1536), '1.5 KB');
  assert.equal(core.formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(core.formatBytes(2.5 * 1024 ** 3), '2.5 GB');
  assert.equal(core.formatBytes(-1), '0 B');
});

test('formatCountdown', () => {
  assert.equal(core.formatCountdown(60000), '01:00');
  assert.equal(core.formatCountdown(84000), '01:24');
  assert.equal(core.formatCountdown(500), '00:01');
  assert.equal(core.formatCountdown(-100), '00:00');
});

test('buildHuntFailureBanner', () => {
  const b = core.buildHuntFailureBanner({ stepName: 'SQL injection scan', errorExcerpt: 'ECONNRESET at line 1', huntId: 'h-1' });
  assert.match(b.title, /SQL injection scan/);
  assert.match(b.excerpt, /ECONNRESET/);
  assert.match(b.checkpointHint, /h-1/);
  const b2 = core.buildHuntFailureBanner({});
  assert.match(b2.title, /unknown step/);
});

test('partialFailureMessage', () => {
  assert.equal(core.partialFailureMessage({ failed: 3, total: 40 }), '3 of 40 checks failed — findings still valid');
});

test('quotaExceededMessage', () => {
  const m = core.quotaExceededMessage({ quotaName: 'Monthly hunts', resetsAt: '2026-11-01T00:00:00Z' });
  assert.match(m.title, /Monthly hunts/);
  assert.match(m.detail, /Resets/);
});

test('validateTargetUrl', () => {
  assert.equal(core.validateTargetUrl('').ok, false);
  assert.equal(core.validateTargetUrl('www.example.com').ok, false);
  assert.match(core.validateTargetUrl('www.example.com').example, /https:\/\/www/);
  assert.equal(core.validateTargetUrl('not a url').ok, false);
  assert.equal(core.validateTargetUrl('https://example.com').ok, true);
  assert.ok(core.validateTargetUrl('http://example.com').warning);
});

test('scopeViolationMessage', () => {
  const m = core.scopeViolationMessage({ target: 'evil.com', matchedRule: 'allow *.corp.com only' });
  assert.match(m.title, /out of authorized scope/);
  assert.match(m.detail, /allow \*\.corp\.com only/);
});

test('agentStallState', () => {
  const now = Date.now();
  const fresh = core.agentStallState({ lastProgressAt: now - 60 * 1000, now });
  assert.equal(fresh.stalled, false);
  const stalled = core.agentStallState({ lastProgressAt: now - 11 * 60 * 1000, now });
  assert.equal(stalled.stalled, true);
  assert.ok(stalled.message);
  assert.equal(stalled.idleMinutes, 11);
});

test('mapSsoError', () => {
  const r = core.mapSsoError('redirect_uri_mismatch');
  assert.equal(r.fixKnown, true);
  assert.match(r.detail, /redirect URL/i);
  const a = core.mapSsoError('access_denied');
  assert.match(a.detail, /consent/i);
  const u = core.mapSsoError('weird_code_999');
  assert.equal(u.fixKnown, false);
  assert.match(u.detail, /weird_code_999/);
});

test('uploadTooLargeMessage', () => {
  const m = core.uploadTooLargeMessage({ sizeBytes: 12 * 1024 * 1024, limitBytes: 10 * 1024 * 1024 });
  assert.match(m.detail, /12\.0 MB/);
  assert.match(m.detail, /10\.0 MB/);
});

test('storageFullWarning', () => {
  const m = core.storageFullWarning({ usedBytes: 950 * 1024 * 1024, quotaBytes: 1024 * 1024 * 1024 });
  assert.equal(m.pct, 93);
  assert.match(m.detail, /Clean up/);
});

test('errorCore exports all ERROR_STATE_IDEAS entries', () => {
  assert.equal(core.ERROR_STATE_IDEAS.length, 20);
  assert.equal(core.ERROR_STATE_IDEAS[0].idea, 50341);
  assert.equal(core.ERROR_STATE_IDEAS[19].idea, 50360);
});
