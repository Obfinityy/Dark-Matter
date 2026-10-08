/**
 * wave72.test.js — Infinity AI · Dark-Matter · Wave 72
 * node:test + node:assert/strict. Registry coverage (20/20 for 52841–52860,
 * 20/20 for 52861–52880, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave72.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE72_A_IDEAS } from './wave72ACore.js';
import * as XA from './wave72ACore.js';
import { WAVE72_B_IDEAS } from './wave72BCores.js';
import * as XB from './wave72BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave72ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave72BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave72A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave72B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave72.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

const FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'confirmed', target: 'shop.example.com/checkout', cwe: 'CWE-89', riskScore: 92, authRequired: false, authContext: 'none', payload: "' OR 1=1 --", cvss: { score: 9.8, vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }, tags: ['checkout', 'payment'], dataTypes: ['customer or order records'], evidence: ['Unauthenticated checkout query returned every order id and customer email', 'Database error page confirmed the query reaches the orders table'], pocSteps: [{ action: 'Open the checkout search without a login', expected: 'Normal results only', observed: 'Full order list' }, { action: 'Submit the recorded input', expected: 'Treated as data', observed: 'Orders returned' }], impact: 'Customer order and payment records could be read by anyone.', verifiedBy: 'verifier-1', createdAt: '2026-10-01T09:00:00Z', sharedServices: ['payments-db'], history: [{ from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-02T09:00:00Z', reason: 'reproduced' }] },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'fixing', target: 'shop.example.com/search', cwe: 'CWE-79', riskScore: 74, authRequired: true, payload: '<script>alert(1)</script>', tags: ['search'], evidence: ['Reflected script executed in a shopper session'], pocSteps: [{ action: 'Search with the recorded script input', expected: 'Shown as text', observed: 'Script ran' }], impact: 'A shopper session could be hijacked from the search page.', createdAt: '2026-10-03T09:00:00Z', sharedServices: [] },
  { id: 'f3', title: 'IDOR in invoices', severity: 'high', status: 'triaged', target: 'api.example.com/invoices/1001', cwe: 'CWE-862', riskScore: 81, authRequired: true, authContext: 'user', tags: ['invoice', 'billing'], dataTypes: ['financial records'], evidence: ['Invoice of another customer opened by changing the id; billing data shown'], impact: 'Customers could read each others invoices and billing data.', createdAt: '2026-10-04T09:00:00Z', sharedServices: ['payments-db'] },
  { id: 'f4', title: 'Verbose errors in profile', severity: 'low', status: 'dismissed', target: 'shop.example.com/profile', cwe: 'CWE-209', riskScore: 21, falsePositive: true, fpReason: 'Stack trace only appears on the internal staging build, not production', fpDecidedBy: 'lead-1', fpDecidedAt: '2026-10-06T09:00:00Z', fpEvidence: ['Production profile returns a generic error page'], evidence: ['Stack trace in error screen on staging'], impact: 'Internal paths were visible on staging only.', createdAt: '2026-10-02T09:00:00Z' },
  { id: 'f5', title: 'Open redirect on logout', severity: 'medium', status: 'confirmed', target: 'shop.example.com/logout', cwe: 'CWE-601', riskScore: 44, authRequired: false, evidence: ['Unauthenticated logout link redirected to an external site without login'], impact: 'Users could be sent to a look-alike site after logout.', createdAt: '2026-10-05T09:00:00Z' },
];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 Q&A round 2 ideas, 20/20 round 3 ideas, zero skips', () => {
  assert.equal(WAVE72_A_IDEAS.length, 20);
  assert.equal(WAVE72_B_IDEAS.length, 20);
  const all = [...WAVE72_A_IDEAS, ...WAVE72_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52841 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE72_A_IDEAS, ...WAVE72_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52841].includes('boss-friendly summaries'));
  assert.ok(byId[52842].includes('fix-prioritization advice'));
  assert.ok(byId[52843].includes('auth-requirement analysis'));
  assert.ok(byId[52844].includes('data-at-risk inventory'));
  assert.ok(byId[52845].includes('similar past findings lookup'));
  assert.ok(byId[52846].includes('fp-justification recall'));
  assert.ok(byId[52847].includes('step-by-step poc narration'));
  assert.ok(byId[52848].includes('payload anatomy q&a'));
  assert.ok(byId[52849].includes('next-step brainstorming'));
  assert.ok(byId[52850].includes('regression-checklist generation'));
  assert.ok(byId[52851].includes('ticket-text drafting'));
  assert.ok(byId[52852].includes('finding translation'));
  assert.ok(byId[52853].includes('compliance-mapping q&a'));
  assert.ok(byId[52854].includes('bounty-value estimation'));
  assert.ok(byId[52855].includes('duplicate-suspicion q&a'));
  assert.ok(byId[52856].includes('root-cause analysis q&a'));
  assert.ok(byId[52857].includes('fix-verification guidance'));
  assert.ok(byId[52858].includes('test-case suggestions'));
  assert.ok(byId[52859].includes('three-bullet hunt summary'));
  assert.ok(byId[52860].includes('unauthenticated-findings list'));
  assert.ok(byId[52861].includes('payment-flow risk q&a'));
  assert.ok(byId[52862].includes('real-world exploitability ranking'));
  assert.ok(byId[52863].includes('agent learning recap'));
  assert.ok(byId[52864].includes('reasoning-trace browser'));
  assert.ok(byId[52865].includes("devil's-advocate challenge"));
  assert.ok(byId[52866].includes('fix-option comparison'));
  assert.ok(byId[52867].includes('cheapest-fix finder'));
  assert.ok(byId[52868].includes('disclosure-timeline drafting'));
  assert.ok(byId[52869].includes('fix-owner recommendation'));
  assert.ok(byId[52870].includes('scope-eligibility check'));
  assert.ok(byId[52871].includes('non-technical rewrite'));
  assert.ok(byId[52872].includes('exec-slide generation'));
  assert.ok(byId[52873].includes('pr-description drafting'));
  assert.ok(byId[52874].includes('detection-suggestion q&a'));
  assert.ok(byId[52875].includes('waf-rule suggestion'));
  assert.ok(byId[52876].includes('chain-membership q&a'));
  assert.ok(byId[52877].includes('cvss vector breakdown'));
  assert.ok(byId[52878].includes('voice q&a with avatar'));
  assert.ok(byId[52879].includes('evidence-cited answers'));
  assert.ok(byId[52880].includes('q&a history per hunt'));
});

/* ---- Wave72 A spot checks (52841–52860) ---- */
test('52841 buildBossSummary: plain headline, bullets, urgency', () => {
  const v = XA.buildBossSummary(FINDINGS[0]);
  assert.equal(v.audience, 'leadership');
  assert.equal(v.bullets.length, 3);
  assert.equal(v.bullets[1], 'Who can use it: Anyone on the internet could use it, with no account needed.');
  assert.ok(v.urgency.includes('Fix before the next release'));
  assert.ok(v.headline.includes('SQLi in checkout'));
});

