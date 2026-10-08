/**
 * lifecycleCore.js — Infinity AI · Dark-Matter · Wave 59 (ideas 52341–52360)
 * Pure JS (no React / DOM / network). Deterministic post-hunt lifecycle
 * models: submission analytics, per-platform acceptance stats, draft
 * versioning, collaborative editing, an encrypted-handle credential vault
 * (never plaintext), test-mode submission, dry-run validation, rate-limit
 * handling, notifications, webhook receiving, bounty leaderboards, tax
 * exports, duplicate merging, program discovery, scope-diff alerts, SLA
 * monitoring, report-quality scoring, disclosure checks, the finding
 * lifecycle state machine and custom lifecycle states. Time is injected
 * via `now` params (default Date.now()) so every function is reproducible.
 */

export const WAVE59_LC_IDEAS = [
  { id: 52341, title: 'Submission analytics (post-hunt)', skip: false },
  { id: 52342, title: 'Per-platform acceptance stats', skip: false },
  { id: 52343, title: 'Draft versioning', skip: false },
  { id: 52344, title: 'Collaborative draft editing', skip: false },
  { id: 52345, title: 'Platform credential vault (encrypted-handle descriptors)', skip: false },
  { id: 52346, title: 'Test-mode submission', skip: false },
  { id: 52347, title: 'Submission dry-run validation', skip: false },
  { id: 52348, title: 'Platform rate-limit handling', skip: false },
  { id: 52349, title: 'Submission notifications', skip: false },
  { id: 52350, title: 'Platform webhook receiver', skip: false },
  { id: 52351, title: 'Bounty earnings leaderboard', skip: false },
  { id: 52352, title: 'Bounty tax-report export', skip: false },
  { id: 52353, title: 'Duplicate-merge before submit', skip: false },
  { id: 52354, title: 'Program discovery', skip: false },
  { id: 52355, title: 'Scope-diff alerts', skip: false },
  { id: 52356, title: 'Submission SLA monitor', skip: false },
  { id: 52357, title: 'Report-quality score', skip: false },
  { id: 52358, title: 'Platform-specific disclosure check', skip: false },
  { id: 52359, title: 'Finding lifecycle state machine with enforced transitions', skip: false },
  { id: 52360, title: 'Custom lifecycle states', skip: false },
];

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `lc_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

const ACCEPTED_STATES = new Set(['triaged', 'resolved', 'paid', 'accepted']);

/* 52341 — Submission analytics: acceptance rate, median time-to-triage, payout stats. */
export function computeSubmissionAnalytics(submissions = []) {
  const rows = Array.isArray(submissions) ? submissions : [];
  const accepted = rows.filter(s => ACCEPTED_STATES.has(s.state));
  const triageTimes = rows
    .filter(
      s =>
        typeof s.submittedAt === 'number' &&
        typeof s.triagedAt === 'number' &&
        s.triagedAt >= s.submittedAt
    )
    .map(s => s.triagedAt - s.submittedAt)
    .sort((a, b) => a - b);
  const median = triageTimes.length
    ? (triageTimes[Math.floor((triageTimes.length - 1) / 2)] +
        triageTimes[Math.ceil((triageTimes.length - 1) / 2)]) /
      2
    : null;
  const payouts = rows.map(s => s.payout).filter(p => typeof p === 'number');
  const totalPayout = payouts.reduce((a, p) => a + p, 0);
  return {
    ok: true,
    analytics: {
      total: rows.length,
      accepted: accepted.length,
      acceptanceRate: rows.length ? accepted.length / rows.length : null,
      medianTimeToTriageMs: median,
      payout: {
        total: totalPayout,
        count: payouts.length,
        average: payouts.length ? totalPayout / payouts.length : null,
        max: payouts.length ? Math.max(...payouts) : null,
      },
    },
  };
}

/* 52342 — Per-platform acceptance stats: which platforms accept your report styles best. */
export function computeAcceptanceStats(submissions = [], platform) {
  const rows = (Array.isArray(submissions) ? submissions : []).filter(
    s => !platform || s.platform === platform
  );
  const byPlatform = {};
  for (const s of rows) {
    const p = s.platform || 'unknown';
    if (!byPlatform[p]) byPlatform[p] = { total: 0, accepted: 0 };
    byPlatform[p].total += 1;
    if (ACCEPTED_STATES.has(s.state)) byPlatform[p].accepted += 1;
  }
  for (const p of Object.keys(byPlatform)) {
    byPlatform[p].acceptanceRate = byPlatform[p].total
      ? byPlatform[p].accepted / byPlatform[p].total
      : null;
  }
  const ranked = Object.entries(byPlatform)
    .map(([p, s]) => ({ platform: p, ...s }))
    .sort((a, b) => (b.acceptanceRate || 0) - (a.acceptanceRate || 0));
  return { ok: true, perPlatform: byPlatform, ranked };
}

/* 52343 — Draft versioning: every revision kept so edits are traceable. */
export function appendDraftVersion(versions = [], draft, author, now = Date.now()) {
  if (!draft || typeof draft !== 'object') return { ok: false, reason: 'draft object required' };
  const rows = Array.isArray(versions) ? versions : [];
  const version = {
    id: `dv_${tokenFor('dv', `${draft.id || 'draft'}:${rows.length + 1}`, now)}`,
    version: rows.length + 1,
    draft: { ...draft },
    author: author || null,
    createdAt: now,
    note: null,
  };
  return { ok: true, versions: [...rows, version], version };
}

export function getDraftVersion(versions = [], version) {
  const rows = Array.isArray(versions) ? versions : [];
  const found = rows.find(v => v.version === version);
  if (!found) return { ok: false, reason: `version ${version} not found` };
  return { ok: true, version: found };
}

export function diffDraftVersions(versions, a, b) {
  const va = getDraftVersion(versions, a);
  const vb = getDraftVersion(versions, b);
  if (!va.ok) return va;
  if (!vb.ok) return vb;
  const keys = new Set([...Object.keys(va.version.draft), ...Object.keys(vb.version.draft)]);
  const changes = [];
  for (const k of keys) {
    const x = JSON.stringify(va.version.draft[k]);
    const y = JSON.stringify(vb.version.draft[k]);
    if (x !== y) changes.push({ field: k, from: va.version.draft[k], to: vb.version.draft[k] });
  }
  return { ok: true, changes };
}

/* 52344 — Collaborative draft editing: multiple researchers co-edit with change tracking. */
export function applyCollaborativeEdit(draft, edit = {}, author, now = Date.now()) {
  if (!draft || typeof draft !== 'object') return { ok: false, reason: 'draft object required' };
  if (!author) return { ok: false, reason: 'author required' };
  if (
    !edit ||
    typeof edit !== 'object' ||
    !Array.isArray(edit.changes) ||
    edit.changes.length === 0
  ) {
    return { ok: false, reason: 'edit with at least one change required' };
  }
  const applied = [];
  const next = { ...draft };
  for (const c of edit.changes) {
    if (!c || !c.field) continue;
    applied.push({
      field: c.field,
      from: next[c.field] !== undefined ? next[c.field] : null,
      to: c.value,
    });
    next[c.field] = c.value;
  }
  if (!applied.length) return { ok: false, reason: 'no valid changes' };
  const entry = {
    id: `ce_${tokenFor('ce', `${draft.id || 'draft'}:${author}`, now)}`,
    author,
    at: now,
    changes: applied,
    comment: edit.comment || null,
  };
  return {
    ok: true,
    draft: {
      ...next,
      changeLog: [...(Array.isArray(next.changeLog) ? next.changeLog : []), entry],
    },
    edit: entry,
  };
}

/* 52345 — Platform credential vault: encrypted-handle descriptors, NEVER plaintext.
 * This model only issues opaque handle descriptors; raw tokens are never
 * accepted, stored, or returned here. */
export const VAULT_SCOPES = ['read', 'submit', 'webhook'];

export function storeCredentialHandle(input = {}, now = Date.now()) {
  if (!input.platform) return { ok: false, reason: 'platform required' };
  if (!input.owner) return { ok: false, reason: 'owner (researcher) required' };
  if (input.plaintext !== undefined) {
    return { ok: false, reason: 'plaintext credentials are never accepted by the vault' };
  }
  if (input.ciphertextRef === undefined) {
    return { ok: false, reason: 'ciphertextRef (opaque encrypted blob reference) required' };
  }
  const scopes = Array.isArray(input.scopes)
    ? input.scopes.filter(s => VAULT_SCOPES.includes(s))
    : ['read'];
  return {
    ok: true,
    credential: {
      id: `cred_${tokenFor('cred', `${input.platform}:${input.owner}`, now)}`,
      platform: input.platform,
      owner: input.owner,
      ciphertextRef: String(input.ciphertextRef),
      algorithm: input.algorithm || 'vault-kms',
      scopes,
      maskedHint: typeof input.maskedHint === 'string' ? input.maskedHint : '••••',
      createdAt: now,
      lastRotatedAt: null,
      plaintext: null, // hard invariant: the descriptor never carries the secret
    },
  };
}

export function rotateCredentialHandle(credential, newCiphertextRef, now = Date.now()) {
  if (!credential || !credential.id) return { ok: false, reason: 'credential descriptor required' };
  if (newCiphertextRef === undefined) return { ok: false, reason: 'new ciphertextRef required' };
  return {
    ok: true,
    credential: {
      ...credential,
      ciphertextRef: String(newCiphertextRef),
      lastRotatedAt: now,
      plaintext: null,
    },
  };
}

/* 52346 — Test-mode submission: validate against platform APIs in sandbox mode. */
export function buildTestModeSubmission(draft, platform, now = Date.now()) {
  if (!draft || typeof draft !== 'object') return { ok: false, reason: 'draft object required' };
  if (!platform) return { ok: false, reason: 'platform required' };
  return {
    ok: true,
    submission: {
      id: `tms_${tokenFor('tms', `${platform}:${draft.id || 'draft'}`, now)}`,
      mode: 'test',
      platform,
      sandbox: true,
      draft: { ...draft },
      willCreateRealReport: false,
      createdAt: now,
      networkCalls: 0, // this model makes no calls; the payload is a sandbox descriptor
    },
  };
}

export function markTestModeResult(submission, result = {}, now = Date.now()) {
  if (!submission || submission.mode !== 'test')
    return { ok: false, reason: 'test-mode submission required' };
  return {
    ok: true,
    submission: {
      ...submission,
      testResult: {
        valid: result.valid === true,
        errors: Array.isArray(result.errors) ? result.errors : [],
        evaluatedAt: now,
      },
    },
  };
}

/* 52347 — Submission dry-run validation: pre-flight checks with fix-it hints. */
export const DRY_RUN_CHECKS = [
  { id: 'title-present', hint: 'Add a concise title under 140 chars.' },
  { id: 'severity-mapped', hint: 'Set a severity or CVSS score so it maps to the platform scale.' },
  { id: 'steps-present', hint: 'Include numbered reproduction steps.' },
  { id: 'impact-present', hint: 'Describe the business impact.' },
  { id: 'asset-present', hint: 'Fill the affected asset/endpoint field.' },
  { id: 'attachments-within-limit', hint: 'Shrink attachments or host large files externally.' },
];

export function dryRunValidate(draft, platform, opts = {}) {
  if (!draft || typeof draft !== 'object') return { ok: false, reason: 'draft object required' };
  if (!platform) return { ok: false, reason: 'platform required' };
  const maxBytes =
    typeof opts.maxAttachmentBytes === 'number' ? opts.maxAttachmentBytes : 25 * 1024 * 1024;
  const attachmentBytes = Array.isArray(draft.attachments)
    ? draft.attachments.reduce((a, x) => a + (typeof x.sizeBytes === 'number' ? x.sizeBytes : 0), 0)
    : 0;
  const checks = [
    {
      id: 'title-present',
      pass: typeof draft.title === 'string' && draft.title.length > 0 && draft.title.length <= 140,
    },
    { id: 'severity-mapped', pass: Boolean(draft.severity || draft.cvss != null) },
    {
      id: 'steps-present',
      pass: Array.isArray(draft.steps) ? draft.steps.length > 0 : Boolean(draft.steps || draft.poc),
    },
    { id: 'impact-present', pass: Boolean(draft.impact) },
    {
      id: 'asset-present',
      pass: Boolean(draft.asset || draft.affected_endpoint || draft.target_url),
    },
    { id: 'attachments-within-limit', pass: attachmentBytes <= maxBytes },
  ].map(c => ({
    ...c,
    hint: c.pass ? null : (DRY_RUN_CHECKS.find(d => d.id === c.id) || {}).hint || null,
  }));
  const failed = checks.filter(c => !c.pass);
  return {
    ok: true,
    platform,
    checks,
    failed: failed.map(f => f.id),
    passed: failed.length === 0,
    attachmentBytes,
  };
}

/* 52348 — Platform rate-limit handling: queue submissions respecting per-platform limits. */
export function createRateLimiter(rules = {}, now = Date.now()) {
  const platforms = Object.keys(rules);
  if (!platforms.length) return { ok: false, reason: 'rules for at least one platform required' };
  const buckets = {};
  for (const p of platforms) {
    const r = rules[p] || {};
    buckets[p] = {
      maxPerMinute: typeof r.maxPerMinute === 'number' ? r.maxPerMinute : 10,
      maxPerHour: typeof r.maxPerHour === 'number' ? r.maxPerHour : 100,
      windowStart: now,
      minuteCount: 0,
      hourCount: 0,
      queued: [],
    };
  }
  return { ok: true, limiter: { buckets, createdAt: now } };
}

export function rateLimitNext(limiter, platform, item, now = Date.now()) {
  if (!limiter || !limiter.buckets) return { ok: false, reason: 'limiter required' };
  const bucket = limiter.buckets[platform];
  if (!bucket) return { ok: false, reason: `no rules for platform ${platform}` };
  const resetIfNeeded = b => {
    const next = { ...b };
    if (now - b.windowStart >= 3600 * 1000) {
      next.windowStart = now;
      next.minuteCount = 0;
      next.hourCount = 0;
    } else if (now - b.windowStart >= 60 * 1000) {
      next.minuteCount = 0;
    }
    return next;
  };
  const b = resetIfNeeded(bucket);
  const allowed = b.minuteCount < b.maxPerMinute && b.hourCount < b.maxPerHour;
  const updated = {
    ...b,
    minuteCount: b.minuteCount + (allowed ? 1 : 0),
    hourCount: b.hourCount + (allowed ? 1 : 0),
    queued: allowed ? b.queued : [...b.queued, { item: item || null, queuedAt: now }],
  };
  const nextLimiter = { ...limiter, buckets: { ...limiter.buckets, [platform]: updated } };
  return {
    ok: true,
    limiter: nextLimiter,
    decision: allowed ? 'send' : 'queued',
    retryAfterMs: allowed ? 0 : Math.max(0, 60 * 1000 - (now - updated.windowStart)),
    queuedCount: updated.queued.length,
  };
}

/* 52349 — Submission notifications: notify the researcher on every synced status change. */
export const SUBMISSION_NOTIF_KINDS = [
  'status-change',
  'bounty-paid',
  'triager-question',
  'sla-breach',
];

export function createSubmissionNotification(kind, input = {}, now = Date.now()) {
  if (!SUBMISSION_NOTIF_KINDS.includes(kind))
    return { ok: false, reason: `kind must be ${SUBMISSION_NOTIF_KINDS.join('|')}` };
  if (!input.to) return { ok: false, reason: 'recipient (to) required' };
  if (!input.reportId && !input.findingId)
    return { ok: false, reason: 'reportId or findingId required' };
  return {
    ok: true,
    notification: {
      id: `sn_${tokenFor('sn', `${kind}:${input.reportId || input.findingId}`, now)}`,
      kind,
      to: input.to,
      reportId: input.reportId || null,
      findingId: input.findingId || null,
      title: input.title || `Submission ${kind}`,
      body: input.body || null,
      status: 'unread',
      createdAt: now,
    },
  };
}

/* 52350 — Platform webhook receiver: accept inbound webhooks to update statuses in real time. */
export const WEBHOOK_EVENTS = [
  'report.status_changed',
  'report.bounty_awarded',
  'report.commented',
  'report.duplicate_marked',
];

export function receiveWebhook(payload = {}, opts = {}, now = Date.now()) {
  if (!payload.event || !WEBHOOK_EVENTS.includes(payload.event)) {
    return { ok: false, reason: `event must be one of ${WEBHOOK_EVENTS.join(', ')}` };
  }
  if (!payload.reportId) return { ok: false, reason: 'reportId required' };
  if (opts.verifySignature === true && !payload.signature) {
    return { ok: false, reason: 'signature required when verification is enabled' };
  }
  return {
    ok: true,
    webhook: {
      id: `wh_${tokenFor('wh', `${payload.event}:${payload.reportId}`, now)}`,
      event: payload.event,
      reportId: payload.reportId,
      platform: payload.platform || null,
      data: payload.data && typeof payload.data === 'object' ? payload.data : {},
      signature: payload.signature || null,
      signatureVerified: opts.verifySignature === true ? Boolean(payload.signature) : null,
      receivedAt: now,
    },
  };
}

export function webhookToLifecyclePatch(webhook) {
  if (!webhook || !webhook.id) return { ok: false, reason: 'webhook required' };
  const map = {
    'report.status_changed': webhook.data.status || 'triaged',
    'report.duplicate_marked': 'duplicate',
    'report.bounty_awarded': 'paid',
    'report.commented': 'commented',
  };
  const lifecycle = map[webhook.event];
  if (!lifecycle) return { ok: false, reason: `no lifecycle mapping for ${webhook.event}` };
  return {
    ok: true,
    patch: {
      reportId: webhook.reportId,
      lifecycle,
      payout: webhook.data.amount != null ? webhook.data.amount : null,
      at: webhook.receivedAt,
      source: 'platform-webhook',
    },
  };
}

/* 52351 — Bounty earnings leaderboard: per researcher/program/quarter breakdowns. */
export function buildLeaderboard(earnings = []) {
  const rows = Array.isArray(earnings) ? earnings : [];
  const perResearcher = {};
  const perProgram = {};
  const perQuarter = {};
  for (const e of rows) {
    const r = e.researcher || 'unassigned';
    const p = e.program || 'unassigned';
    const d = new Date(typeof e.paidAt === 'number' ? e.paidAt : Date.now());
    const q = `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    if (!perResearcher[r]) perResearcher[r] = { total: 0, count: 0 };
    if (!perProgram[p]) perProgram[p] = { total: 0, count: 0 };
    if (!perQuarter[q]) perQuarter[q] = { total: 0, count: 0 };
    perResearcher[r].total += e.amount || 0;
    perResearcher[r].count += 1;
    perProgram[p].total += e.amount || 0;
    perProgram[p].count += 1;
    perQuarter[q].total += e.amount || 0;
    perQuarter[q].count += 1;
  }
  const researchers = Object.entries(perResearcher)
    .map(([researcher, s]) => ({ researcher, ...s }))
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return {
    ok: true,
    leaderboard: {
      researchers,
      byProgram: perProgram,
      byQuarter: perQuarter,
      grandTotal: researchers.reduce((a, r) => a + r.total, 0),
      payoutCount: rows.length,
    },
  };
}

