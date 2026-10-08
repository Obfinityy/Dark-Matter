/**
 * wave54.test.js — Infinity AI · Dark-Matter · Wave 54
 * Run: node --test frontend/src/components/hunt/wave54.test.js
 * Tests the two pure core modules only (no JSX imported here).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import * as RT from './retestCore.js';
import * as FPI from './fpImpactCore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEW_FILES = [
  'retestCore.js', 'fpImpactCore.js',
  'RetestSuite.jsx', 'FPImpact.jsx',
  'Wave54.css', 'wave54.test.js',
];
const NOW = 1700000000000; // fixed reference time for deterministic tests

describe('fpImpactCore registry', () => {
  test('lists FP ideas 52121–52122, zero skips', () => {
    assert.equal(FPI.WAVE54_FP_IDEAS.length, 2);
    const ids = FPI.WAVE54_FP_IDEAS.map((i) => i.id);
    for (let id = 52121; id <= 52122; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 2, 'no duplicate ids');
    assert.ok(FPI.WAVE54_FP_IDEAS.every((i) => i.title && i.title.length > 0), 'every idea has a title');
  });
});

describe('retestCore registry', () => {
  test('lists all 38 retest ideas 52123–52160, zero skips', () => {
    assert.equal(RT.WAVE54_RETEST_IDEAS.length, 38);
    const ids = RT.WAVE54_RETEST_IDEAS.map((i) => i.id);
    for (let id = 52123; id <= 52160; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 38, 'no duplicate ids');
    assert.ok(RT.WAVE54_RETEST_IDEAS.every((i) => i.title && i.title.length > 0), 'every idea has a title');
  });
  test('combined wave-54 registries cover 40/40 ideas 52121–52160', () => {
    const ids = new Set([...FPI.WAVE54_FP_IDEAS.map((i) => i.id), ...RT.WAVE54_RETEST_IDEAS.map((i) => i.id)]);
    assert.equal(ids.size, 40);
    for (let id = 52121; id <= 52160; id++) assert.ok(ids.has(id), `missing idea ${id}`);
  });
});

describe('fpImpactCore spot checks', () => {
  test('52121 simulateFpRuleImpact counts affected findings', () => {
    const open = [
      { id: 'f1', vulnClass: 'xss', target: 'shop', severity: 'high' },
      { id: 'f2', vulnClass: 'sqli', target: 'shop', severity: 'critical' },
      { id: 'f3', vulnClass: 'xss', target: 'blog', severity: 'low' },
    ];
    const sim = FPI.simulateFpRuleImpact(
      { id: 'r1', name: 'dismiss shop xss', matcher: { vulnClass: 'xss', target: 'shop' } },
      open, NOW);
    assert.equal(sim.affectedCount, 1);
    assert.equal(sim.openCount, 3);
    assert.equal(sim.affectedFindings[0].findingId, 'f1');
    assert.equal(sim.warning, null);
  });
  test('52121 simulator warns on critical findings', () => {
    const sim = FPI.simulateFpRuleImpact(
      { id: 'r2', name: 'dismiss all shop', matcher: { target: 'shop' } },
      [{ id: 'f2', vulnClass: 'sqli', target: 'shop', severity: 'critical' }], NOW);
    assert.ok(sim.warning, 'warning expected for critical');
  });
  test('52122 exportFpBundle exports with evidence, rejects evidence-less', () => {
    const exp = FPI.exportFpBundle([
      { findingId: 'f1', markedBy: 'ria', reasonId: 'expected-behavior', evidence: [{ kind: 'http', body: 'ok' }] },
      { findingId: 'f2', reasonId: 'x', evidence: [] },
    ], NOW);
    assert.equal(exp.exported, 1);
    assert.equal(exp.rejected, 1);
    assert.equal(exp.bundles[0].evidenceCount, 1);
    assert.equal(exp.bundles[0].schema, 'infinity-ai-fp-decision/v1');
  });
});

describe('retestCore spot checks', () => {
  test('52123 requestRetest requires a finding', () => {
    assert.equal(RT.requestRetest(null, {}, NOW).ok, false);
    const r = RT.requestRetest({ id: 'f1', title: 'XSS' }, { priority: 'urgent' }, NOW);
    assert.ok(r.ok);
    assert.equal(r.request.priority, 'urgent');
    assert.equal(r.request.status, 'queued');
  });
  test('52124 autoQueueOnFixDeployed sets trigger and urgent priority', () => {
    RT.__resetRetestSeq();
    const r = RT.autoQueueOnFixDeployed({ id: 'f1' }, { ref: 'd1' }, NOW);
    assert.ok(r.ok);
    assert.equal(r.request.trigger, 'fix-deployed');
    assert.equal(r.request.priority, 'urgent');
  });
  test('52125 buildMutatedPayloads is deterministic and non-empty', () => {
    const a = RT.buildMutatedPayloads('<script>', 4);
    const b = RT.buildMutatedPayloads('<script>', 4);
    assert.deepEqual(a, b);
    assert.ok(a.length >= 4, `expected at least 4 unique payloads, got ${a.length}`);
    assert.equal(new Set(a).size, a.length, 'payloads are unique');
    assert.equal(a[0], '<script>');
  });
  test('52126 scheduleRetest rejects past times', () => {
    RT.__resetRetestSeq();
    const req = RT.requestRetest({ id: 'f1' }, {}, NOW).request;
    assert.equal(RT.scheduleRetest(req, NOW - 1, NOW).ok, false);
    const ok = RT.scheduleRetest(req, NOW + 3600000, NOW);
    assert.ok(ok.ok);
    assert.equal(ok.request.status, 'scheduled');
  });
  test('52127 queueSummary counts and ETA', () => {
    const s = RT.queueSummary([
      { id: 'a', status: 'queued', requestedAt: NOW - 5, requestedBy: 'ria' },
      { id: 'b', status: 'running', requestedAt: NOW - 4, requestedBy: 'ria' },
    ], NOW);
    assert.equal(s.total, 2);
    assert.equal(s.pending, 1);
    assert.equal(s.running, 1);
    assert.deepEqual(s.owners, ['ria']);
  });
  test('52128 applyScopePicker rejects empty scope', () => {
    assert.equal(RT.applyScopePicker({ id: 'r1' }, {}).ok, false);
    const ok = RT.applyScopePicker({ id: 'r1' }, { endpoints: ['/a'] });
    assert.ok(ok.ok);
  });
  test('52129 diffRetestReport verdicts', () => {
    assert.equal(RT.diffRetestReport({ id: 'f1', severity: 'high' }, { stillVulnerable: false }).verdict, 'fixed');
    assert.equal(RT.diffRetestReport({ id: 'f1', severity: 'high' }, { stillVulnerable: true }).verdict, 'still-vulnerable');
    assert.equal(RT.diffRetestReport({ id: 'f1', severity: 'high' }, { stillVulnerable: true, behaviorChanged: true }).verdict, 'changed-behavior');
  });
  test('52130 estimateRetestCost scales with depth', () => {
    const shallow = RT.estimateRetestCost({ id: 'r1', options: { depth: 'shallow' } });
    const deep = RT.estimateRetestCost({ id: 'r1', options: { depth: 'deep', brain: 'vision' } });
    assert.ok(deep.computeUnits > shallow.computeUnits);
  });
  test('52131 prioritizeQueue orders urgent first', () => {
    RT.__resetRetestSeq();
    const q = ['low', 'urgent', 'normal'].map((p, i) => ({ id: `x${i}`, priority: p, requestedAt: NOW }));
    assert.deepEqual(RT.prioritizeQueue(q).map((r) => r.priority), ['urgent', 'normal', 'low']);
    assert.equal(RT.setRetestPriority({ id: 'r1' }, 'bogus').ok, false);
  });
  test('52132/52133 triage quick retest and thin-evidence auto-retest', () => {
    const quick = RT.triageQuickRetest({ id: 'f1', evidenceStrength: 'thin' }, NOW);
    assert.ok(quick.ok);
    assert.equal(RT.triageQuickRetest({ id: 'f1', evidenceStrength: 'strong' }, NOW).ok, false);
    const auto = RT.autoRetestThinEvidence([{ id: 'f1', evidenceStrength: 'thin', status: 'open' }], NOW);
    assert.equal(auto.queued.length, 1);
    assert.equal(auto.queued[0].trigger, 'auto-thin-evidence');
  });
  test('52134 retestWithBrain validates brain', () => {
    assert.equal(RT.retestWithBrain({ id: 'r1' }, 'nope').ok, false);
    const ok = RT.retestWithBrain({ id: 'r1' }, 'vision');
    assert.ok(ok.ok && ok.request.secondOpinion);
  });
  test('52135 setStealthMode toggles', () => {
    assert.equal(RT.setStealthMode({ id: 'r1' }, true).request.options.stealth, true);
    assert.equal(RT.setStealthMode({ id: 'r1' }, false).request.options.stealth, false);
  });
  test('52136 checkConcurrency enforces cap', () => {
    const c = RT.checkConcurrency('shop', [{ target: 'shop', status: 'running' }, { target: 'shop', status: 'running' }], 2);
    assert.equal(c.allowed, false);
    assert.ok(c.reason);
    const free = RT.checkConcurrency('shop', [{ target: 'shop', status: 'running' }], 2);
    assert.equal(free.allowed, true);
  });
  test('52137/52156 notifications include requester and watchers', () => {
    const req = { id: 'rt-1', requestedBy: 'ria', title: 'R', findingId: 'f1' };
    const n = RT.buildCompletionNotification(req, 'fixed', ['sam'], NOW);
    assert.deepEqual(n.to.sort(), ['ria', 'sam']);
    const a = RT.buildFailureAlert(req, { kind: 'target-down', message: 'refused' }, ['sam'], NOW);
    assert.ok(a.subject.includes('failed'));
  });
  test('52138 appendRetestHistory accumulates attempts', () => {
    const f = RT.appendRetestHistory({ id: 'f1' }, { id: 'a1', outcome: 'ok', verdict: 'fixed' });
    assert.equal(f.retestHistory.length, 1);
    const f2 = RT.appendRetestHistory(f, { id: 'a2', outcome: 'ok', verdict: 'fixed' });
    assert.equal(f2.retestHistory.length, 2);
  });
  test('52139 slaStatus flags breach', () => {
    const req = { id: 'r1', requestedAt: NOW - 5 * 3600000, status: 'running' };
    const s = RT.slaStatus(req, { severity: 'critical' }, NOW);
    assert.equal(s.breached, true);
    const fresh = RT.slaStatus({ id: 'r2', requestedAt: NOW, status: 'running' }, { severity: 'low' }, NOW);
    assert.equal(fresh.breached, false);
  });
  test('52140 bulkRequestRetests queues N requests', () => {
    const r = RT.bulkRequestRetests([{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }], {}, NOW);
    assert.equal(r.count, 3);
  });
  test('52141 save/applyRetestTemplate round trip', () => {
    const saved = RT.saveRetestTemplate([], 'stealth', { stealth: true }, NOW);
    assert.equal(saved.templates.length, 1);
    const applied = RT.applyRetestTemplate({ id: 'f1' }, saved.template, {}, NOW);
    assert.ok(applied.ok);
    assert.equal(applied.request.templateId, saved.template.id);
    assert.equal(applied.request.options.stealth, true);
  });
  test('52142 deployWebhookTrigger matches target', () => {
    const r = RT.deployWebhookTrigger(
      [{ id: 'f1', target: 'shop', status: 'open' }, { id: 'f2', target: 'blog', status: 'open' }],
      { id: 'd1', target: 'shop', ref: 'abc' }, NOW);
    assert.equal(r.matched, 1);
    assert.equal(r.requests[0].trigger, 'deploy-webhook');
  });
  test('52143 approval workflow approve/reject', () => {
    RT.__resetRetestSeq();
    const req = RT.requestRetest({ id: 'f1' }, {}, NOW).request;
    const pending = RT.requestRetestApproval(req, 'lead', NOW);
    assert.equal(pending.request.status, 'awaiting-approval');
    const approved = RT.decideRetestApproval(pending, true, NOW);
    assert.equal(approved.request.status, 'queued');
    const rejected = RT.decideRetestApproval(pending, false, NOW);
    assert.equal(rejected.request.status, 'cancelled');
  });
  test('52144 checkRetestBudget warning and blocked states', () => {
    assert.equal(RT.checkRetestBudget(40, 100, NOW).state, 'ok');
    assert.equal(RT.checkRetestBudget(85, 100, NOW).state, 'warning');
    assert.equal(RT.checkRetestBudget(100, 100, NOW).state, 'blocked');
  });
  test('52145 refreshRetestEvidence replaces PoC', () => {
    const a = RT.refreshRetestEvidence({ id: 'a1', evidence: [{ body: 'old' }] }, [{ body: 'new' }]);
    assert.equal(a.evidence.length, 1);
    assert.equal(a.stalePoCReplaced, true);
  });
  test('52146 compareEnvironments consistent/divergent', () => {
    assert.equal(RT.compareEnvironments({ staging: { verdict: 'fixed' }, production: { verdict: 'fixed' } }).verdict, 'consistent');
    assert.equal(RT.compareEnvironments({ staging: { verdict: 'fixed' }, production: { verdict: 'still-vulnerable' } }).verdict, 'divergent');
  });
  test('52147 inRetestWindow respects days/hours', () => {
    const w = [{ days: [6, 0], startHour: 1, endHour: 5 }];
    assert.equal(RT.inRetestWindow(Date.UTC(2023, 10, 18, 2, 30), w), true); // Sat 02:30 UTC
    assert.equal(RT.inRetestWindow(Date.UTC(2023, 10, 15, 12, 0), w), false); // Wed 12:00 UTC
    const v = RT.validateRetestWindow({ scheduledAt: Date.UTC(2023, 10, 18, 2, 30) }, w, NOW);
    assert.equal(v.ok, true);
  });
  test('52148 backoffForRetest grows exponentially', () => {
    assert.equal(RT.backoffForRetest(0).delayMs, 0);
    assert.ok(RT.backoffForRetest(2).delayMs > RT.backoffForRetest(1).delayMs);
  });
  test('52149 dryRunPreview sends nothing', () => {
    const p = RT.dryRunPreview({ id: 'r1', originalPayload: '<x>', scope: { endpoints: ['/a', '/b'] } });
    assert.equal(p.dryRun, true);
    assert.ok(p.totalRequests > 0);
    assert.ok(p.wouldSend.every((s) => s.method && s.endpoint));
  });
  test('52150 attachAuthSession requires a session', () => {
    assert.equal(RT.attachAuthSession({ id: 'r1' }, null).ok, false);
    const ok = RT.attachAuthSession({ id: 'r1' }, { id: 's1', principal: 't' });
    assert.ok(ok.ok);
    assert.equal(ok.request.auth.sessionId, 's1');
  });
  test('52151 buildReplayPlan orders steps', () => {
    const p = RT.buildReplayPlan([{ method: 'GET', url: '/a' }, { method: 'POST', url: '/b' }]);
    assert.equal(p.total, 2);
    assert.deepEqual(p.steps.map((s) => s.order), [1, 2]);
  });
  test('52152 parameterSweep dedupes', () => {
    const s = RT.parameterSweep('q', ['query', 'q']);
    assert.deepEqual(s.swept, ['q', 'query']);
  });
  test('52153 depthConfig validates mode', () => {
    assert.equal(RT.depthConfig('bogus').ok, false);
    assert.equal(RT.depthConfig('deep').config.maxRequests, 200);
  });
  test('52154 selectRetestEngines filters to available', () => {
    assert.equal(RT.selectRetestEngines({ id: 'r1' }, ['nope'], ['vulnDetector']).ok, false);
    const ok = RT.selectRetestEngines({ id: 'r1' }, ['vulnDetector', 'nope'], ['vulnDetector']);
    assert.deepEqual(ok.request.engines, ['vulnDetector']);
  });
  test('52155 append/formatRetestLog round trip', () => {
    const a = RT.appendRetestLog({ id: 'a1' }, { step: 'send', detail: 'GET /x' }, NOW);
    const text = RT.formatRetestLog(a);
    assert.ok(text.includes('send') && text.includes('GET /x'));
  });
  test('52157 assignRetest validates assignee and due date', () => {
    assert.equal(RT.assignRetest({ id: 'r1' }, null, null, NOW).ok, false);
    assert.equal(RT.assignRetest({ id: 'r1' }, 'sam', NOW - 1, NOW).ok, false);
    assert.ok(RT.assignRetest({ id: 'r1' }, 'sam', NOW + 1000, NOW).ok);
  });
  test('52158 classifyRetestWork distinguishes kinds', () => {
    assert.equal(RT.classifyRetestWork({ id: 'r1', kind: 'retest' }).workflow, 'targeted-verification-workflow');
    assert.equal(RT.classifyRetestWork({ id: 'r2', kind: 'regression' }).workflow, 'full-hunt-workflow');
  });
  test('52159 escalateStillVulnerable targets assignee and manager', () => {
    const e = RT.escalateStillVulnerable({ id: 'r1' }, { id: 'f1', assignee: 'ria', severity: 'high' }, 'mgr', NOW);
    assert.ok(e.ok);
    assert.deepEqual(e.escalation.escalatedTo, ['ria', 'mgr']);
  });
  test('52160 issueVerificationCertificate only for fixed', () => {
    assert.equal(RT.issueVerificationCertificate({ id: 'f1' }, 'still-vulnerable', 'infinity-ai', NOW).ok, false);
    const c = RT.issueVerificationCertificate({ id: 'f1' }, 'fixed', 'infinity-ai', NOW);
    assert.ok(c.ok);
    assert.equal(c.certificate.verifiedFixedOn, '2023-11-14');
    assert.ok(c.certificate.signature.length > 0);
    assert.equal(c.certificate.issuer, 'infinity-ai');
  });
});

describe('JSX parse check', () => {
  test('RetestSuite.jsx and FPImpact.jsx parse as valid JSX via esbuild', () => {
    const require = createRequire(import.meta.url);
    let esbuild = null;
    try {
      esbuild = require('esbuild');
    } catch {
      esbuild = null;
    }
    if (!esbuild) {
      const npxPath = join(HERE, '..', '..', '..', 'node_modules', '.bin', 'esbuild');
      if (!existsSync(npxPath)) {
        console.log('esbuild not available — JSX parse check skipped gracefully');
        return;
      }
      throw new Error('esbuild binary present but require failed');
    }
    for (const f of ['RetestSuite.jsx', 'FPImpact.jsx']) {
      const code = readFileSync(join(HERE, f), 'utf8');
      esbuild.transformSync(code, { loader: 'jsx' });
    }
  });
});

describe('self audits', () => {
  test('all 6 new wave-54 files exist', () => {
    for (const f of NEW_FILES) {
      assert.ok(existsSync(join(HERE, f)), `${f} is missing`);
    }
  });
  test('none of the 5 product files contain TODO/FIXME/XXX/mock/simulate/lorem/demo placeholder text', () => {
    const pattern = /\b(todo|fixme|xxx|hack|mock|simulate|lorem|demo)\b/i;
    for (const f of NEW_FILES.filter((x) => x !== 'wave54.test.js')) {
      const content = readFileSync(join(HERE, f), 'utf8');
      const hit = content.match(pattern);
      assert.ok(!hit, `${f} contains debris marker: "${hit && hit[0]}"`);
    }
  });
  test('Wave54.css has zero @keyframes, transitions, and animations', () => {
    const css = readFileSync(join(HERE, 'Wave54.css'), 'utf8');
    assert.ok(!css.includes('@keyframes'), 'no @keyframes allowed');
    assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
    assert.ok(!/animation\s*:/i.test(css), 'no animations allowed');
  });
  test('Wave54.css uses only scoped prefixes .rt54-* and .fpi54-*', () => {
    const css = readFileSync(join(HERE, 'Wave54.css'), 'utf8');
    const classSelectors = css.match(/^\.[a-zA-Z][a-zA-Z0-9_-]*/gm) || [];
    const rogue = classSelectors.filter((c) => !c.startsWith('.rt54-') && !c.startsWith('.fpi54-'));
    assert.deepEqual(rogue, [], `unscoped selectors: ${rogue.join(', ')}`);
  });
  test('Infinity AI branding only — no other worker name in product files', () => {
    const productFiles = NEW_FILES.filter((f) => f !== 'wave54.test.js');
    for (const f of productFiles) {
      const content = readFileSync(join(HERE, f), 'utf8');
      assert.ok(!/\b[mM]use\b/.test(content), `${f} mentions the forbidden worker name`);
    }
  });
  test('RetestSuite.jsx exports one component per idea 52123–52160', () => {
    const src = readFileSync(join(HERE, 'RetestSuite.jsx'), 'utf8');
    for (let id = 52123; id <= 52160; id++) {
      assert.ok(new RegExp(`\\/\\* ${id} —`).test(src), `RetestSuite.jsx missing component comment for idea ${id}`);
    }
  });
});
