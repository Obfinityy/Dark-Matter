/**
 * wave75.test.js — Infinity AI · Dark-Matter · Wave 75
 * node:test + node:assert/strict. Registry coverage (20/20 for 52961–52980,
 * 20/20 for 52981–53000, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave75.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE75_A_IDEAS } from './wave75ACore.js';
import * as XA from './wave75ACore.js';
import { WAVE75_B_IDEAS } from './wave75BCores.js';
import * as XB from './wave75BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave75ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave75BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave75A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave75B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave75.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

const TEMPLATE = {
  id: 'tpl-shop-baseline', templateId: 'tpl-shop-baseline', name: 'Shop baseline',
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  engines: [{ id: 'recon', version: '2.1' }, { id: 'vuln-scan', version: '4.0' }],
  payloadProfile: { aggressiveness: 'balanced', payloadSets: ['standard'], stealth: false, rateLimitPerMinute: 60 },
  schedule: { cadence: 'weekly', window: 'business-hours', timezone: 'UTC' },
  triageRules: [{ id: 'r1', severity: 'critical', assign: 'lead-1' }],
  tags: ['web', 'shop'], vertical: 'retail', assetType: 'web',
  versions: [
    { version: 1, at: '2026-09-01T09:00:00Z', by: 'lead-1', note: 'Initial template.' },
    { version: 2, at: '2026-09-15T09:00:00Z', by: 'lead-1', note: 'Tightened payload rate.' },
  ],
  uses: 7, owner: 'lead-1', createdBy: 'lead-1',
  sla: { triageHours: 24, fixCriticalHours: 72 },
  lifecycle: { state: 'active', reviewCadenceDays: 30 },
  hooks: { pre: [{ name: 'announce-start' }], post: [{ name: 'notify-owner' }] },
  fpRate: 0.08, averageYield: 2.4, averageMinutes: 38,
  audit: [{ at: '2026-09-01T09:00:00Z', actor: 'lead-1', action: 'created' }],
};
const TEMPLATES = [
  TEMPLATE,
  { id: 'tpl-api-sweep', name: 'API sweep', scope: { include: ['api.example.com'], exclude: [] }, engines: [{ id: 'vuln-scan', version: '4.0' }], uses: 3, tags: ['api'], vertical: 'fintech', assetType: 'api' },
];
const STAT_HUNTS = [
  { huntId: 'hunt-50', templateId: 'tpl-shop-baseline', findings: [{ id: 'f1' }, { id: 'f2' }] },
  { huntId: 'hunt-51', templateId: 'tpl-shop-baseline', findings: [{ id: 'f3' }] },
  { huntId: 'hunt-52', templateId: 'tpl-api-sweep', findings: [{ id: 'f4' }, { id: 'f5' }, { id: 'f6' }] },
];
const HUNTS = [
  { huntId: 'hunt-42', target: 'shop.example.com', findings: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }], engines: ['recon', 'vuln-scan'], scope: { include: ['shop.example.com'], exclude: [] } },
  { huntId: 'hunt-43', target: 'api.example.com', findings: [{ id: 'f4' }], engines: ['vuln-scan'], scope: { include: ['api.example.com'], exclude: [] } },
];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 wave 75A ideas, 20/20 wave 75B ideas, zero skips', () => {
  assert.equal(WAVE75_A_IDEAS.length, 20);
  assert.equal(WAVE75_B_IDEAS.length, 20);
  const all = [...WAVE75_A_IDEAS, ...WAVE75_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52961 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE75_A_IDEAS, ...WAVE75_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52961].includes('template import/export (post-hunt)'));
  assert.ok(byId[52962].includes('auto-suggest template from best hunt'));
  assert.ok(byId[52963].includes('template categories (post-hunt)'));
  assert.ok(byId[52964].includes('template search and tags'));
  assert.ok(byId[52965].includes('cross-target template cloning'));
  assert.ok(byId[52966].includes('parameterized target variables'));
  assert.ok(byId[52967].includes('secrets placeholders'));
  assert.ok(byId[52968].includes('template approval workflow (post-hunt)'));
  assert.ok(byId[52969].includes('template deprecation (post-hunt)'));
  assert.ok(byId[52970].includes('template changelog (post-hunt)'));
  assert.ok(byId[52971].includes('template diff viewer (post-hunt)'));
  assert.ok(byId[52972].includes('template dry-run test'));
  assert.ok(byId[52973].includes('template cost estimator'));
  assert.ok(byId[52974].includes('vertical-specific templates'));
  assert.ok(byId[52975].includes('asset-type templates'));
  assert.ok(byId[52976].includes('bounty-program templates'));
  assert.ok(byId[52977].includes('regression templates'));
  assert.ok(byId[52978].includes('compliance-audit templates'));
  assert.ok(byId[52979].includes('template notification defaults'));
  assert.ok(byId[52980].includes('template stakeholder-view defaults'));
  assert.ok(byId[52981].includes('template triage-assignment defaults'));
  assert.ok(byId[52982].includes('template sla defaults'));
  assert.ok(byId[52983].includes('template lifecycle defaults'));
  assert.ok(byId[52984].includes('bulk-apply template to targets'));
  assert.ok(byId[52985].includes('org template marketplace'));
  assert.ok(byId[52986].includes('template effectiveness analytics'));
  assert.ok(byId[52987].includes('ai template recommendations'));
  assert.ok(byId[52988].includes('template auto-improvement'));
  assert.ok(byId[52989].includes('template scope guardrails'));
  assert.ok(byId[52990].includes('template required fields'));
  assert.ok(byId[52991].includes('template creation wizard'));
  assert.ok(byId[52992].includes('template quick-start'));
  assert.ok(byId[52993].includes('template duplication detection'));
  assert.ok(byId[52994].includes('template ownership'));
  assert.ok(byId[52995].includes('template permission levels'));
  assert.ok(byId[52996].includes('template audit log (post-hunt)'));
  assert.ok(byId[52997].includes('template rollback (post-hunt)'));
  assert.ok(byId[52998].includes('template pre/post hooks'));
  assert.ok(byId[52999].includes('auto-generated template docs'));
  assert.ok(byId[53000].includes('template performance badges'));
});

/* ---- Wave75 A spot checks (52961–52980) ---- */
test('52961 exchangeTemplatePackage: portable descriptor with checksum', () => {
  const v = XA.exchangeTemplatePackage(TEMPLATE, null, {});
  assert.equal(v.descriptor.format, 'infinity-template-v1');
  assert.equal(v.descriptor.id, 'tpl-shop-baseline');
  assert.ok(v.checksum.length >= 8);
  const again = XA.exchangeTemplatePackage(TEMPLATE, null, {});
  assert.equal(again.checksum, v.checksum);
});