/* 52352 — Bounty tax-report export: annual earnings per researcher with dates/programs. */
export function exportTaxReport(earnings = [], year, researcher) {
  if (typeof year !== 'number') return { ok: false, reason: 'year required' };
  if (!researcher) return { ok: false, reason: 'researcher required' };
  const rows = (Array.isArray(earnings) ? earnings : [])
    .filter(e => {
      if (e.researcher !== researcher) return false;
      const d = new Date(typeof e.paidAt === 'number' ? e.paidAt : 0);
      return d.getUTCFullYear() === year;
    })
    .sort((a, b) => (a.paidAt || 0) - (b.paidAt || 0));
  const lines = rows.map(e => ({
    date: new Date(e.paidAt).toISOString().slice(0, 10),
    program: e.program || 'unassigned',
    findingId: e.findingId || null,
    amount: e.amount || 0,
    currency: e.currency || 'USD',
  }));
  const csv = [
    'date,program,finding_id,amount,currency',
    ...lines.map(l => `${l.date},${l.program},${l.findingId || ''},${l.amount},${l.currency}`),
  ].join('\n');
  return {
    ok: true,
    report: {
      researcher,
      year,
      lines,
      total: lines.reduce((a, l) => a + l.amount, 0),
      count: lines.length,
      csv,
      disclaimer: 'Informational export only — consult a tax professional.',
    },
  };
}