test('52842 prioritizeFixes: critical no-login finding ranks first', () => {
  const v = XA.prioritizeFixes(FINDINGS);
  assert.equal(v.ranked.length, 5);
  assert.equal(v.topPick.id, 'f1');
  assert.equal(v.ranked[0].rank, 1);
  assert.ok(v.ranked[0].reasons.includes('reachable without login'));
  assert.equal(FINDINGS[0].rank, undefined);
});

test('52843 analyzeAuthRequirement: explicit flags and evidence decide', () => {
  const open = XA.analyzeAuthRequirement(FINDINGS[0]);
  assert.equal(open.requiresAuth, false);
  assert.equal(open.exploitableWithoutLogin, true);
  assert.equal(open.confidence, 'high');
  const gated = XA.analyzeAuthRequirement(FINDINGS[1]);
  assert.equal(gated.requiresAuth, true);
  assert.equal(gated.exploitableWithoutLogin, false);
});

test('52844 buildDataAtRiskInventory: declared and detected data merged', () => {
  const v = XA.buildDataAtRiskInventory(FINDINGS);
  assert.equal(v.highestSensitivity, 'high');
  assert.ok(v.inventory.some(i => i.category === 'customer or order records'));
  assert.ok(v.inventory.length >= 3);
  assert.equal(v.totalFindings, 5);
});

