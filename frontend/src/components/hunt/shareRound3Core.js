/**
 * shareRound3Core.js — Infinity AI · Dark-Matter · Wave 58 (ideas 52281–52299)
 * Pure JS (no React / DOM / network). Deterministic post-hunt sharing round-3
 * models: collaboration agreements, multi-team sharing, notification center,
 * link previews, live embeds, digests, mobile/print specs, approval workflows,
 * delegated sharing, quotas, slugs, branding, dashboards, chat payloads,
 * field permissions, two-factor gates and access requests. Time is injected
 * via `now` params (default Date.now()) so every function is reproducible.
 */

export const WAVE58_SR3_IDEAS = [
  { id: 52281, title: 'Bounty collaborator sharing with collaboration-agreement scope model', skip: false },
  { id: 52282, title: 'Multi-team hunt sharing with per-team filtered views and comment spaces', skip: false },
  { id: 52283, title: 'Share notification center with accept/decline reducer', skip: false },
  { id: 52284, title: 'Link preview card payloads (title, severity counts, risk score)', skip: false },
  { id: 52285, title: 'Notion/Confluence live-embed descriptors', skip: false },
  { id: 52286, title: 'Shared digest email composer', skip: false },
  { id: 52287, title: 'Mobile-friendly shared-view spec', skip: false },
  { id: 52288, title: 'Link expiry extension without regeneration', skip: false },
  { id: 52289, title: 'Share approval workflow state machine', skip: false },
  { id: 52290, title: 'Delegated sharing rights grants', skip: false },
  { id: 52291, title: 'Share-link usage quotas evaluator', skip: false },
  { id: 52292, title: 'Custom link slugs validator/generator', skip: false },
  { id: 52293, title: 'Branded share pages descriptor (logo/colors)', skip: false },
  { id: 52294, title: 'Shared team dashboard aggregator payload', skip: false },
  { id: 52295, title: 'Share-finding-to-chat payload builder', skip: false },
  { id: 52296, title: 'Granular finding-field permission evaluator (role x field)', skip: false },
  { id: 52297, title: 'Share-link two-factor email-code gate', skip: false },
  { id: 52298, title: 'Shared-view print-mode spec', skip: false },
  { id: 52299, title: 'Share access request flow with owner approval routing', skip: false },
];

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `sr3_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function summarize(findings) {
  const bySeverity = {};
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  return { total: findings.length, bySeverity };
}

function riskScoreOf(findings) {
  if (!findings.length) return 0;
  const score = findings.reduce((acc, f) => acc + (SEVERITY_ORDER[f.severity] || 0), 0);
  return Math.round((score / (4 * findings.length)) * 100);
}

/* 52281 — Bounty collaborator sharing with collaboration-agreement scope model. */
export const AGREEMENT_SCOPES = ['summary-only', 'findings-read', 'findings-triage'];

export function createCollabAgreement(input = {}, now = Date.now()) {
  if (!input.huntId) return { ok: false, reason: 'huntId required' };
  if (!Array.isArray(input.parties) || input.parties.length < 2) {
    return { ok: false, reason: 'at least two parties required' };
  }
  const scope = AGREEMENT_SCOPES.includes(input.scope) ? input.scope : 'summary-only';
  const agreement = {
    id: `agr_${tokenFor('agr', input.huntId, now)}`,
    huntId: input.huntId, scope,
    parties: input.parties.map((p) => ({
      email: p.email, name: p.name || null, accepted: false, acceptedAt: null,
    })),
    allowedSeverities: Array.isArray(input.allowedSeverities) && input.allowedSeverities.length
      ? [...input.allowedSeverities]
      : Object.keys(SEVERITY_ORDER),
    expiresAt: typeof input.expiresAt === 'number' ? input.expiresAt : now + 30 * 24 * 3600 * 1000,
    status: 'draft', createdAt: now,
  };
  return { ok: true, agreement };
}

export function acceptAgreement(agreement, email, now = Date.now()) {
  if (!agreement || !agreement.id) return { ok: false, reason: 'agreement required' };
  if (agreement.status !== 'draft' && agreement.status !== 'active') {
    return { ok: false, reason: `cannot accept while ${agreement.status}` };
  }
  const parties = agreement.parties.map((p) => (p.email === email
    ? { ...p, accepted: true, acceptedAt: now } : p));
  const allAccepted = parties.every((p) => p.accepted);
  return {
    ok: true,
    agreement: { ...agreement, parties, status: allAccepted ? 'active' : agreement.status },
    allAccepted,
  };
}

export function checkAgreementScope(agreement, finding) {
  if (!agreement || !agreement.id) return { ok: false, reason: 'agreement required' };
  if (!finding || !finding.id) return { ok: false, reason: 'finding required' };
  if (agreement.status !== 'active') return { ok: false, reason: `agreement ${agreement.status}`, allowed: false };
  if (!agreement.allowedSeverities.includes(finding.severity)) {
    return { ok: false, reason: 'severity out of agreed scope', allowed: false };
  }
  return { ok: true, allowed: true, scope: agreement.scope };
}

/* 52282 — Multi-team hunt sharing: per-team filtered views + separate comment spaces. */
export function shareToTeams(hunt, teamSpecs = [], now = Date.now()) {
  if (!hunt || !hunt.id || !Array.isArray(hunt.findings)) {
    return { ok: false, reason: 'hunt with findings array required' };
  }
  if (!Array.isArray(teamSpecs) || teamSpecs.length === 0) {
    return { ok: false, reason: 'at least one team spec required' };
  }
  const teams = teamSpecs.map((t) => {
    let rows = [...hunt.findings];
    if (t.minSeverity) rows = rows.filter((f) => (SEVERITY_ORDER[f.severity] || 0) >= (SEVERITY_ORDER[t.minSeverity] || 0));
    if (t.status) rows = rows.filter((f) => f.status === t.status);
    return {
      teamId: t.teamId, teamName: t.teamName || t.teamId,
      view: { filters: { minSeverity: t.minSeverity || null, status: t.status || null }, findingIds: rows.map((f) => f.id), counts: summarize(rows) },
      commentSpace: { id: `cs_${tokenFor('cs', `${hunt.id}:${t.teamId}`, now)}`, teamId: t.teamId, huntId: hunt.id, threads: [] },
      token: tokenFor('team', `${hunt.id}:${t.teamId}`, now),
    };
  });
  return { ok: true, share: { huntId: hunt.id, createdAt: now, teams } };
}

export function getTeamView(share, teamId) {
  if (!share || !Array.isArray(share.teams)) return { ok: false, reason: 'share required' };
  const team = share.teams.find((t) => t.teamId === teamId);
  if (!team) return { ok: false, reason: 'unknown team' };
  return { ok: true, team };
}

/* 52283 — Share notification center with accept/decline reducer. */
export const NOTIF_TYPES = ['share-invite', 'agreement-signed', 'access-request', 'comment-mention'];

export function createNotification(input = {}, now = Date.now()) {
  if (!input.to || !NOTIF_TYPES.includes(input.type)) {
    return { ok: false, reason: 'to and valid type required' };
  }
  return {
    ok: true,
    notification: {
      id: `nt_${tokenFor('nt', `${input.to}:${input.type}`, now)}`,
      to: input.to, type: input.type, from: input.from || null,
      refId: input.refId || null, status: 'unread', createdAt: now, decidedAt: null,
    },
  };
}

export function notificationReducer(state, action = {}, now = Date.now()) {
  const rows = Array.isArray(state) ? state : [];
  switch (action.type) {
    case 'NOTIF_ADD': {
      if (!action.notification || !action.notification.id) return rows;
      return [action.notification, ...rows];
    }
    case 'NOTIF_ACCEPT':
    case 'NOTIF_DECLINE': {
      const decision = action.type === 'NOTIF_ACCEPT' ? 'accepted' : 'declined';
      return rows.map((n) => (n.id === action.id
        ? { ...n, status: decision, decidedAt: now } : n));
    }
    case 'NOTIF_DISMISS':
      return rows.filter((n) => n.id !== action.id);
    case 'NOTIF_READ':
      return rows.map((n) => (n.id === action.id ? { ...n, status: n.status === 'unread' ? 'read' : n.status } : n));
    default:
      return rows;
  }
}

/* 52284 — Link preview card payloads (title, severity counts, risk score). */
export function buildLinkPreview(hunt, link, now = Date.now()) {
  if (!hunt || !hunt.id || !Array.isArray(hunt.findings)) {
    return { ok: false, reason: 'hunt with findings array required' };
  }
  const s = summarize(hunt.findings);
  return {
    ok: true,
    preview: {
      title: `Infinity AI hunt — ${hunt.target || hunt.id}`,
      severityCounts: s.bySeverity, total: s.total,
      riskScore: riskScoreOf(hunt.findings),
      token: link && link.token ? link.token : null,
      expiresAt: link && typeof link.expiresAt === 'number' ? link.expiresAt : null,
      generatedAt: now,
    },
  };
}

/* 52285 — Notion/Confluence live-embed descriptors. */
export const EMBED_TARGETS = ['notion', 'confluence'];

export function buildLiveEmbed(hunt, target, opts = {}, now = Date.now()) {
  if (!hunt || !hunt.id) return { ok: false, reason: 'hunt with id required' };
  if (!EMBED_TARGETS.includes(target)) return { ok: false, reason: `target must be ${EMBED_TARGETS.join('|')}` };
  const base = String(opts.baseUrl || 'https://app.infinity-ai.example').replace(/\/+$/, '');
  const src = `${base}/embed/hunts/${hunt.id}?live=1&token=${opts.token || tokenFor('embed', hunt.id, now)}`;
  return {
    ok: true,
    embed: {
      target,
      kind: target === 'notion' ? 'embed-block' : 'html-macro',
      src,
      instructions: target === 'notion'
        ? 'Paste this URL into a Notion page and choose "Create embed".'
        : 'Use the Confluence "HTML macro" and paste this URL into the iframe src.',
      refreshIntervalSec: typeof opts.refreshIntervalSec === 'number' ? opts.refreshIntervalSec : 300,
      createdAt: now,
    },
  };
}

/* 52286 — Shared digest email composer. */
export function composeDigest(hunt, opts = {}, now = Date.now()) {
  if (!hunt || !Array.isArray(hunt.findings)) return { ok: false, reason: 'hunt with findings array required' };
  if (typeof opts.to !== 'string' || !opts.to.includes('@')) return { ok: false, reason: 'valid to address required' };
  const s = summarize(hunt.findings);
  const top = [...hunt.findings]
    .sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0))
    .slice(0, typeof opts.topN === 'number' ? opts.topN : 5);
  const lines = top.map((f, i) => `${i + 1}. [${f.severity}] ${f.title} (status: ${f.status || 'open'})`);
  return {
    ok: true,
    digest: {
      to: opts.to,
      subject: `Hunt digest: ${hunt.target || hunt.id} — ${s.total} findings, risk ${riskScoreOf(hunt.findings)}/100`,
      body: `Infinity AI hunt results for ${hunt.target || hunt.id}.\n\nTotal findings: ${s.total}\nSeverity breakdown: ${Object.entries(s.bySeverity).map(([k, v]) => `${k}: ${v}`).join(', ')}\n\nTop findings:\n${lines.join('\n') || 'None'}`,
      topFindings: top.map((f) => ({ id: f.id, title: f.title, severity: f.severity })),
      composedAt: now,
    },
  };
}

/* 52287 — Mobile-friendly shared-view spec. */
export function buildMobileViewSpec(view, opts = {}) {
  if (!view || typeof view !== 'object') return { ok: false, reason: 'view required' };
  return {
    ok: true,
    spec: {
      viewport: 'device-width',
      breakpoints: { phone: 480, tablet: 768 },
      cardsStacked: true,
      summaryFirst: opts.summaryFirst !== false,
      severityFilterChips: true,
      charts: { kind: opts.charts || 'compact', inline: true },
      commentInput: 'bottom-sheet',
      touchTargetsMinPx: 44,
    },
  };
}

/* 52288 — Link expiry extension without regeneration. */
export function extendLinkExpiry(link, extraMs, now = Date.now()) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  if (typeof extraMs !== 'number' || extraMs <= 0) return { ok: false, reason: 'positive extraMs required' };
  if (link.revoked) return { ok: false, reason: 'link revoked' };
  const base = typeof link.expiresAt === 'number' ? Math.max(link.expiresAt, now) : now;
  return {
    ok: true,
    link: { ...link, expiresAt: base + extraMs },
    tokenUnchanged: true,
    extension: { addedMs: extraMs, extendedAt: now, extendedBy: 'owner' },
  };
}

/* 52289 — Share approval workflow state machine. */
export const APPROVAL_STATES = ['requested', 'approved', 'declined', 'expired'];

export function createApprovalRequest(input = {}, now = Date.now()) {
  if (!input.linkToken && !input.huntId) return { ok: false, reason: 'linkToken or huntId required' };
  if (!input.requestedBy) return { ok: false, reason: 'requestedBy required' };
  if (!input.owner) return { ok: false, reason: 'owner (approver) required' };
  return {
    ok: true,
    request: {
      id: `apr_${tokenFor('apr', `${input.requestedBy}:${input.huntId || input.linkToken}`, now)}`,
      linkToken: input.linkToken || null, huntId: input.huntId || null,
      requestedBy: input.requestedBy, owner: input.owner,
      state: 'requested', reason: input.reason || null,
      createdAt: now, decidedAt: null, decidedBy: null,
      ttlMs: typeof input.ttlMs === 'number' ? input.ttlMs : 24 * 3600 * 1000,
    },
  };
}

export function approvalReducer(request, action = {}, now = Date.now()) {
  if (!request || !request.id) return { ok: false, reason: 'request required' };
  if (request.state === 'requested' && now > request.createdAt + request.ttlMs) {
    return { ok: true, request: { ...request, state: 'expired', decidedAt: now } };
  }
  const transitions = { APPROVE: 'approved', DECLINE: 'declined' };
  if (request.state !== 'requested' || !transitions[action.type]) {
    return { ok: false, reason: `no transition ${action.type} from ${request.state}` };
  }
  return {
    ok: true,
    request: { ...request, state: transitions[action.type], decidedAt: now, decidedBy: action.by || request.owner },
  };
}

/* 52290 — Delegated sharing rights grants. */
export const DELEGABLE_ACTIONS = ['share-view', 'share-comment', 'share-manage'];

export function grantDelegatedShare(input = {}, now = Date.now()) {
  if (!input.grantor || !input.grantee) return { ok: false, reason: 'grantor and grantee required' };
  if (!Array.isArray(input.actions) || !input.actions.every((a) => DELEGABLE_ACTIONS.includes(a))) {
    return { ok: false, reason: `actions must be a subset of ${DELEGABLE_ACTIONS.join(', ')}` };
  }
  if (typeof input.expiresAt !== 'number' || input.expiresAt <= now) {
    return { ok: false, reason: 'future expiresAt required' };
  }
  return {
    ok: true,
    grant: {
      id: `del_${tokenFor('del', `${input.grantor}:${input.grantee}`, now)}`,
      grantor: input.grantor, grantee: input.grantee,
      actions: [...input.actions], scope: input.scope || 'hunt',
      huntIds: Array.isArray(input.huntIds) ? [...input.huntIds] : [],
      grantedAt: now, expiresAt: input.expiresAt, revoked: false,
    },
  };
}

export function canDelegateShare(grant, action, huntId, now = Date.now()) {
  if (!grant || !grant.id) return { ok: false, reason: 'grant required', allowed: false };
  if (grant.revoked) return { ok: false, reason: 'grant revoked', allowed: false };
  if (now > grant.expiresAt) return { ok: false, reason: 'grant expired', allowed: false };
  if (!grant.actions.includes(action)) return { ok: false, reason: `action ${action} not granted`, allowed: false };
  if (huntId && grant.huntIds.length && !grant.huntIds.includes(huntId)) {
    return { ok: false, reason: 'hunt out of grant scope', allowed: false };
  }
  return { ok: true, allowed: true };
}

/* 52291 — Share-link usage quotas evaluator. */
export function evaluateQuota(link, usage = {}, now = Date.now()) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  const quota = link.quota && typeof link.quota.maxOpens === 'number' ? link.quota.maxOpens : null;
  if (quota == null) return { ok: true, allowed: true, remaining: null, unlimited: true };
  const opens = typeof usage.opens === 'number' ? usage.opens : 0;
  const remaining = Math.max(0, quota - opens);
  const perDay = link.quota.maxOpensPerDay;
  let dailyRemaining = null;
  if (typeof perDay === 'number' && usage.dailyOpens && typeof usage.dailyOpens === 'object') {
    const dayKey = new Date(now).toISOString().slice(0, 10);
    dailyRemaining = Math.max(0, perDay - (usage.dailyOpens[dayKey] || 0));
  }
  const allowed = remaining > 0 && (dailyRemaining == null || dailyRemaining > 0);
  return {
    ok: true, allowed, remaining, dailyRemaining,
    reason: allowed ? 'within-quota' : 'quota-exhausted',
  };
}

/* 52292 — Custom link slugs validator/generator. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,46}[a-z0-9]$/;
const RESERVED_SLUGS = new Set(['admin', 'api', 'login', 'share', 'embed', 'health', 'infinity']);

export function validateSlug(slug) {
  if (typeof slug !== 'string' || slug.length === 0) return { ok: false, reason: 'slug required' };
  if (slug.length < 4 || slug.length > 48) return { ok: false, reason: 'slug must be 4–48 chars' };
  if (!SLUG_RE.test(slug)) return { ok: false, reason: 'slug must be lowercase alphanumeric with dashes, no leading/trailing dash' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: 'reserved slug' };
  return { ok: true, slug };
}

export function generateSlug(seed, taken = [], now = Date.now()) {
  if (typeof seed !== 'string' || seed.length === 0) return { ok: false, reason: 'seed required' };
  const used = new Set(Array.isArray(taken) ? taken : []);
  const base = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'share';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${(tokenFor('slug', `${seed}:${attempt}`, now)).slice(-4)}`;
    const candidate = `${base}${suffix}`;
    if (validateSlug(candidate).ok && !used.has(candidate)) return { ok: true, slug: candidate };
  }
  return { ok: false, reason: 'could not generate a unique slug' };
}

