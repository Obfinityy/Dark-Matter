/**
 * wave68ACore.js — stakeholder views part 3 (ideas 52681–52700).
 *
 * Pure logic for vendor-risk, M&A diligence, cyber-insurance,
 * pen-test-equivalence, red-team narrative, blue-team detection, SOC triage,
 * incident-response handoff, threat-model linkage, architecture review,
 * API-owner, mobile-team, data-team, and privacy (DPO) views, plus
 * per-stakeholder annotations, comments, exports, emails, view permissions,
 * and the stakeholder view audit log. Every view builder takes findings or
 * hunts and returns a real structured view model with filtered/grouped
 * findings, counts, severity rollups, and redaction where relevant.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */

/** Registry of all 20 ideas in this module — 20/20, zero skips. */
export const WAVE68_A_IDEAS = [
  { id: 52681, title: 'Vendor-risk view', skip: false },
  { id: 52682, title: 'M&A diligence view', skip: false },
  { id: 52683, title: 'Cyber-insurance view', skip: false },
  { id: 52684, title: 'Pen-test-equivalence view', skip: false },
  { id: 52685, title: 'Red-team narrative view', skip: false },
  { id: 52686, title: 'Blue-team detection view', skip: false },
  { id: 52687, title: 'SOC triage view', skip: false },
  { id: 52688, title: 'Incident-response handoff view', skip: false },
  { id: 52689, title: 'Threat-model linkage view', skip: false },
  { id: 52690, title: 'Architecture-review view', skip: false },
  { id: 52691, title: 'API-owner view', skip: false },
  { id: 52692, title: 'Mobile-team view', skip: false },
  { id: 52693, title: 'Data-team view', skip: false },
  { id: 52694, title: 'Privacy (DPO) view', skip: false },
  { id: 52695, title: 'Per-stakeholder annotations', skip: false },
  { id: 52696, title: 'Per-stakeholder comments', skip: false },
  { id: 52697, title: 'Per-stakeholder exports', skip: false },
  { id: 52698, title: 'Per-stakeholder emails', skip: false },
  { id: 52699, title: 'Stakeholder view permissions', skip: false },
  { id: 52700, title: 'Stakeholder view audit log', skip: false },
];

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const SEVERITY_WEIGHT = { critical: 25, high: 10, medium: 4, low: 1, info: 0.5 };
const CLOSED_STATUSES = ['fixed', 'verified', 'dismissed', 'closed'];

function severityRank(sev) {
  return SEVERITY_RANK[String(sev || 'info').toLowerCase()] ?? 0;
}

function sevKey(f) {
  return String((f && f.severity) || 'info').toLowerCase();
}

function isOpen(f) {
  return !CLOSED_STATUSES.includes(String((f && f.status) || 'open').toLowerCase());
}

function flattenHunts(hunts) {
  return (hunts || []).flatMap(h => ((h && h.findings) || []).map(f => ({ ...f, huntId: h.id, target: f.target || h.target })));
}

function severityCounts(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings || []) counts[sevKey(f)] = (counts[sevKey(f)] || 0) + 1;
  return counts;
}

function riskScoreOf(findings) {
  const sum = (findings || []).filter(isOpen).reduce((a, f) => a + (SEVERITY_WEIGHT[sevKey(f)] ?? 1), 0);
  return Math.min(100, Math.round(sum));
}

function shortHash(text) {
  let hash = 0;
  const raw = String(text);
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

function topBySeverity(findings, limit) {
  return [...(findings || [])]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (Number(b.riskScore) || 0) - (Number(a.riskScore) || 0))
    .slice(0, limit);
}

/**
 * Group third-party and vendor findings into a vendor-risk view (idea 52681).
 * Internal findings are grouped under the Internal vendor so totals reconcile.
 * @param {Array} findings - Findings with vendor/thirdParty fields.
 * @param {Array} vendors - Optional vendor directory [{ name, criticality }].
 * @returns {object} { vendors, totalVendors, highestRiskVendor, openTotal }.
 */
