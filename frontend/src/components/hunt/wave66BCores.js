/**
 * wave66BCores.js — post-hunt email content & operations (ideas 52621–52640).
 *
 * Pure logic for weekly posture and monthly trend emails, external client
 * emails with redaction, encryption choice, delivery logs, failure retry
 * with backoff, test sends, the template variable library, conditional
 * sections, embedded inline charts, CSV attachments, team-activity digests,
 * pending-triage and pending-fix nudges, pre-hunt and post-regression
 * notices, archive notices, share-link access alerts, and timezone-aware
 * time rendering.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE66_B_IDEAS = [
  { id: 52621, title: 'Weekly security-posture email', skip: false },
  { id: 52622, title: 'Monthly trend email', skip: false },
  { id: 52623, title: 'External client email', skip: false },
  { id: 52624, title: 'Redacted-content email mode', skip: false },
  { id: 52625, title: 'Email encryption option', skip: false },
  { id: 52626, title: 'Email delivery logs', skip: false },
  { id: 52627, title: 'Email failure auto-retry', skip: false },
  { id: 52628, title: 'Test-send email', skip: false },
  { id: 52629, title: 'Template variable library', skip: false },
  { id: 52630, title: 'Conditional email sections', skip: false },
  { id: 52631, title: 'Embedded charts in email', skip: false },
  { id: 52632, title: 'CSV attachment option', skip: false },
  { id: 52633, title: 'Team-activity digest email', skip: false },
  { id: 52634, title: 'Pending-triage email', skip: false },
  { id: 52635, title: 'Pending-fixes email', skip: false },
  { id: 52636, title: 'Pre-hunt notification email', skip: false },
  { id: 52637, title: 'Post-regression email', skip: false },
  { id: 52638, title: 'Archive notice email', skip: false },
  { id: 52639, title: 'Share-link access email', skip: false },
  { id: 52640, title: 'Email timezone display', skip: false },
];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function severityOf(f) {
  return String(f.severity || 'info').toLowerCase();
}

/**
 * Summarize portfolio security posture for the weekly email (idea 52621).
 * @param {Array} hunts - Hunts with target and findings.
 * @returns {object} { huntsRun, totalFindings, openCritical, riskTrend, topRisks, fixVelocity }.
 */
export function summarizePosture(hunts) {
  const list = Array.isArray(hunts) ? hunts : [];
  const findings = list.flatMap(h => h.findings || []);
  const open = findings.filter(f => f.status !== 'fixed' && f.status !== 'verified');
  const openCritical = open.filter(f => severityOf(f) === 'critical').length;
  const fixedThisWeek = findings.filter(f => f.status === 'fixed' || f.status === 'verified').length;
  const byTarget = {};
  for (const f of open) {
    const t = f.target || 'unknown';
    byTarget[t] = (byTarget[t] || 0) + 1;
  }
  const topRisks = Object.entries(byTarget).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([target, count]) => ({ target, openFindings: count }));
  return {
    huntsRun: list.length,
    totalFindings: findings.length,
    openFindings: open.length,
    openCritical,
    topRisks,
    fixVelocity: { fixed: fixedThisWeek, perHunt: list.length ? Math.round((fixedThisWeek / list.length) * 10) / 10 : 0 },
  };
}

/**
 * Compare month-over-month trends with a narrative (idea 52622).
 * @param {object} current - { critical, high, medium, fixed, avgRisk } for this month.
 * @param {object} previous - Same shape for last month.
 * @returns {object} { deltas, direction, narrative }.
 */
export function compareMonthOverMonth(current, previous) {
  const keys = ['critical', 'high', 'medium', 'fixed', 'avgRisk'];
  const deltas = {};
  for (const k of keys) {
    const c = Number(current[k] || 0);
    const p = Number(previous[k] || 0);
    deltas[k] = Math.round((c - p) * 10) / 10;
  }
  const improving = deltas.critical <= 0 && deltas.high <= 0 && deltas.avgRisk <= 0 && deltas.fixed >= 0;
  const direction = improving ? 'improving' : 'degrading';
  const narrative = improving
    ? `Posture is improving: critical findings changed by ${deltas.critical}, high by ${deltas.high}, and ${current.fixed || 0} fixes landed this month.`
    : `Attention needed: critical findings changed by ${deltas.critical}, high by ${deltas.high}; average risk moved by ${deltas.avgRisk}.`;
  return { deltas, direction, narrative };
}

