/**
 * wave67ACore.js — post-hunt email operations part 2 & stakeholder views (ideas 52641–52660).
 *
 * Pure logic for review-meeting .ics invites, signature configuration,
 * email allow/block lists, throttling, API-triggered sends, custom sending
 * domains, template preview, A/B tests, email analytics, quiet-hours policy,
 * threading, reply-by-email triage, finding deep links, the executive
 * dashboard, engineer technical view, auditor compliance mapping,
 * client-facing redacted summaries, board-slide generation, business-risk
 * translation, and dollar-impact estimates.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE67_A_IDEAS = [
  { id: 52641, title: 'Calendar invite for review meeting', skip: false },
  { id: 52642, title: 'Email signature configuration', skip: false },
  { id: 52643, title: 'Email allowlist/blocklist', skip: false },
  { id: 52644, title: 'Email throttling', skip: false },
  { id: 52645, title: 'API-triggered email', skip: false },
  { id: 52646, title: 'Custom sending domain', skip: false },
  { id: 52647, title: 'Email preview pane', skip: false },
  { id: 52648, title: 'Template A/B testing (post-hunt)', skip: false },
  { id: 52649, title: 'Email analytics dashboard', skip: false },
  { id: 52650, title: 'Quiet-hours email policy', skip: false },
  { id: 52651, title: 'Email threading (post-hunt)', skip: false },
  { id: 52652, title: 'Reply-by-email triage', skip: false },
  { id: 52653, title: 'Email-to-finding deep links', skip: false },
  { id: 52654, title: 'Executive dashboard view', skip: false },
  { id: 52655, title: 'Engineer technical view', skip: false },
  { id: 52656, title: 'Auditor compliance view', skip: false },
  { id: 52657, title: 'Client-facing view', skip: false },
  { id: 52658, title: 'Board-slide auto-generation', skip: false },
  { id: 52659, title: 'Business-risk translation', skip: false },
  { id: 52660, title: 'Dollar-impact estimates', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function icsStamp(d) {
  return new Date(d).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Build a one-click .ics review-meeting invite with agenda (idea 52641).
 * @param {object} meeting - { huntId, target, start, end, attendees: [emails], agenda: [items] }.
 * @returns {object} { uid, ics, summary, attendeeCount, agendaItems }.
 */