/* 52353 — Duplicate-merge before submit: one submission, combined evidence + affected assets. */
export function mergeDuplicates(findings = [], now = Date.now()) {
  if (!Array.isArray(findings) || findings.length < 2) {
    return { ok: false, reason: 'at least two findings required to merge' };
  }
  if (!findings.every(f => f && f.id)) return { ok: false, reason: 'every finding needs an id' };
  const primary = findings[0];
  const evidence = [];
  const assets = [];
  for (const f of findings) {
    if (Array.isArray(f.evidence)) evidence.push(...f.evidence);
    const asset = f.endpoint || f.url || f.target;
    if (asset && !assets.includes(asset)) assets.push(asset);
  }
  const titles = [...new Set(findings.map(f => f.title).filter(Boolean))];
  return {
    ok: true,
    merged: {
      id: `mg_${tokenFor('mg', findings.map(f => f.id).join(','), now)}`,
      primaryId: primary.id,
      mergedIds: findings.map(f => f.id),
      title: titles[0] || primary.id,
      altTitles: titles.slice(1),
      severity: primary.severity || null,
      evidence,
      assets,
      evidenceCount: evidence.length,
      mergedAt: now,
    },
  };
}

/* 52354 — Program discovery: search connected platforms for programs matching targets. */
export function discoverPrograms(programs = [], targets = []) {
  if (!Array.isArray(programs)) return { ok: false, reason: 'programs array required' };
  if (!Array.isArray(targets) || targets.length === 0)
    return { ok: false, reason: 'at least one target required' };
  const matches = [];
  for (const p of programs) {
    if (!p || !p.name) continue;
    const scope = [
      ...(Array.isArray(p.inScope) ? p.inScope : []),
      ...(Array.isArray(p.assets) ? p.assets : []),
    ];
    const hits = targets.filter(t =>
      scope.some(s => String(t).includes(String(s)) || String(s).includes(String(t)))
    );
    if (hits.length) {
      matches.push({
        program: p.name,
        platform: p.platform || null,
        matchedTargets: hits,
        inScope: Array.isArray(p.inScope) ? [...p.inScope] : [],
        bounty: p.bounty === true,
      });
    }
  }
  return { ok: true, matches, count: matches.length };
}