/**
 * Build a client-safe summary email (idea 52623).
 * @param {object} hunt - Hunt record.
 * @param {object} client - { name, portalUrl, contactName }.
 * @returns {object} { subject, text, portalLink } — content pre-redacted.
 */
export function buildClientSummary(hunt, client) {
  const findings = (hunt.findings || []).filter(f => !f.internalOnly);
  const counts = findings.reduce((acc, f) => {
    acc[severityOf(f)] = (acc[severityOf(f)] || 0) + 1;
    return acc;
  }, {});
  const subject = `Security assessment summary — ${hunt.target}`;
  const lines = [
    `Hi ${client.contactName || 'there'},`,
    `The assessment of ${hunt.target} completed on ${hunt.completedAt || 'schedule'}.`,
    `Findings by severity: ${Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(', ') || 'none'}.`,
    `Full details are available in your branded portal: ${client.portalUrl || 'portal link pending'}.`,
  ];
  return { subject, text: lines.join('\n'), portalLink: client.portalUrl || null, redacted: true };
}

/**
 * Strip payloads and secrets from externally addressed email content (idea 52624).
 * @param {object} email - { subject, text, html }.
 * @param {object} [rules] - { patterns: RegExp-ish strings, placeholder }.
 * @returns {object} Redacted email with { redactedFields: [...] } report.
 */
export function redactEmailContent(email, rules = {}) {
  const placeholder = rules.placeholder || '[REDACTED]';
  const defaultPatterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    /\b[A-Za-z0-9_-]{32,}\b/g, // long tokens
    /(password|passwd|secret|api[_-]?key)\s*[:=]\s*\S+/gi,
  ];
  const redactedFields = [];
  const apply = (text) => {
    let out = String(text || '');
    for (const re of defaultPatterns) {
      if (re.test(out)) {
        redactedFields.push(re.source.slice(0, 40));
        out = out.replace(re, placeholder);
      }
    }
    return out;
  };
  return { subject: apply(email.subject), text: apply(email.text), html: apply(email.html), redactedFields: [...new Set(redactedFields)] };
}

/**
 * Choose the encryption method for a sensitive summary (idea 52625).
 * @param {object} prefs - { preferred: 'smime'|'pgp'|'none', pgpKeyId, smimeCert }.
 * @param {Array<string>} available - Methods the mailer supports.
 * @returns {object} { method, details, envelope }.
 */
export function chooseEncryption(prefs = {}, available = ['none']) {
  const wanted = prefs.preferred || 'none';
  if (wanted !== 'none' && available.includes(wanted)) {
    const details = wanted === 'pgp' ? { keyId: prefs.pgpKeyId || 'unconfigured' } : { cert: prefs.smimeCert || 'unconfigured' };
    return { method: wanted, details, envelope: `encrypted:${wanted}` };
  }
  return { method: 'none', details: { reason: wanted === 'none' ? 'not requested' : 'unavailable, fell back to TLS' }, envelope: 'tls' };
}

/**
 * Append to an email delivery log (idea 52626).
 * @param {Array} logs - Existing log entries.
 * @param {object} entry - { emailId, to, event: 'sent'|'delivered'|'bounced'|'opened', at }.
 * @returns {Array} New log array (immutable append).
 */
export function appendDeliveryLog(logs, entry) {
  const list = Array.isArray(logs) ? logs : [];
  return [...list, { ...entry, at: entry.at || new Date().toISOString() }];
}

/**
 * Summarize delivery outcomes for troubleshooting (idea 52626 cont.).
 * @param {Array} logs - Delivery log entries.
 * @returns {object} { byEvent, bounceRate, openRate }.
 */
