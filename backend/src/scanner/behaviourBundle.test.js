// AI behaviour-analysis bundle tests (owner idea, 8 Nov 2026).
//
// Caps, truncation, empty-findings hunts, request parsing, phase
// rollup rules, fromScan mapping, and the never-throw contract —
// no live AI, no network, pure functions only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEHAVIOUR_MAX_BUNDLE_BYTES,
  BEHAVIOUR_MAX_EVIDENCE_CHARS,
  BEHAVIOUR_MAX_REQUESTS_PER_FINDING,
  BEHAVIOUR_MAX_TRIGGER_CHARS,
  buildBehaviourBundle,
  buildBehaviourBundleFromScan,
  enforceBundleCap,
  parseRequestLine,
  summarizeEvidence,
  summarizeFingerprint,
  summarizePhases,
} from './behaviourBundle.js';

const TARGET = 'http://172.17.0.1:3100';

function finding(over = {}) {
  return {
    title: 'Missing Strict-Transport-Security header',
    class: 'missing_hsts',
    severity: 'low',
    confirmation: 'confirmed',
    url: `${TARGET}/`,
    evidence: { request: 'GET / HTTP/1.1', response: 'HTTP/1.1 200 OK' },
    ...over,
  };
}

// --- empty hunt ------------------------------------------------------------

test('empty-findings hunt builds a valid bundle with zero counts', () => {
  const b = buildBehaviourBundle({
    huntId: 'h_empty',
    target: TARGET,
    findings: [],
    phaseOutcomes: [],
    fingerprint: null,
  });
  assert.equal(b.version, 1);
  assert.equal(b.huntKind, 'scanner');
  assert.equal(b.huntId, 'h_empty');
  assert.deepEqual(b.findings, []);
  assert.deepEqual(b.summary, {
    confirmed: 0,
    unconfirmed: 0,
    findingsTotal: 0,
    droppedFindings: 0,
    phases: { total: 0, ok: 0, skipped: 0, failed: 0, timedOut: 0 },
  });
  assert.equal(b.fingerprint, null);
});

test('missing input still builds a bundle, never throws', () => {
  assert.doesNotThrow(() => buildBehaviourBundle());
  assert.doesNotThrow(() => buildBehaviourBundle(null));
  assert.doesNotThrow(() => buildBehaviourBundle({ findings: null }));
  const b = buildBehaviourBundle({ findings: [null, 'junk', 42, undefined] });
  assert.equal(b.summary.findingsTotal, 0);
});

// --- per-finding fields ----------------------------------------------------

test('finding entry carries title/class/severity/verified/probe/trigger/evidence/requests', () => {
  const b = buildBehaviourBundle({
    huntId: 'h_1',
    target: TARGET,
    findings: [finding({ probe: 'headers', evidence: { request: 'GET /a?x=1 HTTP/1.1', response: 'HTTP/1.1 200 OK', trigger: 'dm-trigger', detail: 'no hsts header' } })],
    phaseOutcomes: [],
  });
  const f = b.findings[0];
  assert.equal(f.title, 'Missing Strict-Transport-Security header');
  assert.equal(f.class, 'missing_hsts');
  assert.equal(f.severity, 'low');
  assert.equal(f.verified, true);
  assert.equal(f.probe, 'headers');
  assert.equal(f.trigger, 'dm-trigger');
  assert.match(f.evidence, /no hsts header/);
  assert.deepEqual(f.requests, [{ method: 'GET', path: '/a?x=1', status: 200 }]);
});

test('unconfirmed findings stay verified:false', () => {
  const b = buildBehaviourBundle({
    huntId: 'h_2',
    target: TARGET,
    findings: [finding({ confirmation: 'unconfirmed' })],
    phaseOutcomes: [],
  });
  assert.equal(b.findings[0].verified, false);
  assert.equal(b.summary.confirmed, 0);
  assert.equal(b.summary.unconfirmed, 1);
});

// --- caps ------------------------------------------------------------------

test('evidence text is capped at ~2000 chars', () => {
  const big = 'x'.repeat(9000);
  const b = buildBehaviourBundle({
    huntId: 'h_3',
    target: TARGET,
    findings: [finding({ evidence: { detail: big } })],
    phaseOutcomes: [],
  });
  assert.ok(b.findings[0].evidence.length <= BEHAVIOUR_MAX_EVIDENCE_CHARS);
});

test('trigger is capped at ~500 chars', () => {
  const b = buildBehaviourBundle({
    huntId: 'h_4',
    target: TARGET,
    findings: [finding({ trigger: 't'.repeat(3000) })],
    phaseOutcomes: [],
  });
  assert.ok(b.findings[0].trigger.length <= BEHAVIOUR_MAX_TRIGGER_CHARS);
});

test('request sequence is capped at 20 entries per finding', () => {
  const reqs = Array.from({ length: 25 }, (_, i) => `GET /p${i} HTTP/1.1`);
  const { requests } = summarizeEvidence({ requests: reqs });
  assert.equal(requests.length, BEHAVIOUR_MAX_REQUESTS_PER_FINDING);
  assert.equal(requests[0].path, '/p0');
});

