/**
 * wave66ACore.js — post-hunt email triggers & delivery logic (ideas 52601–52620).
 *
 * Pure logic for severity-gated routing, digest scheduling, per-team and
 * per-role digests, top-findings spotlights, remediation statistics,
 * inline trend sparklines, dual-format bodies, branding, reply-to routing,
 * localization, action buttons, opt-in read tracking, unsubscribe management,
 * per-user preferences, SLA-escalation, regression all-clear notices,
 * new-critical alerts, false-positive oversight summaries, and bounty
 * payout notifications.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE66_A_IDEAS = [
  { id: 52601, title: 'Severity-threshold emails', skip: false },
  { id: 52602, title: 'Scheduled digest emails (post-hunt)', skip: false },
  { id: 52603, title: 'Per-team digest', skip: false },
  { id: 52604, title: 'Per-stakeholder digest', skip: false },
  { id: 52605, title: 'Top-5 findings email', skip: false },
  { id: 52606, title: 'Remediation-stats email', skip: false },
  { id: 52607, title: 'Trend sparkline in email', skip: false },
  { id: 52608, title: 'Plain-text and HTML versions', skip: false },
  { id: 52609, title: 'Email branding', skip: false },
  { id: 52610, title: 'Reply-to configuration', skip: false },
  { id: 52611, title: 'Localized email language', skip: false },
  { id: 52612, title: 'Action buttons in email', skip: false },
  { id: 52613, title: 'Email read tracking (opt-in)', skip: false },
  { id: 52614, title: 'Unsubscribe management (post-hunt)', skip: false },
  { id: 52615, title: 'Per-user email preferences', skip: false },
  { id: 52616, title: 'SLA-breach escalation emails', skip: false },
  { id: 52617, title: 'Regression "all clear" email', skip: false },
  { id: 52618, title: 'New-critical alert email', skip: false },
  { id: 52619, title: 'False-positive oversight digest', skip: false },
  { id: 52620, title: 'Bounty payout email', skip: false },
];

function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}

/**
 * Decide whether an event warrants an immediate email or a digest slot
 * (idea 52601). Immediate when any finding meets or exceeds the severity bar.
 * @param {Array} findings - Findings with severity fields.
 * @param {object} [thresholds] - { immediateAt: 'high' }.
 * @returns {object} { route: 'immediate'|'digest', maxSeverity, matched }.
 */
export function decideEmailRoute(findings, thresholds = { immediateAt: 'high' }) {
  const list = Array.isArray(findings) ? findings : [];
  const bar = severityRank(thresholds.immediateAt);
  const matched = list.filter(f => severityRank(f.severity) >= bar);
  const ranks = list.map(f => severityRank(f.severity));
  const maxRank = ranks.length ? Math.max(...ranks) : -1;
  const maxSeverity = Object.keys(SEVERITY_RANK).find(k => SEVERITY_RANK[k] === maxRank) || 'none';
  return { route: matched.length > 0 ? 'immediate' : 'digest', maxSeverity, matched: matched.map(f => f.id) };
}

/**
 * Build a digest schedule plan for subscribers (idea 52602).
 * @param {Array} subscribers - [{email, frequency: 'daily'|'weekly', timezone}].
 * @param {object} activity - {hunts: [...], newFindings: n, closedFindings: n}.
 * @returns {Array} One digest job per subscriber with computed window label.
 */
export function planDigestSchedule(subscribers, activity) {
  const subs = Array.isArray(subscribers) ? subscribers : [];
  return subs.map(s => {
    const freq = s.frequency === 'weekly' ? 'weekly' : 'daily';
    const windowLabel = freq === 'weekly' ? 'last 7 days' : 'last 24 hours';
    const huntCount = (activity.hunts || []).length;
    return {
      to: s.email,
      frequency: freq,
      timezone: s.timezone || 'UTC',
      window: windowLabel,
      subject: `Infinity AI digest — ${huntCount} hunt${huntCount === 1 ? '' : 's'} (${windowLabel})`,
      activity: { newFindings: activity.newFindings || 0, closedFindings: activity.closedFindings || 0, hunts: huntCount },
    };
  });
}