export function buildVendorRiskView(findings = [], vendors = []) {
  const directory = {};
  for (const v of vendors || []) directory[String(v.name || '').toLowerCase()] = v;
  const per = {};
  for (const f of findings || []) {
    const name = f.vendor || f.thirdParty || f.third_party || 'Internal';
    const key = String(name);
    per[key] = per[key] || { vendor: key, findings: [], open: 0, criticals: 0, riskScore: 0, criticality: (directory[key.toLowerCase()] || {}).criticality || 'standard' };
    per[key].findings.push(f.id);
    if (isOpen(f)) {
      per[key].open += 1;
      per[key].riskScore += SEVERITY_WEIGHT[sevKey(f)] ?? 1;
      if (severityRank(f.severity) >= 4) per[key].criticals += 1;
    }
  }
  const rows = Object.values(per)
    .map(v => ({ ...v, riskScore: Math.min(100, Math.round(v.riskScore)) }))
    .sort((a, b) => b.riskScore - a.riskScore);
  return {
    vendors: rows,
    totalVendors: rows.length,
    highestRiskVendor: rows.length ? rows[0].vendor : null,
    openTotal: rows.reduce((a, v) => a + v.open, 0),
    counts: severityCounts(findings),
  };
}

/**
 * Build an M&A diligence view over target hunts (idea 52682).
 * Surfaces the asset inventory, unresolved deal-breaker risks, and a
 * diligence recommendation derived from open critical/high counts.
 * @param {Array} hunts - Hunts with target, findings, completedAt.
 * @returns {object} Diligence summary with assets and data-room items.
 */
export function buildMaDiligenceView(hunts = []) {
  const all = flattenHunts(hunts);
  const open = all.filter(isOpen);
  const assets = [...new Set((hunts || []).map(h => h.target).filter(Boolean))];
  const criticals = open.filter(f => severityRank(f.severity) >= 4);
  const highs = open.filter(f => severityRank(f.severity) === 3);
  const dataRoomItems = [
    `${assets.length} target asset(s) inventoried`,
    `${all.length} finding(s) reviewed across ${(hunts || []).length} hunt(s)`,
    criticals.length ? `${criticals.length} unresolved critical(s) require price or escrow adjustment` : 'No unresolved criticals',
    'Remediation owners and ETAs attached per open finding',
  ];
  const recommendation = criticals.length > 0 ? 'proceed-with-conditions' : highs.length > 2 ? 'proceed-with-remediation-plan' : 'proceed';
  return {
    assets,
    assetCount: assets.length,
    openCriticals: criticals.map(f => f.id),
    openHighs: highs.map(f => f.id),
    counts: severityCounts(all),
    riskScore: riskScoreOf(all),
    dataRoomItems,
    recommendation,
  };
}

/**
 * Build a cyber-insurance underwriting view (idea 52683).
 * Scores insurability from open severity load and control gaps, estimates
 * exposure, and lists likely exclusions an underwriter would raise.
 * @param {Array} findings - Findings with controls/failedControls.
 * @param {object} policy - { requestedLimitUsd }.
 * @returns {object} { insurabilityScore, tier, exposure, controlGaps, exclusions }.
 */
export function buildCyberInsuranceView(findings = [], policy = {}) {
  const open = (findings || []).filter(isOpen);
  const counts = severityCounts(open);
  const penalty = counts.critical * 18 + counts.high * 8 + counts.medium * 3 + counts.low * 1;
  const insurabilityScore = Math.max(0, 100 - penalty);
  const tier = insurabilityScore >= 75 ? 'preferred' : insurabilityScore >= 50 ? 'standard' : insurabilityScore >= 25 ? 'substandard' : 'decline-review';
  const limit = Math.max(0, Number(policy.requestedLimitUsd || 1000000));
  const exposureBase = open.reduce((a, f) => a + (SEVERITY_WEIGHT[sevKey(f)] ?? 1), 0);
  const exposure = { low: Math.round(limit * Math.min(0.05, exposureBase / 2000)), high: Math.round(limit * Math.min(0.6, exposureBase / 120)), currency: 'USD' };
  const gapSet = new Set();
  for (const f of open) for (const c of f.failedControls || []) gapSet.add(c);
  const controlGaps = [...gapSet];
  const exclusions = [];
  if (counts.critical > 0) exclusions.push('Unremediated critical findings may be excluded until verified closed');
  if (controlGaps.includes('MFA')) exclusions.push('Missing MFA coverage is a common ransomware-claim exclusion');
  if (counts.high >= 3) exclusions.push('High-severity backlog may raise the deductible');
  return { insurabilityScore, tier, exposure, controlGaps, exclusions, openCount: open.length, counts };
}