test('whole bundle stays under ~100KB even for a huge scan', () => {
  const findings = Array.from({ length: 200 }, (_, i) => finding({
    title: `Finding ${i}`,
    evidence: { detail: 'y'.repeat(8000), request: `POST /big${i} HTTP/1.1`, response: 'HTTP/1.1 200 OK' },
  }));
  const b = buildBehaviourBundle({ huntId: 'h_5', target: TARGET, findings, phaseOutcomes: [] });
  const bytes = Buffer.byteLength(JSON.stringify(b), 'utf8');
  assert.ok(bytes <= BEHAVIOUR_MAX_BUNDLE_BYTES, `bundle ${bytes} bytes exceeds cap`);
  assert.equal(b.summary.bundleTrimmed, true);
  assert.ok(b.findings.length > 0, 'trimming must not empty the bundle');
});

test('enforceBundleCap trims evidence first, then requests, then triggers', () => {
  const bundle = {
    summary: {},
    findings: [{ evidence: 'e'.repeat(1000), requests: [{ method: 'GET', path: '/a', status: 200 }], trigger: 't'.repeat(100) }],
  };
  const { bundle: capped, trimmed } = enforceBundleCap(bundle, 200);
  assert.equal(trimmed, true);
  assert.ok(Buffer.byteLength(JSON.stringify(capped), 'utf8') <= 200);
});

// --- request parsing -------------------------------------------------------

test('parseRequestLine reads method/path/status', () => {
  assert.deepEqual(parseRequestLine('POST /login HTTP/1.1\nHost: x'), { method: 'POST', path: '/login', status: null });
  assert.deepEqual(parseRequestLine('GET /a HTTP/1.1'), { method: 'GET', path: '/a', status: null });
  assert.equal(parseRequestLine('not a request'), null);
  assert.equal(parseRequestLine(''), null);
  assert.equal(parseRequestLine(null), null);
});

test('response status is attached to the request entry', () => {
  const { requests } = summarizeEvidence({ request: 'DELETE /user/1 HTTP/1.1', response: 'HTTP/1.1 204 No Content' });
  assert.deepEqual(requests, [{ method: 'DELETE', path: '/user/1', status: 204 }]);
});

test('finding URL is the anchor request when evidence has none', () => {
  const b = buildBehaviourBundle({
    huntId: 'h_6',
    target: TARGET,
    findings: [finding({ evidence: { detail: 'static only' } })],
    phaseOutcomes: [],
  });
  assert.deepEqual(b.findings[0].requests, [{ method: 'GET', path: '/', status: null }]);
});

// --- fingerprint + phases --------------------------------------------------

test('fingerprint summary keeps scalars, drops the raw body', () => {
  const fp = summarizeFingerprint({ status: 200, server: 'Apache/2.4.25', tech: ['php', 'jquery'], dbHint: 'sqlite', body: '<html>huge</html>' });
  assert.deepEqual(fp, { status: 200, server: 'Apache/2.4.25', tech: ['php', 'jquery'], dbHint: 'sqlite' });
  assert.equal(summarizeFingerprint(null), null);
});

test('phase rollup counts skipped as skipped, never as ok', () => {
  const { rollup, outcomes } = summarizePhases([
    { name: 'a', ok: true, skipped: false, findingsCount: 2, durationMs: 10 },
    { name: 'b', ok: true, skipped: true, findingsCount: 0, durationMs: 0 },
    { name: 'c', ok: false, skipped: false, findingsCount: 0, durationMs: 5, error: 'boom' },
  ]);
  assert.deepEqual(rollup, { total: 3, ok: 1, skipped: 1, failed: 1, timedOut: 0 });
  assert.equal(outcomes[1].ok, false);
  assert.equal(outcomes[1].skipped, true);
  assert.equal(outcomes[2].error, 'boom');
});

// --- fromScan mapping ------------------------------------------------------

test('buildBehaviourBundleFromScan maps confirmed + unconfirmed', () => {
  const b = buildBehaviourBundleFromScan({
    huntId: 'h_7',
    target: TARGET,
    scanDepth: 'deep',
    result: {
      findings: [finding()],
      unconfirmed: [finding({ title: 'Lead', confirmation: 'unconfirmed' })],
      phases: [{ name: 'headers', ok: true, skipped: false, findingsCount: 1, durationMs: 3 }],
      fingerprint: { status: 200, server: 'Apache', tech: ['php'], dbHint: null },
    },
  });
  assert.equal(b.summary.confirmed, 1);
  assert.equal(b.summary.unconfirmed, 1);
  assert.equal(b.scanDepth, 'deep');
  assert.equal(b.summary.phases.total, 1);
  assert.equal(b.fingerprint.server, 'Apache');
});

// --- never throws ----------------------------------------------------------

test('circular evidence never throws', () => {
  const ev = { detail: 'loop' };
  ev.self = ev;
  assert.doesNotThrow(() => buildBehaviourBundle({
    huntId: 'h_8',
    target: TARGET,
    findings: [finding({ evidence: ev })],
    phaseOutcomes: [],
  }));
  const b = buildBehaviourBundle({
    huntId: 'h_8',
    target: TARGET,
    findings: [finding({ evidence: ev })],
    phaseOutcomes: [],
  });
  assert.match(b.findings[0].evidence, /circular/);
});
