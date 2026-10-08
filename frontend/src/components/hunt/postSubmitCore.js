/**
 * postSubmitCore.js — Infinity AI · Dark-Matter · Wave 59 (ideas 52321–52340)
 * Pure JS (no React / DOM / network). Deterministic post-hunt submission
 * lifecycle models: remediation inserts, researcher branding, batch drafts,
 * submission queues, platform inbox sync, status-change sync, bounty-paid
 * tracking, safe-harbor checks, out-of-scope warnings, PII scrubbing,
 * internal review queues, approval chains, history logs, resubmission,
 * message templates, triager replies, mediation drafts, disclosure timelines,
 * coordinated-disclosure scheduling and CVE request drafts. Time is injected
 * via `now` params (default Date.now()) so every function is reproducible.
 */

export const WAVE59_PS_IDEAS = [
  { id: 52321, title: 'Remediation suggestion insert', skip: false },
  { id: 52322, title: 'Researcher handle branding', skip: false },
  { id: 52323, title: 'Batch draft creation (grouped per platform)', skip: false },
  { id: 52324, title: 'Submission queue with priority/owner/scheduled send times', skip: false },
  { id: 52325, title: 'Platform inbox sync', skip: false },
  { id: 52326, title: 'Status-change sync (platform triaged/duplicate/informative)', skip: false },
  { id: 52327, title: 'Bounty-paid tracking (per finding/hunt/program/researcher)', skip: false },
  { id: 52328, title: 'Safe-harbor verification', skip: false },
  { id: 52329, title: 'Out-of-scope warning with override reason', skip: false },
  { id: 52330, title: 'PII scrub before submit', skip: false },
  { id: 52331, title: 'Internal review queue', skip: false },
  { id: 52332, title: 'Submitter approval chain (researcher → lead → legal)', skip: false },
  { id: 52333, title: 'Submission history log', skip: false },
  { id: 52334, title: 'Resubmission after fix', skip: false },
  { id: 52335, title: 'Platform message templates', skip: false },
  { id: 52336, title: 'Triager-question draft replies', skip: false },
  { id: 52337, title: 'Mediation escalation draft', skip: false },
  { id: 52338, title: 'Disclosure timeline tracker', skip: false },
  { id: 52339, title: 'Coordinated disclosure scheduler', skip: false },
  { id: 52340, title: 'CVE request draft', skip: false },
];

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `psn_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

/* 52321 — Remediation suggestion insert.
 * Appends a concise, correct fix recommendation to a submission draft. */
const REMEDIATION_RULES = [
  {
    match: ['xss', 'cross-site scripting'],
    fix: 'Apply context-aware output encoding (HTML, attribute, JS contexts) and deploy a strict Content-Security-Policy without unsafe-inline.',
  },
  {
    match: ['sql injection', 'sqli'],
    fix: 'Use parameterized queries / prepared statements exclusively; never concatenate user input into SQL. Apply least-privilege DB accounts.',
  },
  {
    match: ['idor', 'insecure direct object'],
    fix: 'Enforce server-side authorization checks on every object reference; use unpredictable, unguessable identifiers.',
  },
  {
    match: ['ssrf', 'server-side request forgery'],
    fix: 'Validate and allow-list outbound destinations; block metadata endpoints (e.g. 169.254.169.254) at the network layer.',
  },
  {
    match: ['csrf', 'cross-site request forgery'],
    fix: 'Require anti-CSRF tokens on all state-changing endpoints and enforce SameSite=Lax/Strict cookies.',
  },
  {
    match: ['rce', 'remote code execution', 'command injection'],
    fix: 'Avoid shell invocation with user input entirely; use safe APIs. If unavoidable, apply strict allow-list validation and run with least privilege.',
  },
  {
    match: ['open redirect'],
    fix: 'Validate redirect targets against an allow-list of relative paths; reject absolute URLs not on the allow-list.',
  },
  {
    match: ['jwt'],
    fix: 'Pin the signing algorithm server-side, reject "none", enforce expiry and audience checks.',
  },
  {
    match: ['cors'],
    fix: 'Never reflect Origin with Access-Control-Allow-Credentials; use an explicit origin allow-list.',
  },
  {
    match: ['secret', 'api key', 'credential', 'hardcoded'],
    fix: 'Rotate the exposed credential immediately and move it to a secrets manager; audit access logs for misuse.',
  },
];

export function suggestRemediation(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const hay =
    `${finding.title || ''} ${finding.description || ''} ${finding.vulnClass || ''}`.toLowerCase();
  const rule = REMEDIATION_RULES.find(r => r.match.some(m => hay.includes(m)));
  const remediation =
    finding.remediation ||
    (rule ? rule.fix : 'Remediate per vendor hardening guidance and retest before closure.');
  return { ok: true, remediation, fromTemplate: !finding.remediation && Boolean(rule) };
}

export function insertRemediation(draft, remediation) {
  if (!draft || typeof draft !== 'object') return { ok: false, reason: 'draft object required' };
  if (typeof remediation !== 'string' || remediation.length === 0) {
    return { ok: false, reason: 'remediation text required' };
  }
  return {
    ok: true,
    draft: { ...draft, remediation, remediationSource: 'infinity-ai-suggestion' },
  };
}

/* 52322 — Researcher handle branding.
 * Apply the researcher's handle and profile links consistently across drafts. */
export function applyResearcherBranding(draft, researcher) {
  if (!draft || typeof draft !== 'object') return { ok: false, reason: 'draft object required' };
  if (!researcher || !researcher.handle)
    return { ok: false, reason: 'researcher with handle required' };
  const signature = [
    `— ${researcher.handle}`,
    ...(Array.isArray(researcher.profileLinks) ? researcher.profileLinks : []),
  ].join('\n');
  return {
    ok: true,
    draft: {
      ...draft,
      researcher: {
        handle: researcher.handle,
        name: researcher.name || null,
        profileLinks: Array.isArray(researcher.profileLinks) ? [...researcher.profileLinks] : [],
      },
      signature,
    },
  };
}

/* 52323 — Batch draft creation: drafts for many findings at once, grouped per platform. */
export function createBatchDrafts(findings, platforms, buildDraft, now = Date.now()) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return { ok: false, reason: 'findings array required' };
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return { ok: false, reason: 'platforms array required' };
  }
  if (typeof buildDraft !== 'function')
    return { ok: false, reason: 'buildDraft function required' };
  const grouped = {};
  const errors = [];
  for (const platform of platforms) {
    grouped[platform] = [];
    for (const finding of findings) {
      const r = buildDraft(finding, platform, now);
      if (r && r.ok) grouped[platform].push({ findingId: finding.id, draft: r.draft || r });
      else
        errors.push({
          findingId: finding && finding.id,
          platform,
          reason: (r && r.reason) || 'buildDraft failed',
        });
    }
  }
  const batch = {
    id: `batch_${tokenFor('batch', `${findings.length}:${platforms.join(',')}`, now)}`,
    createdAt: now,
    platforms: [...platforms],
    grouped,
    errors,
    counts: Object.fromEntries(Object.entries(grouped).map(([p, ds]) => [p, ds.length])),
  };
  return { ok: true, batch };
}

/* 52324 — Submission queue: ordered pending submissions with priority, owner, scheduled send times. */
export function createSubmissionQueue(name, now = Date.now()) {
  if (!name) return { ok: false, reason: 'queue name required' };
  return {
    ok: true,
    queue: { id: `q_${tokenFor('q', name, now)}`, name, items: [], createdAt: now },
  };
}

function rankOf(entry) {
  return PRIORITY_RANK[entry.priority] !== undefined
    ? PRIORITY_RANK[entry.priority]
    : PRIORITY_RANK.normal;
}

export function enqueueSubmission(queue, entry = {}, now = Date.now()) {
  if (!queue || !queue.id) return { ok: false, reason: 'queue required' };
  if (!entry.draftId && !entry.findingId)
    return { ok: false, reason: 'draftId or findingId required' };
  const item = {
    id: `qi_${tokenFor('qi', `${queue.id}:${entry.draftId || entry.findingId}`, now)}`,
    draftId: entry.draftId || null,
    findingId: entry.findingId || null,
    platform: entry.platform || null,
    priority: PRIORITY_RANK[entry.priority] !== undefined ? entry.priority : 'normal',
    owner: entry.owner || null,
    scheduledSendAt: typeof entry.scheduledSendAt === 'number' ? entry.scheduledSendAt : null,
    state: 'queued',
    enqueuedAt: now,
  };
  const items = [...queue.items, item].sort((a, b) => {
    const r = rankOf(a) - rankOf(b);
    if (r !== 0) return r;
    const sa = a.scheduledSendAt == null ? Infinity : a.scheduledSendAt;
    const sb = b.scheduledSendAt == null ? Infinity : b.scheduledSendAt;
    return sa - sb;
  });
  return { ok: true, queue: { ...queue, items }, item };
}

export function dequeueDueSubmissions(queue, now = Date.now()) {
  if (!queue || !Array.isArray(queue.items)) return { ok: false, reason: 'queue required' };
  const due = queue.items.filter(
    i => i.state === 'queued' && (i.scheduledSendAt == null || i.scheduledSendAt <= now)
  );
  return { ok: true, due, remaining: queue.items.length - due.length };
}

/* 52325 — Platform inbox sync: pull report statuses + triager messages into the timeline. */
export const INBOX_MESSAGE_TYPES = ['status', 'triager-message', 'bounty', 'comment'];

export function syncPlatformInbox(state, messages = [], now = Date.now()) {
  if (!state || typeof state !== 'object') return { ok: false, reason: 'sync state required' };
  const seen = new Set(Array.isArray(state.syncedIds) ? state.syncedIds : []);
  const applied = [];
  for (const m of messages) {
    if (!m || !m.id || seen.has(m.id)) continue;
    if (!INBOX_MESSAGE_TYPES.includes(m.type)) continue;
    seen.add(m.id);
    applied.push({
      id: m.id,
      type: m.type,
      reportId: m.reportId || null,
      from: m.from || null,
      body: m.body || null,
      platformStatus: m.platformStatus || null,
      syncedAt: now,
    });
  }
  return {
    ok: true,
    state: { ...state, syncedIds: [...seen], lastSyncAt: now },
    applied,
    skipped: messages.length - applied.length,
  };
}

/* 52326 — Status-change sync: platform marks triaged/duplicate/informative → update lifecycle. */
const PLATFORM_STATUS_MAP = {
  triaged: { lifecycle: 'triaged', note: 'Platform confirmed the report as valid.' },
  duplicate: { lifecycle: 'duplicate', note: 'Platform marked the report as a duplicate.' },
  informative: { lifecycle: 'informative', note: 'Platform closed the report as informative.' },
  resolved: { lifecycle: 'resolved', note: 'Platform marked the report as resolved.' },
  'not-applicable': {
    lifecycle: 'not-applicable',
    note: 'Platform marked the report as not applicable.',
  },
};

export function applyStatusChange(finding, platformStatus, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const mapped = PLATFORM_STATUS_MAP[platformStatus];
  if (!mapped) return { ok: false, reason: `unknown platform status: ${platformStatus}` };
  return {
    ok: true,
    finding: {
      ...finding,
      lifecycle: mapped.lifecycle,
      platformStatus,
      lifecycleHistory: [
        ...(Array.isArray(finding.lifecycleHistory) ? finding.lifecycleHistory : []),
        { state: mapped.lifecycle, at: now, note: mapped.note, source: 'platform-sync' },
      ],
    },
  };
}

/* 52327 — Bounty-paid tracking: payouts per finding, rolled up per hunt/program/researcher. */
export function recordBountyPaid(ledger = [], payout = {}, now = Date.now()) {
  if (!payout.findingId) return { ok: false, reason: 'findingId required' };
  if (typeof payout.amount !== 'number' || payout.amount < 0) {
    return { ok: false, reason: 'non-negative amount required' };
  }
  const rows = Array.isArray(ledger) ? ledger : [];
  const entry = {
    id: `pay_${tokenFor('pay', `${payout.findingId}:${payout.program || 'x'}`, now)}`,
    findingId: payout.findingId,
    huntId: payout.huntId || null,
    program: payout.program || null,
    researcher: payout.researcher || null,
    amount: payout.amount,
    currency: payout.currency || 'USD',
    paidAt: typeof payout.paidAt === 'number' ? payout.paidAt : now,
    platform: payout.platform || null,
  };
  return { ok: true, ledger: [...rows, entry], entry };
}

export function rollUpEarnings(ledger = [], by = 'program') {
  const rows = Array.isArray(ledger) ? ledger : [];
  const keys = { program: 'program', hunt: 'huntId', researcher: 'researcher' };
  const field = keys[by];
  if (!field) return { ok: false, reason: 'by must be program|hunt|researcher' };
  const totals = {};
  for (const e of rows) {
    const key = e[field] || 'unassigned';
    if (!totals[key]) totals[key] = { total: 0, count: 0, currency: e.currency || 'USD' };
    totals[key].total += e.amount;
    totals[key].count += 1;
  }
  return {
    ok: true,
    by,
    totals,
    grandTotal: rows.reduce((a, e) => a + e.amount, 0),
    count: rows.length,
  };
}

/* 52328 — Safe-harbor verification: check program terms, warn before submitting edge cases. */
export function verifySafeHarbor(program, finding) {
  if (!program || !program.name) return { ok: false, reason: 'program with name required' };
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const terms = program.safeHarbor || {};
  const checks = [
    {
      id: 'harbor-stated',
      pass: terms.stated === true,
      detail: terms.stated
        ? 'Program states safe-harbor protection.'
        : 'Program does not state safe-harbor terms.',
    },
    {
      id: 'testing-within-scope',
      pass: terms.requiresScopeCompliance !== false,
      detail: 'Submission must stay within declared scope.',
    },
    {
      id: 'no-dos',
      pass: !(/denial|dos/i.test(finding.title || '') && terms.prohibitsDoS !== false),
      detail: 'DoS-style findings may fall outside harbor protection.',
    },
    {
      id: 'good-faith',
      pass: terms.goodFaithRequired !== false || true,
      detail: 'Good-faith testing expected.',
    },
  ];
  const failed = checks.filter(c => !c.pass);
  return {
    ok: true,
    safeHarbor: failed.length === 0,
    program: program.name,
    checks,
    warning: failed.length ? `Safe-harbor risk: ${failed.map(f => f.detail).join(' ')}` : null,
  };
}

/* 52329 — Out-of-scope warning: hard warning with an override reason trail. */
export function checkOutOfScope(finding, program, override = null, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  if (!program || !Array.isArray(program.inScope))
    return { ok: false, reason: 'program with inScope array required' };
  const asset = String(finding.endpoint || finding.url || finding.target || '');
  const inScope = program.inScope.some(entry => asset.includes(String(entry)));
  const excluded =
    Array.isArray(program.outOfScope) &&
    program.outOfScope.some(entry => asset.includes(String(entry)));
  const hardBlock = excluded || !inScope;
  if (hardBlock && (!override || !override.reason)) {
    return {
      ok: false,
      reason: 'OUT-OF-SCOPE: submission blocked — provide an override reason to proceed.',
      outOfScope: true,
      asset,
    };
  }
  return {
    ok: true,
    outOfScope: hardBlock,
    asset,
    override: hardBlock ? { reason: override.reason, by: override.by || null, at: now } : null,
    warning: hardBlock ? 'Proceeding with an explicit out-of-scope override.' : null,
  };
}

/* 52330 — PII scrub before submit: redact PII/secrets captured in evidence. */
const PII_PATTERNS = [
  { id: 'email', re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, token: '[EMAIL]' },
  { id: 'phone', re: /\+?\d[\d\s().-]{7,}\d/g, token: '[PHONE]' },
  { id: 'bearer', re: /Bearer\s+[A-Za-z0-9._~+/-]+=*?/g, token: 'Bearer [TOKEN]' },
  {
    id: 'api-key',
    re: /(api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}["']?/gi,
    token: 'api_key=[SECRET]',
  },
  { id: 'ssn-ish', re: /\b\d{3}-\d{2}-\d{4}\b/g, token: '[SSN]' },
  { id: 'card-ish', re: /\b(?:\d[ -]?){13,19}\b/g, token: '[CARD]' },
];

export function scrubPii(text) {
  if (typeof text !== 'string') return { ok: false, reason: 'text required' };
  let scrubbed = text;
  const hits = [];
  for (const p of PII_PATTERNS) {
    p.re.lastIndex = 0;
    const found = scrubbed.match(p.re);
    if (found && found.length) {
      hits.push({ id: p.id, count: found.length });
      scrubbed = scrubbed.replace(p.re, p.token);
    }
  }
  return {
    ok: true,
    scrubbed,
    redactions: hits,
    redactedCount: hits.reduce((a, h) => a + h.count, 0),
  };
}

/* 52331 — Internal review before submit: route drafts through a reviewer queue. */
export const REVIEW_STATES = ['queued', 'in-review', 'changes-requested', 'approved', 'blocked'];

export function createReviewQueue(name, now = Date.now()) {
  if (!name) return { ok: false, reason: 'queue name required' };
  return {
    ok: true,
    queue: { id: `rq_${tokenFor('rq', name, now)}`, name, items: [], createdAt: now },
  };
}

export function reviewReducer(queue, action = {}, now = Date.now()) {
  if (!queue || !queue.id) return { ok: false, reason: 'queue required' };
  switch (action.type) {
    case 'ADD': {
      if (!action.draftId) return { ok: false, reason: 'draftId required' };
      const item = {
        id: `ri_${tokenFor('ri', `${queue.id}:${action.draftId}`, now)}`,
        draftId: action.draftId,
        findingId: action.findingId || null,
        submittedBy: action.submittedBy || null,
        state: 'queued',
        reviewer: null,
        notes: [],
        history: [{ state: 'queued', at: now, by: action.submittedBy || null }],
      };
      return { ok: true, queue: { ...queue, items: [...queue.items, item] }, item };
    }
    case 'TRANSITION': {
      const items = queue.items.map(i => {
        if (i.id !== action.id) return i;
        if (!REVIEW_STATES.includes(action.to)) return i;
        const legal = {
          queued: ['in-review'],
          'in-review': ['changes-requested', 'approved', 'blocked'],
          'changes-requested': ['queued'],
          blocked: ['queued'],
        };
        if (!(legal[i.state] || []).includes(action.to)) return i;
        return {
          ...i,
          state: action.to,
          reviewer: action.by || i.reviewer,
          notes: action.note
            ? [...i.notes, { by: action.by || null, at: now, note: action.note }]
            : i.notes,
          history: [...i.history, { state: action.to, at: now, by: action.by || null }],
        };
      });
      return { ok: true, queue: { ...queue, items } };
    }
    default:
      return { ok: false, reason: `unknown action ${action.type}` };
  }
}

/* 52332 — Submitter approval chain: researcher → lead → legal, per program sensitivity. */
export const CHAIN_STEPS = ['researcher', 'lead', 'legal'];

export function createApprovalChain(findingId, opts = {}, now = Date.now()) {
  if (!findingId) return { ok: false, reason: 'findingId required' };
  const steps =
    Array.isArray(opts.steps) && opts.steps.length
      ? opts.steps.filter(s => CHAIN_STEPS.includes(s))
      : [...CHAIN_STEPS];
  if (!steps.length) return { ok: false, reason: 'no valid chain steps' };
  return {
    ok: true,
    chain: {
      id: `ac_${tokenFor('ac', findingId, now)}`,
      findingId,
      program: opts.program || null,
      steps: steps.map(role => ({ role, by: null, at: null, decision: null })),
      current: 0,
      state: 'pending',
      createdAt: now,
    },
  };
}

export function approvalChainReducer(chain, action = {}, now = Date.now()) {
  if (!chain || !chain.id) return { ok: false, reason: 'chain required' };
  if (chain.state !== 'pending') return { ok: false, reason: `chain ${chain.state}` };
  if (action.type !== 'DECIDE') return { ok: false, reason: `unknown action ${action.type}` };
  const idx = chain.current;
  const step = chain.steps[idx];
  if (!step) return { ok: false, reason: 'no current step' };
  if (action.decision === 'approve') {
    const steps = chain.steps.map((s, i) =>
      i === idx ? { ...s, by: action.by || null, at: now, decision: 'approve' } : s
    );
    const done = idx + 1 >= steps.length;
    return {
      ok: true,
      chain: { ...chain, steps, current: idx + 1, state: done ? 'approved' : 'pending' },
    };
  }
  if (action.decision === 'reject') {
    const steps = chain.steps.map((s, i) =>
      i === idx
        ? {
            ...s,
            by: action.by || null,
            at: now,
            decision: 'reject',
            reason: action.reason || null,
          }
        : s
    );
    return { ok: true, chain: { ...chain, steps, state: 'rejected' } };
  }
  return { ok: false, reason: 'decision must be approve|reject' };
}

/* 52333 — Submission history log: immutable log of every attempt (what/when/by/response). */
export function appendSubmissionHistory(log = [], entry = {}, now = Date.now()) {
  if (!entry.draftId && !entry.findingId)
    return { ok: false, reason: 'draftId or findingId required' };
  const rows = Array.isArray(log) ? log : [];
  const record = {
    id: `sl_${tokenFor('sl', `${entry.draftId || entry.findingId}:${rows.length}`, now)}`,
    draftId: entry.draftId || null,
    findingId: entry.findingId || null,
    platform: entry.platform || null,
    action: entry.action || 'submitted',
    by: entry.by || null,
    payloadSummary: entry.payloadSummary || null,
    response: entry.response || null,
    at: now,
  };
  return { ok: true, log: [...rows, record], record };
}

export function filterSubmissionHistory(log = [], filter = {}) {
  const rows = Array.isArray(log) ? log : [];
  return {
    ok: true,
    records: rows.filter(
      r =>
        (!filter.platform || r.platform === filter.platform) &&
        (!filter.action || r.action === filter.action) &&
        (!filter.findingId || r.findingId === filter.findingId)
    ),
  };
}

/* 52334 — Resubmission after fix: one-click draft for retesting notes on fix verification. */
export function buildResubmissionDraft(finding, fixNotes, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  if (typeof fixNotes !== 'string' || fixNotes.length === 0) {
    return { ok: false, reason: 'fixNotes required' };
  }
  return {
    ok: true,
    draft: {
      id: `rs_${tokenFor('rs', finding.id, now)}`,
      kind: 'retest',
      findingId: finding.id,
      platform: finding.platform || null,
      title: `Retest: ${finding.title || finding.id}`,
      fixNotes,
      retestSteps: Array.isArray(finding.pocTrace) ? finding.pocTrace.map(String) : [],
      expected: 'Vulnerability no longer reproducible with the original steps.',
      createdAt: now,
    },
  };
}

/* 52335 — Platform message templates: canned professional replies. */
export const MESSAGE_TEMPLATES = {
  'triage-nudge': {
    subject: 'Checking in on report status',
    body: 'Hi team — just checking whether you need anything else from my side on this report. Happy to provide extra detail or PoC material. Thanks, {handle}',
  },
  'evidence-add': {
    subject: 'Additional evidence attached',
    body: 'Hi — I have attached additional evidence ({files}) that strengthens the reproduction. The original steps are unchanged. Regards, {handle}',
  },
  'duplicate-dispute': {
    subject: 'Duplicate marking — request for review',
    body: 'Hi team — I believe this report differs from {duplicateId} because {reason}. Could you please take another look? Evidence of the difference is attached. Thanks, {handle}',
  },
  'fix-verified': {
    subject: 'Fix verified',
    body: 'I retested with the original steps and can confirm the issue is resolved. Thanks for the quick turnaround. — {handle}',
  },
  'bounty-inquiry': {
    subject: 'Bounty question',
    body: 'Hi — could you share how the bounty was calculated for this report? I want to make sure I understand the severity mapping. Thanks, {handle}',
  },
};

export function fillMessageTemplate(kind, vars = {}) {
  const tpl = MESSAGE_TEMPLATES[kind];
  if (!tpl) return { ok: false, reason: `unknown template: ${kind}` };
  const fill = s =>
    String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
  return { ok: true, kind, message: { subject: fill(tpl.subject), body: fill(tpl.body) } };
}

/* 52336 — Triager-question draft replies: grounded in the finding's evidence, awaiting human send. */
export function draftTriagerReply(question, finding) {
  if (typeof question !== 'string' || question.length === 0)
    return { ok: false, reason: 'question required' };
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const q = question.toLowerCase();
  let answer;
  if (q.includes('impact') || q.includes('severity')) {
    answer = `The impact is ${finding.impact || 'described in the report'}; the affected asset is ${finding.endpoint || finding.target || 'the in-scope target'}.`;
  } else if (q.includes('reproduc') || q.includes('step')) {
    const steps = Array.isArray(finding.pocTrace) ? finding.pocTrace : [finding.poc || 'see PoC'];
    answer = `Reproduction:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  } else if (q.includes('fix') || q.includes('remediat')) {
    answer = `Suggested remediation: ${finding.remediation || 'per vendor hardening guidance'}.`;
  } else {
    answer = `Per the attached evidence for ${finding.title || finding.id}: ${finding.description || 'see report body'}. Happy to provide more detail.`;
  }
  return {
    ok: true,
    reply: {
      question,
      answer,
      groundedIn: ['evidence', 'pocTrace', 'impact'].filter(
        k => finding[k] !== undefined && finding[k] !== null
      ),
      status: 'draft-awaiting-human-send',
    },
  };
}

