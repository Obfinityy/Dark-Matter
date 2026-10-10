/**
 * Tests for the webhook + API-key-channel security recon engine (ideas 1161-1170).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  WAVE1161_COVERAGE,
  ideaFunctions,
  evaluateSignatureVerification,
  assessReplayRisk,
  measureTimestampTolerance,
  assessSecretEntropy,
  estimateBruteForceFeasibility,
  mapUrlValidation,
  mapRetryBehavior,
  discoverKeySchemes,
  detectKeyInUrl,
  parseAuthRealms,
} from '../src/engines/webhookSecurityRecon.js';

describe('coverage registry', () => {
  it('covers ideas 1161-1170', () => {
    assert.deepEqual(WAVE1161_COVERAGE, [1161, 1162, 1163, 1164, 1165, 1166, 1167, 1168, 1169, 1170]);
  });

  it('ideaFunctions maps every idea to an exported function name', () => {
    const map = ideaFunctions();
    for (const n of WAVE1161_COVERAGE) {
      assert.ok(typeof map[n] === 'string', `idea ${n} has a function name`);
    }
    assert.equal(map[1161], 'evaluateSignatureVerification');
    assert.equal(map[1170], 'parseAuthRealms');
  });
});

describe('1161 evaluateSignatureVerification', () => {
  it('PASS when signatures are enforced', () => {
    const r = evaluateSignatureVerification({
      unsignedAccepted: false,
      wrongSignatureAccepted: false,
      missingTimestampRejected: true,
    });
    assert.equal(r.verdict, 'PASS');
    assert.ok(r.score >= 80);
    assert.ok(r.findings.length > 0);
  });

  it('FAIL when unsigned and wrong signatures are accepted', () => {
    const r = evaluateSignatureVerification({ unsignedAccepted: true, wrongSignatureAccepted: true });
    assert.equal(r.verdict, 'FAIL');
    assert.ok(r.score < 40);
  });

  it('WEAK for partial enforcement', () => {
    const r = evaluateSignatureVerification({ unsignedAccepted: false, wrongSignatureAccepted: true });
    assert.equal(r.verdict, 'WEAK');
  });

  it('UNKNOWN with no observations', () => {
    const r = evaluateSignatureVerification({});
    assert.equal(r.verdict, 'UNKNOWN');
  });
});

describe('1162 assessReplayRisk', () => {
  it('IDEMPOTENT when repeats are deduplicated', () => {
    const r = assessReplayRisk({
      retryHistory: [
        { deliveryId: 'a', status: 'duplicate_ack' },
        { deliveryId: 'a', status: 'duplicate_ack' },
      ],
    });
    assert.equal(r.verdict, 'IDEMPOTENT');
    assert.equal(r.replayedCount, 0);
  });

  it('REPEATS_EXECUTED when repeats are re-executed', () => {
    const r = assessReplayRisk({
      retryHistory: [
        { deliveryId: 'a', status: 'accepted' },
        { deliveryId: 'a', status: 'accepted' },
      ],
    });
    assert.equal(r.verdict, 'REPEATS_EXECUTED');
    assert.equal(r.replayedCount, 2);
  });

  it('UNKNOWN with no history', () => {
    const r = assessReplayRisk({});
    assert.equal(r.verdict, 'UNKNOWN');
  });
});

describe('1163 measureTimestampTolerance', () => {
  it('flags a window wider than recommended', () => {
    const r = measureTimestampTolerance({ acceptedSkewsSeconds: [60, 120, 3600] });
    assert.equal(r.maxAcceptedSkewSeconds, 3600);
    assert.equal(r.withinRecommended, false);
    assert.ok(r.finding && r.finding.includes('3600'));
  });

  it('accepts a tight window', () => {
    const r = measureTimestampTolerance({ acceptedSkewsSeconds: [30, 120, 300] });
    assert.equal(r.withinRecommended, true);
    assert.equal(r.finding, null);
  });

  it('handles empty input', () => {
    const r = measureTimestampTolerance({ acceptedSkewsSeconds: [] });
    assert.equal(r.maxAcceptedSkewSeconds, null);
    assert.ok(r.windowAnalysis.includes('unknown'));
  });
});

describe('1164 assessSecretEntropy', () => {
  it('rates a 128-bit hex secret STRONG', () => {
    const r = assessSecretEntropy({ secretSample: 'x'.repeat(32), documentedFormat: '32-char hex string' });
    assert.equal(r.strength, 'STRONG');
    assert.ok(r.estimatedEntropyBits >= 128);
  });

  it('rates a short numeric secret WEAK', () => {
    const r = assessSecretEntropy({ secretSample: 'xxxxxx', documentedFormat: '6 digit numeric code' });
    assert.equal(r.strength, 'WEAK');
    assert.ok(r.estimatedEntropyBits < 80);
  });

  it('parses documented bit counts', () => {
    const r = assessSecretEntropy({ documentedFormat: '256-bit random secret' });
    assert.equal(r.strength, 'STRONG');
    assert.equal(r.estimatedEntropyBits, 256);
  });

  it('returns UNKNOWN when nothing is determinable', () => {
    const r = assessSecretEntropy({});
    assert.equal(r.strength, 'UNKNOWN');
    assert.equal(r.estimatedEntropyBits, null);
  });
});

describe('1165 estimateBruteForceFeasibility', () => {
  it('flags a tiny keyspace as feasible', () => {
    const r = estimateBruteForceFeasibility({ charsetSize: 10, length: 4 });
    assert.equal(r.feasible, true);
    assert.equal(r.bands.length, 3);
    assert.ok(r.bands[0].timeToExhaust.length > 0);
  });

  it('rates a 128-bit keyspace as infeasible', () => {
    const r = estimateBruteForceFeasibility({ charsetSize: 16, length: 32 });
    assert.equal(r.feasible, false);
    assert.ok(r.bands[2].timeToExhaust.includes('years'));
  });

  it('rejects invalid input', () => {
    const r = estimateBruteForceFeasibility({ charsetSize: 1, length: 0 });
    assert.equal(r.feasible, false);
    assert.equal(r.bands.length, 0);
  });
});

describe('1166 mapUrlValidation', () => {
  it('flags accepted internal/metadata URLs as OPEN', () => {
    const r = mapUrlValidation({
      acceptedUrls: ['https://hooks.example.com/ok', 'http://169.254.169.254/latest/meta-data/'],
      rejectedUrls: ['ftp://evil.example/x'],
    });
    assert.equal(r.posture, 'OPEN');
    assert.ok(r.ssrfFlags.some((f) => f.url.includes('169.254.169.254')));
  });

  it('STRICT when nothing risky is accepted', () => {
    const r = mapUrlValidation({
      acceptedUrls: ['https://hooks.example.com/ok'],
      rejectedUrls: ['http://localhost:8080/hook'],
    });
    assert.equal(r.posture, 'STRICT');
    assert.equal(r.ssrfFlags.length, 0);
  });

  it('flags non-HTTPS accepted callbacks', () => {
    const r = mapUrlValidation({ acceptedUrls: ['http://hooks.example.com/ok'] });
    assert.ok(r.ssrfFlags.some((f) => f.reason.includes('non-HTTPS')));
  });

  it('handles unparseable URLs gracefully', () => {
    const r = mapUrlValidation({ acceptedUrls: ['not a url at all'] });
    assert.ok(r.findings.some((f) => f.includes('not parseable')));
  });
});

describe('1167 mapRetryBehavior', () => {
  const base = Date.parse('2026-10-10T10:00:00Z');

  it('detects exponential backoff', () => {
    const r = mapRetryBehavior({
      attempts: [0, 60, 180, 420].map((s, i) => ({ at: new Date(base + s * 1000).toISOString(), status: i < 3 ? 'failed' : 'delivered' })),
    });
    assert.equal(r.attemptCount, 4);
    assert.equal(r.backoff, 'exponential');
    assert.deepEqual(r.backoffSeconds, [60, 120, 240]);
  });

  it('detects constant backoff', () => {
    const r = mapRetryBehavior({
      attempts: [0, 300, 600, 900].map((s) => ({ at: new Date(base + s * 1000).toISOString(), status: 'failed' })),
    });
    assert.equal(r.backoff, 'constant');
  });

  it('flags hammering when retries are rapid', () => {
    const r = mapRetryBehavior({
      attempts: [0, 5, 10, 15, 20, 25, 30].map((s) => ({ at: new Date(base + s * 1000).toISOString(), status: 'failed' })),
    });
    assert.ok(r.findings.some((f) => /hammering/i.test(f)));
    assert.equal(r.hammeringWindowSeconds, 30);
  });

  it('handles empty input', () => {
    const r = mapRetryBehavior({});
    assert.equal(r.attemptCount, 0);
    assert.equal(r.backoff, 'unknown');
  });
});

describe('1168 discoverKeySchemes', () => {
  it('discovers multiple schemes and flags query params as weakest', () => {
    const r = discoverKeySchemes({
      placements: [
        { placement: 'header', scheme: 'Bearer', accepted: true },
        { placement: 'query', accepted: true },
        { placement: 'cookie', accepted: false },
      ],
    });
    assert.ok(r.schemes.includes('bearer-header'));
    assert.ok(r.schemes.includes('query-param'));
    assert.equal(r.weakestChannel, 'query-param');
    assert.ok(r.findings.some((f) => f.includes('query string')));
  });

  it('no weakest channel when nothing is accepted', () => {
    const r = discoverKeySchemes({ placements: [{ placement: 'header', scheme: 'Bearer', accepted: false }] });
    assert.equal(r.weakestChannel, null);
    assert.equal(r.schemes.length, 0);
  });
});

describe('1169 detectKeyInUrl', () => {
  it('detects keys in query params and redacts values', () => {
    const r = detectKeyInUrl([
      'https://api.example.com/v1/users?api_key=sk_live_abcdef1234567890',
      'https://api.example.com/v1/users?page=2',
    ]);
    assert.equal(r.length, 1);
    assert.equal(r[0].param, 'api_key');
    assert.ok(!r[0].redactedUrl.includes('abcdef1234567890'));
    assert.ok(r[0].redactedUrl.includes('...redacted'));
  });

  it('handles non-string and malformed input', () => {
    const r = detectKeyInUrl([null, 42, 'https://x.example/?token=short']);
    assert.deepEqual(r, []);
  });

  it('ignores URLs without key-like params', () => {
    const r = detectKeyInUrl(['https://api.example.com/search?q=hello&page=3']);
    assert.deepEqual(r, []);
  });
});

describe('1170 parseAuthRealms', () => {
  it('parses Basic and Bearer realms', () => {
    const r = parseAuthRealms([
      'Basic realm="Acme API (staging)", charset="UTF-8"',
      'Bearer realm="acme-prod", error="invalid_token"',
    ]);
    assert.equal(r.length, 2);
    assert.equal(r[0].scheme, 'basic');
    assert.equal(r[0].realm, 'Acme API (staging)');
    assert.ok(r[0].envHints.includes('staging'));
    assert.ok(r[1].envHints.includes('production'));
  });

  it('extracts edition hints', () => {
    const r = parseAuthRealms(['Digest realm="Internal v2.4-beta admin console"']);
    assert.ok(r[0].envHints.includes('internal'));
    assert.ok(r[0].envHints.includes('beta'));
    assert.ok(r[0].envHints.includes('v2.4'));
  });

  it('handles empty input', () => {
    assert.deepEqual(parseAuthRealms([]), []);
    assert.deepEqual(parseAuthRealms(null), []);
  });

  it('parses headers without a realm', () => {
    const r = parseAuthRealms(['Bearer']);
    assert.equal(r.length, 1);
    assert.equal(r[0].realm, null);
  });
});
