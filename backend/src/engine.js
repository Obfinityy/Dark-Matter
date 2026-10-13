// Engine bridge — HTTP client for the PentAGI hunt engine.
//
// EXACT contract: engine/pentagi/INTEGRATION.md (paths verified against the
// engine source: backend/pkg/server/router.go, services/*, schema.graphqls).
//   POST /api/v1/flows/                 {input, provider:"custom"} -> 201 {data:{id,...}}
//   GET  /api/v1/flows/:id              -> {data:{id,status,...}}   (status:
//                                         created|running|waiting|finished|failed)
//   PUT  /api/v1/flows/:id              {action:"stop"|"finish"|"input"|"report"|"rename"}
//   GET  /api/v1/flows/:id/agentlogs | toolcalls | msglogs | termlogs | ...
// Response envelope: {data, error} — helpers unwrap `.data`.
// Auth: Authorization: Bearer <ENGINE_TOKEN> (engine-minted via
//       docker/tools/mint-engine-token; never hand-crafted, never logged).
//
// Pause/resume: PentAGI has NO operator pause. Mapping (per INTEGRATION.md §4.3):
//   pause  -> snapshot a checkpoint (flow status + findings summary) into the
//             hunt meta, then terminal-stop the flow. The hunt reads as paused.
//   resume -> if the flow is "waiting" (paused at a checkpoint), send
//             {action:"input"} to continue it in place; otherwise recreate a NEW
//             flow whose input carries the checkpoint context ("continue from
//             here, do not repeat completed steps") and return its new huntId.
//   stop   -> terminal stop ({action:"stop"}).
//
// Events: polled from the per-flow log endpoints and mapped onto the DM model
//   thinking | tool_call | finding | status | done
// (agentlogs→thinking, toolcalls→tool_call, msglogs→thinking/finding,
//  termlogs→tool_call[terminal], flow status→status/done).
// `seq` is deterministic per log entry (endpoint-range + entry id), so polls
// are idempotent and `since` filtering never re-emits or skips entries.
//
// Failure policy: the engine is treated as DOWN — every helper throws
// EngineUnreachableError, and routes translate that to HTTP 502 with a clear
// JSON body. We never hang (AbortController timeout) and never fake success.

import { config } from './config.js';
import { readHuntMeta, writeHuntMeta } from './store.js';

export class EngineUnreachableError extends Error {
  constructor(message = 'Hunt engine is unreachable') {
    super(message);
    this.name = 'EngineUnreachableError';
    this.status = 502;
  }
}

export class EngineError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'EngineError';
    this.status = status;
  }
}

async function engineFetch(path, { method = 'GET', body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.engineTimeoutMs);
  const headers = { Accept: 'application/json' };
  if (config.engineToken) headers.Authorization = `Bearer ${config.engineToken}`;
  let fetchBody;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }
  try {
    const res = await fetch(`${config.engineUrl}${path}`, {
      method,
      headers,
      body: fetchBody,
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `engine responded ${res.status}`;
      throw new EngineError(res.status, msg);
    }
    // PentAGI wraps success as {data, error:null} — unwrap it.
    if (data && typeof data === 'object' && 'data' in data && !('id' in data)) {
      return data.data;
    }
    return data;
  } catch (err) {
    if (err instanceof EngineError) throw err;
    const reason =
      err && err.name === 'AbortError'
        ? `timed out after ${config.engineTimeoutMs}ms`
        : String((err && err.message) || err);
    throw new EngineUnreachableError(
      `Hunt engine is unreachable at ${config.engineUrl} (${reason})`
    );
  } finally {
    clearTimeout(timer);
  }
}

export function engineBaseUrl() {
  return config.engineUrl;
}

function normalizeScopeLines(scope) {
  if (Array.isArray(scope)) return scope.map((s) => String(s)).map((s) => s.trim()).filter(Boolean);
  if (typeof scope === 'string' && scope.trim()) return [scope.trim()];
  return [];
}

// §3 scope contract — the engine does NOT enforce scope; the orchestrator
// does, and the scope rides inside the flow input.
function buildFlowInput(target, scope, checkpoint) {
  const lines = normalizeScopeLines(scope);
  const scopeBlock = lines.length ? lines.map((l) => `  - ${l}`).join('\n') : '  - (not specified — target only)';
  let input =
    `TARGET: ${target}\n` +
    `SCOPE:\n${scopeBlock}\n` +
    `AUTHORIZATION: owner self-test (confirmed via API on ${new Date().toISOString()})\n` +
    `OUT_OF_SCOPE: everything not listed above\n\n` +
    `Objective: perform an autonomous penetration test of TARGET, strictly inside SCOPE. ` +
    `Do not touch anything outside SCOPE. Think step by step, use your tools, and report findings as you go.`;
  if (checkpoint) {
    input +=
      `\n\nCHECKPOINT (resumed hunt — do not repeat completed steps):\n` +
      `${checkpoint.summary}\n` +
      `Continue the hunt from this state.`;
  }
  return input;
}

