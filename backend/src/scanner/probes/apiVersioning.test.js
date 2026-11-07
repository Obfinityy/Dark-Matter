// Tests for the API versioning / deprecated version probe
// (coverage row #343 [Medium], phase 80).
// No network, no lab needed — all HTTP is via the fetchPage seam.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeApiVersioning,
  parseVersion,
  isApiShaped,
  apiBases,
} from './apiVersioning.js';
import { verifyFindings } from '../verifier.js';

const PAGE = 'http://lab.local/app/index.html';
const ORIGIN = 'http://lab.local';

// Stub fetchPage: map URL -> fetchPage-shaped { url, status, headers, body }.
// Anything unmapped is a 404. headers keys are lowercase (as fetchPage returns).
function stubFetch(mapping) {
  return async (url) => {
    const hit = mapping[url];
    if (!hit) return { url, status: 404, headers: {}, body: 'Not Found' };
    if (hit instanceof Error) throw hit;
    return { url, status: hit.status ?? 200, headers: hit.headers ?? {}, body: hit.body ?? '' };
  };
}

const JSON_USERS = JSON.stringify([{ id: 1, name: 'alice' }]);
const JSON_V1 = JSON.stringify({ version: 'v1', users: [] });
const JSON_V2 = JSON.stringify({ version: 'v2', users: [] });
const JSON_V3 = JSON.stringify({ version: 'v3', users: [] });
const HTML_PAGE = '<html><body><h1>Lab</h1></body></html>';

describe('parseVersion', () => {
  it('parses v1/v2/v3', () => {
    assert.equal(parseVersion('v1'), 1);
    assert.equal(parseVersion('v2'), 2);
    assert.equal(parseVersion('v3'), 3);
  });
  it('parses dotted versions', () => {
    assert.equal(parseVersion('1.0'), 1);
    assert.equal(parseVersion('2.0'), 2);
  });
  it('rejects non-versions', () => {
    assert.equal(parseVersion('api'), null);
    assert.equal(parseVersion('rest'), null);
    assert.equal(parseVersion(''), null);
    assert.equal(parseVersion(null), null);
    assert.equal(parseVersion('users'), null);
  });
});

describe('isApiShaped', () => {
  it('accepts 200 + application/json', () => {
    assert.equal(isApiShaped({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON_USERS }), true);
  });
  it('accepts 200 + JSON body without content-type', () => {
    assert.equal(isApiShaped({ status: 200, headers: {}, body: JSON_V1 }), true);
  });
  it('accepts a JSON array body', () => {
    assert.equal(isApiShaped({ status: 200, headers: {}, body: '[1,2]' }), true);
  });
  it('rejects HTML bodies (SPA fallback / login page)', () => {
    assert.equal(isApiShaped({ status: 200, headers: { 'content-type': 'text/html' }, body: HTML_PAGE }), false);
  });
  it('rejects non-2xx even with a JSON body', () => {
    assert.equal(isApiShaped({ status: 404, headers: {}, body: JSON_V1 }), false);
    assert.equal(isApiShaped({ status: 410, headers: {}, body: JSON_V1 }), false);
    assert.equal(isApiShaped({ status: 500, headers: {}, body: JSON_V1 }), false);
  });
  it('rejects empty bodies', () => {
    assert.equal(isApiShaped({ status: 200, headers: {}, body: '' }), false);
    assert.equal(isApiShaped({ status: 200, headers: {}, body: '   ' }), false);
  });
  it('rejects non-JSON text', () => {
    assert.equal(isApiShaped({ status: 200, headers: {}, body: 'hello world' }), false);
  });
});

describe('apiBases', () => {
  it('derives /api from an /api target', () => {
    assert.deepEqual(apiBases(PAGE, [`${ORIGIN}/api/users`]), ['/api', '']);
  });
  it('derives /rest from a /rest target', () => {
    assert.deepEqual(apiBases(PAGE, [`${ORIGIN}/rest/products`]), ['/rest', '']);
  });
  it('derives /api from a versioned /api/v2 target', () => {
    assert.deepEqual(apiBases(PAGE, [`${ORIGIN}/api/v2/users`]), ['/api', '']);
  });
  it('derives origin-level from a bare /v1 target', () => {
    assert.deepEqual(apiBases(PAGE, [`${ORIGIN}/v1/users`]), ['']);
  });
  it('returns only the origin-level base with no API targets', () => {
    assert.deepEqual(apiBases(PAGE, []), ['']);
  });
  it('dedupes bases', () => {
    assert.deepEqual(apiBases(PAGE, [`${ORIGIN}/api/a`, `${ORIGIN}/api/b`]), ['/api', '']);
  });
});

