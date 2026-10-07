/**
 * testRequestCore.js — wave 37 (ideas 51453–51480): on-demand test-request
 * suite — pure logic.
 *
 * Natural-language test parsing, wizard validation, target descriptors,
 * technique catalog, payload validation, priority, queue management,
 * cancellation, verdicts, cost preview, safety checks, approval routing,
 * templates, chaining, scheduling, repetition, comparison, notes, result
 * explanations, evidence capture, sharing, voice transcripts, history,
 * suggestion engine, bulk requests, parameter tuning, sandbox replicas,
 * and dry-run previews.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random().
 */

export const WAVE37_TQ_START = 51453;
export const WAVE37_TQ_END = 51480;

/** Registry of the 28 on-demand test-request ideas — completeness is testable. */
export const WAVE37_TQ_IDEAS = [
  [51453, 'on-demand test box', 'Type "try SQLi on the login form" and the agent queues a targeted test'],
  [51454, 'test request wizard', 'Guided steps turning a vague idea into a precise, safe test'],
  [51455, 'test targeting picker', 'Point-and-click selection of the exact URL, form, or parameter'],
  [51456, 'test technique menu', 'The full technique catalog with plain descriptions'],
  [51457, 'custom payload input', 'Supply your own test payload for the agent to execute safely'],
  [51458, 'test priority flag', 'Mark a requested test as urgent to jump the queue'],
  [51459, 'test queue view', 'All requested tests with live status: queued, running, done'],
  [51460, 'test cancellation', 'Withdraw a requested test before or during execution'],
  [51461, 'test result alerts', 'Notified the moment a requested test completes, with the verdict'],
  [51462, 'test cost preview', 'Estimated requests and time before you confirm the test'],
  [51463, 'test safety check', 'The agent warns if a requested test risks side effects'],
  [51464, 'test approval routing', 'Risky requested tests flow through approvals automatically'],
  [51465, 'test templates', 'Save frequent test requests as one-click templates'],
  [51466, 'test chaining', '"If that works, then try…" conditional follow-up tests'],
  [51467, 'test scheduling', 'Queue a test to run when the current phase completes'],
  [51468, 'test repetition', 'Re-run a previous test against a changed target with one click'],
  [51469, 'test comparison', 'Run the same test across endpoints and compare results'],
  [51470, 'test notes', 'Attach your hypothesis to a requested test for the record'],
  [51471, 'test result explanation', 'Every completed test gets a plain-language verdict'],
  [51472, 'test evidence capture', 'Full request/response evidence stored automatically per test'],
  [51473, 'test sharing', 'Send a test-request link to a teammate to review before running'],
  [51474, 'voice test requests', 'Dictate test ideas hands-free during a live hunt'],
  [51475, 'test request history', 'Every test you ever requested, searchable with outcomes'],
  [51476, 'test suggestion engine', 'The agent proposes tests based on what it is discovering'],
  [51477, 'bulk test requests', 'Submit a list of targets and techniques in one batch'],
  [51478, 'test parameter tuning', 'Adjust depth, payload count, or timeouts per requested test'],
  [51479, 'test sandbox mode', 'Run a requested test against a safe replica first'],
  [51480, 'test dry-run', 'Preview exactly what the agent will send before it sends anything'],
];

export const WAVE37_IDEAS = WAVE37_TQ_IDEAS;

/* --- 51456 · technique catalog -------------------------------------------------- */

export const TECHNIQUE_CATALOG = [
  { id: 'sqli', name: 'SQL injection', plain: 'Try database trickery on inputs', risk: 'low', requests: 12 },
  { id: 'xss', name: 'Reflected XSS', plain: 'Try scripts that bounce back in pages', risk: 'low', requests: 10 },
  { id: 'ssrf', name: 'SSRF probe', plain: 'Ask the server to fetch a URL it should not', risk: 'medium', requests: 8 },
  { id: 'idor', name: 'IDOR check', plain: 'Try other users\u2019 object IDs', risk: 'medium', requests: 6 },
  { id: 'dirbrute', name: 'Directory discovery', plain: 'Probe for hidden paths and files', risk: 'low', requests: 200 },
  { id: 'jwt', name: 'JWT analysis', plain: 'Inspect login tokens for flaws', risk: 'low', requests: 4 },
  { id: 'cors', name: 'CORS check', plain: 'See which websites can read this API', risk: 'low', requests: 3 },
  { id: 'headers', name: 'Header audit', plain: 'Check security headers on responses', risk: 'none', requests: 2 },
];