function flowIdOf(flow) {
  const id = flow && (flow.id ?? flow.flowId ?? flow.flow_id);
  if (id === undefined || id === null) throw new EngineError(502, 'engine did not return a flow id');
  return String(id);
}

// ---- Hunts ---------------------------------------------------------------

export async function createEngineHunt(target, scope) {
  const flow = await engineFetch('/api/v1/flows/', {
    method: 'POST',
    body: { input: buildFlowInput(target, scope, null), provider: 'custom' },
  });
  const huntId = flowIdOf(flow);
  return { huntId, raw: flow };
}

export function getEngineHunt(huntId) {
  return engineFetch(`/api/v1/flows/${encodeURIComponent(huntId)}`);
}

function terminalStatus(status) {
  return status === 'finished' || status === 'failed';
}

async function snapshotCheckpoint(huntId, flow) {
  // Best-effort summary: counts + latest report-type messages. Bounded and fast.
  let findings = [];
  let toolCalls = 0;
  try {
    const [msgs, tools] = await Promise.all([
      engineFetch(`/api/v1/flows/${encodeURIComponent(huntId)}/msglogs`).catch(() => []),
      engineFetch(`/api/v1/flows/${encodeURIComponent(huntId)}/toolcalls`).catch(() => []),
    ]);
    const msgList = Array.isArray(msgs) ? msgs : [];
    toolCalls = Array.isArray(tools) ? tools.length : 0;
    findings = msgList
      .filter((m) => m && (m.type === 'report' || /finding|vulnerab/i.test(String(m.type || ''))))
      .slice(-5)
      .map((m) => String(m.content || m.text || m.message || '').slice(0, 500));
  } catch {
    // checkpoint must never fail the pause itself
  }
  const checkpoint = {
    flowId: String(huntId),
    status: (flow && flow.status) || 'unknown',
    pausedAt: new Date().toISOString(),
    toolCalls,
    findings,
    summary:
      `Paused at status "${(flow && flow.status) || 'unknown'}" after ${toolCalls} tool calls. ` +
      (findings.length
        ? `Latest findings:\n- ${findings.join('\n- ')}`
        : 'No findings recorded yet.'),
  };
  try {
    const meta = readHuntMeta(huntId) || {};
    writeHuntMeta(huntId, { ...meta, checkpoint });
  } catch {
    // meta persistence is best-effort; the checkpoint still returns to the caller
  }
  return checkpoint;
}

export async function pauseEngineHunt(huntId) {
  const flow = await getEngineHunt(huntId);
  const status = flow && flow.status;
  if (terminalStatus(status)) {
    throw new EngineError(409, `hunt is already ${status}; cannot pause`);
  }
  if (status === 'waiting') {
    // Already paused at an engine checkpoint — nothing to stop.
    return { paused: true, atCheckpoint: true, flowId: String(huntId), status };
  }
  // No operator pause exists: snapshot, then terminal-stop the flow.
  const checkpoint = await snapshotCheckpoint(huntId, flow);
  await engineFetch(`/api/v1/flows/${encodeURIComponent(huntId)}`, {
    method: 'PUT',
    body: { action: 'stop' },
  });
  return { paused: true, atCheckpoint: false, flowId: String(huntId), checkpointAt: checkpoint.pausedAt };
}

export async function resumeEngineHunt(huntId) {
  const flow = await getEngineHunt(huntId).catch(() => null);
  const status = flow && flow.status;
  if (status === 'waiting') {
    // Continue the paused-at-checkpoint flow in place.
    const updated = await engineFetch(`/api/v1/flows/${encodeURIComponent(huntId)}`, {
      method: 'PUT',
      body: { action: 'input', input: 'Operator resumed the hunt. Continue from your last checkpoint.' },
    });
    return { resumed: true, via: 'input', huntId: String(huntId), raw: updated };
  }
  // Otherwise recreate: a stopped flow can never be resumed in place.
  const meta = readHuntMeta(huntId) || {};
  const checkpoint = meta.checkpoint || null;
  if (!checkpoint) {
    throw new EngineError(
      409,
      'no checkpoint for this hunt; it cannot be resumed (only hunts paused via /pause carry a checkpoint)'
    );
  }
  const target = meta.target || 'unknown target';
  const scope = meta.scope || null;
  const { huntId: newHuntId, raw } = await createEngineHunt(target, scope, checkpoint);
  try {
    writeHuntMeta(newHuntId, {
      huntId: newHuntId,
      target,
      scope,
      createdAt: new Date().toISOString(),
      authorized: true,
      resumedFrom: String(huntId),
    });
  } catch {
    // best-effort
  }
  return { resumed: true, via: 'recreate', huntId: newHuntId, resumedFrom: String(huntId), raw };
}

