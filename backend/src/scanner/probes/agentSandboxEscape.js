// Dark Matter rule-based scanner — agent sandbox escape probe
// (NEW vulnerability class: agent sandbox escape, OWASP LLM06:2025
// family; related rows #485 [Critical] MCP tool poisoning and
// #17/#379 [Critical/High] LLM excessive agency; no dedicated
// coverage row exists for this class yet — see HONEST LIMITS.
// Phase 149, 'agent-sandbox-escape'.)
//
// ORACLE (deterministic, no judge, no LLM, $0): a sandboxed agent
// exposes a tool-call endpoint. The sandbox is escaped when a tool
// call reaches the host anyway — each leg below is a bounded
// differential with a benign control, never a guess:
//
//   L0  Tool-call → host command execution: the exec tool answers
//       the arithmetic probe 'expr 6 + 36' with the computed value
//       '42'. An echo passthrough would return the literal command
//       string; only a host shell evaluates the expression.
//       Class agent_sandbox_exec. [Critical]
//   L1  Tool-call → sensitive file read: the read_file tool answers
//       a public file (control: the known public marker) and then
//       a traversal '../private/credentials.txt' with the canary
//       credential marker. Confirm only when the canary appears.
//       Class agent_sandbox_file_read. [Critical]
//   L2  Approval-gate bypass via crafted tool input: a privileged
//       action (delete_user) first refuses without approval
//       (control), then executes when the caller supplies
//       approved:true in the tool arguments — confirmed only when
//       the victim is also gone from a re-read user list (observed
//       state change). If the unapproved call already executes,
//       that fires the same finding (no approval at all).
//       Class agent_sandbox_approval_gate. [High]
//   L3  Action with no audit-log record: an action that demonstrably
//       executed (L0 or L2) is absent from the agent's audit log
//       (GET /agent/audit answers with entries, none naming the
//       executed tool call). If the audit endpoint does not answer,
//       L3 is uncalibrated, never a finding.
//       Class agent_sandbox_audit_evasion. [Medium]
//
// GATES: isLabTargetHost + allowWrite + depth !== 'quick' (the probe
// executes commands and deletes a lab user — a state change — so it
// never runs outside a lab target or on a quick scan). No labCreds:
// the agent service is unauthenticated in the mock, like the LLM
// lab (llm-excessive-agency needs none either). BOUND: at most
// MAX_POSTS tool calls in total; at most one finding per leg.
// Well-known tool paths are tried ONLY on lab targets, never
// against an arbitrary web target.
//
// HONEST LIMITS: the real mechanism of the user's muse-code report
// ("sandbox bypass of muse — arbitrary host code execution +
// credential exfiltration, no approval, no logs") is being verified
// by a separate hunt lane and is NOT wired here — this probe tests
// the generic family against a mock lab whose sandbox is
// deliberately bypassable (see agent-sandbox-lab.mjs). A follow-up
// lane wires the exact technique once confirmed. The mock's L2
// victim comes from the mock's own /agent/users list, and L3 needs
// the mock's /agent/audit endpoint; a real agent service without
// those observable surfaces leaves L2/L3 uncalibrated. The probe
// never reads a real credential: the only "sensitive" file it
// reads is the mock's canary file, whose content is a made-up
// marker (ASE_CANARY_TOKEN=canary-not-a-real-secret-...), never a
// real secret. Findings are classes 'agent_sandbox_exec',
// 'agent_sandbox_file_read', 'agent_sandbox_approval_gate' and
// 'agent_sandbox_audit_evasion' — none contains 'xss' or 'bypass',
// so protocolFor routes all four to the default protocol (judged
// on evidence.signalCorrelated, see differential.js).

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_POSTS = 24;
const MAX_CANDIDATES = 3;

// The arithmetic probe: only a host shell evaluates it. The command
// string itself never contains '42', so a '42' answer cannot be an
// echo of the input.
export const EXEC_PROBE_COMMAND = 'expr 6 + 36';
export const EXEC_PROBE_EXPECTED = '42';