export function lookupTechnique(id) {
  return TECHNIQUE_CATALOG.find((t) => t.id === String(id).toLowerCase()) || null;
}

/* --- 51453 · on-demand test box --------------------------------------------------- */

const TECH_WORDS = {
  sqli: ['sqli', 'sql injection', 'sql-injection', 'injection'],
  xss: ['xss', 'cross site', 'cross-site', 'script'],
  ssrf: ['ssrf', 'server-side request', 'server side request'],
  idor: ['idor', 'insecure direct', 'other user'],
  dirbrute: ['directory', 'hidden path', 'hidden file', 'fuzz', 'discover'],
  jwt: ['jwt', 'token'],
  cors: ['cors'],
  headers: ['header'],
};

export function parseTestRequest(text) {
  const t = String(text || '').toLowerCase();
  let technique = null;
  for (const [id, words] of Object.entries(TECH_WORDS)) {
    if (words.some((w) => t.includes(w))) { technique = id; break; }
  }
  const urlMatch = String(text || '').match(/https?:\/\/[^\s'"]+|\/[A-Za-z0-9/_.-]+/);
  const paramMatch = t.match(/(?:param|parameter|field|input)\s*[:=]?\s*([a-z0-9_]+)/);
  return {
    raw: String(text || ''),
    technique: technique || 'headers',
    target: urlMatch ? urlMatch[0] : '',
    param: paramMatch ? paramMatch[1] : '',
    confidence: technique ? 'parsed' : 'fallback',
  };
}

/* --- 51474 · voice test requests --------------------------------------------------- */

export function normalizeVoiceTranscript(text) {
  return String(text || '')
    .replace(/\b(uh|um|er|ah)\b[,.\s]*/gi, '')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^please\s+/i, '');
}

/* --- 51454 · wizard --------------------------------------------------------------- */

export const WIZARD_STEPS = ['target', 'technique', 'confirm'];

export function validateWizardStep(step, data) {
  const d = data || {};
  if (step === 'target') return { ok: Boolean(d.target), missing: d.target ? [] : ['target'] };
  if (step === 'technique') return { ok: Boolean(lookupTechnique(d.technique)), missing: d.technique ? [] : ['technique'] };
  if (step === 'confirm') return { ok: Boolean(d.target && d.technique && d.acknowledged), missing: [] };
  return { ok: false, missing: ['unknown-step'] };
}

/* --- 51455 · targeting picker ------------------------------------------------------- */

export function buildTargetDescriptor({ url, form, param }) {
  const parts = [];
  if (url) parts.push(String(url));
  if (form) parts.push(`form:${form}`);
  if (param) parts.push(`param:${param}`);
  return { descriptor: parts.join(' '), url: url || '', form: form || '', param: param || '' };
}

/* --- 51457 · custom payload ---------------------------------------------------------- */

const PAYLOAD_FORBIDDEN = [/rm\s+-rf/, /:\(\)\{/, /shutdown/, /mkfs/, /dd\s+if=/];

export function validatePayload(payload) {
  const p = String(payload || '');
  const issues = [];
  if (!p.trim()) issues.push('Payload is empty.');
  if (p.length > 4096) issues.push('Payload is longer than 4096 characters.');
  if (PAYLOAD_FORBIDDEN.some((re) => re.test(p))) issues.push('Payload contains a destructive pattern and is blocked.');
  return { ok: issues.length === 0, issues };
}

/* --- 51458 · priority ----------------------------------------------------------------- */

export const PRIORITIES = ['low', 'normal', 'urgent'];

export function priorityWeight(priority) {
  return { low: 1, normal: 2, urgent: 5 }[String(priority || 'normal')] ?? 2;
}

/* --- 51459/51460 · queue --------------------------------------------------------------- */

export const TEST_STATUSES = ['queued', 'running', 'done', 'cancelled', 'failed'];

export function enqueueTest(queue, test) {
  const id = `tq-${queue.length + 1}`;
  const entry = {
    id,
    status: 'queued',
    priority: test.priority || 'normal',
    technique: test.technique || 'headers',
    target: test.target || '',
    param: test.param || '',
    note: test.note || '',
    created: test.created || 'manual',
  };
  return [...queue, entry];
}

export function queueStatus(queue) {
  const counts = {};
  TEST_STATUSES.forEach((s) => { counts[ s ] = 0; });
  (queue || []).forEach((t) => { counts[ t.status ] = (counts[ t.status ] || 0) + 1; });
  return { total: (queue || []).length, counts };
}

export function cancelTest(queue, id) {
  return (queue || []).map((t) => {
    if (t.id !== id) return t;
    if (t.status === 'done' || t.status === 'failed') return t;
    return { ...t, status: 'cancelled' };
  });
}

/* --- 51461/51471 · result alerts + explanations ----------------------------------------- */

export function explainResult(result) {
  const r = result || {};
  if (r.vulnerable) return `Vulnerable — ${r.technique || 'the test'} confirmed the issue at ${r.target || 'the target'}. See the evidence tab for proof.`;
  if (r.error) return `The test errored (${r.error}) — not a finding, needs a re-run.`;
  return `Not vulnerable — ${r.technique || 'the test'} ran clean at ${r.target || 'the target'} with no weakness found.`;
}

export function resultAlert(test, result) {
  return {
    title: `Test ${test.id} finished`,
    verdict: explainResult(result),
    severity: result && result.vulnerable ? 'attention' : 'info',
  };
}

/* --- 51462 · cost preview --------------------------------------------------------------- */

export const MS_PER_REQUEST = 900;

export function estimateTestCost(test) {
  const tech = lookupTechnique(test.technique) || { requests: 10, risk: 'low' };
  const multiplier = priorityWeight(test.priority) >= 5 ? 1 : 1;
  const requests = tech.requests * multiplier;
  const seconds = Math.round((requests * MS_PER_REQUEST) / 1000);
  return {
    requests,
    seconds,
    label: `≈${requests} requests, about ${seconds}s`,
  };
}

/* --- 51463 · safety check --------------------------------------------------------------- */

const RISKY_TECHNIQUES = new Set(['ssrf', 'idor']);

export function safetyCheck(test) {
  const warnings = [];
  const tech = lookupTechnique(test.technique);
  if (tech && RISKY_TECHNIQUES.has(tech.id)) warnings.push(`${tech.name} can touch other systems — confirm the target is in scope.`);
  if (test.payload && !validatePayload(test.payload).ok) warnings.push('Custom payload failed validation.');
  if (!test.target) warnings.push('No target set — the test cannot run yet.');
  return { safe: warnings.length === 0, warnings };
}

/* --- 51464 · approval routing -------------------------------------------------------------- */

export function routeForApproval(test) {
  const tech = lookupTechnique(test.technique) || { risk: 'low' };
  const needsApproval = tech.risk === 'medium' || priorityWeight(test.priority) >= 5 || Boolean(test.payload);
  return {
    needsApproval,
    tier: !needsApproval ? 'auto' : tech.risk === 'medium' ? 'security-lead' : 'standard',
  };
}

/* --- 51465 · templates ---------------------------------------------------------------------- */

export function saveTemplate(store, name, test) {
  const key = String(name || '').trim();
  if (!key) return { ok: false, error: 'Template needs a name.' };
  return { ok: true, store: { ...store, [key]: { ...test } } };
}

export function applyTemplate(store, name, overrides) {
  const base = store[String(name)];
  if (!base) return { ok: false, error: `No template named "${name}".` };
  return { ok: true, test: { ...base, ...(overrides || {}) } };
}

/* --- 51466 · chaining -------------------------------------------------------------------------- */

export function chainTests(first, condition, followUp) {
  return {
    first,
    condition: condition || 'if vulnerable',
    followUp,
    description: `Run "${followUp.technique}" on ${followUp.target} ${condition}.`,
  };
}

/* --- 51467 · scheduling --------------------------------------------------------------------------- */

export function scheduleTest(test, when) {
  return { ...test, scheduledFor: when || 'phase-end', scheduled: true };
}

/* --- 51468 · repetition ------------------------------------------------------------------------------- */

export function repeatTest(history, id, newTarget) {
  const prev = (history || []).find((t) => t.id === id);
  if (!prev) return { ok: false, error: `No test "${id}" in history.` };
  return { ok: true, test: { ...prev, id: undefined, target: newTarget || prev.target, status: 'queued', note: `Repeat of ${id}` } };
}

/* --- 51469 · comparison ---------------------------------------------------------------------------------- */

export function compareResults(results) {
  const rows = (results || []).map((r) => ({
    target: r.target || '—',
    technique: r.technique || '—',
    verdict: r.vulnerable ? 'vulnerable' : r.error ? 'error' : 'clean',
  }));
  const vulnerable = rows.filter((r) => r.verdict === 'vulnerable').length;
  return { rows, vulnerable, total: rows.length, summary: `${vulnerable} of ${rows.length} endpoints vulnerable` };
}

/* --- 51470 · notes ----------------------------------------------------------------------------------------- */

export function attachNote(test, note) {
  return { ...test, note: String(note || '') };
}

/* --- 51472 · evidence capture -------------------------------------------------------------------------------- */

export function captureEvidence(test, request, response) {
  return {
    testId: test.id || 'unsaved',
    technique: test.technique,
    target: test.target,
    request: request || null,
    response: response || null,
    captured: true,
  };
}

/* --- 51473 · sharing -------------------------------------------------------------------------------------------- */

export function shareTestLink(test) {
  const s = String(test.id || 'unsaved');
  const token = (typeof Buffer !== 'undefined'
    ? Buffer.from(s, 'utf8').toString('base64')
    : btoa(unescape(encodeURIComponent(s)))
  ).replace(/=+$/, '');
  return { token, path: `/tests/share/${token}`, reviewer: 'teammate' };
}

/* --- 51475 · history ------------------------------------------------------------------------------------------------ */

export function recordTestHistory(history, entry) {
  return [...(history || []), entry];
}

export function searchTestHistory(history, query) {
  const q = String(query || '').toLowerCase();
  if (!q) return history || [];
  return (history || []).filter((h) =>
    [h.id, h.technique, h.target, h.note].filter(Boolean).join(' ').toLowerCase().includes(q),
  );
}

/* --- 51476 · suggestion engine --------------------------------------------------------------------------------------- */

const SUGGEST_RULES = [
  { when: (f) => /login|auth|session/i.test(f.location || ''), suggest: 'idor', why: 'Auth-adjacent surface — check object-level access.' },
  { when: (f) => /sql/i.test(f.type || ''), suggest: 'sqli', why: 'SQLi signal — probe related inputs.' },
  { when: () => true, suggest: 'headers', why: 'Baseline hardening check for any surface.' },
];

export function suggestTests(findings, max) {
  const out = [];
  (findings || []).forEach((f) => {
    SUGGEST_RULES.forEach((rule) => {
      if (rule.when(f) && out.length < (max || 5)) {
        out.push({ technique: rule.suggest, target: f.location || '', why: rule.why, for: f.id });
      }
    });
  });
  return out.slice(0, max || 5);
}

/* --- 51477 · bulk -------------------------------------------------------------------------------------------------------- */

export function bulkRequests(targets, technique) {
  return (targets || []).map((t, i) => ({
    technique: technique || 'headers',
    target: typeof t === 'string' ? t : t.url || '',
    priority: 'normal',
    batchIndex: i,
  }));
}

/* --- 51478 · tuning ----------------------------------------------------------------------------------------------------------- */

const TUNE_BOUNDS = {
  depth: [1, 5],
  payloadCount: [1, 500],
  timeoutMs: [1000, 120000],
};

export function tuneParams(test, tuning) {
  const t = { ...(tuning || {}) };
  const clamped = {};
  for (const [key, [min, max]] of Object.entries(TUNE_BOUNDS)) {
    if (key in t) clamped[ key ] = Math.max(min, Math.min(max, Number(t[ key ]) || min));
  }
  return { ...test, tuning: { depth: 2, payloadCount: 50, timeoutMs: 30000, ...clamped } };
}

/* --- 51479 · sandbox -------------------------------------------------------------------------------------------------------------- */

export function sandboxReplica(test) {
  return {
    replicaOf: test.id || 'unsaved',
    target: `${test.target || ''} (sandbox replica)`,
    isolated: true,
    network: 'egress-blocked',
  };
}

export function isSandboxSafe(test) {
  const sc = safetyCheck(test);
  return sc.safe || sc.warnings.every((w) => !/destructive/i.test(w));
}

/* --- 51480 · dry-run ------------------------------------------------------------------------------------------------------------------- */

export function dryRun(test) {
  const tech = lookupTechnique(test.technique) || { name: test.technique, requests: 10 };
  const cost = estimateTestCost(test);
  const safety = safetyCheck(test);
  const route = routeForApproval(test);
  return {
    technique: tech.name,
    target: test.target || '(no target)',
    param: test.param || '—',
    payload: test.payload ? `${String(test.payload).length} chars` : 'built-in payloads',
    cost,
    safety,
    approval: route,
    willSend: safety.safe && !route.needsApproval
      ? 'Yes — safe and auto-approved.'
      : 'No — resolve the warnings or get approval first.',
  };
}