export function summarizeDelivery(logs) {
  const list = Array.isArray(logs) ? logs : [];
  const byEvent = {};
  const emailIds = new Set();
  for (const e of list) {
    byEvent[e.event] = (byEvent[e.event] || 0) + 1;
    if (e.emailId) emailIds.add(e.emailId);
  }
  const sent = byEvent.sent || 0;
  return {
    byEvent,
    emails: emailIds.size,
    bounceRate: sent ? Math.round(((byEvent.bounced || 0) / sent) * 1000) / 10 : 0,
    openRate: sent ? Math.round(((byEvent.opened || 0) / sent) * 1000) / 10 : 0,
  };
}

/**
 * Compute the next retry delay with exponential backoff (idea 52627).
 * @param {number} attempt - 0-based attempt number.
 * @param {object} [opts] - { baseMs, maxMs, maxAttempts }.
 * @returns {object} { delayMs, attemptsLeft, giveUp }.
 */
export function nextRetryDelay(attempt, opts = {}) {
  const baseMs = opts.baseMs || 60000;
  const maxMs = opts.maxMs || 3600000;
  const maxAttempts = opts.maxAttempts || 5;
  const delayMs = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return { delayMs, attemptsLeft: Math.max(0, maxAttempts - attempt - 1), giveUp: attempt + 1 >= maxAttempts };
}

/**
 * Build a test-send preview of a template with sample data (idea 52628).
 * @param {object} template - { subject: fn(ctx), body: fn(ctx) }.
 * @param {object} sampleData - Sample context.
 * @param {string} to - Test recipient.
 * @returns {object} Rendered preview marked as a test.
 */
export function buildTestSend(template, sampleData, to) {
  const ctx = { ...sampleData, isTest: true };
  return {
    to,
    subject: `[TEST] ${template.subject(ctx)}`,
    body: template.body(ctx),
    isTest: true,
    watermark: 'This is a test send with sample data.',
  };
}

/** Documented template variable library (idea 52629). */
export const VARIABLE_LIBRARY = [
  { name: 'hunt.name', description: 'Hunt display name', example: 'Q3 prod sweep' },
  { name: 'hunt.target', description: 'Hunt target host', example: 'app.example.com' },
  { name: 'counts.critical', description: 'Number of critical findings', example: '3' },
  { name: 'counts.total', description: 'Total findings', example: '42' },
  { name: 'risk.score', description: 'Overall risk score 0-100', example: '78' },
  { name: 'links.portal', description: 'Branded portal URL', example: 'https://portal.example.com/h/1' },
  { name: 'links.unsubscribe', description: 'Per-user unsubscribe URL', example: 'https://app.example.com/unsub?…' },
  { name: 'dates.completed', description: 'Hunt completion timestamp', example: '2026-10-01T09:00:00Z' },
  { name: 'user.name', description: 'Recipient display name', example: 'Aarav' },
  { name: 'org.name', description: 'Organization display name', example: 'Acme Security' },
];

/**
 * Resolve {{variables}} in a template string against a context (idea 52629).
 * @param {string} template - Text with {{dotted.path}} placeholders.
 * @param {object} ctx - Context object.
 * @returns {object} { text, unresolved: [...] }.
 */
export function resolveVariables(template, ctx = {}) {
  const unresolved = [];
  const text = String(template).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, path) => {
    const value = path.split('.').reduce((o, k) => (o == null ? o : o[k]), ctx);
    if (value == null) {
      unresolved.push(path);
      return m;
    }
    return String(value);
  });
  return { text, unresolved };
}

/**
 * Show/hide template sections based on data (idea 52630).
 * @param {Array} sections - [{ id, condition: ctx => bool, render: ctx => string }].
 * @param {object} ctx - Template context.
 * @returns {Array} Rendered sections that passed their condition.
 */
export function evaluateSectionConditions(sections, ctx = {}) {
  return (Array.isArray(sections) ? sections : [])
    .filter(s => {
      try { return s.condition ? s.condition(ctx) : true; } catch { return false; }
    })
    .map(s => ({ id: s.id, html: s.render ? s.render(ctx) : '' }));
}

/**
 * Render an inline SVG chart for embedding in email HTML (idea 52631).
 * @param {object} data - { labels: [...], values: [...] }.
 * @param {string} [type] - 'donut' | 'bars'.
 * @returns {string} SVG markup.
 */
