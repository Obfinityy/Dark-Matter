// Tests for the RFI probe (#46).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeRfi } from './rfi.js';

describe('rfi probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer(async (req, res) => {
      const u = new URL(req.url, base());
      const page = u.searchParams.get('page') || '';
      // Vulnerable stub: "fetches" the canary URL and reflects its content.
      // (Simulates the server-side fetch; the canary RID is extracted from
      // the URL path.)
      const ridM = page.match(/\/dm_rfi_([A-Za-z0-9]+)\.txt/);
      if (ridM) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html>included: DM_RFI_CANARY_${ridM[1]}</html>`);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>home</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('confirms remote fetch via canary reflection', async () => {
    const findings = await probeRfi(`${base()}/index`, ['page'], {
      timeoutMs: 15000,
    });
    assert.ok(Array.isArray(findings));
    const rfi = findings.find((f) => f.class === 'rfi');
    assert.ok(rfi, 'expected RFI finding on fetching stub');
    assert.equal(rfi.severity, 'high');
  }, { timeout: 60000 });

  // isLab follow-up (8 Nov 2026): D5 wrapper variants are lab-first, but
  // the old local isLab never saw labTargets (no call-site pass) and never
  // matched port-bearing entries — D5 could never run in production.
  const dec = (s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  };

  it('D5 wrapper variants run in lab mode with PORT-BEARING labTargets', async () => {
    const calls = [];
    const origFetch = global.fetch;
    global.fetch = async (url) => {
      calls.push(dec(String(url)));
      return { ok: true, status: 200, text: async () => '<html>home</html>' };
    };
    try {
      const findings = await probeRfi(`${base()}/index`, ['page'], {
        labTargets: `127.0.0.1:${port}`,
        timeoutMs: 15000,
      });
      assert.deepEqual(findings, [], 'plain stub confirms nothing — the gate test asserts requests, not findings');
      assert.ok(calls.some((u) => u.includes('data://text/plain')), 'lab mode must try the data:// wrapper');
      assert.ok(calls.some((u) => u.includes('php://filter')), 'lab mode must try the php://filter wrapper');
    } finally {
      global.fetch = origFetch;
    }
  }, { timeout: 30000 });

  it('D5 wrapper variants stay silent off-lab', async () => {
    const calls = [];
    const origFetch = global.fetch;
    global.fetch = async (url) => {
      calls.push(dec(String(url)));
      return { ok: true, status: 200, text: async () => '<html>home</html>' };
    };
    try {
      const findings = await probeRfi(`${base()}/index`, ['page'], {
        labTargets: 'lab.local',
        timeoutMs: 15000,
      });
      assert.deepEqual(findings, []);
      assert.ok(!calls.some((u) => u.includes('data://text/plain')), 'no data:// wrapper off-lab');
      assert.ok(!calls.some((u) => u.includes('php://filter')), 'no php://filter wrapper off-lab');
    } finally {
      global.fetch = origFetch;
    }
  }, { timeout: 30000 });

  it('exits clean with no include-smell params', async () => {
    const findings = await probeRfi(`${base()}/index`, ['q'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