test('52962 suggestTemplateFromBestHunt: highest yield hunt wins', () => {
  const v = XA.suggestTemplateFromBestHunt(HUNTS, {});
  assert.equal(v.best.huntId, 'hunt-42');
  assert.ok(v.suggestion);
  assert.equal(v.suggestion.sourceHuntId, 'hunt-42');
});

test('52963 classifyTemplateCategory: web shop template classified', () => {
  const v = XA.classifyTemplateCategory(TEMPLATE, {});
  assert.equal(v.templateId, 'tpl-shop-baseline');
  assert.ok(['web', 'general', 'api'].includes(v.category));
});

test('52964 searchTemplatesWithTags: token and tag scoring ranks matches', () => {
  const v = XA.searchTemplatesWithTags(TEMPLATES, 'shop', { tags: ['web'] });
  assert.ok(v.count >= 1);
  assert.equal(v.results[0].templateId, 'tpl-shop-baseline');
});

test('52965 cloneTemplateAcrossTargets: scope remapped to new host', () => {
  const v = XA.cloneTemplateAcrossTargets(TEMPLATE, { host: 'store.example.com' }, {});
  assert.ok(v.cloneId.includes('store'));
  assert.ok(v.template.scope.include.includes('store.example.com'));
});

test('52966 applyTemplateVariables: substitution with missing detection', () => {
  const v = XA.applyTemplateVariables({ name: 'Hunt {{target}}', scope: { include: ['{{target}}'] }, engines: [] }, { target: 'shop.example.com' });
  assert.equal(v.complete, true);
  assert.deepEqual(v.missing, []);
  const partial = XA.applyTemplateVariables({ name: 'Hunt {{target}}', scope: { include: ['{{target}}'] }, engines: [] }, {});
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.missing, ['target']);
});

test('52967 redactTemplateSecrets: hardcoded secrets flagged', () => {
  const v = XA.redactTemplateSecrets({ id: 'tpl-x', config: 'api_key=sk-1234567890abcdef' }, {});
  assert.equal(v.safe, false);
  assert.ok(v.findingCount >= 1);
  const clean = XA.redactTemplateSecrets(TEMPLATE, {});
  assert.equal(clean.safe, true);
});