test('52845 findSimilarPastFindings: same weakness and host match', () => {
  const past = [{ id: 'p1', title: 'SQLi in product search', severity: 'high', status: 'paid', cwe: 'CWE-89', target: 'shop.example.com', tags: ['sqli'], evidence: ['search query returned all rows'], outcome: 'paid' }];
  const v = XA.findSimilarPastFindings(FINDINGS[0], past);
  assert.equal(v.count, 1);
  assert.equal(v.matches[0].id, 'p1');
  assert.equal(v.matches[0].outcome, 'paid');
  assert.ok(v.matches[0].score > 40);
  const none = XA.findSimilarPastFindings(FINDINGS[0], []);
  assert.equal(none.count, 0);
});

test('52846 recallFalsePositiveJustification: reason and decider recalled', () => {
  const v = XA.recallFalsePositiveJustification(FINDINGS[3]);
  assert.equal(v.isFalsePositive, true);
  assert.ok(v.reason.includes('internal staging'));
  assert.equal(v.decidedBy, 'lead-1');
  assert.equal(v.confidence, 'high');
  const notFp = XA.recallFalsePositiveJustification(FINDINGS[0]);
  assert.equal(notFp.isFalsePositive, false);
});

test('52847 narratePocSteps: recorded steps become narration', () => {
  const v = XA.narratePocSteps(FINDINGS[0]);
  assert.equal(v.stepCount, 2);
  assert.ok(v.steps[0].narration.startsWith('Step 1:'));
  assert.ok(v.steps[0].action.includes('checkout'));
});

test('52848 analyzePayloadAnatomy: SQL technique parts identified', () => {
  const v = XA.analyzePayloadAnatomy(FINDINGS[0]);
  assert.ok(v.techniques.includes('SQL logic injection'));
  assert.ok(v.segments.length >= 1);
  assert.equal(v.payload, "' OR 1=1 --");
});

test('52849 brainstormNextSteps: class-specific ideas prioritized', () => {
  const v = XA.brainstormNextSteps(FINDINGS[0]);
  assert.ok(v.count >= 4);
  assert.equal(v.ideas[0].priority, 1);
  assert.ok(v.ideas.some(i => /sibling/i.test(i.idea)));
});

test('52850 generateRegressionChecklist: per-finding items with required core', () => {
  const v = XA.generateRegressionChecklist(FINDINGS.slice(0, 3));
  assert.equal(v.count, 12);
  assert.equal(v.requiredCount, 6);
  assert.equal(v.items[0].id, 'chk-1');
  assert.equal(v.items[0].findingId, 'f1');
});

test('52851 draftTicketText: priority, labels, repro from proof', () => {
  const v = XA.draftTicketText(FINDINGS[0], { project: 'SEC' });
  assert.equal(v.priority, 'Highest');
  assert.equal(v.project, 'SEC');
  assert.ok(v.summary.startsWith('[Security][critical]'));
  assert.equal(v.reproSteps.length, 2);
  assert.ok(v.labels.includes('security'));
});

test('52852 translateFinding: glossary languages and unsupported handling', () => {
  const es = XA.translateFinding(FINDINGS[0], 'es');
  assert.equal(es.supported, true);
  assert.equal(es.labels.severity, 'crítica');
  const xx = XA.translateFinding(FINDINGS[0], 'xx');
  assert.equal(xx.supported, false);
});

test('52853 mapComplianceControls: frameworks mapped for the theme', () => {
  const v = XA.mapComplianceControls(FINDINGS[0]);
  assert.ok(v.mappings.length >= 1);
  assert.ok(v.frameworksCovered.includes('SOC 2'));
  assert.ok(v.mappings[0].soc2);
});

test('52854 estimateBountyValue: range blends severity, reach, history', () => {
  const v = XA.estimateBountyValue(FINDINGS[0], { history: [{ amount: 2000 }, { amount: 3000 }, { amount: 2500 }], currency: 'USD' });
  assert.equal(v.currency, 'USD');
  assert.ok(v.estimateLow < v.midpoint && v.midpoint < v.estimateHigh);
  assert.equal(v.confidence, 'high');
  assert.ok(v.rationale.length >= 3);
});

