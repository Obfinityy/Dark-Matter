// AI behaviour-analysis service tests (owner idea, 8 Nov 2026).
//
// Stubbed provider only — NO real Meta API calls anywhere. Covers the
// ok path, the ai-unavailable path (dead key: 401), idempotency
// (second POST returns stored, provider called once), the no-bundle
// path, JSON parsing tolerance, and the never-throw contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAiAnalysisPrompt,
  parseAiSuggestions,
  runAiAnalysis,
  validateSuggestion,
} from './aiAnalysis.js';
import { buildBehaviourBundle } from './behaviourBundle.js';

const TARGET = 'http://172.17.0.1:3100';

function bundle() {
  return buildBehaviourBundle({
    huntId: 'h_ai_1',
    target: TARGET,
    findings: [
      {
        title: 'Missing Strict-Transport-Security header',
        class: 'missing_hsts',
        severity: 'low',
        confirmation: 'confirmed',
        url: `${TARGET}/`,
        evidence: { request: 'GET / HTTP/1.1', response: 'HTTP/1.1 200 OK' },
      },
    ],
    phaseOutcomes: [{ name: 'headers', ok: true, skipped: false, findingsCount: 1, durationMs: 3 }],
    fingerprint: { status: 200, server: 'Apache', tech: ['php'], dbHint: null },
  });
}

// In-memory store fake for the seams.
function memoryStore() {
  const files = {};
  return {
    files,
    readBehaviour: () => files.behaviour || null,
    readAnalysis: () => files.aiAnalysis || null,
    writeAnalysis: (doc) => { files.aiAnalysis = doc; },
    setBehaviour: (b) => { files.behaviour = b; },
    setAnalysis: (doc) => { files.aiAnalysis = doc; },
  };
}

// --- prompt ---------------------------------------------------------------

test('prompt carries the bundle and the already-found titles', () => {
  const { system, user, foundTitles } = buildAiAnalysisPrompt(bundle());
  assert.match(system, /NEW vulnerabilities/);
  assert.match(user, /Missing Strict-Transport-Security header/);
  assert.match(user, /172\.17\.0\.1:3100/);
  assert.deepEqual(foundTitles, ['Missing Strict-Transport-Security header']);
});

// --- suggestion parsing ----------------------------------------------------

test('parseAiSuggestions parses a JSON object reply', () => {
  const text = JSON.stringify({
    suggestions: [
      { title: 'Reflected XSS in search param', class: 'xss_reflected', severity: 'high', reasoning: 'error page echoes input', verification: 'Send <script> in q and check reflection' },
      { title: 'Missing Strict-Transport-Security header', class: 'missing_hsts', severity: 'low', reasoning: 'already found', verification: 'n/a' },
    ],
  });
  const { suggestions, parseOk } = parseAiSuggestions(text, ['Missing Strict-Transport-Security header']);
  assert.equal(parseOk, true);
  // The already-found title is dropped; only the NEW one survives.
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].title, 'Reflected XSS in search param');
  assert.equal(suggestions[0].verified, false);
  assert.equal(suggestions[0].severity, 'high');
});

test('parseAiSuggestions tolerates prose-wrapped JSON and bare arrays', () => {
  const wrapped = `Here are my findings:\n${JSON.stringify({ suggestions: [{ title: 'SQL injection in id param', class: 'sqli', severity: 'critical', reasoning: 'r', verification: 'v' }] })}\nHope this helps.`;
  assert.equal(parseAiSuggestions(wrapped).suggestions.length, 1);
  const bare = JSON.stringify([{ title: 'Open redirect on next', class: 'open_redirect', severity: 'medium', reasoning: 'r', verification: 'v' }]);
  assert.equal(parseAiSuggestions(bare).suggestions.length, 1);
  assert.equal(parseAiSuggestions('not json at all').parseOk, false);
  assert.deepEqual(parseAiSuggestions('not json at all').suggestions, []);
});

