// Tests for the deserialization probe (#36).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeDeserialization } from './deserialization.js';

describe('deserialization probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      // Sets a PHP-serialized cookie.
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Set-Cookie': 'session=a:2:{s:4:"user";s:5:"admin";s:4:"role";s:4:"user";}; Path=/',
      });
      res.end('<html>ok</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('fingerprints serialized formats passively (INFO)', async () => {
    const findings = await probeDeserialization(base(), { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
    const fmt = findings.find((f) => f.id.startsWith('ds-fmt-'));
    assert.ok(fmt, 'expected format-fingerprint finding');
    assert.equal(fmt.severity, 'low');
  });

  // isLab follow-up (8 Nov 2026): the old local isLab compared the bare
  // hostname against port-bearing labTargets entries, so the T2/T4 lab
  // markers never ran even when runScan passed labTargets.
  it('lab markers run with PORT-BEARING labTargets (the production shape)', async () => {
    const calls = [];
    const origFetch = global.fetch;
    global.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), headers: init.headers || {} });
      return origFetch(url, init);
    };
    try {
      await probeDeserialization(base(), { labTargets: `127.0.0.1:${port}`, timeoutMs: 5000 });
      assert.ok(calls.some((c) => c.url.includes('dsp=')), 'lab mode must send the PHP marker request (T2)');
      // T3 (ungated error oracle) also sends Cookie: dmscan=rO0ABQ== — the
      // lab-gated T4 marker is the longer URL-encoded rO0 canary blob.
      const t4Cookie = (c) => {
        const ck = String((c.headers && (c.headers.Cookie || c.headers.cookie)) || '');
        const m = /dmscan=([^;,\s]+)/.exec(ck);
        return m && m[1] !== 'rO0ABQ==';
      };
      assert.ok(calls.some(t4Cookie), 'lab mode must send the Java marker request (T4)');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('lab markers stay silent off-lab', async () => {
    const calls = [];
    const origFetch = global.fetch;
    global.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), headers: init.headers || {} });
      return origFetch(url, init);
    };
    try {
      const findings = await probeDeserialization(base(), { labTargets: 'lab.local', timeoutMs: 5000 });
      assert.ok(findings.some((f) => f.id.startsWith('ds-fmt-')), 'passive format fingerprint still runs off-lab');
      assert.ok(!calls.some((c) => c.url.includes('dsp=')), 'no PHP marker request off-lab');
      // T3 (ungated error oracle) also sends Cookie: dmscan=rO0ABQ== — only
      // the longer T4 rO0 canary blob proves the lab branch ran.
      const t4Cookie = (c) => {
        const ck = String((c.headers && (c.headers.Cookie || c.headers.cookie)) || '');
        const m = /dmscan=([^;,\s]+)/.exec(ck);
        return m && m[1] !== 'rO0ABQ==';
      };
      assert.ok(!calls.some(t4Cookie), 'no Java marker request off-lab');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('returns array on plain page without serialized data', async () => {
    const findings = await probeDeserialization('http://127.0.0.1:1/', { timeoutMs: 2000 });
    assert.ok(Array.isArray(findings));
  });
});