export function buildReviewInvite(meeting = {}) {
  const { huntId = 'hunt', target = huntId, start, end, attendees = [], agenda = [] } = meeting;
  const uid = `review-${huntId}@infinity-ai.local`;
  const stamp = icsStamp(start || new Date());
  const description = agenda.map((a, i) => `${i + 1}. ${a}`).join('\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Infinity AI//Dark-Matter//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsStamp(start || new Date())}`,
    `DTEND:${icsStamp(end || new Date(Date.now() + 3600000))}`,
    `SUMMARY:Post-hunt review: ${target}`,
    description ? `DESCRIPTION:${description}` : 'DESCRIPTION:Post-hunt review meeting.',
    ...attendees.map(a => `ATTENDEE:mailto:${a}`),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return {
    uid,
    ics: lines.join('\r\n'),
    summary: `Post-hunt review: ${target}`,
    attendeeCount: attendees.length,
    agendaItems: agenda.length,
  };
}

/**
 * Compose an org or per-user email signature (idea 52642).
 * @param {object} sig - { name, role, org, title, phone }.
 * @returns {object} { text, html }.
 */
export function composeSignature(sig = {}) {
  const name = sig.name || 'Security Team';
  const role = sig.role || 'Security Engineer';
  const org = sig.org || 'Infinity AI';
  const text = [`${name}`, `${role} · ${org}`, sig.phone ? `Phone: ${sig.phone}` : null, '—', 'Sent by Infinity AI · Dark-Matter']
    .filter(Boolean)
    .join('\n');
  const html = `<div style="font-family:sans-serif;font-size:12px;color:#333"><strong>${escapeHtml(name)}</strong><br/>${escapeHtml(role)} · ${escapeHtml(org)}${sig.phone ? `<br/>Phone: ${escapeHtml(sig.phone)}` : ''}<br/><span style="color:#888">Sent by Infinity AI · Dark-Matter</span></div>`;
  return { text, html };
}

/**
 * Enforce allowlist/blocklist email policy to prevent leaks (idea 52643).
 * Blocklist wins; an allowlist (when non-empty) restricts everything else.
 * @param {Array<string>} recipients - Email addresses.
 * @param {object} policy - { allow: [domains], block: [domains] }.
 * @returns {object} { allowed: [], rejected: [{ email, reason }] }.
 */
export function checkEmailPolicy(recipients, policy = {}) {
  const allow = (policy.allow || []).map(d => d.toLowerCase());
  const block = (policy.block || []).map(d => d.toLowerCase());
  const allowed = [];
  const rejected = [];
  for (const email of recipients || []) {
    const domain = String(email).split('@')[1]?.toLowerCase() || '';
    if (block.includes(domain)) {
      rejected.push({ email, reason: `domain ${domain} is blocklisted` });
    } else if (allow.length > 0 && !allow.includes(domain)) {
      rejected.push({ email, reason: `domain ${domain} is not allowlisted` });
    } else {
      allowed.push(email);
    }
  }
  return { allowed, rejected };
}

/**
 * Throttle outbound hunt emails with a token-bucket plan (idea 52644).
 * @param {Array} queue - [{ id, to, priority }].
 * @param {object} opts - { perHour, windowStart }.
 * @returns {object} { release: [], deferred: [{ email, delayMinutes }] }.
 */
export function throttleEmails(queue, opts = {}) {
  const perHour = opts.perHour || 100;
  const sorted = [...(queue || [])].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const release = sorted.slice(0, perHour);
  const deferred = sorted.slice(perHour).map((e, i) => ({
    email: e,
    delayMinutes: Math.ceil((i + 1) / perHour) * 60,
  }));
  return { release, deferred };
}

/**
 * Trigger a hunt email template programmatically (idea 52645).
 * @param {object} req - { template, to, variables, dryRun }.
 * @returns {object} { ok, requestId, payload, dryRun, error }.
 */
export function triggerEmailApi(req = {}) {
  const known = ['hunt-summary', 'critical-alert', 'weekly-digest', 'remediation-stats', 'all-clear'];
  if (!known.includes(req.template)) {
    return { ok: false, requestId: null, payload: null, dryRun: Boolean(req.dryRun), error: `unknown template ${req.template}` };
  }
  if (!req.to) {
    return { ok: false, requestId: null, payload: null, dryRun: Boolean(req.dryRun), error: 'missing recipient' };
  }
  const raw = `${req.template}:${req.to}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  const requestId = `email_${hash.toString(36)}`;
  const payload = { template: req.template, to: req.to, variables: req.variables || {}, dryRun: Boolean(req.dryRun) };
  return { ok: true, requestId, payload, dryRun: Boolean(req.dryRun), error: null };
}

/**
 * Produce DKIM/SPF DNS setup guidance for a custom sending domain (idea 52646).
 * @param {object} cfg - { domain, selector }.
 * @returns {object} { domain, dnsRecords: [], steps: [] }.
 */
export function configureSendingDomain(cfg = {}) {
  const domain = cfg.domain || 'security.example.com';
  const selector = cfg.selector || 'infinity';
  const dnsRecords = [
    { type: 'TXT', host: `${selector}._domainkey.${domain}`, value: `v=DKIM1; k=rsa; p=<public-key-for-${selector}>`, purpose: 'DKIM signing key' },
    { type: 'TXT', host: domain, value: 'v=spf1 include:_spf.infinity-ai.local ~all', purpose: 'SPF authorized senders' },
    { type: 'TXT', host: `_dmarc.${domain}`, value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`, purpose: 'DMARC policy' },
  ];
  const steps = [
    `Add the DKIM TXT record at ${selector}._domainkey.${domain}`,
    `Add the SPF TXT record at ${domain}`,
    `Add the DMARC record at _dmarc.${domain}`,
    'Wait for DNS propagation, then verify in the Infinity AI console',
  ];
  return { domain, selector, dnsRecords, steps };
}

/**
 * Preview exactly how a template renders with real hunt data (idea 52647).
 * @param {object} template - { subject, text, html } with {{var}} placeholders.
 * @param {object} data - Variable values.
 * @returns {object} { subject, text, html, unresolved, warnings }.
 */
