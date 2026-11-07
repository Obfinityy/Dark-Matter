// Tests for the method-override + Content-Type confusion probe
// (coverage rows #387 + #388).
// Mocked fetch throughout — no network, no lab needed.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeMethodOverride } from './methodOverride.js';
import { verifyFindings } from '../verifier.js';

const PAGE = '<html><body><h1>Welcome</h1></body></html>';
const VERB_PAGE =
  '<html><body><h1>Resource updated successfully</h1><p>The resource was updated and saved to the database.</p></body></html>';
const LOGIN_PAGE = '<html><body><form>login</form></body></html>';
const FORM_OK = '{"status":"ok","user":"dmprobe1_ab12"}';
const RESULTS = '{"results":[1,2,3],"q":"dmprobe"}';
const RESULTS_EMPTY = '{"results":[]}';

// Stub fetch: GET returns the baseline page (or getStatus/getUrl /
// per-URL overrides); HEAD answers 200; direct verbs answer per
// `methods`; override GETs answer per `overrideHeader` (header
// vector) / `overrideParam` (_method vector); POSTs answer per
// content-type in `post`. Tracks every call for gate/cap assertions.
function makeFetch({
  page = PAGE,
  getStatus = 200,
  getUrl = null,
  methods = {},
  headStatus = 200,
  overrideHeader = {},
  overrideParam = {},
  post = {},
  getByUrl = {},
} = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    const headers = init.headers || {};
    calls.push({ url: String(url), method, headers: { ...headers }, body: init.body || null });
    const h = { get: () => '' };
    if (method === 'GET') {
      const u = new URL(String(url));
      const m = u.searchParams.get('_method');
      if (m && overrideParam[m]) {
        const r = overrideParam[m];
        return { status: r.status, text: async () => r.text, url: String(url), headers: h };
      }
      const ov = headers['X-HTTP-Method-Override'];
      if (ov && overrideHeader[ov]) {
        const r = overrideHeader[ov];
        return { status: r.status, text: async () => r.text, url: String(url), headers: h };
      }
      if (getByUrl[String(url)]) {
        const r = getByUrl[String(url)];
        return { status: r.status, text: async () => r.text, url: String(url), headers: h };
      }
      return { status: getStatus, text: async () => page, url: getUrl || String(url), headers: h };
    }
    if (method === 'HEAD') {
      return { status: headStatus, text: async () => '', url: String(url), headers: h };
    }
    if (method === 'POST') {
      const ct = headers['Content-Type'] || '';
      const r = post[ct] || { status: 405, text: 'Method Not Allowed' };
      return { status: r.status, text: async () => r.text, url: String(url), headers: h };
    }
    const r = methods[method] || { status: 405, text: 'Method Not Allowed' };
    return { status: r.status, text: async () => r.text, url: String(url), headers: h };
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

const TARGET_URL = 'http://lab.local/page?id=1';
const FORM = { method: 'post', action: 'http://lab.local/login', inputs: ['username', 'password'] };

describe('methodOverride probe — #387 method override', () => {
  it('override honoured (confusion): override GET matches direct PUT, differs from GET = finding', async () => {
    const { fetch } = makeFetch({
      methods: { PUT: { status: 200, text: VERB_PAGE } },
      overrideHeader: { PUT: { status: 200, text: VERB_PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'method_override');
    assert.equal(f.severity, 'medium');
    assert.ok(f.title.includes('X-HTTP-Method-Override: PUT'));
    assert.ok(f.title.includes('override confusion'));
    assert.ok(f.evidence.response.includes('GET 200'));
    assert.ok(f.evidence.response.includes('direct PUT 200'));
    assert.ok(f.evidence.response.includes('override 200'));
    assert.ok(f.evidence.response.includes('sha256'));
    assert.equal(f.evidence.signalCorrelated, true);
  });

  it('override ignored: override GET returns the GET baseline = no finding', async () => {
    const { fetch } = makeFetch({
      methods: { PUT: { status: 200, text: VERB_PAGE } },
      overrideHeader: { PUT: { status: 200, text: PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    assert.deepEqual(findings, []);
  });

  it('verb behaves like GET (method confusion): override matches GET too = no duplicate finding', async () => {
    const { fetch } = makeFetch({
      methods: { PUT: { status: 200, text: PAGE } },
      overrideHeader: { PUT: { status: 200, text: PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    assert.deepEqual(findings, []);
  });

  it('override bypass: direct PUT 405 but override GET carries a success marker the baseline lacks = finding', async () => {
    const { fetch } = makeFetch({
      methods: { PUT: { status: 405, text: 'Method Not Allowed' } },
      overrideHeader: { PUT: { status: 200, text: '{"success":true,"id":1}' } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    assert.equal(findings.length, 1);
    assert.ok(findings[0].title.includes('override bypass'));
    assert.ok(findings[0].evidence.response.includes('success marker'));
  });

  it('override bypass needs the success marker: direct PUT 405, override 200 with a plain page = no finding', async () => {
    const { fetch } = makeFetch({
      methods: { PUT: { status: 405, text: 'Method Not Allowed' } },
      overrideHeader: { PUT: { status: 200, text: VERB_PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    assert.deepEqual(findings, []);
  });

  it('override 405 / 302 = no finding', async () => {
    const { fetch } = makeFetch({
      overrideHeader: {
        PUT: { status: 405, text: 'Method Not Allowed' },
        DELETE: { status: 302, text: '' },
        PATCH: { status: 501, text: 'Not Implemented' },
      },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    assert.deepEqual(findings, []);
  });

  it('_method query-param vector honoured = finding', async () => {
    const { fetch } = makeFetch({
      methods: { DELETE: { status: 200, text: VERB_PAGE } },
      overrideParam: { DELETE: { status: 200, text: VERB_PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'method_override');
    assert.ok(findings[0].parameter.includes('_method=DELETE'));
  });

  it('both vectors fire for the same method = exactly one finding (first vector wins)', async () => {
    const { fetch, calls } = makeFetch({
      methods: { PUT: { status: 200, text: VERB_PAGE } },
      overrideHeader: { PUT: { status: 200, text: VERB_PAGE } },
      overrideParam: { PUT: { status: 200, text: VERB_PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    assert.equal(findings.length, 1);
    assert.ok(findings[0].parameter.includes('X-HTTP-Method-Override'));
    // The _method GET must never be sent once the header vector fired.
    assert.ok(!calls.some((c) => c.url.includes('_method=PUT')), '_method request must be skipped after a header hit');
  });

  it('gate: non-lab host (no allowWrite) sends nothing at all', async () => {
    const { fetch, calls } = makeFetch({
      methods: { PUT: { status: 200, text: VERB_PAGE } },
      overrideHeader: { PUT: { status: 200, text: VERB_PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], []));
    assert.deepEqual(findings, []);
    assert.equal(calls.length, 0, 'no request may leave without the lab gate');
  });

  it('GET baseline non-2xx = no finding and no write verb is sent', async () => {
    const { fetch, calls } = makeFetch({
      getStatus: 404,
      methods: { PUT: { status: 200, text: VERB_PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    assert.deepEqual(findings, []);
    assert.ok(!calls.some((c) => ['PUT', 'DELETE', 'PATCH'].includes(c.method)));
  });

  it('caps at the first 10 endpoint URLs', async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `http://lab.local/p${i}?q=1`);
    const { fetch, calls } = makeFetch({
      methods: { PUT: { status: 200, text: VERB_PAGE } },
      overrideHeader: { PUT: { status: 200, text: VERB_PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride(urls, [], { allowWrite: true }));
    const putCalls = calls.filter((c) => c.method === 'PUT');
    assert.equal(putCalls.length, 10, 'PUT must go to the first 10 URLs only');
    assert.ok(!putCalls.some((c) => c.url.includes('/p10')), '11th URL must never be probed');
    assert.equal(findings.length, 10);
  });

  it('verifyFindings confirms a method-override finding (signalCorrelated control)', async () => {
    const { fetch } = makeFetch({
      methods: { PUT: { status: 200, text: VERB_PAGE } },
      overrideHeader: { PUT: { status: 200, text: VERB_PAGE } },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([TARGET_URL], [], { allowWrite: true }));
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(confirmed[0].confirmation, 'confirmed');
    assert.equal(unconfirmed.length, 0);
  });
});

describe('methodOverride probe — #388 Content-Type confusion', () => {
  it('form vector: JSON POST processed like the native form POST = finding', async () => {
    const { fetch } = makeFetch({
      getByUrl: { 'http://lab.local/login': { status: 200, text: LOGIN_PAGE } },
      post: {
        'application/x-www-form-urlencoded': { status: 200, text: FORM_OK },
        'application/json': { status: 200, text: FORM_OK },
      },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([], [FORM], { allowWrite: true }));
    assert.equal(findings.length, 1);
    const f = findings[0];
    assert.equal(f.class, 'content_type_confusion');
    assert.equal(f.severity, 'medium');
    assert.ok(f.title.includes('JSON body processed like a form POST'));
    assert.ok(f.evidence.response.includes('JSON-vs-form similarity 1.00'));
    assert.equal(f.evidence.signalCorrelated, true);
  });

  it('form vector FP guard: form POST returns the same page as a plain GET = no finding', async () => {
    const { fetch } = makeFetch({
      getByUrl: { 'http://lab.local/login': { status: 200, text: LOGIN_PAGE } },
      post: {
        'application/x-www-form-urlencoded': { status: 200, text: LOGIN_PAGE },
        'application/json': { status: 200, text: LOGIN_PAGE },
      },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([], [FORM], { allowWrite: true }));
    assert.deepEqual(findings, []);
  });

  it('form vector: JSON ignored (JSON POST returns the plain-GET page) = no finding', async () => {
    const { fetch } = makeFetch({
      getByUrl: { 'http://lab.local/login': { status: 200, text: LOGIN_PAGE } },
      post: {
        'application/x-www-form-urlencoded': { status: 200, text: FORM_OK },
        'application/json': { status: 200, text: LOGIN_PAGE },
      },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([], [FORM], { allowWrite: true }));
    assert.deepEqual(findings, []);
  });

  it('GET-endpoint vector: POST JSON + POST form both processed like the query params = two findings', async () => {
    const searchUrl = 'http://lab.local/search?q=dmprobe';
    const { fetch } = makeFetch({
      getByUrl: {
        [searchUrl]: { status: 200, text: RESULTS },
        'http://lab.local/search': { status: 200, text: RESULTS_EMPTY },
      },
      post: {
        'application/json': { status: 200, text: RESULTS },
        'application/x-www-form-urlencoded': { status: 200, text: RESULTS },
      },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([searchUrl], [], { allowWrite: true }));
    assert.equal(findings.length, 2);
    assert.ok(findings.every((f) => f.class === 'content_type_confusion'));
    assert.ok(findings.some((f) => f.parameter === 'application/json'));
    assert.ok(findings.some((f) => f.parameter === 'application/x-www-form-urlencoded'));
  });

  it('GET-endpoint FP guard: query params unobservable (GET with params = plain GET) = no finding', async () => {
    const searchUrl = 'http://lab.local/search?q=dmprobe';
    const { fetch } = makeFetch({
      getByUrl: {
        [searchUrl]: { status: 200, text: RESULTS },
        'http://lab.local/search': { status: 200, text: RESULTS },
      },
      post: {
        'application/json': { status: 200, text: RESULTS },
        'application/x-www-form-urlencoded': { status: 200, text: RESULTS },
      },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([searchUrl], [], { allowWrite: true }));
    assert.deepEqual(findings, []);
  });

  it('GET-endpoint vector: POST returns 500 = no finding', async () => {
    const searchUrl = 'http://lab.local/search?q=dmprobe';
    const { fetch } = makeFetch({
      getByUrl: {
        [searchUrl]: { status: 200, text: RESULTS },
        'http://lab.local/search': { status: 200, text: RESULTS_EMPTY },
      },
      post: {
        'application/json': { status: 500, text: 'Internal Server Error' },
        'application/x-www-form-urlencoded': { status: 500, text: 'Internal Server Error' },
      },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([searchUrl], [], { allowWrite: true }));
    assert.deepEqual(findings, []);
  });

  it('GET-endpoint vector: target with no query params sends no POST at all', async () => {
    const { fetch, calls } = makeFetch({});
    const findings = await withFetch(fetch, () =>
      probeMethodOverride(['http://lab.local/page'], [], { allowWrite: true })
    );
    assert.deepEqual(findings, []);
    assert.ok(!calls.some((c) => c.method === 'POST'), 'no POST may target a param-less URL');
  });

  it('verifyFindings confirms a content-type confusion finding (signalCorrelated control)', async () => {
    const { fetch } = makeFetch({
      getByUrl: { 'http://lab.local/login': { status: 200, text: LOGIN_PAGE } },
      post: {
        'application/x-www-form-urlencoded': { status: 200, text: FORM_OK },
        'application/json': { status: 200, text: FORM_OK },
      },
    });
    const findings = await withFetch(fetch, () => probeMethodOverride([], [FORM], { allowWrite: true }));
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(confirmed[0].confirmation, 'confirmed');
    assert.equal(unconfirmed.length, 0);
  });
});