/**
 * Filter hunts/findings down to a single team's assets (idea 52603).
 * @param {Array} hunts - Hunts with team and findings.
 * @param {string} teamId - Team identifier.
 * @returns {object} { teamId, hunts: [...], findings: [...] }.
 */
export function filterFindingsForTeam(hunts, teamId) {
  const owned = (Array.isArray(hunts) ? hunts : []).filter(h => h.team === teamId);
  const findings = owned.flatMap(h => (h.findings || []).map(f => ({ ...f, huntId: h.id })));
  return { teamId, hunts: owned.map(h => h.id), findings };
}

/**
 * Tune a digest to a stakeholder role (idea 52604).
 * Executives get risk posture only, engineers get full detail,
 * auditors get the decision/evidence trail.
 * @param {object} digest - { findings: [...], stats: {...} }.
 * @param {string} role - 'executive' | 'engineer' | 'auditor'.
 * @returns {object} Role-tuned digest payload.
 */
export function tuneDigestForRole(digest, role) {
  const findings = digest.findings || [];
  if (role === 'executive') {
    const bySev = findings.reduce((acc, f) => {
      const s = String(f.severity || 'info').toLowerCase();
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    return { role, view: 'posture', counts: bySev, riskScore: digest.riskScore ?? null, decisions: digest.decisions || [] };
  }
  if (role === 'auditor') {
    return {
      role,
      view: 'trail',
      entries: findings.map(f => ({ id: f.id, severity: f.severity, status: f.status, evidence: f.evidence || null, decidedBy: f.decidedBy || null })),
    };
  }
  return { role: 'engineer', view: 'detail', findings };
}

/**
 * Select the N highest-risk findings for the spotlight email (idea 52605).
 * @param {Array} findings - Findings with severity and riskScore.
 * @param {number} [n] - How many to spotlight (default 5).
 * @returns {Array} Top findings with one-line impact strings.
 */
export function selectTopFindings(findings, n = 5) {
  const list = Array.isArray(findings) ? findings : [];
  const sorted = [...list].sort((a, b) => {
    const d = severityRank(b.severity) - severityRank(a.severity);
    return d !== 0 ? d : (b.riskScore || 0) - (a.riskScore || 0);
  });
  return sorted.slice(0, Math.max(1, n)).map(f => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    impact: `One-line impact: ${f.title} on ${f.target || 'the target'} (severity ${f.severity}, score ${f.riskScore ?? severityRank(f.severity) * 2.5}).`,
  }));
}

/**
 * Compute remediation statistics for the weekly stats email (idea 52606).
 * @param {Array} findings - Findings with status and fixedAt/verifiedAt dates.
 * @param {Date|string} [now] - Reference time.
 * @returns {object} { fixed, verified, overdue, mttrHours }.
 */
export function computeRemediationStats(findings, now = new Date()) {
  const list = Array.isArray(findings) ? findings : [];
  const nowMs = new Date(now).getTime();
  const fixed = list.filter(f => f.status === 'fixed' || f.status === 'verified').length;
  const verified = list.filter(f => f.status === 'verified').length;
  const overdue = list.filter(f => f.dueAt && new Date(f.dueAt).getTime() < nowMs && f.status !== 'fixed' && f.status !== 'verified').length;
  const repairTimes = list
    .filter(f => f.foundAt && f.fixedAt)
    .map(f => (new Date(f.fixedAt).getTime() - new Date(f.foundAt).getTime()) / 3600000);
  const mttrHours = repairTimes.length
    ? Math.round((repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length) * 10) / 10
    : null;
  return { total: list.length, fixed, verified, overdue, open: list.length - fixed, mttrHours };
}

