import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE1311_COVERAGE,
  ideaFunctions,
  isPrivilegedScope,
  detectScopeDrift,
  planCanaryKeys,
  analyzeSelfServeRisk,
  analyzeQuotaBehavior,
  diffPlanTiers,
  evaluateTrialScope,
  analyzeExpiredKeyGrace,
  parseDeprecationNotices,
  diffSdkVersions,
  diffMobileWebApis,
} from '../src/engines/apiKeyTierStaleRecon.js';

// ---------- module contract ----------

test('coverage lists ideas 1311-1320 and maps each to a function', () => {
  assert.deepEqual(WAVE1311_COVERAGE, [1311, 1312, 1313, 1314, 1315, 1316, 1317, 1318, 1319, 1320]);
  const map = ideaFunctions();
  assert.equal(Object.keys(map).length, 10);
  assert.equal(map[1311], 'detectScopeDrift');
  assert.equal(map[1320], 'diffMobileWebApis');
});

// ---------- Idea 01311: scope-drift detection ----------

test('01311: detectScopeDrift flags silently added privileged scopes as high risk', () => {
  const r = detectScopeDrift(['read:users'], ['read:users', 'admin:all']);
  assert.equal(r.drifted, true);
  assert.deepEqual(r.added, ['admin:all']);
  assert.deepEqual(r.expandedPrivileged, ['admin:all']);
  assert.equal(r.risk, 'high');
  assert.ok(r.findings.some((f) => f.startsWith('HIGH')));
});

test('01311: detectScopeDrift reports no drift for identical snapshots', () => {
  const r = detectScopeDrift(['read:a', 'read:b'], ['read:b', 'read:a']);
  assert.equal(r.drifted, false);
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.removed, []);
  assert.deepEqual(r.unchanged, ['read:a', 'read:b']);
  assert.equal(r.risk, 'none');
});

test('01311: detectScopeDrift supports per-key maps and reports removals', () => {
  const r = detectScopeDrift({ key1: ['read:a', 'write:a'], key2: ['read:b'] }, { key1: ['read:a'], key2: ['read:b'] });
  assert.deepEqual(r.removed, ['write:a']);
  assert.deepEqual(r.perKey.key1.removed, ['write:a']);
  assert.deepEqual(r.perKey.key2.added, []);
  assert.equal(r.risk, 'low');
});

test('01311: isPrivilegedScope matches privileged keywords, ignores plain read scopes', () => {
  assert.equal(isPrivilegedScope('billing:write'), true);
  assert.equal(isPrivilegedScope('Admin'), true);
  assert.equal(isPrivilegedScope('read:public-profile'), false);
});

// ---------- Idea 01312: canary key planning ----------

test('01312: planCanaryKeys generates one descriptor per location with monitoring rules', () => {
  const r = planCanaryKeys([
    { name: 'Public API docs', kind: 'docs', visibility: 'public' },
    { name: 'CI env sample', kind: 'ci', visibility: 'internal' },
  ]);
  assert.equal(r.canaries.length, 2);
  assert.equal(r.canaries[0].id, 'canary-public-api-docs-01');
  assert.ok(r.canaries[0].tokenPrefix.startsWith('dm_canary_'));
  assert.ok(r.canaries[0].alertOn.includes('any-authenticated-use'));
  assert.equal(r.coverage.total, 2);
  assert.equal(r.coverage.byKind.docs, 1);
  assert.equal(r.coverage.publicFacing, 1);
});