export function renderInlineChart(data, type = 'donut') {
  const values = (data.values || []).map(Number).filter(v => Number.isFinite(v) && v >= 0);
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const colors = ['#dc2626', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];
  if (type === 'bars') {
    const max = Math.max(...values, 1);
    const bars = values.map((v, i) => {
      const h = Math.round((v / max) * 80);
      return `<rect x="${i * 24 + 4}" y="${90 - h}" width="16" height="${h}" fill="${colors[i % colors.length]}"/>`;
    }).join('');
    return `<svg width="${values.length * 24 + 8}" height="100" xmlns="http://www.w3.org/2000/svg" role="img">${bars}</svg>`;
  }
  // donut
  let angle = -90;
  const cx = 60; const cy = 60; const r = 44; const ir = 26;
  const arc = (a0, a1, rad) => {
    const x0 = cx + rad * Math.cos((a0 * Math.PI) / 180);
    const y0 = cy + rad * Math.sin((a0 * Math.PI) / 180);
    const x1 = cx + rad * Math.cos((a1 * Math.PI) / 180);
    const y1 = cy + rad * Math.sin((a1 * Math.PI) / 180);
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const paths = values.map((v, i) => {
    const sweep = (v / total) * 360;
    const d = `${arc(angle, angle + sweep, r)} L ${cx + ir * Math.cos(((angle + sweep) * Math.PI) / 180)} ${cy + ir * Math.sin(((angle + sweep) * Math.PI) / 180)} ${arc(angle + sweep, angle, ir)} Z`;
    angle += sweep;
    return `<path d="${d}" fill="${colors[i % colors.length]}"/>`;
  }).join('');
  return `<svg width="120" height="120" xmlns="http://www.w3.org/2000/svg" role="img">${paths}</svg>`;
}

/**
 * Export findings as CSV for attachment (idea 52632).
 * @param {Array} findings - Findings.
 * @returns {object} { filename, mime, content }.
 */
export function findingsToCsv(findings) {
  const list = Array.isArray(findings) ? findings : [];
  const cols = ['id', 'title', 'severity', 'status', 'target', 'foundAt'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [cols.join(','), ...list.map(f => cols.map(c => esc(f[c])).join(','))];
  return { filename: 'findings.csv', mime: 'text/csv', content: rows.join('\n') };
}

/**
 * Summarize team activity for the digest email (idea 52633).
 * @param {Array} events - [{ type: 'comment'|'state-change'|'decision', actor, at, huntId, detail }].
 * @returns {object} { byType, byHunt, recent: [...] }.
 */
export function summarizeTeamActivity(events) {
  const list = Array.isArray(events) ? events : [];
  const byType = {};
  const byHunt = {};
  for (const e of list) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    byHunt[e.huntId] = (byHunt[e.huntId] || 0) + 1;
  }
  const recent = [...list].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 10);
  return { total: list.length, byType, byHunt, recent };
}

/**
 * Build a pending-triage nudge (idea 52634).
 * @param {Array} findings - Findings with status.
 * @param {string} assignee - Reviewer name/email.
 * @returns {object} { subject, count, items }.
 */
export function pendingTriageNudge(findings, assignee) {
  const pending = (Array.isArray(findings) ? findings : []).filter(f => f.status === 'new' || f.status === 'triaging');
  const sorted = [...pending].sort((a, b) => severityRankOf(b) - severityRankOf(a));
  return {
    subject: `You have ${pending.length} finding${pending.length === 1 ? '' : 's'} awaiting review`,
    count: pending.length,
    assignee,
    items: sorted.map(f => ({ id: f.id, title: f.title, severity: f.severity, link: `/findings/${f.id}` })),
  };
}

function severityRankOf(f) {
  return { critical: 4, high: 3, medium: 2, low: 1, info: 0 }[severityOf(f)] ?? 0;
}

