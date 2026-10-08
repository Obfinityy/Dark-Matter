/**
 * shareCore.js — Infinity AI · Dark-Matter · Wave 57 (ideas 52241–52260)
 * Pure JS (no React / DOM / network). Deterministic share-link, workspace and
 * distribution models, builders, evaluators and reducers for post-hunt
 * sharing & collaboration. Time is injected via `now` params
 * (default Date.now()) so every function is reproducible under a fixed clock.
 */

export const WAVE57_SHARE_IDEAS = [
  { id: 52241, title: 'Expiring share links (post-hunt)', skip: false },
  { id: 52242, title: 'Password-protected share links', skip: false },
  { id: 52243, title: 'Role-based link permissions', skip: false },
  { id: 52244, title: 'Per-finding share links', skip: false },
  { id: 52245, title: 'Team workspaces (post-hunt)', skip: false },
  { id: 52246, title: 'Email invite to results', skip: false },
  { id: 52247, title: 'SSO group-synced sharing', skip: false },
  { id: 52248, title: 'Share to Slack channel', skip: false },
  { id: 52249, title: 'Share to Microsoft Teams', skip: false },
  { id: 52250, title: 'Share to Discord webhook', skip: false },
  { id: 52251, title: 'Embeddable results widget', skip: false },
  { id: 52252, title: 'Public vs private link toggle', skip: false },
  { id: 52253, title: 'Share-link access logs', skip: false },
  { id: 52254, title: 'Instant link revocation', skip: false },
  { id: 52255, title: 'Filtered-view sharing', skip: false },
  { id: 52256, title: 'External client portal', skip: false },
  { id: 52257, title: 'NDA-gated share links', skip: false },
  { id: 52258, title: 'Summary-only sharing', skip: false },
  { id: 52259, title: 'Redacted sharing mode', skip: false },
  { id: 52260, title: 'Threaded comments on shared views', skip: false },
];

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function tokenFor(scope, id, now) {
  // Deterministic token: real token material would be random server-side;
  // this model carries the token shape + lifecycle so UI/tests can reason
  // about expiry, consumption and revocation without crypto here.
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `sh_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function summarize(findings) {
  const bySeverity = {};
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  return { total: findings.length, bySeverity };
}

/* 52241 — Expiring share links (post-hunt). */
export function createExpiringLink(hunt, opts = {}, now = Date.now()) {
  if (!hunt || !hunt.id) return { ok: false, reason: 'hunt with id required' };
  const ttlMs = typeof opts.ttlMs === 'number' && opts.ttlMs > 0 ? opts.ttlMs : 7 * 24 * 3600 * 1000;
  const token = tokenFor('hunt', hunt.id, now);
  return {
    ok: true,
    link: {
      token, huntId: hunt.id, scope: 'hunt', visibility: 'internal',
      role: opts.role || 'viewer', createdAt: now, expiresAt: now + ttlMs,
      oneTime: opts.oneTime === true, consumed: false, revoked: false,
      password: null, allowedCidrs: null,
    },
  };
}

export function evaluateShareLink(link, opts = {}, now = Date.now()) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  if (link.revoked) return { ok: false, reason: 'revoked' };
  if (link.expiresAt != null && now > link.expiresAt) return { ok: false, reason: 'expired' };
  if (link.oneTime && link.consumed) return { ok: false, reason: 'already-consumed' };
  if (link.password && link.password.required && !opts.passwordOk) return { ok: false, reason: 'password-required' };
  return { ok: true, reason: 'valid' };
}

export function consumeShareLink(link, now = Date.now()) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  const next = { ...link };
  if (next.oneTime) next.consumed = true;
  next.lastUsedAt = now;
  return { ok: true, link: next };
}

/* 52242 — Password-protected share links. */
export function setLinkPassword(link, digest, salt = 'infinity-ai') {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  if (typeof digest !== 'string' || digest.length === 0) return { ok: false, reason: 'digest required' };
  return { ok: true, link: { ...link, password: { required: true, salt, digest } } };
}

export function checkLinkPassword(link, attemptDigest) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  if (!link.password || !link.password.required) return { ok: true, reason: 'no-password-set' };
  return attemptDigest === link.password.digest
    ? { ok: true, reason: 'match' }
    : { ok: false, reason: 'mismatch' };
}

/* 52243 — Role-based link permissions. */
export const LINK_ROLE_PERMISSIONS = {
  viewer: { view: true, comment: false, triage: false, manage: false },
  commenter: { view: true, comment: true, triage: false, manage: false },
  triager: { view: true, comment: true, triage: true, manage: false },
  admin: { view: true, comment: true, triage: true, manage: true },
};

export function checkRoleAction(role, action) {
  const perms = LINK_ROLE_PERMISSIONS[role];
  if (!perms) return { ok: false, reason: `unknown-role:${role}` };
  return { ok: perms[action] === true, role, action, allowed: perms[action] === true };
}

export function assignLinkRole(link, role) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  if (!LINK_ROLE_PERMISSIONS[role]) return { ok: false, reason: `unknown-role:${role}` };
  return { ok: true, link: { ...link, role } };
}

/* 52244 — Per-finding share links. */
export function buildFindingLink(finding, baseUrl, opts = {}, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const base = String(baseUrl || 'https://app.infinity-ai.example').replace(/\/+$/, '');
  const token = tokenFor('finding', finding.id, now);
  return {
    ok: true,
    link: {
      token, findingId: finding.id, huntId: finding.huntId || null, scope: 'finding',
      role: opts.role || 'viewer', visibility: 'internal', createdAt: now,
      expiresAt: typeof opts.ttlMs === 'number' ? now + opts.ttlMs : null,
      consumed: false, revoked: false, password: null, allowedCidrs: null,
    },
    url: `${base}/s/f/${token}`,
  };
}

/* 52245 — Team workspaces (post-hunt). */
export function createWorkspace(input = {}, now = Date.now()) {
  if (!input.name || typeof input.name !== 'string') return { ok: false, reason: 'name required' };
  const members = Array.isArray(input.members) ? input.members.map((m) => ({
    email: m.email, role: LINK_ROLE_PERMISSIONS[m.role] ? m.role : 'viewer', joinedAt: now,
  })) : [];
  return {
    ok: true,
    workspace: {
      id: `ws_${tokenFor('ws', input.name, now)}`, name: input.name,
      huntIds: Array.isArray(input.huntIds) ? [...input.huntIds] : [],
      members, activity: [], createdAt: now,
    },
  };
}

export function addWorkspaceEvent(workspace, event, now = Date.now()) {
  if (!workspace || !workspace.id) return { ok: false, reason: 'workspace required' };
  if (!event || !event.kind) return { ok: false, reason: 'event kind required' };
  return {
    ok: true,
    workspace: { ...workspace, activity: [...workspace.activity, { ...event, at: now }] },
  };
}

/* 52246 — Email invite to results. */
export function buildEmailInvite(email, hunt, baseUrl, opts = {}, now = Date.now()) {
  if (typeof email !== 'string' || !email.includes('@')) return { ok: false, reason: 'valid email required' };
  if (!hunt || !hunt.id) return { ok: false, reason: 'hunt with id required' };
  const base = String(baseUrl || 'https://app.infinity-ai.example').replace(/\/+$/, '');
  const ttlMs = typeof opts.ttlMs === 'number' ? opts.ttlMs : 7 * 24 * 3600 * 1000;
  return {
    ok: true,
    invite: {
      to: email, subject: `You're invited: hunt results for ${hunt.target || hunt.id}`,
      deepLink: `${base}/hunts/${hunt.id}?invite=${tokenFor('invite', email, now)}`,
      role: opts.role && LINK_ROLE_PERMISSIONS[opts.role] ? opts.role : 'viewer',
      sentAt: now, expiresAt: now + ttlMs,
    },
  };
}

