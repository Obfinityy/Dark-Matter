/**
 * httpProbes.fixture.test.js
 *
 * Unit-level proof: the 5 built-in HTTP probe tools (no binaries, no LLM)
 * detect the deliberately planted vulnerabilities in the local Express
 * fixture (backend/fixture/vuln-app, 127.0.0.1:4555) over REAL HTTP.
 *
 * Expected (asserted):
 *   web_probe        — 200, discovers the search + login forms
 *   xss_probe        — [high]    reflected XSS in GET /search?q=
 *   sqli_probe       — [critical] SQLi auth bypass in POST /login
 *   stored_xss_probe — [high]    stored XSS via POST /api/comments
 *   idor_probe       — [high]    IDOR on GET /api/users/:id
 *
 * Run: cd backend && node --test tests/httpProbes.fixture.test.js
 * (the fixture is spawned by the test itself on 127.0.0.1:4555)
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ToolRegistry } from '../src/tools/registry.js';
import { HTTP_PROBES, webProbe, xssProbe, sqliProbe, storedXssProbe, idorProbe } from '../src/tools/builtin/httpProbes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ENTRY = path.resolve(__dirname, '../fixture/vuln-app/index.js');
const BASE = 'http://127.0.0.1:4555';

async function waitForFixture(timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) throw new Error('fixture did not become ready in time');
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('built-in HTTP probes against local fixture (127.0.0.1:4555)', () => {
  let fixture;

  before(async () => {
    fixture = spawn(process.execPath, [FIXTURE_ENTRY], {
      env: { ...process.env, PORT: '4555' },
      stdio: 'ignore'
    });
    await waitForFixture();
  });

  after(async () => {
    if (fixture && !fixture.killed) {
      fixture.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      if (!fixture.killed) fixture.kill('SIGKILL');
    }
  });

  it('all 5 probes are registered as built-in tools (no Kali, json parser)', () => {
    for (const name of ['web_probe', 'xss_probe', 'sqli_probe', 'stored_xss_probe', 'idor_probe']) {
      const def = ToolRegistry.get(name);
      assert.ok(def, `${name} registered`);
      assert.equal(def.requiresKali, false, `${name} needs no Kali`);
      assert.equal(def.parser, 'json', `${name} uses the json parser`);
      assert.ok(HTTP_PROBES[name], `${name} has a built-in implementation`);
    }
  });

  it('web_probe fingerprints the target and discovers the attack surface', async () => {
    const r = await webProbe({ baseUrl: BASE });
    assert.equal(r.status, 200);
    assert.ok(r.forms.some((f) => f.action.endsWith('/search') && f.method === 'get'), 'search form found');
    assert.ok(
      r.forms.some((f) => f.action.endsWith('/login') && f.inputs.some((i) => i.type === 'password')),
      'login form with password input found'
    );
    assert.ok(r.endpoints.some((e) => e.includes('/api/users')), 'user api link discovered');
    assert.deepEqual(r.findings, [], 'recon emits no findings');
  });

  it('xss_probe finds reflected XSS in GET /search?q=', async () => {
    const recon = await webProbe({ baseUrl: BASE });
    const r = await xssProbe({ baseUrl: BASE, webProbe: recon });
    assert.equal(r.findings.length, 1, `expected 1 XSS finding, got ${r.findings.length}`);
    const [f] = r.findings;
    assert.equal(f.type, 'reflected-xss');
    assert.equal(f.severity, 'high');
    assert.match(f.title, /\/search/);
    assert.ok(f.evidence.payload.includes('<script>'), 'evidence carries the payload');
    assert.ok(f.evidence.responseSnippet.includes('<script>'), 'evidence shows unescaped reflection');
    assert.ok(f.confidence >= 0.9);
    assert.equal(f.source, 'xss_probe');
  });

  it('sqli_probe finds SQL injection auth bypass in POST /login', async () => {
    const recon = await webProbe({ baseUrl: BASE });
    const r = await sqliProbe({ baseUrl: BASE, webProbe: recon });
    const bypass = r.findings.find((f) => /authentication bypass/.test(f.title));
    assert.ok(bypass, `expected auth-bypass finding, got: ${r.findings.map((f) => f.title).join(' | ')}`);
    assert.equal(bypass.type, 'sql-injection');
    assert.equal(bypass.severity, 'critical');
    assert.ok(bypass.evidence.request.includes(`' OR '1'='1`), 'evidence carries the injection');
  });

  it('stored_xss_probe finds stored XSS via POST /api/comments', async () => {
    const recon = await webProbe({ baseUrl: BASE });
    const r = await storedXssProbe({ baseUrl: BASE, webProbe: recon });
    assert.equal(r.findings.length, 1, `expected 1 stored-XSS finding, got ${r.findings.length}`);
    const [f] = r.findings;
    assert.equal(f.type, 'stored-xss');
    assert.equal(f.severity, 'high');
    assert.ok(f.evidence.responseSnippet.includes('<script>'), 'rendered payload unescaped');
  });

  it('idor_probe finds missing authorization on GET /api/users/:id', async () => {
    const recon = await webProbe({ baseUrl: BASE });
    const r = await idorProbe({ baseUrl: BASE, webProbe: recon });
    assert.equal(r.findings.length, 1, `expected 1 IDOR finding, got ${r.findings.length}`);
    const [f] = r.findings;
    assert.equal(f.type, 'idor');
    assert.equal(f.severity, 'high');
    assert.ok(f.evidence.disclosedFields.includes('password'), 'password disclosed');
    assert.ok(f.evidence.disclosedFields.includes('ssn'), 'ssn disclosed');
  });

  it('probes emit normalized finding shape (findingNormalizer contract)', async () => {
    const recon = await webProbe({ baseUrl: BASE });
    const results = await Promise.all([
      xssProbe({ baseUrl: BASE, webProbe: recon }),
      sqliProbe({ baseUrl: BASE, webProbe: recon }),
      storedXssProbe({ baseUrl: BASE, webProbe: recon }),
      idorProbe({ baseUrl: BASE, webProbe: recon })
    ]);
    for (const r of results) {
      for (const f of r.findings) {
        for (const k of ['type', 'severity', 'url', 'evidence', 'confidence', 'source', 'title']) {
          assert.ok(f[k] !== undefined && f[k] !== null, `finding has ${k}`);
        }
        assert.match(f.severity, /^(info|low|medium|high|critical)$/, 'severity on our scale');
        assert.ok(f.confidence >= 0 && f.confidence <= 1, 'confidence in range');
      }
    }
  });
});
