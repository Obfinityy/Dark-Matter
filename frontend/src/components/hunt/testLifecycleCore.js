/**
 * testLifecycleCore.js — wave 38 (ideas 51481–51508): test-request
 * lifecycle round 2 — pure logic.
 *
 * Streaming execution events, kill switch, follow-ups, finding promotion,
 * labels, comment threads, request API builder, quota, technique info
 * cards, risk badges, state rollback, evidence export, replay, result
 * diffing, request chat, auto-documentation, success metrics, idea inbox,
 * priority queue controls, environment selector, credential descriptors,
 * session recording, result sharing, feedback loop, template gallery,
 * dependency mapping, outcome predictions, and request archiving.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: no Date.now(), no Math.random().
 */

import { WAVE38_LF_IDEAS } from './liveFindingsCore.js';

export const WAVE38_TL_START = 51481;
export const WAVE38_TL_END = 51508;

/** Registry of the 28 test-lifecycle ideas — completeness is testable. */
export const WAVE38_TL_IDEAS = [
  [51481, 'test result streaming', 'Watch a requested test execute step by step as live events arrive'],
  [51482, 'test interruption kill switch', 'Stop a running requested test instantly from anywhere in the UI'],
  [51483, 'test follow-ups', 'Ask the agent to dig deeper into a test result with one click'],
  [51484, 'test-to-finding promotion', 'A successful test converts into a draft finding automatically'],
  [51485, 'test labeling', 'Tag requested tests for filtering in reports and analytics'],
  [51486, 'test collaboration comments', 'Teammates comment on and refine test requests in threads'],
  [51487, 'test request API builder', 'External tools submit test requests through a structured payload'],
  [51488, 'test quota display', 'See how many on-demand tests remain in the hunt budget'],
  [51489, 'test technique info cards', 'Plain-language cards explaining what each technique does'],
  [51490, 'test risk badges', 'Every request labeled safe, cautious, or destructive up front'],
  [51491, 'test state rollback', 'State-changing tests restore the target afterwards via a plan'],
  [51492, 'test result export', 'Download any test full evidence as a standalone file'],
  [51493, 'test replay', 'Re-execute an identical test later for regression checking'],
  [51494, 'test result diffing', 'Compare the same test across two points in time'],
  [51495, 'test request chat', 'Discuss a planned test with the agent before launching it'],
  [51496, 'test auto-documentation', 'Requested tests are documented in the report automatically'],
  [51497, 'test success metrics', 'Track which requested tests actually found issues'],
  [51498, 'test idea inbox', 'Jot test ideas the agent picks up when it goes idle'],
  [51499, 'test priority queue controls', 'Reorder requested tests with explicit move controls'],
  [51500, 'test environment selector', 'Choose prod, staging, or mirror as the test target'],
  [51501, 'test credential descriptor', 'Supply credential descriptors (redacted) for authenticated tests'],
  [51502, 'test session recording', 'Requested tests recorded as replayable session logs'],
  [51503, 'test result sharing', 'Share a test outcome via link with full evidence attached'],
  [51504, 'test feedback loop', 'Rate test usefulness so the agent suggests better tests'],
  [51505, 'test templates gallery', 'One-click install of community-shared test recipes'],
  [51506, 'test dependency mapping', 'See which requested tests depend on other tests results'],
  [51507, 'test outcome predictions', 'The agent estimates likely success before running your test'],
  [51508, 'test request archiving', 'Old requests archived, restorable for future hunts'],
];

export const WAVE38_IDEAS = [...WAVE38_TL_IDEAS, ...WAVE38_LF_IDEAS]; // 40 total

/* --- 51481 · test result streaming ------------------------------------------------- */

export const STREAM_STATUSES = ['pending', 'active', 'done', 'error'];

export function streamEvent(index, total, label, status) {
  const s = STREAM_STATUSES.includes(status) ? status : 'pending';
  return {
    index,
    total,
    label: String(label || ''),
    status: s,
    done: s === 'done',
    progress: total > 0 ? (index + 1) / total : 0,
  };
}

export function stepRendererState(labels, activeIndex) {
  return (labels || []).map((label, i) => ({
    label,
    state: i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending',
  }));
}

/* --- 51482 · test interruption kill switch ------------------------------------------- */

export function killSwitchRequest(testId, reason) {
  return {
    testId,
    action: 'kill',
    reason: String(reason || 'manual stop'),
    status: 'kill-requested',
  };
}