// The mock's public file and its known content; the traversal target
// and the canary marker it must never disclose.
export const PUBLIC_FILE_PATH = 'hello.txt';
export const PUBLIC_FILE_MARKER = 'ASE-PUBLIC-HELLO';
export const TRAVERSAL_PATHS = ['../private/credentials.txt', '..%2fprivate%2fcredentials.txt'];
export const CANARY_MARKER = 'ASE_CANARY_TOKEN=';

// Well-known agent tool-call paths — tried ONLY on lab targets.
export const AGENT_EXECUTE_PATHS = [
  '/agent/execute',
  '/api/agent/execute',
  '/agent/tool',
  '/api/agent/tool',
  '/agent/call',
];
const AGENT_AUDIT_PATHS = ['/agent/audit', '/api/agent/audit'];
const AGENT_USERS_PATHS = ['/agent/users', '/api/agent/users'];

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function bodyText(json) {
  if (json == null) return '';
  if (typeof json === 'string') return json;
  try {
    return JSON.stringify(json);
  } catch {
    return '';
  }
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * True when a URL looks like an agent tool-call endpoint: its
 * pathname is one of the well-known execute paths, or ends with a
 * tool-call verb under /agent/, /api/agent/ or /mcp/. Pure.
 */
export function isAgentExecuteRoute(url) {
  let p = '';
  try {
    p = new URL(String(url)).pathname.toLowerCase().replace(/\/+$/, '');
  } catch {
    return false;
  }
  if (AGENT_EXECUTE_PATHS.includes(p)) return true;
  return /\/(agent|api\/agent|mcp)\/(execute|call|invoke|run|tool)$/.test(p);
}

/**
 * Judge one tool-call response against the echoed marker the caller
 * sent. 'live' only on HTTP 200 + a JSON body carrying the marker
 * verbatim (the service executed the tool and returned its result).
 * Pure.
 */
export function assessToolResult(status, json, marker) {
  if (status !== 200 || !json || typeof json !== 'object') return { kind: 'other' };
  const text = bodyText(json);
  if (typeof marker === 'string' && marker && !text.includes(marker)) return { kind: 'other' };
  return { kind: 'live', text };
}

/**
 * Judge the exec-tool answer to the arithmetic probe. 'executed'
 * only when the result text, trimmed, is exactly the computed value
 * '42' — an echo passthrough returns the literal command string
 * instead. 'refused' on an explicit error / non-2xx. Pure.
 */
export function assessExecResult(status, json) {
  if (!json || typeof json !== 'object') return { kind: 'other' };
  const text = bodyText(json.result !== undefined ? json.result : json);
  if (json.ok === false || /not allowed|refused|forbidden|denied|unsupported|error/i.test(text)) {
    return { kind: 'refused', text };
  }
  if (status >= 200 && status < 300 && text.trim() === EXEC_PROBE_EXPECTED) {
    return { kind: 'executed', text };
  }
  return { kind: 'other', text };
}

/**
 * Judge a read_file answer. 'canary' when the body carries the
 * canary credential marker; 'public' when it carries the known
 * public-file marker; 'refused' on an explicit error / non-2xx;
 * anything else is 'other'. Pure.
 */
export function assessFileRead(status, json) {
  if (!json || typeof json !== 'object') return { kind: 'other' };
  const text = bodyText(json.result !== undefined ? json.result : json);
  if (text.includes(CANARY_MARKER)) return { kind: 'canary', text };
  if (text.includes(PUBLIC_FILE_MARKER)) return { kind: 'public', text };
  if (json.ok === false || status >= 400 || /not allowed|refused|forbidden|denied|traversal|outside|not found|no such file/i.test(text)) {
    return { kind: 'refused', text };
  }
  return { kind: 'other', text };
}

/**
 * Judge a privileged (approval-gated) tool answer. 'executed' only
 * on an explicit executed:true with a 2xx status; 'refused' on an
 * explicit approval demand / non-2xx; anything else is 'other'.
 * Pure.
 */
export function assessApprovalResponse(status, json) {
  if (!json || typeof json !== 'object') return { kind: 'other' };
  if (json.executed === true && status >= 200 && status < 300) return { kind: 'executed' };
  const text = bodyText(json);
  if (json.ok === false || status >= 400 || /approval|confirm|authori[sz]/i.test(text)) {
    return { kind: 'refused', text };
  }
  return { kind: 'other', text };
}

/**
 * Judge whether the audit log covers an executed action. 'logged'
 * when any entry names the tool and carries the marker (the command
 * string or the deleted user id); 'missing' when the log answers
 * with entries and none matches; 'unknown' when the log shape is
 * unusable. Pure.
 */
export function assessAuditCoverage(entries, tool, marker) {
  if (!Array.isArray(entries)) return { kind: 'unknown' };
  const hit = entries.some((e) => {
    if (!e || typeof e !== 'object') return false;
    if (e.tool !== tool) return false;
    const hay = bodyText(e.arguments !== undefined ? e.arguments : e);
    return typeof marker === 'string' && marker ? hay.includes(marker) : true;
  });
  return { kind: hit ? 'logged' : 'missing' };
}

/**
 * Pull the string user ids out of a /agent/users answer — either a
 * bare array or {users:[...]}. Non-string / missing ids are
 * skipped. Pure.
 */
export function extractUserIds(json) {
  const list = Array.isArray(json) ? json : json && Array.isArray(json.users) ? json.users : null;
  if (!list) return null;
  const ids = [];
  for (const u of list) {
    if (u && typeof u.id === 'string' && u.id) ids.push(u.id);
  }
  return ids;
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', body = null, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON — json stays null
    }
    return { status: res.status, text: text.slice(0, 200000), json };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** POST one tool call. Returns { status, json, text } or null. */
async function toolCall(fetchFn, executeUrl, tool, args) {
  return req(fetchFn, executeUrl, { method: 'POST', body: { tool, arguments: args || {} } });
}

/**
 * Fingerprint the target's agent tool-call endpoint.
 *
 * Candidates: mined execute routes from `minedRoutes` first, then
 * the well-known paths on `origin` — but the well-known paths are
 * tried ONLY when the origin is a lab target (isLabTargetHost), so
 * a non-lab target never receives an unsolicited POST. Each
 * candidate gets ONE benign echo call ({tool:'echo'}); the first
 * candidate that assesses as live wins.
 *
 * Returns { executeUrl, attempts } — executeUrl is null when no
 * live agent surface was found. No finding is ever decided here.
 */
export async function findAgentExecuteEndpoint(fetchFn, origin, minedRoutes, opts = {}) {
  const result = { executeUrl: null, attempts: 0 };
  const mined = [];
  for (const r of minedRoutes || []) {
    const s = String(r || '');
    if (isAgentExecuteRoute(s) && !mined.includes(s)) mined.push(s);
  }
  const candidates = mined.slice(0, MAX_CANDIDATES);
  if (candidates.length < MAX_CANDIDATES && isLabTargetHost(origin, opts.labTargets)) {
    for (const p of AGENT_EXECUTE_PATHS) {
      const u = origin.replace(/\/+$/, '') + p;
      if (!candidates.includes(u)) candidates.push(u);
      if (candidates.length >= MAX_CANDIDATES) break;
    }
  }
  for (const candidate of candidates) {
    result.attempts += 1;
    const r = await toolCall(fetchFn, candidate, 'echo', { text: 'ase-fingerprint-hi' });
    if (!r) continue;
    if (assessToolResult(r.status, r.json, 'ase-fingerprint-hi').kind === 'live') {
      result.executeUrl = candidate;
      return result;
    }
  }
  return result;
}

export async function probeAgentSandboxEscape(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  if (opts.allowWrite !== true) return findings;
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  if ((opts.depth || 'standard') === 'quick') return findings;
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return findings;
  }
  const routes = (opts.apiRoutes || []).map(String);

  let posts = 0;
  const notePost = (n = 1) => {
    posts += n;
    setDiag('attempts', posts);
  };
  const postOk = () => posts < MAX_POSTS;
  const executedActions = []; // {tool, marker} — subjects for the L3 audit leg

  // Fingerprint the agent surface. No live tool endpoint means an
  // honest [] before any attack leg runs.
  const fp = await findAgentExecuteEndpoint(fetchFn, origin, routes, opts);
  notePost(fp.attempts);
  setDiag('agentEndpoints', fp.executeUrl ? 1 : 0);
  if (!fp.executeUrl) return findings;
  const executeUrl = fp.executeUrl;
  setDiag('controlOk', true);

  // L0 — tool-call → host command execution. The arithmetic probe
  // distinguishes a shell from an echo passthrough: only a shell
  // evaluates 'expr 6 + 36' to '42'.
  let l0Executed = false;
  if (postOk()) {
    const r = await toolCall(fetchFn, executeUrl, 'exec', { command: EXEC_PROBE_COMMAND });
    notePost();
    if (r) {
      const judged = assessExecResult(r.status, r.json);
      if (judged.kind === 'executed') {
        l0Executed = true;
        executedActions.push({ tool: 'exec', marker: EXEC_PROBE_COMMAND });
        setDiag('executed', true);
        findings.push({
          class: 'agent_sandbox_exec',
          id: `ase-exec-${rand()}`,
          title: 'Agent sandbox escape: tool call executes host commands (CRITICAL)',
          severity: 'critical',
          url: executeUrl,
          evidence: ev(
            `POST ${executeUrl} {tool:'exec', arguments:{command:'${EXEC_PROBE_COMMAND}'}} → ${r.status}`,
            `Tool result: ${String(judged.text || '').slice(0, 300)}. The command string contains no '42'; only a host shell evaluates the expression to 42.`,
            'The agent sandbox does not contain command execution: a tool call reaches the host shell, so any tool input is arbitrary host code execution.',
          ),
        });
      }
    }
  }

  // L1 — tool-call → sensitive file read. Public-read control first:
  // the tool must return the known public marker before the
  // traversal is attempted. Confirm only on the canary marker.
  if (postOk()) {
    const pub = await toolCall(fetchFn, executeUrl, 'read_file', { path: PUBLIC_FILE_PATH });
    notePost();
    if (pub && assessFileRead(pub.status, pub.json).kind === 'public') {
      for (const traversal of TRAVERSAL_PATHS) {
        if (!postOk()) break;
        const r = await toolCall(fetchFn, executeUrl, 'read_file', { path: traversal });
        notePost();
        if (!r) continue;
        const judged = assessFileRead(r.status, r.json);
        if (judged.kind === 'canary') {
          findings.push({
            class: 'agent_sandbox_file_read',
            id: `ase-read-${rand()}`,
            title: 'Agent sandbox escape: tool call reads sensitive files outside the sandbox (CRITICAL)',
            severity: 'critical',
            url: executeUrl,
            evidence: ev(
              `POST ${executeUrl} {tool:'read_file', arguments:{path:'${traversal}'}} → ${r.status} (public control ${PUBLIC_FILE_PATH} returned the known marker)`,
              `Tool result carries the canary credential marker (${CANARY_MARKER}...) — the file read escaped the sandbox directory.`,
              'The agent sandbox does not contain file reads: a tool call with a traversal path reaches credential files on the host.',
            ),
          });
          break;
        }
      }
    }
  }

  // L2 — approval-gate bypass via crafted tool input. The victim is
  // the last user of the agent's own user list; the action must be
  // observed as a state change (user gone on re-read), not merely
  // claimed by a response body.
  let l2Executed = false;
  let victimId = null;
  const usersRes = await req(fetchFn, origin.replace(/\/+$/, '') + AGENT_USERS_PATHS[0]);
  const usersBefore = usersRes && usersRes.json ? extractUserIds(usersRes.json) : null;
  if (usersBefore && usersBefore.length) {
    victimId = usersBefore[usersBefore.length - 1];
    const runAdmin = async (extraArgs) => {
      if (!postOk()) return null;
      const r = await toolCall(fetchFn, executeUrl, 'run_admin', {
        action: 'delete_user',
        userId: victimId,
        ...(extraArgs || {}),
      });
      notePost();
      return r;
    };
    const stateChanged = async () => {
      const after = await req(fetchFn, origin.replace(/\/+$/, '') + AGENT_USERS_PATHS[0]);
      const ids = after && after.json ? extractUserIds(after.json) : null;
      return Array.isArray(ids) && !ids.includes(victimId);
    };
    const confirmL2 = async (how) => {
      if (await stateChanged()) {
        l2Executed = true;
        executedActions.push({ tool: 'run_admin', marker: victimId });
        setDiag('executed', true);
        setDiag('deletedUserId', victimId);
        findings.push({
          class: 'agent_sandbox_approval_gate',
          id: `ase-approval-${rand()}`,
          title: 'Agent sandbox escape: approval gate bypassed by crafted tool input (HIGH)',
          severity: 'high',
          url: executeUrl,
          evidence: ev(
            `POST ${executeUrl} {tool:'run_admin', arguments:{action:'delete_user', userId:'${victimId}'}} → executed`,
            `The privileged action ran ${how} and the user list re-read confirms the victim is gone (before: ${usersBefore.length} users).`,
            'The approval gate is client-controlled: a tool call executes a privileged action without any server-side approval.',
          ),
        });
        return true;
      }
      return false;
    };
    // First: the unapproved call. If it already executes, the gate
    // does not exist at all — same finding, stronger evidence.
    const plain = await runAdmin();
    if (plain && assessApprovalResponse(plain.status, plain.json).kind === 'executed') {
      await confirmL2('with no approval field at all');
    } else if (plain && assessApprovalResponse(plain.status, plain.json).kind === 'refused') {
      // Control satisfied: the gate refuses without approval. Now
      // the crafted input — a client-supplied approved:true.
      const crafted = await runAdmin({ approved: true });
      if (crafted && assessApprovalResponse(crafted.status, crafted.json).kind === 'executed') {
        await confirmL2('with a client-supplied approved:true');
      }
    }
  }

  // L3 — action with no audit-log record. Only when an action
  // demonstrably executed AND the audit log answers with entries.
  if (executedActions.length) {
    let entries = null;
    for (const p of AGENT_AUDIT_PATHS) {
      const r = await req(fetchFn, origin.replace(/\/+$/, '') + p);
      if (r && r.json && Array.isArray(r.json.entries)) {
        entries = r.json.entries;
        break;
      }
    }
    if (entries !== null) {
      // One finding per class: list every executed action that the
      // log omits in a single finding (the verifier dedupes same-
      // class findings), so no evidence is lost.
      const missing = [];
      for (const action of executedActions) {
        const judged = assessAuditCoverage(entries, action.tool, action.marker);
        if (judged.kind === 'missing') missing.push(action);
      }
      if (missing.length) {
        const named = missing.map((a) => `${a.tool} '${a.marker}'`).join(' and ');
        findings.push({
          class: 'agent_sandbox_audit_evasion',
          id: `ase-audit-${rand()}`,
          title: 'Agent sandbox escape: executed action missing from the audit log (MEDIUM)',
          severity: 'medium',
          url: executeUrl,
          evidence: ev(
            `GET ${origin.replace(/\/+$/, '') + AGENT_AUDIT_PATHS[0]} → ${entries.length} entries; ${named} executed but absent`,
            `The audit log answers with ${entries.length} entries and none names the executed ${named} call${missing.length > 1 ? 's' : ''}.`,
            'The executed action leaves no audit record: tool-call abuse is invisible to the operator and to any review.',
          ),
        });
      }
    }
  }

  return findings;
}

export const __agentSandboxEscapeMeta = { phases: ['agent-sandbox-escape'], depth: ['standard', 'deep'] };
