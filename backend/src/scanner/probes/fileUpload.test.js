// Tests for the file-upload probe (P1 #4).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeFileUpload } from './fileUpload.js';

const PAGE = (forms) => `<html><body>${forms}</body></html>`;
const FORM = (action, name = 'file') =>
  `<form action="${action}" method="post" enctype="multipart/form-data"><input type="file" name="${name}"><input type="submit"></form>`;

// Stub fetch: GET returns the page (or onGetExtra), POST answers per the
// uploaded filename. Tracks every call for gate/cap assertions.
function makeFetch({ page, onUpload, onGetExtra }) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    calls.push({ url: String(url), method });
    if (method === 'GET') {
      if (onGetExtra) {
        const extra = onGetExtra(String(url));
        if (extra !== null && extra !== undefined) return { ok: true, status: 200, text: async () => extra };
      }
      return { ok: true, status: 200, text: async () => page };
    }
    const fd = init.body;
    let filename = '';
    let content = '';
    for (const [k, v] of fd.entries()) {
      if (v && typeof v.name === 'string') { filename = v.name; content = await v.text(); }
    }
    const r = onUpload(filename, content, String(url));
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
      onUpload: (filename, content) => {
        if (filename.endsWith('.phtml')) return { status: 200, text: 'not allowed: extension blocked' };
        return { status: 200, text: `stored ${filename} with ${content}` };
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
      onUpload: (filename, content) => ({ status: 200, text: `stored ${filename} with ${content}` }),
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
      onUpload: (filename, content) => {
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
});