/**
 * Map hunt coverage onto a classic penetration-test scope (idea 52684).
 * Compares covered categories against the requested scope categories and
 * states whether the hunt is equivalent, partial, or insufficient.
 * @param {Array} findings - Findings with category.
 * @param {object} scope - { categories: [names] }.
 * @returns {object} { covered, gaps, coveragePct, verdict }.
 */
export function buildPentestEquivalenceView(findings = [], scope = {}) {
  const wanted = (scope.categories || ['injection', 'xss', 'auth', 'access-control', 'misconfig', 'crypto', 'api']).map(c => String(c).toLowerCase());
  const present = new Set((findings || []).map(f => String(f.category || '').toLowerCase()).filter(Boolean));
  const covered = wanted.filter(c => [...present].some(p => p.includes(c) || c.includes(p)));
  const gaps = wanted.filter(c => !covered.includes(c));
  const coveragePct = wanted.length ? Math.round((covered.length / wanted.length) * 100) : 0;
  const verdict = coveragePct >= 90 ? 'equivalent' : coveragePct >= 60 ? 'partial-equivalence' : 'insufficient-coverage';
  return { covered, gaps, coveragePct, verdict, findingCount: (findings || []).length };
}

/**
 * Arrange chained findings into a red-team attack narrative (idea 52685).
 * Orders findings into access, escalation, persistence, and impact phases.
 * @param {Array} findings - Findings with exploitability and category.
 * @returns {object} { steps, killChainCoverage, summary }.
 */
export function buildRedTeamNarrative(findings = []) {
  const phaseOf = f => {
    const c = `${f.category || ''} ${f.title || ''}`.toLowerCase();
    if (/initial|recon|phish|exposure|disclosure/.test(c)) return 'access';
    if (/privilege|escalation|auth|session|idor|access-control/.test(c)) return 'escalation';
    if (/persist|token|cache|stored/.test(c)) return 'persistence';
    return 'impact';
  };
  const order = { access: 0, escalation: 1, persistence: 2, impact: 3 };
  const sorted = [...(findings || [])].sort(
    (a, b) => order[phaseOf(a)] - order[phaseOf(b)] || severityRank(b.severity) - severityRank(a.severity)
  );
  const steps = sorted.map((f, i) => ({
    step: i + 1,
    phase: phaseOf(f),
    findingId: f.id,
    narrative: `Step ${i + 1} (${phaseOf(f)}): ${f.title || f.id} on ${f.target || f.asset || 'target'} — ${f.severity || 'unknown'} severity, exploitability ${f.exploitability ?? 'n/a'}.`,
  }));
  const phases = [...new Set(steps.map(s => s.phase))];
  return {
    steps,
    killChainCoverage: phases,
    summary: steps.length
      ? `Infinity AI chained ${steps.length} finding(s) across ${phases.length} phase(s): ${phases.join(' -> ')}.`
      : 'No findings available to narrate.',
  };
}

/**
 * Build the blue-team detection view (idea 52686).
 * Maps each finding to the telemetry signal that should have fired and
 * flags detection gaps where no signal is recorded.
 * @param {Array} findings - Findings with detection/detected fields.
 * @returns {object} { detections, coveragePct, gaps }.
 */