test('validateSuggestion rejects junk and normalizes severity', () => {
  assert.equal(validateSuggestion(null), null);
  assert.equal(validateSuggestion({ title: 'x' }), null); // too short
  assert.equal(validateSuggestion({ title: 'A real title here', severity: 'CRITICAL' }).severity, 'critical');
  assert.equal(validateSuggestion({ title: 'A real title here', severity: 'bogus' }).severity, 'low');
  assert.equal(validateSuggestion({ title: 'A real title here' }).verified, false);
  assert.equal(validateSuggestion({ title: 'A real title here' }).class, 'ai_suggested');
});

// --- runAiAnalysis ----------------------------------------------------------

test('ok path: stubbed provider suggestions are stored, verified:false', async () => {
  const store = memoryStore();
  store.setBehaviour(bundle());
  let calls = 0;
  const metaCall = async () => {
    calls += 1;
    return {
      ok: true,
      text: JSON.stringify({
        suggestions: [
          { title: 'Session fixation via login', class: 'session_fixation', severity: 'medium', reasoning: 'session id survives login', verification: 'Login twice, compare session ids' },
        ],
      }),
    };
  };
  const r = await runAiAnalysis('h_ai_1', { metaCall, ...store });
  assert.equal(r.ok, true);
  assert.equal(r.stored, false);
  assert.equal(calls, 1);
  assert.equal(r.analysis.status, 'ok');
  assert.equal(r.analysis.provider, 'meta');
  assert.equal(r.analysis.suggestions.length, 1);
  assert.equal(r.analysis.suggestions[0].verified, false);
  // The doc is persisted — a later read finds it.
  assert.deepEqual(store.readAnalysis(), r.analysis);
});

test('ai-unavailable path: provider 401 stores ai-unavailable, no suggestions', async () => {
  const store = memoryStore();
  store.setBehaviour(bundle());
  let calls = 0;
  const metaCall = async () => {
    calls += 1;
    return { ok: false, reason: 'http_401' };
  };
  const r = await runAiAnalysis('h_ai_1', { metaCall, ...store });
  assert.equal(r.ok, true);
  assert.equal(calls, 1);
  assert.equal(r.analysis.status, 'ai-unavailable');
  assert.deepEqual(r.analysis.suggestions, []);
  assert.match(r.analysis.error, /http_401/);
  assert.deepEqual(store.readAnalysis(), r.analysis);
});

test('ai-unavailable path: a throwing provider also degrades, never throws', async () => {
  const store = memoryStore();
  store.setBehaviour(bundle());
  const metaCall = async () => { throw new Error('network down'); };
  const r = await runAiAnalysis('h_ai_1', { metaCall, ...store });
  assert.equal(r.ok, true);
  assert.equal(r.analysis.status, 'ai-unavailable');
});

test('idempotency: second run returns stored, provider called once total', async () => {
  const store = memoryStore();
  store.setBehaviour(bundle());
  let calls = 0;
  const metaCall = async () => {
    calls += 1;
    return { ok: true, text: JSON.stringify({ suggestions: [{ title: 'New lead here', class: 'xss', severity: 'low', reasoning: 'r', verification: 'v' }] }) };
  };
  const first = await runAiAnalysis('h_ai_1', { metaCall, ...store });
  const second = await runAiAnalysis('h_ai_1', { metaCall, ...store });
  assert.equal(calls, 1);
  assert.equal(second.stored, true);
  assert.deepEqual(second.analysis, first.analysis);
});

test('no behaviour bundle: provider is never called', async () => {
  const store = memoryStore(); // no behaviour set
  let calls = 0;
  const metaCall = async () => {
    calls += 1;
    return { ok: true, text: '{}' };
  };
  const r = await runAiAnalysis('h_ai_1', { metaCall, ...store });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'no behaviour bundle yet');
  assert.equal(calls, 0);
});

test('unparseable AI reply stores status ok with zero suggestions + note', async () => {
  const store = memoryStore();
  store.setBehaviour(bundle());
  const metaCall = async () => ({ ok: true, text: 'I found nothing but cannot format JSON' });
  const r = await runAiAnalysis('h_ai_1', { metaCall, ...store });
  assert.equal(r.analysis.status, 'ok');
  assert.deepEqual(r.analysis.suggestions, []);
  assert.match(r.analysis.note, /not valid JSON/);
});
