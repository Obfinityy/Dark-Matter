// Tests for the file-upload probe (P1 #4).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeFileUpload, EICAR_TEST_STRING } from './fileUpload.js';

const PAGE = (forms) => `<html><body>${forms}</body></html>`;
const FORM = (action, name = 'file') =>
  `<form action="${action}" method="post" enctype="multipart/form-data"><input type="file" name="${name}"><input type="submit"></form>`;

// Stub fetch: GET returns the page (or onGetExtra), POST answers per the
// uploaded filename. Tracks every call for gate/cap assertions.
// onGetExtra may return a string (body, no content-type) or
// { text, contentType, status } — the probe's fetch-back legs read the
// served content-type, so the stub must model headers.
function makeFetch({ page, onUpload, onGetExtra }) {
  const calls = [];
  const noHeaders = { get: () => null };
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push({ url: String(url), method });
    if (method === 'GET') {
      if (onGetExtra) {
        const extra = onGetExtra(String(url));
        if (extra !== null && extra !== undefined) {
          if (typeof extra === 'string') {
            return { ok: true, status: 200, headers: noHeaders, text: async () => extra };
          }
          const ct = extra.contentType || null;
          return {
            ok: true,
            status: extra.status || 200,
            headers: { get: (n) => (String(n).toLowerCase() === 'content-type' ? ct : null) },
            text: async () => extra.text,
          };
        }
      }
      return { ok: true, status: 200, headers: noHeaders, text: async () => page };
    }
    const fd = init.body;
    let filename = '';
    let content = '';
    let partType = '';
    for (const [k, v] of fd.entries()) {
      if (v && typeof v.name === 'string') { filename = v.name; partType = v.type || ''; content = await v.text(); }
    }
    const r = onUpload(filename, content, String(url), partType);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.text };
  };
  return { fetch, calls };
}

