/**
 * Tests for the mass assignment tester engine.
 * All network I/O goes through mock httpClient functions — no real requests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MASS_ASSIGNMENT_PAYLOADS,
  WRITE_METHODS,
  buildMassAssignmentProbes,
  checkFieldAccepted,
  analyzeMassAssignment,
  testMassAssignment,
} from '../src/engines/massAssignmentTester.js';

/** Mock: vulnerable server — echoes the full request body back under `user`. */
const echoClient = async (req) => ({
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: { user: { name: 'tester', ...(typeof req.body === 'object' ? req.body : {}) } },
});

/** Mock: hardened server — strips every privileged field, echoes the rest. */
const stripClient = async (req) => {
  const body = typeof req.body === 'object' && req.body ? { ...req.body } : {};
  for (const p of MASS_ASSIGNMENT_PAYLOADS) delete body[p.field];
  return { status: 200, body: { user: body } };
};

describe('MASS_ASSIGNMENT_PAYLOADS', () => {
  it('covers the classic privileged fields', () => {
    const fields = MASS_ASSIGNMENT_PAYLOADS.map((p) => p.field);
    for (const f of ['role', 'isAdmin', 'is_admin', 'isVerified', 'is_verified', 'plan', 'balance', 'roleid']) {
      assert.ok(fields.includes(f), `should include ${f}`);
    }
  });

  it('every entry is well-formed with no duplicate fields', () => {
    const seen = new Set();
    for (const p of MASS_ASSIGNMENT_PAYLOADS) {
      assert.ok(typeof p.field === 'string' && p.field.length > 0, 'field name');
      assert.ok(Array.isArray(p.values) && p.values.length > 0, `${p.field}: values`);
      assert.ok(typeof p.impact === 'string' && p.impact.length > 0, `${p.field}: impact`);
      assert.ok(['high', 'medium', 'low'].includes(p.severity), `${p.field}: severity`);
      assert.ok(!seen.has(p.field), `duplicate field ${p.field}`);
      seen.add(p.field);
    }
  });
});

describe('buildMassAssignmentProbes', () => {
  it('builds one probe per payload value for a PUT with a JSON body', () => {
    const probes = buildMassAssignmentProbes({
      method: 'PUT', url: 'https://t.test/api/user',
      body: { name: 'x', email: 'x@y.z' }, headers: {},
    });
    const expected = MASS_ASSIGNMENT_PAYLOADS.reduce((n, p) => n + p.values.length, 0);
    assert.equal(probes.length, expected);
    const roleProbe = probes.find((p) => p.field === 'role');
    assert.ok(roleProbe);
    assert.equal(roleProbe.value, 'admin');
    assert.equal(roleProbe.request.body.name, 'x');
    assert.equal(roleProbe.request.body.role, 'admin');
    assert.equal(roleProbe.request.method, 'PUT');
    assert.equal(roleProbe.request.url, 'https://t.test/api/user');
  });

  it('skips fields already present in the base body', () => {
    const probes = buildMassAssignmentProbes({
      method: 'PATCH', url: 'https://t.test/api/user',
      body: { name: 'x', role: 'user' },
    });
    assert.ok(!probes.some((p) => p.field === 'role'), 'role already present — no probe');
    assert.ok(probes.some((p) => p.field === 'isAdmin'), 'other fields still probed');
  });

  it('returns [] for read methods and unsupported bodies', () => {
    assert.deepEqual(buildMassAssignmentProbes({ method: 'GET', url: 'https://t/x', body: {} }), []);
    assert.deepEqual(buildMassAssignmentProbes({ method: 'DELETE', url: 'https://t/x', body: {} }), []);
    assert.deepEqual(buildMassAssignmentProbes({ method: 'POST', url: 'https://t/x', body: 'not-json{{{' }), []);
  });

  it('accepts a JSON string body', () => {
    const probes = buildMassAssignmentProbes({
      method: 'POST', url: 'https://t/x', body: '{"name":"x"}',
    });
    assert.ok(probes.length > 0);
    assert.equal(probes[0].request.body.name, 'x');
  });

  it('respects WRITE_METHODS', () => {
    assert.deepEqual(WRITE_METHODS, ['POST', 'PUT', 'PATCH']);
  });
});

describe('checkFieldAccepted', () => {
  it('detects a reflected value (object body)', () => {
    const r = checkFieldAccepted({ user: { role: 'admin' } }, 'role', 'admin');
    assert.equal(r.matched, true);
    assert.equal(r.keyPresent, true);
  });

  it('detects a coerced value as key-present only', () => {
    const r = checkFieldAccepted({ user: { isAdmin: 'yes' } }, 'isAdmin', true);
    assert.equal(r.matched, false);
    assert.equal(r.keyPresent, true);
  });

  it('returns false when the server strips the field', () => {
    const r = checkFieldAccepted({ user: { name: 'x' } }, 'role', 'admin');
    assert.equal(r.matched, false);
    assert.equal(r.keyPresent, false);
  });

  it('handles JSON string bodies and boolean/number equivalence', () => {
    const r = checkFieldAccepted('{"is_admin":true}', 'is_admin', true);
    assert.equal(r.matched, true);
    const r2 = checkFieldAccepted({ balance: 999999 }, 'balance', 999999);
    assert.equal(r2.matched, true);
  });
});