/* 52355 — Scope-diff alerts: notify when a tracked program's scope changes. */
export function diffProgramScope(program, previousScope = []) {
  if (!program || !program.name) return { ok: false, reason: 'program with name required' };
  const current = new Set(Array.isArray(program.inScope) ? program.inScope.map(String) : []);
  const previous = new Set(Array.isArray(previousScope) ? previousScope.map(String) : []);
  const added = [...current].filter(s => !previous.has(s));
  const removed = [...previous].filter(s => !current.has(s));
  return {
    ok: true,
    program: program.name,
    added,
    removed,
    changed: added.length > 0 || removed.length > 0,
    alert:
      added.length || removed.length
        ? `Scope changed for ${program.name}: +${added.length} asset(s), -${removed.length} asset(s). Review affected drafts.`
        : null,
  };
}

/* 52356 — Submission SLA monitor: response times vs stated SLAs, flag stalled reports. */
export function monitorSubmissionSla(submissions = [], slas = {}, now = Date.now()) {
  if (!Array.isArray(submissions)) return { ok: false, reason: 'submissions array required' };
  const rows = submissions.map(s => {
    const platform = s.platform || 'default';
    const slaMs =
      slas[platform] != null
        ? slas[platform]
        : slas.default != null
          ? slas.default
          : 7 * 24 * 3600 * 1000;
    const submittedAt = typeof s.submittedAt === 'number' ? s.submittedAt : null;
    const respondedAt =
      typeof s.triagedAt === 'number'
        ? s.triagedAt
        : typeof s.respondedAt === 'number'
          ? s.respondedAt
          : null;
    const elapsed =
      submittedAt == null
        ? null
        : respondedAt != null
          ? respondedAt - submittedAt
          : now - submittedAt;
    const breached = elapsed != null && respondedAt == null && elapsed > slaMs;
    return {
      id: s.id || null,
      platform,
      submittedAt,
      elapsedMs: elapsed,
      slaMs,
      breached,
      responded: respondedAt != null,
    };
  });
  const breached = rows.filter(r => r.breached);
  return { ok: true, rows, breached, breachedCount: breached.length };
}

