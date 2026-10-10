import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectRedocScalarUis,
  analyzeDocUiResponse,
  classifyDocUiResponses,
  API_DOC_SURFACE_RECON,
} from './apiDocSurfaceRecon.js';

// ---------- Idea 01201: ReDoc and Scalar UI detection ----------

test('01201: detectRedocScalarUis builds probes for all three doc UIs', () => {
  const plan = detectRedocScalarUis('https://api.example.com');
  assert.equal(plan.idea, '01201');
  const uis = new Set(plan.probes.map((p) => p.ui));
  assert.ok(uis.has('ReDoc') && uis.has('Scalar') && uis.has('Stoplight Elements'));
  assert.ok(plan.probes.every((p) => p.method === 'GET' && p.url.startsWith('https://api.example.com')));
});

test('01201: analyzeDocUiResponse flags exposed ReDoc page', () => {
  const { probes } = detectRedocScalarUis('https://api.example.com');
  const probe = probes.find((p) => p.ui === 'ReDoc');
  const finding = analyzeDocUiResponse(probe, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: '<html><head></head><body><redoc spec-url="/openapi.json"></redoc><script src="redoc-standalone@2.0.0.js"></script></body></html>',
  });
  assert.equal(finding.verdict, 'exposed');
  assert.equal(finding.idea, '01201');
  assert.ok(finding.confidence >= 0.85);
  assert.ok(finding.evidence.length > 0);
});

test('01201: analyzeDocUiResponse flags exposed Scalar UI', () => {
  const { probes } = detectRedocScalarUis('https://api.example.com');
  const probe = probes.find((p) => p.ui === 'Scalar');
  const finding = analyzeDocUiResponse(probe, {
    status: 200,
    headers: { 'content-type': 'text/html' },
    body: '<div id="api-reference"></div><script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>',
  });
  assert.equal(finding.verdict, 'exposed');
});

test('01201: analyzeDocUiResponse reports 404 as not-exposed', () => {
  const { probes } = detectRedocScalarUis('https://api.example.com');
  const finding = analyzeDocUiResponse(probes[0], { status: 404, headers: {}, body: 'Not Found' });
  assert.equal(finding.verdict, 'not-exposed');
});

test('01201: analyzeDocUiResponse reports 401 as not-exposed', () => {
  const { probes } = detectRedocScalarUis('https://api.example.com');
  const finding = analyzeDocUiResponse(probes[0], { status: 401, headers: {}, body: 'Unauthorized' });
  assert.equal(finding.verdict, 'not-exposed');
});

test('01201: classifyDocUiResponses keeps deterministic order and shape', () => {
  const { probes } = detectRedocScalarUis('https://api.example.com');
  const pairs = probes.slice(0, 3).map((probe) => ({
    probe,
    response: { status: 404, headers: {}, body: '' },
  }));
  const findings = classifyDocUiResponses(pairs);
  assert.equal(findings.length, 3);
  for (const f of findings) {
    assert.ok(['exposed', 'not-exposed', 'uncertain'].includes(f.verdict));
    assert.ok(typeof f.confidence === 'number' && f.confidence >= 0 && f.confidence <= 1);
    assert.ok(Array.isArray(f.evidence));
    assert.ok(typeof f.note === 'string' && f.note.length > 0);
  }
});

test('01201: registry exposes builder and analyzer', () => {
  assert.equal(typeof API_DOC_SURFACE_RECON['01201'].build, 'function');
  assert.equal(typeof API_DOC_SURFACE_RECON['01201'].analyze, 'function');
});