test('52855 assessDuplicateSuspicion: near-identical report flagged', () => {
  const twin = { id: 'f9', title: 'SQLi in checkout search', severity: 'critical', cwe: 'CWE-89', target: 'shop.example.com', evidence: FINDINGS[0].evidence };
  const v = XA.assessDuplicateSuspicion(FINDINGS[0], twin);
  assert.equal(v.isLikelyDuplicate, true);
  assert.equal(v.bestMatch.id, 'f9');
  const fresh = XA.assessDuplicateSuspicion(FINDINGS[0], { id: 'f8', title: 'Unrelated banner note', severity: 'info', target: 'blog.example.com', evidence: [] });
  assert.equal(fresh.isLikelyDuplicate, false);
});

test('52856 analyzeRootCause: cause family, factors, fix direction', () => {
  const v = XA.analyzeRootCause(FINDINGS[0]);
  assert.equal(v.category, 'CWE-89');
  assert.equal(v.confidence, 'high');
  assert.ok(v.primaryCause.length > 5);
  assert.ok(v.fixDirection.length > 10);
  assert.equal(v.evidence.length, 2);
});

test('52857 buildFixVerificationGuidance: replay-first steps and criteria', () => {
  const v = XA.buildFixVerificationGuidance(FINDINGS[0]);
  assert.equal(v.steps.length, 5);
  assert.equal(v.steps[0].action, 'Open the checkout search without a login');
  assert.equal(v.steps[0].expected, 'Proof fails safely');
  assert.equal(v.passCriteria.length, 3);
});

test('52858 suggestTestCases: negative, happy, boundary, auth, coverage', () => {
  const v = XA.suggestTestCases(FINDINGS[1]);
  assert.equal(v.count, 6);
  assert.ok(v.coverage.includes('negative'));
  assert.ok(v.coverage.includes('auth'));
  assert.equal(v.cases[0].type, 'negative');
});

test('52859 summarizeHuntThreeBullets: exactly three standup bullets', () => {
  const v = XA.summarizeHuntThreeBullets(FINDINGS, { huntLabel: 'Hunt 42' });
  assert.equal(v.bullets.length, 3);
  assert.equal(v.counts.total, 5);
  assert.equal(v.counts.unauthenticated, 2);
  assert.ok(v.bullets[0].includes('5 finding(s) recorded'));
});

test('52860 listUnauthenticatedFindings: login-free set ranked, rest excluded', () => {
  const v = XA.listUnauthenticatedFindings(FINDINGS);
  assert.equal(v.count, 2);
  assert.deepEqual(v.findings.map(f => f.id), ['f1', 'f5']);
  assert.equal(v.excludedIds.length, 3);
  assert.deepEqual(FINDINGS.map(f => f.id), ['f1', 'f2', 'f3', 'f4', 'f5']);
});

/* ---- Wave72 B spot checks (52861–52880) ---- */
test('52861 filterPaymentFindings: money movement kept, others excluded', () => {
  const v = XB.filterPaymentFindings(FINDINGS, {});
  assert.deepEqual(v.paymentFindings.map(f => f.id), ['f1', 'f3']);
  assert.deepEqual(v.excludedIds, ['f2', 'f4', 'f5']);
  assert.ok(v.answer.includes('Infinity AI'));
  assert.ok(v.exposure > 0);
});

test('52862 rankByExploitability: proven login-free critical ranks first', () => {
  const v = XB.rankByExploitability(FINDINGS, {});
  assert.equal(v.topId, 'f1');
  assert.equal(v.ranked[0].exploitabilityScore, 100);
  assert.equal(v.ranked[0].exploitabilityTier, 'readily-exploitable');
  assert.ok(v.ranked[0].factors.some(f => f.factor === 'no-privileges'));
});

test('52863 summarizeAgentLearnings: recorded and derived modes', () => {
  const recorded = XB.summarizeAgentLearnings({ huntId: 'hunt-42', learnings: [{ pattern: 'Sequential invoice ids', tech: 'api.example.com', confidence: 90 }] }, {});
  assert.equal(recorded.source, 'recorded');
  assert.equal(recorded.patternCount, 1);
  const derived = XB.summarizeAgentLearnings({ huntId: 'hunt-42', findings: FINDINGS }, {});
  assert.equal(derived.source, 'derived-from-findings');
  assert.ok(derived.patternCount >= 2);
});