describe('fileUpload probe', () => {
  it('gate: no allowWrite means no requests at all', async () => {
    const { fetch, calls } = makeFetch({
      page: PAGE([FORM('/upload')]),
      onUpload: () => ({ status: 200, text: 'ok' }),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      assert.deepEqual(await probeFileUpload('http://lab.local/page', {}), []);
      assert.equal(calls.length, 0, 'fetch must never be called without allowWrite');
    } finally { global.fetch = orig; }
  });

  it('returns [] when the page has no file form', async () => {
    const { fetch } = makeFetch({
      page: '<html><body><form action="/x"><input type="text" name="q"></form></body></html>',
      onUpload: () => ({ status: 200, text: 'ok' }),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      assert.deepEqual(await probeFileUpload('http://lab.local/page', { allowWrite: true }), []);
    } finally { global.fetch = orig; }
  });

  it('benign-only: .txt stored + .phtml rejected => MEDIUM', async () => {
    const { fetch } = makeFetch({
      page: PAGE([FORM('/upload')]),
      // Variant-selective mock: this server accepts ONLY the benign .txt —
      // every dangerous variant is rejected, so no new leg may confirm.
      onUpload: (filename, content) => {
        if (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) return { status: 200, text: `stored ${filename} with ${content}` };
        return { status: 403, text: 'not allowed: extension blocked' };
      },
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'medium');
      assert.ok(findings[0].title.includes('no extension validation observed'));
      assert.ok(findings[0].evidence.request.includes('.txt'));
      assert.ok(findings[0].evidence.response.includes('dmprobe_'), 'evidence must quote the echoed filename verbatim');
    } finally { global.fetch = orig; }
  });

  it('evil positive: .phtml accepted => HIGH', async () => {
    const { fetch } = makeFetch({
      page: PAGE([FORM('/upload')]),
      // Variant-selective mock: accepts .txt + .phtml only — the other legs
      // are rejected, so the finding must stay the .phtml one.
      onUpload: (filename, content) => {
        if ((filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.phtml')) {
          return { status: 200, text: `stored ${filename} with ${content}` };
        }
        return { status: 403, text: 'not allowed' };
      },
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.ok(findings[0].title.includes('accepts executable extension'));
      assert.ok(findings[0].evidence.response.includes('.phtml'));
    } finally { global.fetch = orig; }
  });

  it('FP guard: bare success word with no echo stays silent', async () => {
    const { fetch } = makeFetch({
      page: PAGE([FORM('/upload')]),
      onUpload: () => ({ status: 200, text: 'Your profile was updated successfully' }),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      assert.deepEqual(await probeFileUpload('http://lab.local/page', { allowWrite: true }), []);
    } finally { global.fetch = orig; }
  });

  it('tolerates upload failures', async () => {
    const orig = global.fetch;
    global.fetch = async (url, init = {}) => {
      if ((init.method || 'GET') === 'GET') return { ok: true, status: 200, text: async () => PAGE([FORM('/upload')]) };
      throw new Error('boom');
    };
    try {
      assert.deepEqual(await probeFileUpload('http://lab.local/page', { allowWrite: true }), []);
    } finally { global.fetch = orig; }
  });

  it('probes at most the first 2 forms', async () => {
    const actions = [];
    const { fetch } = makeFetch({
      page: PAGE([FORM('/up1'), FORM('/up2'), FORM('/up3')]),
      onUpload: (filename, content, url) => {
        actions.push(url);
        return { status: 200, text: `stored ${filename}` };
      },
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.deepEqual([...new Set(actions)], ['http://lab.local/up1', 'http://lab.local/up2']);
      assert.equal(findings.length, 2);
    } finally { global.fetch = orig; }
  });

  it('fetch-back: disclosed upload URL serving the marker is quoted', async () => {
    let lastMarker = '';
    const { fetch } = makeFetch({
      page: PAGE([FORM('/upload')]),
      // Variant-selective mock: accepts .txt + .phtml only, discloses the
      // .phtml URL, and serves the marker back with no content-type (the
      // SVG/HTML legs require a scriptable content-type, so they stay out).
      onUpload: (filename, content) => {
        if (!filename.endsWith('.txt') && !filename.endsWith('.phtml')) {
          return { status: 403, text: 'not allowed' };
        }
        lastMarker = content;
        return { status: 200, text: `stored <a href="/uploads/${filename}">download</a>` };
      },
      onGetExtra: (url) => (url.includes('/uploads/') ? lastMarker : null),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.ok(findings[0].evidence.response.includes('serves it back'), 'fetch-back confirmation must be in evidence');
      assert.ok(findings[0].evidence.response.includes('dm-upload-marker-'));
    } finally { global.fetch = orig; }
  });

  // ---- Six missing legs (coverage re-proof batch 2: #120, #144, #145,
  // #147, #149, #151) — written FIRST, failing until the probe grows them.

  // Stateful store mock for the new legs: uploads are stored by filename;
  // GET /uploads/<name> serves the stored content with an extension-derived
  // content-type (overridable via serveAs). accept(filename, content, type)
  // decides 403 vs 200. GET falls back to a stored key with the requested
  // name as a prefix ONLY when truncating:true — modelling a server that
  // truncates the stored name (null-byte / double-extension: file.php.txt
  // retrievable as file.php). A non-truncating server must 404 the .php
  // path, or the double-extension leg would confirm against every
  // .txt-accepting mock.
  function contentTypeFor(name) {
    if (name.endsWith('.svg')) return 'image/svg+xml';
    if (name.endsWith('.html')) return 'text/html';
    if (name.endsWith('.xml')) return 'application/xml';
    if (name.endsWith('.zip')) return 'application/zip';
    if (name.endsWith('.php')) return 'application/x-httpd-php';
    return 'text/plain';
  }
  function makeStoreFetch({ page, accept, serveAs, keepFirst = false, truncating = false }) {
    const store = new Map();
    const calls = [];
    const fetch = async (url, init = {}) => {
      const method = init.method || 'GET';
      calls.push({ url: String(url), method });
      if (method === 'GET') {
        const u = String(url);
        if (u.includes('/uploads/')) {
          const name = decodeURIComponent(u.slice(u.lastIndexOf('/') + 1));
          let rec = store.get(name);
          if (!rec && truncating) {
            for (const [k, v] of store) { if (k.startsWith(name)) { rec = v; break; } }
          }
          if (!rec) return { ok: false, status: 404, headers: { get: () => null }, text: async () => 'not found' };
          const ct = (serveAs && serveAs(name)) || contentTypeFor(name);
          return { ok: true, status: 200, headers: { get: (n) => (String(n).toLowerCase() === 'content-type' ? ct : null) }, text: async () => rec.content };
        }
        return { ok: true, status: 200, headers: { get: () => null }, text: async () => page };
      }
      const fd = init.body;
      let filename = ''; let content = ''; let partType = '';
      for (const [k, v] of fd.entries()) {
        if (v && typeof v.name === 'string') { filename = v.name; partType = v.type || ''; content = await v.text(); }
      }
      if (!accept(filename, content, partType)) {
        return { ok: false, status: 403, text: async () => 'not allowed' };
      }
      if (!(keepFirst && store.has(filename))) store.set(filename, { content, partType });
      return { ok: true, status: 200, text: async () => `stored <a href="/uploads/${filename}">download</a>` };
    };
    return { fetch, calls, store };
  }
  const variantsOf = (f) => (f.evidence && Array.isArray(f.evidence.variants) ? f.evidence.variants : []);

  it('#120 SVG positive: .svg served as image/svg+xml with marker => HIGH stored-XSS finding', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.svg'),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.ok(findings[0].title.includes('SVG'), `title must name SVG, got: ${findings[0].title}`);
      assert.ok(variantsOf(findings[0]).includes('svg'));
    } finally { global.fetch = orig; }
  });

  it('#120 SVG negative: .svg served as text/plain is NOT scriptable => no svg variant', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.svg'),
      serveAs: () => 'text/plain',
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'medium');
      assert.ok(findings[0].title.includes('no extension validation observed'));
      assert.deepEqual(variantsOf(findings[0]), []);
    } finally { global.fetch = orig; }
  });

  it('#120 HTML positive: .html served as text/html with marker => HIGH stored-XSS finding', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.html'),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.ok(findings[0].title.includes('HTML'), `title must name HTML, got: ${findings[0].title}`);
      assert.ok(variantsOf(findings[0]).includes('html'));
    } finally { global.fetch = orig; }
  });

  it('#144 double-extension positive: .php.txt served back as PHP => HIGH bypass finding', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.php.txt'),
      serveAs: (name) => (name.endsWith('.php.txt') ? 'application/x-httpd-php' : contentTypeFor(name)),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.ok(findings[0].title.toLowerCase().includes('double extension'), `title must name double extension, got: ${findings[0].title}`);
      assert.ok(variantsOf(findings[0]).includes('double-ext'));
    } finally { global.fetch = orig; }
  });

  it('#144 double-extension via .php path: .php.txt served as text/plain but retrievable as .php => HIGH', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      truncating: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.php.txt'),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.ok(variantsOf(findings[0]).includes('double-ext'));
    } finally { global.fetch = orig; }
  });

  it('#144 null-byte positive: server truncates .php%00.txt to .php => HIGH bypass finding', async () => {
    const { fetch, store } = makeStoreFetch({
      keepFirst: true,
      truncating: true,
      page: PAGE([FORM('/upload')]),
      // The server truncates at the null byte: it stores under the .php
      // name and echoes the truncated name in the upload response.
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.includes('%00'),
    });
    const orig = global.fetch;
    // Wrap the store fetch: rewrite the POST response for the %00 file so
    // it echoes the truncated .php name, like a truncating server would.
    global.fetch = async (url, init = {}) => {
      const res = await fetch(url, init);
      if ((init.method || 'GET') === 'POST') {
        const fd = init.body;
        let filename = '';
        for (const [k, v] of fd.entries()) {
          if (v && typeof v.name === 'string') filename = v.name;
        }
        if (filename.includes('%00')) {
          // Truncation: strip from the null byte onward — dmprobe_x.php%00.txt
          // becomes dmprobe_x.php (no extra suffix appended).
          const truncated = filename.split('%00')[0];
          return { ok: true, status: 200, text: async () => `stored <a href="/uploads/${truncated}">download</a>` };
        }
      }
      return res;
    };
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.ok(variantsOf(findings[0]).includes('null-byte'));
      assert.ok(store.size >= 1, 'the null-byte file must have been uploaded');
    } finally { global.fetch = orig; }
  });

  it('#145 overwrite positive: second upload under the same name replaces the first => HIGH finding', async () => {
    const { fetch } = makeStoreFetch({
      page: PAGE([FORM('/upload')]),
      accept: (filename) => filename.endsWith('.txt') && !filename.endsWith('-eicar.txt'),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.ok(findings[0].title.toLowerCase().includes('overwrite'), `title must name overwrite, got: ${findings[0].title}`);
      assert.ok(variantsOf(findings[0]).includes('overwrite'));
    } finally { global.fetch = orig; }
  });

  it('#145 overwrite negative: server keeps the first file (no replacement) => no overwrite variant', async () => {
    const { fetch } = makeStoreFetch({
      page: PAGE([FORM('/upload')]),
      accept: (filename) => filename.endsWith('.txt') && !filename.endsWith('-eicar.txt'),
      keepFirst: true,
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'medium');
      assert.ok(!variantsOf(findings[0]).includes('overwrite'));
    } finally { global.fetch = orig; }
  });

  it('#147 EICAR positive: EICAR test file accepted AND served back => MEDIUM no-scanning finding', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename, content) => filename.endsWith('.txt') && (content.includes('dm-upload-marker-') || content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'medium');
      assert.ok(findings[0].title.includes('EICAR'), `title must name EICAR, got: ${findings[0].title}`);
      assert.ok(variantsOf(findings[0]).includes('eicar'));
    } finally { global.fetch = orig; }
  });

  it('#147 EICAR negative: scanner blocks the EICAR file => no eicar variant', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename, content) => filename.endsWith('.txt') && !content.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'medium');
      assert.ok(!variantsOf(findings[0]).includes('eicar'));
      assert.ok(findings[0].title.includes('no extension validation observed'));
    } finally { global.fetch = orig; }
  });

  it('#151 zip positive: nested zip accepted => MEDIUM zip-bomb finding quoting the ratio', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.zip'),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'medium');
      assert.ok(findings[0].title.toLowerCase().includes('zip'), `title must name zip, got: ${findings[0].title}`);
      assert.ok(variantsOf(findings[0]).includes('zip'));
      assert.match(findings[0].evidence.response, /decompressed|ratio/i, 'evidence must quote the decompressed size/ratio');
    } finally { global.fetch = orig; }
  });

  it('#149 XML-XXE positive: OOB callback hit for the uploaded XML => HIGH finding', async () => {
    let seenToken = '';
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.xml'),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', {
        allowWrite: true,
        oobCallback: 'http://oob.test',
        oobWaitFor: async (token) => {
          seenToken = token;
          return { method: 'GET', path: `/${token}`, at: '2026-11-14T00:00:00Z' };
        },
      });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'high');
      assert.ok(findings[0].title.includes('XXE'), `title must name XXE, got: ${findings[0].title}`);
      assert.ok(variantsOf(findings[0]).includes('xml-xxe'));
      assert.ok(seenToken.startsWith('upload-xxe-oob-'), `waiter must get the probe token, got: ${seenToken}`);
    } finally { global.fetch = orig; }
  });

  it('#149 XML-XXE negative: no OOB callback hit => no xml-xxe variant', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.xml'),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', {
        allowWrite: true,
        oobCallback: 'http://oob.test',
        oobWaitFor: async () => null,
      });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].severity, 'medium');
      assert.ok(!variantsOf(findings[0]).includes('xml-xxe'));
    } finally { global.fetch = orig; }
  });

  it('#149 XML-XXE skipped without an OOB callback base: no xml variant, no crash', async () => {
    const { fetch } = makeStoreFetch({
      keepFirst: true,
      page: PAGE([FORM('/upload')]),
      accept: (filename) => (filename.endsWith('.txt') && !filename.endsWith('-eicar.txt')) || filename.endsWith('.xml'),
    });
    const orig = global.fetch;
    global.fetch = fetch;
    try {
      const findings = await probeFileUpload('http://lab.local/page', { allowWrite: true });
      assert.equal(findings.length, 1);
      assert.ok(!variantsOf(findings[0]).includes('xml-xxe'));
    } finally { global.fetch = orig; }
  });
});