export function buildBlueTeamDetectionView(findings = []) {
  const signalFor = f => {
    const c = `${f.category || ''} ${f.title || ''}`.toLowerCase();
    if (/sqli|injection/.test(c)) return 'WAF SQL-injection rule + database error telemetry';
    if (/xss/.test(c)) return 'CSP violation report + WAF XSS rule';
    if (/auth|login|brute/.test(c)) return 'Identity provider failed-login alerting';
    if (/tls|crypto|cert/.test(c)) return 'Certificate and TLS configuration monitoring';
    return 'Application error and access-log anomaly detection';
  };
  const detections = (findings || []).map(f => {
    const detected = Boolean(f.detected || f.detection === 'detected' || f.telemetry === 'present');
    return { id: f.id, title: f.title, expectedSignal: f.expectedSignal || signalFor(f), detected, gap: !detected };
  });
  const gaps = detections.filter(d => d.gap).map(d => d.id);
  const coveragePct = detections.length ? Math.round(((detections.length - gaps.length) / detections.length) * 100) : 100;
  return { detections, coveragePct, gaps, gapCount: gaps.length };
}

/**
 * Build the SOC triage queue (idea 52687).
 * Sorts open findings by severity and risk, assigns P1–P4 priorities with
 * response-time targets, and recommends the first triage action per item.
 * @param {Array} findings - Findings with severity, riskScore, foundAt.
 * @returns {object} { queue, counts }.
 */
export function buildSocTriageView(findings = []) {
  const sla = { critical: 15, high: 60, medium: 240, low: 1440, info: 4320 };
  const actionFor = f => {
    const s = sevKey(f);
    if (s === 'critical') return 'Page the on-call analyst and open an incident bridge';
    if (s === 'high') return 'Assign to the next available analyst this shift';
    if (s === 'medium') return 'Queue for same-day review and owner assignment';
    return 'Batch into the daily hygiene review';
  };
  const queue = (findings || [])
    .filter(isOpen)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (Number(b.riskScore) || 0) - (Number(a.riskScore) || 0))
    .map(f => ({
      id: f.id,
      title: f.title,
      severity: sevKey(f),
      priority: severityRank(f.severity) >= 4 ? 'P1' : severityRank(f.severity) === 3 ? 'P2' : severityRank(f.severity) === 2 ? 'P3' : 'P4',
      slaMinutes: sla[sevKey(f)],
      action: actionFor(f),
    }));
  const counts = {};
  for (const q of queue) counts[q.priority] = (counts[q.priority] || 0) + 1;
  return { queue, counts, queueLength: queue.length };
}

/**
 * Build the incident-response handoff packet (idea 52688).
 * Packages affected assets, containment actions, and evidence references
 * so the IR team can take over without re-running discovery.
 * @param {Array} findings - Findings contributing to the incident.
 * @param {object} incident - { id, title, declaredAt }.
 * @returns {object} Handoff packet with containment and evidence sections.
 */
export function buildIrHandoffView(findings = [], incident = {}) {
  const open = (findings || []).filter(isOpen);
  const assets = [...new Set(open.map(f => f.target || f.asset).filter(Boolean))];
  const containment = topBySeverity(open, 5).map(
    f => `Contain ${f.title || f.id} (${sevKey(f)}) on ${f.target || f.asset || 'target'}: isolate, patch, or feature-flag before broad rollout.`
  );
  const evidence = open.flatMap(f => (f.evidence || []).map(e => ({ findingId: f.id, evidence: e })));
  return {
    incidentId: incident.id || 'incident-draft',
    title: incident.title || 'Security incident handoff',
    declaredAt: incident.declaredAt || null,
    affectedAssets: assets,
    openFindings: open.map(f => f.id),
    counts: severityCounts(findings),
    containment,
    evidence,
    openQuestions: open.length ? ['Confirm business owner for each affected asset', 'Confirm maintenance window for containment'] : [],
    handoffNote: 'Prepared by Infinity AI · Dark-Matter for the incident-response team.',
  };
}