/* 52293 — Branded share pages descriptor (logo/colors). */
export function buildBrandedPage(org = {}, opts = {}) {
  const brand = {
    name: org.name || 'Infinity AI',
    logo: org.logo || null,
    primaryColor: org.primaryColor || '#7c6cf0',
    secondaryColor: org.secondaryColor || '#0f1420',
    font: org.font || 'Inter, system-ui, sans-serif',
    footerText: org.footerText || 'Shared securely via Infinity AI',
  };
  return {
    ok: true,
    page: {
      brand,
      layout: opts.layout || 'centered',
      showInfinityBadge: opts.hideBadge !== true,
      customCss: typeof opts.customCss === 'string' ? opts.customCss : null,
    },
  };
}

/* 52294 — Shared team dashboard aggregator payload. */
export function aggregateTeamDashboard(shares = [], now = Date.now()) {
  if (!Array.isArray(shares)) return { ok: false, reason: 'shares array required' };
  const perShare = shares.map((s) => ({
    huntId: s.huntId, teamCount: Array.isArray(s.teams) ? s.teams.length : 0,
    findingsShared: Array.isArray(s.teams) ? s.teams.reduce((a, t) => a + (t.view ? t.view.findingIds.length : 0), 0) : 0,
  }));
  return {
    ok: true,
    dashboard: {
      generatedAt: now,
      hunts: perShare,
      totals: {
        hunts: perShare.length,
        teams: perShare.reduce((a, s) => a + s.teamCount, 0),
        findingsShared: perShare.reduce((a, s) => a + s.findingsShared, 0),
      },
    },
  };
}

