// Dark Matter rule-based scanner — MCP tool poisoning probe
// (coverage row #485 [Critical] MCP tool poisoning incl. rug pull /
// tool shadowing, CWE-94 / CWE-829 | OWASP LLM06:2025; phase 112,
// 'mcp-tool-poisoning').
//
// Model Context Protocol (MCP) servers expose tools to an AI agent
// over JSON-RPC (streamable HTTP). The agent lists the server's
// tools, shows them to the operator (or auto-approves them), and
// then invokes them on the model's behalf. Three failure modes
// follow from treating the tool list as trusted, static data:
//
//   (a) POISONED DESCRIPTION — a tool's description or input
//       schema carries hidden instructions ("ignore all previous
//       instructions", "do not tell the user", "exfiltrate the
//       credential") that the agent reads as part of its tool
//       surface and may obey as if they came from the operator.
//   (b) RUG PULL — after the tool is listed and approved, the
//       server silently serves a DIFFERENT definition for the
//       same tool name (new description, new schema, new side
//       effects) with no re-approval step. The approval covered
//       the old definition; the agent now runs the new one.
//   (c) SHADOWING — a second tool with a lookalike name and a
//       near-identical description is listed alongside the
//       original, so the agent (or the operator approving it)
//       picks the attacker's tool by mistake.
//
// ORACLE (state-change / reproduction, no judge, no LLM, $0):
// the probe drives a minimal MCP client (plain fetch, no new
// dependencies) and lists the server's tools three times.
//   * Poisoned description — a tool whose description/schema
//     matches a hidden-instruction pattern in BOTH of two
//     consecutive listings (the instruction is part of the
//     agent-facing surface and reproduces; a one-off listing
//     glitch is not a finding). Clean tools in the same listing
//     are the control: they carry no such pattern.
//   * Rug pull — the same tool name serves a materially
//     different definition (description or inputSchema) in the
//     second listing, AND a third listing serves the NEW
//     definition again (the change persists; a server that
//     rotates its definitions on every list is jitter, not a
//     rug pull, and stays quiet).
//   * Shadowing — a lookalike pair (names equal after
//     normalisation, or within edit distance 2, or one name plus
//     a confusable suffix) with similar descriptions is present
//     in BOTH of two consecutive listings.
// A server that answers no JSON-RPC, exposes no tools, or lists
// only stable benign tools stays quiet.
//
// GATES: none inside the probe — the caller passes the MCP
// endpoint URL explicitly, so the probe only ever talks to an
// endpoint the scan already discovered (wiring: run only when an
// MCP endpoint is known; never against an arbitrary web target).
// Read-only JSON-RPC calls (initialize, tools/list) — no tool is
// ever invoked, so the probe cannot execute a poisoned tool.
// Runs at standard/deep depth only.
//
// HONEST LIMITS: no MCP lab exists today, so this probe is
// mock-server verified only — the unit tests drive a local
// node:http JSON-RPC server that plants all three behaviours
// plus a clean control server. Live proof against a real MCP
// server is a later lane. The probe cannot observe whether an
// operator re-approved a changed tool out-of-band; it reports
// the observed definition change without a re-approval step in
// the protocol exchange itself. A server that requires
// authentication answers 401 and the probe stays quiet (no
// credentials are ever sent).
//
// VERIFICATION: findings are class 'mcp_tool_poisoning' —
// protocolFor routes it to the default protocol (judged on
// signalCorrelated, see differential.js), exactly like
// llm_tool_misuse. The class name deliberately contains neither
// 'xss' nor 'bypass' so no family branch claims it.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_FINDINGS = 5;