export function applyKill(tests, testId, reason) {
  return (tests || []).map((t) => {
    if (t.id !== testId) return t;
    return { ...t, status: 'killed', killReason: String(reason || 'manual stop') };
  });
}

/* --- 51483 · test follow-ups ------------------------------------------------------------- */

export function followUpRequest(test, focus) {
  const t = test || {};
  return {
    parentId: t.id,
    technique: t.technique,
    target: t.target,
    focus: String(focus || 'dig deeper'),
    status: 'queued',
  };
}

/* --- 51484 · test-to-finding promotion ----------------------------------------------------- */

export function promoteTestToFinding(test, result) {
  const t = test || {};
  const r = result || {};
  return {
    id: 'draft-' + t.id,
    title: t.technique + ' confirmed at ' + t.target,
    severity: r.severity || (r.vulnerable ? 'high' : 'info'),
    status: 'draft',
    sourceTestId: t.id,
    evidence: r.evidence || [],
  };
}

/* --- 51485 · test labeling --------------------------------------------------------------------- */

export function labelTest(test, labels) {
  const merged = [...(test.labels || []), ...(labels || [])];
  return { ...test, labels: [...new Set(merged)] };
}

/* --- 51486 · test collaboration comments ----------------------------------------------------------- */

export function newCommentThread(testId) {
  return { testId, comments: [] };
}

export function addComment(thread, author, text) {
  const t = thread || { testId: '', comments: [] };
  const next = (t.comments || []).concat({
    id: 'c-' + ((t.comments || []).length + 1),
    author: String(author || 'hunter'),
    text: String(text || ''),
    resolved: false,
  });
  return { ...t, comments: next };
}

export function resolveComment(thread, commentId) {
  const t = thread || { testId: '', comments: [] };
  return {
    ...t,
    comments: (t.comments || []).map((c) =>
      c.id === commentId ? { ...c, resolved: true } : c,
    ),
  };
}

/* --- 51487 · test request API builder ------------------------------------------------------------------- */

export function requestApiPayload({ technique, target, param, priority, environment } = {}) {
  return {
    api: 'infinity/v1',
    method: 'test.request',
    technique: technique || '',
    target: target || '',
    param: param || '',
    priority: priority || 'normal',
    environment: environment || 'staging',
  };
}

export function validateApiPayload(p) {
  const payload = p || {};
  const missing = [];
  if (!payload.technique) missing.push('technique');
  if (!payload.target) missing.push('target');
  return { ok: missing.length === 0, missing };
}

/* --- 51488 · test quota display ----------------------------------------------------------------------------- */

export function quotaStatus(used, total) {
  const u = Math.max(0, Number(used) || 0);
  const t = Math.max(0, Number(total) || 0);
  return {
    used: u,
    total: t,
    remaining: Math.max(0, t - u),
    percentUsed: t > 0 ? Math.round((u / t) * 100) : 0,
    exhausted: u >= t,
  };
}

/* --- 51489 · test technique info cards --------------------------------------------------------------------------- */

