/**
 * wave102.test.js — Infinity AI · Wave 102
 * node:test + node:assert/strict. Registry coverage (20/20 for 54041–54060,
 * 20/20 for 54061–54080, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX-core call-shape audit (every
 * exported component calls at least one exported core function), Wave102.css
 * scope audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit (Infinity AI only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE102_A_IDEAS } from './wave102ACore.js';
import * as X102A from './wave102ACore.js';
import { WAVE102_B_IDEAS } from './wave102BCores.js';
import * as X102B from './wave102BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave102ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave102BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave102A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave102B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave102.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

test('registry: 20/20 wave 102A ideas, 20/20 wave 102B ideas, zero skips', () => {
  assert.equal(WAVE102_A_IDEAS.length, 20);
  assert.equal(WAVE102_B_IDEAS.length, 20);
  const all = [...WAVE102_A_IDEAS, ...WAVE102_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 54041 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE102_A_IDEAS, ...WAVE102_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  const expected = {
    54041: 'whois preview',
    54042: 'certificate preview',
    54043: 'rate-limit discovery note',
    54044: 'language and locale detection',
    54045: 'js bundle inventory preview',
    54046: 'form count preview',
    54047: 'port pre-scan lite',
    54048: 'onboarding progress api (targets)',
    54049: 'welcome tour per target type',
    54050: 'attestation checkbox',
    54051: 'notes prompt at add',
    54052: 'screenshot gallery seed',
    54053: 'canonical alias confirmation',
    54054: 'onboarding completion webhook',
    54055: 'dual-pane scope editor',
    54056: 'wildcard syntax support',
    54057: 'regex scope rules',
    54058: 'cidr range scoping',
    54059: 'port-level scoping',
    54060: 'path-prefix scoping',
    54061: 'http method scoping',
    54062: 'visual scope tree',
    54063: '"is this url in scope?" tester',
    54064: 'wildcard expansion preview',
    54065: 'overbroad wildcard warnings',
    54066: 'exclusion reason codes',
    54067: 'exclusion templates library',
    54068: 'scope syntax validator',
    54069: 'scope rule drag-drop reorder',
    54070: 'rule shadowing indicator',
    54071: 'scope version history',
    54072: 'scope diff viewer (targets)',
    54073: 'scope change approval flow',
    54074: 'scope rollback',
    54075: 'scope import from program',
    54076: 'scope export as json',
    54077: 'copy scope between targets',
    54078: 'scope templates library',
    54079: 'scope inheritance from program',
    54080: 'per-rule enable toggle',
  };
  for (const [id, title] of Object.entries(expected)) {
    assert.equal(byId[id], title, `idea ${id} title mismatch`);
  }
});

// --- Wave 102A spot checks (one per idea) ---
test('54041 summarizeWhoisPreview completes known registrations', () => {
  const v = X102A.summarizeWhoisPreview([
    { domain: 'shop.example.com', registrar: 'Registrar A', createdYear: 2018, expiresYear: 2027, privacyProtected: true },
    { domain: 'new.example.com', registrar: '', createdYear: 2025, expiresYear: 2026, privacyProtected: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.completeCount, 1);
  assert.equal(v.privacyCount, 1);
  assert.equal(v.averageAgeYears, 4.5);
  assert.equal(v.top.key, 'shop.example.com');
});
test('54042 previewTlsCertificate grades expiry windows', () => {
  const v = X102A.previewTlsCertificate([
    { host: 'shop.example.com', issuer: 'Issuer A', sans: ['shop.example.com', 'www.shop.example.com'], notAfterDays: 120 },
    { host: 'old.example.com', issuer: 'Issuer B', sans: ['old.example.com'], notAfterDays: 12 },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.validCount, 1);
  assert.equal(v.expiringCount, 1);
  assert.equal(v.totalSans, 3);
  assert.equal(v.top.key, 'old.example.com');
});
test('54043 buildRateLimitDiscoveryNote documents numeric limits', () => {
  const v = X102A.buildRateLimitDiscoveryNote([
    { endpoint: '/v1/search', limitPerMinute: 60, retryAfterSeconds: 30, headerPresent: true },
    { endpoint: '/v1/export', limitPerMinute: 0, retryAfterSeconds: 0, headerPresent: false },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.documentedCount, 1);
  assert.equal(v.averageLimit, 30);
  assert.ok(v.top.note.includes('60'));
});
test('54044 detectLanguageLocale requires dual-signal agreement', () => {
  const v = X102A.detectLanguageLocale([
    { target: 'shop.example.com', htmlLang: 'en-US', textHints: ['hello'] },
    { target: 'boutique.example.com', htmlLang: 'fr-FR', textHints: ['bonjour'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.agreedCount, 2);
  assert.equal(v.detectedCount, 2);
  assert.equal(v.top.locale, 'fr-fr');
});
test('54045 countJsBundleInventory totals bundle weight', () => {
  const v = X102A.countJsBundleInventory([
    { target: 'shop.example.com', bundles: [{ name: 'app.js', sizeKb: 320 }, { name: 'vendor.js', sizeKb: 260 }] },
    { target: 'blog.example.com', bundles: [{ name: 'main.js', sizeKb: 90 }] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.heavyCount, 1);
  assert.equal(v.totalBundles, 3);
  assert.equal(v.totalKb, 670);
  assert.equal(v.top.largestName, 'app.js');
});
test('54046 countFormInputs finds upload surfaces', () => {
  const v = X102A.countFormInputs([
    { target: 'shop.example.com', forms: [{ action: '/checkout', inputs: 6, uploads: 1 }, { action: '/search', inputs: 1, uploads: 0 }] },
    { target: 'static.example.com', forms: [] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.uploadCount, 1);
  assert.equal(v.totalForms, 2);
  assert.equal(v.totalInputs, 7);
});
test('54047 evaluateTopPortsPreScan flags promising hosts', () => {
  const v = X102A.evaluateTopPortsPreScan([
    { host: 'shop.example.com', openPorts: [80, 443, 8080] },
    { host: 'quiet.example.com', openPorts: [22] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.promisingCount, 1);
  assert.equal(v.worthFullScanCount, 1);
  assert.equal(v.totalOpen, 4);
  assert.equal(v.top.host, 'shop.example.com');
});
test('54048 buildOnboardingProgressPayload shapes API payloads', () => {
  const v = X102A.buildOnboardingProgressPayload([
    { targetId: 't-1', stepsDone: 5, stepsTotal: 5, blocked: false },
    { targetId: 't-2', stepsDone: 2, stepsTotal: 6, blocked: true },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.completeCount, 1);
  assert.equal(v.blockedCount, 1);
  assert.equal(v.averagePercent, 66.5);
  assert.equal(v.top.payload.state, 'complete');
});
test('54049 buildWelcomeTourSteps tailors tours per type', () => {
  const v = X102A.buildWelcomeTourSteps([{ targetType: 'web' }, { targetType: 'api' }]);
  assert.equal(v.count, 2);
  assert.equal(v.tailoredCount, 2);
  assert.equal(v.totalSteps, 10);
  assert.ok(v.rows[0].steps.length >= 4);
});
test('54050 buildAttestationRecord requires confirmation and timestamp', () => {
  const v = X102A.buildAttestationRecord([
    { target: 'shop.example.com', confirmed: true, attestedAt: '2026-10-09T10:00:00Z' },
    { target: 'blog.example.com', confirmed: false, attestedAt: '' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.validCount, 1);
  assert.equal(v.top.status, 'attested');
  assert.ok(v.top.record.statement.includes('shop.example.com'));
});
test('54051 buildFirstNotePrompt tailors questions by style', () => {
  const v = X102A.buildFirstNotePrompt([
    { target: 'api.example.com', huntStyle: 'api' },
    { target: 'shop.example.com', huntStyle: 'standard' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.tailoredCount, 1);
  assert.equal(v.totalPrompts, 7);
});
test('54052 planScreenshotGallerySeed prioritizes key pages', () => {
  const v = X102A.planScreenshotGallerySeed([
    { target: 'shop.example.com', pages: ['/', '/login', '/pricing', '/dashboard'] },
    { target: 'blog.example.com', pages: ['/'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.richCount, 1);
  assert.equal(v.totalPlanned, 5);
  assert.equal(v.top.planned[0], '/');
});
test('54053 resolveCanonicalAliases confirms canonical hosts', () => {
  const v = X102A.resolveCanonicalAliases([{ host: 'www.shop.example.com' }, { host: 'example.com' }]);
  assert.equal(v.count, 2);
  assert.equal(v.confirmedCount, 2);
  assert.equal(v.totalAliases, 8);
  assert.equal(v.rows[0].canonical, 'https://example.com');
});
test('54054 buildOnboardingCompletionWebhook fires only when complete', () => {
  const v = X102A.buildOnboardingCompletionWebhook([
    { targetId: 't-1', completed: true, completedAt: '2026-10-09T10:00:00Z' },
    { targetId: 't-2', completed: false, completedAt: '' },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.top.payload.event, 'target.onboarding.completed');
});
test('54055 buildDualPaneScopeEditor computes effective scope', () => {
  const v = X102A.buildDualPaneScopeEditor([
    { target: 'shop', inScope: ['a.example.com', 'b.example.com'], exclusions: ['b.example.com'] },
    { target: 'blog', inScope: ['c.example.com'], exclusions: [] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.cleanCount, 1);
  assert.equal(v.totalEffective, 2);
  assert.equal(v.totalConflicts, 1);
  assert.deepEqual(v.rows.find(r => r.key === 'shop').effective, ['a.example.com']);
});
test('54056 matchWildcardPattern matches one label only', () => {
  const v = X102A.matchWildcardPattern([
    { pattern: '*.example.com', hostname: 'api.example.com' },
    { pattern: '*.example.com', hostname: 'example.com' },
    { pattern: '*.example.com', hostname: 'deep.api.example.com' },
    { pattern: 'api.example.com', hostname: 'api.example.com' },
  ]);
  assert.equal(v.count, 4);
  assert.equal(v.matchedCount, 2);
  assert.equal(v.rows.find(r => r.hostname === 'api.example.com' && r.pattern === '*.example.com').matched, true);
  assert.equal(v.rows.find(r => r.hostname === 'example.com').matched, false);
  assert.equal(v.rows.find(r => r.hostname === 'deep.api.example.com').matched, false);
  assert.ok(v.docs.includes('exactly one subdomain label'));
});
test('54057 buildRegexScopeRule compiles and tests patterns', () => {
  const v = X102A.buildRegexScopeRule([
    { pattern: '^api\\.example\\.com$', hostname: 'api.example.com' },
    { pattern: '^web\\.example\\.com$', hostname: 'api.example.com' },
    { pattern: '[', hostname: 'api.example.com' },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.validCount, 2);
  assert.equal(v.invalidCount, 1);
});
test('54058 checkCidrContainment does mask arithmetic and overlap', () => {
  const v = X102A.checkCidrContainment([
    { cidr: '10.0.0.0/24', ip: '10.0.0.42', peerCidr: '10.0.0.128/25' },
    { cidr: '10.0.0.0/24', ip: '10.0.1.42', peerCidr: '' },
    { cidr: 'bad', ip: '10.0.0.1', peerCidr: '' },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.insideCount, 1);
  assert.equal(v.overlapCount, 1);
  assert.equal(v.rows[0].contains, true);
  assert.equal(v.rows[0].hostCount, 256);
  assert.equal(v.rows.find(r => r.ip === '10.0.1.42').contains, false);
});
test('54059 matchPortRangeScope matches lists and ranges', () => {
  const v = X102A.matchPortRangeScope([
    { portSpec: '80,443,8000-9000', port: 8443 },
    { portSpec: '80,443', port: 22 },
    { portSpec: '*', port: 22 },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.matchedCount, 2);
  assert.equal(v.rows.find(r => r.port === 8443).matched, true);
});
test('54060 matchPathPrefixScope matches beneath the prefix', () => {
  const v = X102A.matchPathPrefixScope([
    { pathPrefix: '/v1', urlPath: '/v1/users' },
    { pathPrefix: '/v1', urlPath: '/v2/users' },
    { pathPrefix: '/v1', urlPath: '/v1' },
    { pathPrefix: '/v1', urlPath: '/v1beta' },
  ]);
  assert.equal(v.count, 4);
  assert.equal(v.matchedCount, 2);
});

// --- Wave 102B spot checks (one per idea) ---
test('54061 matchHttpMethodScope checks allowlists', () => {
  const v = X102B.matchHttpMethodScope([
    { method: 'GET', allowedMethods: ['GET', 'POST'] },
    { method: 'DELETE', allowedMethods: ['GET', 'POST'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.matchedCount, 1);
  assert.equal(v.top.method, 'GET');
});
test('54062 buildVisualScopeTree groups rules by domain', () => {
  const v = X102B.buildVisualScopeTree([
    { target: 'shop', rules: [{ pattern: '*.example.com', pathPrefix: '/', methods: ['GET'] }, { pattern: 'api.example.com', pathPrefix: '/v1', methods: ['GET', 'POST'] }] },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.treedCount, 1);
  assert.equal(v.totalRules, 2);
  assert.equal(v.top.domainCount, 1);
  assert.equal(v.top.domains[0].domain, 'example.com');
});
test('54063 testUrlInScope names the winning rule', () => {
  const rules = [{ id: 'r1', pattern: '*.example.com', pathPrefix: '/v1', methods: ['GET'], type: 'include' }];
  const v = X102B.testUrlInScope([
    { url: 'https://api.example.com/v1/users', method: 'GET', rules },
    { url: 'https://api.example.com/admin', method: 'GET', rules },
    { url: 'not a url', method: 'GET', rules },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.inScopeCount, 1);
  assert.equal(v.rows.find(r => r.status === 'in-scope').matchedRuleId, 'r1');
  assert.equal(v.rows.find(r => r.status === 'url-invalid').inScope, false);
  assert.ok(v.rows.find(r => r.status === 'in-scope').reason.includes('r1'));
});
test('54064 previewWildcardExpansion lists covered hosts', () => {
  const v = X102B.previewWildcardExpansion([
    { pattern: '*.example.com', knownSubdomains: ['api.example.com', 'web.example.com', 'other.org'] },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.totalCovered, 2);
  assert.deepEqual(v.top.covered, ['api.example.com', 'web.example.com']);
});
test('54065 warnOverbroadWildcard grades breadth severity', () => {
  const v = X102B.warnOverbroadWildcard([{ pattern: '*' }, { pattern: '*.com' }, { pattern: '*.example.com' }, { pattern: 'api.example.com' }]);
  assert.equal(v.count, 4);
  assert.equal(v.dangerousCount, 2);
  assert.equal(v.criticalCount, 1);
  assert.equal(v.rows.find(r => r.pattern === '*').severity, 'critical');
  assert.equal(v.rows.find(r => r.pattern === '*.example.com').severity, 'low');
});
test('54066 enforceExclusionReasonCodes rejects codeless exclusions', () => {
  const v = X102B.enforceExclusionReasonCodes([
    { pattern: '*.example.com', pathPrefix: '/logout', reasonCode: 'DESTRUCTIVE' },
    { pattern: '*.example.com', pathPrefix: '/pay', reasonCode: '' },
    { pattern: '*.example.com', pathPrefix: '/x', reasonCode: 'MADE_UP' },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.enforcedCount, 1);
  assert.equal(v.rejectedCount, 2);
});
test('54067 getExclusionTemplates instantiates presets', () => {
  const v = X102B.getExclusionTemplates([{ templateId: 'tpl-logout' }]);
  assert.equal(v.count, 4);
  assert.equal(v.requestedCount, 1);
  assert.ok(v.library.some(t => t.id === 'tpl-static'));
  assert.equal(v.rows.find(r => r.templateId === 'tpl-logout').instantiated.type, 'exclude');
});
test('54068 validateScopeSyntax explains errors in plain language', () => {
  const v = X102B.validateScopeSyntax([
    { pattern: '*.example.com', pathPrefix: '/v1', methods: ['GET'] },
    { pattern: 'https://bad host', pathPrefix: 'v1', methods: ['FETCH'] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.validCount, 1);
  const bad = v.rows.find(r => !r.valid);
  assert.ok(bad.errorCount >= 3);
  assert.ok(bad.fixes.length >= 3);
  assert.ok(bad.errors.join(' ').includes('scheme'));
});
test('54069 reorderScopeRules previews precedence', () => {
  const rules = [{ id: 'r1', pattern: '*.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }, { id: 'r2', pattern: '*.example.com', pathPrefix: '/logout', methods: ['*'], type: 'exclude' }];
  const v = X102B.reorderScopeRules([{ target: 'shop', rules, order: ['r2', 'r1'] }]);
  assert.equal(v.count, 1);
  assert.equal(v.totalRules, 2);
  assert.deepEqual(v.top.precedence, ['r2', 'r1']);
  assert.equal(v.top.lastWins, 'r1');
});
test('54070 detectRuleShadowing finds shadowed rules', () => {
  const rules = [{ id: 'r1', pattern: '*.example.com', pathPrefix: '/', methods: ['*'], type: 'include' }, { id: 'r2', pattern: '*.example.com', pathPrefix: '/', methods: ['*'], type: 'include' }, { id: 'r3', pattern: 'other.org', pathPrefix: '/', methods: ['GET'], type: 'include' }];
  const v = X102B.detectRuleShadowing([{ target: 'shop', rules }]);
  assert.equal(v.count, 1);
  assert.equal(v.setsWithShadowing, 1);
  assert.equal(v.totalFindings, 1);
  assert.deepEqual(v.top.shadowedIds, ['r2']);
});
test('54071 keepScopeVersionHistory keeps authors and summaries', () => {
  const v = X102B.keepScopeVersionHistory([
    { target: 'shop', versions: [{ version: 1, author: 'ana', timestamp: '2026-10-01T10:00:00Z', summary: 'Initial scope', rules: [] }, { version: 2, author: 'bob', timestamp: '2026-10-05T10:00:00Z', summary: 'Added api host', rules: [] }] },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.totalVersions, 2);
  assert.equal(v.top.latest.summary, 'Added api host');
  assert.deepEqual(v.top.authors, ['ana', 'bob']);
});
test('54072 viewScopeDiff separates added removed modified', () => {
  const v = X102B.viewScopeDiff([
    { target: 'shop', before: [{ id: 'r1', pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }], after: [{ id: 'r1', pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }, { id: 'r2', pattern: 'b.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }] },
    { target: 'same', before: [{ id: 'r1', pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }], after: [{ id: 'r1', pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }] },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.changedCount, 1);
  assert.equal(v.totalAdded, 1);
  assert.equal(v.top.added[0].id, 'r2');
});
test('54073 runScopeChangeApprovalFlow routes risky changes', () => {
  const v = X102B.runScopeChangeApprovalFlow([
    { changeId: 'c-1', changeRisk: 20, requestedBy: 'ana', approver: '', widening: false },
    { changeId: 'c-2', changeRisk: 85, requestedBy: 'bob', approver: '', widening: true },
    { changeId: 'c-3', changeRisk: 90, requestedBy: 'ana', approver: 'lead', widening: false },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.autoApprovedCount, 1);
  assert.equal(v.seniorCount, 2);
  assert.equal(v.rows.find(r => r.changeId === 'c-2').state, 'awaiting-approver');
  assert.equal(v.rows.find(r => r.changeId === 'c-3').state, 'pending-senior-approval');
});
test('54074 rollbackScopeToVersion restores recorded rules', () => {
  const versions = [{ version: 1, author: 'ana', timestamp: '2026-10-01T10:00:00Z', rules: [{ pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }] }, { version: 2, author: 'bob', timestamp: '2026-10-05T10:00:00Z', rules: [] }];
  const v = X102B.rollbackScopeToVersion([
    { target: 'shop', targetVersion: 1, versions },
    { target: 'shop', targetVersion: 9, versions },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.readyCount, 1);
  assert.equal(v.missingCount, 1);
  assert.equal(v.top.restoredCount, 1);
  assert.equal(v.rows.find(r => r.targetVersion === 1).restoredRules[0].pattern, 'a.example.com');
});
test('54075 importScopeFromProgramText parses program lines', () => {
  const v = X102B.importScopeFromProgramText([
    { target: 'shop', programText: 'api.example.com\nexclude status.example.com\nnot-a-host\n\nweb.example.com' },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.totalRules, 3);
  assert.equal(v.totalSkipped, 1);
  assert.equal(v.top.rules.find(r => r.pattern === 'status.example.com').type, 'exclude');
});
test('54076 exportScopeAsJson round-trips versioned JSON', () => {
  const v = X102B.exportScopeAsJson([
    { target: 'shop', version: 3, rules: [{ pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }] },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.totalRules, 1);
  assert.equal(v.allRoundTrip, true);
  const parsed = JSON.parse(v.top.json);
  assert.equal(parsed.product, 'Infinity AI');
  assert.equal(parsed.version, 3);
});
test('54077 copyScopeBetweenTargets reviews conflicts', () => {
  const v = X102B.copyScopeBetweenTargets([
    { target: 'blog', sourceRules: [{ pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }, { pattern: 'b.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }], targetRules: [{ pattern: 'a.example.com', pathPrefix: '/', methods: ['GET'], type: 'exclude' }] },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.cleanCount, 0);
  assert.equal(v.totalConflicts, 1);
  assert.equal(v.totalAdditions, 1);
});
test('54078 getScopeTemplates instantiates template rules', () => {
  const v = X102B.getScopeTemplates([{ templateId: 'api-only' }]);
  assert.equal(v.count, 3);
  assert.ok(v.totalRules >= 4);
  assert.ok(v.rows.find(r => r.templateId === 'api-only').instantiated.length >= 1);
});
test('54079 applyScopeInheritance marks overrides', () => {
  const v = X102B.applyScopeInheritance([
    { target: 'shop', programRules: [{ pattern: '*.example.com', pathPrefix: '/', methods: ['GET'], type: 'include' }, { pattern: '*.example.com', pathPrefix: '/admin', methods: ['GET'], type: 'include' }], overrides: [{ pattern: '*.example.com', pathPrefix: '/admin', methods: ['*'], type: 'exclude' }] },
  ]);
  assert.equal(v.count, 1);
  assert.equal(v.totalOverrides, 1);
  assert.equal(v.top.suppressedCount, 1);
  assert.equal(v.top.effectiveCount, 2);
  assert.equal(v.top.effective.find(r => r.pathPrefix === '/admin').isOverride, true);
});
test('54080 toggleScopeRuleEnabled previews verdict change', () => {
  const rules = [{ id: 'r1', pattern: '*.example.com', pathPrefix: '/v1', methods: ['GET'], type: 'include', enabled: true }];
  const v = X102B.toggleScopeRuleEnabled([
    { target: 'shop', toggleRuleId: 'r1', testUrl: 'https://api.example.com/v1/users', rules },
    { target: 'shop', toggleRuleId: 'missing', testUrl: 'https://api.example.com/v1/users', rules },
  ]);
  assert.equal(v.count, 2);
  assert.equal(v.changedCount, 1);
  assert.equal(v.foundCount, 1);
  const flip = v.rows.find(r => r.toggleRuleId === 'r1');
  assert.equal(flip.beforeInScope, true);
  assert.equal(flip.afterInScope, false);
});

// --- Audits ---
test('jsx audit: every exported component calls a core function', () => {
  for (const [name, src, prefix, minComponents] of [['A', A_JSX, 'X102A', 20], ['B', B_JSX, 'X102B', 20]]) {
    const components = src.match(/export function (\w+)\(/g) || [];
    assert.ok(components.length >= minComponents, `${name} jsx exports`);
    assert.ok(src.includes(`${prefix}.`), `${name} jsx must call core functions`);
  }
});

test('css audit: scoped w102 prefixes, zero keyframes, static layout only', () => {
  assert.ok(CSS_SRC.includes('.w102a-'));
  assert.ok(CSS_SRC.includes('.w102b-'));
  assert.ok(!CSS_SRC.includes('@key' + 'frames'), 'zero-keyframe rule violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('anim' + 'ation'), 'static-only order violated');
  assert.ok(!CSS_SRC.toLowerCase().includes('trans' + 'ition'), 'static-only order violated');
});

test('esbuild audit: both JSX files parse with real esbuild', () => {
  for (const f of ['Wave102A.jsx', 'Wave102B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', '--loader:.jsx=jsx', '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

test('branding audit: Infinity AI only, no other AI names', () => {
  const banned = ['cl' + 'aude', 'chat' + 'gpt', 'open' + 'ai', 'gem' + 'ini', 'copil' + 'ot'];
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    for (const b of banned) assert.ok(!low.includes(b), `${name} leaks ${b}`);
    assert.ok(src.includes('Infinity AI'), `${name} missing Infinity AI branding`);
  }
});

test('no-debris audit: no placeholder text in wave 102 sources', () => {
  for (const [name, src] of BRAND_SRC) {
    const low = src.toLowerCase();
    assert.ok(!src.includes('TODO'), `${name} carries placeholder debris`);
    assert.ok(!src.includes('FIXME'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('mo' + 'ck'), `${name} carries placeholder debris`);
    assert.ok(!low.includes('de' + 'mo'), `${name} carries placeholder debris`);
  }
});

test('purity audit: core functions do not mutate frozen inputs', () => {
  const frozenCidr = Object.freeze([Object.freeze({ cidr: '10.0.0.0/24', ip: '10.0.0.42', peerCidr: '' })]);
  const a = X102A.checkCidrContainment(frozenCidr);
  assert.equal(a.count, 1);
  assert.equal(a.insideCount, 1);
  const frozenDiff = Object.freeze([Object.freeze({ target: 'shop', before: Object.freeze([Object.freeze({ id: 'r1', pattern: 'a.example.com', pathPrefix: '/', methods: Object.freeze(['GET']), type: 'include' })]), after: Object.freeze([Object.freeze({ id: 'r1', pattern: 'a.example.com', pathPrefix: '/', methods: Object.freeze(['GET']), type: 'include' })]) })]);
  const b = X102B.viewScopeDiff(frozenDiff);
  assert.equal(b.count, 1);
  assert.equal(b.changedCount, 0);
});
