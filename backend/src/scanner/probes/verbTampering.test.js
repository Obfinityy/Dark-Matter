// Tests for the verb-tampering probe (coverage rows #167 + #35).
// Mocked fetch throughout — no network, no lab needed.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeVerbTampering } from './verbTampering.js';
import { verifyFindings } from '../verifier.js';

const PAGE = '<html><body><h1>Welcome</h1><p>Some content here.</p></body></html>';

// Stub fetch: GET returns the baseline page (or getStatus/getUrl),
// HEAD answers 200, write verbs answer per `methods`.
// Tracks every call for gate/cap/redirect assertions.
function makeFetch({ page = PAGE, getStatus = 200, getUrl = null, methods = {}, headStatus = 200 } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push({ url: String(url), method });
    const headers = { get: () => '' };
    if (method === 'GET') {
      return { status: getStatus, text: async () => page, url: getUrl || String(url), headers };
    }
    if (method === 'HEAD') {
      return { status: headStatus, text: async () => '', url: String(url), headers };
    }
    const r = methods[method] || { status: 405, text: 'Method Not Allowed' };
    return { status: r.status, text: async () => r.text, url: String(url), headers };
  };
  return { fetch, calls };
}

async function withFetch(fetch, fn) {
  const orig = global.fetch;
  global.fetch = fetch;
  try {
    return await fn();
  } finally {
    global.fetch = orig;
  }
}

const URL = 'http://lab.local/page?id=1';

describe('verbTampering probe', () => {
  it('PUT 200 + same body as GET = finding (method confusion)', async () => {
    const { fetch } = makeFetch({ methods: { PUT: { status: 200, text: PAGE } } });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'verb_tampering');
    assert.equal(f.severity, 'medium');
    assert.equal(f.parameter, 'PUT');
    assert.ok(f.title.includes('PUT'));
    assert.ok(f.title.includes('method confusion'));
    assert.ok(f.evidence.request.includes('PUT http://lab.local/page?id=1'));
    assert.ok(f.evidence.response.includes('GET 200'));
    assert.ok(f.evidence.response.includes('PUT 200'));
    assert.ok(f.evidence.response.includes('similarity 1.00'));
    assert.ok(f.evidence.response.includes('sha256'));
    assert.equal(f.evidence.signalCorrelated, true);
  });

  it('PATCH 200 + same body = finding', async () => {
    const { fetch } = makeFetch({ methods: { PATCH: { status: 200, text: PAGE } } });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'PATCH');
  });

  it('DELETE 200 + same body = finding', async () => {
    const { fetch } = makeFetch({ methods: { DELETE: { status: 200, text: PAGE } } });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].parameter, 'DELETE');
  });

  it('PUT 405 / DELETE 405 = no finding', async () => {
    const { fetch } = makeFetch({
      methods: {
        PUT: { status: 405, text: 'Method Not Allowed' },
        DELETE: { status: 405, text: 'Method Not Allowed' },
        PATCH: { status: 501, text: 'Not Implemented' },
      },
    });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.deepEqual(findings, []);
  });

  it('PUT 302 (redirect) = no finding — redirects are never acceptance', async () => {
    const { fetch } = makeFetch({ methods: { PUT: { status: 302, text: '' } } });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.deepEqual(findings, []);
  });

  it('PUT 200 with a different body and no success marker = no finding', async () => {
    const { fetch } = makeFetch({
      page: `<html><body>${'x'.repeat(1000)}</body></html>`,
      methods: { PUT: { status: 200, text: 'error: something went wrong' } },
    });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.deepEqual(findings, []);
  });

  it('PUT 200 with a success marker the baseline lacks = finding (state-indicating success)', async () => {
    const { fetch } = makeFetch({
      page: '{"status":"idle","data":[]}',
      methods: { PUT: { status: 200, text: '{"success":true,"id":1}' } },
    });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('state-indicating success'));
    assert.ok(findings[0].evidence.response.includes('success marker'));
  });

  it('PUT 200 with a success marker the baseline ALSO has = no finding (differential fails)', async () => {
    const { fetch } = makeFetch({
      page: '{"success":true,"data":[]}',
      methods: { PUT: { status: 200, text: '{"success":true}' } },
    });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.deepEqual(findings, []);
  });

  it('HEAD 200 on a GET page = no finding (HEAD is correct behaviour, never a finding)', async () => {
    const { fetch } = makeFetch({ headStatus: 200 });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.deepEqual(findings, []);
  });

  it('gate: non-lab host (no allowWrite) sends HEAD only — PUT/DELETE/PATCH never leave', async () => {
    const { fetch, calls } = makeFetch({ methods: { PUT: { status: 200, text: PAGE } } });
    const findings = await withFetch(fetch, () => probeVerbTampering([URL], {}));
    assert.deepEqual(findings, []);
    assert.equal(calls.length, 1, 'exactly one request (HEAD) on a non-lab host');
    assert.equal(calls[0].method, 'HEAD');
    assert.ok(!calls.some((c) => ['PUT', 'DELETE', 'PATCH'].includes(c.method)));
  });

  it('GET baseline non-2xx = no finding and no write verb is sent', async () => {
    const { fetch, calls } = makeFetch({
      getStatus: 404,
      methods: { PUT: { status: 200, text: PAGE } },
    });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.deepEqual(findings, []);
    assert.ok(!calls.some((c) => ['PUT', 'DELETE', 'PATCH'].includes(c.method)));
  });

  it('caps at the first 10 endpoint URLs', async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `http://lab.local/p${i}?q=1`);
    const { fetch, calls } = makeFetch({ methods: { PUT: { status: 200, text: PAGE } } });
    const findings = await withFetch(fetch, () => probeVerbTampering(urls, { allowWrite: true }));
    const putCalls = calls.filter((c) => c.method === 'PUT');
    assert.equal(putCalls.length, 10, 'PUT must go to the first 10 URLs only');
    assert.ok(!putCalls.some((c) => c.url.includes('/p10')), '11th URL must never be probed');
    // One finding per method per URL: 10 URLs x PUT only (DELETE/PATCH 405).
    assert.equal(findings.length, 10);
  });

  it('write verbs go to the final URL after a GET redirect', async () => {
    const { fetch, calls } = makeFetch({
      getUrl: 'http://lab.local/final?id=1',
      methods: { PUT: { status: 200, text: PAGE } },
    });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].url, 'http://lab.local/final?id=1');
    const put = calls.find((c) => c.method === 'PUT');
    assert.ok(put, 'PUT must be sent');
    assert.equal(put.url, 'http://lab.local/final?id=1', 'PUT must target the final URL, not the redirect source');
  });

  it('verifyFindings confirms a verb-tampering finding (signalCorrelated control)', async () => {
    const { fetch } = makeFetch({ methods: { PUT: { status: 200, text: PAGE } } });
    const findings = await withFetch(fetch, () =>
      probeVerbTampering([URL], { allowWrite: true })
    );
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(confirmed[0].confirmation, 'confirmed');
    assert.equal(unconfirmed.length, 0);
  });
});
