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

// --- api-client wrapper shape (live call site) ---------------------------
// HuntCard passes the post() wrapper { ok, status, data } — NOT the raw
// envelope. The wrapper's `status` is the HTTP status NUMBER (200), so
// reading it as the analysis status always missed 'ok'. These tests pin
// the exact shape the live call site produces (proof #44, 10 Nov 2026:
// the panel showed "jawab nahi mila" while the backend doc held 5 valid
// suggestions, because the wrapper was never unwrapped).

const PROOF44_SUGGESTIONS = [
  { title: 'Reflected XSS on /snippets surface', class: 'xss', severity: 'high', reasoning: 'r1', verification: 'v1', verified: false },
  { title: 'JWT authentication bypass via tampering', class: 'jwt', severity: 'high', reasoning: 'r2', verification: 'v2', verified: false },
  { title: 'Missing cookie security flags', class: 'cookies', severity: 'medium', reasoning: 'r3', verification: 'v3', verified: false },
  { title: 'CSRF on state-changing actions', class: 'csrf', severity: 'medium', reasoning: 'r4', verification: 'v4', verified: false },
  { title: 'User enumeration via login error oracle', class: 'user_enumeration', severity: 'medium', reasoning: 'r5', verification: 'v5', verified: false },
];

test('wrapper shape with ok doc normalizes to ready with all 5 suggestions', () => {
  const r = normalizeAiAnalysis({
    ok: true,
    status: 200,
    data: {
      ok: true,
      stored: true,
      analysis: { status: 'ok', provider: 'meta', model: 'muse-spark-1.3', suggestions: PROOF44_SUGGESTIONS },
    },
  });
  assert.equal(r.state, 'ready');
  assert.equal(r.suggestions.length, 5);
  assert.equal(r.suggestions[0].title, 'Reflected XSS on /snippets surface');
  assert.equal(r.suggestions[1].severity, 'high');
  assert.ok(r.suggestions.every((s) => s.verified === false));
  assert.equal(r.error, null);
});

test('wrapper shape with ai-unavailable doc normalizes to unavailable with the reason', () => {
  const r = normalizeAiAnalysis({
    ok: true,
    status: 200,
    data: { ok: true, stored: false, analysis: { status: 'ai-unavailable', suggestions: [], error: 'Meta AI unavailable (timeout)' } },
  });
  assert.equal(r.state, 'unavailable');
  assert.deepEqual(r.suggestions, []);
  assert.match(r.error, /timeout/);
});

test('wrapper shape holding a raw doc directly normalizes to ready', () => {
  const r = normalizeAiAnalysis({
    ok: true,
    status: 200,
    data: { status: 'ok', suggestions: [{ title: 'New lead', class: 'xss', severity: 'high', reasoning: 'r', verification: 'v', verified: false }] },
  });
  assert.equal(r.state, 'ready');
  assert.equal(r.suggestions.length, 1);
});

test('raw doc shape normalizes to ready', () => {
  const r = normalizeAiAnalysis({
    status: 'ok',
    suggestions: [{ title: 'New lead', class: 'xss', severity: 'high', reasoning: 'r', verification: 'v', verified: false }],
  });
  assert.equal(r.state, 'ready');
  assert.equal(r.suggestions.length, 1);
});

test('wrapper garbage normalizes to error, never throws', () => {
  assert.doesNotThrow(() => normalizeAiAnalysis({ ok: true, status: 200, data: null }));
  assert.doesNotThrow(() => normalizeAiAnalysis({ ok: true, status: 200 }));
  assert.doesNotThrow(() => normalizeAiAnalysis({ ok: false, status: 500, error: 'x', data: { error: 'x' } }));
  assert.equal(normalizeAiAnalysis({ ok: true, status: 200, data: null }).state, 'error');
  assert.equal(normalizeAiAnalysis({ ok: true, status: 200 }).state, 'error');
  assert.equal(normalizeAiAnalysis({ ok: false, status: 500, error: 'x', data: { error: 'x' } }).state, 'error');
});

test('garbage normalizes to error, never throws', () => {
  assert.doesNotThrow(() => normalizeAiAnalysis(null));
  assert.doesNotThrow(() => normalizeAiAnalysis('junk'));
  assert.equal(normalizeAiAnalysis(null).state, 'error');
  assert.equal(normalizeAiAnalysis({}).state, 'error');
});