/* 52295 — Share-finding-to-chat payload builder. */
export const CHAT_CHANNELS = ['slack', 'teams', 'discord'];

export function buildChatSharePayload(finding, channel, linkUrl, now = Date.now()) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  if (!CHAT_CHANNELS.includes(channel)) return { ok: false, reason: `channel must be ${CHAT_CHANNELS.join('|')}` };
  const head = `[${finding.severity}] ${finding.title}`;
  if (channel === 'slack') {
    return {
      ok: true, channel,
      payload: {
        text: `Infinity AI finding shared: ${head}`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `*${head}*\n${finding.impact || finding.description || ''}` } },
          ...(linkUrl ? [{ type: 'section', text: { type: 'mrkdwn', text: `<${linkUrl}|Open finding>` } }] : []),
        ],
        sentAt: now,
      },
    };
  }
  if (channel === 'teams') {
    return {
      ok: true, channel,
      payload: {
        type: 'message',
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard', version: '1.4',
            body: [
              { type: 'TextBlock', size: 'Large', weight: 'Bolder', text: head },
              { type: 'TextBlock', text: finding.impact || finding.description || '', wrap: true },
            ],
            ...(linkUrl ? { actions: [{ type: 'Action.OpenUrl', title: 'Open finding', url: linkUrl }] } : {}),
          },
        }],
        sentAt: now,
      },
    };
  }
  return {
    ok: true, channel,
    payload: {
      content: `**Infinity AI finding shared — ${head}**`,
      embeds: [{ title: finding.title, description: (finding.impact || finding.description || '').slice(0, 500), ...(linkUrl ? { url: linkUrl } : {}) }],
      sentAt: now,
    },
  };
}