/**
 * Link findings to a threat model (idea 52689).
 * Matches on explicit threat ids first, then on shared assets, and reports
 * which modeled threats have no live finding and vice versa.
 * @param {Array} findings - Findings with threatId and asset/target.
 * @param {Array} threatModel - [{ id, threat, assets: [] }].
 * @returns {object} { linked, unlinkedFindings, coveragePct }.
 */
export function linkThreatModel(findings = [], threatModel = []) {
  const linked = (threatModel || []).map(t => {
    const matched = (findings || []).filter(f => {
      if (f.threatId && t.id) return String(f.threatId) === String(t.id);
      const assets = (t.assets || []).map(a => String(a).toLowerCase());
      return assets.includes(String(f.asset || '').toLowerCase()) || assets.includes(String(f.target || '').toLowerCase());
    });
    return { threatId: t.id, threat: t.threat || t.id, findingIds: matched.map(f => f.id), findingCount: matched.length };
  });
  const linkedIds = new Set(linked.flatMap(l => l.findingIds));
  const unlinkedFindings = (findings || []).filter(f => !linkedIds.has(f.id)).map(f => f.id);
  const withFindings = linked.filter(l => l.findingCount > 0).length;
  const coveragePct = linked.length ? Math.round((withFindings / linked.length) * 100) : 0;
  return { linked, unlinkedFindings, coveragePct, threatCount: linked.length };
}

/**
 * Build the architecture-review view (idea 52690).
 * Groups findings by component, marks trust-boundary crossings, and rolls
 * risk up per component for design-review discussion.
 * @param {Array} findings - Findings with component/asset.
 * @param {Array} components - Optional [{ name, boundary }].
 * @returns {object} { components, boundaries, counts }.
 */
export function buildArchitectureReviewView(findings = [], components = []) {
  const boundaryOf = {};
  for (const c of components || []) if (c && c.name) boundaryOf[String(c.name).toLowerCase()] = c.boundary || 'internal';
  const per = {};
  for (const f of findings || []) {
    const name = f.component || f.asset || f.target || 'Unassigned component';
    const key = String(name);
    per[key] = per[key] || { name: key, boundary: boundaryOf[key.toLowerCase()] || f.boundary || 'internal', findings: [], open: 0, criticals: 0, riskScore: 0 };
    per[key].findings.push(f.id);
    if (isOpen(f)) {
      per[key].open += 1;
      per[key].riskScore += SEVERITY_WEIGHT[sevKey(f)] ?? 1;
      if (severityRank(f.severity) >= 4) per[key].criticals += 1;
    }
  }
  const rows = Object.values(per)
    .map(c => ({ ...c, riskScore: Math.min(100, Math.round(c.riskScore)) }))
    .sort((a, b) => b.riskScore - a.riskScore);
  const boundaries = [...new Set(rows.map(r => r.boundary))];
  return { components: rows, boundaries, counts: severityCounts(findings) };
}

/**
 * Build the API-owner view (idea 52691).
 * Keeps API-surface findings only, groups them by endpoint and owner, and
 * highlights unauthenticated or overly permissive endpoints first.
 * @param {Array} findings - Findings with endpoint/path/surface.
 * @param {string} [owner] - Optional owner filter.
 * @returns {object} { owner, endpoints, findings, openCount }.
 */
export function buildApiOwnerView(findings = [], owner = null) {
  const isApi = f => {
    const hay = `${f.surface || ''} ${f.category || ''} ${f.endpoint || ''} ${f.path || ''} ${f.title || ''}`.toLowerCase();
    return /api|endpoint|graphql|rest/.test(hay);
  };
  const scoped = (findings || []).filter(isApi).filter(f => !owner || f.owner === owner || f.apiOwner === owner);
  const byEndpoint = {};
  for (const f of scoped) {
    const ep = f.endpoint || f.path || 'unknown-endpoint';
    byEndpoint[ep] = byEndpoint[ep] || { endpoint: ep, findings: [], open: 0, worstSeverity: 'info' };
    byEndpoint[ep].findings.push(f.id);
    if (isOpen(f)) byEndpoint[ep].open += 1;
    if (severityRank(f.severity) > severityRank(byEndpoint[ep].worstSeverity)) byEndpoint[ep].worstSeverity = sevKey(f);
  }
  const endpoints = Object.values(byEndpoint).sort((a, b) => severityRank(b.worstSeverity) - severityRank(a.worstSeverity));
  return {
    owner: owner || 'all-api-owners',
    endpoints,
    findings: scoped.filter(isOpen).map(f => f.id),
    openCount: scoped.filter(isOpen).length,
    counts: severityCounts(scoped),
  };
}

