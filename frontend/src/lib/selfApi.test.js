// Self (Hunter Self) API client tests (14 Nov 2026).
//
// Pins the frontend↔backend contract from the scout: endpoint paths and
// bodies, the AI-consent gate (consent:false is sent verbatim — never
// auto-approved, never defaulted to true), and the tolerant normalizers
// (categories array, flat checks array, object/array run state, and the
// short-result cap — never a raw dump).
// Run with plain node --test; fetch + localStorage are stubbed here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Vite resolves extensionless relative imports ('../config'); Node ESM
// does not — register the local resolve hook before importing selfApi.js.
register('./node-test-hooks.mjs', import.meta.url);

// localStorage is touched by getAuthToken() on every request.
globalThis.localStorage = {
  getItem: (key) => (key === 'dm_token' ? 'tok-test' : ''),
  setItem: () => {},
  removeItem: () => {},
};

let lastCall = null;
let nextBody = {};
let nextStatus = 200;
const okJson = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
globalThis.fetch = async (url, init) => {
  lastCall = {
    url,
    method: init && init.method,
    body: init && init.body ? JSON.parse(init.body) : undefined,
    auth: init && init.headers ? init.headers.Authorization : undefined,
  };
  return okJson(nextBody, nextStatus);
};

const {
  getSelfChecklist,
  createSelfRun,
  getSelfRun,
  runSelfCheck,
  runSelfCategory,
  runSelfAll,
  submitSelfAiConsent,
  normalizeChecklist,
  normalizeRun,
  normalizeCheckResult,
  checkVerdict,
  shortResult,
} = await import('./selfApi.js');

const API = 'https://api.thebhavesh.online/api/v1/self';

test('createSelfRun posts target + confirmedAuthorized:true with the JWT', async () => {
  nextBody = { id: 'self_1', phase: 'predefined' };
  nextStatus = 201;
  const res = await createSelfRun('https://example.com');
  assert.equal(lastCall.url, `${API}/runs`);
  assert.equal(lastCall.method, 'POST');
  assert.equal(lastCall.body.target, 'https://example.com');
  assert.equal(lastCall.body.confirmedAuthorized, true);
  assert.equal(lastCall.auth, 'Bearer tok-test');
  assert.equal(res.ok, true);
});

test('endpoint paths: checklist, run fetch, check, category, run-all', async () => {
  nextBody = { categories: [] };
  nextStatus = 200;
  await getSelfChecklist();
  assert.equal(lastCall.url, `${API}/checklist`);
  assert.equal(lastCall.method, 'GET');

  await getSelfRun('self_1');
  assert.equal(lastCall.url, `${API}/runs/self_1`);

  await runSelfCheck('self_1', 'REC-01');
  assert.equal(lastCall.url, `${API}/runs/self_1/checks/REC-01/run`);
  assert.equal(lastCall.method, 'POST');

  await runSelfCategory('self_1', 'recon');
  assert.equal(lastCall.url, `${API}/runs/self_1/run-category`);
  assert.equal(lastCall.body.category, 'recon');

  await runSelfAll('self_1');
  assert.equal(lastCall.url, `${API}/runs/self_1/run-all`);
});

test('AI gate: consent:false is sent verbatim, consent:true only when asked', async () => {
  nextBody = { id: 'self_1', aiConsent: false, phase: 'done' };
  nextStatus = 200;
  await submitSelfAiConsent('self_1', false);
  assert.equal(lastCall.url, `${API}/runs/self_1/ai-consent`);
  assert.equal(lastCall.body.consent, false);

  await submitSelfAiConsent('self_1', true);
  assert.equal(lastCall.body.consent, true);

  // Anything that is not an explicit true is false — no truthy default.
  await submitSelfAiConsent('self_1', undefined);
  assert.equal(lastCall.body.consent, false);
});

test('a failed run passes the error through', async () => {
  globalThis.fetch = async (url, init) => {
    lastCall = { url, method: init && init.method, body: init && init.body ? JSON.parse(init.body) : undefined };
    return { ok: false, status: 401, json: async () => ({ error: 'unauthorized', message: 'Login required' }) };
  };
  const res = await createSelfRun('https://example.com');
  assert.equal(res.ok, false);
  assert.equal(res.status, 401);
  assert.equal(res.error, 'Login required');
});

test('normalizeChecklist: categories shape, kinds, counts', () => {
  const out = normalizeChecklist({
    categories: [
      { id: 'recon', name: 'Reconnaissance', checks: [
        { id: 'REC-01', name: 'Subdomain Enumeration', kind: 'rule-based' },
        { id: 'REC-02', name: 'DNS Record Analysis' },
      ] },
      { id: 'a01', name: 'A01 Broken Access Control', checks: [
        { id: 'AUTHZ-01', name: 'IDOR', kind: 'ai' },
      ] },
    ],
  });
  assert.equal(out.totalChecks, 3);
  assert.equal(out.categories.length, 2);
  assert.equal(out.categories[0].checks[1].kind, 'rule-based');
  assert.equal(out.categories[1].checks[0].kind, 'ai');
});

test('normalizeChecklist: flat checks group by sheet, A11-A16 duplicates kept once', () => {
  const out = normalizeChecklist({
    checks: [
      { id: 'INJ-04', name: 'Reflected XSS', category: 'A05 Injection' },
      { id: 'INJ-04', name: 'Reflected XSS', category: 'A14 XSS' },
      { id: 'REC-01', name: 'Subdomain Enumeration', sheet: 'Reconnaissance' },
    ],
  });
  assert.equal(out.totalChecks, 2);
  assert.equal(out.categories.length, 2);
  assert.equal(out.categories[0].name, 'A05 Injection');
  // The A14 duplicate row is dropped — the check lives under A05 only.
  assert.equal(out.categories.some((c) => c.name === 'A14 XSS'), false);
});