describe('probeApiVersioning', () => {
  it('returns [] when no version responds', async () => {
    const findings = await probeApiVersioning(PAGE, [], { fetchPage: stubFetch({}) });
    assert.deepEqual(findings, []);
  });
  it('does not fire on a single live version', async () => {
    const findings = await probeApiVersioning(PAGE, [], {
      fetchPage: stubFetch({ [`${ORIGIN}/api/v1`]: { body: JSON_V1 } }),
    });
    assert.deepEqual(findings, []);
  });
  it('fires on two live versions of the same base (older version is the finding)', async () => {
    const findings = await probeApiVersioning(PAGE, [`${ORIGIN}/api/users`], {
      fetchPage: stubFetch({
        [`${ORIGIN}/api/v1`]: { body: JSON_V1 },
        [`${ORIGIN}/api/v2`]: { body: JSON_V2 },
      }),
    });
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'api_versioning');
    assert.equal(f.severity, 'medium');
    assert.ok(f.title.includes('v1'), f.title);
    assert.ok(f.title.includes('v2'), f.title);
    assert.ok(f.evidence.request.includes(`${ORIGIN}/api/v1`));
    assert.equal(f.evidence.signalCorrelated, true);
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
  });
  it('fires twice when three versions are live (all but the highest)', async () => {
    const findings = await probeApiVersioning(PAGE, [], {
      fetchPage: stubFetch({
        [`${ORIGIN}/v1`]: { body: JSON_V1 },
        [`${ORIGIN}/v2`]: { body: JSON_V2 },
        [`${ORIGIN}/v3`]: { body: JSON_V3 },
      }),
    });
    assert.equal(findings.length, 2);
    assert.ok(findings.some((f) => f.url.endsWith('/v1')));
    assert.ok(findings.some((f) => f.url.endsWith('/v2')));
    assert.ok(!findings.some((f) => f.url.endsWith('/v3')));
  });
  it('fires on a Deprecation header even with a single live version', async () => {
    const findings = await probeApiVersioning(PAGE, [`${ORIGIN}/api/users`], {
      fetchPage: stubFetch({
        [`${ORIGIN}/api/v1`]: { headers: { deprecation: 'true' }, body: JSON_V1 },
      }),
    });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.toLowerCase().includes('deprecated'), findings[0].title);
    assert.ok(findings[0].evidence.response.includes('Deprecation: true'));
  });
  it('fires on a Sunset header', async () => {
    const findings = await probeApiVersioning(PAGE, [], {
      fetchPage: stubFetch({
        [`${ORIGIN}/v1`]: { headers: { sunset: 'Sat, 01 Nov 2026 00:00:00 GMT' }, body: JSON_V1 },
      }),
    });
    assert.equal(findings.length, 1);
    assert.ok(findings[0].evidence.response.includes('Sunset:'));
  });
  it('does not fire when the old version returns 410 Gone', async () => {
    const findings = await probeApiVersioning(PAGE, [], {
      fetchPage: stubFetch({
        [`${ORIGIN}/v1`]: { status: 410, body: JSON_V1 },
        [`${ORIGIN}/v2`]: { body: JSON_V2 },
      }),
    });
    assert.deepEqual(findings, []);
  });
  it('does not fire when versions return HTML (SPA fallback / login redirect)', async () => {
    const findings = await probeApiVersioning(PAGE, [], {
      fetchPage: stubFetch({
        [`${ORIGIN}/v1`]: { headers: { 'content-type': 'text/html' }, body: HTML_PAGE },
        [`${ORIGIN}/v2`]: { headers: { 'content-type': 'text/html' }, body: HTML_PAGE },
      }),
    });
    assert.deepEqual(findings, []);
  });
  it('does not fire when /api and /rest both live (different surfaces, not versions)', async () => {
    const findings = await probeApiVersioning(PAGE, [`${ORIGIN}/api/users`, `${ORIGIN}/rest/products`], {
      fetchPage: stubFetch({
        [`${ORIGIN}/api/v1`]: { body: JSON_V1 },
        [`${ORIGIN}/rest/v1`]: { body: JSON_V1 },
      }),
    });
    assert.deepEqual(findings, []);
  });
  it('returns [] when fetch throws (phase stays ok)', async () => {
    const findings = await probeApiVersioning(PAGE, [], {
      fetchPage: stubFetch({ [`${ORIGIN}/v1`]: new Error('boom') }),
    });
    assert.deepEqual(findings, []);
  });
  it('returns [] for an invalid page URL', async () => {
    const findings = await probeApiVersioning('not-a-url', [], { fetchPage: stubFetch({}) });
    assert.deepEqual(findings, []);
  });
  it('caps findings at 5', async () => {
    const mapping = {};
    for (const base of ['/api', '/rest', '']) {
      for (const seg of ['v1', 'v2', 'v3', '1.0', '2.0']) {
        mapping[`${ORIGIN}${base}/${seg}`] = { body: JSON_V1 };
      }
    }
    const findings = await probeApiVersioning(PAGE, [`${ORIGIN}/api/x`, `${ORIGIN}/rest/y`], {
      fetchPage: stubFetch(mapping),
    });
    assert.ok(findings.length <= 5, `got ${findings.length}`);
    assert.ok(findings.length > 0);
  });
});
