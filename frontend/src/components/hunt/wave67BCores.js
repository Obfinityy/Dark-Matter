/**
 * wave67BCores.js — stakeholder views & post-hunt reporting views (ideas 52661–52680).
 *
 * Pure logic for the likelihood×impact risk matrix, remediation roadmaps,
 * per-developer ticket slices, DevOps infrastructure grouping, product-manager
 * risk summaries, legal disclosure flags, marketing-safe summaries,
 * role-based default views, the view switcher, saved stakeholder views,
 * executive one-pager structure, engineer detail packs, control-coverage
 * mapping, SLA compliance, executive trends, peer benchmarks, the
 * "what we fixed" showcase, the "what remains" inventory, per-asset-owner
 * views, and per-team rollups.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE67_B_IDEAS = [
  { id: 52661, title: 'Likelihood × impact matrix', skip: false },
  { id: 52662, title: 'Remediation roadmap view', skip: false },
  { id: 52663, title: 'Developer ticket view', skip: false },
  { id: 52664, title: 'DevOps infrastructure view', skip: false },
  { id: 52665, title: 'Product-manager view', skip: false },
  { id: 52666, title: 'Legal disclosure view', skip: false },
  { id: 52667, title: 'Marketing-safe summary', skip: false },
  { id: 52668, title: 'Role-based default views', skip: false },
  { id: 52669, title: 'View switcher', skip: false },
  { id: 52670, title: 'Saved stakeholder views', skip: false },
  { id: 52671, title: 'Exec one-pager PDF', skip: false },
  { id: 52672, title: 'Engineer full-detail PDF', skip: false },
  { id: 52673, title: 'Control-coverage view', skip: false },
  { id: 52674, title: 'SLA-compliance view', skip: false },
  { id: 52675, title: 'Trend view for executives', skip: false },
  { id: 52676, title: 'Benchmark view', skip: false },
  { id: 52677, title: '"What we fixed" board view', skip: false },
  { id: 52678, title: '"What remains" view', skip: false },
  { id: 52679, title: 'Per-asset-owner view', skip: false },
  { id: 52680, title: 'Per-team rollup view', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Place each finding on the likelihood×impact matrix (idea 52661).
 * Axes: low/medium/high. Cell name like "high-impact/high-likelihood".
 * @param {Array} findings - Findings with severity and exploitability (0..1).
 * @returns {object} { cells: { '<cell>': [ids] }, placements: [...] }.
 */
export function placeInRiskMatrix(findings = []) {
  const band = v => (v >= 0.66 ? 'high' : v >= 0.33 ? 'medium' : 'low');
  const cells = {};
  const placements = [];
  for (const f of findings) {
    const impact = band(severityRank(f.severity) / 4);
    const likelihood = band(Math.min(1, Math.max(0, Number(f.exploitability ?? severityRank(f.severity) / 4))));
    const cell = `${impact}-impact/${likelihood}-likelihood`;
    (cells[cell] = cells[cell] || []).push(f.id);
    placements.push({ id: f.id, impact, likelihood, cell });
  }
  return { cells, placements };
}

/**
 * Order findings into a phased remediation plan (idea 52662).
 * Phase 1: criticals; phase 2: highs; phase 3: the rest. Dependencies first.
 * @param {Array} findings - Findings with severity, effortHours, dependsOn.
 * @returns {Array} Phases: [{ phase, title, items: [ids], effortHours }].
 */
export function planRemediationRoadmap(findings = []) {
  const open = (findings || []).filter(f => !['fixed', 'verified', 'dismissed'].includes(f.status));
  const byId = Object.fromEntries(open.map(f => [f.id, f]));
  const order = ids => {
    const seen = new Set();
    const out = [];
    const visit = id => {
      if (seen.has(id) || !byId[id]) return;
      seen.add(id);
      for (const dep of byId[id].dependsOn || []) visit(dep);
      out.push(id);
    };
    ids.forEach(visit);
    return out;
  };
  const phases = [
    { phase: 1, title: 'Stop the bleeding', match: f => severityRank(f.severity) >= 4 },
    { phase: 2, title: 'Harden the platform', match: f => severityRank(f.severity) === 3 },
    { phase: 3, title: 'Cleanup & hygiene', match: f => severityRank(f.severity) <= 2 },
  ];
  return phases
    .map(p => {
      const ids = order(open.filter(p.match).map(f => f.id));
      const effortHours = ids.reduce((a, id) => a + (Number(byId[id].effortHours) || 4), 0);
      return { phase: p.phase, title: p.title, items: ids, effortHours };
    })
    .filter(p => p.items.length > 0);
}

