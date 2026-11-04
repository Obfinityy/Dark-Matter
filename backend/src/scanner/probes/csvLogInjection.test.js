// Tests for the CSV/log injection probe (#42).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeCsvLog } from './csvLogInjection.js';

describe('csvLog probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      if (u.pathname === '/export') {
        const name = u.searchParams.get('name') || '';
        res.writeHead(200, {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="users.csv"',
        });
        // Vulnerable stub: formula lands verbatim at cell start.
        res.end(`id,name\n1,${name}\n`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><a href="/export">Export CSV</a></html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects verbatim formula cell in CSV export', async () => {
    const findings = await probeCsvLog(base(), ['name'], { timeoutMs: 8000 });
    assert.ok(Array.isArray(findings));
    const formula = findings.find((f) => f.class === 'csv_injection');
    assert.ok(formula, 'expected CSV formula finding on vulnerable stub');
    assert.equal(formula.severity, 'high');
  });

  it('exits INFO-clean with no export surface', async () => {
    const findings = await probeCsvLog('http://127.0.0.1:1/', ['q'], { timeoutMs: 3000 });
    assert.ok(Array.isArray(findings));
  });
});