/**
 * Build the mobile-team view (idea 52692).
 * Splits mobile findings by platform and separates shared backend issues
 * from client-side store-review risks.
 * @param {Array} findings - Findings with platform fields.
 * @returns {object} { platforms, shared, storeRisks }.
 */
export function buildMobileTeamView(findings = []) {
  const isMobile = f => /ios|android|mobile/.test(`${f.platform || ''} ${f.category || ''} ${f.title || ''}`.toLowerCase());
  const mobile = (findings || []).filter(isMobile);
  const bucket = name => {
    const rows = mobile.filter(f => String(f.platform || '').toLowerCase().includes(name));
    return { platform: name, findings: rows.map(f => f.id), open: rows.filter(isOpen).length, counts: severityCounts(rows) };
  };
  const shared = mobile.filter(f => !/ios|android/.test(String(f.platform || '').toLowerCase())).map(f => f.id);
  const storeRisks = mobile
    .filter(f => /permission|privacy|tracking|certificate|pinning|storage/.test(`${f.category || ''} ${f.title || ''}`.toLowerCase()))
    .map(f => f.id);
  return { platforms: { ios: bucket('ios'), android: bucket('android') }, shared, storeRisks, mobileTotal: mobile.length };
}

/**
 * Build the data-team view (idea 52693).
 * Groups findings by data classification and type so the data team sees
 * pipeline and storage exposure without unrelated web findings.
 * @param {Array} findings - Findings with dataTypes/classification.
 * @returns {object} { byClassification, byDataType, exposure }.
 */
export function buildDataTeamView(findings = []) {
  const byClassification = {};
  const byDataType = {};
  for (const f of findings || []) {
    const cls = f.classification || (f.dataTypes && f.dataTypes.length ? 'regulated' : 'internal');
    byClassification[cls] = byClassification[cls] || { classification: cls, findings: [], open: 0 };
    byClassification[cls].findings.push(f.id);
    if (isOpen(f)) byClassification[cls].open += 1;
    for (const t of f.dataTypes || []) {
      byDataType[t] = byDataType[t] || { dataType: t, findings: [], open: 0 };
      byDataType[t].findings.push(f.id);
      if (isOpen(f)) byDataType[t].open += 1;
    }
  }
  const exposure = Object.values(byDataType).sort((a, b) => b.open - a.open).slice(0, 3).map(d => d.dataType);
  return {
    byClassification: Object.values(byClassification),
    byDataType: Object.values(byDataType).sort((a, b) => b.open - a.open),
    exposure,
    counts: severityCounts(findings),
  };
}

/**
 * Build the privacy (DPO) view (idea 52694).
 * Maps personal-data findings to GDPR/CCPA-style duties, counts PII
 * exposure, and lists the DPO actions each finding requires. Payloads and
 * reproduction detail are withheld from this view.
 * @param {Array} findings - Findings with dataTypes.
 * @returns {object} { regulations, piiExposure, dpoTasks, redacted }.
 */