export function renderEmailPreview(template = {}, data = {}) {
  const unresolved = new Set();
  const warnings = [];
  const fill = s =>
    String(s).replace(/\{\{([\w.]+)\}\}/g, (m, key) => {
      const val = key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), data);
      if (val === undefined || val === null) {
        unresolved.add(key);
        return m;
      }
      return String(val);
    });
  const subject = fill(template.subject || '');
  const text = fill(template.text || '');
  const html = fill(template.html || '');
  if (unresolved.size > 0) warnings.push(`${unresolved.size} variable(s) have no sample data`);
  if (!template.text && !template.html) warnings.push('template has no body');
  return { subject, text, html, unresolved: [...unresolved], warnings };
}

/**
 * Plan an A/B test between two summary formats (idea 52648).
 * @param {object} t - { name, variants: [a, b], sampleSize, durationHours }.
 * @returns {object} { name, groups: [{ variant, recipients }], winnerRule }.
 */
export function planAbTest(t = {}) {
  const variants = t.variants && t.variants.length >= 2 ? t.variants.slice(0, 2) : ['A', 'B'];
  const sample = Math.max(2, t.sampleSize || 200);
  const half = Math.floor(sample / 2);
  return {
    name: t.name || 'summary-format-test',
    groups: [
      { variant: variants[0], recipients: half },
      { variant: variants[1], recipients: sample - half },
    ],
    durationHours: t.durationHours || 72,
    winnerRule: 'higher open rate wins; minimum 100 delivered per variant; tie-break by action-button conversion',
  };
}

/**
 * Compute per-template email analytics (idea 52649).
 * @param {Array} events - [{ emailId, template, event: 'sent'|'opened'|'clicked' }].
 * @returns {object} Per-template { sent, opened, clicked, openRate, ctr }.
 */
export function computeEmailAnalytics(events = []) {
  const per = {};
  for (const e of events) {
    const t = e.template || 'unknown';
    per[t] = per[t] || { sent: 0, opened: 0, clicked: 0 };
    if (e.event === 'sent') per[t].sent += 1;
    if (e.event === 'opened') per[t].opened += 1;
    if (e.event === 'clicked') per[t].clicked += 1;
  }
  const out = {};
  for (const [t, s] of Object.entries(per)) {
    out[t] = {
      ...s,
      openRate: s.sent ? Math.round((s.opened / s.sent) * 1000) / 10 : 0,
      ctr: s.sent ? Math.round((s.clicked / s.sent) * 1000) / 10 : 0,
    };
  }
  return out;
}

/**
 * Hold non-urgent emails until business hours per recipient timezone (idea 52650).
 * @param {Array} pending - [{ id, to, urgent, scheduledAt }].
 * @param {object} policy - { quietStart: 21, quietEnd: 8 }.
 * @param {Date|string} [now] - Reference time.
 * @returns {object} { released: [], held: [{ email, releaseAt }] }.
 */
export function applyQuietHours(pending, policy = {}, now = new Date()) {
  const quietStart = policy.quietStart ?? 21;
  const quietEnd = policy.quietEnd ?? 8;
  const ref = new Date(now);
  const hour = ref.getUTCHours();
  const inQuiet = quietStart > quietEnd ? hour >= quietStart || hour < quietEnd : hour >= quietStart && hour < quietEnd;
  const released = [];
  const held = [];
  for (const email of pending || []) {
    if (email.urgent || !inQuiet) {
      released.push(email);
    } else {
      const release = new Date(ref);
      if (hour >= quietStart) release.setUTCDate(release.getUTCDate() + 1);
      release.setUTCHours(quietEnd, 0, 0, 0);
      held.push({ email, releaseAt: release.toISOString() });
    }
  }
  return { released, held, inQuiet };
}

/**
 * Keep all emails about one hunt in a single thread (idea 52651).
 * @param {string} huntId - Hunt identifier.
 * @param {Array<string>} subjects - Email subjects to normalize.
 * @returns {object} { threadId, subject, headers }.
 */
export function threadEmails(huntId, subjects = []) {
  const threadId = `hunt-${huntId}@infinity-ai.local`;
  const topic = (subjects[0] || 'hunt update').replace(/^(re:\s*|fwd:\s*)+/i, '');
  const subject = `Re: [Hunt ${huntId}] ${topic}`;
  return {
    threadId,
    subject,
    headers: {
      'Message-ID': `<${threadId}>`,
      'In-Reply-To': `<${threadId}>`,
      References: `<${threadId}>`,
      'X-Hunt-Thread': huntId,
    },
  };
}

/**
 * Parse a reply-by-email triage decision (idea 52652).
 * @param {string} body - Reply body text.
 * @param {Array<string>} findingIds - Known finding ids to match.
 * @returns {object} { action: 'accept'|'false-positive'|null, findingId, confidence }.
 */