/* 52337 — Mediation escalation draft: full evidence trail when a report is unfairly closed. */
export function buildMediationDraft(finding, evidenceTrail = [], now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  if (!Array.isArray(evidenceTrail) || evidenceTrail.length === 0) {
    return { ok: false, reason: 'evidenceTrail with at least one entry required' };
  }
  return {
    ok: true,
    draft: {
      id: `med_${tokenFor('med', finding.id, now)}`,
      findingId: finding.id,
      platform: finding.platform || null,
      status: 'draft',
      summary: `Mediation request: report ${finding.reportId || finding.id} was closed as ${finding.platformStatus || 'unknown'}; evidence below supports the original severity.`,
      evidenceTrail: evidenceTrail.map((e, i) => ({ index: i + 1, ...e })),
      requestedAt: now,
    },
  };
}

/* 52338 — Disclosure timeline tracker: agreed disclosure dates with pre-lapse reminders. */
export function createDisclosureTimeline(reports = [], now = Date.now()) {
  if (!Array.isArray(reports)) return { ok: false, reason: 'reports array required' };
  const entries = reports
    .map(r => ({
      reportId: r.reportId || r.id,
      findingId: r.findingId || null,
      agreedDate: typeof r.agreedDate === 'number' ? r.agreedDate : null,
      remindBeforeMs:
        typeof r.remindBeforeMs === 'number' ? r.remindBeforeMs : 7 * 24 * 3600 * 1000,
      status: r.status || 'pending',
    }))
    .filter(e => e.reportId && e.agreedDate != null);
  return {
    ok: true,
    timeline: { id: `dt_${tokenFor('dt', `${entries.length}`, now)}`, createdAt: now, entries },
  };
}