test('52968 runTemplateApprovalWorkflow: lead approval moves to approved', () => {
  const v = XA.runTemplateApprovalWorkflow({ id: 'tpl-shop-baseline', approvalState: 'pending' }, { type: 'approve', role: 'lead' }, {});
  assert.equal(v.to, 'approved');
  assert.equal(v.allowed, true);
  const gated = XA.runTemplateApprovalWorkflow({ id: 'tpl-shop-baseline', approvalState: 'pending' }, { type: 'approve', role: 'author' }, {});
  assert.equal(gated.gated, true);
  assert.equal(gated.to, 'pending');
});

test('52969 evaluateTemplateDeprecation: healthy template stays active', () => {
  const v = XA.evaluateTemplateDeprecation(TEMPLATE, { uses: 7, averageYield: 1.8, fpRate: 0.1 }, {});
  assert.equal(v.deprecated, false);
  const stale = XA.evaluateTemplateDeprecation({ id: 'tpl-old' }, { uses: 0 }, {});
  assert.equal(stale.deprecated, true);
});

test('52970 buildTemplateChangelog: ordered version entries', () => {
  const v = XA.buildTemplateChangelog(TEMPLATE, {});
  assert.equal(v.entryCount, 2);
  assert.equal(v.entries[0].version, 1);
  assert.ok(v.content.includes('Infinity AI'));
});

test('52971 diffTemplateVersions: field and scope changes listed', () => {
  const v = XA.diffTemplateVersions(TEMPLATE, { ...TEMPLATE, name: 'Shop baseline v2', scope: { include: ['shop.example.com', 'api.example.com', 'cdn.example.com'], exclude: [] } }, {});
  assert.ok(v.changeCount >= 2);
  assert.equal(v.identical, false);
  const same = XA.diffTemplateVersions(TEMPLATE, TEMPLATE, {});
  assert.equal(same.identical, true);
});

test('52972 dryRunTemplate: complete template passes validation', () => {
  const v = XA.dryRunTemplate(TEMPLATE, {});
  assert.equal(v.verdict, 'pass');
  assert.equal(v.checks.length, 4);
  const bad = XA.dryRunTemplate({ id: 'tpl-bad', scope: { include: [] }, engines: [] }, {});
  assert.equal(bad.verdict, 'fail');
});

test('52973 estimateTemplateCost: cost scales with targets and engines', () => {
  const v = XA.estimateTemplateCost(TEMPLATE, { targets: 2, depth: 'balanced' }, {});
  assert.equal(v.targets, 2);
  assert.equal(v.engines, 2);
  assert.equal(v.estimatedMinutes, 96);
  assert.ok(v.computeUnits > 0);
});

test('52974 filterVerticalTemplates: vertical filter matches tagged rows', () => {
  const v = XA.filterVerticalTemplates(TEMPLATES, 'retail', {});
  assert.equal(v.count, 1);
  assert.equal(v.templates[0].templateId, 'tpl-shop-baseline');
});

test('52975 filterAssetTypeTemplates: asset type filter matches', () => {
  const v = XA.filterAssetTypeTemplates(TEMPLATES, 'web', {});
  assert.equal(v.count, 1);
  const api = XA.filterAssetTypeTemplates(TEMPLATES, 'api', {});
  assert.equal(api.count, 1);
});

test('52976 buildBountyProgramTemplate: program rules become a template', () => {
  const v = XA.buildBountyProgramTemplate({ name: 'Shop program', inScope: ['shop.example.com'], outOfScope: ['admin.example.com'], rewards: { min: 50, max: 5000 } }, {});
  assert.equal(v.scopeCount, 1);
  assert.ok(v.templateId.includes('shop-program'));
  assert.equal(v.template.maxReward, 5000);
});

test('52977 buildRegressionTemplate: critical findings become checks', () => {
  const v = XA.buildRegressionTemplate({ huntId: 'hunt-42', findings: [{ id: 'f1', title: 'SQLi in checkout', severity: 'critical', target: 'shop.example.com/checkout' }, { id: 'f2', title: 'Note', severity: 'low' }] }, {});
  assert.equal(v.checkCount, 1);
  assert.equal(v.template.checks[0].findingId, 'f1');
});

test('52978 buildComplianceAuditTemplate: controls bundled with evidence', () => {
  const v = XA.buildComplianceAuditTemplate({ name: 'PCI review', controls: ['access-control', 'logging'] }, {});
  assert.equal(v.controlCount, 2);
  assert.equal(v.template.evidenceRequired, true);
});

test('52979 resolveNotificationDefaults: channels merged and deduplicated', () => {
  const v = XA.resolveNotificationDefaults({ id: 'tpl-shop-baseline', notifications: { channels: ['in-app', 'email', 'email'] } }, {}, {});
  assert.equal(v.channelCount, 2);
  assert.equal(v.notifications.onComplete, true);
});