/* 52357 — Report-quality score: completeness on evidence/impact/repro before submit. */
const QUALITY_WEIGHTS = {
  title: 10,
  severity: 10,
  impact: 20,
  steps: 20,
  evidence: 20,
  remediation: 10,
  cwe: 10,
};

export function scoreReportQuality(draft) {
  if (!draft || typeof draft !== 'object') return { ok: false, reason: 'draft object required' };
  const signals = [
    {
      id: 'title',
      weight: QUALITY_WEIGHTS.title,
      pass: typeof draft.title === 'string' && draft.title.length > 0 && draft.title.length <= 140,
    },
    {
      id: 'severity',
      weight: QUALITY_WEIGHTS.severity,
      pass: Boolean(draft.severity || draft.cvss != null),
    },
    {
      id: 'impact',
      weight: QUALITY_WEIGHTS.impact,
      pass: typeof draft.impact === 'string' && draft.impact.length >= 20,
    },
    {
      id: 'steps',
      weight: QUALITY_WEIGHTS.steps,
      pass:
        (Array.isArray(draft.steps) ? draft.steps.length : draft.steps || draft.poc ? 1 : 0) >= 3,
    },
    {
      id: 'evidence',
      weight: QUALITY_WEIGHTS.evidence,
      pass: Array.isArray(draft.evidence) && draft.evidence.length > 0,
    },
    {
      id: 'remediation',
      weight: QUALITY_WEIGHTS.remediation,
      pass: typeof draft.remediation === 'string' && draft.remediation.length > 0,
    },
    {
      id: 'cwe',
      weight: QUALITY_WEIGHTS.cwe,
      pass: Boolean(draft.cwe || (Array.isArray(draft.cwes) && draft.cwes.length)),
    },
  ];
  const score = signals.reduce((a, s) => a + (s.pass ? s.weight : 0), 0);
  const missing = signals.filter(s => !s.pass).map(s => s.id);
  return {
    ok: true,
    quality: {
      score,
      max: 100,
      grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : 'D',
      signals: signals.map(s => ({ id: s.id, weight: s.weight, pass: s.pass })),
      missing,
    },
  };
}