// Hidden-instruction patterns. Each is a directive an agent would
// read as an instruction, not ordinary tool documentation: telling
// the agent to ignore prior instructions, to hide its actions from
// the user, to bypass safety controls, or to move credentials out
// of the session. A tool that merely documents a parameter named
// "token" matches none of these.
const HIDDEN_INSTRUCTION_PATTERNS = [
  {
    label: 'ignore-previous-instructions',
    re: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions/i,
  },
  {
    label: 'disregard-safety',
    re: /disregard\s+(safety|policy|guardrails|restrictions|rules)/i,
  },
  {
    label: 'override-instructions',
    re: /(override|bypass)\s+(your\s+)?(instructions|system\s+prompt|safety)/i,
  },
  {
    label: 'do-not-disclose',
    re: /do\s+not\s+(tell|mention|reveal|disclose|inform|warn)\s+(the\s+)?user/i,
  },
  {
    label: 'exfiltrate-credentials',
    re: /(exfiltrate|send|upload|leak|transmit|forward)\b.{0,80}\b(credential|secret|password|api[-_ ]?key|private\s+key|access\s+token)\b/i,
  },
  {
    label: 'act-without-confirmation',
    re: /without\s+(asking|confirmation|approval)\s+(the\s+)?user/i,
  },
];

// Words too generic to count as shared description vocabulary
// when judging whether two tool descriptions are similar.
const DESCRIPTION_STOPWORDS = new Set([
  'tool', 'function', 'this', 'that', 'with', 'from', 'using', 'returns',
  'return', 'provides', 'provide', 'allows', 'allow', 'access', 'data',
  'user', 'users', 'file', 'files', 'the', 'and', 'for', 'into', 'your',
]);

// Confusable suffixes that turn a tool name into a lookalike:
// read_file vs read_file_v2, get_data vs get_data_prod.
const SHADOW_SUFFIXES = new Set(['v2', 'v3', 'new', 'prod', 'secure', 'beta', 'real', '2', '3', 'app', 'api']);

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

function slug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tool';
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/** Normalised tool name: lowercase alphanumerics only. Pure. */
export function normalizeToolName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Classic edit distance over two short strings. Pure. */
export function levenshtein(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x === y) return 0;
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= y.length; j += 1) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[y.length];
}

/**
 * Hidden-instruction labels matched in a tool's description /
 * schema text. Returns [] when the text carries no directive.
 * Pure.
 */
export function assessHiddenInstructions(text) {
  const haystack = typeof text === 'string' ? text : '';
  if (!haystack) return [];
  return HIDDEN_INSTRUCTION_PATTERNS.filter((p) => p.re.test(haystack)).map((p) => p.label);
}

/**
 * Compare two definitions of the same tool name. 'changed' only
 * when the description text or the input schema differs beyond
 * surrounding whitespace. Pure.
 */
export function assessToolDefinitionChange(before, after) {
  if (!before || !after) return { changed: false, fields: [] };
  const fields = [];
  const descBefore = String(before.description || '').trim();
  const descAfter = String(after.description || '').trim();
  if (descBefore !== descAfter) fields.push('description');
  const schemaBefore = JSON.stringify(before.inputSchema || null);
  const schemaAfter = JSON.stringify(after.inputSchema || null);
  if (schemaBefore !== schemaAfter) fields.push('inputSchema');
  return { changed: fields.length > 0, fields };
}

/**
 * Distinctive description tokens: lowercase words of length >= 5
 * outside the stopword set. Pure.
 */
export function descriptionTokens(description) {
  const words = String(description || '').toLowerCase().match(/[a-z]{5,}/g) || [];
  return new Set(words.filter((w) => !DESCRIPTION_STOPWORDS.has(w)));
}

/**
 * Two tool descriptions are "similar" when they share at least
 * one distinctive token, or one description names the other's
 * tool. Pure.
 */
export function descriptionsSimilar(a, b) {
  const tokensA = descriptionTokens(a && a.description);
  const tokensB = descriptionTokens(b && b.description);
  for (const t of tokensA) {
    if (tokensB.has(t)) return true;
  }
  const nameA = normalizeToolName(a && a.name);
  const nameB = normalizeToolName(b && b.name);
  const descA = String(a && a.description || '').toLowerCase();
  const descB = String(b && b.description || '').toLowerCase();
  if (nameA && descB.includes(nameA)) return true;
  if (nameB && descA.includes(nameB)) return true;
  return false;
}