test('52980 resolveStakeholderViewDefaults: three audience views configured', () => {
  const v = XA.resolveStakeholderViewDefaults(TEMPLATE, {});
  assert.equal(v.viewCount, 3);
  assert.equal(v.views[0].audience, 'leadership');
});

/* ---- Wave75 B spot checks (52981–53000) ---- */
test('52981 resolveTriageAssignmentDefaults: severity routing resolved', () => {
  const v = XB.resolveTriageAssignmentDefaults(TEMPLATE, { criticalAssignee: 'lead-1' }, {});
  assert.equal(v.ruleCount, 1);
  assert.equal(v.assignments[0].severity, 'critical');
  assert.equal(v.assignments[0].assignee, 'lead-1');
});

test('52982 resolveSlaDefaults: SLA hours merged with base', () => {
  const v = XB.resolveSlaDefaults(TEMPLATE, {});
  assert.equal(v.sla.triageHours, 24);
  assert.equal(v.sla.fixCriticalHours, 72);
});

test('52983 resolveLifecycleDefaults: lifecycle state and cadence resolved', () => {
  const v = XB.resolveLifecycleDefaults(TEMPLATE, {});
  assert.equal(v.lifecycle.state, 'active');
  assert.equal(v.lifecycle.reviewCadenceDays, 30);
});

test('52984 bulkApplyTemplate: drafts prepared per target', () => {
  const v = XB.bulkApplyTemplate(TEMPLATE, ['shop.example.com', 'api.example.com'], {});
  assert.equal(v.totalTargets, 2);
  assert.equal(v.readyCount, 2);
  assert.ok(v.plan[0].huntDraftId.includes('shop'));
});

test('52985 browseOrgMarketplace: listings searchable and sorted', () => {
  const v = XB.browseOrgMarketplace([{ id: 'tpl-shop-baseline', name: 'Shop baseline', publisher: 'security-team', installs: 14, verified: true }], '', {});
  assert.equal(v.count, 1);
  assert.equal(v.verifiedCount, 1);
});

test('52986 analyzeTemplateEffectiveness: yield computed per template', () => {
  const v = XB.analyzeTemplateEffectiveness(TEMPLATES, STAT_HUNTS, {});
  assert.equal(v.templateCount, 2);
  assert.ok(v.best);
  assert.ok(v.best.yieldPerUse >= 1.5);
});

test('52987 recommendTemplatesWithAi: fingerprint overlap ranks templates', () => {
  const v = XB.recommendTemplatesWithAi(TEMPLATES, { techStack: ['node'], assetType: 'web', vertical: 'retail' }, {});
  assert.ok(v.top);
  assert.ok(v.recommendations.length >= 1);
});

test('52988 autoImproveTemplate: suggestions derived from stats', () => {
  const v = XB.autoImproveTemplate(TEMPLATE, { fpRate: 0.08, averageYield: 2.4 }, {});
  assert.ok(v.suggestionCount >= 1);
  const risky = XB.autoImproveTemplate(TEMPLATE, { fpRate: 0.8, averageYield: 0.2 }, {});
  assert.ok(risky.suggestions.some(s => s.kind === 'tighten-scope'));
});

test('52989 enforceScopeGuardrails: blocked suffixes rejected', () => {
  const v = XB.enforceScopeGuardrails(TEMPLATE, {}, {});
  assert.equal(v.allowed, true);
  const bad = XB.enforceScopeGuardrails({ id: 'tpl-x', scope: { include: ['secure.example.gov'], exclude: [] } }, {}, {});
  assert.equal(bad.allowed, false);
  assert.equal(bad.violationCount, 1);
});

test('52990 validateRequiredFields: missing fields named', () => {
  const v = XB.validateRequiredFields(TEMPLATE, {});
  assert.equal(v.valid, true);
  const bad = XB.validateRequiredFields({ id: 'tpl-x' }, {});
  assert.equal(bad.valid, false);
  assert.ok(bad.missing.includes('name'));
});

test('52991 runTemplateCreationWizard: steps and completion tracked', () => {
  const v = XB.runTemplateCreationWizard(TEMPLATE, 3, {});
  assert.equal(v.current, 3);
  assert.equal(v.steps.length, 4);
  assert.equal(v.complete, true);
});

test('52992 resolveTemplateQuickStart: ready template launches directly', () => {
  const v = XB.resolveTemplateQuickStart(TEMPLATE, {});
  assert.equal(v.ready, true);
  assert.equal(v.launchLabel, 'Launch hunt now');
});