/* 52296 — Granular finding-field permission evaluator (role x field). */
export const FIELD_ROLES = ['viewer', 'commenter', 'triager', 'owner'];
export const FIELD_PERMISSIONS = {
  viewer: { title: true, severity: true, status: true, description: true, impact: false, evidence: false, poc: false, remediation: true, assignee: true },
  commenter: { title: true, severity: true, status: true, description: true, impact: true, evidence: false, poc: false, remediation: true, assignee: true },
  triager: { title: true, severity: true, status: true, description: true, impact: true, evidence: true, poc: true, remediation: true, assignee: true },
  owner: { title: true, severity: true, status: true, description: true, impact: true, evidence: true, poc: true, remediation: true, assignee: true },
};

export function checkFieldAccess(role, field) {
  const perms = FIELD_PERMISSIONS[role];
  if (!perms) return { ok: false, reason: `unknown-role:${role}`, allowed: false };
  if (!(field in perms)) return { ok: false, reason: `unknown-field:${field}`, allowed: false };
  return { ok: true, role, field, allowed: perms[field] === true };
}

export function visibleFields(role) {
  const perms = FIELD_PERMISSIONS[role];
  if (!perms) return { ok: false, reason: `unknown-role:${role}` };
  return { ok: true, fields: Object.keys(perms).filter((f) => perms[f]) };
}