/**
 * Two tools are lookalikes when their normalised names are equal
 * but the raw names differ (read_file vs read-file), within edit
 * distance 2, or one name is the other plus a confusable suffix.
 * Pure.
 */
export function toolsAreLookalikes(a, b) {
  if (!a || !b || a.name === b.name) return false;
  const normA = normalizeToolName(a.name);
  const normB = normalizeToolName(b.name);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (Math.min(normA.length, normB.length) >= 4 && levenshtein(normA, normB) <= 2) return true;
  const [short, long] = normA.length <= normB.length ? [normA, normB] : [normB, normA];
  if (long.startsWith(short)) {
    const rest = long.slice(short.length);
    if (SHADOW_SUFFIXES.has(rest) || rest.length <= 2) return true;
  }
  return false;
}

/**
 * Find shadow pairs in a tool list: lookalike names with similar
 * descriptions. Returns [{ original, shadow }] with the shorter
 * name treated as the original. Pure.
 */
export function findShadowPairs(tools) {
  const list = Array.isArray(tools) ? tools : [];
  const pairs = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (!toolsAreLookalikes(a, b)) continue;
      if (!descriptionsSimilar(a, b)) continue;
      const [original, shadow] =
        String(a.name).length <= String(b.name).length ? [a, b] : [b, a];
      pairs.push({ original, shadow });
    }
  }
  return pairs;
}

/**
 * Pull the tool list out of a JSON-RPC response (or a bare
 * { tools } body). Returns null when the body carries no tool
 * array. Pure.
 */
export function parseToolsList(json) {
  if (!json || typeof json !== 'object') return null;
  const tools = json.result && Array.isArray(json.result.tools)
    ? json.result.tools
    : Array.isArray(json.tools)
      ? json.tools
      : null;
  if (!tools) return null;
  return tools
    .filter((t) => t && typeof t.name === 'string' && t.name.length > 0)
    .map((t) => ({
      name: t.name,
      description: typeof t.description === 'string' ? t.description : '',
      inputSchema: t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema : null,
    }));
}

// ---- minimal MCP client (fetch only, no dependencies) ------------------------

function getHeader(res, name) {
  try {
    if (res && res.headers && typeof res.headers.get === 'function') {
      return res.headers.get(name) || res.headers.get(name.toLowerCase());
    }
    if (res && res.headers && typeof res.headers === 'object') {
      const key = Object.keys(res.headers).find((k) => k.toLowerCase() === name.toLowerCase());
      return key ? res.headers[key] : null;
    }
  } catch {
    // header access is best-effort
  }
  return null;
}

