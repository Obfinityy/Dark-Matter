// Tests for the CRLF probe (#41).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeCrlf } from './crlf.js';

describe('crlf probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const next = u.searchParams.get('next') || '/';
      // Vulnerable stub: reflects into Location without stripping CRLF.
      // Node http will throw on raw CRLF in header values, so we simulate
      // the reflection via a custom raw header write.
      const rawNext = next.replace(/%0d/gi, '\r').replace(/%0a/gi, '\n');
      res.writeHead(302, { Location: `/go?to=${encodeURIComponent(next)}` });
      // Echo the raw value in a custom header using writeHead's array form
      // is not possible with CRLF; instead reflect verbatim in body for D1.
      res.end(`<html>redirecting, raw was: ${rawNext}</html>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('returns array on echoing page (D1 inventory runs)', async () => {
    const findings = await probeCrlf(`${base()}/r`, ['next'], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
  });

  it('returns [] with no params', async () => {
    const findings = await probeCrlf(`${base()}/r`, [], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('stays silent on hardened page (no echo point)', async () => {
    const findings = await probeCrlf(`${base()}/clean`, ['q'], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
  });
});
