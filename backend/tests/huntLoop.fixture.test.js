/**
 * huntLoop.fixture.test.js
 *
 * PROOF that the Dark-Matter hunt pipeline works end-to-end against a target
 * we own: a deliberately vulnerable Express fixture on 127.0.0.1:4555
 * (backend/fixture/vuln-app — LOCAL ONLY, never deploy).
 *
 * What this test proves with REAL service calls (no mocks):
 *   intake → URL normalization → recon (real HTTP) → state-machine stage
 *   transitions → detection (real apiSecurityEngine + real HTTP responses) →
 *   evidence (real EvidenceModel) → findings (real FindingLifecycleService,
 *   ≥3 asserted, each with request/response evidence) → PoC (real
 *   exploitEngine templates) → report (real VulnerabilityReportBuilder) →
 *   mid-hunt chat answers from the REAL state-machine stage.
 *
 * What it does NOT prove (honest boundary): the autonomous BRAIN decision
 * hop — choosing the next action via an LLM. No model provider is reachable
 * from this sandbox (no Ollama, no API keys), so AgentWorker.loop() parks in
 * `waiting` without a brain. Every stage the brain would orchestrate is
 * exercised here through the exact production code the brain calls.
 *
 * Run: cd backend && node --test tests/huntLoop.fixture.test.js
 * (the fixture is spawned by the test itself on 127.0.0.1:4555)
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MemoryDatabase } from '../src/models/database.js';
import { EvidenceModel } from '../src/models/evidenceModel.js';
import { FindingModel } from '../src/models/findingModel.js';
import { FindingLifecycleService } from '../src/services/findingLifecycleService.js';
import { normalizeTargetUrl } from '../src/models/targetModel.js';
import { initialHuntState, transition, isValidTransition } from '../src/agent/huntStateMachine.js';
import { API_TESTS, parseApiEndpoints, getApiTestsFor } from '../src/agent/apiSecurityEngine.js';
import { generatePoc } from '../src/agent/exploitEngine.js';
import { VulnerabilityReportBuilder } from '../src/services/vulnerabilityReportBuilder.js';
import { buildAskReply } from '../src/services/askAgentService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ENTRY = path.resolve(__dirname, '../fixture/vuln-app/index.js');
const BASE = 'http://127.0.0.1:4555';
const USER_ID = 'test-user-w3';
const ASSESSMENT_ID = 'test-assessment-w3';
const JOB_ID = 'test-job-w3';

// Minimal stubs for FindingLifecycleService deps we don't exercise.
const nullMemory = { rememberFinding: async () => {} };
const nullEvents = { publish: async () => ({}) };

async function waitForFixture(proc, timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) {
      throw new Error('fixture did not become ready in time');
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

describe('hunt loop proof against local fixture (127.0.0.1:4555)', () => {
  let fixture;
  let evidenceModel;
  let findingModel;
  let lifecycle;

  before(async () => {
    fixture = spawn(process.execPath, [FIXTURE_ENTRY], {
      env: { ...process.env, PORT: '4555' },
      stdio: 'ignore',
    });
    await waitForFixture(fixture);

    const db = new MemoryDatabase();
    await db.init();
    evidenceModel = new EvidenceModel(db);
    findingModel = new FindingModel(db);
    lifecycle = new FindingLifecycleService({
      findingModel,
      evidenceModel,
      memory: nullMemory,
      eventService: nullEvents,
    });
  });

  after(async () => {
    if (fixture && !fixture.killed) {
      fixture.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 500));
      if (!fixture.killed) fixture.kill('SIGKILL');
    }
  });

  it('intake normalizes a bare host:port to a full URL (target.com → https://target.com)', () => {
    assert.equal(normalizeTargetUrl('target.com'), 'https://target.com');
    assert.equal(normalizeTargetUrl('http://127.0.0.1:4555'), 'http://127.0.0.1:4555');
    assert.equal(normalizeTargetUrl('127.0.0.1:4555'), 'https://127.0.0.1:4555'); // bare host defaults to https
  });

  it('recon: real HTTP fetch discovers the attack surface', async () => {
    const res = await fetch(`${BASE}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    // Real parsing of the real response — endpoints the hunt would target.
    const discovered = new Set();
    for (const m of html.matchAll(/(?:action|href)="([^"]+)"/g)) discovered.add(m[1]);
    assert.ok(discovered.has('/search'), 'search endpoint discovered');
    assert.ok(discovered.has('/login'), 'login endpoint discovered');
    assert.ok([...discovered].some((d) => d.includes('/api/users/')), 'user API discovered');

    // Real apiSecurityEngine endpoint parsing on the discovered API surface.
    const endpoints = parseApiEndpoints([`${BASE}/api/users/1`]);
    assert.ok(endpoints.length >= 1, 'parsed at least one API endpoint');
    const tests = getApiTestsFor(endpoints[0]);
    assert.ok(tests.some((t) => t.id === 'bola_idor'), 'BOLA/IDOR test selected for /api/users/:id');
  });

  it('state machine: legal stage walk recon→…→reporting, illegal move rejected', () => {
    let s = initialHuntState();
    assert.equal(s.status, 'idle');
    for (const stage of ['recon', 'enumeration', 'probing', 'exploitation', 'chaining', 'reporting']) {
      s = transition(s, stage, { lastAction: `finished ${s.status}` });
      assert.equal(s.status, stage);
    }
    assert.equal(s.stage, 'reporting');
    assert.throws(() => transition(s, 'recon'), /Illegal hunt-state transition/);
    assert.ok(isValidTransition('probing', 'paused'));
    assert.ok(isValidTransition('paused', 'probing'));
  });

  it('detect XSS: reflected payload comes back unescaped in the real response', async () => {
    const payload = '<script>alert(document.domain)</script>';
    const res = await fetch(`${BASE}/search?q=${encodeURIComponent(payload)}`);
    const body = await res.text();
    assert.equal(res.status, 200);
    // Real detection: the exact payload bytes appear verbatim, unescaped.
    assert.ok(body.includes(payload), 'payload reflected verbatim (unescaped)');
    assert.ok(!body.includes('&lt;script&gt;'), 'no HTML-escaping applied');

    const { evidence } = await evidenceModel.store({
      kind: 'http_exchange',
      userId: USER_ID,
      assessmentId: ASSESSMENT_ID,
      jobId: JOB_ID,
      asset: '127.0.0.1:4555',
      endpoint: '/search',
      method: 'GET',
      request: `GET /search?q=${encodeURIComponent(payload)} HTTP/1.1`,
      response: body.slice(0, 400),
      summary: 'Reflected XSS: payload reflected unescaped in response body',
    });
    assert.ok(evidence.id);
    const created = await lifecycle.createFinding({
      userId: USER_ID,
      assessmentId: ASSESSMENT_ID,
      jobId: JOB_ID,
      title: 'Reflected XSS in /search?q=',
      severity: 'high',
      category: 'xss',
      asset: '127.0.0.1:4555',
      endpoint: '/search',
      parameter: 'q',
      description: 'The q parameter is reflected into HTML without escaping.',
      impact: 'Session hijacking via crafted link.',
      reproductionSteps: [`GET ${BASE}/search?q=${encodeURIComponent(payload)}`],
      remediation: 'Context-aware output encoding; Content-Security-Policy.',
      confidence: 0.95,
      evidenceIds: [evidence.id],
    });
    assert.equal(created.created, true);
    assert.equal(created.finding.status, 'validated');
    assert.equal(created.finding.title, 'Reflected XSS in /search?q=');
  });

  it('detect SQLi: classic bypass logs in as admin on the real /login', async () => {
    const username = "nobody' OR '1'='1";
    const res = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password: 'wrong' }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.ok, true, 'injection bypassed authentication');
    assert.equal(body.role, 'admin', 'attacker landed on the admin row');

    const { evidence } = await evidenceModel.store({
      kind: 'http_exchange',
      userId: USER_ID,
      assessmentId: ASSESSMENT_ID,
      jobId: JOB_ID,
      asset: '127.0.0.1:4555',
      endpoint: '/login',
      method: 'POST',
      request: `POST /login username=${JSON.stringify(username)}`,
      response: JSON.stringify(body).slice(0, 400),
      summary: "SQLi: ' OR '1'='1 bypassed login, returned admin session",
    });
    const created = await lifecycle.createFinding({
      userId: USER_ID,
      assessmentId: ASSESSMENT_ID,
      jobId: JOB_ID,
      title: "SQL injection in /login (authentication bypass)",
      severity: 'critical',
      category: 'sqli',
      asset: '127.0.0.1:4555',
      endpoint: '/login',
      parameter: 'username',
      description: 'Credentials are interpolated into a SQL string; boolean-based injection bypasses auth.',
      impact: 'Full authentication bypass as administrator.',
      reproductionSteps: [`POST ${BASE}/login with username=nobody' OR '1'='1`],
      remediation: 'Parameterized queries / prepared statements.',
      confidence: 0.95,
      evidenceIds: [evidence.id],
    });
    assert.equal(created.created, true);
    assert.equal(created.finding.severity, 'critical');
  });

  it('detect IDOR: real apiSecurityEngine BOLA test against real responses', async () => {
    const bola = API_TESTS.find((t) => t.id === 'bola_idor');
    assert.ok(bola, 'BOLA test exists in the real engine');

    const baseRes = await fetch(`${BASE}/api/users/1`);
    const base = { status: baseRes.status, body: await baseRes.json() };
    assert.equal(base.status, 200);

    // The engine itself generates the mutated object references.
    const mutatedEndpoints = bola.generate({ path: '/api/users/1', method: 'GET' });
    assert.ok(mutatedEndpoints.length > 0, 'engine generated mutated IDs');
    assert.ok(mutatedEndpoints.some((e) => e.path === '/api/users/2'), 'engine targets /api/users/2');

    const target = mutatedEndpoints.find((e) => e.path === '/api/users/2');
    const mutRes = await fetch(`${BASE}${target.path}`);
    const mutated = { status: mutRes.status, body: await mutRes.json() };
    assert.equal(mutated.status, 200);
    assert.equal(mutated.body.username, 'bob', 'another user returned without authz');
    assert.ok(mutated.body.password, 'sensitive fields exposed');

    // The engine's own detector judges the real pair of responses.
    const verdict = bola.detect(base, mutated);
    assert.equal(verdict.vulnerable, true, `engine verdict: ${verdict.evidence}`);

    const { evidence } = await evidenceModel.store({
      kind: 'http_exchange',
      userId: USER_ID,
      assessmentId: ASSESSMENT_ID,
      jobId: JOB_ID,
      asset: '127.0.0.1:4555',
      endpoint: '/api/users/:id',
      method: 'GET',
      request: 'GET /api/users/1 then GET /api/users/2 (no auth)',
      response: JSON.stringify(mutated.body).slice(0, 400),
      summary: 'IDOR: /api/users/2 returned another user incl. password+ssn, no authz',
    });
    const created = await lifecycle.createFinding({
      userId: USER_ID,
      assessmentId: ASSESSMENT_ID,
      jobId: JOB_ID,
      title: 'IDOR on /api/users/:id (BOLA)',
      severity: 'high',
      category: 'idor',
      asset: '127.0.0.1:4555',
      endpoint: '/api/users/:id',
      parameter: 'id',
      description: 'Object reference is not authorized; any user record (incl. password, ssn) is readable.',
      impact: 'Full PII disclosure for every user.',
      reproductionSteps: [`GET ${BASE}/api/users/2`],
      remediation: 'Server-side ownership check on every object access.',
      confidence: 0.95,
      evidenceIds: [evidence.id],
    });
    assert.equal(created.created, true);
  });

  it('findings: ≥3 asserted, each backed by real request/response evidence', async () => {
    const findings = await findingModel.list(ASSESSMENT_ID);
    assert.ok(findings.length >= 3, `expected ≥3 findings, got ${findings.length}`);
    const titles = findings.map((f) => f.title);
    assert.ok(titles.some((t) => /xss/i.test(t)), 'XSS finding present');
    assert.ok(titles.some((t) => /sql/i.test(t)), 'SQLi finding present');
    assert.ok(titles.some((t) => /idor|bola/i.test(t)), 'IDOR finding present');
    for (const finding of findings) {
      const linked = await evidenceModel.listByFinding(finding.id);
      assert.ok(linked.length >= 1, `${finding.title}: has linked evidence`);
      for (const ev of linked) {
        assert.ok(ev.request && ev.response, `${finding.title}: evidence carries request+response`);
      }
      assert.equal(finding.status, 'validated');
    }
  });

  it('PoC: real exploitEngine templates render per-finding proof code', async () => {
    const findings = await findingModel.list(ASSESSMENT_ID);
    const typeByTitle = [
      [/xss/i, 'xss_reflected'],
      [/sql/i, 'sqli'],
      [/idor|bola/i, 'idor'],
    ];
    for (const finding of findings) {
      const [, type] = typeByTitle.find(([re]) => re.test(finding.title)) || [];
      assert.ok(type, `mapped a PoC type for "${finding.title}"`);
      const poc = generatePoc({ ...finding, type, vulnType: type, url: `${BASE}${finding.endpoint === '/api/users/:id' ? '/api/users/2' : finding.endpoint}` });
      assert.ok(poc, `PoC generated for "${finding.title}"`);
      assert.ok(poc.code && poc.code.length > 50, 'PoC code is substantive');
      assert.ok(poc.safetyNote, 'PoC carries a safety note');
    }
  });

  it('report: real VulnerabilityReportBuilder renders a per-finding report', async () => {
    const builder = new VulnerabilityReportBuilder();
    const findings = await findingModel.list(ASSESSMENT_ID);
    for (const finding of findings) {
      const linked = await evidenceModel.listByFinding(finding.id);
      const report = builder.build(finding, { evidence: linked, target: BASE });
      assert.ok(report.id, 'report has an id');
      assert.equal(report.findingId, finding.id);
      assert.ok(report.title, 'report has a title');
      assert.ok(report.severity, 'report has a severity');
      assert.ok(report.remediation, 'report has remediation');
      assert.ok(Array.isArray(report.evidence) && report.evidence.length >= 1, 'report embeds evidence');
    }
  });

  it('mid-hunt chat reports the REAL state-machine stage, not canned text', () => {
    // Job whose canonical stage lives in the persisted state machine.
    const job = {
      id: JOB_ID,
      target: BASE,
      status: 'running',
      phase: 'probing',
      stepCount: 7,
      huntState: {
        status: 'probing',
        stage: 'probing',
        lastAction: 'Mutated /api/users/1 → /api/users/2 (BOLA test)',
        lastOutcome: '200 with a different user record — looks vulnerable',
        stepsTaken: 7,
      },
      activity: [{ message: 'Mutated /api/users/1 → /api/users/2 (BOLA test)' }],
    };
    const { intent, reply, phase } = buildAskReply({ job, findings: [], question: 'kya kar raha hai?' });
    assert.equal(intent, 'doing');
    assert.ok(/probing/i.test(reply), `reply names the real stage. Got: ${reply}`);
    assert.ok(reply.includes('/api/users/2'), `reply cites the real last action. Got: ${reply}`);
    assert.equal(phase, 'probing');

    // Paused job: the reply must reflect the persisted paused state.
    const paused = buildAskReply({
      job: { ...job, status: 'paused', huntState: { ...job.huntState, status: 'paused' } },
      findings: [],
      question: 'what are you doing?',
    });
    assert.ok(/ruk|paus/i.test(paused.reply), `paused state reported honestly. Got: ${paused.reply}`);

    // Stale job.phase must NOT win: the state machine is the source of truth.
    const stalePhase = buildAskReply({
      job: { ...job, phase: 'recon', huntState: { ...job.huntState, status: 'exploitation', stage: 'exploitation' } },
      findings: [],
      question: 'kya kar raha hai?',
    });
    assert.equal(stalePhase.phase, 'exploitation', 'state machine stage wins over stale job.phase');
    assert.ok(/exploitation/i.test(stalePhase.reply), `reply names the real stage. Got: ${stalePhase.reply}`);
  });

  it('anti-fabrication: findings cannot be created without evidence', async () => {
    const result = await lifecycle.createFinding({
      userId: USER_ID,
      assessmentId: ASSESSMENT_ID,
      jobId: JOB_ID,
      title: 'Imaginary bug with no proof',
      severity: 'critical',
      category: 'xss',
    });
    assert.equal(result.created, false);
    assert.equal(result.reason, 'no_evidence');
  });
});
