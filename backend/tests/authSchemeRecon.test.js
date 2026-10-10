/**
 * authSchemeRecon.test.js — Tests for the auth-scheme + CORS + response recon engine (ideas 1171-1180).
 *
 * All fixtures are synthetic. Functions are pure and deterministic; no
 * network access. No exploit material — findings flag patterns only and
 * never echo server file paths or secrets.
 *
 * Run: cd backend && node --test tests/authSchemeRecon.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  WAVE1171_COVERAGE,
  ideaFunctions,
  catalogAuthSchemes,
  analyzeAuthPrecedence,
  detectAuthFallback,
  mapMethodAuthGaps,
  mapPreflightCORS,
  checkSniffing,
  detectHtmlErrorPages,
  detectStackTraces,
  analyzeRequestIdFormat,
  extractServerTime,
} from '../src/engines/authSchemeRecon.js';

// ---------------------------------------------------------------------------
// Coverage contract
// ---------------------------------------------------------------------------
describe('coverage contract', () => {
  it('covers ideas 1171-1180 and maps each to a function', () => {
    assert.deepEqual(WAVE1171_COVERAGE, [1171, 1172, 1173, 1174, 1175, 1176, 1177, 1178, 1179, 1180]);
    const map = ideaFunctions();
    for (const n of WAVE1171_COVERAGE) {
      assert.ok(typeof map[n] === 'string' && map[n].length > 0, `missing map entry for ${n}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Idea 1171 — catalogAuthSchemes
// ---------------------------------------------------------------------------
describe('1171: catalogAuthSchemes', () => {
  it('catalogs schemes per endpoint and flags Negotiate→Basic fallback', () => {
    const out = catalogAuthSchemes([
      { endpoint: '/api/admin', wwwAuthenticate: 'Negotiate, Basic realm="corp"' },
      { endpoint: '/api/public', wwwAuthenticate: 'Bearer realm="api"' },
    ]);
    assert.equal(out.length, 2);
    assert.deepEqual(out[0].schemes, ['NEGOTIATE', 'BASIC']);
    assert.equal(out[0].hasFallbackPath, true);
    assert.ok(out[0].fallbackDetail.includes('downgrade'));
    assert.deepEqual(out[1].schemes, ['BEARER']);
    assert.equal(out[1].hasFallbackPath, false);
    assert.equal(out[1].fallbackDetail, null);
  });

  it('dedupes schemes, handles array values and empty input', () => {
    const out = catalogAuthSchemes([
      { endpoint: '/a', wwwAuthenticate: ['Basic realm="x"', 'Basic realm="x"'] },
      { endpoint: '/b', wwwAuthenticate: '' },
    ]);
    assert.deepEqual(out[0].schemes, ['BASIC']);
    assert.deepEqual(out[1].schemes, []);
    assert.deepEqual(catalogAuthSchemes([]), []);
  });
});

// ---------------------------------------------------------------------------
// Idea 1172 — analyzeAuthPrecedence
// ---------------------------------------------------------------------------
describe('1172: analyzeAuthPrecedence', () => {
  it('detects header winning over cookie', () => {
    const out = analyzeAuthPrecedence({ cookiePresent: true, headerPresent: true, observedIdentity: 'header' });
    assert.equal(out.observedIdentity, 'header');
    assert.ok(out.verdict.includes('header credential'));
    assert.equal(out.weakOverridesStrong, false);
  });

  it('flags weak-overrides-strong when cookie wins despite a header', () => {
    const out = analyzeAuthPrecedence({ cookiePresent: true, headerPresent: true, observedIdentity: 'cookie' });
    assert.equal(out.weakOverridesStrong, true);
    assert.ok(out.verdict.includes('cookie credential'));
  });

  it('handles anonymous and ambiguous outcomes', () => {
    assert.ok(analyzeAuthPrecedence({ observedIdentity: 'none' }).verdict.includes('anonymous'));
    assert.ok(analyzeAuthPrecedence({}).verdict.includes('Could not determine'));
    // Inconclusive when observed identity does not match what was sent
    assert.ok(analyzeAuthPrecedence({ observedIdentity: 'header' }).verdict.includes('inconclusive'));
  });
});

// ---------------------------------------------------------------------------
// Idea 1173 — detectAuthFallback
// ---------------------------------------------------------------------------
describe('1173: detectAuthFallback', () => {
  it('reports high fallback when secondary accepted without primary', () => {
    const out = detectAuthFallback({ primaryOmitted: true, secondaryAccepted: true });
    assert.equal(out.fallbackPresent, true);
    assert.equal(out.severity, 'high');
    assert.ok(out.finding.includes('downgrade'));
  });

  it('escalates to critical when MFA is skipped on the fallback path', () => {
    const out = detectAuthFallback({ primaryOmitted: true, secondaryAccepted: true, mfaSkipped: true });
    assert.equal(out.severity, 'critical');
    assert.ok(out.finding.includes('MFA'));
  });

  it('reports none when no fallback observed', () => {
    const out = detectAuthFallback({ primaryOmitted: true, secondaryAccepted: false });
    assert.equal(out.fallbackPresent, false);
    assert.equal(out.severity, 'none');
  });
});

// ---------------------------------------------------------------------------
// Idea 1174 — mapMethodAuthGaps
// ---------------------------------------------------------------------------
describe('1174: mapMethodAuthGaps', () => {
  it('finds methods serving 200 without auth on protected endpoints', () => {
    const out = mapMethodAuthGaps([
      { endpoint: '/api/users', methodStatuses: { GET: 200, POST: 401, DELETE: 403 } },
      { endpoint: '/api/health', methodStatuses: { GET: 200 } },
    ]);
    assert.deepEqual(out[0].protectedBy, ['POST', 'DELETE']);
    assert.deepEqual(out[0].anonymousMethods, ['GET']);
    assert.equal(out[0].gapPresent, true);
    assert.equal(out[1].gapPresent, false);
  });

  it('handles endpoints where every method is protected', () => {
    const out = mapMethodAuthGaps([
      { endpoint: '/api/vault', methodStatuses: { GET: 401, POST: 401 } },
    ]);
    assert.equal(out[0].gapPresent, false);
    assert.deepEqual(out[0].anonymousMethods, []);
  });
});

// ---------------------------------------------------------------------------
// Idea 1175 — mapPreflightCORS
// ---------------------------------------------------------------------------
describe('1175: mapPreflightCORS', () => {
  it('flags credentialed wildcard as high risk', () => {
    const out = mapPreflightCORS([
      { endpoint: '/api/data', origin: 'https://evil.example', allowOrigin: '*', allowCredentials: 'true', vary: 'Origin' },
    ]);
    assert.equal(out[0].credentialedWildcard, true);
    assert.equal(out[0].risk, 'high');
    assert.equal(out[0].varyPresent, true);
  });

  it('flags reflected origin with credentials as medium risk', () => {
    const out = mapPreflightCORS([
      { endpoint: '/api/data', origin: 'https://evil.example', allowOrigin: 'https://evil.example', allowCredentials: 'true', vary: '' },
    ]);
    assert.equal(out[0].reflectsOrigin, true);
    assert.equal(out[0].risk, 'medium');
    assert.equal(out[0].varyPresent, false);
  });

  it('marks restrictive policies as none', () => {
    const out = mapPreflightCORS([
      { endpoint: '/api/data', origin: 'https://evil.example', allowOrigin: 'https://app.example', allowCredentials: '', vary: 'Origin' },
    ]);
    assert.equal(out[0].risk, 'none');
    assert.equal(out[0].reflectsOrigin, false);
  });
});

// ---------------------------------------------------------------------------
// Idea 1176 — checkSniffing
// ---------------------------------------------------------------------------
describe('1176: checkSniffing', () => {
  it('passes when nosniff is present (case-insensitive headers)', () => {
    const out = checkSniffing({ 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/json' });
    assert.equal(out.nosniffPresent, true);
    assert.equal(out.sniffingRisk, false);
    assert.ok(out.finding.includes('mitigated'));
  });

  it('flags missing header as sniffing risk', () => {
    const out = checkSniffing({ 'Content-Type': 'application/json' });
    assert.equal(out.nosniffPresent, false);
    assert.equal(out.sniffingRisk, true);
    assert.equal(out.headerValue, null);
    assert.ok(out.finding.includes('missing'));
  });
});

// ---------------------------------------------------------------------------
// Idea 1177 — detectHtmlErrorPages
// ---------------------------------------------------------------------------
describe('1177: detectHtmlErrorPages', () => {
  it('detects HTML error pages on an API endpoint', () => {
    const out = detectHtmlErrorPages([
      { status: 500, contentType: 'text/html; charset=utf-8', body: '<html><head><title>Error</title></head><body>oops</body></html>' },
    ]);
    assert.equal(out[0].isHtml, true);
    assert.equal(out[0].xssFoothold, true);
    assert.equal(out[0].mismatch, false);
  });

  it('flags content-type/body mismatch when HTML rides a JSON type', () => {
    const out = detectHtmlErrorPages([
      { status: 404, contentType: 'application/json', body: '<!DOCTYPE html><html><body>not found</body></html>' },
    ]);
    assert.equal(out[0].mismatch, true);
    assert.equal(out[0].xssFoothold, true);
  });

  it('passes clean JSON errors', () => {
    const out = detectHtmlErrorPages([
      { status: 400, contentType: 'application/json', body: '{"error":"bad request"}' },
    ]);
    assert.equal(out[0].isHtml, false);
    assert.equal(out[0].xssFoothold, false);
    assert.ok(out[0].finding.includes('No HTML'));
  });
});

// ---------------------------------------------------------------------------
// Idea 1178 — detectStackTraces
// ---------------------------------------------------------------------------
describe('1178: detectStackTraces', () => {
  it('detects a Python traceback and redacts path/version values', () => {
    const body = 'Traceback (most recent call last):\n  File "/opt/app/api/views.py", line 12, in get\n    raise ValueError\nValueError: bad\nPowered by Django 4.2.1';
    const out = detectStackTraces([{ endpoint: '/api/x', status: 500, body }]);
    assert.equal(out[0].traceDetected, true);
    assert.deepEqual(out[0].patterns, ['python-traceback']);
    assert.equal(out[0].pathLeak, true);
    assert.equal(out[0].versionLeak, true);
    assert.ok(out[0].finding.includes('[redacted]'));
    assert.ok(!out[0].finding.includes('/opt/app/api/views.py'), 'must not echo the raw path');
    assert.ok(!out[0].finding.includes('4.2.1'), 'must not echo the raw version');
  });

  it('detects Node stack frames and Java exceptions', () => {
    const node = detectStackTraces([{ endpoint: '/a', status: 500, body: 'Error: boom\n    at handler (/srv/app/index.js:42:13)' }]);
    assert.ok(node[0].patterns.includes('node-error'));
    const java = detectStackTraces([{ endpoint: '/b', status: 500, body: 'java.lang.NullPointerException\n\tat com.shop.Cart.get(Cart.java:77)' }]);
    assert.ok(java[0].patterns.includes('java-exception'));
  });

  it('passes benign JSON errors', () => {
    const out = detectStackTraces([{ endpoint: '/api/x', status: 400, body: '{"error":"validation failed"}' }]);
    assert.equal(out[0].traceDetected, false);
    assert.deepEqual(out[0].patterns, []);
    assert.equal(out[0].pathLeak, false);
    assert.equal(out[0].versionLeak, false);
  });
});

// ---------------------------------------------------------------------------
// Idea 1179 — analyzeRequestIdFormat
// ---------------------------------------------------------------------------
describe('1179: analyzeRequestIdFormat', () => {
  it('classifies UUIDs as non-enumerable', () => {
    const out = analyzeRequestIdFormat([
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      'f6e5d4c3-b2a1-4d8e-7f6a-5c4b3a2d1e0f',
    ]);
    assert.equal(out.format, 'uuid');
    assert.equal(out.enumerationFeasible, false);
    assert.equal(out.entropyBitsEstimate, 122);
  });

  it('flags sequential numeric IDs as enumerable', () => {
    const out = analyzeRequestIdFormat(['1042', '1043', '1044']);
    assert.equal(out.format, 'sequential');
    assert.equal(out.enumerationFeasible, true);
    assert.ok(out.finding.includes('enumeration is feasible'));
  });

  it('classifies long unique hex as random and handles empty input', () => {
    const out = analyzeRequestIdFormat(['9f8e7d6c5b4a39281706f5e4d3c2b1a', '1234567890abcdef1234567890abcdef']);
    assert.equal(out.format, 'random');
    assert.equal(out.enumerationFeasible, false);
    const empty = analyzeRequestIdFormat([]);
    assert.equal(empty.format, 'unknown');
    assert.equal(empty.entropyBitsEstimate, null);
  });
});

// ---------------------------------------------------------------------------
// Idea 1180 — extractServerTime
// ---------------------------------------------------------------------------
describe('1180: extractServerTime', () => {
  it('parses the standard Date header to ISO', () => {
    const out = extractServerTime({ Date: 'Sat, 10 Oct 2026 13:00:00 GMT' });
    assert.equal(out.date, 'Sat, 10 Oct 2026 13:00:00 GMT');
    assert.equal(out.serverTimeISO, '2026-10-10T13:00:00.000Z');
    assert.equal(out.leaked, true);
    assert.deepEqual(out.customTimeHeaders, []);
  });

  it('lists custom timestamp headers and falls back to them', () => {
    const out = extractServerTime({ 'X-Server-Time': '2026-10-10T13:05:00.000Z' });
    assert.deepEqual(out.customTimeHeaders, ['x-server-time']);
    assert.equal(out.serverTimeISO, '2026-10-10T13:05:00.000Z');
    assert.equal(out.leaked, true);
  });

  it('reports no leak when no time headers are present', () => {
    const out = extractServerTime({ 'Content-Type': 'application/json' });
    assert.equal(out.leaked, false);
    assert.equal(out.serverTimeISO, null);
    assert.equal(out.date, null);
  });
});
