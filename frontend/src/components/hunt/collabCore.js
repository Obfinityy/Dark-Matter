/**
 * collabCore.js — Infinity AI · Dark-Matter · Wave 57 (ideas 52261–52280)
 * Pure JS (no React / DOM / network). Deterministic collaboration models,
 * builders, evaluators and reducers for post-hunt team workflows. Time is
 * injected via `now` params (default Date.now()) so every function is
 * reproducible under a fixed clock.
 */

export const WAVE57_COLLAB_IDEAS = [
  { id: 52261, title: '@mention notifications', skip: false },
  { id: 52262, title: 'Shared-view activity feed', skip: false },
  { id: 52263, title: 'Share analytics', skip: false },
  { id: 52264, title: 'One-click copy link', skip: false },
  { id: 52265, title: 'QR code for share links', skip: false },
  { id: 52266, title: 'Share via email composer', skip: false },
  { id: 52267, title: 'Role templates', skip: false },
  { id: 52268, title: 'Time-boxed guest access (post-hunt)', skip: false },
  { id: 52269, title: 'IP-restricted share links', skip: false },
  { id: 52270, title: 'Comparison-view sharing', skip: false },
  { id: 52271, title: 'Remediation-board sharing', skip: false },
  { id: 52272, title: 'Live shared triage sessions', skip: false },
  { id: 52273, title: 'Presence indicators', skip: false },
  { id: 52274, title: 'Shared saved filters', skip: false },
  { id: 52275, title: 'Shared FP rule library', skip: false },
  { id: 52276, title: 'Shared hunt templates (post-hunt)', skip: false },
  { id: 52277, title: 'Share to Jira/Asana/Linear', skip: false },
  { id: 52278, title: 'Share manifest export', skip: false },
  { id: 52279, title: 'Per-viewer watermarking', skip: false },
  { id: 52280, title: 'Screenshot-deterrence notice', skip: false },
];

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `cb_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function summarize(findings) {
  const bySeverity = {};
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  return { total: findings.length, bySeverity };
}

/* 52261 — @mention notifications. */
export function parseMentions(text) {
  const body = String(text || '');
  const found = [];
  const re = /@([A-Za-z0-9._-]{2,40})/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

export function buildMentionNotifications(mentions, context = {}, now = Date.now()) {
  if (!Array.isArray(mentions)) return { ok: false, reason: 'mentions array required' };
  return {
    ok: true,
    notifications: mentions.map((handle) => ({
      to: handle,
      channel: (context.prefs && context.prefs[handle]) || 'in-app',
      text: `${context.author || 'someone'} mentioned you in ${context.huntId ? `hunt ${context.huntId}` : 'a comment'}: "${String(context.snippet || '').slice(0, 80)}"`,
      at: now,
    })),
  };
}

/* 52262 — Shared-view activity feed. */
export function feedReducer(events, action) {
  const rows = Array.isArray(events) ? [...events] : [];
  if (!action || !action.type) return rows;
  if (action.type === 'ADD_EVENT') {
    if (!action.event || !action.event.kind) return rows;
    return [...rows, { ...action.event }].sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  if (action.type === 'CLEAR') return [];
  return rows;
}

/* 52263 — Share analytics. */
export function computeShareAnalytics(accessLog) {
  const rows = Array.isArray(accessLog) ? accessLog : [];
  const viewers = new Set(rows.map((r) => r.viewer));
  const perFinding = {};
  for (const r of rows) {
    if (r.findingId) perFinding[r.findingId] = (perFinding[r.findingId] || 0) + 1;
  }
  const mostViewed = Object.entries(perFinding)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([findingId, opens]) => ({ findingId, opens }));
  return { opens: rows.length, uniqueViewers: viewers.size, mostViewedFindings: mostViewed };
}

/* 52264 — One-click copy link. */
export function buildCopyLinkPayload(link, baseUrl) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  const base = String(baseUrl || 'https://app.infinity-ai.example').replace(/\/+$/, '');
  const url = link.url || `${base}/s/${link.scope === 'finding' ? 'f' : 'h'}/${link.token}`;
  const expiry = link.expiresAt ? new Date(link.expiresAt).toISOString() : 'no expiry';
  return {
    ok: true,
    payload: {
      text: url,
      summary: `${link.visibility || 'internal'} · role ${link.role || 'viewer'} · expires ${expiry}${link.password && link.password.required ? ' · password-protected' : ''}`,
    },
  };
}

/* 52265 — QR code for share links. */
export function buildQrDescriptor(url, opts = {}) {
  if (typeof url !== 'string' || url.length === 0) return { ok: false, reason: 'url required' };
  const size = typeof opts.size === 'number' && opts.size > 0 ? opts.size : 256;
  return { ok: true, qr: { kind: 'qr', value: url, size, margin: 2, label: opts.label || 'Scan to open results' } };
}

/* 52266 — Share via email composer. */
export function buildEmailComposer(hunt, input = {}, now = Date.now()) {
  if (!hunt || !Array.isArray(hunt.findings)) return { ok: false, reason: 'hunt with findings array required' };
  const s = summarize(hunt.findings);
  const lines = [`Infinity AI hunt results — ${hunt.target || hunt.id}`, '', `Total findings: ${s.total}`];
  for (const [k, v] of Object.entries(s.bySeverity)) lines.push(`- ${k}: ${v}`);
  if (input.linkUrl) lines.push('', `Open results: ${input.linkUrl}`);
  return {
    ok: true,
    composer: {
      to: input.to || '', subject: input.subject || `Hunt results: ${hunt.target || hunt.id}`,
      body: lines.join('\n'),
      attachments: input.attachPdf ? [{ kind: 'pdf', name: `hunt-${hunt.id}.pdf` }] : [],
      composedAt: now,
    },
  };
}

/* 52267 — Role templates. */
export const ROLE_TEMPLATES = {
  Viewer: { view: true, comment: false, triage: false, manage: false, share: false },
  Reviewer: { view: true, comment: true, triage: true, manage: false, share: false },
  Remediator: { view: true, comment: true, triage: true, manage: false, share: true },
  Admin: { view: true, comment: true, triage: true, manage: true, share: true },
};

export function applyRoleTemplate(templateName) {
  const tpl = ROLE_TEMPLATES[templateName];
  if (!tpl) return { ok: false, reason: `unknown-template:${templateName}` };
  return { ok: true, template: templateName, permissions: { ...tpl } };
}

/* 52268 — Time-boxed guest access (post-hunt). */
export function grantGuestAccess(huntId, guestEmail, expiresAt, now = Date.now()) {
  if (!huntId) return { ok: false, reason: 'huntId required' };
  if (typeof guestEmail !== 'string' || !guestEmail.includes('@')) return { ok: false, reason: 'valid guest email required' };
  if (typeof expiresAt !== 'number' || expiresAt <= now) return { ok: false, reason: 'expiresAt must be in the future' };
  return {
    ok: true,
    grant: {
      id: tokenFor('guest', `${huntId}:${guestEmail}`, now),
      huntId, guestEmail, role: 'viewer', grantedAt: now, expiresAt,
    },
  };
}

export function isGuestGrantActive(grant, now = Date.now()) {
  if (!grant || !grant.id) return { ok: false, reason: 'grant required' };
  return { ok: true, active: now < grant.expiresAt, expiresAt: grant.expiresAt };
}

/* 52269 — IP-restricted share links. */
export function restrictLinkToIps(link, cidrs) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  if (!Array.isArray(cidrs) || cidrs.length === 0) return { ok: false, reason: 'cidrs array required' };
  return { ok: true, link: { ...link, allowedCidrs: [...cidrs] } };
}

export function checkIpAllowed(link, ip) {
  if (!link || !link.token) return { ok: false, reason: 'link required' };
  if (!link.allowedCidrs || link.allowedCidrs.length === 0) return { ok: true, allowed: true, reason: 'no-restriction' };
  if (typeof ip !== 'string') return { ok: false, allowed: false, reason: 'ip required' };
  // Dotted-quad prefix match: /8 → 1 octet, /16 → 2, /24 → 3, no slash → full match.
  const allowed = link.allowedCidrs.some((c) => {
    const [net, bitsRaw] = String(c).split('/');
    const bits = bitsRaw == null ? 32 : parseInt(bitsRaw, 10);
    const n = Math.max(0, Math.min(4, Math.ceil(bits / 8)));
    const netParts = net.split('.').slice(0, n);
    const ipParts = ip.split('.').slice(0, n);
    return netParts.length === n && netParts.join('.') === ipParts.join('.');
  });
  return { ok: true, allowed, reason: allowed ? 'in-allowlist' : 'not-in-allowlist' };
}

/* 52270 — Comparison-view sharing. */
export function buildComparisonShare(runA, runB, baseUrl, now = Date.now()) {
  if (!runA || !runB || !Array.isArray(runA.findings) || !Array.isArray(runB.findings)) {
    return { ok: false, reason: 'two runs with findings arrays required' };
  }
  const idsA = new Set(runA.findings.map((f) => f.id));
  const idsB = new Set(runB.findings.map((f) => f.id));
  const newFindings = runB.findings.filter((f) => !idsA.has(f.id)).map((f) => f.id);
  const fixedFindings = runA.findings.filter((f) => !idsB.has(f.id)).map((f) => f.id);
  const base = String(baseUrl || 'https://app.infinity-ai.example').replace(/\/+$/, '');
  const token = tokenFor('compare', `${runA.id}:${runB.id}`, now);
  return {
    ok: true,
    share: {
      token, scope: 'comparison', runA: runA.id, runB: runB.id, createdAt: now,
      delta: { newFindings, fixedFindings, carriedOver: runB.findings.length - newFindings.length },
      url: `${base}/s/compare/${token}`,
    },
  };
}

/* 52271 — Remediation-board sharing. */
export function buildRemediationBoardShare(board) {
  if (!board || !Array.isArray(board.columns)) return { ok: false, reason: 'board with columns required' };
  return {
    ok: true,
    share: {
      boardId: board.id || null, title: board.title || 'Remediation board',
      columns: board.columns.map((c) => ({
        name: c.name,
        cards: (c.cards || []).map((card) => ({ id: card.id, title: card.title, assignee: card.assignee || null })),
        // card detail (severity, PoC, evidence) intentionally excluded
      })),
    },
  };
}

/* 52272 — Live shared triage sessions. */
export function createTriageSession(huntId, reviewers = [], now = Date.now()) {
  if (!huntId) return { ok: false, reason: 'huntId required' };
  return {
    ok: true,
    session: {
      id: tokenFor('triage', huntId, now), huntId, live: true, startedAt: now,
      participants: reviewers.map((r) => ({ handle: r, joinedAt: now, cursor: null })),
    },
  };
}

export function joinTriageSession(session, handle, now = Date.now()) {
  if (!session || !session.id) return { ok: false, reason: 'session required' };
  if (session.participants.some((p) => p.handle === handle)) return { ok: true, session };
  return { ok: true, session: { ...session, participants: [...session.participants, { handle, joinedAt: now, cursor: null }] } };
}

export function leaveTriageSession(session, handle) {
  if (!session || !session.id) return { ok: false, reason: 'session required' };
  return { ok: true, session: { ...session, participants: session.participants.filter((p) => p.handle !== handle) } };
}

/* 52273 — Presence indicators. */
export function presenceReducer(state, event, now = Date.now()) {
  const viewers = Array.isArray(state) ? [...state] : [];
  if (!event || !event.type) return viewers;
  if (event.type === 'JOIN' && event.handle && !viewers.some((v) => v.handle === event.handle)) {
    return [...viewers, { handle: event.handle, since: now, cursor: event.cursor || null }];
  }
  if (event.type === 'LEAVE' && event.handle) return viewers.filter((v) => v.handle !== event.handle);
  if (event.type === 'HEARTBEAT' && event.handle) {
    return viewers.map((v) => (v.handle === event.handle ? { ...v, cursor: event.cursor ?? v.cursor, lastSeen: now } : v));
  }
  return viewers;
}

/* 52274 — Shared saved filters. */
export function publishSavedFilter(library, filter, now = Date.now()) {
  if (!filter || !filter.name || !filter.filters) return { ok: false, reason: 'filter with name and filters required' };
  const entry = {
    id: tokenFor('filter', filter.name, now), name: filter.name,
    filters: { ...filter.filters }, publishedBy: filter.publishedBy || null, publishedAt: now,
  };
  return { ok: true, library: [...(Array.isArray(library) ? library : []), entry], entry };
}

export function listPublishedFilters(library) {
  return [...(Array.isArray(library) ? library : [])].sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
}

/* 52275 — Shared FP rule library. */
export function addFpRule(library, rule, now = Date.now()) {
  if (!rule || !rule.pattern) return { ok: false, reason: 'rule pattern required' };
  const reviewInDays = typeof rule.reviewInDays === 'number' ? rule.reviewInDays : 90;
  const entry = {
    id: tokenFor('fprule', rule.pattern, now), pattern: rule.pattern,
    owner: rule.owner || null, reviewDate: now + reviewInDays * 24 * 3600 * 1000,
    createdAt: now, active: true,
  };
  return { ok: true, library: [...(Array.isArray(library) ? library : []), entry], entry };
}

export function dueFpRules(library, now = Date.now()) {
  return (Array.isArray(library) ? library : []).filter((r) => r.active && r.reviewDate <= now);
}

/* 52276 — Shared hunt templates (post-hunt). */
export function publishHuntTemplate(config, now = Date.now()) {
  if (!config || !config.name) return { ok: false, reason: 'template name required' };
  return {
    ok: true,
    template: {
      id: tokenFor('template', config.name, now), name: config.name,
      config: { ...(config.config || {}) }, publishedBy: config.publishedBy || null, publishedAt: now,
    },
  };
}

export function instantiateTemplate(template, target) {
  if (!template || !template.id) return { ok: false, reason: 'template required' };
  if (!target) return { ok: false, reason: 'target required' };
  return { ok: true, hunt: { target, templateId: template.id, config: { ...template.config } } };
}

/* 52277 — Share to Jira/Asana/Linear. */
const TICKET_SYSTEMS = ['jira', 'asana', 'linear'];

export function buildTicketPayload(finding, system, baseUrl) {
  if (!finding || !finding.id) return { ok: false, reason: 'finding with id required' };
  if (!TICKET_SYSTEMS.includes(system)) return { ok: false, reason: `system must be one of ${TICKET_SYSTEMS.join(',')}` };
  const base = String(baseUrl || 'https://app.infinity-ai.example').replace(/\/+$/, '');
  return {
    ok: true,
    ticket: {
      system,
      title: `[${String(finding.severity || 'info').toUpperCase()}] ${finding.title}`,
      description: `${finding.description || ''}\n\nDeep link: ${base}/findings/${finding.id}`.trim(),
      fields: { severity: finding.severity || 'info', cwe: finding.cwe || null, target: finding.target || null },
      deepLink: `${base}/findings/${finding.id}`,
    },
  };
}

/* 52278 — Share manifest export. */
export function buildShareManifest(shares, now = Date.now()) {
  const rows = Array.isArray(shares) ? shares : [];
  return {
    ok: true,
    manifest: {
      exportedAt: now,
      entries: rows.map((s) => ({
        what: s.what || s.token || 'unknown',
        withWhom: s.withWhom || s.viewer || 'unknown',
        when: s.when || s.createdAt || null,
        permission: s.permission || s.role || 'viewer',
      })),
    },
  };
}

/* 52279 — Per-viewer watermarking. */
export function buildWatermark(viewerEmail, opts = {}) {
  if (typeof viewerEmail !== 'string' || !viewerEmail.includes('@')) return { ok: false, reason: 'viewer email required' };
  return {
    ok: true,
    watermark: {
      kind: 'per-viewer', text: viewerEmail,
      opacity: typeof opts.opacity === 'number' ? opts.opacity : 0.12,
      position: opts.position || 'diagonal-tile', color: opts.color || '#ffffff',
    },
  };
}

/* 52280 — Screenshot-deterrence notice. */
export function screenshotNotice(level = 'standard') {
  const strict = level === 'strict';
  return {
    ok: true,
    notice: {
      level: strict ? 'strict' : 'standard',
      banner: true,
      text: strict
        ? 'Confidential — screenshots and redistribution of these results are prohibited and may be logged.'
        : 'Confidential — please do not share or screenshot these results.',
    },
  };
}
