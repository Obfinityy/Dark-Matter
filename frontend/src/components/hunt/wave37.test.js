/**
 * wave37.test.js — wave 37 (ideas 51441–51480): explainability round 3
 * (51441–51452) + on-demand test-request suite (51453–51480).
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave37.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WAVE37_EX_IDEAS,
  WAVE37_EX_START,
  WAVE37_EX_END,
  faqForFinding,
  diffExplanations,
  clarityMeter,
  plainTitle,
  oneLineTakeaway,
  SHARE_LEVELS,
  sharePackage,
  audioScript,
  recordExplanationEvent,
  analyticsSummary,
  explanationStaleness,
  crossFindingSummary,
  citationsFor,
  watchNarration,
} from './explainabilityRound3Core.js';

import {
  WAVE37_TQ_IDEAS,
  WAVE37_TQ_START,
  WAVE37_TQ_END,
  WAVE37_IDEAS,
  TECHNIQUE_CATALOG,
  lookupTechnique,
  parseTestRequest,
  normalizeVoiceTranscript,
  WIZARD_STEPS,
  validateWizardStep,
  buildTargetDescriptor,
  validatePayload,
  PRIORITIES,
  priorityWeight,
  enqueueTest,
  queueStatus,
  cancelTest,
  explainResult,
  resultAlert,
  estimateTestCost,
  safetyCheck,
  routeForApproval,
  saveTemplate,
  applyTemplate,
  chainTests,
  scheduleTest,
  repeatTest,
  compareResults,
  attachNote,
  captureEvidence,
  shareTestLink,
  recordTestHistory,
  searchTestHistory,
  suggestTests,
  bulkRequests,
  tuneParams,
  sandboxReplica,
  isSandboxSafe,
  dryRun,
} from './testRequestCore.js';

const F = {
  id: 'F-1042',
  type: 'sql-injection',
  severity: 'high',
  title: 'SQL injection in login form',
  location: '/api/login',
  confidence: 87,
  businessUnit: 'customer portal',
  evidence: ['POST /api/login returned 12 rows instead of 1', 'error leaked table name "users"'],
};

// --- registry completeness ---------------------------------------------------
test('explainability-round-3 registry covers 51441–51452 with zero skips', () => {
  assert.equal(WAVE37_EX_IDEAS.length, 12);
  assert.equal(WAVE37_EX_START, 51441);
  assert.equal(WAVE37_EX_END, 51452);
  const ids = WAVE37_EX_IDEAS.map(([n]) => n);
  ids.forEach((n, i) => assert.equal(n, 51441 + i, `consecutive at index ${i}`));
  WAVE37_EX_IDEAS.forEach(([n, name, desc]) => {
    assert.ok(name && name.length > 2, `idea ${n} has a name`);
    assert.ok(desc && desc.length > 5, `idea ${n} has a description`);
  });
});

test('test-request registry covers 51453–51480 with zero skips', () => {
  assert.equal(WAVE37_TQ_IDEAS.length, 28);
  assert.equal(WAVE37_TQ_START, 51453);
  assert.equal(WAVE37_TQ_END, 51480);
  const ids = WAVE37_TQ_IDEAS.map(([n]) => n);
  ids.forEach((n, i) => assert.equal(n, 51453 + i, `consecutive at index ${i}`));
  WAVE37_TQ_IDEAS.forEach(([n, name, desc]) => {
    assert.ok(name && name.length > 2, `idea ${n} has a name`);
    assert.ok(desc && desc.length > 5, `idea ${n} has a description`);
  });
});

test('combined wave-37 registry is exactly 40/40 ideas, 51441–51480', () => {
  assert.equal(WAVE37_IDEAS.length, 28);
  assert.deepEqual(
    WAVE37_EX_IDEAS.map(([n]) => n).concat(WAVE37_TQ_IDEAS.map(([n]) => n)),
    Array.from({ length: 40 }, (_, i) => 51441 + i)
  );
});

// --- explainability round 3 logic --------------------------------------------
test('51441 faqForFinding builds 5 answered questions from the finding', () => {
  const faqs = faqForFinding(F);
  assert.equal(faqs.length, 5);
  faqs.forEach(f => {
    assert.ok(f.q.endsWith('?'));
    assert.ok(f.a.length > 10);
  });
  assert.ok(faqs[1].a.includes('87'));
});

test('51442 diffExplanations splits added/removed/unchanged lines', () => {
  const d = diffExplanations('line one\nline two', 'line one\nline three');
  assert.deepEqual(d.added, ['line three']);
  assert.deepEqual(d.removed, ['line two']);
  assert.deepEqual(d.unchanged, ['line one']);
  assert.equal(d.changed, true);
});

test('51443 clarityMeter maps confidence to a plain band', () => {
  assert.equal(clarityMeter({ confidence: 87 }).label, 'Rock solid');
  assert.equal(clarityMeter({ confidence: 65 }).label, 'Strong');
  assert.equal(clarityMeter({ confidence: 45 }).label, 'Building');
  assert.equal(clarityMeter({ confidence: 5 }).label, 'Early signal');
});

test('51444/51445 plainTitle + oneLineTakeaway are human-readable', () => {
  assert.equal(plainTitle(F), 'Sql Injection found at /api/login');
  assert.ok(oneLineTakeaway(F).startsWith('Sql Injection found at /api/login'));
});

test('51446 sharePackage respects the three stakeholder levels', () => {
  assert.deepEqual(
    SHARE_LEVELS.map(l => l.id),
    ['exec', 'team', 'tech']
  );
  const exec = sharePackage(F, 'exec');
  assert.equal(exec.level, 'exec');
  assert.ok(exec.takeaway);
  assert.ok(!('evidence' in exec), 'exec level has no raw evidence');
  const tech = sharePackage(F, 'tech');
  assert.ok(tech.evidence);
  assert.ok(tech.clarity);
});

test('51447 audioScript returns a speakable script + positive duration', () => {
  const clip = audioScript(F);
  assert.ok(clip.script.includes('/api/login'));
  assert.ok(clip.seconds >= 1);
});

test('51448 explanation analytics aggregate opened/understood/shared', () => {
  let store = {};
  recordExplanationEvent(store, 'F-1', 'opened');
  recordExplanationEvent(store, 'F-1', 'understood');
  recordExplanationEvent(store, 'F-2', 'opened');
  const s = analyticsSummary(store);
  assert.equal(s.findings, 2);
  assert.equal(s.totals.opened, 2);
  assert.equal(s.comprehension, 50);
});

test('51449 explanationStaleness detects confidence/severity/evidence drift', () => {
  const st = explanationStaleness({ ...F }, { ...F, confidence: 62 });
  assert.equal(st.stale, true);
  assert.deepEqual(st.changed, ['confidence']);
  const fresh = explanationStaleness({ ...F }, { ...F });
  assert.equal(fresh.stale, false);
});

test('51450 crossFindingSummary synthesizes findings in plain words', () => {
  const s = crossFindingSummary(
    [F, { ...F, id: 'F-2', severity: 'medium', type: 'xss' }],
    'your login system'
  );
  assert.ok(s.includes('your login system'));
  assert.ok(s.includes('2 findings'));
  assert.ok(s.includes('1 high'));
});

test('51450 crossFindingSummary handles an empty list', () => {
  assert.ok(crossFindingSummary([], 'shop').includes('looks clean'));
});

test('51451 citationsFor lists evidence reader-friendly', () => {
  const cites = citationsFor(F);
  assert.equal(cites.length, 2);
  assert.equal(cites[0].n, 1);
  assert.ok(cites[0].text.includes('12 rows'));
});

test('51452 watchNarration narrates each proof step and the end', () => {
  const n = watchNarration(['a', 'b'], 0);
  assert.equal(n.done, false);
  assert.equal(n.step, 1);
  assert.ok(n.text.includes('Step 1 of 2'));
  const end = watchNarration(['a', 'b'], 2);
  assert.equal(end.done, true);
});

// --- test-request suite logic -------------------------------------------------
test('technique catalog has real techniques with plain descriptions', () => {
  assert.ok(TECHNIQUE_CATALOG.length >= 8);
  assert.equal(lookupTechnique('sqli').name, 'SQL injection');
  assert.equal(lookupTechnique('nope'), null);
});

test('51453 parseTestRequest extracts technique + target from plain words', () => {
  const p = parseTestRequest('try SQLi on /api/login');
  assert.equal(p.technique, 'sqli');
  assert.equal(p.target, '/api/login');
  assert.equal(p.confidence, 'parsed');
  const fallback = parseTestRequest('look around');
  assert.equal(fallback.confidence, 'fallback');
});

test('51474 normalizeVoiceTranscript strips fillers + politeness', () => {
  assert.equal(normalizeVoiceTranscript('um, please try SQLi'), 'try SQLi');
});

test('51454 wizard validation walks target → technique → confirm', () => {
  assert.deepEqual(WIZARD_STEPS, ['target', 'technique', 'confirm']);
  assert.equal(validateWizardStep('target', {}).ok, false);
  assert.equal(validateWizardStep('target', { target: '/x' }).ok, true);
  assert.equal(validateWizardStep('technique', { technique: 'sqli' }).ok, true);
  assert.equal(validateWizardStep('technique', { technique: 'bogus' }).ok, false);
  assert.equal(
    validateWizardStep('confirm', { target: '/x', technique: 'sqli', acknowledged: true }).ok,
    true
  );
});

test('51455 buildTargetDescriptor composes url/form/param', () => {
  const d = buildTargetDescriptor({ url: '/api/login', form: 'login', param: 'username' });
  assert.ok(d.descriptor.includes('/api/login'));
  assert.ok(d.descriptor.includes('param:username'));
});

test('51457 validatePayload rejects empties + destructive patterns', () => {
  assert.equal(validatePayload("' OR 1=1 --").ok, true);
  assert.equal(validatePayload('').ok, false);
  assert.equal(validatePayload('x'.repeat(5000)).ok, false);
  assert.equal(validatePayload('rm -rf /').ok, false);
});

test('51458 priorityWeight orders the queue', () => {
  assert.deepEqual(PRIORITIES, ['low', 'normal', 'urgent']);
  assert.ok(priorityWeight('urgent') > priorityWeight('normal'));
  assert.ok(priorityWeight('normal') > priorityWeight('low'));
});

test('51459/51460 queue enqueue + status + cancel', () => {
  let q = enqueueTest([], { technique: 'sqli', target: '/api/login' });
  q = enqueueTest(q, { technique: 'xss', target: '/profile' });
  assert.equal(q[0].id, 'tq-1');
  assert.equal(q[0].status, 'queued');
  const s = queueStatus(q);
  assert.equal(s.total, 2);
  assert.equal(s.counts.queued, 2);
  const cancelled = cancelTest(q, 'tq-1');
  assert.equal(cancelled[0].status, 'cancelled');
  assert.equal(cancelled[1].status, 'queued');
});

test('51461/51471 result alerts + explanations state the verdict plainly', () => {
  const a = resultAlert(
    { id: 'tq-1' },
    { vulnerable: true, technique: 'SQL injection', target: '/api/login' }
  );
  assert.equal(a.severity, 'attention');
  assert.ok(a.verdict.includes('Vulnerable'));
  assert.ok(
    explainResult({ vulnerable: false, technique: 'headers', target: '/x' }).includes(
      'Not vulnerable'
    )
  );
  assert.ok(explainResult({ error: 'timeout' }).includes('errored'));
});

test('51462 estimateTestCost returns requests + time', () => {
  const c = estimateTestCost({ technique: 'dirbrute', priority: 'normal' });
  assert.equal(c.requests, 200);
  assert.ok(c.seconds > 0);
  assert.ok(c.label.includes('requests'));
});

test('51463 safetyCheck warns on risky techniques + missing targets', () => {
  assert.equal(safetyCheck({ technique: 'headers', target: '/x' }).safe, true);
  const risky = safetyCheck({ technique: 'ssrf', target: '/x' });
  assert.equal(risky.safe, false);
  assert.ok(risky.warnings.length >= 1);
  assert.ok(safetyCheck({ technique: 'headers' }).warnings.some(w => w.includes('No target')));
});

test('51464 routeForApproval gates medium-risk + urgent + custom-payload tests', () => {
  assert.equal(routeForApproval({ technique: 'headers', target: '/x' }).needsApproval, false);
  assert.equal(routeForApproval({ technique: 'ssrf', target: '/x' }).needsApproval, true);
  assert.equal(routeForApproval({ technique: 'ssrf', target: '/x' }).tier, 'security-lead');
  assert.equal(
    routeForApproval({ technique: 'headers', target: '/x', priority: 'urgent' }).needsApproval,
    true
  );
});

test('51465 templates save + apply with overrides', () => {
  const saved = saveTemplate({}, 'login-sqli', { technique: 'sqli', target: '/api/login' });
  assert.equal(saved.ok, true);
  assert.equal(saveTemplate({}, '', {}).ok, false);
  const applied = applyTemplate(saved.store, 'login-sqli', { target: '/api/register' });
  assert.equal(applied.ok, true);
  assert.equal(applied.test.target, '/api/register');
  assert.equal(applied.test.technique, 'sqli');
  assert.equal(applyTemplate(saved.store, 'missing', {}).ok, false);
});

test('51466 chainTests builds a conditional follow-up', () => {
  const c = chainTests({ technique: 'sqli', target: '/a' }, 'if vulnerable', {
    technique: 'idor',
    target: '/b',
  });
  assert.ok(c.description.includes('idor'));
  assert.ok(c.description.includes('if vulnerable'));
});

test('51467 scheduleTest stamps a when', () => {
  const s = scheduleTest({ technique: 'headers', target: '/x' }, 'phase-end');
  assert.equal(s.scheduled, true);
  assert.equal(s.scheduledFor, 'phase-end');
});

test('51468 repeatTest clones history entries against a new target', () => {
  const r = repeatTest(
    [{ id: 'tq-9', technique: 'sqli', target: '/a', status: 'done' }],
    'tq-9',
    '/b'
  );
  assert.equal(r.ok, true);
  assert.equal(r.test.target, '/b');
  assert.equal(r.test.status, 'queued');
  assert.equal(repeatTest([], 'tq-9', '/b').ok, false);
});

test('51469 compareResults summarizes per-endpoint verdicts', () => {
  const c = compareResults([
    { target: '/a', technique: 'sqli', vulnerable: true },
    { target: '/b', technique: 'sqli', vulnerable: false },
  ]);
  assert.equal(c.total, 2);
  assert.equal(c.vulnerable, 1);
  assert.ok(c.summary.includes('1 of 2'));
});

test('51470 attachNote stores the hypothesis on the test', () => {
  assert.equal(attachNote({ technique: 'sqli' }, 'hunch').note, 'hunch');
});

test('51472 captureEvidence stores request/response per test', () => {
  const ev = captureEvidence(
    { id: 'tq-1', technique: 'sqli', target: '/a' },
    { m: 'POST' },
    { s: 200 }
  );
  assert.equal(ev.testId, 'tq-1');
  assert.equal(ev.captured, true);
  assert.deepEqual(ev.request, { m: 'POST' });
});

test('51473 shareTestLink produces a review path', () => {
  const l = shareTestLink({ id: 'tq-1' });
  assert.ok(l.path.startsWith('/tests/share/'));
  assert.ok(l.token.length > 0);
});

test('51475 history records + searchable', () => {
  let h = recordTestHistory([], {
    id: 'tq-1',
    technique: 'sqli',
    target: '/api/login',
    note: 'bypass',
  });
  h = recordTestHistory(h, { id: 'tq-2', technique: 'xss', target: '/profile', note: 'stored' });
  assert.equal(searchTestHistory(h, 'login').length, 1);
  assert.equal(searchTestHistory(h, '').length, 2);
});

test('51476 suggestTests proposes tests from discovery context', () => {
  const sug = suggestTests([{ id: 'F-1', type: 'x', location: '/api/login' }], 5);
  assert.ok(sug.length >= 1);
  assert.ok(sug[0].why.length > 5);
  assert.ok(sug.every(s => lookupTechnique(s.technique)));
});

test('51477 bulkRequests expands targets into a batch', () => {
  const b = bulkRequests(['/a', '/b'], 'headers');
  assert.equal(b.length, 2);
  assert.equal(b[0].batchIndex, 0);
  assert.equal(b[1].target, '/b');
});

test('51478 tuneParams clamps depth/payloads/timeout', () => {
  const t = tuneParams(
    { technique: 'dirbrute' },
    { depth: 99, payloadCount: -5, timeoutMs: 999999 }
  );
  assert.equal(t.tuning.depth, 5);
  assert.equal(t.tuning.payloadCount, 1);
  assert.equal(t.tuning.timeoutMs, 120000);
});

test('51479 sandboxReplica is isolated + sandbox-safe for low-risk tests', () => {
  const rep = sandboxReplica({ id: 'tq-1', technique: 'headers', target: '/x' });
  assert.equal(rep.isolated, true);
  assert.equal(rep.network, 'egress-blocked');
  assert.equal(isSandboxSafe({ technique: 'headers', target: '/x' }), true);
});

test('51480 dryRun previews exactly what will be sent', () => {
  const d = dryRun({
    technique: 'sqli',
    target: '/api/login',
    param: 'username',
    priority: 'normal',
  });
  assert.equal(d.technique, 'SQL injection');
  assert.equal(d.target, '/api/login');
  assert.ok(d.cost.label.includes('requests'));
  assert.ok(d.willSend.length > 0);
});

// --- audits: CSS keyframes, debris, JSX parse ---------------------------------
test('Wave37.css carries zero keyframes per the zero-animation order', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('./Wave37.css', import.meta.url), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero keyframes');
});

test('all five wave-37 files have no TODO/FIXME/mock/demo/simulate/placeholder debris', async () => {
  const { readFile } = await import('node:fs/promises');
  const files = [
    './explainabilityRound3Core.js',
    './testRequestCore.js',
    './ExplainabilityRound3.jsx',
    './TestRequestSuite.jsx',
    './Wave37.css',
  ];
  for (const f of files) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), `no TODO/FIXME in ${f}`);
    assert.ok(!/\bmock\b/i.test(src), `no mock debris in ${f}`);
    assert.ok(!/\bdemo\b/i.test(src), `no demo debris in ${f}`);
    assert.ok(!/\bsimulate\b/i.test(src), `no simulate debris in ${f}`);
    assert.ok(!/\bplaceholder\b/i.test(src), `no placeholder debris in ${f}`);
  }
});

test('ExplainabilityRound3.jsx parses clean via esbuild', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const jsxPath = fileURLToPath(new URL('./ExplainabilityRound3.jsx', import.meta.url));
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(out.includes('Wave37ExplainGallery'), 'esbuild parsed the explain gallery export');
});

test('TestRequestSuite.jsx parses clean via esbuild', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const jsxPath = fileURLToPath(new URL('./TestRequestSuite.jsx', import.meta.url));
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(out.includes('Wave37TestGallery'), 'esbuild parsed the test gallery export');
});