test('52864 browseReasoningTrace: reconstructed trail with key decisions', () => {
  const v = XB.browseReasoningTrace(FINDINGS[0], {});
  assert.equal(v.source, 'reconstructed');
  assert.equal(v.totalSteps, 3);
  assert.equal(v.keyDecisions.length, 2);
  const recorded = XB.browseReasoningTrace({ id: 'f7', reasoningTrace: [{ action: 'Sent the proof', observation: 'Rows returned', decision: 'Confirmed the weakness' }] }, {});
  assert.equal(recorded.source, 'recorded');
  assert.equal(recorded.totalSteps, 1);
});

test('52865 challengeFinding: thin record challenged, strong record holds', () => {
  const thin = XB.challengeFinding({ id: 'f9', severity: 'low', title: 'Odd banner' }, {});
  assert.equal(thin.verdict, 'likely-false-positive');
  assert.equal(thin.falsePositiveRisk, 95);
  assert.ok(thin.challenges.some(c => c.check === 'missing-proof'));
  const strong = XB.challengeFinding(FINDINGS[0], {});
  assert.equal(strong.verdict, 'likely-valid');
  assert.equal(strong.challengeCount, 0);
  assert.equal(strong.strongestChallenge, null);
});

test('52866 compareFixOptions: three costed options for one weakness', () => {
  const v = XB.compareFixOptions(FINDINGS[0], {});
  assert.equal(v.options.length, 3);
  assert.deepEqual(v.options.map(o => o.effortHours), [3, 10, 30]);
  assert.equal(v.options[1].completeness, 90);
  assert.ok(v.options.some(o => o.id === v.recommendedId));
  assert.ok(v.summary.includes('Infinity AI'));
});

test('52867 findCheapestFix: edge containment with permanent fix queued', () => {
  const v = XB.findCheapestFix(FINDINGS[0], {});
  assert.equal(v.mitigation.kind, 'edge-rule');
  assert.equal(v.mitigation.effortHours, 2);
  assert.equal(v.steps.length, 4);
  assert.ok(v.permanentFix.includes('parameterized'));
});

test('52868 draftDisclosureTimeline: severity window drives the dates', () => {
  const v = XB.draftDisclosureTimeline(FINDINGS[0], {}, {});
  assert.equal(v.milestones.length, 5);
  assert.equal(v.totalDays, 17);
  assert.equal(String(v.disclosureDate).slice(0, 10), '2026-10-18');
  assert.equal(String(v.milestones[2].date).slice(0, 10), '2026-10-08');
});

test('52869 recommendFixOwner: host, service, and expertise scoring', () => {
  const assets = [{ id: 'a1', host: 'shop.example.com', owner: 'meera', team: 'appsec', expertise: ['cwe-89'], sharedServices: ['payments-db'] }];
  const v = XB.recommendFixOwner(FINDINGS[0], assets, {});
  assert.equal(v.recommended.owner, 'meera');
  assert.equal(v.recommended.score, 85);
  assert.equal(v.candidateCount, 1);
  const none = XB.recommendFixOwner(FINDINGS[0], [], {});
  assert.equal(none.recommended, null);
});

test('52870 checkScopeEligibility: in, out, and needs-review decisions', () => {
  const inside = XB.checkScopeEligibility(FINDINGS[0], { program: 'shop program', inScope: ['*.example.com'], outOfScope: [] }, {});
  assert.equal(inside.decision, 'in-scope');
  assert.equal(inside.eligible, true);
  const outside = XB.checkScopeEligibility(FINDINGS[0], { program: 'shop program', inScope: ['*.example.com'], outOfScope: ['shop.example.com'] }, {});
  assert.equal(outside.decision, 'out-of-scope');
  assert.equal(outside.eligible, false);
  const unknown = XB.checkScopeEligibility({ id: 'fx', target: 'other.org' }, { inScope: ['*.example.com'] }, {});
  assert.equal(unknown.decision, 'needs-review');
  assert.equal(unknown.eligible, null);
});

test('52871 rewriteForNonTechnical: jargon becomes plain words', () => {
  const v = XB.rewriteForNonTechnical(FINDINGS[0], {});
  assert.ok(v.plainSummary.includes('database trick'));
  assert.ok(v.severityPlain.includes('very serious'));
  assert.equal(v.findingId, 'f1');
  assert.ok(v.plainSummary.includes('Infinity AI'));
});

