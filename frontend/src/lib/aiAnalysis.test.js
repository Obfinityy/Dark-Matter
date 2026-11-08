// AI behaviour-analysis frontend guard tests (owner idea, 8 Nov 2026).
//
// Pure helpers only — the auto-call trigger rule and the response
// normalizer. No network, no React. Run with plain node --test
// (no frontend runner exists in this repo).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAiAnalysis, shouldAutoAnalyze } from './aiAnalysis.js';

// --- trigger rule ----------------------------------------------------------

test('fires once for a finished scanner hunt', () => {
  assert.equal(shouldAutoAnalyze({ isScanner: true, status: 'finished', huntId: 'h_1', attemptedHuntIds: new Set() }), true);
  assert.equal(shouldAutoAnalyze({ isScanner: true, status: 'done', huntId: 'h_1', attemptedHuntIds: new Set() }), true);
});

test('never fires for a running/paused scanner hunt', () => {
  for (const status of ['running', 'paused', 'stopped', 'starting', 'unknown']) {
    assert.equal(shouldAutoAnalyze({ isScanner: true, status, huntId: 'h_1', attemptedHuntIds: new Set() }), false);
  }
});

test('never fires for an AI hunt, even when finished', () => {
  assert.equal(shouldAutoAnalyze({ isScanner: false, status: 'finished', huntId: 'h_1', attemptedHuntIds: new Set() }), false);
});

test('never fires twice for the same huntId in one session', () => {
  const attempted = new Set(['h_1']);
  assert.equal(shouldAutoAnalyze({ isScanner: true, status: 'finished', huntId: 'h_1', attemptedHuntIds: attempted }), false);
  assert.equal(shouldAutoAnalyze({ isScanner: true, status: 'finished', huntId: 'h_2', attemptedHuntIds: attempted }), true);
});

test('missing huntId never fires', () => {
  assert.equal(shouldAutoAnalyze({ isScanner: true, status: 'finished', huntId: null, attemptedHuntIds: new Set() }), false);
});

// --- response normalizer ---------------------------------------------------

test('ok envelope normalizes to ready with suggestions', () => {
  const r = normalizeAiAnalysis({
    ok: true,
    stored: false,
    analysis: {
      status: 'ok',
      provider: 'meta',
      suggestions: [{ title: 'New lead', class: 'xss', severity: 'high', reasoning: 'r', verification: 'v', verified: false }],
    },
  });
  assert.equal(r.state, 'ready');
  assert.equal(r.suggestions.length, 1);
  assert.equal(r.suggestions[0].verified, false);
  assert.equal(r.error, null);
});

test('ai-unavailable envelope normalizes to unavailable with the reason', () => {
  const r = normalizeAiAnalysis({
    ok: true,
    analysis: { status: 'ai-unavailable', suggestions: [], error: 'Meta AI unavailable (http_401)' },
  });
  assert.equal(r.state, 'unavailable');
  assert.deepEqual(r.suggestions, []);
  assert.match(r.error, /http_401/);
});

test('garbage normalizes to error, never throws', () => {
  assert.doesNotThrow(() => normalizeAiAnalysis(null));
  assert.doesNotThrow(() => normalizeAiAnalysis('junk'));
  assert.equal(normalizeAiAnalysis(null).state, 'error');
  assert.equal(normalizeAiAnalysis({}).state, 'error');
});