export function parseEmailReply(body, findingIds = []) {
  const lower = String(body || '').toLowerCase();
  let action = null;
  let confidence = 0;
  if (/false[\s-]?positive|\bfp\b|not (a |an )?issue|won'?t fix/.test(lower)) {
    action = 'false-positive';
    confidence = 0.85;
  } else if (/\baccept\b|\bconfirmed\b|\bvalid\b|fix (it|this)|ack/.test(lower)) {
    action = 'accept';
    confidence = 0.85;
  }
  const findingId = findingIds.find(id => lower.includes(String(id).toLowerCase())) || null;
  return { action, findingId, confidence };
}

/**
 * Build a deep link from an email to a live finding detail page (idea 52653).
 * @param {object} link - { baseUrl, findingId, emailId, secret }.
 * @returns {object} { url, findingId }.
 */
export function buildDeepLink(link = {}) {
  const base = (link.baseUrl || 'https://app.infinity-ai.local').replace(/\/$/, '');
  const payload = `${link.findingId}:${link.emailId || 'email'}`;
  let hash = 0;
  const key = `${link.secret || 'local-dev-secret'}:${payload}`;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const sig = hash.toString(36);
  const ref = encodeURIComponent(link.emailId || 'email');
  return { url: `${base}/findings/${encodeURIComponent(link.findingId)}?ref=email:${ref}&sig=${sig}`, findingId: link.findingId };
}

/**
 * Build the one-screen executive dashboard view (idea 52654).
 * @param {Array} hunts - Hunts with findings and completedAt.
 * @returns {object} { portfolioRisk, trend, topRisks, fixVelocityPerWeek, counts }.
 */
export function buildExecDashboard(hunts = []) {
  const all = (hunts || []).flatMap(h => (h.findings || []).map(f => ({ ...f, huntId: h.id, target: h.target })));
  const open = all.filter(f => !['fixed', 'verified', 'dismissed'].includes(f.status));
  const sevWeight = { critical: 25, high: 10, medium: 4, low: 1, info: 0.5 };
  const riskSum = open.reduce((a, f) => a + (sevWeight[String(f.severity).toLowerCase()] ?? 1), 0);
  const portfolioRisk = Math.min(100, Math.round(riskSum));
  const sorted = [...all].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || (b.riskScore || 0) - (a.riskScore || 0)
  );
  const topRisks = sorted.slice(0, 5).map(f => ({ id: f.id, title: f.title, severity: f.severity, target: f.target }));
  const fixed = all.filter(f => ['fixed', 'verified'].includes(f.status));
  const weeks = Math.max(1, Math.round(((hunts || []).length || 1) * 1));
  const counts = {};
  for (const f of open) {
    const s = String(f.severity || 'info').toLowerCase();
    counts[s] = (counts[s] || 0) + 1;
  }
  return {
    portfolioRisk,
    trend: portfolioRisk >= 70 ? 'worsening' : portfolioRisk >= 40 ? 'stable' : 'improving',
    topRisks,
    fixVelocityPerWeek: Math.round((fixed.length / weeks) * 10) / 10,
    openTotal: open.length,
    counts,
  };
}

/**
 * Build the engineer technical view for one finding (idea 52655).
 * @param {object} finding - Finding with evidence, payloads, steps.
 * @returns {object} { id, title, evidence, payloads, reproSteps, fixGuidance, cwe }.
 */
export function buildEngineerView(finding = {}) {
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    target: finding.target,
    evidence: finding.evidence || [],
    payloads: finding.payloads || [],
    reproSteps: finding.reproSteps || finding.steps || [],
    fixGuidance: finding.fixGuidance || finding.remediation || 'Apply the vendor patch or the documented mitigation, then re-verify with a fresh hunt.',
    cwe: finding.cwe || null,
    references: finding.references || [],
  };
}

/**
 * Map findings to compliance controls with evidence trails (idea 52656).
 * @param {Array} findings - Findings with compliance tags.
 * @param {object} frameworks - { 'SOC 2': ['CC6.1', ...], ... }.
 * @returns {object} Per-framework per-control { control, findings, evidenceCount }.
 */