test('01312: planCanaryKeys never fabricates live credentials, points at vault provisioning', () => {
  const r = planCanaryKeys([{ name: 'repo README' }]);
  assert.ok(r.canaries[0].provisionVia.includes('vault'));
  // No fabricated live credentials: only a prefix + a placeholder-shaped id, never a secret value.
  assert.ok(!JSON.stringify(r.canaries[0]).match(/sk-[A-Za-z0-9]{16,}|token-[A-Za-z0-9]{24,}|"token"\s*:\s*"[^"]+"/));
  assert.equal(r.canaries[0].rotationDays, 90);
});

test('01312: planCanaryKeys handles empty locations gracefully', () => {
  const r = planCanaryKeys([]);
  assert.deepEqual(r.canaries, []);
  assert.equal(r.coverage.total, 0);
  assert.ok(r.findings[0].includes('No locations'));
});

// ---------- Idea 01313: self-serve issuance risk ----------

test('01313: analyzeSelfServeRisk scores frictionless issuance as high', () => {
  const r = analyzeSelfServeRisk({
    emailVerification: false, captchaOrBotCheck: false, paymentInstrumentRequired: false,
    keysPerAccount: 25, signupRateLimit: false, phoneVerification: false, trialDays: 14,
  });
  assert.equal(r.level, 'high');
  assert.ok(r.score >= 60);
  assert.ok(r.riskFactors.some((f) => f.factor === 'no-email-verification' && f.severity === 'high'));
  assert.ok(r.riskFactors.some((f) => f.factor === 'generous-key-quota'));
});

test('01313: analyzeSelfServeRisk scores hardened issuance as low', () => {
  const r = analyzeSelfServeRisk({
    emailVerification: true, captchaOrBotCheck: true, paymentInstrumentRequired: true,
    keysPerAccount: 2, signupRateLimit: true, phoneVerification: true, trialDays: 7,
  });
  assert.equal(r.level, 'low');
  assert.deepEqual(r.riskFactors, []);
});

test('01313: analyzeSelfServeRisk caps score at 100 and weights severities', () => {
  const r = analyzeSelfServeRisk({ emailVerification: false, captchaOrBotCheck: false, signupRateLimit: false });
  assert.ok(r.score <= 100);
  assert.equal(r.score, 90); // 3 high factors x 30
});

// ---------- Idea 01314: quota behavior analysis (passive) ----------

test('01314: analyzeQuotaBehavior maps ceiling and hard-429 behavior per key', () => {
  const r = analyzeQuotaBehavior([
    { keyLabel: 'free-key', observedCeiling: 100, limitHeader: 100, status429Count: 12, retryAfterSec: 60, windowMs: 60000 },
  ]);
  const c = r.ceilings['free-key'];
  assert.equal(c.observedCeiling, 100);
  assert.equal(c.limitSource, 'header');
  assert.equal(c.throttlingBehavior, 'hard-429');
  assert.equal(c.retryAfterSec, 60);
  assert.ok(c.findings.some((f) => f.includes('Hard 429')));
});

test('01314: analyzeQuotaBehavior detects soft degradation without 429s', () => {
  const r = analyzeQuotaBehavior([{ keyLabel: 'trial', degradedInsteadOf429: true, requestsSeen: 500 }]);
  assert.equal(r.ceilings['trial'].throttlingBehavior, 'soft-degrade');
  assert.equal(r.ceilings['trial'].observedCeiling, null);
});

test('01314: analyzeQuotaBehavior returns empty map with a finding for no observations', () => {
  const r = analyzeQuotaBehavior([]);
  assert.deepEqual(r.ceilings, {});
  assert.ok(r.findings[0].includes('No quota observations'));
});

// ---------- Idea 01315: plan-tier differential ----------

test('01315: diffPlanTiers flags paid-documented endpoints reachable on free tier', () => {
  const free = [{ path: '/v1/reports/export', method: 'GET', accessible: true, documentedTier: 'Enterprise' }];
  const paid = [{ path: '/v1/reports/export', method: 'GET', accessible: true, documentedTier: 'Enterprise' }];
  const r = diffPlanTiers(free, paid);
  assert.equal(r.summary.unprotectedPaid, 1);
  assert.equal(r.flags[0].type, 'unprotected-paid');
  assert.equal(r.flags[0].severity, 'high');
  assert.ok(r.findings.some((f) => f.startsWith('HIGH')));
});

test('01315: diffPlanTiers marks consistent tier gates as info, not findings', () => {
  const free = [{ path: '/v1/sso', accessible: false, documentedTier: 'Paid' }];
  const paid = [{ path: '/v1/sso', accessible: true, documentedTier: 'Paid' }];
  const r = diffPlanTiers(free, paid);
  assert.equal(r.summary.unprotectedPaid, 0);
  assert.equal(r.flags[0].type, 'consistent');
  assert.equal(r.flags[0].severity, 'info');
});

test('01315: diffPlanTiers ignores endpoints missing from the paid inventory', () => {
  const r = diffPlanTiers([{ path: '/v1/only-free', accessible: true }], []);
  assert.deepEqual(r.flags, []);
  assert.equal(r.summary.total, 0);
});

// ---------- Idea 01316: trial scope evaluation ----------

test('01316: evaluateTrialScope flags enterprise features present on trial keys', () => {
  const r = evaluateTrialScope(['read', 'write', 'sso'], [
    { path: '/v1/sso/config', method: 'POST', requiredFeature: 'sso' },
    { path: '/v1/audit', method: 'GET', requiredFeature: 'audit-logs' },
  ]);
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].path, '/v1/sso/config');
  assert.equal(r.risk, 'medium');
});

test('01316: evaluateTrialScope rates unreleased features in trial scope as high', () => {
  const r = evaluateTrialScope(['beta-ai-assistant'], [
    { path: '/v1/ai/draft', requiredFeature: 'beta-ai-assistant' },
  ]);
  assert.equal(r.matches[0].severity, 'high');
  assert.equal(r.risk, 'high');
  assert.deepEqual(r.unreleasedInTrial, ['beta-ai-assistant']);
});

test('01316: evaluateTrialScope reports clean when trial holds no enterprise features', () => {
  const r = evaluateTrialScope(['read', 'write'], [{ path: '/v1/sso', requiredFeature: 'sso' }]);
  assert.deepEqual(r.matches, []);
  assert.equal(r.risk, 'none');
});

// ---------- Idea 01317: expired-key grace measurement ----------

