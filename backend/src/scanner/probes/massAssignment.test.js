// Tests for the mass-assignment probe (#38). Lab-gated with revert.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeMassAssignment } from './massAssignment.js';

describe('massAssignment probe', () => {
  it('returns [] on non-lab targets (lab gate)', async () => {
    const forms = [{ action: 'http://example.com/register', inputs: [{ name: 'user', value: 'x' }] }];
    const findings = await probeMassAssignment(forms, 'http://example.com/register', {
      labTargets: 'lab.local',
      timeoutMs: 3000,
    });
    assert.deepEqual(findings, [], 'non-lab target must not be probed');
  });

  it('returns [] with no forms', async () => {
    const findings = await probeMassAssignment([], 'http://127.0.0.1:1/', {
      labTargets: '127.0.0.1',
      timeoutMs: 2000,
    });
    assert.deepEqual(findings, []);
  });

  // ---- T2: escalation + revert (scripted fetch state machine) --------------
  // GET returns `{"role":"<state.role>"} <a href="/admin">Admin</a>` — the
  // chrome deliberately exercises both weak gates. POST with role=<v>
  // stores state.role; POST with no role param is the revert.
  const FORMS = [{ action: 'http://lab.local/register', inputs: [{ name: 'user', value: 'x' }] }];
  const OPTS = { labTargets: 'lab.local', timeoutMs: 2000, depth: 'quick' };

  function makeFetch(state) {
    return async (url, init = {}) => {
      const method = init.method || 'GET';
      if (method === 'GET') {
        return { ok: true, status: 200, text: async () => `{"role":"${state.role}"} <a href="/admin">Admin</a>` };
      }
      const params = new URLSearchParams(init.body || '');
      if (params.has('role')) {
        if (state.failEvilPost && params.get('role') === 'admin') throw new Error('network down');
        if (state.ignorePosts) return { ok: true, status: 200, text: async () => `{"role":"${state.role}"}` };
        state.role = params.get('role');
      } else {
        if (state.failRevert) throw new Error('network down');
        if (state.revertRestores) state.role = 'user';
      }
      return { ok: true, status: 200, text: async () => `{"role":"${state.role}"}` };
    };
  }

  async function runT2(state) {
    const orig = global.fetch;
    global.fetch = makeFetch(state);
    try {
      return await probeMassAssignment(FORMS, 'http://lab.local/register', OPTS);
    } finally {
      global.fetch = orig;
    }
  }

  it('T2 guard: no T1 confirmation means no escalation finding', async () => {
    const findings = await runT2({ role: 'user', ignorePosts: true });
    assert.ok(!findings.some((x) => x.id.startsWith('ma-escalate-')), 'no T1 bindability proof means no T2');
  });

  it('T2 revert-failure: evidence says revert-ok false, title drops "reverted"', async () => {
    const findings = await runT2({ role: 'user', revertRestores: false });
    const f = findings.find((x) => x.id.startsWith('ma-escalate-'));
    assert.ok(f, 'escalation finding must still fire');
    assert.ok(f.evidence.response.includes('revert-ok: false'), 'evidence must report the failed revert');
    assert.ok(!f.title.includes('reverted'), 'title must not claim a revert that failed');
    assert.ok(f.title.includes('REVERT NOT CONFIRMED'));
  });

  it('T2 bare-word FP: failed evil POST stays silent despite "admin" chrome', async () => {
    const findings = await runT2({ role: 'user', failEvilPost: true, revertRestores: true });
    assert.ok(!findings.some((x) => x.id.startsWith('ma-escalate-')), 'a failed escalation POST is not elevation');
  });

  it('T2 true positive: escalation + clean revert, verbatim window quoted', async () => {
    const findings = await runT2({ role: 'user', revertRestores: true });
    const esc = findings.filter((x) => x.id.startsWith('ma-escalate-'));
    assert.equal(esc.length, 1, 'exactly one escalation finding');
    assert.equal(findings.length, 2, 'one T1 finding plus one escalation finding');
    assert.equal(esc[0].severity, 'critical');
    assert.equal(esc[0].parameter, 'role');
    assert.ok(esc[0].title.includes('reverted'), 'title claims the revert only when it succeeded');
    assert.ok(esc[0].evidence.response.includes('"role":"admin"'), 'evidence must quote the elevated value verbatim');
    assert.ok(esc[0].evidence.response.includes('revert-ok: true'), 'evidence must report the successful revert');
  });

  // isLab follow-up (8 Nov 2026): the whole probe is lab-gated, but the
  // old local isLab never saw labTargets (no call-site pass) and never
  // matched port-bearing entries — the probe could never run in production.
  it('lab branch runs with PORT-BEARING labTargets (the production shape)', async () => {
    const state = { role: 'user', revertRestores: true };
    const calls = [];
    const orig = global.fetch;
    const inner = makeFetch(state);
    global.fetch = async (url, init) => { calls.push(String(url)); return inner(url, init); };
    try {
      const findings = await probeMassAssignment(
        [{ action: 'http://127.0.0.1:9/register', inputs: [{ name: 'user', value: 'x' }] }],
        'http://127.0.0.1:9/register',
        { labTargets: '127.0.0.1:9', timeoutMs: 2000, depth: 'quick' }
      );
      assert.ok(calls.length > 0, 'port-bearing labTargets must open the lab branch');
      assert.ok(findings.some((x) => x.id.startsWith('ma-escalate-')), 'escalation must fire on the lab stub');
    } finally {
      global.fetch = orig;
    }
  });

  it('mismatched host sends zero requests (lab gate)', async () => {
    const calls = [];
    const orig = global.fetch;
    const inner = makeFetch({ role: 'user' });
    global.fetch = async (url, init) => { calls.push(String(url)); return inner(url, init); };
    try {
      const findings = await probeMassAssignment(
        [{ action: 'http://notlab.local/register', inputs: [{ name: 'user', value: 'x' }] }],
        'http://notlab.local/register',
        { labTargets: 'lab.local', timeoutMs: 2000, depth: 'quick' }
      );
      assert.deepEqual(findings, []);
      assert.equal(calls.length, 0, 'non-lab target must not be probed at all');
    } finally {
      global.fetch = orig;
    }
  });

  it('T2 revert-network-failure: still reports revert-ok false', async () => {
    const findings = await runT2({ role: 'user', failRevert: true });
    const f = findings.find((x) => x.id.startsWith('ma-escalate-'));
    assert.ok(f, 'escalation finding must still fire');
    assert.ok(f.evidence.response.includes('revert-ok: false'), 'a thrown revert POST is a failed revert');
  });
});