export function buildPrivacyView(findings = []) {
  const personal = (findings || []).filter(f => (f.dataTypes || []).some(t => /pii|personal|payment|health|credential|biometric/i.test(String(t))));
  const regulations = [
    { name: 'GDPR', findings: [], duties: ['Lawful-basis review', 'Retention check'] },
    { name: 'CCPA/CPRA', findings: [], duties: ['Do-not-sell signal check', 'Request-handling review'] },
    { name: 'PCI DSS', findings: [], duties: ['Cardholder-data scope check'] },
  ];
  for (const f of personal) {
    const types = (f.dataTypes || []).join(' ').toLowerCase();
    if (/payment/.test(types)) regulations[2].findings.push(f.id);
    else regulations[0].findings.push(f.id);
    if (/pii|personal/.test(types)) regulations[1].findings.push(f.id);
  }
  for (const r of regulations) r.findings = [...new Set(r.findings)];
  const dpoTasks = personal
    .filter(isOpen)
    .map(f => ({ findingId: f.id, task: `DPO review for ${f.title || f.id}: confirm lawful basis, retention, and subject-request impact.`, severity: sevKey(f) }));
  return { regulations, piiExposure: personal.length, dpoTasks, redacted: true, counts: severityCounts(personal) };
}

/**
 * Append a per-stakeholder annotation without mutating history (idea 52695).
 * Annotations are view-scoped notes pinned to a finding by one stakeholder.
 * @param {Array} annotations - Existing annotations.
 * @param {object} annotation - { viewId, findingId, author, text, at }.
 * @returns {object} { annotations, annotation, total }.
 */
export function addStakeholderAnnotation(annotations = [], annotation = {}) {
  const created = {
    id: `ann_${shortHash(`${annotation.viewId || 'view'}:${annotation.findingId || 'finding'}:${annotation.author || 'anon'}:${annotation.text || ''}`)}`,
    viewId: annotation.viewId || 'default-view',
    findingId: annotation.findingId || null,
    author: annotation.author || 'anonymous',
    text: String(annotation.text || '').trim(),
    at: annotation.at || new Date().toISOString(),
  };
  const list = [...(annotations || []), created];
  return { annotations: list, annotation: created, total: list.length };
}

/**
 * Append a per-stakeholder comment, optionally threaded (idea 52696).
 * Comments support a parent id for threaded discussion per view.
 * @param {Array} comments - Existing comments.
 * @param {object} comment - { viewId, findingId, author, text, parentId, at }.
 * @returns {object} { comments, comment, threadCount }.
 */
export function addStakeholderComment(comments = [], comment = {}) {
  const created = {
    id: `cmt_${shortHash(`${comment.viewId || 'view'}:${comment.author || 'anon'}:${comment.text || ''}:${(comments || []).length}`)}`,
    viewId: comment.viewId || 'default-view',
    findingId: comment.findingId || null,
    author: comment.author || 'anonymous',
    text: String(comment.text || '').trim(),
    parentId: comment.parentId || null,
    at: comment.at || new Date().toISOString(),
  };
  const list = [...(comments || []), created];
  const threadCount = new Set(list.map(c => c.parentId || c.id)).size;
  return { comments: list, comment: created, threadCount };
}

/**
 * Build a per-stakeholder export package (idea 52697).
 * Honors view redaction: redacted views export titles and severities only,
 * never payloads or evidence. Produces real serialized content.
 * @param {object} view - { id, name, redacted }.
 * @param {Array} findings - Findings to export.
 * @param {string} [format] - json, csv, or markdown.
 * @returns {object} { format, filename, content, rows, redacted }.
 */
export function buildStakeholderExport(view = {}, findings = [], format = 'json') {
  const fmt = ['json', 'csv', 'markdown'].includes(String(format).toLowerCase()) ? String(format).toLowerCase() : 'json';
  const redacted = Boolean(view.redacted);
  const rows = (findings || []).map(f =>
    redacted
      ? { id: f.id, title: f.title, severity: sevKey(f), status: f.status || 'open' }
      : { id: f.id, title: f.title, severity: sevKey(f), status: f.status || 'open', target: f.target || null, cwe: f.cwe || null }
  );
  let content = '';
  if (fmt === 'json') content = JSON.stringify({ view: view.id || 'view', exportedBy: 'Infinity AI', rows }, null, 2);
  else if (fmt === 'csv') content = ['id,title,severity,status', ...rows.map(r => [r.id, `"${String(r.title || '').replace(/"/g, '""')}"`, r.severity, r.status].join(','))].join('\n');
  else content = [`# ${view.name || 'Stakeholder export'}`, '', ...rows.map(r => `- ${r.id}: ${r.title || ''} (${r.severity}, ${r.status})`)].join('\n');
  return {
    format: fmt,
    filename: `${view.id || 'stakeholder-view'}-export.${fmt === 'markdown' ? 'md' : fmt}`,
    content,
    rows: rows.length,
    bytes: content.length,
    checksum: shortHash(content),
    redacted,
  };
}