/* 52358 — Platform-specific disclosure check: comply with each platform's policy before sending. */
const DISCLOSURE_POLICIES = {
  hackerone: { requiresVendorConsent: true, minEmbargoDays: 30, publicWriteupAllowed: true },
  bugcrowd: { requiresVendorConsent: true, minEmbargoDays: 30, publicWriteupAllowed: true },
  intigriti: { requiresVendorConsent: true, minEmbargoDays: 90, publicWriteupAllowed: true },
  yeswehack: { requiresVendorConsent: true, minEmbargoDays: 90, publicWriteupAllowed: true },
};

export function checkDisclosurePolicy(draft, platform, opts = {}, now = Date.now()) {
  if (!draft || typeof draft !== 'object') return { ok: false, reason: 'draft object required' };
  const policy = DISCLOSURE_POLICIES[platform];
  if (!policy) return { ok: false, reason: `unknown platform: ${platform}` };
  const embargoDays = typeof opts.embargoDays === 'number' ? opts.embargoDays : 0;
  const vendorConsent = opts.vendorConsent === true;
  const checks = [
    {
      id: 'vendor-consent',
      pass: !policy.requiresVendorConsent || vendorConsent,
      detail: vendorConsent
        ? 'Vendor consent recorded.'
        : 'Vendor consent is required by this platform before public disclosure.',
    },
    {
      id: 'min-embargo',
      pass: embargoDays >= policy.minEmbargoDays,
      detail: `Platform requires at least ${policy.minEmbargoDays} days embargo; proposed ${embargoDays}.`,
    },
    {
      id: 'writeup-allowed',
      pass: policy.publicWriteupAllowed,
      detail: 'Platform allows public writeups after the embargo.',
    },
  ];
  const failed = checks.filter(c => !c.pass);
  return {
    ok: true,
    platform,
    compliant: failed.length === 0,
    checks,
    blockers: failed.map(f => f.detail),
  };
}