/**
 * List overdue and upcoming-due fixes for an assignee (idea 52635).
 * @param {Array} findings - Findings with assignee, dueAt, status.
 * @param {string} assignee - Assignee id.
 * @param {Date|string} [now] - Reference time.
 * @returns {object} { overdue: [...], dueSoon: [...] }.
 */
export function pendingFixesList(findings, assignee, now = new Date()) {
  const nowMs = new Date(now).getTime();
  const soonMs = nowMs + 7 * 86400000;
  const mine = (Array.isArray(findings) ? findings : []).filter(
    f => f.assignee === assignee && f.status !== 'fixed' && f.status !== 'verified'
  );
  const overdue = mine.filter(f => f.dueAt && new Date(f.dueAt).getTime() < nowMs);
  const dueSoon = mine.filter(f => f.dueAt && new Date(f.dueAt).getTime() >= nowMs && new Date(f.dueAt).getTime() <= soonMs);
  return { assignee, overdue: overdue.map(f => f.id), dueSoon: dueSoon.map(f => f.id) };
}

/**
 * Build a pre-hunt notification email (idea 52636).
 * @param {object} schedule - { target, startsAt, scope, contactEmail }.
 * @returns {object} { subject, text }.
 */
export function buildPreHuntNotice(schedule) {
  const subject = `Upcoming hunt against ${schedule.target} — ${schedule.startsAt}`;
  const text = [
    `A scheduled hunt will run against production target ${schedule.target} at ${schedule.startsAt}.`,
    `Scope: ${schedule.scope || 'standard assessment'}.`,
    `Reply to this email if the window conflicts with a freeze or release.`,
  ].join('\n');
  return { subject, text };
}

/**
 * Build the post-regression diff summary email (idea 52637).
 * @param {Array} previous - Findings before.
 * @param {Array} current - Findings after.
 * @returns {object} { subject, fixed: [...], introduced: [...], remaining }.
 */
export function buildPostRegressionDiff(previous, current) {
  const prevIds = new Set((Array.isArray(previous) ? previous : []).map(f => f.id));
  const currIds = new Set((Array.isArray(current) ? current : []).map(f => f.id));
  const fixed = (previous || []).filter(f => !currIds.has(f.id)).map(f => f.id);
  const introduced = (current || []).filter(f => !prevIds.has(f.id)).map(f => f.id);
  const remaining = (current || []).filter(f => prevIds.has(f.id)).length;
  return {
    subject: `Regression complete: ${fixed.length} fixed, ${introduced.length} introduced, ${remaining} remaining`,
    fixed, introduced, remaining,
  };
}

/**
 * Build an archive notice email with keep-active opt-out (idea 52638).
 * @param {object} archive - { id, target, archiveAt }.
 * @param {string} optOutUrl - Keep-active link.
 * @returns {object} { subject, text, optOutUrl }.
 */
export function buildArchiveNotice(archive, optOutUrl) {
  return {
    subject: `Hunt "${archive.target}" will be archived on ${archive.archiveAt}`,
    text: `The hunt against ${archive.target} is scheduled for auto-archive on ${archive.archiveAt}. Use this link to keep it active: ${optOutUrl}`,
    optOutUrl,
  };
}

/**
 * Build a share-link access notification (idea 52639).
 * @param {object} event - { linkId, huntTarget, accessedAt, ip, ownerEmail }.
 * @returns {object} { to, subject, text }.
 */
export function buildShareLinkAccessNotice(event) {
  return {
    to: event.ownerEmail,
    subject: `Sensitive share link opened — ${event.huntTarget}`,
    text: `Your shared link ${event.linkId} for "${event.huntTarget}" was opened at ${event.accessedAt} from ${event.ip || 'unknown IP'}. If this was not expected, revoke the link.`,
  };
}

/**
 * Format a timestamp for the recipient's timezone (idea 52640).
 * @param {string} iso - ISO timestamp.
 * @param {string} [tz] - IANA timezone.
 * @returns {object} { local, tz, label }.
 */
export function formatForTimezone(iso, tz = 'UTC') {
  const d = new Date(iso);
  let local;
  try {
    local = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
  } catch {
    local = d.toISOString();
    tz = 'UTC';
  }
  return { local, tz, label: `${local} (${tz})` };
}