test('52993 detectTemplateDuplication: similar templates paired', () => {
  const dup = [TEMPLATE, { ...TEMPLATE, id: 'tpl-copy', name: 'Shop baseline' }];
  const v = XB.detectTemplateDuplication(dup, {});
  assert.ok(v.pairCount >= 1);
  assert.ok(v.pairs[0].similarity >= 0.5);
});

test('52994 resolveTemplateOwnership: owner resolved against roster', () => {
  const v = XB.resolveTemplateOwnership(TEMPLATE, [{ id: 'lead-1' }], {});
  assert.equal(v.owner, 'lead-1');
  assert.equal(v.known, true);
});

test('52995 resolveTemplatePermissions: owner can run and edit', () => {
  const v = XB.resolveTemplatePermissions(TEMPLATE, { id: 'lead-1', role: 'owner' }, {});
  assert.equal(v.can.run, true);
  assert.equal(v.can.edit, true);
  assert.equal(v.can.delete, true);
});

test('52996 buildTemplateAuditLog: entries ordered with actors', () => {
  const v = XB.buildTemplateAuditLog(TEMPLATE, TEMPLATE.audit, {});
  assert.equal(v.entryCount, 1);
  assert.equal(v.entries[0].action, 'created');
});

test('52997 rollbackTemplate: prior version snapshot selected', () => {
  const v = XB.rollbackTemplate(TEMPLATE, null, {});
  assert.equal(v.possible, true);
  assert.equal(v.rollbackTo, 1);
  assert.equal(v.currentVersion, 2);
  assert.equal(TEMPLATE.versions.length, 2);
});

test('52998 resolveTemplateHooks: pre and post hooks registered', () => {
  const v = XB.resolveTemplateHooks(TEMPLATE, {});
  assert.equal(v.hookCount, 2);
  assert.equal(v.pre.length, 1);
  assert.equal(v.post.length, 1);
});

test('52999 generateTemplateDocs: docs generated from configuration', () => {
  const v = XB.generateTemplateDocs(TEMPLATE, {});
  assert.equal(v.sectionCount, 3);
  assert.ok(v.content.includes('Infinity AI'));
  assert.ok(v.content.includes('shop.example.com'));
});

test('53000 deriveTemplateBadges: strong stats earn all three badges', () => {
  const v = XB.deriveTemplateBadges(TEMPLATE, { fpRate: 0.08, averageMinutes: 38, averageYield: 2.4 }, {});
  assert.equal(v.badgeCount, 3);
  assert.deepEqual(v.badgeLabels, ['Low FP', 'Fast', 'High Yield']);
  const weak = XB.deriveTemplateBadges({ id: 'tpl-weak' }, { fpRate: 0.9, averageMinutes: 300, averageYield: 0.1 }, {});
  assert.equal(weak.badgeCount, 0);
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
    assert.equal(fns.length, 20, `${label}: expected 20 core functions, got ${fns.length}`);
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
test('css: only .w75a-/.w75b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w75a-') || cls.startsWith('w75b-'), `unscoped selector: .${cls}`);
  }
  assert.ok(!/(^|\n)\s*(body|html|\*|:root)\s*\{/.test(noComments), 'global rule found');
});

test('css: zero keyframes, zero animation properties', () => {
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'found @keyframes');
  assert.ok(!/keyframes/i.test(CSS_SRC), 'found keyframes word');
  assert.ok(!/(^|[;{\s])animation(-name|-duration|-timing-function|-delay|-iteration-count|-direction|-fill-mode|-play-state)?\s*:/i.test(CSS_SRC), 'found animation property');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'found transition property');
});

/* ---- esbuild real JSX parse audit ---- */
test('esbuild: both JSX files parse/transform cleanly', () => {
  for (const f of ['Wave75A.jsx', 'Wave75B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', '--loader:.jsx=jsx', '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

/* ---- no-branding-leak audit ---- */
test('branding: no forbidden brand anywhere; Infinity AI present in cores', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.toLowerCase().includes('mu' + 'se'), `forbidden brand leaked in ${name}`);
    assert.ok(!src.includes('Dark' + 'Matter'), `forbidden brand leaked in ${name}`);
  }
  assert.ok(A_SRC.includes('Infinity AI'));
  assert.ok(B_SRC.includes('Infinity AI'));
});

/* ---- no-debris audit ---- */
test('no-debris: no TODO/FIXME/mock placeholders in logic', () => {
  for (const [name, src] of [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX]]) {
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), `debris in ${name}`);
    assert.ok(!/\bmock\b/i.test(src), `mock mention in ${name}`);
    assert.ok(!/\bsimulate\b/i.test(src), `simulate mention in ${name}`);
  }
});