/* 52359 — Finding lifecycle state machine with enforced transitions.
 * Configurable states; New → Triaged → Confirmed → Assigned → Fixing →
 * Verifying → Closed, plus parked states. Illegal jumps are rejected. */
export const LIFECYCLE_STATES = [
  'new',
  'triaged',
  'confirmed',
  'assigned',
  'fixing',
  'verifying',
  'closed',
  'needs-info',
  'duplicate',
  'reopened',
];

export const LIFECYCLE_TRANSITIONS = {
  new: ['triaged', 'duplicate', 'needs-info'],
  triaged: ['confirmed', 'duplicate', 'needs-info', 'reopened'],
  confirmed: ['assigned', 'needs-info', 'duplicate'],
  assigned: ['fixing', 'needs-info'],
  fixing: ['verifying', 'needs-info'],
  verifying: ['closed', 'fixing', 'reopened'],
  'needs-info': ['triaged', 'confirmed', 'duplicate'],
  duplicate: ['reopened'],
  reopened: ['triaged', 'confirmed'],
  closed: [],
};

export function createLifecycle(findingId, now = Date.now()) {
  if (!findingId) return { ok: false, reason: 'findingId required' };
  return {
    ok: true,
    lifecycle: {
      id: `lc_${tokenFor('life', findingId, now)}`,
      findingId,
      state: 'new',
      history: [{ state: 'new', at: now, by: null, reason: 'created' }],
      customStates: [],
      createdAt: now,
    },
  };
}