/* 52297 — Share-link two-factor email-code gate. */
export function issueEmailCode(link, email, now = Date.now()) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  if (typeof email !== 'string' || !email.includes('@')) return { ok: false, reason: 'valid email required' };
  // Deterministic 6-digit code derived from link+email+time (real delivery is
  // server-side; this model carries the gate lifecycle for UI/tests).
  let h = 7;
  const raw = `${link.token}:${email}:${Math.floor(now / 60000)}`;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  const code = String((h >>> 0) % 900000 + 100000);
  return {
    ok: true,
    gate: {
      linkToken: link.token, email, code,
      issuedAt: now, expiresAt: now + 10 * 60 * 1000,
      attempts: 0, maxAttempts: 3, verified: false,
    },
  };
}

export function verifyEmailCode(gate, attempt, now = Date.now()) {
  if (!gate || !gate.linkToken) return { ok: false, reason: 'gate required', verified: false };
  if (gate.verified) return { ok: true, verified: true, reason: 'already-verified' };
  if (now > gate.expiresAt) return { ok: false, reason: 'code-expired', verified: false };
  if (gate.attempts >= gate.maxAttempts) return { ok: false, reason: 'attempts-exhausted', verified: false };
  const next = { ...gate, attempts: gate.attempts + 1 };
  if (String(attempt) === gate.code) return { ok: true, verified: true, gate: { ...next, verified: true } };
  return { ok: false, reason: 'mismatch', verified: false, gate: next };
}

