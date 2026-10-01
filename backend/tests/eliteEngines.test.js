/**
 * Tests for the elite hunting engines:
 * businessLogic, exploit, jsAnalyzer, stealth, cloud, apiSecurity, takeover, learning, visualProof
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LOGIC_TESTS, getTestsForWorkflow, getAllLogicTests } from '../src/agent/businessLogicEngine.js';
import { generatePoc, listPocTemplates } from '../src/agent/exploitEngine.js';
import { analyzeJavaScript, isAnalyzableJs } from '../src/agent/jsAnalyzer.js';
import { detectWaf, randomUserAgent, stealthDelay, RateLimitTracker, suggestBypasses } from '../src/agent/stealthEngine.js';
import { CLOUD_TESTS, guessBucketNames, findS3Buckets } from '../src/agent/cloudEngine.js';
import { API_TESTS, parseApiEndpoints } from '../src/agent/apiSecurityEngine.js';
import { matchTakeoverService, validateTakeoverHttp } from '../src/agent/takeoverEngine.js';
import { LearningEngine } from '../src/agent/learningEngine.js';
import { isUsableProof } from '../src/agent/visualProof.js';

describe('businessLogicEngine', () => {
  it('has logic tests covering all workflow types', () => {
    assert.ok(LOGIC_TESTS.length >= 10, 'should have 10+ logic tests');
    const ids = LOGIC_TESTS.map((t) => t.id);
    assert.ok(ids.includes('price_negative'), 'price manipulation');
    assert.ok(ids.includes('mass_assign_role'), 'mass assignment');
    assert.ok(ids.includes('race_coupon'), 'race condition');
    assert.ok(ids.includes('idor_increment'), 'IDOR');
  });

  it('getTestsForWorkflow filters correctly', () => {
    const checkout = getTestsForWorkflow('checkout');
    assert.ok(checkout.length > 0);
    assert.ok(checkout.every((t) => t.workflows.includes('checkout')));
  });

  it('price_negative mutates and detects', () => {
    const test = LOGIC_TESTS.find((t) => t.id === 'price_negative');
    const req = { params: { price: '99' }, body: {}, headers: {} };
    const mutated = test.mutate(req);
    assert.equal(mutated.params.price, '-1');

    // Baseline rejected, mutated accepted = vulnerable
    const result = test.detect(
      { status: 400, body: {} },
      { status: 200, body: { total: -1 } }
    );
    assert.equal(result.vulnerable, true);
  });

  it('mass assignment mutates correctly', () => {
    const test = LOGIC_TESTS.find((t) => t.id === 'mass_assign_role');
    const mutated = test.mutate({ body: { name: 'x' }, params: {}, headers: {} });
    assert.equal(mutated.body.role, 'admin');
    assert.equal(mutated.body.is_admin, 'true');
  });
});

describe('exploitEngine', () => {
  it('generates XSS PoC', () => {
    const poc = generatePoc({ type: 'xss_reflected', url: 'https://t.com/?q=x', parameter: 'q' });
    assert.ok(poc);
    assert.equal(poc.language, 'html');
    assert.ok(poc.code.includes('alert'));
  });

  it('generates SQLi PoC', () => {
    const poc = generatePoc({ type: 'sqli', url: 'https://t.com/login', parameter: 'user' });
    assert.ok(poc);
    assert.equal(poc.language, 'python');
    assert.ok(!poc.code.includes('DROP TABLE'), 'PoC must not be destructive');
  });

  it('returns null for unknown type', () => {
    assert.equal(generatePoc({ type: 'unknown_xyz' }), null);
  });

  it('lists templates', () => {
    assert.ok(listPocTemplates().length >= 5);
  });
});

describe('jsAnalyzer', () => {
  it('detects AWS keys', () => {
    const code = 'const key = "AKIAIOSFODNN7QWERTYU";';
    const r = analyzeJavaScript(code);
    assert.ok(r.secrets.some((s) => s.type === 'AWS Access Key'));
  });

  it('extracts API endpoints', () => {
    const code = 'fetch("/api/v1/users"); axios.get("/api/admin/config");';
    const r = analyzeJavaScript(code);
    assert.ok(r.endpoints.some((e) => e.includes('/api/v1/users')));
  });

  it('flags client-side role checks', () => {
    const code = 'if (user.role === "admin") { showPanel(); }';
    const r = analyzeJavaScript(code);
    assert.ok(r.logicFlags.some((f) => f.name === 'Client-side auth check'));
  });

  it('detects source maps', () => {
    const r = analyzeJavaScript('//# sourceMappingURL=app.js.map');
    assert.equal(r.sourceMap, true);
  });

  it('isAnalyzableJs filters libs', () => {
    assert.equal(isAnalyzableJs('https://t.com/app.js'), true);
    assert.equal(isAnalyzableJs('https://t.com/jquery.min.js'), false);
  });
});

describe('stealthEngine', () => {
  it('detects Cloudflare WAF', () => {
    const r = detectWaf({ 'cf-ray': 'abc123' }, '');
    assert.equal(r.detected, true);
    assert.equal(r.waf, 'Cloudflare');
  });

  it('randomUserAgent returns valid UA', () => {
    const ua = randomUserAgent();
    assert.ok(ua.includes('Mozilla'));
  });

  it('stealthDelay has jitter', () => {
    const d1 = stealthDelay(1000, 0.5);
    const d2 = stealthDelay(1000, 0.5);
    // Very unlikely to be identical with jitter (not guaranteed, just sanity)
    assert.ok(d1 >= 500 && d1 <= 1500);
    assert.ok(d2 >= 500 && d2 <= 1500);
  });

  it('RateLimitTracker backs off on 429', () => {
    const t = new RateLimitTracker();
    const r1 = t.record(429);
    assert.equal(r1.limited, true);
    assert.ok(r1.waitMs >= 5000);
    assert.equal(t.shouldWait(), true);

    const r2 = t.record(429);
    assert.ok(r2.waitMs > r1.waitMs, 'exponential backoff');
  });

  it('suggestBypasses for XSS', () => {
    const b = suggestBypasses('xss');
    assert.ok(b.length > 0);
    assert.ok(b.some((x) => x.name === 'Case variation'));
  });
});

describe('cloudEngine', () => {
  it('has cloud tests', () => {
    assert.ok(CLOUD_TESTS.length >= 4);
  });

  it('S3 listing detection works', () => {
    const test = CLOUD_TESTS.find((t) => t.id === 's3_list');
    const r = test.detect(200, '<ListBucketResult><Name>test</Name></ListBucketResult>');
    assert.equal(r.vulnerable, true);
  });

  it('guessBucketNames generates variants', () => {
    const names = guessBucketNames('assets.example.com');
    assert.ok(names.includes('assets'));
    assert.ok(names.includes('assets-prod'));
  });

  it('findS3Buckets extracts buckets', () => {
    const buckets = findS3Buckets('https://mybucket.s3.amazonaws.com/file.js');
    assert.ok(buckets.includes('mybucket'));
  });
});

describe('apiSecurityEngine', () => {
  it('BOLA generates ID mutations', () => {
    const test = API_TESTS.find((t) => t.id === 'bola_idor');
    const mutated = test.generate({ method: 'GET', path: '/api/users/123', body: {} });
    assert.ok(mutated.length >= 2);
    assert.ok(mutated.some((m) => m.path === '/api/users/124'));
  });

  it('JWT none strips signature', () => {
    const test = API_TESTS.find((t) => t.id === 'jwt_none');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: '1' })).toString('base64url');
    const ep = {
      method: 'GET', path: '/api/me',
      headers: { Authorization: `Bearer ${header}.${payload}.sig` }
    };
    const mutated = test.generate(ep);
    assert.equal(mutated.length, 1);
    assert.ok(mutated[0].headers.Authorization.includes('none') || mutated[0]._note === 'JWT alg=none');
  });

  it('parseApiEndpoints extracts APIs', () => {
    const eps = parseApiEndpoints(['https://t.com/api/v1/users?page=1', 'https://t.com/about']);
    assert.equal(eps.length, 1);
    assert.equal(eps[0].path, '/api/v1/users');
  });
});

describe('takeoverEngine', () => {
  it('matches GitHub Pages CNAME', () => {
    const s = matchTakeoverService('user.github.io');
    assert.ok(s);
    assert.equal(s.name, 'GitHub Pages');
  });

  it('validates dangling GitHub Pages', () => {
    const s = matchTakeoverService('user.github.io');
    const r = validateTakeoverHttp(s, 404, "There isn't a GitHub Pages site here.");
    assert.equal(r.vulnerable, true);
  });

  it('returns null for normal CNAME', () => {
    assert.equal(matchTakeoverService('cdn.example.com'), null);
  });
});

describe('learningEngine', () => {
  it('records and suggests techniques', () => {
    const e = new LearningEngine();
    e.recordTechnique('wordpress', 'sqli_boolean', true);
    e.recordTechnique('wordpress', 'sqli_boolean', true);
    e.recordTechnique('wordpress', 'xss_reflected', false);
    e.recordTechnique('wordpress', 'xss_reflected', false);

    const suggestions = e.suggestTechniques('wordpress');
    assert.equal(suggestions[0], 'sqli_boolean', 'best technique first');
  });

  it('tracks false positives', () => {
    const e = new LearningEngine();
    assert.equal(e.wasFalsePositive('xss', 'ctx'), false);
    e.recordFalsePositive('xss', 'ctx');
    e.recordFalsePositive('xss', 'ctx');
    assert.equal(e.wasFalsePositive('xss', 'ctx'), true);
  });

  it('serializes and restores', () => {
    const e = new LearningEngine();
    e.recordTechnique('react', 'idor', true);
    e.recordTechnique('react', 'idor', true);
    const json = e.toJSON();
    const e2 = LearningEngine.fromJSON(json);
    assert.deepEqual(e2.suggestTechniques('react'), ['idor']);
  });
});

describe('visualProof', () => {
  it('isUsableProof validates', () => {
    assert.equal(isUsableProof(null), false);
    assert.equal(isUsableProof({ screenshot: { data: 'x'.repeat(2000) } }), true);
    assert.equal(isUsableProof({ screenshot: { data: 'short' } }), false);
  });
});
