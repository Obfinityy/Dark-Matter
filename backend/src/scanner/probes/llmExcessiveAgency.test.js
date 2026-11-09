// Tests for the LLM excessive-agency probe
// (coverage rows #17 [Critical] + #379 [High]; phase 112).
// No network, no lab — the probe talks to the fake only through
// the opts.fetchFn seam. The fake mirrors the vulnerable-LLM
// lab's documented shapes: GET /api/users lists the seeded
// users, POST /api/tool deleteUser removes one with no
// confirmation step.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeLlmExcessiveAgency, extractUserIds, assessDelete } from './llmExcessiveAgency.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const BASE_OPTS = {
  allowWrite: true,
  labTargets: 'lab.local',
};

// ---- stateful fake LLM lab --------------------------------------------------
// behaviour flags: deleteOk (the delete succeeds), users (seeded list).
function makeFakeLlmLab({ deleteOk = true, users = ['u1', 'u2', 'u3'] } = {}) {
  const state = { calls: [], users: [...users] };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    let body = {};
    try {
      body = init.body ? JSON.parse(init.body) : {};
    } catch {
      body = {};
    }
    state.calls.push(`${method} ${u.pathname}`);
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    if (method === 'GET' && u.pathname === '/api/users') {
      return json(200, { users: state.users.map((id) => ({ id, name: id, email: `${id}@example.com` })) });
    }
    if (method === 'POST' && u.pathname === '/api/tool' && body.action === 'deleteUser') {
      if (!deleteOk) return json(403, { error: 'confirmation required' });
      const idx = state.users.indexOf(body.userId);
      if (idx === -1) return json(404, { error: 'user not found' });
      state.users.splice(idx, 1);
      return json(200, { ok: true, deleted: body.userId, remaining: [...state.users] });
    }
    return json(404, { error: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure helpers -----------------------------------------------------------

describe('extractUserIds', () => {
  it('LE-1: {users:[...]} and bare arrays parse; a status object does not', () => {
    assert.deepEqual(extractUserIds({ users: [{ id: 'u1' }, { id: 'u2' }] }), ['u1', 'u2']);
    assert.deepEqual(extractUserIds([{ id: 'u1' }]), ['u1']);
    assert.deepEqual(extractUserIds({ users: [{ id: 'u1' }, { name: 'no-id' }, { id: '' }] }), ['u1']);
    assert.equal(extractUserIds({ status: 'ok' }), null);
    assert.equal(extractUserIds(null), null);
  });
});

describe('assessDelete', () => {
  it('LE-2: present-before + absent-after + count-1 confirms; anything else does not', () => {
    assert.equal(assessDelete(['u1', 'u2', 'u3'], 'u3', ['u1', 'u2']).verdict, 'confirmed');
    assert.equal(assessDelete(['u1', 'u2', 'u3'], 'u3', ['u1', 'u2', 'u3']).verdict, 'rejected');
    assert.equal(assessDelete(['u1', 'u2', 'u3'], 'u3', ['u1']).verdict, 'unconfirmed');
    assert.equal(assessDelete(['u1', 'u2'], 'u9', ['u1', 'u2']).verdict, 'unconfirmed');
    assert.equal(assessDelete([], 'u1', []).verdict, 'unconfirmed');
    assert.equal(assessDelete(['u1'], 'u1', null).verdict, 'unconfirmed');
  });
});

// ---- the probe, end to end against the fake ---------------------------------

describe('probeLlmExcessiveAgency — vulnerable lab', () => {
  it('LE-3: one unconfirmed deleteUser removes the last user — exactly one [Critical] llm_excessive_agency finding', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const diag = {};
    const findings = await probeLlmExcessiveAgency(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /deleted a user account with no confirmation/);
    assert.equal(findings[0].severity, 'critical');
    assert.equal(findings[0].class, 'llm_excessive_agency');
    assert.equal(findings[0].parameter, 'userId');
    assert.equal(findings[0].url, 'http://lab.local/api/tool');
    assert.equal(diag.usersBefore, 3);
    assert.equal(diag.usersAfter, 2);
    assert.equal(diag.deletedUserId, 'u3', 'the victim is the last listed user');
    assert.equal(diag.confirmationRequired, false);
    assert.deepEqual(state.calls, ['GET /api/users', 'POST /api/tool', 'GET /api/users']);
    assert.deepEqual(state.users, ['u1', 'u2'], 'the lab state really changed');
  });
  it('LE-4: the fired finding verifies as confirmed through the real pipeline', async () => {
    const { fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmExcessiveAgency(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn });
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
    assert.equal(unconfirmed.length, 0);
    assert.equal(confirmed[0].confirmation, 'confirmed');
  });
});

describe('probeLlmExcessiveAgency — safe lab and gates', () => {
  it('LE-5: a lab that demands confirmation (403) is a true negative — zero findings, nobody deleted', async () => {
    const { state, fetchFn } = makeFakeLlmLab({ deleteOk: false });
    const diag = {};
    const findings = await probeLlmExcessiveAgency(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.usersBefore, 3);
    assert.deepEqual(state.users, ['u1', 'u2', 'u3']);
  });
  it('LE-6: an empty user list is uncalibrated — zero findings', async () => {
    const { fetchFn } = makeFakeLlmLab({ users: [] });
    const diag = {};
    const findings = await probeLlmExcessiveAgency(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.usersBefore, 0);
  });
  it('LE-7: a non-lab target gets zero requests', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmExcessiveAgency('http://example.com/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
  it('LE-8: quick depth skips the probe — zero findings, zero requests', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmExcessiveAgency(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, depth: 'quick' });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
  it('LE-9: allowWrite false skips the probe — no state change is attempted', async () => {
    const { state, fetchFn } = makeFakeLlmLab();
    const findings = await probeLlmExcessiveAgency(`${ORIGIN}/`, { ...BASE_OPTS, fetchFn, allowWrite: false });
    assert.deepEqual(findings, []);
    assert.deepEqual(state.calls, []);
  });
});
