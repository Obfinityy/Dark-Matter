import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WAVE107_C_IDEAS,
  findingHistoryFactor,
  changeVelocityFactor,
  authComplexityFactor,
  apiRichnessFactor,
  thirdPartyRiskFactor,
  certificateHygieneFactor,
  securityHeaderFactor,
  subdomainSprawlFactor,
  cloudFootprintFactor,
  explainScoreBreakdown,
  scoreTarget,
} from './wave107CCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(DIR, f), 'utf8');

const EXPECTED_TITLES = {
  54261: 'Finding history factor',
  54262: 'Change velocity factor',
  54263: 'Authentication complexity factor',
  54264: 'API richness factor',
  54265: 'Third-party risk factor',
  54266: 'Certificate hygiene factor',
  54267: 'Security header factor',
  54268: 'Subdomain sprawl factor',
  54269: 'Cloud footprint factor',
  54270: 'Score breakdown explainer',
};

test('WAVE107_C_IDEAS has exactly 10 entries with ids 54261-54270 and exact titles', () => {
  assert.equal(WAVE107_C_IDEAS.length, 10);
  const ids = WAVE107_C_IDEAS.map(e => e.id);
  assert.deepEqual(ids, [54261, 54262, 54263, 54264, 54265, 54266, 54267, 54268, 54269, 54270]);
  for (const entry of WAVE107_C_IDEAS) {
    assert.equal(entry.title, EXPECTED_TITLES[entry.id], `title mismatch for ${entry.id}`);
  }
});

// Idea 54261 — Finding history factor
test('findingHistoryFactor rewards productive targets, 0 for no history', () => {
  assert.equal(findingHistoryFactor({}), 0);
  assert.equal(findingHistoryFactor({ validFindings: 0, totalFindings: 0, pastHunts: 2 }), 0);
  const hot = findingHistoryFactor({ validFindings: 6, totalFindings: 9, pastHunts: 3 });
  const cold = findingHistoryFactor({ validFindings: 0, totalFindings: 5, pastHunts: 2 });
  assert.ok(hot > cold);
  assert.ok(hot >= 0 && hot <= 10);
});

// Idea 54262 — Change velocity factor
test('changeVelocityFactor scores churn higher, 0 when idle', () => {
  assert.equal(changeVelocityFactor({}), 0);
  const fast = changeVelocityFactor({ deploysPerWeek: 10, newEndpoints: 20, diffLines: 8000 });
  const slow = changeVelocityFactor({ deploysPerWeek: 1, newEndpoints: 0, diffLines: 100 });
  assert.ok(fast > slow);
  assert.ok(fast <= 10);
});

// Idea 54263 — Authentication complexity factor
test('authComplexityFactor rises with roles, SSO, and OAuth surface', () => {
  assert.equal(authComplexityFactor({}), 0);
  const complex = authComplexityFactor({ roles: 5, ssoProviders: 2, oauthClients: 4, mfaModes: 2 });
  const simple = authComplexityFactor({ roles: 1 });
  assert.ok(complex > simple);
  assert.ok(complex <= 10);
});

// Idea 54264 — API richness factor
test('apiRichnessFactor weighs GraphQL, REST, and undocumented endpoints', () => {
  assert.equal(apiRichnessFactor({}), 0);
  const rich = apiRichnessFactor({ graphqlOps: 30, restEndpoints: 150, undocumentedEndpoints: 30 });
  const thin = apiRichnessFactor({ restEndpoints: 10 });
  assert.ok(rich > thin);
  assert.ok(rich <= 10);
});

// Idea 54265 — Third-party risk factor
test('thirdPartyRiskFactor penalizes script and integration sprawl', () => {
  assert.equal(thirdPartyRiskFactor({}), 0);
  const sprawl = thirdPartyRiskFactor({ scripts: 30, integrations: 12, adTrackers: 8 });
  const lean = thirdPartyRiskFactor({ scripts: 3 });
  assert.ok(sprawl > lean);
  assert.ok(sprawl <= 10);
});

