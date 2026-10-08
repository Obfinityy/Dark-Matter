/**
 * wave55.test.js — Infinity AI · Dark-Matter · Wave 55
 * Run: node --test frontend/src/components/hunt/wave55.test.js
 * Tests the two pure core modules only (no JSX imported here), plus audits
 * of Wave55.css (zero @keyframes, scoped prefixes).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as R4 from './retestRound4Core.js';
import * as EX from './exportCore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = 1700000000000; // fixed reference time for deterministic tests

describe('wave55 registries', () => {
  test('retestRound4Core lists all 21 ideas 52161–52181, zero skips', () => {
    assert.equal(R4.WAVE55_R4_IDEAS.length, 21);
    const ids = R4.WAVE55_R4_IDEAS.map(i => i.id);
    for (let id = 52161; id <= 52181; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 21, 'no duplicate ids');
    assert.ok(
      R4.WAVE55_R4_IDEAS.every(i => i.title && i.title.length > 0),
      'every idea has a title'
    );
  });
  test('exportCore lists all 19 ideas 52182–52200, zero skips', () => {
    assert.equal(EX.WAVE55_EXP_IDEAS.length, 19);
    const ids = EX.WAVE55_EXP_IDEAS.map(i => i.id);
    for (let id = 52182; id <= 52200; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 19, 'no duplicate ids');
    assert.ok(
      EX.WAVE55_EXP_IDEAS.every(i => i.title && i.title.length > 0),
      'every idea has a title'
    );
  });
  test('combined wave-55 registries cover 40/40 ideas 52161–52200', () => {
    const ids = new Set([
      ...R4.WAVE55_R4_IDEAS.map(i => i.id),
      ...EX.WAVE55_EXP_IDEAS.map(i => i.id),
    ]);
    assert.equal(ids.size, 40);
    for (let id = 52161; id <= 52200; id++) assert.ok(ids.has(id), `missing idea ${id}`);
  });
});

describe('retestRound4Core behavior', () => {
  test('52161 signOffRetest approves only fixed verdicts', () => {
    const v = { findingId: 'f-1', verdict: 'fixed' };
    const ok = R4.signOffRetest(v, 'approved', 'ria', NOW);
    assert.ok(ok.ok);
    assert.equal(ok.signOff.state, 'approved');
    assert.equal(ok.signOff.closesFinding, true);
    const bad = R4.signOffRetest(
      { findingId: 'f-1', verdict: 'still-vulnerable' },
      'approved',
      'ria',
      NOW
    );
    assert.equal(bad.ok, false);
    const rej = R4.signOffRetest(v, 'needs-review', 'ria', NOW);
    assert.ok(rej.ok);
    assert.equal(rej.signOff.closesFinding, false);
  });
  test('52162 comments and attachments validate input', () => {
    assert.equal(R4.addRetestComment(null, 'x').ok, false);
    assert.equal(R4.addRetestComment({ id: 'rt-1' }, '   ').ok, false);
    const c = R4.addRetestComment({ id: 'rt-1' }, 'looks fixed', 'ria', NOW);
    assert.ok(c.ok);
    assert.equal(c.comment.requestId, 'rt-1');
    const a = R4.addRetestAttachment({ id: 'rt-1' }, { name: 'shot.png', kind: 'screenshot' }, NOW);
    assert.ok(a.ok);
    assert.equal(a.attachment.name, 'shot.png');
    assert.equal(R4.addRetestAttachment({ id: 'rt-1' }, {}).ok, false);
  });
  test('52163 evaluateCIGate blocks on still-vulnerable, passes otherwise', () => {
    assert.equal(
      R4.evaluateCIGate([{ findingId: 'f-1', retestId: 'rt-1', verdict: 'fixed' }]).pass,
      true
    );
    const blocked = R4.evaluateCIGate([
      { findingId: 'f-2', retestId: 'rt-2', verdict: 'still-vulnerable' },
    ]);
    assert.equal(blocked.pass, false);
    assert.equal(blocked.blockers[0].findingId, 'f-2');
    assert.equal(R4.evaluateCIGate([]).pass, true);
  });
  test('52164 handleRetestApiCall supports request/status/cancel', () => {
    const q = R4.handleRetestApiCall('request', { findingId: 'f-1' }, NOW);
    assert.ok(q.ok);
    assert.equal(q.data.status, 'queued');
    const s = R4.handleRetestApiCall('status', { id: q.data.id }, NOW);
    assert.ok(s.ok);
    const c = R4.handleRetestApiCall('cancel', { id: q.data.id }, NOW);
    assert.ok(c.ok);
    assert.equal(c.data.status, 'cancelled');
    assert.equal(R4.handleRetestApiCall('deploy', {}).ok, false);
    assert.equal(R4.handleRetestApiCall('request', {}).ok, false);
  });
  test('52165 buildFindingDeepLink builds a one-click retest URL', () => {
    const l = R4.buildFindingDeepLink('f-101');
    assert.ok(l.ok);
    assert.ok(l.url.includes('f-101'));
    assert.ok(l.url.includes('action=retest'));
    assert.equal(R4.buildFindingDeepLink('').ok, false);
  });
  test('52166 onBountyStatusChange triggers only on needs-retest statuses', () => {
    const r = R4.onBountyStatusChange({ findingId: 'f-1', status: 'needs-retest' }, NOW);
    assert.ok(r.ok);
    assert.equal(r.request.priority, 'urgent');
    assert.equal(R4.onBountyStatusChange({ findingId: 'f-1', status: 'paid' }).ok, false);
  });
  test('52167 dueReminders finds past-window requests', () => {
    const due = R4.dueReminders(
      [
        { id: 'rt-1', findingId: 'f-1', status: 'queued', assignee: 'ria', windowEnd: NOW - 1000 },
        { id: 'rt-2', findingId: 'f-2', status: 'queued', assignee: 'dev', windowEnd: NOW + 1000 },
        { id: 'rt-3', findingId: 'f-3', status: 'completed', windowEnd: NOW - 1000 },
      ],
      NOW
    );
    assert.equal(due.length, 1);
    assert.equal(due[0].requestId, 'rt-1');
    assert.ok(due[0].overdueByMs > 0);
  });
  test('52168 retestAnalytics computes rates per team and asset', () => {
    const rows = [
      {
        findingId: 'f-1',
        verdict: 'fixed',
        team: 'web',
        asset: 'a1',
        startedAt: NOW - 7200000,
        completedAt: NOW - 3600000,
      },
      {
        findingId: 'f-2',
        verdict: 'still-vulnerable',
        team: 'web',
        asset: 'a1',
        startedAt: NOW - 7200000,
        completedAt: NOW - 1800000,
      },
      {
        findingId: 'f-3',
        verdict: 'fixed',
        team: 'cms',
        asset: 'a2',
        startedAt: NOW - 5400000,
        completedAt: NOW - 3600000,
      },
    ];
    const a = R4.retestAnalytics(rows);
    assert.equal(a.total, 3);
    assert.ok(Math.abs(a.fixVerificationRate - 2 / 3) < 1e-9);
    assert.ok(Math.abs(a.stillVulnerableRate - 1 / 3) < 1e-9);
    assert.ok(a.avgTurnaroundMs > 0);
    assert.equal(a.byTeam.web.fixVerificationRate, 0.5);
    assert.equal(a.byAsset.a2.fixVerificationRate, 1);
    assert.equal(R4.retestAnalytics([]).fixVerificationRate, 0);
  });
  test('52169 queueChainRetest queues every finding in the chain', () => {
    const b = R4.queueChainRetest({ id: 'chain-1', findingIds: ['f-1', 'f-2'] }, {}, NOW);
    assert.ok(b.ok);
    assert.equal(b.batch.requests.length, 2);
    assert.equal(b.batch.priority, 'urgent');
    assert.equal(R4.queueChainRetest({ findingIds: [] }).ok, false);
  });
  test('52170 buildProxyCaptureConfig describes the capture route', () => {
    const c = R4.buildProxyCaptureConfig('https://x.example/y');
    assert.ok(c.ok);
    assert.equal(c.capture.targetUrl, 'https://x.example/y');
    assert.equal(c.capture.attachToFinding, true);
    assert.equal(R4.buildProxyCaptureConfig('').ok, false);
  });
  test('52171 diffEvidenceTokens reports added/removed/same tokens', () => {
    const d = R4.diffEvidenceTokens('a b c', 'a x c d');
    assert.ok(d.changed > 0);
    assert.ok(d.ops.some(o => o.type === 'added' && o.token === 'x'));
    assert.ok(d.ops.some(o => o.type === 'removed' && o.token === 'b'));
    assert.ok(d.ops.some(o => o.type === 'same' && o.token === 'a'));
    const same = R4.diffEvidenceTokens('a b', 'a b');
    assert.equal(same.changed, 0);
    assert.equal(same.unchanged, 2);
  });
  test('52172 bulkQueueBySeverity includes findings at or above threshold', () => {
    const fs = [
      { id: 'f-1', severity: 'critical', status: 'open' },
      { id: 'f-2', severity: 'high', status: 'open' },
      { id: 'f-3', severity: 'low', status: 'open' },
      { id: 'f-4', severity: 'high', status: 'fixed' },
    ];
    const b = R4.bulkQueueBySeverity(fs, 'high', {}, NOW);
    assert.ok(b.ok);
    assert.equal(b.batch.count, 2);
    assert.equal(R4.bulkQueueBySeverity(fs, 'nonsense').ok, false);
  });
  test('52173 bulkQueueByAsset queues only selected assets', () => {
    const fs = [
      { id: 'f-1', severity: 'high', status: 'open', asset: 'web' },
      { id: 'f-2', severity: 'high', status: 'open', asset: 'api' },
    ];
    const b = R4.bulkQueueByAsset(fs, ['web'], {}, NOW);
    assert.ok(b.ok);
    assert.equal(b.batch.count, 1);
    assert.equal(b.batch.requests[0].findingId, 'f-1');
    assert.equal(R4.bulkQueueByAsset(fs, []).ok, false);
  });
  test('52174 queueToCsv exports header plus one row per request', () => {
    const out = R4.queueToCsv([
      {
        id: 'rt-1',
        findingId: 'f-1',
        status: 'queued',
        priority: 'urgent',
        trigger: 'manual',
        requestedAt: NOW,
      },
    ]);
    const lines = out.csv.split('\n');
    assert.equal(lines.length, 2);
    assert.ok(lines[0].startsWith('request_id,finding_id'));
    assert.ok(lines[1].includes('rt-1'));
    assert.equal(out.rows, 1);
  });
  test('52175 findDuplicate matches queued and recent requests, ignores others', () => {
    const existing = [
      { id: 'rt-1', findingId: 'f-1', trigger: 'manual', status: 'queued' },
      {
        id: 'rt-2',
        findingId: 'f-2',
        trigger: 'manual',
        status: 'completed',
        completedAt: NOW - 10 * 86400000,
      },
      {
        id: 'rt-3',
        findingId: 'f-3',
        trigger: 'manual',
        status: 'completed',
        completedAt: NOW - 400 * 86400000,
      },
    ];
    const d1 = R4.findDuplicate({ id: 'rt-x', findingId: 'f-1', trigger: 'manual' }, existing, {
      now: NOW,
    });
    assert.equal(d1.duplicate, true);
    assert.equal(d1.matchedId, 'rt-1');
    const d2 = R4.findDuplicate({ id: 'rt-x', findingId: 'f-2', trigger: 'manual' }, existing, {
      now: NOW,
    });
    assert.equal(d2.duplicate, true);
    const d3 = R4.findDuplicate({ id: 'rt-x', findingId: 'f-3', trigger: 'manual' }, existing, {
      now: NOW,
    });
    assert.equal(d3.duplicate, false);
    const d4 = R4.findDuplicate({ id: 'rt-x', findingId: 'f-1', trigger: 'ci' }, existing, {
      now: NOW,
    });
    assert.equal(d4.duplicate, false, 'different trigger changes the signature');
  });
  test('52176 wafChangeTrigger queues only previously WAF-blocked findings', () => {
    const fs = [
      { id: 'f-1', status: 'open', asset: 'web', wafBlocked: true },
      { id: 'f-2', status: 'open', asset: 'web', wafBlocked: false },
      { id: 'f-3', status: 'open', asset: 'api', wafBlocked: true },
    ];
    const b = R4.wafChangeTrigger({ target: 'web', changeId: 'w1' }, fs, NOW);
    assert.ok(b.ok);
    assert.equal(b.batch.count, 1);
    assert.equal(b.batch.requests[0].trigger, 'waf-change');
    assert.equal(R4.wafChangeTrigger(null, fs).ok, false);
  });
  test('52177 evaluateNotificationPrefs honors per-event preferences', () => {
    const prefs = { started: false, completed: true, channels: ['email'] };
    const muted = R4.evaluateNotificationPrefs(prefs, { kind: 'started' });
    assert.equal(muted.notify, false);
    const on = R4.evaluateNotificationPrefs(prefs, { kind: 'completed' });
    assert.equal(on.notify, true);
    assert.deepEqual(on.channels, ['email']);
    assert.equal(R4.evaluateNotificationPrefs(prefs, {}).notify, false);
  });
  test('52178 reorderQueue moves pending requests up/down/to-top', () => {
    const q = [
      { id: 'rt-1', status: 'queued' },
      { id: 'rt-2', status: 'queued' },
      { id: 'rt-3', status: 'running' },
    ];
    const up = R4.reorderQueue(q, 'rt-2', 'up');
    assert.ok(up.ok);
    const pendingOrder = up.queue
      .filter(r => r.status === 'queued')
      .sort((a, b) => a.order - b.order);
    assert.equal(pendingOrder[0].id, 'rt-2');
    const top = R4.reorderQueue(q, 'rt-2', 'to-top');
    assert.equal(
      top.queue.filter(r => r.status === 'queued').sort((a, b) => a.order - b.order)[0].id,
      'rt-2'
    );
    assert.equal(R4.reorderQueue(q, 'rt-3', 'up').ok, false, 'running requests cannot move');
    assert.equal(R4.reorderQueue(q, 'rt-9', 'up').ok, false);
  });
  test('52179 scopeRetestToCommit pins the request to a commit sha', () => {
    const r = R4.scopeRetestToCommit({ id: 'rt-1' }, { sha: 'abc123', message: 'fix xss' });
    assert.ok(r.ok);
    assert.equal(r.request.fixCommit, 'abc123');
    assert.equal(R4.scopeRetestToCommit({ id: 'rt-1' }, {}).ok, false);
  });
  test('52180 retention policy flags expired evidence', () => {
    const old = R4.retentionExpiry(NOW - 100 * 86400000, { days: 90 }, NOW);
    assert.ok(old.ok);
    assert.equal(old.expired, true);
    const fresh = R4.retentionExpiry(NOW - 10 * 86400000, { days: 90 }, NOW);
    assert.equal(fresh.expired, false);
    const plan = R4.retentionCleanupPlan(
      [
        { id: 'cap-1', capturedAt: NOW - 100 * 86400000 },
        { id: 'cap-2', capturedAt: NOW - 10 * 86400000 },
      ],
      { days: 90 },
      NOW
    );
    assert.deepEqual(plan.dueForDeletion, ['cap-1']);
    assert.deepEqual(plan.kept, ['cap-2']);
  });
  test('52181 scoreVerdictConfidence scores signals and flags manual review', () => {
    const high = R4.scoreVerdictConfidence(
      { verdict: 'fixed' },
      { probes: 6, agreement: 1, evidenceStrength: 'strong' }
    );
    assert.ok(high.ok);
    assert.equal(high.level, 'high');
    assert.equal(high.needsManualReview, false);
    const inc = R4.scoreVerdictConfidence(
      { verdict: 'inconclusive' },
      { probes: 2, agreement: 0.5, evidenceStrength: 'weak' }
    );
    assert.equal(inc.needsManualReview, true);
    assert.equal(R4.scoreVerdictConfidence({ verdict: 'fixed-ish' }).ok, false);
  });
});

describe('exportCore behavior', () => {
  const HUNT = {
    id: 'hunt-1',
    target: 'shop.example.com',
    findings: [
      {
        id: 'f-1',
        title: 'XSS',
        severity: 'high',
        status: 'open',
        vulnClass: 'xss',
        cwe: 'CWE-79',
        endpoint: '/search',
        target: 'shop',
        assignee: 'ria',
        confidence: 'high',
        description: 'reflected xss',
        evidence: [{ kind: 'http', summary: 'GET /search?q=<script>', body: 'raw bytes' }],
        poc: 'curl http://x',
        remediation: 'encode output',
      },
      {
        id: 'f-2',
        title: 'SQLi',
        severity: 'critical',
        status: 'open',
        vulnClass: 'sqli',
        cwe: 'CWE-89',
        endpoint: '/login',
        target: 'shop',
        assignee: 'dev',
        confidence: 'high',
        description: 'sqli in login',
        evidence: [],
        poc: null,
        remediation: 'parameterize',
      },
      {
        id: 'f-3',
        title: 'FP item',
        severity: 'medium',
        status: 'false-positive',
        vulnClass: 'fp',
        endpoint: '/',
        target: 'shop',
        description: '',
        evidence: [],
        remediation: '',
      },
    ],
  };
  test('52182 buildExecSummaryModel computes risk and top findings', () => {
    const m = EX.buildExecSummaryModel(HUNT);
    assert.equal(m.kind, 'exec-summary');
    assert.equal(m.totalFindings, 2, 'false positives excluded');
    assert.ok(m.riskScore > 0);
    assert.equal(m.topFindings[0].id, 'f-2', 'critical sorts first');
    assert.equal(m.generatedBy, 'Infinity AI');
  });
  test('52183 buildDeepDiveModel keeps full evidence per finding', () => {
    const m = EX.buildDeepDiveModel(HUNT);
    assert.equal(m.findings.length, 2);
    assert.equal(m.findings[0].evidence.length, 1);
    assert.equal(m.findings[0].cwe, 'CWE-79');
  });
  test('52184 buildPerFindingModel rejects missing findings', () => {
    const r = EX.buildPerFindingModel(HUNT.findings[0], HUNT);
    assert.ok(r.ok);
    assert.equal(r.model.finding.id, 'f-1');
    assert.equal(EX.buildPerFindingModel(null).ok, false);
  });
  test('52185 stripEvidenceForSharing removes payloads but keeps facts', () => {
    const r = EX.stripEvidenceForSharing(EX.buildDeepDiveModel(HUNT));
    assert.ok(r.ok);
    assert.equal(r.model.evidenceRedacted, true);
    const f = r.model.findings[0];
    assert.equal(f.evidence[0].summary, 'evidence redacted for sharing');
    assert.equal(f.title, 'XSS', 'title preserved');
    assert.ok(!('poc' in f), 'poc removed');
  });
  test('52186 watermarkDescriptor embeds the viewer name', () => {
    const w = EX.watermarkDescriptor('Acme — R. Kapoor');
    assert.ok(w.ok);
    assert.ok(w.watermark.text.includes('R. Kapoor'));
    assert.equal(EX.watermarkDescriptor('').ok, false);
  });
  test('52187 buildProtectionDescriptor enforces a minimum password length', () => {
    const p = EX.buildProtectionDescriptor('correct-horse-92');
    assert.ok(p.ok);
    assert.equal(p.protection.algorithm, 'AES-256');
    assert.equal(p.protection.passwordSet, true);
    assert.equal(EX.buildProtectionDescriptor('short').ok, false);
  });
  test('52188 buildSignatureBlock signs with the org certificate', () => {
    const s = EX.buildSignatureBlock(
      { subject: 'CN=Infinity AI', expiresAt: NOW + 86400000 },
      'sha256:abc',
      NOW
    );
    assert.ok(s.ok);
    assert.equal(s.signature.valid, true);
    const expired = EX.buildSignatureBlock(
      { subject: 'CN=Infinity AI', expiresAt: NOW - 1 },
      'sha256:abc',
      NOW
    );
    assert.equal(expired.signature.valid, false);
    assert.equal(EX.buildSignatureBlock(null, 'x').ok, false);
  });
  test('52189 applyLetterheadBrand applies the branding profile', () => {
    const r = EX.applyLetterheadBrand(EX.buildExecSummaryModel(HUNT), {
      companyName: 'Acme',
      primaryColor: '#123456',
    });
    assert.ok(r.ok);
    assert.equal(r.model.letterhead.companyName, 'Acme');
    assert.equal(EX.applyLetterheadBrand(EX.buildExecSummaryModel(HUNT), {}).ok, false);
  });
  test('52190 buildVersionedDump carries the infinity-ai-export/v1 schema', () => {
    const d = EX.buildVersionedDump(HUNT, NOW);
    assert.equal(d.schema, 'infinity-ai-export/v1');
    assert.equal(d.generatedBy, 'Infinity AI');
    assert.equal(d.findings.length, 3);
  });
  test('52191 findingToJson wraps a single finding', () => {
    const r = EX.findingToJson(HUNT.findings[1], HUNT);
    assert.ok(r.ok);
    assert.equal(r.json.finding.id, 'f-2');
    assert.equal(r.json.schema, 'infinity-ai-export/v1');
  });
  test('52192 flattenToSiem produces ECS-style flat events', () => {
    const rows = EX.flattenToSiem(HUNT.findings, HUNT);
    assert.equal(rows.length, 3);
    assert.equal(rows[0]['observer.vendor'], 'Infinity AI');
    assert.equal(rows[0]['vulnerability.id'], 'f-1');
    assert.equal(rows[0]['url.full'], '/search');
  });
  test('52193/52194 CSV export honors columns and presets', () => {
    const out = EX.findingsToCsv(HUNT.findings);
    assert.equal(out.rows, 3);
    assert.ok(out.csv.split('\n')[0].includes('Finding ID'));
    const p = EX.applyColumnPreset('leadership');
    assert.ok(p.ok);
    assert.deepEqual(p.columns, ['id', 'title', 'severity', 'status']);
    assert.equal(EX.applyColumnPreset('nope').ok, false);
  });
  test('52195 findingsToPivotCsv emits one row per affected asset', () => {
    const out = EX.findingsToPivotCsv([
      { id: 'f-1', title: 'X', severity: 'high', status: 'open', assets: ['a', 'b'] },
    ]);
    assert.equal(out.rows, 2);
    assert.ok(out.csv.split('\n')[1].includes(',a,'));
  });
  test('severity-threshold and delta filters behave correctly', () => {
    const f = EX.filterBySeverityThreshold(HUNT.findings, 'high');
    assert.ok(f.ok);
    assert.equal(f.findings.length, 2);
    assert.equal(EX.filterBySeverityThreshold(HUNT.findings, 'nope').ok, false);
    const d = EX.diffRunsToDelta(
      [
        { id: 'f-1', status: 'open', severity: 'high' },
        { id: 'f-2', status: 'fixed', severity: 'high' },
      ],
      [
        { id: 'f-1', status: 'open', severity: 'high' },
        { id: 'f-3', status: 'open', severity: 'low' },
      ]
    );
    assert.deepEqual(d.added, ['f-2']);
    assert.deepEqual(d.removed, ['f-3']);
    assert.deepEqual(d.changed, []);
  });
  test('52196 buildSarif emits a SARIF 2.1.0 document', () => {
    const s = EX.buildSarif(HUNT);
    assert.equal(s.version, '2.1.0');
    assert.ok(s.$schema.includes('sarif-2.1.0'));
    const run = s.runs[0];
    assert.equal(run.tool.driver.name, 'Infinity AI Dark-Matter');
    assert.equal(run.results.length, 2, 'false positives excluded');
    const critical = run.results.find(r => r.properties.findingId === 'f-2');
    assert.equal(critical.level, 'error');
    assert.ok(run.results.every(r => typeof r.ruleId === 'string'));
  });
  test('52197 buildSarifPerRun splits SARIF per run', () => {
    const files = EX.buildSarifPerRun([
      { id: 'run-a', findings: HUNT.findings.slice(0, 1) },
      { id: 'run-b', findings: HUNT.findings.slice(1, 2) },
    ]);
    assert.equal(files.length, 2);
    assert.equal(files[0].sarif.runs[0].results.length, 1);
    assert.equal(files[0].runId, 'run-a');
  });
  test('52198 buildCodeScanningUploadPackage validates SARIF and repo', () => {
    const ok = EX.buildCodeScanningUploadPackage(EX.buildSarif(HUNT), 'acme/shop');
    assert.ok(ok.ok);
    assert.equal(ok.package.sarifFileName, 'infinity-ai-results.sarif');
    assert.equal(ok.package.instructions.length, 3);
    assert.equal(EX.buildCodeScanningUploadPackage(EX.buildSarif(HUNT), 'norepo').ok, false);
    assert.equal(EX.buildCodeScanningUploadPackage({ version: '9.9' }, 'acme/shop').ok, false);
  });
  test('52199 renderHtmlReport escapes content and lists findings', () => {
    const r = EX.renderHtmlReport(EX.buildDeepDiveModel(HUNT));
    assert.ok(r.ok);
    assert.ok(r.html.includes('<!doctype html>'));
    assert.equal(r.html.split('<details').length - 1, 2);
    const x = EX.renderHtmlReport({ target: '<script>', findings: [] });
    assert.ok(!x.html.includes('<script>'), 'target is escaped');
    assert.equal(EX.renderHtmlReport(null).ok, false);
  });
  test('52200 renderMarkdownReport produces a readable report', () => {
    const r = EX.renderMarkdownReport(EX.buildExecSummaryModel(HUNT));
    assert.ok(r.ok);
    assert.ok(r.markdown.startsWith('# Hunt report'));
    assert.ok(r.markdown.includes('Generated by Infinity AI'));
    assert.equal(EX.renderMarkdownReport(null).ok, false);
  });
  test('redactForSharing masks secrets and applyExportTemplate resolves templates', () => {
    assert.equal(EX.redactForSharing('token Bearer abc.def.ghi', []), 'token [REDACTED]');
    const t = EX.applyExportTemplate('leadership-pdf');
    assert.ok(t.ok);
    assert.equal(t.template.kind, 'exec-summary');
    assert.equal(EX.applyExportTemplate('nope').ok, false);
  });
});

describe('Wave55.css audits', () => {
  const css = readFileSync(join(HERE, 'Wave55.css'), 'utf8');
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  test('contains zero keyframes rules (zero-animation order)', () => {
    assert.ok(!/@keyframes/i.test(stripped), 'no @keyframes allowed');
    assert.ok(!/@-webkit-keyframes/i.test(stripped), 'no vendor keyframes allowed');
  });
  test('every selector is scoped to .rr4- or .ex55- prefixes', () => {
    const bad = [];
    for (const line of css.split('\n')) {
      const m = line.match(/^\s*(\.[a-z0-9-]+)/i);
      if (m && !m[1].startsWith('.rr4-') && !m[1].startsWith('.ex55-')) bad.push(m[1]);
    }
    assert.deepEqual(bad, []);
  });
  test('no global styles or animation properties', () => {
    assert.ok(!/^(\*|html|body|a|div|button)\s*{/m.test(css), 'no bare element selectors');
    assert.ok(!/animation\s*:/.test(css), 'no animation declarations');
    assert.ok(!/transition\s*:/.test(css), 'no transition declarations');
  });
});