describe('analyzeMassAssignment', () => {
  it('raises a high-confidence finding on reflection', () => {
    const findings = analyzeMassAssignment(
      { status: 200, body: { user: { name: 'x' } } },
      [{ field: 'role', value: 'admin', severity: 'high', impact: 'i',
         request: { method: 'PUT', url: 'https://t/x' },
         response: { status: 200, body: { user: { name: 'x', role: 'admin' } } } }],
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0].type, 'Mass Assignment');
    assert.equal(findings[0].cwe, 'CWE-915');
    assert.equal(findings[0].confidence, 'high');
    assert.equal(findings[0].field, 'role');
  });

  it('raises a medium finding on coercion and none when stripped', () => {
    const coerced = analyzeMassAssignment({}, [{
      field: 'isAdmin', value: true, severity: 'high', impact: 'i',
      request: {}, response: { status: 200, body: { isAdmin: 'yes' } },
    }]);
    assert.equal(coerced.length, 1);
    assert.equal(coerced[0].confidence, 'medium');

    const stripped = analyzeMassAssignment({}, [{
      field: 'role', value: 'admin', severity: 'high', impact: 'i',
      request: {}, response: { status: 200, body: { user: { name: 'x' } } },
    }]);
    assert.equal(stripped.length, 0, 'bare 200 with no reflection is not a finding');
  });

  it('upgrades to high confidence when persistence is confirmed', () => {
    const findings = analyzeMassAssignment({}, [{
      field: 'plan', value: 'premium', severity: 'medium', impact: 'i',
      request: {}, response: { status: 200, body: { ok: true } }, persisted: true,
    }]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].confidence, 'high');
    assert.ok(findings[0].evidence.includes('persisted'));
  });

  it('ignores failed probes', () => {
    const findings = analyzeMassAssignment({}, [
      { field: 'role', value: 'admin', error: 'timeout' },
    ]);
    assert.equal(findings.length, 0);
  });
});

describe('testMassAssignment (mock httpClient)', () => {
  it('finds mass assignment against a vulnerable echo server', async () => {
    const result = await testMassAssignment(
      { method: 'PUT', url: 'https://t.test/api/user', body: { name: 'x' }, headers: {} },
      echoClient,
    );
    assert.equal(result.skipped, false);
    assert.ok(result.probes > 0);
    const fields = result.findings.map((f) => f.field);
    assert.ok(fields.includes('role'), 'role finding');
    assert.ok(fields.includes('isAdmin'), 'isAdmin finding');
    assert.ok(fields.includes('plan'), 'plan finding');
    assert.ok(result.findings.every((f) => f.cwe === 'CWE-915'));
  });

  it('returns no findings against a hardened server', async () => {
    const result = await testMassAssignment(
      { method: 'PUT', url: 'https://t.test/api/user', body: { name: 'x' } },
      stripClient,
    );
    assert.equal(result.findings.length, 0);
  });

  it('skips non-write methods', async () => {
    const result = await testMassAssignment(
      { method: 'GET', url: 'https://t.test/api/user' },
      echoClient,
    );
    assert.equal(result.skipped, true);
    assert.equal(result.findings.length, 0);
  });

  it('confirms persistence via the verify endpoint', async () => {
    // Server echoes on write; verify GET returns the mutated user object.
    let stored = { name: 'x' };
    const stateful = async (req) => {
      if (req.method === 'GET') return { status: 200, body: { user: stored } };
      stored = { ...stored, ...(typeof req.body === 'object' ? req.body : {}) };
      return { status: 200, body: { ok: true } }; // no reflection on write
    };
    const result = await testMassAssignment(
      {
        method: 'PATCH', url: 'https://t.test/api/user', body: { name: 'x' },
        verify: { method: 'GET', url: 'https://t.test/api/user' },
      },
      stateful,
    );
    const roleFinding = result.findings.find((f) => f.field === 'role');
    assert.ok(roleFinding, 'persistence confirmed even without reflection');
    assert.equal(roleFinding.confidence, 'high');
  });

  it('survives per-probe errors without aborting the run', async () => {
    const flaky = async (req) => {
      if (req.body && req.body.role === 'admin') throw new Error('connection reset');
      return echoClient(req);
    };
    const result = await testMassAssignment(
      { method: 'POST', url: 'https://t.test/api/user', body: { name: 'x' } },
      flaky,
    );
    assert.ok(result.findings.length > 0, 'other probes still ran');
    assert.ok(!result.findings.some((f) => f.field === 'role'), 'failed probe produced no finding');
  });

  it('throws TypeError without an httpClient', async () => {
    await assert.rejects(
      () => testMassAssignment({ method: 'POST', url: 'https://t/x', body: {} }, null),
      TypeError,
    );
  });
});