export async function stopEngineHunt(huntId) {
  const updated = await engineFetch(`/api/v1/flows/${encodeURIComponent(huntId)}`, {
    method: 'PUT',
    body: { action: 'stop' },
  });
  return updated ?? { stopped: true, flowId: String(huntId) };
}

// ---- Events --------------------------------------------------------------

// Deterministic numeric seq per log entry: endpoint range + entry id.
// Separate ranges keep `since` filtering monotonic across endpoints and
// idempotent across polls/restarts (no process state needed).
const ENDPOINT_RANGE = { agentlogs: 1, toolcalls: 2, msglogs: 3, termlogs: 4 };
const RANGE = 1e12;

function numericId(entry, fallback) {
  const id = entry && (entry.id ?? entry.seq ?? entry.log_id);
  const n = Number(id);
  if (Number.isFinite(n)) return n;
  let h = 0;
  for (const ch of String(id ?? fallback)) h = (h * 31 + ch.charCodeAt(0)) % 1e9;
  return h;
}

function entrySeq(endpoint, entry, index) {
  return ENDPOINT_RANGE[endpoint] * RANGE + numericId(entry, index);
}

function entryText(entry) {
  return String(entry.content ?? entry.text ?? entry.message ?? entry.output ?? '').slice(0, 4000);
}

function entryAt(entry) {
  return entry.created_at || entry.createdAt || entry.timestamp || entry.at || null;
}

function mapLogEntries(endpoint, list) {
  const arr = Array.isArray(list) ? list : [];
  return arr.map((entry, i) => {
    const seq = entrySeq(endpoint, entry, i);
    const at = entryAt(entry);
    if (endpoint === 'agentlogs') {
      return { seq, type: 'thinking', text: entryText(entry), at };
    }
    if (endpoint === 'toolcalls') {
      return {
        seq,
        type: 'tool_call',
        tool: entry.toolName || entry.tool_name || entry.name || 'tool',
        args: entry.args ?? entry.arguments ?? null,
        result: String(entry.result ?? entry.output ?? '').slice(0, 4000),
        status: entry.status || null,
        at,
      };
    }
    if (endpoint === 'termlogs') {
      return { seq, type: 'tool_call', tool: 'terminal', output: entryText(entry), at };
    }
    // msglogs
    const msgType = String(entry.type || '');
    if (msgType === 'report') {
      const text = entryText(entry);
      return { seq, type: 'finding', kind: 'report', title: text.split('\n')[0].slice(0, 160) || 'Engine report', description: text, at };
    }
    return { seq, type: 'thinking', source: 'message', text: entryText(entry), at };
  });
}

// Best-effort "only on change" status tracking (module state; duplicates after
// a restart are harmless — status events carry no seq).
const lastSeenStatus = new Map();

export async function getEngineEvents(huntId, since = 0) {
  const id = encodeURIComponent(huntId);
  const [flow, agentlogs, toolcalls, msglogs, termlogs] = await Promise.all([
    engineFetch(`/api/v1/flows/${id}`).catch(() => null),
    engineFetch(`/api/v1/flows/${id}/agentlogs`).catch(() => []),
    engineFetch(`/api/v1/flows/${id}/toolcalls`).catch(() => []),
    engineFetch(`/api/v1/flows/${id}/msglogs`).catch(() => []),
    engineFetch(`/api/v1/flows/${id}/termlogs`).catch(() => []),
  ]);

  const events = [
    ...mapLogEntries('agentlogs', agentlogs),
    ...mapLogEntries('toolcalls', toolcalls),
    ...mapLogEntries('msglogs', msglogs),
    ...mapLogEntries('termlogs', termlogs),
  ]
    .filter((e) => typeof e.seq === 'number' && e.seq > since)
    .sort((a, b) => a.seq - b.seq);

  // Status / done (no seq — must not pollute the client's lastSeq watermark).
  const status = flow && flow.status;
  if (status && lastSeenStatus.get(String(huntId)) !== status) {
    lastSeenStatus.set(String(huntId), status);
    events.push({ type: 'status', state: status, huntId: String(huntId), at: new Date().toISOString() });
    if (terminalStatus(status)) {
      events.push({ type: 'done', state: status, huntId: String(huntId), at: new Date().toISOString() });
    }
  }
  return events;
}