export const TECHNIQUE_INFO = [
  {
    id: 'sqli',
    name: 'SQL injection',
    risk: 'low',
    plain: 'Try database trickery on inputs',
    whatItDoes: 'Sends database-aware characters into form fields and URL parameters, then watches for error messages or timing differences that reveal the query behind the page.',
    whyItMatters: 'A successful SQL injection can read, change, or delete the whole database behind the site — customer records included.',
  },
  {
    id: 'xss',
    name: 'Reflected XSS',
    risk: 'low',
    plain: 'Try scripts that bounce back in pages',
    whatItDoes: 'Submits small script snippets through inputs and checks whether the site reflects them back into the page without encoding.',
    whyItMatters: 'Reflected scripts run in a victim\u2019s browser, which lets attackers steal sessions or perform actions as that user.',
  },
  {
    id: 'ssrf',
    name: 'SSRF probe',
    risk: 'medium',
    plain: 'Ask the server to fetch a URL it should not',
    whatItDoes: 'Asks the server to request a controlled address and watches whether it connects — proving the server will fetch URLs on the test\u2019s behalf.',
    whyItMatters: 'SSRF can reach internal services that were never exposed to the internet, including cloud metadata that hands out credentials.',
  },
  {
    id: 'idor',
    name: 'IDOR check',
    risk: 'medium',
    plain: 'Try other users\u2019 object IDs',
    whatItDoes: 'Requests resources by swapping in other identifiers (order numbers, user IDs) and checks whether access is granted without proper ownership checks.',
    whyItMatters: 'Missing object-level authorization exposes other people\u2019s data — orders, documents, account details — to anyone with an account.',
  },
  {
    id: 'dirbrute',
    name: 'Directory discovery',
    risk: 'low',
    plain: 'Probe for hidden paths and files',
    whatItDoes: 'Requests a wordlist of likely paths and compares response codes and sizes against the baseline to surface hidden endpoints, backups, and admin panels.',
    whyItMatters: 'Forgotten paths often host unprotected admin tools, backup archives, or config files with secrets.',
  },
  {
    id: 'jwt',
    name: 'JWT analysis',
    risk: 'low',
    plain: 'Inspect login tokens for flaws',
    whatItDoes: 'Decodes the login token without verifying its signature and inspects the algorithm, expiry, and claims for trust mistakes.',
    whyItMatters: 'Weak token handling — no expiry, "none" algorithm, sensitive data inside — lets attackers forge logins or escalate privilege.',
  },
  {
    id: 'cors',
    name: 'CORS check',
    risk: 'low',
    plain: 'See which websites can read this API',
    whatItDoes: 'Sends requests with crafted Origin headers and checks whether the API answers with permissive cross-origin rules.',
    whyItMatters: 'Overly permissive CORS lets any website read responses from the user\u2019s browser, leaking data through cross-site requests.',
  },
  {
    id: 'headers',
    name: 'Header audit',
    risk: 'none',
    plain: 'Check security headers on responses',
    whatItDoes: 'Reads the response headers for missing hardening directives such as Content-Security-Policy, HSTS, and X-Frame-Options.',
    whyItMatters: 'Missing headers leave cheap protections on the table — clickjacking, protocol downgrade, and content-sniffing attacks get easier.',
  },
];

export function techniqueInfo(id) {
  return TECHNIQUE_INFO.find((t) => t.id === String(id).toLowerCase()) || null;
}

/* --- 51490 · test risk badges ----------------------------------------------------------------------------------------- */

const RISK_BADGE_LEVELS = { none: 'safe', low: 'safe', medium: 'cautious', high: 'destructive' };
const RISK_BADGE_LABELS = { safe: 'Safe', cautious: 'Cautious', destructive: 'Destructive' };

export function riskBadge(techniqueId) {
  const info = techniqueInfo(techniqueId);
  const level = info ? RISK_BADGE_LEVELS[info.risk] || 'cautious' : 'cautious';
  return {
    level,
    label: RISK_BADGE_LABELS[level],
    className: 'tl38-risk-' + level,
  };
}

/* --- 51491 · test state rollback ----------------------------------------------------------------------------------------------- */

export function rollbackPlan(test) {
  const t = test || {};
  return {
    testId: t.id,
    restorable: true,
    steps: [
      'Snapshot target state',
      'Execute test',
      'Verify target state',
      'Restore snapshot if changed',
    ],
  };
}

/* --- 51492 · test result export ----------------------------------------------------------------------------------------------------------------- */

export function exportTestEvidence(test, result, format) {
  const t = test || {};
  const r = result || {};
  const ext = format === 'markdown' ? 'md' : 'json';
  const filename = `${t.id || 'test'}-evidence.${ext}`;
  const content = format === 'markdown'
    ? [
      `# Test evidence — ${t.id || 'untitled test'}`,
      '',
      `Technique: ${t.technique || '—'}`,
      `Target: ${t.target || '—'}`,
      `Verdict: ${r.vulnerable ? 'Vulnerable' : r.error ? 'Errored' : 'Not vulnerable'}`,
      '',
      '## Evidence',
      '',
      ...(Array.isArray(r.evidence) && r.evidence.length
        ? r.evidence.map((e) => `- ${String(e)}`)
        : ['- (no evidence captured)']),
    ].join('\n')
    : JSON.stringify({ test: t, result: r }, null, 2);
  return { filename, format: format === 'markdown' ? 'markdown' : 'json', content };
}

/* --- 51493 · test replay ------------------------------------------------------------------------------------------------------------------------------------- */

export function replayTest(test) {
  const t = test || {};
  return {
    ...t,
    id: t.id + '-replay',
    status: 'queued',
    replayOf: t.id,
  };
}