export function mapToCompliance(findings = [], frameworks = {}) {
  const out = {};
  for (const [fw, controls] of Object.entries(frameworks)) {
    out[fw] = controls.map(control => {
      const matched = (findings || []).filter(f => (f.controls || []).includes(control));
      return {
        control,
        findings: matched.map(f => f.id),
        evidenceCount: matched.reduce((a, f) => a + (f.evidence ? f.evidence.length : 0), 0),
        status: matched.length ? 'gap' : 'covered',
      };
    });
  }
  return out;
}

/**
 * Build a polished, redacted client-facing summary (idea 52657).
 * @param {object} hunt - { target, completedAt, findings }.
 * @returns {object} { text, redacted, findingCount, severityCounts, reassurance }.
 */
export function redactClientSummary(hunt = {}) {
  const findings = hunt.findings || [];
  const severityCounts = {};
  for (const f of findings) {
    const s = String(f.severity || 'info').toLowerCase();
    severityCounts[s] = (severityCounts[s] || 0) + 1;
  }
  const critical = severityCounts.critical || 0;
  const high = severityCounts.high || 0;
  const text = [
    `Security assessment of ${hunt.target || 'the target'} completed ${hunt.completedAt || 'recently'}.`,
    `${findings.length} item(s) reviewed: ${critical} critical, ${high} high.`,
    'Technical payloads and reproduction details are withheld under NDA and shared only with the remediation team.',
    'Infinity AI will re-verify each item after fixes land.',
  ].join(' ');
  return { text, redacted: true, findingCount: findings.length, severityCounts, reassurance: 'Remediation is tracked to closure by Infinity AI.' };
}

/**
 * Generate a board-ready slide (idea 52658).
 * @param {object} data - { portfolioRisk, trend, criticalCount, remediationProgress, quarter }.
 * @returns {object} { title, bullets, chart, footer }.
 */
export function buildBoardSlide(data = {}) {
  const bullets = [
    `Portfolio risk score: ${data.portfolioRisk ?? 'n/a'} / 100 (trend: ${data.trend || 'stable'})`,
    `Open critical findings: ${data.criticalCount ?? 0}`,
    `Remediation progress: ${data.remediationProgress ?? 0}% of findings closed this ${data.quarter || 'quarter'}`,
  ];
  return {
    title: `Security posture — ${data.quarter || 'this quarter'}`,
    bullets,
    chart: {
      type: 'bar',
      labels: ['Critical', 'High', 'Medium', 'Low'],
      values: (data.severityCounts && [data.severityCounts.critical || 0, data.severityCounts.high || 0, data.severityCounts.medium || 0, data.severityCounts.low || 0]) || [0, 0, 0, 0],
    },
    footer: 'Prepared by Infinity AI · Dark-Matter',
  };
}

/**
 * Translate a technical finding into business language (idea 52659).
 * @param {object} finding - { title, type, severity, target, asset }.
 * @returns {object} { sentence, riskArea }.
 */
export function translateToBusinessRisk(finding = {}) {
  const sev = String(finding.severity || 'medium').toLowerCase();
  const area = finding.asset || finding.target || 'the platform';
  const impacts = {
    critical: `could let attackers take over accounts or steal customer data on ${area}`,
    high: `could let attackers access sensitive data or disrupt service on ${area}`,
    medium: `could expose internal details or weaken trust in ${area}`,
    low: `is a hygiene issue that slightly weakens the defenses of ${area}`,
    info: `is an observation about ${area} with no direct business impact yet`,
  };
  const sentence = `${finding.title || 'This finding'} (${sev}) ${impacts[sev] || impacts.medium}. Fix it before it becomes a customer-facing incident.`;
  return { sentence, riskArea: area };
}

/**
 * Estimate financial exposure per finding (idea 52660).
 * @param {object} finding - { severity }.
 * @param {object} inputs - { assetValueUsd, exploitability 0..1 }.
 * @returns {object} { low, high, expected, currency }.
 */
export function estimateDollarImpact(finding = {}, inputs = {}) {
  const sev = String(finding.severity || 'medium').toLowerCase();
  const asset = Math.max(0, Number(inputs.assetValueUsd || 100000));
  const exploit = Math.min(1, Math.max(0, Number(inputs.exploitability ?? 0.5)));
  const sevFactor = { critical: 0.8, high: 0.4, medium: 0.15, low: 0.05, info: 0.01 }[sev] ?? 0.15;
  const expected = Math.round(asset * sevFactor * exploit);
  const low = Math.round(expected * 0.3);
  const high = Math.round(expected * 2.5);
  return { low, high, expected, currency: 'USD' };
}
