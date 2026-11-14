// Tests for the agent-sandbox-escape probe
// (NEW vulnerability class: tool-call → host command execution,
// sensitive file read, approval-gate bypass, audit-log evasion;
// phase 149). No network, no lab — the probe talks to the agent
// service only through the opts.fetchFn seam, stubbed here by a
// stateful fake agent endpoint: echo / exec / read_file / run_admin
// tools, a user list and an audit log. Behaviour flags flip the
// fake between a bypassable sandbox and a safe one.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  probeAgentSandboxEscape,
  isAgentExecuteRoute,
  assessToolResult,
  assessExecResult,
  assessFileRead,
  assessApprovalResponse,
  assessAuditCoverage,
  assessHookResult,
  assessHookLogCoverage,
  extractUserIds,
  EXEC_PROBE_COMMAND,
  CANARY_MARKER,
  PUBLIC_FILE_MARKER,
} from './agentSandboxEscape.js';
import { verifyFindings } from '../verifier.js';

const ORIGIN = 'http://lab.local';
const ROUTES = [
  'http://lab.local/agent/execute',
  'http://lab.local/agent/users',
  'http://lab.local/agent/audit',
  'http://other.local/agent/execute',
];

const BASE_OPTS = {
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- stateful fake agent service -------------------------------------------
// behaviour flags:
//   surface: the agent endpoint exists at all (false → every route 404s)
//   execVulnerable: exec evaluates the arithmetic probe to '42'
//   readVulnerable: read_file traversal returns the canary marker
//   approval: 'bypass' (client approved:true honored), 'strict'
//     (client flag ignored; only a server token executes), 'none'
//     (unapproved calls already execute)
//   auditExec / auditAdmin: 'log' (the tool is recorded) or 'omit'
//     (the tool never reaches the audit log)
//   hook: 'gated' (default — refuses while untrusted, fires after
//     trust and logs hook_run_started + hook_run_terminal),
//     'ungated' (fires while untrusted — a trust-gate bypass),
//     'absent' (the hook endpoint 404s — no hook surface)
//   hookLog: 'full' (default — started + terminal) or
//     'omit-terminal' (started only — the log is incomplete)
function makeFakeAgent(behavior = {}) {
  const flags = {
    surface: behavior.surface !== false,
    execVulnerable: Boolean(behavior.execVulnerable),
    readVulnerable: Boolean(behavior.readVulnerable),
    approval: behavior.approval || 'strict',
    auditExec: behavior.auditExec || 'log',
    auditAdmin: behavior.auditAdmin || 'log',
    hook: behavior.hook || 'gated',
    hookLog: behavior.hookLog || 'full',
  };
  const state = {
    users: [{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }],
    audit: [],
    trusted: false,
    posts: 0,
  };
  const stubShell = (command) => {
    if (command === 'expr 6 + 36') return '42\n';
    if (typeof command === 'string' && command.startsWith('echo ')) return `${command.slice(5)}\n`;
    return 'command not mocked\n';
  };
  const reply = (status, json) => ({
    status,
    text: async () => JSON.stringify(json),
  });
  const fetchFn = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = String((init && init.method) || 'GET').toUpperCase();
    let body = null;
    try {
      body = init && init.body ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    if (!flags.surface) return reply(404, { error: 'not found' });
    if (method === 'GET' && u.pathname === '/agent/users') {
      return reply(200, { users: state.users });
    }
    if (method === 'GET' && u.pathname === '/agent/audit') {
      return reply(200, { entries: state.audit });
    }
    if (method === 'GET' && u.pathname === '/agent/trust') {
      return reply(200, { trusted: state.trusted });
    }
    if (method === 'POST' && u.pathname === '/agent/trust') {
      if (body && body.trust === true) state.trusted = true;
      return reply(200, { ok: true, trusted: state.trusted });
    }
    if (method === 'POST' && u.pathname === '/agent/hook') {
      if (flags.hook === 'absent') return reply(404, { error: 'not found' });
      const hookName = (body && body.hook) || 'SessionStart';
      const args = { hook: hookName, matcher: (body && body.matcher) || 'startup' };
      if (!state.trusted && flags.hook !== 'ungated') {
        return reply(403, { ok: false, error: 'workspace_not_trusted' });
      }
      state.audit.push({ tool: 'hook', event: 'hook_run_started', hook_key: 'hooks.json:session_start:def-test', arguments: args, at: Date.now() });
      if (flags.hookLog !== 'omit-terminal') {
        state.audit.push({ tool: 'hook', event: 'hook_run_terminal', hook_key: 'hooks.json:session_start:def-test', arguments: args, status: 'completed', exit_code: 0, at: Date.now() });
      }
      return reply(200, { ok: true, executed: true, result: stubShell(String((body && body.command) || '')) });
    }
    if (method === 'POST' && u.pathname === '/agent/execute') {
      state.posts += 1;
      const tool = body && body.tool;
      const args = (body && body.arguments) || {};
      const log = (t) => {
        const mode = t === 'exec' ? flags.auditExec : t === 'run_admin' ? flags.auditAdmin : 'log';
        if (mode === 'log') state.audit.push({ tool: t, arguments: args, at: Date.now() });
      };
      if (tool === 'echo') {
        log('echo');
        return reply(200, { ok: true, result: { echoed: args.text || '' } });
      }
      if (tool === 'exec') {
        if (!flags.execVulnerable) return reply(200, { ok: false, error: 'exec_not_allowed' });
        log('exec');
        return reply(200, { ok: true, result: stubShell(args.command || '') });
      }
      if (tool === 'read_file') {
        const pth = String(args.path || '');
        if (pth === 'hello.txt') {
          log('read_file');
          return reply(200, { ok: true, result: `${PUBLIC_FILE_MARKER}\n` });
        }
        if (pth.includes('private/credentials.txt')) {
          if (!flags.readVulnerable) return reply(200, { ok: false, error: 'path outside sandbox' });
          log('read_file');
          return reply(200, { ok: true, result: `${CANARY_MARKER}canary-not-a-real-secret-9f2c41\n` });
        }
        return reply(200, { ok: false, error: 'no such file' });
      }
      if (tool === 'run_admin') {
        const approved = args.approved === true;
        const honored = flags.approval === 'none' || (flags.approval === 'bypass' && approved);
        if (!honored) return reply(403, { ok: false, error: 'approval_required' });
        const victim = String(args.userId || '');
        const before = state.users.length;
        state.users = state.users.filter((x) => x.id !== victim);
        if (state.users.length === before) return reply(200, { ok: false, error: 'no such user' });
        log('run_admin');
        return reply(200, { ok: true, executed: true, deleted: victim });
      }
      return reply(400, { ok: false, error: 'unknown tool' });
    }
    return reply(404, { error: 'not found' });
  };
  return { state, fetchFn };
}

// ---- pure helpers -----------------------------------------------------------

describe('agentSandboxEscape — pure helpers', () => {
  it('ASE-1: isAgentExecuteRoute matches well-known + mined execute paths only', () => {
    assert.equal(isAgentExecuteRoute('http://lab.local/agent/execute'), true);
    assert.equal(isAgentExecuteRoute('http://lab.local/api/agent/execute'), true);
    assert.equal(isAgentExecuteRoute('http://lab.local/agent/tool'), true);
    assert.equal(isAgentExecuteRoute('http://lab.local/agent/call'), true);
    assert.equal(isAgentExecuteRoute('http://lab.local/api/agent/call'), true);
    assert.equal(isAgentExecuteRoute('http://lab.local/mcp/invoke'), true);
    assert.equal(isAgentExecuteRoute('http://lab.local/api/chat'), false);
    assert.equal(isAgentExecuteRoute('http://lab.local/agent/users'), false);
    assert.equal(isAgentExecuteRoute('http://lab.local/'), false);
    assert.equal(isAgentExecuteRoute('not a url'), false);
  });
  it('ASE-2: assessToolResult — live only on 200 + JSON carrying the marker', () => {
    assert.equal(assessToolResult(200, { ok: true, result: { echoed: 'ase-fingerprint-hi' } }, 'ase-fingerprint-hi').kind, 'live');
    assert.equal(assessToolResult(404, { error: 'not found' }, 'ase-fingerprint-hi').kind, 'other');
    assert.equal(assessToolResult(200, { ok: true, result: { echoed: 'other' } }, 'ase-fingerprint-hi').kind, 'other');
    assert.equal(assessToolResult(200, null, 'ase-fingerprint-hi').kind, 'other');
  });
  it('ASE-3: assessExecResult — executed only on the exact computed value 42', () => {
    assert.equal(assessExecResult(200, { ok: true, result: '42\n' }).kind, 'executed');
    assert.equal(assessExecResult(200, { ok: true, result: '42' }).kind, 'executed');
    assert.equal(assessExecResult(200, { ok: true, result: 'expr 6 + 36' }).kind, 'other');
    assert.equal(assessExecResult(200, { ok: false, error: 'exec_not_allowed' }).kind, 'refused');
    assert.equal(assessExecResult(403, { ok: false, error: 'forbidden' }).kind, 'refused');
    assert.equal(assessExecResult(200, { ok: true, result: 'hello' }).kind, 'other');
  });
  it('ASE-4: assessFileRead — canary, public, refused, other', () => {
    assert.equal(assessFileRead(200, { ok: true, result: `${CANARY_MARKER}xxx` }).kind, 'canary');
    assert.equal(assessFileRead(200, { ok: true, result: `${PUBLIC_FILE_MARKER}\n` }).kind, 'public');
    assert.equal(assessFileRead(200, { ok: false, error: 'path outside sandbox' }).kind, 'refused');
    assert.equal(assessFileRead(404, { error: 'not found' }).kind, 'refused');
    assert.equal(assessFileRead(200, { ok: true, result: 'some other file' }).kind, 'other');
  });
  it('ASE-5: assessApprovalResponse — executed only on explicit executed:true + 2xx', () => {
    assert.equal(assessApprovalResponse(200, { ok: true, executed: true }).kind, 'executed');
    assert.equal(assessApprovalResponse(200, { ok: true, executed: false }).kind, 'other');
    assert.equal(assessApprovalResponse(403, { ok: false, error: 'approval_required' }).kind, 'refused');
    assert.equal(assessApprovalResponse(200, { ok: false, error: 'approval_required' }).kind, 'refused');
    assert.equal(assessApprovalResponse(200, { ok: true }).kind, 'other');
  });
  it('ASE-6: assessAuditCoverage — logged / missing / unknown', () => {
    const entries = [
      { tool: 'echo', arguments: { text: 'hi' }, at: 1 },
      { tool: 'exec', arguments: { command: EXEC_PROBE_COMMAND }, at: 2 },
    ];
    assert.equal(assessAuditCoverage(entries, 'exec', EXEC_PROBE_COMMAND).kind, 'logged');
    assert.equal(assessAuditCoverage(entries, 'run_admin', 'u3').kind, 'missing');
    assert.equal(assessAuditCoverage([], 'exec', EXEC_PROBE_COMMAND).kind, 'missing');
    assert.equal(assessAuditCoverage(null, 'exec', EXEC_PROBE_COMMAND).kind, 'unknown');
    assert.equal(assessAuditCoverage('nope', 'exec', EXEC_PROBE_COMMAND).kind, 'unknown');
  });
  it('ASE-7: extractUserIds — bare array and {users:[...]} shapes', () => {
    assert.deepEqual(extractUserIds([{ id: 'u1' }, { id: 'u2' }]), ['u1', 'u2']);
    assert.deepEqual(extractUserIds({ users: [{ id: 'u3' }, { id: 5 }, {}] }), ['u3']);
    assert.equal(extractUserIds({ status: 'ok' }), null);
    assert.equal(extractUserIds(null), null);
  });
});

// ---- fingerprint ------------------------------------------------------------

describe('probeAgentSandboxEscape — fingerprint', () => {
  it('ASE-8: a live agent surface fingerprints (diag.agentEndpoints 1) and makes no finding on its own', async () => {
    const { fetchFn } = makeFakeAgent({});
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.agentEndpoints, 1);
    assert.equal(diag.controlOk, true);
    assert.ok(diag.attempts >= 1);
  });
  it('ASE-9: no agent surface at all yields zero findings', async () => {
    const { fetchFn } = makeFakeAgent({ surface: false });
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.agentEndpoints, 0);
  });
});

