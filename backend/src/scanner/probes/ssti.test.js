// Tests for the SSTI probe.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeSsti } from './ssti.js';

describe('ssti probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  // Fresh per-request 32-hex CSRF token, built by concatenation (never a
  // single secret-shaped literal). Models DVWA login.php, which mints a
  // new user_token on every GET.
  let tokenSeq = 0;
  function freshToken(withOracle) {
    tokenSeq += 1;
    const seq = String(tokenSeq).padStart(2, '0');
    return 'd9516f' + seq + (withOracle ? '9352' : '4177') + '3765cd44c03913e4c7c';
  }

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const q = u.searchParams.get('q') || '';
      let out;
      if (u.pathname === '/tpl') {
        // Vulnerable stub: evaluates the template oracle.
        if (q === '{{1336*7}}') out = 'result: 9352';
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/login') {
        // Proof-#18 FP shape (DVWA login.php): every response carries a
        // fresh 32-hex hidden user_token. The PAYLOAD response's token
        // happens to contain 9352; the control's token does not. The page
        // never evaluates templates — any finding here is a false positive.
        // Read the first query value so the stub works for any param name
        // (DVWA's is 'username').
        const v = [...u.searchParams.values()][0] || '';
        const token = freshToken(v === '{{1336*7}}');
        out = `<form><input type="hidden" name="user_token" value="${token}">login</form>`;
      } else if (u.pathname === '/literal-token') {
        // Literal reflection plus a fresh token that never contains 9352.
        const token = freshToken(false);
        out = `<form><input type="hidden" name="user_token" value="${token}">echo: ${q}</form>`;
      } else if (u.pathname === '/fortynine') {
        // Old bare-49 FP shape: renders 49, never 9352.
        if (q === '{{1336*7}}') out = 'result: 49';
        else out = 'result: baseline-ok';
      } else if (u.pathname === '/noisy') {
        // Every response carries 9352 — control gate must silence it.
        out = 'result: 9352 always';
      } else {
        out = `result: ${q}`; // plain reflector
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<html>${out}</html>`);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('fires on evaluated {{1336*7}} with a verbatim window', async () => {
    const findings = await probeSsti(`${base()}/tpl`, ['q'], { timeoutMs: 8000 });
    const f = findings.find((x) => x.class === 'ssti');
    assert.ok(f, 'expected ssti finding on evaluating stub');
    assert.equal(f.severity, 'critical');
    assert.ok(f.evidence.response.includes('9352'), 'evidence must quote the evaluated result verbatim');
  });

  it('stays silent on a bare-49 render (old FP shape)', async () => {
    const findings = await probeSsti(`${base()}/fortynine`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'a 49 render is not a 9352 evaluation');
  });

  it('stays silent when the control already carries 9352', async () => {
    const findings = await probeSsti(`${base()}/noisy`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'oracle present in control must gate the finding');
  });

  it('never fires on mere literal reflection', async () => {
    const findings = await probeSsti(`${base()}/reflect`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'literal {{1336*7}} reflection must not be a finding');
  });

  it('stays silent when 9352 hides inside a fresh hidden token (proof-#18 FP)', async () => {
    // Exact proof-#18 shape: payload token contains 9352, control token
    // does not, page never evaluates. Must be [] — the old code fired a
    // CRITICAL finding here.
    const findings = await probeSsti(`${base()}/login`, ['username'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'a 9352 inside a per-request hidden token is not an evaluation');
  });

  it('fires exactly once on a stable visible evaluation (repeat-confirmed)', async () => {
    const findings = await probeSsti(`${base()}/tpl`, ['q'], { timeoutMs: 8000 });
    assert.equal(findings.length, 1, `expected exactly 1 finding, got ${JSON.stringify(findings.map((x) => x.id))}`);
    assert.equal(findings[0].class, 'ssti');
    assert.equal(findings[0].severity, 'critical');
  });

  it('never fires on literal reflection even with a fresh token present', async () => {
    const findings = await probeSsti(`${base()}/literal-token`, ['q'], { timeoutMs: 8000 });
    assert.deepEqual(findings, [], 'literal reflection plus a clean token must not be a finding');
  });
});
