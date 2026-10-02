/**
 * chainAutonomy.fixture.test.js
 *
 * EXTRA (a)+(d) — deeper brain autonomy + chained fixture vulns, proven
 * against the LOCAL-ONLY fixture on 127.0.0.1:4555 (never external).
 *
 * Fixture (d/e/f) — stored XSS → session theft chain:
 *   1. Stored XSS: POST /api/comments with a marker payload → GET /comments
 *      renders it RAW (unescaped) — the payload persists for every visitor.
 *   2. Session cookie: SQLi POST /login issues a `session` cookie that is
 *      deliberately NOT HttpOnly (documented in the fixture) — i.e. the
 *      exact weakness a stored-XSS payload steals via document.cookie.
 *   3. Theft impact: replaying the stolen cookie against GET /api/me
 *      returns the victim's admin profile — the end-to-end attack path works.
 *   4. Beacon: POST /api/beacon captures the exfiltrated cookie
 *      (proof-only sink), readable via GET /api/beacon.
 *
 * Brain autonomy (a) — a recon finding reshapes the attack plan mid-hunt:
 *   5. Real chainService.suggestChains() over confirmed findings shaped like
 *      the fixture's real detections (xss + auth-bypass-via-sqli + idor)
 *      proposes chains with ESCALATED severity — the attack plan now has a
 *      new, higher-priority objective it did not have before.
 *   6. The REAL AgentWorker.buildLearnedHints() (the exact method stepReason
 *      calls every cycle) injects CHAIN CANDIDATES into the brain prompt when
 *      ≥2 complementary findings exist, and injects nothing with a single
 *      finding — the brain literally reasons over different context.
 *   7. Real chainService.buildBrainChain() trust rules: a brain-proposed
 *      chain over two confirmed same-job findings files with escalated
 *      severity; a fabricated chain (unknown finding id / cross-job)
 *      THROWS — no hallucinated chains.
 *
 * Run: cd backend && node --test tests/chainAutonomy.fixture.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { suggestChains, buildBrainChain } from '../src/services/chainService.js';
import { AgentWorker } from '../src/jobs/agentWorker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ENTRY = path.resolve(__dirname, '../fixture/vuln-app/index.js');
const FIXTURE = 'http://127.0.0.1:4555';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('chained vulns + brain autonomy (local fixture)', () => {
  let fixture;

  before(async () => {
    fixture = spawn(process.execPath, [FIXTURE_ENTRY], {
      env: { ...process.env, PORT: '4555' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const start = Date.now();
    for (;;) {
      try {
        const res = await fetch(`${FIXTURE}/health`);
        if (res.ok) break;
      } catch { /* booting */ }
      if (Date.now() - start > 20000) throw new Error('fixture did not boot');
      await sleep(200);
    }
  });

  after(() => {
    if (fixture && !fixture.killed) fixture.kill('SIGTERM');
  });

  // ── Fixture chain (d/e/f) ──────────────────────────────────────────────

  it('(d) stored XSS: posted payload persists and renders unescaped', async () => {
    // Inert marker payload — proves persistence/reflection, executes nothing.
    const payload = '<b>w3-marker</b><script>/*stored-xss-marker*/</script>';
    const posted = await fetch(`${FIXTURE}/api/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ author: 'attacker', text: payload }),
    });
    assert.equal(posted.status, 201);

    const page = await (await fetch(`${FIXTURE}/comments`)).text();
    assert.ok(page.includes(payload), 'payload rendered RAW into the guestbook page');
    assert.ok(!page.includes('&lt;script&gt;'), 'not HTML-escaped');
  });

  it('(e) SQLi login issues a non-HttpOnly session cookie', async () => {
    const res = await fetch(`${FIXTURE}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `username=${encodeURIComponent("' OR '1'='1")}&password=${encodeURIComponent('anything')}`,
    });
    assert.equal(res.status, 200, 'SQLi bypass logs in');
    const setCookie = res.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('session='), 'session cookie issued');
    assert.ok(!/httponly/i.test(setCookie), 'cookie is readable from JS (theft-enabling, by fixture design)');
    const token = setCookie.split(';')[0].split('=')[1];
    assert.ok(token && token.startsWith('sess-'), 'opaque session token');

    // Chain impact: the stolen cookie authenticates as the victim (admin).
    const me = await fetch(`${FIXTURE}/api/me`, { headers: { cookie: `session=${token}` } });
    assert.equal(me.status, 200, 'stolen session authenticates');
    const profile = await me.json();
    assert.equal(profile.username, 'alice');
    assert.equal(profile.role, 'admin', 'theft yields the admin session');

    const anon = await fetch(`${FIXTURE}/api/me`);
    assert.equal(anon.status, 401, 'no cookie → no access');
  });

  it('(f) beacon sink captures the exfiltrated cookie (proof-only)', async () => {
    const stolen = 'session=sess-9-xyz';
    const sent = await fetch(`${FIXTURE}/api/beacon`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stolen }),
    });
    assert.equal(sent.status, 200);
    const seen = await (await fetch(`${FIXTURE}/api/beacon`)).json();
    assert.ok(seen.beacons.some((b) => b.stolen === stolen), 'exfiltration captured by the sink');
  });

  // ── Brain autonomy (a) ─────────────────────────────────────────────────

  // Findings shaped exactly like the fixture's real detections:
  // reflected-XSS probe, auth-bypass via the SQLi login, IDOR on /api/users/:id.
  function fixtureFindings() {
    const jobId = 'job-chain-1';
    return [
      { id: 'f-xss', jobId, assessmentId: 'a1', category: 'xss', title: 'Reflected XSS in /search', severity: 'medium', status: 'confirmed', target: FIXTURE, endpoint: `${FIXTURE}/search` },
      { id: 'f-auth', jobId, assessmentId: 'a1', category: 'auth-bypass', title: 'Authentication bypass via SQL injection', severity: 'high', status: 'confirmed', target: FIXTURE, endpoint: `${FIXTURE}/login` },
      { id: 'f-idor', jobId, assessmentId: 'a1', category: 'idor', title: 'IDOR exposes user records', severity: 'high', status: 'confirmed', target: FIXTURE, endpoint: `${FIXTURE}/api/users/2` },
    ];
  }

  it('(a) suggestChains turns recon findings into an escalated attack plan', async () => {
    const chains = suggestChains(fixtureFindings(), []);
    assert.ok(chains.length >= 2, `expected chains (got ${chains.length})`);
    // sqli/auth-bypass + idor → complementary; severity escalates one rank.
    const authChain = chains.find((c) => c.metadata.chainOf.includes('f-auth') && c.metadata.chainOf.includes('f-idor'));
    assert.ok(authChain, 'auth-bypass + idor chained');
    assert.equal(authChain.severity, 'critical', 'high+high escalates to critical');
    assert.equal(authChain.category, 'vulnerability-chain');
    assert.ok(authChain.reproductionSteps.length >= 2, 'chain has a real attack path');
    // Already-chained findings are not re-suggested.
    const again = suggestChains(fixtureFindings(), [{ metadata: { chainOf: ['f-auth', 'f-idor'] } }]);
    assert.ok(!again.some((c) => c.metadata.chainOf.includes('f-auth') && c.metadata.chainOf.includes('f-idor')), 'no duplicate chains');
  });

  it('(a) the real worker injects CHAIN CANDIDATES into the brain prompt', async () => {
    const worker = new AgentWorker({
      findingModel: { listByUser: async () => [] },
      logger: { warn: () => {}, info: () => {}, error: () => {} },
    });
    const job = { id: 'job-chain-1', userId: 'u1', target: FIXTURE };

    const withFindings = await worker.buildLearnedHints({
      job, methodologyStage: 'exploitation', findings: fixtureFindings(),
    });
    assert.ok(withFindings.includes('CHAIN CANDIDATES'), 'chain candidates injected into brain context');
    assert.ok(withFindings.includes('CRITICAL'), 'escalated severity visible to the brain');

    const single = await worker.buildLearnedHints({
      job, methodologyStage: 'exploitation', findings: fixtureFindings().slice(0, 1),
    });
    assert.ok(!single.includes('CHAIN CANDIDATES'), 'no chain section with a lone finding — plan unchanged');
  });

  it('(a) buildBrainChain files real chains, rejects fabricated ones', async () => {
    const findings = fixtureFindings();
    const byId = new Map(findings.map((f) => [f.id, f]));

    const chain = buildBrainChain({
      jobId: 'job-chain-1',
      chain: { chainOf: ['f-auth', 'f-idor'], title: 'SQLi auth bypass → IDOR account takeover' },
      findingsById: byId,
    });
    assert.equal(chain.category, 'vulnerability-chain');
    assert.equal(chain.severity, 'critical', 'escalated');
    assert.deepEqual(chain.metadata.chainOf, ['f-auth', 'f-idor']);

    assert.throws(
      () => buildBrainChain({ jobId: 'job-chain-1', chain: { chainOf: ['f-auth', 'f-ghost'] }, findingsById: byId }),
      /unknown finding/,
      'fabricated finding id rejected'
    );
    assert.throws(
      () => buildBrainChain({ jobId: 'job-OTHER', chain: { chainOf: ['f-auth', 'f-idor'] }, findingsById: byId }),
      /another hunt/,
      'cross-job chain rejected'
    );
    const unconfirmed = findings.map((f) => ({ ...f, status: 'needs-review' }));
    assert.throws(
      () => buildBrainChain({ jobId: 'job-chain-1', chain: { chainOf: ['f-auth', 'f-idor'] }, findingsById: new Map(unconfirmed.map((f) => [f.id, f])) }),
      /unconfirmed/,
      'unconfirmed findings cannot anchor a chain'
    );
  });
});