export function lifecycleReducer(lifecycle, action = {}, now = Date.now()) {
  if (!lifecycle || !lifecycle.id) return { ok: false, reason: 'lifecycle required' };
  if (action.type !== 'TRANSITION') return { ok: false, reason: `unknown action ${action.type}` };
  const to = action.to;
  const base = { ...LIFECYCLE_TRANSITIONS };
  const custom = {};
  for (const c of lifecycle.customStates || []) {
    if (c && c.id)
      custom[c.id] = {
        from: Array.isArray(c.from) ? c.from : [],
        to: Array.isArray(c.to) ? c.to : [],
      };
  }
  const allowed = base[lifecycle.state] || [];
  const customFrom = custom[lifecycle.state];
  const customTarget = custom[to];
  const viaCustom =
    (customFrom && customFrom.to.includes(to)) ||
    (customTarget && customTarget.from.includes(lifecycle.state));
  if (!allowed.includes(to) && !viaCustom) {
    return { ok: false, reason: `illegal transition ${lifecycle.state} → ${to}` };
  }
  return {
    ok: true,
    lifecycle: {
      ...lifecycle,
      state: to,
      history: [
        ...lifecycle.history,
        { state: to, at: now, by: action.by || null, reason: action.reason || null },
      ],
    },
  };
}

/* 52360 — Custom lifecycle states: org-specific states with colors, icons, rules. */
export function addCustomState(lifecycle, state = {}) {
  if (!lifecycle || !lifecycle.id) return { ok: false, reason: 'lifecycle required' };
  if (!state.id || !/^[a-z0-9-]+$/.test(state.id)) {
    return { ok: false, reason: 'state id required (lowercase alphanumeric with dashes)' };
  }
  const reserved = new Set(LIFECYCLE_STATES);
  if (reserved.has(state.id)) return { ok: false, reason: `state id ${state.id} is reserved` };
  const existing = (lifecycle.customStates || []).some(c => c.id === state.id);
  if (existing) return { ok: false, reason: `state ${state.id} already exists` };
  const custom = {
    id: state.id,
    label: state.label || state.id,
    color: state.color || '#8b93a7',
    icon: state.icon || 'flag',
    from: Array.isArray(state.from)
      ? state.from.filter(
          s => reserved.has(s) || (lifecycle.customStates || []).some(c => c.id === s)
        )
      : [],
    to: Array.isArray(state.to)
      ? state.to.filter(
          s => reserved.has(s) || (lifecycle.customStates || []).some(c => c.id === s)
        )
      : [],
  };
  return {
    ok: true,
    lifecycle: { ...lifecycle, customStates: [...(lifecycle.customStates || []), custom] },
    custom,
  };
}

export function listLifecycleStates(lifecycle) {
  if (!lifecycle || !lifecycle.id) return { ok: false, reason: 'lifecycle required' };
  const states = LIFECYCLE_STATES.map(id => ({ id, custom: false }));
  for (const c of lifecycle.customStates || [])
    states.push({ id: c.id, label: c.label, custom: true });
  return { ok: true, states };
}
