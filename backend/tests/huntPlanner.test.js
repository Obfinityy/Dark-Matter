/**
 * Tests for the Hunt Planner engine pack (ideas 30005–30014, issue #26):
 * scopeRuleParser, targetTypeClassifier, budgetTimeConverter,
 * payoutPriorWeights, planModuleFilter, planDryRun, planTournament,
 * intentEncoder, planVersionLedger, coldStartPlanner, huntPlanner.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseScopeRules, isActionPermitted } from '../src/engines/scopeRuleParser.js';
import { classifyTarget, selectPlanTemplate } from '../src/engines/targetTypeClassifier.js';
import { convertBudgetToMinutes } from '../src/engines/budgetTimeConverter.js';
import { payoutWeights, rankByPayout } from '../src/engines/payoutPriorWeights.js';
import { filterPlanModules, PLAN_MODULES } from '../src/engines/planModuleFilter.js';
import { syntheticTargetGraph, dryRunPlan } from '../src/engines/planDryRun.js';
import { generateCandidates, runTournament } from '../src/engines/planTournament.js';
import { encodeIntent } from '../src/engines/intentEncoder.js';
import { createPlanLedger } from '../src/engines/planVersionLedger.js';
import { seedColdStartModules, needsColdStart } from '../src/engines/coldStartPlanner.js';
import { planHunt, getPlannerLedger } from '../src/engines/huntPlanner.js';

describe('30005 scopeRuleParser', () => {
  it('extracts forbidden actions from rules prose', () => {
    const r = parseScopeRules('Do not perform subdomain brute-forcing. Port scanning is prohibited. No social engineering.');
    assert.ok(r.forbidden.includes('subdomain-bruteforce'));
    assert.ok(r.forbidden.includes('port-scanning'));
    assert.ok(r.forbidden.includes('social-engineering'));
  });
  it('extracts allowed actions', () => {
    const r = parseScopeRules('In scope: XSS testing and SQL injection testing are encouraged.');
    assert.ok(r.allowed.includes('xss-testing'));
    assert.ok(r.allowed.includes('sqli-testing'));
  });
  it('forbid wins over allow', () => {
    const r = parseScopeRules('XSS testing is allowed. Do not do XSS testing.');
    assert.ok(!r.allowed.includes('xss-testing'));
    assert.ok(r.forbidden.includes('xss-testing'));
  });
  it('isActionPermitted reports correctly', () => {
    const r = parseScopeRules('Do not run automated scanners.');
    assert.equal(isActionPermitted(r, 'automated-scanning').permitted, false);
    assert.equal(isActionPermitted(r, 'xss-testing').permitted, true);
  });
});

describe('30006 targetTypeClassifier', () => {
  it('classifies an e-commerce target', () => {
    const c = classifyTarget({ domain: 'shop.example', tech: ['Shopify'], paths: ['/cart', '/checkout'] });
    assert.equal(c.type, 'ecommerce');
    assert.ok(c.confidence > 0.5);
    assert.ok(c.template.phases.includes('cart-flow'));
  });
  it('classifies an API-only target', () => {
    const c = classifyTarget({ domain: 'api.example', tech: ['FastAPI'], paths: ['/api/v1/users', '/graphql'] });
    assert.equal(c.type, 'api-only');
  });
  it('falls back to unknown with a generic template', () => {
    const c = classifyTarget({ domain: 'x.example', tech: [], paths: [] });
    assert.equal(c.type, 'unknown');
    assert.ok(selectPlanTemplate(c).phases.includes('recon'));
  });
});

describe('30007 budgetTimeConverter', () => {
  it('converts hours into phase minutes summing to the total', () => {
    const { totalMinutes, allocations } = convertBudgetToMinutes({ hours: 4 }, ['recon', 'testing', 'chaining', 'reporting']);
    assert.equal(totalMinutes, 240);
    assert.equal(Object.values(allocations).reduce((s, v) => s + v, 0), 240);
    assert.ok(allocations.testing > allocations.reporting);
  });
  it('converts dollars via the hourly rate', () => {
    const { totalMinutes } = convertBudgetToMinutes({ dollars: 150 }, ['recon', 'testing']);
    assert.equal(totalMinutes, 120);
  });
});

describe('30008 payoutPriorWeights', () => {
  it('weights sum to 1 and rce outranks info-leak', () => {
    const w = payoutWeights(['rce', 'xss', 'info-leak']);
    assert.ok(Math.abs(Object.values(w).reduce((s, v) => s + v, 0) - 1) < 0.01);
    assert.ok(w.rce > w['info-leak']);
  });
  it('rankByPayout sorts descending', () => {
    const ranked = rankByPayout(['xss', 'rce']);
    assert.equal(ranked[0].class, 'rce');
  });
});

describe('30009 planModuleFilter', () => {
  it('removes modules whose actions are forbidden', () => {
    const rules = parseScopeRules('Do not perform subdomain brute-forcing. No automated scanners.');
    const { kept, removed } = filterPlanModules(PLAN_MODULES, rules);
    assert.ok(!kept.some((m) => m.id === 'subdomain-enum'));
    assert.ok(!kept.some((m) => m.id === 'scanner-pass'));
    assert.ok(removed.some((r) => r.module.id === 'subdomain-enum'));
    assert.ok(removed[0].reason.includes('forbidden'));
  });
  it('keeps everything when rules are empty', () => {
    const { kept, removed } = filterPlanModules(PLAN_MODULES, { allowed: [], forbidden: [] });
    assert.equal(kept.length, PLAN_MODULES.length);
    assert.equal(removed.length, 0);
  });
});

describe('30010 planDryRun', () => {
  it('estimates coverage on a synthetic graph with zero traffic', () => {
    const graph = syntheticTargetGraph({ hosts: 2, pathsPerHost: 5, seed: 7 });
    assert.equal(graph.nodes.length, 12);
    const res = dryRunPlan({ modules: PLAN_MODULES.slice(0, 4) }, graph);
    assert.ok(res.coverage > 0 && res.coverage <= 1);
    assert.equal(res.totalNodes, 12);
    assert.ok(Object.keys(res.perModule).length === 4);
  });
});

describe('30011 planTournament', () => {
  it('generates 3 candidates and picks a winner', () => {
    const allocs = { recon: 60, testing: 120, reporting: 30 };
    const { winner, scored } = runTournament(PLAN_MODULES.slice(0, 6), allocs, { rce: 0.5, xss: 0.3 });
    assert.equal(scored.length, 3);
    assert.ok(scored[0].score >= scored[2].score);
    assert.ok(winner.modules.length > 0);
  });
  it('candidate names are breadth/depth/balanced', () => {
    const c = generateCandidates(PLAN_MODULES.slice(0, 4), { recon: 30 });
    assert.deepEqual(c.map((x) => x.name).sort(), ['balanced', 'breadth-first', 'depth-first']);
  });
});

describe('30012 intentEncoder', () => {
  it('encodes "find RCE only" as an exclusive rce objective', () => {
    const e = encodeIntent('find RCE only');
    assert.ok(e.objectives.rce > 0);
    assert.equal(e.exclusive, true);
  });
  it('encodes multi-class goals', () => {
    const e = encodeIntent('focus on XSS and IDOR');
    assert.ok(e.objectives.xss > 0 && e.objectives.idor > 0);
  });
  it('falls back to broad for vague goals', () => {
    const e = encodeIntent('do a good hunt');
    assert.ok(e.objectives.broad > 0);
  });
});

describe('30013 planVersionLedger', () => {
  it('versions plans and tracks hunts per version', () => {
    const ledger = createPlanLedger();
    const v1 = ledger.savePlan({ modules: ['a'] });
    const v2 = ledger.savePlan({ modules: ['a', 'b'] });
    assert.equal(v1, 'v1');
    assert.equal(v2, 'v2');
    ledger.recordHunt('hunt-1', 'v1');
    ledger.recordHunt('hunt-2', 'v1');
    assert.deepEqual(ledger.huntsForVersion('v1'), ['hunt-1', 'hunt-2']);
    const listed = ledger.listVersions();
    assert.equal(listed.find((l) => l.version === 'v1').huntCount, 2);
    assert.ok(ledger.getVersion('v2').plan.modules.includes('b'));
  });
  it('rejects hunts recorded against unknown versions', () => {
    const ledger = createPlanLedger();
    assert.throws(() => ledger.recordHunt('h-x', 'v99'), /unknown plan version/);
  });
});

describe('30014 coldStartPlanner', () => {
  it('seeds modules for a type with no history', () => {
    assert.equal(needsColdStart('api-only', {}), true);
    const seeded = seedColdStartModules('api-only');
    assert.ok(seeded.modules.includes('api-mapping'));
    assert.ok(seeded.source.includes('api-only'));
  });
  it('skips cold start when history exists', () => {
    assert.equal(needsColdStart('saas', { saas: 3 }), false);
  });
});

describe('huntPlanner orchestrator', () => {
  it('builds a versioned, scope-safe plan end to end', () => {
    const { version, plan } = planHunt({
      scopeText: 'Do not perform subdomain brute-forcing. In scope: XSS and SQLi testing.',
      target: { domain: 'shop.example', tech: ['Shopify'], paths: ['/cart'] },
      budget: { hours: 4 },
      userGoal: 'focus on XSS',
    });
    assert.match(version, /^v\d+$/);
    assert.equal(plan.targetType, 'ecommerce');
    assert.ok(plan.totalMinutes === 240);
    assert.ok(!plan.modules.some((m) => m.id === 'subdomain-enum'), 'forbidden module must be filtered');
    assert.ok(plan.removedModules.some((r) => r.id === 'subdomain-enum'));
    assert.ok(plan.coverage.coverage > 0);
    assert.ok(['breadth-first', 'depth-first', 'balanced'].includes(plan.strategy));
  });
  it('30005→30009 wiring: forbidden action from scope text is provably excluded', () => {
    const { plan } = planHunt({
      scopeText: 'Port scanning is strictly prohibited.',
      target: { domain: 'api.example', tech: ['FastAPI'], paths: ['/api/v1'] },
      budget: { hours: 2 },
      userGoal: '',
    });
    assert.ok(plan.forbidden.includes('port-scanning'));
    assert.ok(!plan.modules.some((m) => m.id === 'port-scan'));
  });
  it('shares one ledger across plans for A/B tracking', () => {
    const a = planHunt({ target: { domain: 'a.example' }, budget: { hours: 1 } });
    const b = planHunt({ target: { domain: 'b.example' }, budget: { hours: 1 } });
    assert.notEqual(a.version, b.version);
    const ledger = getPlannerLedger();
    assert.ok(ledger.getVersion(a.version));
    assert.ok(ledger.getVersion(b.version));
  });
});