/* 52247 — SSO group-synced sharing. */
export function resolveSsoRole(userGroups, mapping) {
  if (!Array.isArray(userGroups)) return { ok: false, reason: 'userGroups array required' };
  const map = mapping && typeof mapping === 'object' ? mapping : {};
  // Highest-privilege match wins: admin > triager > commenter > viewer.
  const rank = { viewer: 0, commenter: 1, triager: 2, admin: 3 };
  let best = null;
  for (const g of userGroups) {
    const role = map[g];
    if (role && rank[role] != null && (best == null || rank[role] > rank[best])) best = role;
  }
  return { ok: true, role: best || 'viewer', matched: best != null };
}

/* 52248 — Share to Slack channel. */
export function buildSlackPayload(hunt, linkUrl, now = Date.now()) {
  if (!hunt || !Array.isArray(hunt.findings)) return { ok: false, reason: 'hunt with findings array required' };
  const s = summarize(hunt.findings);
  const sev = Object.entries(s.bySeverity).sort((a, b) => (SEVERITY_ORDER[b[0]] || 0) - (SEVERITY_ORDER[a[0]] || 0));
  const lines = sev.map(([k, v]) => `• ${k}: ${v}`).join('\n');
  return {
    ok: true,
    payload: {
      text: `Infinity AI hunt complete: ${hunt.target} — ${s.total} findings`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `*Hunt complete — ${hunt.target}*\n${s.total} findings` } },
        { type: 'section', text: { type: 'mrkdwn', text: lines || 'No findings' } },
        ...(linkUrl ? [{ type: 'section', text: { type: 'mrkdwn', text: `<${linkUrl}|Open hunt results>` } }] : []),
      ],
      sentAt: now,
    },
  };
}