/* 52298 — Shared-view print-mode spec. */
export function buildPrintSpec(view, opts = {}) {
  if (!view || typeof view !== 'object') return { ok: false, reason: 'view required' };
  return {
    ok: true,
    spec: {
      page: { size: opts.pageSize || 'A4', orientation: opts.orientation || 'portrait', marginsMm: 12 },
      include: {
        summary: true, severityChart: opts.severityChart !== false,
        findingList: true, comments: opts.comments === true,
        evidenceBodies: false, // never printed: too long / sensitive
      },
      header: 'Infinity AI — hunt share (printed)',
      footer: { pageNumbers: true, printedAt: true },
      colorMode: opts.colorMode || 'grayscale-safe',
    },
  };
}

/* 52299 — Share access request flow with owner approval routing. */
export const ACCESS_REQUEST_STATES = ['requested', 'routed', 'approved', 'declined', 'expired'];

export function requestAccess(input = {}, now = Date.now()) {
  if (!input.linkToken && !input.huntId) return { ok: false, reason: 'linkToken or huntId required' };
  if (typeof input.requester !== 'string' || !input.requester.includes('@')) {
    return { ok: false, reason: 'valid requester email required' };
  }
  if (!input.owner) return { ok: false, reason: 'owner required for approval routing' };
  return {
    ok: true,
    request: {
      id: `acc_${tokenFor('acc', `${input.requester}:${input.huntId || input.linkToken}`, now)}`,
      linkToken: input.linkToken || null, huntId: input.huntId || null,
      requester: input.requester, role: input.role || 'viewer',
      state: 'requested', owner: input.owner, routedTo: null,
      createdAt: now, decidedAt: null, decidedBy: null,
    },
  };
}

export function accessRequestReducer(request, action = {}, now = Date.now()) {
  if (!request || !request.id) return { ok: false, reason: 'request required' };
  switch (request.state) {
    case 'requested':
      if (action.type === 'ROUTE') {
        return { ok: true, request: { ...request, state: 'routed', routedTo: request.owner } };
      }
      return { ok: false, reason: `no transition ${action.type} from requested` };
    case 'routed':
      if (action.type === 'APPROVE' || action.type === 'DECLINE') {
        const state = action.type === 'APPROVE' ? 'approved' : 'declined';
        return { ok: true, request: { ...request, state, decidedAt: now, decidedBy: action.by || request.owner } };
      }
      return { ok: false, reason: `no transition ${action.type} from routed` };
    default:
      return { ok: false, reason: `terminal state ${request.state}` };
  }
}