test('52872 generateExecSlide: headline, bullets, chart, top findings', () => {
  const hunt = { huntId: 'hunt-42', target: 'shop.example.com', findings: FINDINGS };
  const v = XB.generateExecSlide(hunt, {});
  assert.equal(v.huntId, 'hunt-42');
  assert.equal(v.bullets.length, 4);
  assert.equal(v.topFindings[0].id, 'f1');
  assert.ok(v.chart.data.length >= 3);
  assert.ok(v.footer.includes('Infinity AI'));
  assert.deepEqual(hunt.findings.map(f => f.id), ['f1', 'f2', 'f3', 'f4', 'f5']);
});

test('52873 draftPrDescription: ready only with branch, files, tests', () => {
  const ready = XB.draftPrDescription(FINDINGS[0], { branch: 'fix/f1', files: ['src/checkout/search.js'], tests: ['proof replay blocked'] }, {});
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.missing, []);
  assert.ok(ready.body.includes('## Verification'));
  assert.ok(ready.labels.includes('severity:critical'));
  const bare = XB.draftPrDescription(FINDINGS[0], {}, {});
  assert.equal(bare.ready, false);
  assert.deepEqual(bare.missing, ['branch', 'changed files', 'recorded tests']);
});

test('52874 suggestDetections: host and path templated queries', () => {
  const v = XB.suggestDetections(FINDINGS[0], {});
  assert.equal(v.detectionCount, 2);
  assert.ok(v.detections[0].query.includes('shop.example.com'));
  assert.ok(v.detections[1].query.includes('/checkout'));
  assert.ok(v.detections[0].threshold.includes('3 matches'));
});

test('52875 suggestWafRule: detection-first stopgap with caveats', () => {
  const v = XB.suggestWafRule(FINDINGS[1], {});
  assert.equal(v.syntax, 'ModSecurity');
  assert.equal(v.startMode, 'detection-only');
  assert.ok(v.rule.startsWith('SecRule ARGS'));
  assert.equal(v.caveats.length, 3);
});

test('52876 checkChainMembership: membership and same-host links', () => {
  const chains = [{ id: 'chain-1', findingIds: ['f2', 'f1', 'f3'] }];
  const v = XB.checkChainMembership(FINDINGS[0], chains, FINDINGS);
  assert.equal(v.inChain, true);
  assert.equal(v.chains[0].combinedSeverity, 'critical');
  assert.deepEqual(v.linkedIds, ['f2', 'f4', 'f5']);
  const solo = XB.checkChainMembership(FINDINGS[3], chains, FINDINGS);
  assert.equal(solo.inChain, false);
});

test('52877 explainCvssVector: every metric decoded in plain language', () => {
  const v = XB.explainCvssVector(FINDINGS[0], {});
  assert.equal(v.metricCount, 8);
  assert.equal(v.version, '3.1');
  assert.equal(v.score, 9.8);
  assert.equal(v.metrics[0].metric, 'AV');
  assert.ok(v.metrics[0].plainEnglish.includes('over the network'));
  const fromString = XB.explainCvssVector('CVSS:3.1/AV:N/AC:L', {});
  assert.equal(fromString.metricCount, 2);
});

test('52878 planVoiceAnswer: short speakable chunks with avatar mood', () => {
  const male = XB.planVoiceAnswer({ question: 'What is the top priority?', finding: FINDINGS[0], avatarGender: 'male' }, {});
  assert.equal(male.voice, 'kai');
  assert.equal(male.avatar.expression, 'serious');
  assert.equal(male.chunks.length, male.sentences.length);
  assert.ok(male.estimatedSeconds > 0);
  const female = XB.planVoiceAnswer({ question: 'Status?', finding: FINDINGS[3], avatarGender: 'female' }, {});
  assert.equal(female.voice, 'aria');
});