// ---- L0: host command execution ---------------------------------------------

describe('probeAgentSandboxEscape — L0 host command execution', () => {
  it('ASE-10: an exec tool that evaluates the arithmetic probe fires exactly one [Critical] agent_sandbox_exec finding', async () => {
    const { fetchFn } = makeFakeAgent({ execVulnerable: true, auditExec: 'log' });
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /tool call executes host commands/);
    assert.equal(findings[0].severity, 'critical');
    assert.equal(findings[0].class, 'agent_sandbox_exec');
    assert.equal(findings[0].evidence.signalCorrelated, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });
  it('ASE-11: an exec tool that refuses arithmetic is a true negative', async () => {
    const { fetchFn } = makeFakeAgent({ execVulnerable: false });
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
});

// ---- L1: sensitive file read --------------------------------------------------

describe('probeAgentSandboxEscape — L1 sensitive file read', () => {
  it('ASE-12: a traversal that returns the canary fires exactly one [Critical] agent_sandbox_file_read finding', async () => {
    const { fetchFn } = makeFakeAgent({ readVulnerable: true });
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /tool call reads sensitive files/);
    assert.equal(findings[0].severity, 'critical');
    assert.equal(findings[0].class, 'agent_sandbox_file_read');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });
  it('ASE-13: a read_file confined to the public directory is a true negative', async () => {
    const { fetchFn } = makeFakeAgent({ readVulnerable: false });
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
  });
});

// ---- L2: approval-gate bypass --------------------------------------------------

describe('probeAgentSandboxEscape — L2 approval-gate bypass', () => {
  it('ASE-14: a privileged action that executes on client-supplied approved:true fires one [High] finding and the victim is gone', async () => {
    const { state, fetchFn } = makeFakeAgent({ approval: 'bypass', auditAdmin: 'log' });
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /approval gate bypassed/);
    assert.equal(findings[0].severity, 'high');
    assert.equal(findings[0].class, 'agent_sandbox_approval_gate');
    assert.equal(diag.deletedUserId, 'u3');
    assert.deepEqual(
      state.users.map((u) => u.id),
      ['u1', 'u2']
    );
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });
  it('ASE-15: a privileged action that executes with no approval at all fires the same finding', async () => {
    const { fetchFn } = makeFakeAgent({ approval: 'none', auditAdmin: 'log' });
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.title).join(' | ')}`);
    assert.match(findings[0].title, /approval gate bypassed/);
    assert.equal(findings[0].class, 'agent_sandbox_approval_gate');
  });
  it('ASE-16: a strict approval gate that refuses the crafted call is a true negative', async () => {
    const { state, fetchFn } = makeFakeAgent({ approval: 'strict' });
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
    assert.deepEqual(
      state.users.map((u) => u.id),
      ['u1', 'u2', 'u3']
    );
  });
});

// ---- L3: audit-log evasion --------------------------------------------------

describe('probeAgentSandboxEscape — L3 audit-log evasion', () => {
  it('ASE-17: an executed exec missing from the audit log fires one [Medium] agent_sandbox_audit_evasion finding (plus L0)', async () => {
    const { fetchFn } = makeFakeAgent({ execVulnerable: true, auditExec: 'omit' });
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 2, `expected 2 findings, got: ${findings.map((f) => f.title).join(' | ')}`);
    const l3 = findings.find((f) => f.class === 'agent_sandbox_audit_evasion');
    assert.ok(l3, 'expected an audit-evasion finding');
    assert.match(l3.title, /missing from the audit log/);
    assert.equal(l3.severity, 'medium');
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 2);
  });
  it('ASE-18: an executed exec that IS logged is no audit finding (L0 only)', async () => {
    const { fetchFn } = makeFakeAgent({ execVulnerable: true, auditExec: 'log' });
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'agent_sandbox_exec');
  });
});

// ---- full fake: vulnerable vs safe --------------------------------------------

describe('probeAgentSandboxEscape — full fake', () => {
  it('ASE-19: a fully bypassable sandbox fires 4 findings (L0, L1, L2, L3 naming both omitted actions), all confirmed', async () => {
    const { state, fetchFn } = makeFakeAgent({
      execVulnerable: true,
      readVulnerable: true,
      approval: 'bypass',
      auditExec: 'omit',
      auditAdmin: 'omit',
    });
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 4, `expected 4 findings, got: ${findings.map((f) => f.class).join(', ')}`);
    const classes = findings.map((f) => f.class).sort();
    assert.deepEqual(classes, [
      'agent_sandbox_approval_gate',
      'agent_sandbox_audit_evasion',
      'agent_sandbox_exec',
      'agent_sandbox_file_read',
    ]);
    const l3 = findings.find((f) => f.class === 'agent_sandbox_audit_evasion');
    assert.ok(l3.evidence.request.includes('exec'), 'L3 names the omitted exec');
    assert.ok(l3.evidence.request.includes('run_admin'), 'L3 names the omitted run_admin');
    // The hook leg ran too — and stayed silent: trust-gated + logged
    // execution is designed behaviour, not a bypass.
    assert.equal(diag.hookSurface, true);
    assert.equal(diag.hookFired, true);
    assert.equal(diag.hookLogged, true);
    assert.equal(diag.agentEndpoints, 1);
    assert.equal(diag.executed, true);
    assert.equal(diag.deletedUserId, 'u3');
    assert.deepEqual(
      state.users.map((u) => u.id),
      ['u1', 'u2']
    );
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 4);
    assert.equal(unconfirmed.length, 0);
  });
  it('ASE-20: a fully safe sandbox fires nothing', async () => {
    const { state, fetchFn } = makeFakeAgent({});
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn });
    assert.deepEqual(findings, []);
    assert.deepEqual(
      state.users.map((u) => u.id),
      ['u1', 'u2', 'u3']
    );
  });
});

// ---- gates ------------------------------------------------------------------

describe('probeAgentSandboxEscape — gates', () => {
  it('ASE-21: non-lab host, no allowWrite, or quick depth — all silent', async () => {
    const { fetchFn } = makeFakeAgent({
      execVulnerable: true,
      readVulnerable: true,
      approval: 'bypass',
      auditExec: 'omit',
      auditAdmin: 'omit',
    });
    assert.deepEqual(await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, labTargets: 'other.local' }), []);
    assert.deepEqual(await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, allowWrite: false }), []);
    assert.deepEqual(await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, depth: 'quick' }), []);
  });
  it('ASE-21b: with no mined routes, the well-known-path fallback still finds the lab surface (4 findings)', async () => {
    const { fetchFn } = makeFakeAgent({
      execVulnerable: true,
      readVulnerable: true,
      approval: 'bypass',
      auditExec: 'omit',
      auditAdmin: 'omit',
    });
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, apiRoutes: [] });
    assert.equal(findings.length, 4, `expected 4 findings, got: ${findings.map((f) => f.class).join(', ')}`);
  });
  it('ASE-22: well-known paths are never tried on a non-lab target (zero posts)', async () => {
    const { state, fetchFn } = makeFakeAgent({ execVulnerable: true });
    const findings = await probeAgentSandboxEscape('http://lab.local/', {
      ...BASE_OPTS,
      fetchFn,
      apiRoutes: [],
      labTargets: 'other.local',
    });
    assert.deepEqual(findings, []);
    assert.equal(state.posts, 0, `expected 0 POSTs to a non-lab target, got ${state.posts}`);
  });
});

// ---- L4: trust-gated hook ----------------------------------------------------
// The control case — models the VERIFIED muse-code SessionStart hook:
// trust-gated + logged execution is designed behaviour (silent); a
// hook that fires while untrusted is a trust-gate bypass (finding).

describe('probeAgentSandboxEscape — L4 trust-gated hook', () => {
  it('ASE-23: assessHookResult — executed / refused / other (a bare 404 is other, never a refusal)', () => {
    assert.equal(assessHookResult(200, { ok: true, executed: true }).kind, 'executed');
    assert.equal(assessHookResult(200, { ok: true, executed: false }).kind, 'other');
    assert.equal(assessHookResult(403, { ok: false, error: 'workspace_not_trusted' }).kind, 'refused');
    assert.equal(assessHookResult(200, { ok: false, error: 'approval_required' }).kind, 'refused');
    assert.equal(assessHookResult(404, { error: 'not found' }).kind, 'other');
    assert.equal(assessHookResult(200, { ok: true }).kind, 'other');
    assert.equal(assessHookResult(200, null).kind, 'other');
  });
  it('ASE-24: assessHookLogCoverage — logged only when BOTH started and terminal are present', () => {
    const started = { tool: 'hook', event: 'hook_run_started', arguments: { hook: 'SessionStart', matcher: 'startup' } };
    const terminal = { tool: 'hook', event: 'hook_run_terminal', arguments: { hook: 'SessionStart', matcher: 'startup' }, status: 'completed' };
    assert.equal(assessHookLogCoverage([started, terminal], 'SessionStart').kind, 'logged');
    assert.equal(assessHookLogCoverage([started], 'SessionStart').kind, 'missing');
    assert.equal(assessHookLogCoverage([terminal], 'SessionStart').kind, 'missing');
    assert.equal(assessHookLogCoverage([], 'SessionStart').kind, 'missing');
    assert.equal(assessHookLogCoverage([started, terminal], 'OtherHook').kind, 'missing');
    assert.equal(assessHookLogCoverage(null, 'SessionStart').kind, 'unknown');
    assert.equal(assessHookLogCoverage('nope', 'SessionStart').kind, 'unknown');
  });
  it('ASE-25: a hook that fires while UNTRUSTED fires exactly one [Critical] agent_sandbox_hook_trust_gate finding', async () => {
    const { fetchFn } = makeFakeAgent({ hook: 'ungated' });
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.class).join(', ')}`);
    assert.match(findings[0].title, /hook fires without workspace trust/);
    assert.equal(findings[0].severity, 'critical');
    assert.equal(findings[0].class, 'agent_sandbox_hook_trust_gate');
    assert.equal(diag.hookSurface, true);
    assert.equal(diag.hookFired, true);
    assert.equal(diag.hookLogged, true);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });
  it('ASE-26: a trust-gated hook that fires after trust AND logs both records stays silent (the control case)', async () => {
    const { state, fetchFn } = makeFakeAgent({});
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.hookSurface, true);
    assert.equal(diag.hookFired, true);
    assert.equal(diag.hookLogged, true);
    assert.equal(state.trusted, true, 'the probe granted trust (the one-time click) before firing');
    const hookEntries = state.audit.filter((e) => e.tool === 'hook');
    assert.deepEqual(
      hookEntries.map((e) => e.event),
      ['hook_run_started', 'hook_run_terminal']
    );
  });
  it('ASE-27: a trusted hook that fires but leaves the terminal record out fires one [Medium] audit-evasion finding naming the hook', async () => {
    const { fetchFn } = makeFakeAgent({ hookLog: 'omit-terminal' });
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 1, `expected 1 finding, got: ${findings.map((f) => f.class).join(', ')}`);
    assert.equal(findings[0].class, 'agent_sandbox_audit_evasion');
    assert.equal(findings[0].severity, 'medium');
    assert.match(findings[0].title, /missing from the audit log/);
    assert.ok(findings[0].evidence.request.includes("hook 'SessionStart'"), 'L3 names the hook');
    assert.equal(diag.hookFired, true);
    assert.equal(diag.hookLogged, false);
    const { confirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 1);
  });
  it('ASE-28: no hook surface at all leaves L4 uncalibrated (no hook findings, diag hookSurface false)', async () => {
    const { fetchFn } = makeFakeAgent({ hook: 'absent' });
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.deepEqual(findings, []);
    assert.equal(diag.hookSurface, false);
    assert.equal(diag.hookFired, false);
  });
  it('ASE-29: a fully bypassable sandbox with an UNGATED hook fires 5 findings (L0, L1, L2, L3, hook trust bypass), all confirmed', async () => {
    const { fetchFn } = makeFakeAgent({
      execVulnerable: true,
      readVulnerable: true,
      approval: 'bypass',
      auditExec: 'omit',
      auditAdmin: 'omit',
      hook: 'ungated',
    });
    const diag = {};
    const findings = await probeAgentSandboxEscape('http://lab.local/', { ...BASE_OPTS, fetchFn, diagnostics: diag });
    assert.equal(findings.length, 5, `expected 5 findings, got: ${findings.map((f) => f.class).join(', ')}`);
    const classes = findings.map((f) => f.class).sort();
    assert.deepEqual(classes, [
      'agent_sandbox_approval_gate',
      'agent_sandbox_audit_evasion',
      'agent_sandbox_exec',
      'agent_sandbox_file_read',
      'agent_sandbox_hook_trust_gate',
    ]);
    const { confirmed, unconfirmed } = verifyFindings(findings);
    assert.equal(confirmed.length, 5);
    assert.equal(unconfirmed.length, 0);
  });
});