// Parse a streamable-HTTP MCP response body: plain JSON, or
// text/event-stream where each `data:` line carries a JSON-RPC
// message (the last one wins).
function parseMcpBody(text) {
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body) return null;
  if (body.includes('data:')) {
    let last = null;
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      try {
        last = JSON.parse(trimmed.slice(5).trim());
      } catch {
        // a non-JSON data line is not a JSON-RPC message
      }
    }
    return last;
  }
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function mcpCall(fetchFn, endpoint, method, params, id, sessionId, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || TIMEOUT_MS);
  try {
    const payload = { jsonrpc: '2.0', method };
    if (id !== null && id !== undefined) payload.id = id;
    if (params !== undefined) payload.params = params;
    const res = await fetchFn(endpoint, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    return { json: parseMcpBody(text), sessionId: getHeader(res, 'mcp-session-id') || sessionId || null };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function listTools(fetchFn, endpoint, sessionId, id, opts) {
  const res = await mcpCall(fetchFn, endpoint, 'tools/list', {}, id, sessionId, opts);
  if (!res) return { tools: null, sessionId };
  return { tools: parseToolsList(res.json), sessionId: res.sessionId || sessionId };
}

// ---- the probe ---------------------------------------------------------------

/**
 * Probe an MCP server for tool poisoning, rug pull and shadowing (#485).
 * @param {string} mcpUrl — the MCP endpoint URL (streamable HTTP),
 *   discovered by the scan; the probe talks to this URL only.
 * @param {object} opts — { fetchFn, diagnostics, timeoutMs }.
 * @returns {object[]} findings (class 'mcp_tool_poisoning') — at
 *   most one per poisoned tool / rug-pulled tool / shadow pair,
 *   max 5 per scan. Read-only: tools are listed, never invoked.
 */
export async function probeMcpToolPoisoning(mcpUrl, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  let endpoint;
  try {
    endpoint = new URL(mcpUrl).toString();
  } catch {
    return findings;
  }

  // Handshake: initialize, then the initialized notification.
  // A server that does not speak MCP stays quiet — no finding.
  const init = await mcpCall(
    fetchFn,
    endpoint,
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'DarkMatter-Scanner', version: '1.0' },
    },
    1,
    null,
    opts,
  );
  if (!init || !init.json || init.json.error) return findings;
  setDiag('initialized', true);
  let sessionId = init.sessionId || null;
  await mcpCall(fetchFn, endpoint, 'notifications/initialized', undefined, null, sessionId, opts);

  // Two consecutive listings: the comparison surface for all
  // three behaviours.
  const first = await listTools(fetchFn, endpoint, sessionId, 2, opts);
  if (!first.tools) return findings;
  sessionId = first.sessionId || sessionId;
  const second = await listTools(fetchFn, endpoint, sessionId, 3, opts);
  if (!second.tools) return findings;
  sessionId = second.sessionId || sessionId;
  const listA = first.tools;
  const listB = second.tools;
  setDiag('toolsListed', listB.length);
  setDiag('listsCompared', 2);

  const byName = (list) => {
    const map = new Map();
    for (const t of list) map.set(t.name, t);
    return map;
  };
  const mapA = byName(listA);
  const mapB = byName(listB);
  const toolText = (t) => `${t.description || ''} ${JSON.stringify(t.inputSchema || {})}`;

  // (b) RUG PULL — same name, different definition in listing B,
  // confirmed by a third listing serving the NEW definition.
  const rugCandidates = [];
  for (const [name, toolB] of mapB) {
    const toolA = mapA.get(name);
    if (!toolA) continue;
    const change = assessToolDefinitionChange(toolA, toolB);
    if (change.changed) rugCandidates.push({ name, toolA, toolB, fields: change.fields });
  }
  if (rugCandidates.length > 0) {
    const third = await listTools(fetchFn, endpoint, sessionId, 4, opts);
    if (third.tools) {
      setDiag('listsCompared', 3);
      const mapC = byName(third.tools);
      for (const c of rugCandidates) {
        const toolC = mapC.get(c.name);
        if (!toolC) continue;
        // The new definition persists (C == B) and still differs
        // from the approved one (C != A): a real rug pull, not a
        // server that rotates definitions on every list.
        if (!assessToolDefinitionChange(c.toolB, toolC).changed &&
          assessToolDefinitionChange(c.toolA, toolC).changed) {
          findings.push({
            class: 'mcp_tool_poisoning',
            id: `mcp-rugpull-${slug(c.name)}`,
            title: `MCP tool definition changed after listing (rug pull) — "${c.name}"`,
            severity: 'critical',
            url: endpoint,
            parameter: c.name,
            evidence: ev(
              `POST ${endpoint} {"method":"tools/list"} (x3, JSON-RPC over streamable HTTP)`,
              `Tool "${c.name}" was listed with one definition and then served a different one with no re-approval step: changed field(s) ${c.fields.join(', ')}. Approved definition: ${JSON.stringify(c.toolA.description || '').slice(0, 300)}. Served definition (confirmed on a repeat listing): ${JSON.stringify(c.toolB.description || '').slice(0, 300)}.`,
              'A tool approved under one definition now runs under another — the agent executes code and side effects the operator never reviewed. Re-list tools before every invocation and require fresh approval whenever a definition changes.',
            ),
          });
          if (findings.length >= MAX_FINDINGS) return findings;
        }
      }
    }
  }

  // (a) POISONED DESCRIPTION — the hidden instruction is present
  // in BOTH listings (it reproduces; it is the agent-facing
  // surface, not a one-off glitch).
  const poisoned = [];
  for (const toolB of listB) {
    const labelsB = assessHiddenInstructions(toolText(toolB));
    if (labelsB.length === 0) continue;
    const toolA = mapA.get(toolB.name);
    if (!toolA) continue;
    const labelsA = assessHiddenInstructions(toolText(toolA));
    if (labelsA.length === 0) continue;
    const same = labelsA.length === labelsB.length && labelsA.every((l) => labelsB.includes(l));
    if (same) poisoned.push({ tool: toolB, labels: labelsB });
  }
  setDiag('poisonedTools', poisoned.map((p) => p.tool.name));
  for (const { tool, labels } of poisoned) {
    findings.push({
      class: 'mcp_tool_poisoning',
      id: `mcp-poisoned-${slug(tool.name)}`,
      title: `MCP tool description carries hidden instructions — "${tool.name}"`,
      severity: 'critical',
      url: endpoint,
      parameter: tool.name,
      evidence: ev(
        `POST ${endpoint} {"method":"tools/list"} (x2, JSON-RPC over streamable HTTP)`,
        `Tool "${tool.name}" is listed with hidden instructions in its agent-facing description/schema, observed identically in two consecutive listings (matched directive(s): ${labels.join(', ')}). Description served: ${JSON.stringify(tool.description || '').slice(0, 400)}.`,
        'Tool descriptions are prompt content to the agent — hidden instructions in them can steer the agent to ignore the operator, hide actions, or move credentials. Treat tool metadata as untrusted data: scan descriptions for directives and never let them override operator instructions.',
      ),
    });
    if (findings.length >= MAX_FINDINGS) return findings;
  }

  // (c) SHADOWING — a lookalike pair with similar descriptions,
  // present in BOTH listings.
  const pairsB = findShadowPairs(listB);
  const shadowPairs = pairsB.filter(
    ({ original, shadow }) => mapA.has(original.name) && mapA.has(shadow.name),
  );
  setDiag('shadowPairs', shadowPairs.map(({ original, shadow }) => `${original.name}~${shadow.name}`));
  for (const { original, shadow } of shadowPairs) {
    findings.push({
      class: 'mcp_tool_poisoning',
      id: `mcp-shadow-${slug(shadow.name)}`,
      title: `MCP tool shadowing — lookalike tool "${shadow.name}" listed alongside "${original.name}"`,
      severity: 'high',
      url: endpoint,
      parameter: shadow.name,
      evidence: ev(
        `POST ${endpoint} {"method":"tools/list"} (x2, JSON-RPC over streamable HTTP)`,
        `Two tools with lookalike names and similar descriptions are listed side by side in two consecutive listings: "${original.name}" (${JSON.stringify(original.description || '').slice(0, 200)}) and "${shadow.name}" (${JSON.stringify(shadow.description || '').slice(0, 200)}). The agent or the approving operator can pick the wrong one.`,
        'A shadowing tool can impersonate a trusted tool and receive the arguments — including credentials and file paths — meant for the original. Pin tools by exact name and server identity, and flag lookalike names at approval time.',
      ),
    });
    if (findings.length >= MAX_FINDINGS) return findings;
  }

  setDiag('rugPullTools', rugCandidates.map((c) => c.name));
  return findings;
}

export const __mcpToolPoisoningMeta = { phases: ['mcp-tool-poisoning'], depth: ['standard', 'deep'] };