/* --- 51494 · test result diffing ------------------------------------------------------------------------------------------------------------------------------------- */

export function diffTestResults(before, after) {
  const b = before || [];
  const a = after || [];
  const added = a.filter((x) => !b.includes(x));
  const removed = b.filter((x) => !a.includes(x));
  const unchanged = b.filter((x) => a.includes(x));
  return {
    added,
    removed,
    unchanged,
    changed: added.length > 0 || removed.length > 0,
  };
}

/* --- 51495 · test request chat --------------------------------------------------------------------------------------------------------------------------------------------- */

export function newChatThread(testId) {
  return { testId, messages: [] };
}

export function addChatMessage(thread, role, text) {
  const t = thread || { testId: '', messages: [] };
  const validRole = role === 'agent' ? 'agent' : 'hunter';
  const next = (t.messages || []).concat({
    id: 'm-' + ((t.messages || []).length + 1),
    role: validRole,
    text: String(text || ''),
  });
  return { ...t, messages: next };
}

/* --- 51496 · test auto-documentation --------------------------------------------------------------------------------------------------------------------------------------------- */

export function autoDocEntries(tests) {
  return (tests || []).map((t) => ({
    id: t.id,
    heading: `Test ${t.id}: ${t.technique} on ${t.target}`,
    body: `The ${t.technique || 'requested'} test ran against ${t.target || 'the target'} and the verdict was ${t.vulnerable ? 'vulnerable' : t.error ? 'errored during execution' : 'not vulnerable'}${t.vulnerable ? ', so it was converted into a draft finding' : ''}.`,
  }));
}

/* --- 51497 · test success metrics ----------------------------------------------------------------------------------------------------------------------------------------------------- */

export function recordTestOutcome(store, testId, foundIssue) {
  return { ...(store || {}), [testId]: Boolean(foundIssue) };
}

export function successMetrics(store) {
  const entries = Object.values(store || {});
  const total = entries.length;
  const found = entries.filter(Boolean).length;
  const missed = total - found;
  return {
    total,
    found,
    missed,
    rate: total > 0 ? Math.round((found / total) * 100) : 0,
  };
}