/**
 * Slice findings down to what one repo/service team must fix (idea 52663).
 * @param {Array} hunts - Hunts with findings carrying repo/service.
 * @param {string} repo - Repository or service name.
 * @returns {object} { repo, findings, openCount, topSeverity }.
 */
export function sliceForDeveloper(hunts = [], repo) {
  const findings = (hunts || [])
    .flatMap(h => (h.findings || []).map(f => ({ ...f, huntId: h.id })))
    .filter(f => f.repo === repo || f.service === repo);
  const open = findings.filter(f => !['fixed', 'verified', 'dismissed'].includes(f.status));
  const top = open.map(f => severityRank(f.severity));
  const ranks = { 4: 'critical', 3: 'high', 2: 'medium', 1: 'low', 0: 'info' };
  return { repo, findings: open.map(f => f.id), openCount: open.length, topSeverity: top.length ? ranks[Math.max(...top)] : 'none' };
}

/**
 * Group infrastructure-class findings for platform teams (idea 52664).
 * @param {Array} findings - Findings with category.
 * @returns {object} { tls: [], headers: [], misconfig: [], network: [], other: [] }.
 */
export function groupInfraFindings(findings = []) {
  const groups = { tls: [], headers: [], misconfig: [], network: [], other: [] };
  for (const f of findings) {
    const c = String(f.category || '').toLowerCase();
    if (/tls|ssl|cert|cipher|hsts/.test(c)) groups.tls.push(f.id);
    else if (/header|csp|cors|cookie/.test(c)) groups.headers.push(f.id);
    else if (/misconfig|exposure|default|debug/.test(c)) groups.misconfig.push(f.id);
    else if (/network|port|dns|firewall/.test(c)) groups.network.push(f.id);
    else groups.other.push(f.id);
  }
  return groups;
}

/**
 * Summarize feature-level security debt for product managers (idea 52665).
 * @param {Array} findings - Findings with productArea.
 * @returns {Array} [{ area, debtScore, open, criticals }] sorted by debt.
 */
export function summarizeProductRisk(findings = []) {
  const per = {};
  for (const f of findings) {
    const area = f.productArea || 'Unassigned';
    per[area] = per[area] || { area, open: 0, criticals: 0, debtScore: 0 };
    if (['fixed', 'verified', 'dismissed'].includes(f.status)) continue;
    per[area].open += 1;
    if (severityRank(f.severity) >= 4) per[area].criticals += 1;
    per[area].debtScore += severityRank(f.severity) * 2;
  }
  return Object.values(per).sort((a, b) => b.debtScore - a.debtScore);
}

/**
 * Flag findings with breach-notification or disclosure obligations (idea 52666).
 * @param {Array} findings - Findings with dataTypes and severity.
 * @returns {Array} [{ id, obligation, why, notifyWithinHours }].
 */
export function flagDisclosureObligations(findings = []) {
  const flagged = [];
  for (const f of findings || []) {
    const types = (f.dataTypes || []).map(t => String(t).toLowerCase());
    const personal = types.some(t => /pii|personal|payment|health|credential/.test(t));
    if (severityRank(f.severity) >= 4 && personal) {
      flagged.push({
        id: f.id,
        obligation: 'breach-notification-review',
        why: `Critical finding touches ${types.join(', ')} — counsel must assess notification duties.`,
        notifyWithinHours: 72,
      });
    } else if (severityRank(f.severity) >= 3 && personal) {
      flagged.push({
        id: f.id,
        obligation: 'disclosure-assessment',
        why: `High finding touches ${types.join(', ')} — assess contractual disclosure duties.`,
        notifyWithinHours: 168,
      });
    }
  }
  return flagged;
}