test('52879 citeEvidence: claims matched to recorded evidence', () => {
  const v = XB.citeEvidence({ answer: 'The checkout query returned every order id and customer email without a login.', finding: FINDINGS[0] }, {});
  assert.equal(v.claimCount, 1);
  assert.equal(v.citationCount, 1);
  assert.equal(v.coveragePercent, 100);
  assert.deepEqual(v.uncitedClaims, []);
  const unsupported = XB.citeEvidence({ answer: 'A quantum banana opened the admin panel.', finding: FINDINGS[0] }, {});
  assert.equal(unsupported.citationCount, 0);
  assert.equal(unsupported.uncitedClaims.length, 1);
});

test('52880 searchQaHistory: query and finding facets over saved Q&A', () => {
  const hunt = { huntId: 'hunt-42', qaHistory: [
    { id: 'q1', question: 'Which checkout finding is critical?', answer: 'f1 is critical.', findingId: 'f1', askedBy: 'lead-1', at: '2026-10-08T09:00:00Z' },
    { id: 'q2', question: 'Any invoice chain?', answer: 'No chain recorded.', findingId: 'f3', askedBy: 'analyst-1', at: '2026-10-08T10:00:00Z' },
  ] };
  const v = XB.searchQaHistory(hunt, 'checkout', {});
  assert.equal(v.total, 1);
  assert.equal(v.results[0].id, 'q1');
  assert.equal(v.facets.byFinding.f1, 1);
  const all = XB.searchQaHistory(hunt, '', {});
  assert.equal(all.total, 2);
  assert.equal(all.results[0].id, 'q2');
});

/* ---- JSX↔core call-shape audit ---- */
function componentNames(jsxSrc) {
  return [...jsxSrc.matchAll(/export function (\w+)/g)].map(m => m[1]).filter(n => !/Gallery$/.test(n));
}
function componentBody(jsxSrc, name) {
  const idx = jsxSrc.indexOf(`export function ${name}`);
  const next = jsxSrc.indexOf('export function', idx + 1);
  return jsxSrc.slice(idx, next === -1 ? undefined : next);
}

test('jsx: 20 components per file, each calls ≥1 core function', () => {
  for (const [label, src, core] of [['A', A_JSX, XA], ['B', B_JSX, XB]]) {
    const names = componentNames(src);
    assert.equal(names.length, 20, `${label}: expected 20 components, got ${names.length}`);
    const fns = Object.keys(core).filter(k => !k.endsWith('_IDEAS'));
    assert.equal(fns.length, 20, `${label}: expected 20 core functions`);
    for (const name of names) {
      const body = componentBody(src, name);
      const called = fns.filter(fn => new RegExp(`\\b${fn}\\b`).test(body));
      assert.ok(called.length >= 1, `${label} component ${name} calls no core function`);
    }
    for (const fn of fns) {
      assert.ok(new RegExp(`\\b${fn}\\b`).test(src), `${label} core function ${fn} never referenced in JSX`);
    }
  }
});

/* ---- CSS scope + zero-animation audits ---- */
test('css: only .w72a-/.w72b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w72a-') || cls.startsWith('w72b-'), `unscoped selector: .${cls}`);
  }
  assert.ok(!/(^|\n)\s*(body|html|\*|:root)\s*\{/.test(noComments), 'global rule found');
});

test('css: zero keyframes, zero animation properties', () => {
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'found @keyframes');
  assert.ok(!/(^|[;{\s])animation(-name|-duration|-timing-function|-delay|-iteration-count|-direction|-fill-mode|-play-state)?\s*:/i.test(CSS_SRC), 'found animation property');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'found transition property');
});

/* ---- esbuild real JSX parse audit ---- */
test('esbuild: both JSX files parse/transform cleanly', () => {
  for (const f of ['Wave72A.jsx', 'Wave72B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', `--loader:.jsx=jsx`, '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

/* ---- no-branding-leak audit ---- */
test('branding: no forbidden brand anywhere; Infinity AI present in cores', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.toLowerCase().includes('mu' + 'se'), `forbidden brand leaked in ${name}`);
  }
  assert.ok(A_SRC.includes('Infinity AI'));
  assert.ok(B_SRC.includes('Infinity AI'));
});

/* ---- no-debris audit ---- */
test('no-debris: no TODO/FIXME/mock placeholders in logic', () => {
  for (const [name, src] of [['A core', A_SRC], ['B core', B_SRC]]) {
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), `debris in ${name}`);
    assert.ok(!/\bmock\b/i.test(src), `mock mention in ${name}`);
  }
});