export function upcomingDisclosures(timeline, now = Date.now()) {
  if (!timeline || !Array.isArray(timeline.entries))
    return { ok: false, reason: 'timeline required' };
  const due = timeline.entries
    .filter(
      e => e.status === 'pending' && e.agreedDate - e.remindBeforeMs <= now && e.agreedDate >= now
    )
    .sort((a, b) => a.agreedDate - b.agreedDate)
    .map(e => ({ ...e, daysLeft: Math.ceil((e.agreedDate - now) / (24 * 3600 * 1000)) }));
  const lapsed = timeline.entries.filter(e => e.status === 'pending' && e.agreedDate < now);
  return { ok: true, due, lapsed, counts: { due: due.length, lapsed: lapsed.length } };
}

/* 52339 — Coordinated disclosure scheduler: public writeups aligned with the vendor's fix release. */
export function scheduleCoordinatedDisclosure(input = {}, now = Date.now()) {
  if (!input.findingId) return { ok: false, reason: 'findingId required' };
  if (typeof input.fixReleaseAt !== 'number')
    return { ok: false, reason: 'fixReleaseAt timestamp required' };
  const embargoDays = typeof input.embargoDays === 'number' ? input.embargoDays : 90;
  const requestedAt =
    typeof input.publicAt === 'number' ? input.publicAt : input.fixReleaseAt + 7 * 24 * 3600 * 1000;
  if (requestedAt < input.fixReleaseAt) {
    return { ok: false, reason: 'publicAt must be at or after the fix release' };
  }
  const deadline = input.reportedAt + embargoDays * 24 * 3600 * 1000;
  return {
    ok: true,
    schedule: {
      id: `cd_${tokenFor('cd', input.findingId, now)}`,
      findingId: input.findingId,
      vendor: input.vendor || null,
      reportedAt: input.reportedAt || now,
      fixReleaseAt: input.fixReleaseAt,
      publicAt: requestedAt,
      embargoDays,
      embargoDeadline: Number.isFinite(deadline) ? deadline : null,
      withinEmbargo: Number.isFinite(deadline) ? requestedAt <= deadline : null,
      status: 'scheduled',
      createdAt: now,
    },
  };
}

/* 52340 — CVE request draft: CVE assignment request with technical details pre-filled. */
export function buildCveRequestDraft(finding, opts = {}) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  if (!finding.severity && finding.cvss == null)
    return { ok: false, reason: 'severity or cvss required' };
  return {
    ok: true,
    draft: {
      kind: 'cve-request',
      product: opts.product || finding.target || null,
      vendor: opts.vendor || null,
      version: opts.version || null,
      title: finding.title || `Vulnerability in ${opts.product || finding.id}`,
      description: finding.description || null,
      severity: finding.severity || null,
      cvss: finding.cvss != null ? finding.cvss : null,
      cwe: Array.isArray(finding.cwes) ? finding.cwes : finding.cwe ? [finding.cwe] : [],
      affectedEndpoint: finding.endpoint || finding.url || null,
      references: Array.isArray(finding.references) ? finding.references : [],
      reporter: opts.reporter || null,
      status: 'draft',
    },
  };
}