/**
 * Build a public-comms-safe posture statement (idea 52667).
 * Zero technical detail, no finding counts by severity, no targets.
 * @param {object} posture - { program: 'active', lastAudit }.
 * @returns {object} { statement, safe: true }.
 */
export function buildMarketingSummary(posture = {}) {
  const statement = [
    'We take security seriously.',
    'An independent-style continuous assessment program reviews our platform,',
    'and every issue we find is tracked to verified closure.',
    posture.lastAudit ? `Our most recent review completed ${posture.lastAudit}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { statement, safe: true };
}

/**
 * Resolve which view each role lands on at login (idea 52668).
 * @param {object} user - { id, role }.
 * @returns {object} { role, view }.
 */
export function resolveDefaultView(user = {}) {
  const role = String(user.role || 'engineer').toLowerCase();
  const map = {
    executive: 'exec-dashboard',
    board: 'board-slide',
    auditor: 'compliance',
    client: 'client-summary',
    legal: 'disclosure',
    marketing: 'marketing-summary',
    devops: 'infra',
    pm: 'product',
    engineer: 'engineer-detail',
    developer: 'tickets',
  };
  return { role, view: map[role] || 'engineer-detail' };
}

/**
 * Describe switching between exec/engineer/auditor/client views (idea 52669).
 * @param {object} hunt - Hunt summary.
 * @param {string} view - Target view key.
 * @returns {object} { view, title, payload }.
 */
export function switchView(hunt = {}, view = 'exec-dashboard') {
  const views = {
    'exec-dashboard': { title: 'Executive dashboard', payload: { riskScore: hunt.riskScore ?? null, open: (hunt.findings || []).length } },
    'engineer-detail': { title: 'Engineer technical view', payload: { findings: (hunt.findings || []).map(f => f.id) } },
    compliance: { title: 'Auditor compliance view', payload: { controls: hunt.controls || [] } },
    'client-summary': { title: 'Client-facing summary', payload: { target: hunt.target, redacted: true } },
  };
  const chosen = views[view] || views['exec-dashboard'];
  return { view, title: chosen.title, payload: chosen.payload, switchedAt: new Date().toISOString() };
}

/**
 * Save a customized stakeholder view and share it with a group (idea 52670).
 * @param {object} v - { name, view, filters, columns, group }.
 * @returns {object} { id, name, view, filters, columns, sharedWith }.
 */
export function saveStakeholderView(v = {}) {
  const raw = `${v.name || 'view'}:${v.view || 'exec-dashboard'}:${v.group || 'all'}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return {
    id: `view_${hash.toString(36)}`,
    name: v.name || 'Untitled view',
    view: v.view || 'exec-dashboard',
    filters: v.filters || {},
    columns: v.columns || [],
    sharedWith: v.group || 'all stakeholders',
  };
}

/**
 * Structure the single-page executive PDF (idea 52671).
 * @param {object} data - { portfolioRisk, trend, topRisks, decisions }.
 * @returns {object} { title, sections, footer } — exactly 4 sections.
 */
export function buildExecOnePager(data = {}) {
  return {
    title: 'Executive security one-pager',
    sections: [
      { heading: 'Score', body: `Portfolio risk: ${data.portfolioRisk ?? 'n/a'}/100 (${data.trend || 'stable'}).` },
      { heading: 'Trend', body: `Risk is ${data.trend || 'stable'} versus last quarter.` },
      { heading: 'Top risks', body: (data.topRisks || []).slice(0, 3).map(r => `${r.title} (${r.severity})`).join('; ') || 'None outstanding.' },
      { heading: 'Decisions needed', body: (data.decisions || []).join('; ') || 'None pending.' },
    ],
    footer: 'Infinity AI · Dark-Matter — confidential',
  };
}

/**
 * Structure the exhaustive engineer detail pack (idea 52672).
 * @param {object} finding - Finding with all artifacts.
 * @returns {object} { title, artifacts }.
 */
export function buildEngineerDetailPack(finding = {}) {
  const artifacts = [
    { name: 'Summary', content: `${finding.title || 'Finding'} — severity ${finding.severity || 'unknown'} on ${finding.target || 'target'}.` },
    { name: 'Evidence', content: (finding.evidence || []).join('\n') || 'No captured evidence.' },
    { name: 'Payloads', content: (finding.payloads || []).join('\n') || 'No payloads recorded.' },
    { name: 'Reproduction', content: (finding.reproSteps || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || 'No steps recorded.' },
    { name: 'Fix guidance', content: finding.fixGuidance || 'Apply the documented mitigation and re-verify.' },
    { name: 'References', content: (finding.references || []).join('\n') || 'None.' },
  ];
  return { title: `Engineer pack — ${finding.id || 'finding'}`, artifacts };
}

/**
 * Map findings against security controls to show failures (idea 52673).
 * @param {Array} findings - Findings with controls.
 * @param {Array} controls - Control ids, e.g. ['WAF', 'MFA', ...].
 * @returns {Array} [{ control, failures: [ids], status }].
 */
export function mapControlCoverage(findings = [], controls = []) {
  return (controls || []).map(control => {
    const failures = (findings || [])
      .filter(f => !['fixed', 'verified', 'dismissed'].includes(f.status) && (f.failedControls || []).includes(control))
      .map(f => f.id);
    return { control, failures, status: failures.length ? 'failed' : 'holding' };
  });
}

/**
 * Compute triage/fix SLA adherence per team and severity (idea 52674).
 * @param {Array} findings - Findings with severity, team, foundAt, triagedAt, fixedAt.
 * @param {object} slas - { triage: {critical: h}, fix: {...} } hours.
 * @param {Date|string} [now] - Reference time.
 * @returns {object} Per-team per-severity { met, breached, adherencePct }.
 */
export function computeSlaCompliance(findings = [], slas = {}, now = new Date()) {
  const nowMs = new Date(now).getTime();
  const out = {};
  const bump = (team, sev, met) => {
    out[team] = out[team] || {};
    out[team][sev] = out[team][sev] || { met: 0, breached: 0 };
    out[team][sev][met ? 'met' : 'breached'] += 1;
  };
  for (const f of findings) {
    const team = f.team || 'unassigned';
    const sev = String(f.severity || 'info').toLowerCase();
    const foundMs = new Date(f.foundAt).getTime();
    const triageSla = slas.triage && slas.triage[sev];
    const fixSla = slas.fix && slas.fix[sev];
    if (triageSla) {
      const done = f.triagedAt ? new Date(f.triagedAt).getTime() : nowMs;
      bump(team, sev, done - foundMs <= triageSla * 3600000);
    }
    if (fixSla && !['fixed', 'verified'].includes(f.status)) {
      bump(team, sev, nowMs - foundMs <= fixSla * 3600000);
    }
  }
  for (const team of Object.keys(out)) {
    for (const sev of Object.keys(out[team])) {
      const s = out[team][sev];
      const total = s.met + s.breached;
      s.adherencePct = total ? Math.round((s.met / total) * 100) : 100;
    }
  }
  return out;
}

/**
 * Build the multi-quarter executive trend (idea 52675).
 * @param {Array} quarters - [{ label, riskScore, criticals, annotation }].
 * @returns {object} { points, direction, narrative }.
 */
export function buildExecTrend(quarters = []) {
  const points = (quarters || []).map(q => ({ label: q.label, riskScore: q.riskScore, criticals: q.criticals || 0, annotation: q.annotation || null }));
  let direction = 'flat';
  if (points.length >= 2) {
    const d = points[points.length - 1].riskScore - points[0].riskScore;
    direction = d < -5 ? 'improving' : d > 5 ? 'worsening' : 'flat';
  }
  const annotated = points.filter(p => p.annotation).map(p => `${p.label}: ${p.annotation}`).join('; ');
  return {
    points,
    direction,
    narrative: `Risk is ${direction} across ${points.length} quarter(s).${annotated ? ` Annotations — ${annotated}.` : ''}`,
  };
}

/**
 * Benchmark posture against anonymized peers (idea 52676).
 * @param {object} ours - { riskScore, mttrHours }.
 * @param {Array} peers - [{ riskScore, mttrHours }] anonymized.
 * @returns {object} { percentile, framing }.
 */
export function benchmarkPosture(ours = {}, peers = []) {
  const list = peers || [];
  const better = list.filter(p => (p.riskScore ?? 100) >= (ours.riskScore ?? 0)).length;
  const percentile = list.length ? Math.round((better / list.length) * 100) : 50;
  return {
    percentile,
    framing: `Infinity AI assesses this posture as better than ${percentile}% of anonymized peers on composite risk${ours.mttrHours ? `, with a ${ours.mttrHours}h mean time to remediate` : ''}.`,
  };
}

/**
 * Build the "what we fixed" showcase (idea 52677).
 * @param {Array} fixed - Fixed findings with fixedAt.
 * @returns {Array} [{ id, title, fixedAt, severity }] newest first.
 */
export function buildFixedBoard(fixed = []) {
  return [...(fixed || [])]
    .filter(f => ['fixed', 'verified'].includes(f.status))
    .sort((a, b) => new Date(b.fixedAt || 0) - new Date(a.fixedAt || 0))
    .map(f => ({ id: f.id, title: f.title, fixedAt: f.fixedAt || null, severity: f.severity }));
}

/**
 * Build the open-risk inventory with owners and ETAs (idea 52678).
 * @param {Array} findings - Open findings with owner and dueAt.
 * @returns {Array} [{ id, title, severity, owner, eta, overdue }] sorted by severity.
 */
export function buildOpenRiskInventory(findings = []) {
  const nowMs = Date.now();
  return (findings || [])
    .filter(f => !['fixed', 'verified', 'dismissed'].includes(f.status))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      owner: f.owner || f.assignee || 'unassigned',
      eta: f.dueAt || null,
      overdue: Boolean(f.dueAt && new Date(f.dueAt).getTime() < nowMs),
    }));
}