/**
 * Draft a per-stakeholder email for a saved view (idea 52698).
 * The body carries counts and top risks only; technical payloads stay in
 * the engineer view and are never placed in email.
 * @param {object} view - { id, name }.
 * @param {Array} findings - Findings summarized in the email.
 * @param {string} recipient - Destination address.
 * @returns {object} { to, subject, body, findingIds }.
 */
export function buildStakeholderEmail(view = {}, findings = [], recipient = '') {
  const open = (findings || []).filter(isOpen);
  const counts = severityCounts(open);
  const top = topBySeverity(open, 3);
  const subject = `[Infinity AI] ${view.name || 'Stakeholder update'} — ${open.length} open (${counts.critical} critical)`;
  const body = [
    `Hello,`,
    ``,
    `Your view "${view.name || view.id || 'stakeholder view'}" currently shows ${open.length} open finding(s): ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low.`,
    top.length ? `Top items: ${top.map(f => `${f.title || f.id} (${sevKey(f)})`).join('; ')}.` : 'No open items require attention.',
    ``,
    `Open the live view in Infinity AI · Dark-Matter for detail. This email omits payloads by design.`,
  ].join('\n');
  return { to: recipient, subject, body, findingIds: open.map(f => f.id) };
}

/**
 * Check whether a stakeholder may open or change a view (idea 52699).
 * Owners and admins always pass; otherwise the view role list decides.
 * @param {object} user - { id, role }.
 * @param {object} view - { id, owner, allowedRoles: [], visibility }.
 * @param {string} [action] - view, comment, export, or admin.
 * @returns {object} { allowed, reason, effectiveRole }.
 */
export function checkViewPermission(user = {}, view = {}, action = 'view') {
  const role = String(user.role || 'viewer').toLowerCase();
  if (view.owner && user.id && String(view.owner) === String(user.id)) {
    return { allowed: true, reason: 'view owner', effectiveRole: role };
  }
  if (role === 'admin') return { allowed: true, reason: 'admin role', effectiveRole: role };
  if (view.visibility === 'public' && action === 'view') {
    return { allowed: true, reason: 'public view', effectiveRole: role };
  }
  const allowedRoles = (view.allowedRoles || []).map(r => String(r).toLowerCase());
  if (allowedRoles.includes(role)) {
    if (action === 'admin') return { allowed: false, reason: `role ${role} cannot administer this view`, effectiveRole: role };
    return { allowed: true, reason: `role ${role} is on the view allow list`, effectiveRole: role };
  }
  return { allowed: false, reason: `role ${role} is not allowed to ${action} this view`, effectiveRole: role };
}

/**
 * Build the stakeholder view audit log summary (idea 52700).
 * Normalizes access events, rolls them up per user and per view, and
 * surfaces denied attempts for review.
 * @param {Array} events - [{ user, viewId, action, at, allowed }].
 * @returns {object} { entries, byUser, byView, deniedCount }.
 */
export function buildViewAuditLog(events = []) {
  const entries = [...(events || [])]
    .map(e => ({
      user: e.user || 'unknown',
      viewId: e.viewId || 'unknown-view',
      action: e.action || 'view',
      at: e.at || null,
      allowed: e.allowed !== false,
    }))
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const byUser = {};
  const byView = {};
  for (const e of entries) {
    byUser[e.user] = (byUser[e.user] || 0) + 1;
    byView[e.viewId] = (byView[e.viewId] || 0) + 1;
  }
  return { entries, byUser, byView, deniedCount: entries.filter(e => !e.allowed).length, total: entries.length };
}
