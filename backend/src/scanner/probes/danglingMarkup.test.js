// Tests for the dangling markup probe (#52).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeDanglingMarkup } from './danglingMarkup.js';

describe('danglingMarkup probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const name = u.searchParams.get('name') || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      // Vulnerable stub: reflects into single-quoted attr; long attribute
      // name after the value gives D3 a >50-char swallowed span.
      res.end(
        `<html><input value='${name} data-very-long-attribute-name-that-goes-on-and-on='x'></html>`
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects structural attribute swallow (LOW)', async () => {
    const findings = await probeDanglingMarkup(`${base()}/p`, ['name'], { timeoutMs: 8000 });
    assert.ok(Array.isArray(findings));
    const dm = findings.find((f) => f.class === 'danglingMarkup');
    assert.ok(dm, 'expected dangling markup finding on vulnerable stub');
    assert.equal(dm.severity, 'low');
  });

  it('returns [] with no params', async () => {
    const findings = await probeDanglingMarkup(`${base()}/p`, [], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