test('01317: analyzeExpiredKeyGrace measures post-expiry honored window', () => {
  const expiredAt = 1_000_000;
  const r = analyzeExpiredKeyGrace([
    { keyLabel: 'k1', expiredAtMs: expiredAt, requestAtMs: expiredAt + 3_600_000, status: 200 },
    { keyLabel: 'k1', expiredAtMs: expiredAt, requestAtMs: expiredAt + 7_200_000, status: 200 },
    { keyLabel: 'k1', expiredAtMs: expiredAt, requestAtMs: expiredAt + 10_800_000, status: 401 },
  ]);
  assert.equal(r.graceObserved, true);
  assert.equal(r.maxGraceMs, 7_200_000);
  assert.equal(r.perKey.k1.verdict, 'grace-honored');
  assert.ok(r.findings[0].includes('Grace window observed'));
});

test('01317: analyzeExpiredKeyGrace reports hard-expired keys with no grace', () => {
  const r = analyzeExpiredKeyGrace([
    { keyLabel: 'k2', expiredAtMs: 1000, requestAtMs: 2000, status: 401 },
  ]);
  assert.equal(r.graceObserved, false);
  assert.equal(r.perKey.k2.verdict, 'hard-expired');
});

test('01317: analyzeExpiredKeyGrace handles empty input', () => {
  const r = analyzeExpiredKeyGrace([]);
  assert.equal(r.graceObserved, false);
  assert.equal(r.maxGraceMs, null);
  assert.ok(r.findings[0].includes('unknown'));
});

// ---------- Idea 01318: deprecation notice parsing ----------

test('01318: parseDeprecationNotices parses Sunset and Deprecation headers', () => {
  const r = parseDeprecationNotices('', {
    Deprecation: 'true',
    Sunset: 'Sat, 01 Nov 2026 00:00:00 GMT',
  });
  assert.equal(r.timeline.length, 2);
  const sunset = r.timeline.find((t) => t.type === 'sunset');
  assert.equal(sunset.source, 'header');
  assert.ok(sunset.date.startsWith('2026-11-01'));
});

test('01318: parseDeprecationNotices extracts dated deprecation lines from docs', () => {
  const r = parseDeprecationNotices('## v1 Users API\nThe /v1/users endpoint is deprecated and will sunset on 2026-12-31. Migrate to v2.', {});
  const entry = r.timeline.find((t) => t.source === 'docs');
  assert.ok(entry);
  assert.equal(entry.type, 'sunset');
  assert.ok(entry.date.startsWith('2026-12-31'));
  assert.ok(entry.context.includes('v1'));
});

test('01318: parseDeprecationNotices sorts timeline by date and reports empty input', () => {
  const dated = parseDeprecationNotices('Deprecated on 2026-05-01: old API.', { Sunset: 'Sat, 01 Nov 2025 00:00:00 GMT' });
  assert.ok(dated.timeline[0].date.startsWith('2025-11-01'));
  const empty = parseDeprecationNotices('', {});
  assert.deepEqual(empty.timeline, []);
  assert.ok(empty.findings[0].includes('No deprecation'));
});

// ---------- Idea 01319: SDK version diff ----------

test('01319: diffSdkVersions flags SDK-dropped routes as stale-but-live candidates', () => {
  const r = diffSdkVersions(
    ['GET /v1/legacy-export', 'GET /v1/users'],
    ['GET /v1/users', 'POST /v2/orders']
  );
  assert.deepEqual(r.dropped, ['GET /v1/legacy-export']);
  assert.deepEqual(r.added, ['POST /v2/orders']);
  assert.deepEqual(r.unchanged, ['GET /v1/users']);
  assert.equal(r.candidates.length, 1);
  assert.equal(r.candidates[0].retestPriority, 'high');
  assert.ok(r.candidates[0].reason.includes('stale-but-live'));
});

test('01319: diffSdkVersions normalizes method case and trailing slashes', () => {
  const r = diffSdkVersions(['get /v1/users/'], ['GET /v1/users']);
  assert.deepEqual(r.dropped, []);
  assert.deepEqual(r.unchanged, ['GET /v1/users']);
});

// ---------- Idea 01320: mobile vs web API diff ----------

test('01320: diffMobileWebApis surfaces mobile-only endpoints as candidates', () => {
  const r = diffMobileWebApis(
    ['GET /v1/feed', 'POST /v1/device/register', 'GET /v1/push/token'],
    ['GET /v1/feed', 'GET /v1/settings']
  );
  assert.deepEqual(r.mobileOnly, ['GET /v1/push/token', 'POST /v1/device/register']);
  assert.deepEqual(r.webOnly, ['GET /v1/settings']);
  assert.deepEqual(r.shared, ['GET /v1/feed']);
  assert.equal(r.candidates.length, 2);
  assert.ok(r.candidates[0].reason.includes('mobile-only'));
});

test('01320: diffMobileWebApis reports matching surfaces with no candidates', () => {
  const r = diffMobileWebApis(['GET /v1/a'], ['GET /v1/a']);
  assert.deepEqual(r.mobileOnly, []);
  assert.deepEqual(r.candidates, []);
  assert.ok(r.findings.some((f) => f.includes('match')));
});