/**
 * Show one asset owner only their assets' findings and SLAs (idea 52679).
 * @param {Array} hunts - Hunts with owner and findings.
 * @param {string} owner - Asset owner id.
 * @returns {object} { owner, assets, findings, slaSummary }.
 */
export function viewForAssetOwner(hunts = [], owner) {
  const mine = (hunts || []).filter(h => h.owner === owner);
  const findings = mine.flatMap(h => (h.findings || []).map(f => ({ ...f, huntId: h.id })));
  const open = findings.filter(f => !['fixed', 'verified', 'dismissed'].includes(f.status));
  const withSla = findings.filter(f => f.slaHours).length;
  return {
    owner,
    assets: mine.map(h => h.target),
    findings: open.map(f => ({ id: f.id, title: f.title, severity: f.severity, status: f.status })),
    slaSummary: { total: findings.length, withSla, open: open.length },
  };
}

/**
 * Aggregate posture per engineering team (idea 52680).
 * @param {Array} hunts - Hunts with team and findings.
 * @returns {Array} [{ team, open, criticals, riskScore }] sorted by risk.
 */
export function rollupByTeam(hunts = []) {
  const per = {};
  for (const h of hunts || []) {
    const team = h.team || 'unassigned';
    per[team] = per[team] || { team, open: 0, criticals: 0, riskScore: 0 };
    for (const f of h.findings || []) {
      if (['fixed', 'verified', 'dismissed'].includes(f.status)) continue;
      per[team].open += 1;
      if (severityRank(f.severity) >= 4) per[team].criticals += 1;
      per[team].riskScore += { critical: 25, high: 10, medium: 4, low: 1, info: 0.5 }[String(f.severity).toLowerCase()] ?? 1;
    }
  }
  return Object.values(per)
    .map(t => ({ ...t, riskScore: Math.min(100, Math.round(t.riskScore)) }))
    .sort((a, b) => b.riskScore - a.riskScore);
}