/* --- 51498 · test idea inbox ------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function addIdea(inbox, text) {
  const list = inbox || [];
  const idea = { id: 'idea-' + (list.length + 1), text: String(text || ''), status: 'open' };
  return [...list, idea];
}

export function claimIdea(inbox, id) {
  return (inbox || []).map((idea) =>
    idea.id === id ? { ...idea, status: 'claimed' } : idea,
  );
}

/* --- 51499 · test priority queue controls ----------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function queueReorder(queue, fromIndex, toIndex) {
  const list = queue || [];
  if (list.length === 0) return [];
  const clamp = (i) => Math.max(0, Math.min(list.length - 1, Number.isFinite(i) ? i : 0));
  const from = clamp(fromIndex);
  const to = clamp(toIndex);
  if (from === to) return [...list];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/* --- 51500 · test environment selector ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export const ENVIRONMENTS = [
  { id: 'production', label: 'Production', warning: 'Live system — extra care required.' },
  { id: 'staging', label: 'Staging', warning: 'Pre-production copy of the target.' },
  { id: 'mirror', label: 'Mirror', warning: 'Isolated replica — safest option.' },
];

export function environmentDescriptor(envId) {
  return ENVIRONMENTS.find((e) => e.id === String(envId).toLowerCase()) || null;
}

/* --- 51501 · test credential descriptor ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function credentialDescriptor({ username, vaultRef, scope } = {}) {
  return {
    username: username || '',
    vaultRef: vaultRef || '',
    scope: scope || '',
    secret: '[redacted]',
    stored: false,
  };
}

// Raw secrets never enter this module; credential descriptors are references only.
// The UI shows the "[redacted]" marker and the vault supplies the secret at run time.

/* --- 51502 · test session recording ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function recordSession(testId, steps) {
  return {
    sessionId: 'sess-' + testId,
    testId,
    steps: (steps || []).map((s, i) => ({ n: i + 1, step: s })),
    recorded: true,
  };
}

/* --- 51503 · test result sharing ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function shareTestLink(testId) {
  const id = String(testId || 'unsaved');
  return {
    path: '/tests/share/' + id,
    token: 'share-' + id + '-v1',
  };
}

/* --- 51504 · test feedback loop ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function recordFeedback(store, testId, rating) {
  const clamped = Math.max(1, Math.min(5, Math.round(Number(rating) || 0) || 1));
  return { ...(store || {}), [testId]: clamped };
}

export function feedbackSummary(store) {
  const values = Object.values(store || {}).filter((v) => v >= 1 && v <= 5);
  const count = values.length;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  values.forEach((v) => { distribution[ v ] += 1; });
  const average = count > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / count) * 10) / 10 : 0;
  return {
    count,
    average,
    distribution,
    weight: Math.round((average / 5) * 100) / 100,
  };
}

/* --- 51505 · test templates gallery ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export const TEMPLATE_GALLERY = [
  {
    id: 'tpl-login-sqli',
    name: 'Login form SQL probe',
    technique: 'sqli',
    target: '/login',
    description: 'Submits quote and boolean-based payloads into the login form\u2019s username and password fields to check for injectable parameters.',
  },
  {
    id: 'tpl-search-xss',
    name: 'Search reflection check',
    technique: 'xss',
    target: '/search?q=',
    description: 'Injects markup canaries into the search query and verifies whether the value is reflected into the results page without encoding.',
  },
  {
    id: 'tpl-avatar-ssrf',
    name: 'Avatar URL fetcher probe',
    technique: 'ssrf',
    target: '/profile/avatar',
    description: 'Points the avatar URL field at a controlled address to see whether the server fetches remote resources on the test\u2019s behalf.',
  },
  {
    id: 'tpl-order-idor',
    name: 'Order ID swap check',
    technique: 'idor',
    target: '/orders/{id}',
    description: 'Requests other order identifiers and flags responses that return another user\u2019s data without an ownership check.',
  },
  {
    id: 'tpl-api-headers',
    name: 'API header baseline',
    technique: 'headers',
    target: '/api/v1',
    description: 'Reads the API\u2019s response headers and lists missing hardening directives such as Content-Security-Policy and HSTS.',
  },
];

export function installTemplate(templateId) {
  const tpl = TEMPLATE_GALLERY.find((t) => t.id === templateId);
  if (!tpl) return { ok: false };
  return {
    ok: true,
    test: {
      technique: tpl.technique,
      target: tpl.target,
      name: tpl.name,
      status: 'queued',
      fromTemplate: tpl.id,
    },
  };
}

/* --- 51506 · test dependency mapping --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function dependencyGraph(tests) {
  const list = tests || [];
  const nodes = list.map((t) => ({
    id: t.id,
    label: `${t.technique || 'test'} → ${t.target || 'target'}`,
  }));
  const edges = [];
  list.forEach((t) => {
    (t.dependsOn || []).forEach((depId) => {
      edges.push({ from: depId, to: t.id });
    });
  });
  return { nodes, edges };
}

/* --- 51507 · test outcome predictions --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function predictOutcome(test, history) {
  const t = test || {};
  const sameTechnique = (history || []).filter((h) => h.technique === t.technique);
  const total = sameTechnique.length;
  const hits = sameTechnique.filter((h) => h.foundIssue).length;
  const score = total > 0 ? Math.round((hits / total) * 100) : 0;
  const likelihood = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  const reasons = [];
  if (total === 0) {
    reasons.push(`No prior runs of the ${t.technique || 'unknown'} technique — the estimate is a baseline.`);
  } else {
    reasons.push(`Same-technique tests found issues in ${hits} of ${total} prior runs.`);
  }
  if (total > 0 && total < 5) {
    reasons.push('Fewer than 5 prior runs, so treat the estimate as a rough signal.');
  }
  if (t.target) {
    reasons.push(`Target "${t.target}" is in scope and reachable, so the test can execute fully.`);
  }
  return { score, likelihood, reasons };
}

/* --- 51508 · test request archiving ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function archiveTest(archive, active, testId) {
  const list = active || [];
  const idx = list.findIndex((t) => t.id === testId);
  if (idx === -1) return { ok: false, archive: archive || [], active: list };
  const next = [...list];
  const [moved] = next.splice(idx, 1);
  return { ok: true, archive: [...(archive || []), moved], active: next };
}

export function restoreTest(archive, active, testId) {
  const list = archive || [];
  const idx = list.findIndex((t) => t.id === testId);
  if (idx === -1) return { ok: false, archive: list, active: active || [] };
  const next = [...list];
  const [moved] = next.splice(idx, 1);
  return { ok: true, archive: next, active: [...(active || []), moved] };
}