/* 52249 — Share to Microsoft Teams. */
export function buildTeamsPayload(hunt, linkUrl, now = Date.now()) {
  if (!hunt || !Array.isArray(hunt.findings)) return { ok: false, reason: 'hunt with findings array required' };
  const s = summarize(hunt.findings);
  const facts = Object.entries(s.bySeverity).map(([k, v]) => ({ title: k, value: String(v) }));
  return {
    ok: true,
    payload: {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard', version: '1.4',
          body: [
            { type: 'TextBlock', size: 'Large', weight: 'Bolder', text: `Hunt complete — ${hunt.target}` },
            { type: 'TextBlock', text: `${s.total} findings`, wrap: true },
            { type: 'FactSet', facts },
          ],
          ...(linkUrl ? { actions: [{ type: 'Action.OpenUrl', title: 'Open hunt results', url: linkUrl }] } : {}),
        },
      }],
      sentAt: now,
    },
  };
}

/* 52250 — Share to Discord webhook. */
export function buildDiscordPayload(hunt, linkUrl, now = Date.now()) {
  if (!hunt || !Array.isArray(hunt.findings)) return { ok: false, reason: 'hunt with findings array required' };
  const s = summarize(hunt.findings);
  const desc = Object.entries(s.bySeverity).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'No findings';
  return {
    ok: true,
    payload: {
      content: `**Infinity AI hunt complete — ${hunt.target}** (${s.total} findings)`,
      embeds: [{ title: 'Severity breakdown', description: desc, ...(linkUrl ? { url: linkUrl } : {}) }],
      sentAt: now,
    },
  };
}

/* 52251 — Embeddable results widget. */
export function buildEmbedWidget(hunt, opts = {}) {
  if (!hunt || !hunt.id) return { ok: false, reason: 'hunt with id required' };
  const base = String(opts.baseUrl || 'https://app.infinity-ai.example').replace(/\/+$/, '');
  const params = new URLSearchParams({ theme: opts.theme || 'dark', token: opts.token || '' });
  const src = `${base}/embed/hunts/${hunt.id}?${params.toString()}`;
  return {
    ok: true,
    widget: {
      kind: 'iframe', src,
      width: typeof opts.width === 'number' ? opts.width : 640,
      height: typeof opts.height === 'number' ? opts.height : 360,
      sandbox: 'allow-scripts allow-same-origin',
      html: `<iframe src="${src}" width="${typeof opts.width === 'number' ? opts.width : 640}" height="${typeof opts.height === 'number' ? opts.height : 360}" sandbox="allow-scripts allow-same-origin" title="Infinity AI hunt stats"></iframe>`,
    },
  };
}

/* 52252 — Public vs private link toggle. */
export function setLinkVisibility(link, visibility) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  if (visibility !== 'internal' && visibility !== 'public') return { ok: false, reason: 'visibility must be internal|public' };
  const warnings = visibility === 'public'
    ? ['Public links can be opened by anyone with the URL.', 'Search engines may index unprotected shared pages — keep sensitive hunts internal.']
    : [];
  return { ok: true, link: { ...link, visibility }, warnings };
}

/* 52253 — Share-link access logs. */
export function logLinkAccess(log, link, access, now = Date.now()) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  const entry = {
    token: link.token, viewer: access && access.viewer ? access.viewer : 'anonymous',
    ip: access && access.ip ? access.ip : null, userAgent: access && access.userAgent ? access.userAgent : null,
    at: now,
  };
  return { ok: true, log: [...(Array.isArray(log) ? log : []), entry], entry };
}

export function summarizeAccessLog(log) {
  const rows = Array.isArray(log) ? log : [];
  const viewers = new Set(rows.map((r) => r.viewer));
  return { opens: rows.length, uniqueViewers: viewers.size, lastOpenAt: rows.length ? Math.max(...rows.map((r) => r.at)) : null };
}

/* 52254 — Instant link revocation. */
export function revokeShareLink(link, opts = {}, now = Date.now()) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  return {
    ok: true,
    link: { ...link, revoked: true, revokedAt: now, revokeReason: opts.reason || 'manual' },
    sessionsInvalidated: true,
  };
}

/* 52255 — Filtered-view sharing. */
export function buildFilteredShareView(hunt, filters = {}) {
  if (!hunt || !Array.isArray(hunt.findings)) return { ok: false, reason: 'hunt with findings array required' };
  let rows = [...hunt.findings];
  if (filters.severity) rows = rows.filter((f) => f.severity === filters.severity);
  if (filters.status) rows = rows.filter((f) => f.status === filters.status);
  if (filters.minSeverity) {
    rows = rows.filter((f) => (SEVERITY_ORDER[f.severity] || 0) >= (SEVERITY_ORDER[filters.minSeverity] || 0));
  }
  return {
    ok: true,
    view: { filters: { ...filters }, findings: rows.map((f) => f.id), counts: summarize(rows) },
  };
}

