/**
 * apiVersionGrpcHookRecon.test.js — tests for idea-bank ideas 1291-1300.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE1291_COVERAGE,
  ideaFunctions,
  scoreWebhookAlgorithmAgility,
  detectVersionCookies,
  analyzeTokenVersionClaims,
  planChannelzProbes,
  analyzeServiceConfig,
  inferLoadBalancerBehavior,
  discoverRestHooks,
  classifyTopics,
  mapEventPii,
  scanErrorForKeyLeak,
} from '../src/engines/apiVersionGrpcHookRecon.js';

// ---------------------------------------------------------------- registry
test('coverage registry lists ideas 1291-1300', () => {
  assert.deepEqual(WAVE1291_COVERAGE, [1291, 1292, 1293, 1294, 1295, 1296, 1297, 1298, 1299, 1300]);
});

test('ideaFunctions maps every idea number to its function', () => {
  const map = ideaFunctions();
  assert.equal(Object.keys(map).length, 10);
  assert.equal(map[1291], 'scoreWebhookAlgorithmAgility');
  assert.equal(map[1300], 'scanErrorForKeyLeak');
});

// ---------------------------------------------------------------- 1291 ----
test('1291: strong-only HMAC config scores low downgrade risk', () => {
  const r = scoreWebhookAlgorithmAgility({ acceptedAlgorithms: ['HS256'] });
  assert.equal(r.downgradeRisk, 'low');
  assert.equal(r.score, 100);
  assert.deepEqual(r.strong, ['hs256']);
  assert.equal(r.confusionSurface, false);
  assert.ok(r.findings.some((f) => /no downgrade path/i.test(f)));
});

test('1291: alg none accepted is critical', () => {
  const r = scoreWebhookAlgorithmAgility({ acceptedAlgorithms: ['HS256', 'none'] });
  assert.equal(r.downgradeRisk, 'critical');
  assert.ok(r.score < 50);
  assert.ok(r.downgraded.includes('none'));
  assert.equal(r.confusionSurface, true);
  assert.ok(r.findings.some((f) => /none/.test(f)));
});

test('1291: weak hash + optional signatures raise risk', () => {
  const r = scoreWebhookAlgorithmAgility({ acceptedAlgorithms: ['MD5'], requiresSignature: false });
  assert.ok(['high', 'critical'].includes(r.downgradeRisk));
  assert.ok(r.downgraded.includes('md5'));
  assert.ok(r.findings.some((f) => /unsigned deliveries/i.test(f)));
});

// ---------------------------------------------------------------- 1292 ----
test('1292: detects version cookie by name and value', () => {
  const r = detectVersionCookies(['api_version=v2; Path=/; HttpOnly', 'session=abc123; Path=/']);
  assert.equal(r.cookies.length, 2);
  assert.equal(r.versionSignals.length, 1);
  assert.equal(r.versionSignals[0].name, 'api_version');
  assert.equal(r.hiddenVersionSurface, true);
  assert.ok(r.findings.some((f) => /cookie-driven/i.test(f)));
});

test('1292: ordinary cookies are not flagged', () => {
  const r = detectVersionCookies(['session=abc123; Path=/', 'theme=dark; Path=/']);
  assert.equal(r.versionSignals.length, 0);
  assert.equal(r.hiddenVersionSurface, false);
});

test('1292: empty input stays unknown', () => {
  const r = detectVersionCookies([]);
  assert.equal(r.cookies.length, 0);
  assert.equal(r.hiddenVersionSurface, false);
  assert.ok(r.findings.some((f) => /unknown/i.test(f)));
});

// ---------------------------------------------------------------- 1293 ----
test('1293: version claim detected and value echoed truncated', () => {
  const r = analyzeTokenVersionClaims({}, { ver: 'v2', sub: 'user-1', email: 'a@b.c' });
  assert.deepEqual(r.versionClaims, ['ver']);
  assert.equal(r.versionRoutingSuspected, true);
  const ver = r.claims.find((c) => c.name === 'ver');
  assert.equal(ver.versionValue, 'v2');
  const email = r.claims.find((c) => c.name === 'email');
  assert.ok(!('versionValue' in email), 'non-version claim values must not be echoed');
  assert.equal(email.valueType, 'string');
});

test('1293: no version claims means no routing suspicion', () => {
  const r = analyzeTokenVersionClaims({ alg: 'RS256' }, { sub: 'user-1', exp: 123 });
  assert.equal(r.versionRoutingSuspected, false);
  assert.deepEqual(r.versionClaims, []);
  assert.equal(r.formatOnly, true);
});

test('1293: version hint in kid is detected', () => {
  const r = analyzeTokenVersionClaims({ kid: 'signing-key-v3' }, { sub: 'user-1' });
  assert.equal(r.versionRoutingSuspected, true);
  assert.ok(r.findings.some((f) => /kid/i.test(f)));
});

// ---------------------------------------------------------------- 1294 ----
test('1294: builds channelz probe plan with no live calls', () => {
  const r = planChannelzProbes({ host: 'grpc.example.com' });
  assert.equal(r.target, 'grpc.example.com:443');
  assert.ok(r.probeCount >= 4);
  assert.ok(r.probes.every((p) => p.executes === false));
  assert.ok(r.probes.some((p) => p.service === 'grpc.channelz.v1.Channelz'));
  assert.ok(r.probes.every((p) => typeof p.defensiveNote === 'string' && p.defensiveNote.length > 0));
});

test('1294: defaults port and transport correctly', () => {
  const r = planChannelzProbes({ host: 'h', port: 50051, tls: false });
  assert.equal(r.target, 'h:50051');
  assert.ok(r.probes.every((p) => p.transport === 'h2c'));
});

test('1294: missing host yields empty plan', () => {
  const r = planChannelzProbes({});
  assert.equal(r.target, null);
  assert.equal(r.probeCount, 0);
  assert.ok(r.findings.some((f) => /No target host/i.test(f)));
});

// ---------------------------------------------------------------- 1295 ----
test('1295: extracts load-balancing and retry policy', () => {
  const cfg = JSON.stringify({
    loadBalancingConfig: [{ round_robin: {} }],
    methodConfig: [{
      name: [{ service: 'billing.Billing', method: 'Charge' }],
      retryPolicy: { maxAttempts: 4, initialBackoff: '0.1s', backoffMultiplier: 2, retryableStatusCodes: ['UNAVAILABLE'] },
      timeout: '5s',
    }],
  });
  const r = analyzeServiceConfig(cfg);
  assert.equal(r.parsed, true);
  assert.deepEqual(r.loadBalancing, ['round_robin']);
  assert.equal(r.retryPolicies.length, 1);
  assert.equal(r.retryPolicies[0].maxAttempts, 4);
  assert.deepEqual(r.retryPolicies[0].methods, ['billing.Billing/Charge']);
  assert.equal(r.timeouts.length, 1);
  assert.ok(r.findings.some((f) => /round_robin/i.test(f)));
});

test('1295: extracts hedging policy', () => {
  const cfg = JSON.stringify({
    methodConfig: [{
      name: [{}],
      hedgingPolicy: { maxAttempts: 3, hedgingDelay: '0.5s', nonFatalStatusCodes: ['UNAVAILABLE'] },
    }],
  });
  const r = analyzeServiceConfig(cfg);
  assert.equal(r.hedgingPolicies.length, 1);
  assert.equal(r.hedgingPolicies[0].maxAttempts, 3);
  assert.ok(r.findings.some((f) => /Hedging/i.test(f)));
});

test('1295: invalid JSON is reported, not thrown', () => {
  const r = analyzeServiceConfig('not json {');
  assert.equal(r.parsed, false);
  assert.ok(typeof r.parseError === 'string');
  assert.deepEqual(r.loadBalancing, []);
});

// ---------------------------------------------------------------- 1296 ----
test('1296: sticky routing detected from repeated backend ids', () => {
  const samples = Array.from({ length: 6 }, () => ({ backendId: 'i-1', durationMs: 42 }));
  const r = inferLoadBalancerBehavior(samples);
  assert.equal(r.backendCount, 1);
  assert.equal(r.sticky, true);
  assert.equal(r.stickinessRatio, 1);
  assert.equal(r.rotationSuspected, false);
  assert.ok(r.findings.some((f) => /Sticky/i.test(f)));
});

test('1296: cycling backends counted with rotation suspected', () => {
  const samples = ['a', 'b', 'c', 'a', 'b', 'c'].map((backendId, i) => ({ backendId, durationMs: 10 + i }));
  const r = inferLoadBalancerBehavior(samples);
  assert.equal(r.backendCount, 3);
  assert.deepEqual(r.backends, ['a', 'b', 'c']);
  assert.equal(r.rotationSuspected, true);
  assert.equal(r.timing.min, 10);
  assert.equal(r.timing.max, 15);
});

test('1296: empty samples stay unknown', () => {
  const r = inferLoadBalancerBehavior([]);
  assert.equal(r.sampleCount, 0);
  assert.equal(r.sticky, false);
  assert.equal(r.timing, null);
  assert.ok(r.findings.some((f) => /unknown/i.test(f)));
});

// ---------------------------------------------------------------- 1297 ----
test('1297: finds webhook subscription endpoints with high confidence', () => {
  const r = discoverRestHooks({
    paths: {
      '/v1/hooks/subscriptions': { post: {}, delete: {} },
      '/v1/users': { get: {} },
    },
  });
  assert.equal(r.endpointCount, 1);
  assert.equal(r.endpoints[0].path, '/v1/hooks/subscriptions');
  assert.equal(r.endpoints[0].confidence, 'high');
  assert.deepEqual(r.endpoints[0].methods, ['POST', 'DELETE']);
});

test('1297: path-array input yields medium confidence without methods', () => {
  const r = discoverRestHooks(['/webhooks/register', '/v1/status']);
  assert.equal(r.endpointCount, 1);
  assert.equal(r.endpoints[0].path, '/webhooks/register');
  assert.equal(r.endpoints[0].confidence, 'medium');
});

test('1297: no hook paths means empty result', () => {
  const r = discoverRestHooks({ paths: { '/v1/users': { get: {} } } });
  assert.equal(r.endpointCount, 0);
  assert.ok(r.findings.some((f) => /no REST-hook/i.test(f)));
});

// ---------------------------------------------------------------- 1298 ----
test('1298: user.deleted is critical', () => {
  const r = classifyTopics(['user.deleted']);
  assert.equal(r.classified[0].tier, 'critical');
  assert.equal(r.highestTier, 'critical');
  assert.ok(r.classified[0].matchedKeywords.includes('user.deleted'));
});

test('1298: payment and heartbeat tier correctly', () => {
  const r = classifyTopics(['payment.succeeded', 'heartbeat']);
  const byName = Object.fromEntries(r.classified.map((c) => [c.topic, c.tier]));
  assert.equal(byName['payment.succeeded'], 'high');
  assert.equal(byName['heartbeat'], 'low');
});

test('1298: tier counts add up', () => {
  const r = classifyTopics(['user.deleted', 'payment.failed', 'order.created', 'ping']);
  assert.deepEqual(r.tierCounts, { critical: 1, high: 1, medium: 1, low: 1 });
  assert.ok(r.findings.some((f) => /Critical topics/i.test(f)));
});

// ---------------------------------------------------------------- 1299 ----
test('1299: email field mapped as direct PII', () => {
  const r = mapEventPii({ 'user.created': { email: 'string', user_id: 'uuid', plan: 'string' } });
  assert.equal(r.totalPiiFields, 1);
  assert.equal(r.mapping['user.created'][0].field, 'email');
  assert.equal(r.mapping['user.created'][0].category, 'direct');
  assert.deepEqual(r.eventsWithPii, ['user.created']);
  assert.equal(r.piiDensity, Math.round((1 / 3) * 1000) / 1000);
});

test('1299: events without PII map to empty lists', () => {
  const r = mapEventPii({ 'system.ping': { timestamp: 'int', region: 'string' } });
  assert.deepEqual(r.mapping['system.ping'], []);
  assert.deepEqual(r.eventsWithPii, []);
  assert.equal(r.totalPiiFields, 0);
});

test('1299: financial and credential categories detected', () => {
  const r = mapEventPii({ 'payment.failed': { card_number: 'string', cvv: 'string', password: 'string', amount: 'number' } });
  const cats = r.mapping['payment.failed'].map((f) => f.category);
  assert.ok(cats.includes('financial'));
  assert.ok(cats.includes('credential'));
  assert.equal(r.totalPiiFields, 3);
});

// ---------------------------------------------------------------- 1300 ----
test('1300: AWS access key detected and redacted', () => {
  const key = 'AKIAIOSFODNN7EXAMPLE';
  const r = scanErrorForKeyLeak(`upstream error 500\naccess denied for ${key}\nretry later`);
  assert.equal(r.leakCount, 1);
  assert.equal(r.leaks[0].type, 'aws_access_key');
  assert.equal(r.leaks[0].line, 2);
  assert.ok(!JSON.stringify(r).includes(key), 'full secret must never appear in output');
  assert.ok(r.leaks[0].preview.includes('withheld'));
});

test('1300: ARN and private key detected', () => {
  const r = scanErrorForKeyLeak(
    'role arn:aws:iam::123456789012:role/deploy failed\n-----BEGIN RSA PRIVATE KEY-----\nMIIE...'
  );
  const types = r.leaks.map((l) => l.type);
  assert.ok(types.includes('aws_arn'));
  assert.ok(types.includes('private_key'));
  assert.ok(r.findings.some((f) => /LEAK DETECTED/i.test(f)));
});

test('1300: api key assignment and bearer token detected', () => {
  const r = scanErrorForKeyLeak('config dump: api_key = "supersecretvalue123"\nauth: Bearer abcdefghijklmnop1234');
  const types = r.leaks.map((l) => l.type);
  assert.ok(types.includes('api_key_assignment'));
  assert.ok(types.includes('bearer_token'));
  assert.ok(!JSON.stringify(r).includes('supersecretvalue123'));
});

test('1300: clean error text reports no leaks', () => {
  const r = scanErrorForKeyLeak('502 Bad Gateway\nupstream timeout after 30s');
  assert.equal(r.leakCount, 0);
  assert.equal(r.scannedLines, 2);
  assert.ok(r.findings.some((f) => /no key\/ARN leak/i.test(f)));
  assert.ok(typeof r.defensiveNote === 'string');
});