test('normalizeRun: object-map and array check state, phase + aiConsent', () => {
  const fromMap = normalizeRun({
    id: 'self_1', target: 'https://example.com', phase: 'awaiting-ai-consent', aiConsent: null,
    checks: { 'REC-01': { status: 'yes', findings: ['sub.example.com'] } },
  });
  assert.equal(fromMap.phase, 'awaiting-ai-consent');
  assert.equal(fromMap.aiConsent, null);
  assert.equal(checkVerdict(fromMap.checks['REC-01']), 'yes');

  const fromArray = normalizeRun({
    runId: 'self_2', status: 'done', aiConsent: false,
    results: [{ checkId: 'REC-01', verdict: 'no' }, { id: 'REC-02', status: 'skipped' }],
  });
  assert.equal(fromArray.id, 'self_2');
  assert.equal(fromArray.aiConsent, false);
  assert.equal(checkVerdict(fromArray.checks['REC-01']), 'no');
  assert.equal(checkVerdict(fromArray.checks['REC-02']), 'skipped');
  assert.equal(checkVerdict(undefined), null);
});

test('shortResult: caps findings + evidence at 5, clips long lines, never dumps raw', () => {
  const out = shortResult({
    counts: { findings: 42, hosts: 9 },
    findings: Array.from({ length: 12 }, (_, i) => `finding-${i}`),
    evidence: ['a'.repeat(300), 'line-2'],
    summary: 'ignored when findings exist',
  });
  assert.deepEqual(out.counts, { findings: 42, hosts: 9 });
  assert.equal(out.topFindings.length, 5);
  assert.equal(out.evidence.length, 2);
  assert.ok(out.evidence[0].length <= 160);
  assert.equal(out.topFindings[0], 'finding-0');
  assert.equal('raw' in out, false);
});

test('normalizeChecklist: LIVE backend shape — metadata categories + flat checks', () => {
  // The exact shape GET /api/v1/self/checklist returns (verified 14 Nov
  // 2026): categories are {code, sheet, title, checks:<count>} metadata,
  // checks are a flat array with `category` as the code. Before the
  // merge fix this normalised to 0 categories / 0 checks (empty page).
  const out = normalizeChecklist({
    ok: true,
    categories: [
      { code: 'REC', sheet: 'Reconnaissance', title: 'Reconnaissance', checks: 15 },
      { code: 'A01', sheet: 'A01 Broken Access Control', title: 'Broken Access Control', checks: 72 },
      { code: 'A11', sheet: 'A11 SSRF', title: 'SSRF (focused view)', checks: 0 },
    ],
    checks: [
      { id: 'REC-01', category: 'REC', name: 'Subdomain Enumeration', kind: 'rule-based' },
      { id: 'REC-05', category: 'REC', name: 'Technology Fingerprinting', kind: 'rule-based' },
      { id: 'AUTHZ-01', category: 'A01', name: 'Insecure Direct Object Reference (IDOR)', kind: 'rule-based' },
    ],
    counts: { total: 3, ruleBased: 3, ai: 0 },
  });
  assert.equal(out.totalChecks, 3);
  assert.equal(out.categories.length, 2);
  // Category id IS the backend code, so run-category sends 'REC'/'A01'.
  assert.equal(out.categories[0].id, 'REC');
  assert.equal(out.categories[0].name, 'Reconnaissance');
  assert.equal(out.categories[0].checks.length, 2);
  assert.equal(out.categories[1].id, 'A01');
  assert.equal(out.categories[1].name, 'Broken Access Control');
  // A11 carries no checks in the flat array and is dropped, not rendered empty.
  assert.equal(out.categories.some((c) => c.id === 'A11'), false);
});

test('normalizeCheckResult: backend verdict beats completion status', () => {
  // runCheck returns status 'done' + verdict 'yes'|'no'. A finished
  // check whose tools ran clean (verdict 'no') must display No, not Yes.
  assert.equal(normalizeCheckResult({ status: 'done', verdict: 'no' }).status, 'no');
  assert.equal(normalizeCheckResult({ status: 'done', verdict: 'yes' }).status, 'yes');
  assert.equal(normalizeCheckResult({ status: 'partial', verdict: 'no' }).status, 'no');
  assert.equal(normalizeCheckResult({ status: 'blocked', verdict: 'unknown' }).status, 'blocked');
  // No verdict at all: the 'done' fallback still means Yes (old behaviour).
  assert.equal(checkVerdict(normalizeCheckResult({ status: 'done' })), 'yes');
  assert.equal(checkVerdict(normalizeCheckResult({ status: 'done', verdict: 'no' })), 'no');
});

test('normalizeRun: live backend {ok, run} envelope + array check state', () => {
  // POST/GET /runs return {ok:true, run:{...}} — before the merge fix
  // normalizeRun returned null for this envelope (page: "cannot read").
  const fromEnvelope = normalizeRun({
    ok: true,
    run: {
      id: 'self_ca0a3507c1f15ac2', target: 'http://172.17.0.1:3100',
      phase: 'predefined', aiConsent: null,
      checks: [
        { checkId: 'REC-01', status: 'done', verdict: 'no', summary: 'clean' },
        { checkId: 'REC-05', status: 'done', verdict: 'yes', summary: 'headers missing' },
      ],
    },
  });
  assert.equal(fromEnvelope.id, 'self_ca0a3507c1f15ac2');
  assert.equal(fromEnvelope.phase, 'predefined');
  assert.equal(fromEnvelope.aiConsent, null);
  assert.equal(checkVerdict(fromEnvelope.checks['REC-01']), 'no');
  assert.equal(checkVerdict(fromEnvelope.checks['REC-05']), 'yes');
});