/**
 * Build sparkline data for inline email charts (idea 52607).
 * Returns block-character sparkline plus normalized points.
 * @param {Array<number>} series - Numeric trend series.
 * @returns {object} { spark, points }.
 */
export function buildSparklineData(series) {
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const values = (Array.isArray(series) ? series : []).map(Number).filter(v => Number.isFinite(v));
  if (!values.length) return { spark: '', points: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map(v => Math.round(((v - min) / span) * 100));
  const spark = values.map(v => blocks[Math.min(7, Math.floor(((v - min) / span) * 7))]).join('');
  return { spark, points };
}

/**
 * Render both plain-text and HTML versions of an email (idea 52608).
 * @param {object} email - { subject, heading, sections: [{title, body}], cta }.
 * @returns {object} { subject, text, html }.
 */
export function renderEmailBodies(email) {
  const sections = email.sections || [];
  const text = [
    email.heading || email.subject || '',
    '',
    ...sections.flatMap(s => [`## ${s.title}`, s.body, '']),
    email.cta ? `${email.cta.label}: ${email.cta.url}` : '',
  ].filter(l => l !== undefined).join('\n');
  const html = [
    `<h1>${escapeHtml(email.heading || email.subject || '')}</h1>`,
    ...sections.map(s => `<h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.body)}</p>`),
    email.cta ? `<p><a href="${escapeAttr(email.cta.url)}">${escapeHtml(email.cta.label)}</a></p>` : '',
  ].join('');
  return { subject: email.subject || '', text, html };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

/**
 * Apply org branding to email HTML (idea 52609).
 * @param {string} html - Inner HTML.
 * @param {object} brand - { orgName, primaryColor, logoUrl, footer }.
 * @returns {string} Branded full HTML document fragment.
 */
export function applyBranding(html, brand = {}) {
  const b = {
    orgName: brand.orgName || 'Infinity AI',
    primaryColor: brand.primaryColor || '#6d28d9',
    logoUrl: brand.logoUrl || '',
    footer: brand.footer || 'Sent by Infinity AI · Dark-Matter',
  };
  return [
    `<div style="font-family:sans-serif;max-width:640px;margin:0 auto">`,
    `<div style="background:${escapeAttr(b.primaryColor)};padding:16px;color:#fff">`,
    b.logoUrl ? `<img src="${escapeAttr(b.logoUrl)}" alt="${escapeAttr(b.orgName)}" style="height:32px"/>` : '',
    `<span style="font-size:18px;font-weight:bold">${escapeHtml(b.orgName)}</span></div>`,
    `<div style="padding:16px">${html}</div>`,
    `<div style="font-size:12px;color:#666;padding:12px 16px;border-top:1px solid #ddd">${escapeHtml(b.footer)}</div>`,
    `</div>`,
  ].join('');
}

/**
 * Resolve the reply-to address for an email type (idea 52610).
 * @param {object} config - { defaultReplyTo, byType: { alert: ..., digest: ... } }.
 * @param {string} type - Email type key.
 * @returns {string} Reply-to address.
 */
export function resolveReplyTo(config = {}, type = 'general') {
  const byType = config.byType || {};
  return byType[type] || config.defaultReplyTo || 'security@infinity-ai.local';
}

/**
 * Localize an email template (idea 52611).
 * @param {string} key - Template key.
 * @param {string} locale - BCP-47 locale, e.g. 'hi', 'es'.
 * @param {object} dicts - { en: { key: fn(ctx) }, hi: {...} } with render functions.
 * @param {object} [ctx] - Template context.
 * @returns {object} { locale, subject, body, fallback: bool }.
 */
export function localizeEmail(key, locale, dicts, ctx = {}) {
  const chosen = (dicts && dicts[locale] && dicts[locale][key]) || (dicts && dicts.en && dicts.en[key]);
  if (!chosen) return { locale, subject: '', body: '', fallback: true, missing: true };
  const rendered = chosen(ctx);
  return { locale, subject: rendered.subject, body: rendered.body, fallback: !(dicts[locale] && dicts[locale][key]) };
}

/**
 * Render action buttons as email-safe HTML (idea 52612).
 * @param {Array} actions - [{ id, label, url, style }].
 * @returns {string} Table-based button HTML (email-client safe).
 */
export function renderActionButtons(actions) {
  const list = Array.isArray(actions) ? actions : [];
  return list
    .map(a => `<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:6px;background:${a.style === 'danger' ? '#dc2626' : '#6d28d9'}"><a href="${escapeAttr(a.url)}" style="display:inline-block;padding:10px 18px;color:#fff;text-decoration:none;font-weight:bold">${escapeHtml(a.label)}</a></td></tr></table>`)
    .join('<div style="height:8px"></div>');
}

/**
 * Decide read-tracking behavior for a send (idea 52613).
 * @param {object} tracking - { optedIn, emailId, trackingDomain }.
 * @returns {object} { enabled, pixelUrl, clickTag }.
 */
export function buildTrackingPixel(tracking = {}) {
  if (!tracking.optedIn || !tracking.emailId) {
    return { enabled: false, pixelUrl: null, clickTag: null };
  }
  const domain = tracking.trackingDomain || 'track.infinity-ai.local';
  return {
    enabled: true,
    pixelUrl: `https://${domain}/open/${encodeURIComponent(tracking.emailId)}.png`,
    clickTag: `https://${domain}/click/${encodeURIComponent(tracking.emailId)}`,
  };
}

/**
 * Build a signed unsubscribe link and validate tokens (idea 52614).
 * @param {string} digestType - Digest identifier.
 * @param {string} userId - Subscriber id.
 * @param {string} [secret] - Signing secret.
 * @returns {object} { url, token }.
 */
export function buildUnsubscribeLink(digestType, userId, secret = 'local-dev-secret') {
  const payload = `${digestType}:${userId}`;
  let hash = 0;
  const key = `${secret}:${payload}`;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const token = `${Buffer.from(payload, 'utf8').toString('base64url')}.${hash.toString(36)}`;
  return { url: `https://app.infinity-ai.local/preferences?unsub=${token}`, token };
}

/**
 * Verify an unsubscribe token produced by buildUnsubscribeLink.
 * @param {string} token - Token from the link.
 * @param {string} [secret] - Signing secret.
 * @returns {object} { valid, digestType, userId }.
 */
export function verifyUnsubscribeToken(token, secret = 'local-dev-secret') {
  try {
    const [b64, sig] = String(token).split('.');
    const payload = Buffer.from(b64, 'base64url').toString('utf8');
    const [digestType, userId] = payload.split(':');
    const expected = buildUnsubscribeLink(digestType, userId, secret).token.split('.')[1];
    return { valid: sig === expected && Boolean(digestType) && Boolean(userId), digestType, userId };
  } catch {
    return { valid: false, digestType: null, userId: null };
  }
}

/**
 * Check a user's email preferences for an event (idea 52615).
 * @param {object} prefs - { events: { critical: 'email', digest: 'inapp' }, default: 'email' }.
 * @param {string} eventType - Event key.
 * @returns {object} { sendEmail, channel }.
 */
export function shouldSendEmail(prefs = {}, eventType = 'general') {
  const channel = (prefs.events && prefs.events[eventType]) || prefs.default || 'email';
  return { sendEmail: channel === 'email' || channel === 'both', channel };
}

/**
 * Detect SLA breaches that need escalation emails (idea 52616).
 * @param {Array} findings - Findings with severity, foundAt, triagedAt, fixedAt.
 * @param {object} slas - { triage: {critical: h,...}, fix: {...} } hours.
 * @param {Date|string} [now] - Reference time.
 * @returns {Array} Breaches: [{ id, sla: 'triage'|'fix', severity, overdueHours }].
 */
export function detectSlaBreaches(findings, slas = {}, now = new Date()) {
  const nowMs = new Date(now).getTime();
  const breaches = [];
  for (const f of Array.isArray(findings) ? findings : []) {
    const sev = String(f.severity || 'info').toLowerCase();
    const triageSlaH = slas.triage && slas.triage[sev];
    const fixSlaH = slas.fix && slas.fix[sev];
    if (triageSlaH && !f.triagedAt) {
      const overdueH = (nowMs - new Date(f.foundAt).getTime()) / 3600000 - triageSlaH;
      if (overdueH > 0) breaches.push({ id: f.id, sla: 'triage', severity: sev, overdueHours: Math.round(overdueH * 10) / 10 });
    }
    if (fixSlaH && !f.fixedAt && f.status !== 'fixed' && f.status !== 'verified') {
      const overdueH = (nowMs - new Date(f.foundAt).getTime()) / 3600000 - fixSlaH;
      if (overdueH > 0) breaches.push({ id: f.id, sla: 'fix', severity: sev, overdueHours: Math.round(overdueH * 10) / 10 });
    }
  }
  return breaches;
}

/**
 * Build the "all clear" regression email (idea 52617).
 * @param {object} regression - { id, target, checkedAt, verifiedBy }.
 * @returns {object} { subject, text, html }.
 */
export function buildAllClearEmail(regression) {
  const subject = `All clear: regression ${regression.id} verified zero open issues on ${regression.target}`;
  const body = `The regression run against ${regression.target} (completed ${regression.checkedAt}) verified zero open issues. Signed off by ${regression.verifiedBy || 'the security team'}.`;
  return { subject, text: body, html: `<p>${escapeHtml(body)}</p>` };
}

/**
 * Detect newly surfaced critical findings (idea 52618).
 * @param {Array} current - Current findings.
 * @param {Array} previous - Findings from the previous run.
 * @returns {Array} Findings that are critical and not in the previous set.
 */
export function detectNewCriticals(current, previous) {
  const prevIds = new Set((Array.isArray(previous) ? previous : []).map(f => f.id));
  return (Array.isArray(current) ? current : []).filter(
    f => String(f.severity).toLowerCase() === 'critical' && !prevIds.has(f.id)
  );
}

/**
 * Summarize false-positive dismissals for lead oversight (idea 52619).
 * @param {Array} dismissals - [{ findingId, reason, dismissedBy, dismissedAt, severity }].
 * @returns {object} { total, byReason, bySeverity, reviewers }.
 */
export function summarizeFalsePositives(dismissals) {
  const list = Array.isArray(dismissals) ? dismissals : [];
  const byReason = {};
  const bySeverity = {};
  const reviewers = new Set();
  for (const d of list) {
    byReason[d.reason || 'unspecified'] = (byReason[d.reason || 'unspecified'] || 0) + 1;
    const s = String(d.severity || 'info').toLowerCase();
    bySeverity[s] = (bySeverity[s] || 0) + 1;
    if (d.dismissedBy) reviewers.add(d.dismissedBy);
  }
  return { total: list.length, byReason, bySeverity, reviewers: [...reviewers] };
}

/**
 * Build a bounty payout notification (idea 52620).
 * @param {object} payout - { researcher, findingId, amount, currency, paidAt, program }.
 * @returns {object} { subject, text, html }.
 */
export function buildPayoutNotice(payout) {
  const amount = `${payout.currency || 'USD'} ${Number(payout.amount || 0).toFixed(2)}`;
  const subject = `Bounty paid: ${amount} for finding ${payout.findingId}`;
  const body = `Hi ${payout.researcher}, your bounty of ${amount} for finding ${payout.findingId} (${payout.program || 'the program'}) was recorded on ${payout.paidAt || 'today'}. Thank you for hunting with Infinity AI.`;
  return { subject, text: body, html: `<p>${escapeHtml(body)}</p>` };
}