// Idea 54266 — Certificate hygiene factor
test('certificateHygieneFactor is 0 for clean chains, high for broken/expired', () => {
  const clean = certificateHygieneFactor({ chainValid: true, daysToExpiry: 300, issuerReputation: 0.95 });
  assert.equal(clean, 0);
  const broken = certificateHygieneFactor({ chainValid: false, daysToExpiry: -10, issuerReputation: 0.2 });
  assert.ok(broken >= 9);
  const expiring = certificateHygieneFactor({ chainValid: true, daysToExpiry: 5, issuerReputation: 0.95 });
  assert.ok(expiring > clean);
});

// Idea 54267 — Security header factor
test('securityHeaderFactor penalizes missing protective headers', () => {
  const good = securityHeaderFactor({
    'Content-Security-Policy': "default-src 'self'",
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=()',
  });
  assert.equal(good, 0);
  const bad = securityHeaderFactor({});
  assert.ok(bad > 6);
  // Header name casing is normalized.
  const cased = securityHeaderFactor({ 'STRICT-TRANSPORT-SECURITY': 'max-age=31536000' });
  assert.ok(cased < bad);
});

// Idea 54268 — Subdomain sprawl factor
test('subdomainSprawlFactor weighs unmanaged and dangling subdomains', () => {
  assert.equal(subdomainSprawlFactor({}), 0);
  const sprawl = subdomainSprawlFactor({ total: 150, unmanaged: 30, dangling: 5 });
  const tight = subdomainSprawlFactor({ total: 10, unmanaged: 1, dangling: 0 });
  assert.ok(sprawl > tight);
  assert.ok(sprawl <= 10);
});

// Idea 54269 — Cloud footprint factor
test('cloudFootprintFactor rises with cloud asset exposure and misconfigs', () => {
  assert.equal(cloudFootprintFactor({}), 0);
  const broad = cloudFootprintFactor({ buckets: 15, functions: 40, publicIps: 80, misconfigs: 6 });
  const narrow = cloudFootprintFactor({ buckets: 2 });
  assert.ok(broad > narrow);
  assert.ok(broad <= 10);
});

// Idea 54270 — Score breakdown explainer
test('explainScoreBreakdown: parts sum to total, sorted desc, with reasons', () => {
  const res = explainScoreBreakdown({
    findingHistory: { points: 6.5, reason: 'past wins' },
    certCheck: { points: 2.5, reason: 'expiry' },
  });
  const sum = res.parts.reduce((s, p) => s + p.points, 0);
  assert.equal(res.total, sum);
  assert.ok(res.parts[0].points >= res.parts[1].points);
  assert.deepEqual(
    res.parts.map(p => Object.keys(p).sort()),
    [['factor', 'points', 'reason'], ['factor', 'points', 'reason']]
  );
});

test('explainScoreBreakdown maps known keys to idea titles', () => {
  const res = explainScoreBreakdown({ authComplexity: { points: 5, reason: 'SSO sprawl' } });
  assert.equal(res.parts[0].factor, 'Authentication complexity factor');
});

test('scoreTarget composes all nine factors and explainer total matches parts', () => {
  const res = scoreTarget({
    history: { validFindings: 4, totalFindings: 6, pastHunts: 2 },
    headers: {},
  });
  assert.equal(res.parts.length, 9);
  assert.equal(res.total, res.parts.reduce((s, p) => s + p.points, 0));
  assert.ok(res.total >= 0 && res.total <= 90);
});

// No branding leak — only "Infinity AI", "Dark Matter", "Obfinity" are allowed.
test('no branding leak in the 3 files', () => {
  const banned = 'Mu' + 'se'; // constructed so this test file stays clean too
  const banned2 = 'anti' + 'gravity';
  for (const f of ['wave107CCores.js', 'Wave107C.jsx', 'wave107C.test.js']) {
    const src = read(f);
    assert.ok(!src.includes(banned), `${f} mentions a banned brand name`);
    assert.ok(!src.toLowerCase().includes(banned2), `${f} mentions a banned brand name`);
  }
});

test('Infinity AI branding is present in the component', () => {
  assert.ok(read('Wave107C.jsx').includes('Infinity AI'));
});