/* 52256 — External client portal. */
export function buildClientPortal(hunt, org = {}) {
  if (!hunt || !hunt.id) return { ok: false, reason: 'hunt with id required' };
  const s = Array.isArray(hunt.findings) ? summarize(hunt.findings) : { total: 0, bySeverity: {} };
  return {
    ok: true,
    portal: {
      brand: { name: org.name || 'Infinity AI', logo: org.logo || null, primaryColor: org.primaryColor || '#7c6cf0' },
      navigation: [], // stripped: no app nav for external viewers
      hunts: [{ id: hunt.id, target: hunt.target || hunt.id, summary: s }],
      permissions: { view: true, comment: false, triage: false, manage: false },
    },
  };
}

/* 52257 — NDA-gated share links. */
export function ndaGate(link, ndaText) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  return {
    ok: true,
    gate: {
      screen: 'nda', linkToken: link.token,
      text: ndaText || 'By viewing these results you agree to keep them confidential and not redistribute them.',
    },
  };
}

export function acceptNda(gate, viewer, now = Date.now()) {
  if (!gate || gate.screen !== 'nda') return { ok: false, reason: 'nda gate required' };
  if (typeof viewer !== 'string' || viewer.length === 0) return { ok: false, reason: 'viewer required' };
  return { ok: true, acceptance: { linkToken: gate.linkToken, viewer, acceptedAt: now } };
}

/* 52258 — Summary-only sharing. */
export function buildSummaryOnly(hunt, now = Date.now()) {
  if (!hunt || !Array.isArray(hunt.findings)) return { ok: false, reason: 'hunt with findings array required' };
  const s = summarize(hunt.findings);
  const open = hunt.findings.filter((f) => f.status !== 'fixed' && f.status !== 'false-positive').length;
  const fixed = hunt.findings.filter((f) => f.status === 'fixed').length;
  const score = hunt.findings.reduce((acc, f) => acc + (SEVERITY_ORDER[f.severity] || 0), 0);
  return {
    ok: true,
    summary: {
      target: hunt.target || hunt.id, generatedAt: now,
      total: s.total, bySeverity: s.bySeverity,
      riskScore: hunt.findings.length ? Math.round((score / (4 * hunt.findings.length)) * 100) : 0,
      remediation: { open, fixed },
      findingDetails: [], // deliberately empty: summary-only
    },
  };
}

/* 52259 — Redacted sharing mode. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SECRET_RE = /(api[_-]?key|secret|token|passwd|password)\s*[:=]\s*['"]?[^'"\s,}]+['"]?/gi;

export function redactForSharing(finding) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  const scrub = (v) => String(v ?? '').replace(EMAIL_RE, '[redacted-email]').replace(SECRET_RE, '$1=[redacted]');
  return {
    ok: true,
    finding: {
      id: finding.id, title: finding.title, severity: finding.severity, status: finding.status,
      impact: finding.impact || finding.description || null,
      description: scrub(finding.description),
      evidence: Array.isArray(finding.evidence)
        ? finding.evidence.map((e) => ({ kind: e.kind, summary: scrub(e.summary), body: '[redacted]' }))
        : [],
      poc: null, pocPython: null, // never shared in redacted mode
      remediation: finding.remediation || null,
    },
  };
}

/* 52260 — Threaded comments on shared views. */
export function createCommentThread(input = {}, now = Date.now()) {
  if (!input.findingId && !input.huntId) return { ok: false, reason: 'findingId or huntId required' };
  return {
    ok: true,
    thread: {
      id: `th_${tokenFor('thread', `${input.findingId || input.huntId}`, now)}`,
      findingId: input.findingId || null, huntId: input.huntId || null,
      comments: [], resolved: false, createdAt: now,
    },
  };
}

export function addThreadComment(thread, comment, now = Date.now()) {
  if (!thread || !thread.id) return { ok: false, reason: 'thread required' };
  if (!comment || !comment.author || !comment.body) return { ok: false, reason: 'author and body required' };
  const next = {
    id: `c_${tokenFor('comment', `${thread.id}:${thread.comments.length}`, now)}`,
    author: comment.author, body: String(comment.body), at: now,
    parentId: comment.parentId || null, // threading: replies carry parentId
  };
  return { ok: true, thread: { ...thread, comments: [...thread.comments, next] }, comment: next };
}

export function resolveThread(thread, resolver, now = Date.now()) {
  if (!thread || !thread.id) return { ok: false, reason: 'thread required' };
  return { ok: true, thread: { ...thread, resolved: true, resolvedBy: resolver || null, resolvedAt: now } };
}
