/**
 * huntCompareCore.js — Infinity AI · Dark-Matter · Wave 63 (ideas 52481–52500)
 * Pure JS (no React / DOM / network). Deterministic hunt-comparison diff:
 * persistent-findings list, severity migration tracking, diff summary counts,
 * side-by-side cards, endpoint coverage diff, attack-surface diff, risk-score
 * trends, multi-hunt overlay, delta reports, diff export, shareable links,
 * diff filters, per-class and per-asset diffs, chart data, field-level diff,
 * evidence diff, FP delta, remediation delta, and coverage-map diff.
 * Time is injected via `now` params (default Date.now()) so every function
 * is reproducible.
 *
 * Hunt shape used throughout:
 * {
 *   id, target, at, riskScore,
 *   findings: [{ id, title, severity, state, vulnClass, asset, evidence, detectedAt, fixedAt, fp }],
 *   endpoints: [path], tech: [name], subdomains: [host], params: [name],
 *   config: { depth, payloads, scope },
 * }
 */

export const WAVE63_HC_IDEAS = [
  { id: 52481, title: 'Persistent-findings list', desc: 'Findings present in both hunts, flagged with age to spotlight long-ignored issues.', skip: false },
  { id: 52482, title: 'Severity migration tracking', desc: 'Show findings whose severity changed between hunts and why (rescore, new evidence).', skip: false },
  { id: 52483, title: 'Diff summary counts', desc: 'Header stats: +12 new, −8 fixed, 34 persistent, 3 severity changes.', skip: false },
  { id: 52484, title: 'Side-by-side finding cards', desc: 'Compare the same finding across two hunts with evidence and scores adjacent.', skip: false },
  { id: 52485, title: 'Endpoint coverage diff', desc: 'Show which endpoints were covered in each hunt to explain finding differences.', skip: false },
  { id: 52486, title: 'Attack-surface diff', desc: 'Diff the discovered tech stack, subdomains, and parameters between hunts.', skip: false },
  { id: 52487, title: 'Risk-score trend line', desc: "Chart the target's overall risk score across every hunt over time.", skip: false },
  { id: 52488, title: 'Multi-hunt overlay', desc: 'Overlay three or more hunts to see long-term trajectories, not just pairs.', skip: false },
  { id: 52489, title: 'Regression delta report', desc: 'Auto-generated PDF of the regression diff for stakeholders.', skip: false },
  { id: 52490, title: 'Diff export', desc: 'Download the comparison dataset as CSV/JSON for external analysis.', skip: false },
  { id: 52491, title: 'Shareable diff links', desc: 'Send stakeholders a link that opens the exact comparison view.', skip: false },
  { id: 52492, title: 'Diff filters', desc: 'Filter comparisons by severity, state, vuln class, or asset.', skip: false },
  { id: 52493, title: 'Diff by vulnerability class', desc: 'See which vuln classes grew or shrank between hunts.', skip: false },
  { id: 52494, title: 'Diff by asset', desc: 'Per-asset new/fixed/persistent breakdowns for owner accountability.', skip: false },
  { id: 52495, title: 'Visual diff charts', desc: 'Bar and donut charts contrasting finding distributions across hunts.', skip: false },
  { id: 52496, title: 'Field-level finding diff', desc: 'Highlight exactly which fields changed on a persistent finding (status, severity, evidence).', skip: false },
  { id: 52497, title: 'Evidence diff', desc: 'Side-by-side old vs new proof for findings whose evidence changed.', skip: false },
  { id: 52498, title: 'False-positive delta', desc: 'Track FP counts and rates across hunts to measure detection-quality improvement.', skip: false },
  { id: 52499, title: 'Remediation delta', desc: 'Fixed-and-verified counts between hunts with MTTR trends.', skip: false },
  { id: 52500, title: 'Coverage-map diff', desc: 'Visual map of crawled endpoints in hunt A vs hunt B.', skip: false },
];

function tokenFor(scope, id, now) {
  const raw = `${scope}:${id}:${now}`;
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (Math.imul(h, 31) + raw.charCodeAt(i)) | 0;
  return `hc63_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function findingsOf(hunt) {
  return (hunt && Array.isArray(hunt.findings)) ? hunt.findings : [];
}
function listOf(hunt, key) {
  return (hunt && Array.isArray(hunt[key])) ? hunt[key] : [];
}
function matchById(a, b) {
  const bById = new Map(findingsOf(b).map((f) => [f.id, f]));
  return findingsOf(a).map((f) => ({ a: f, b: bById.get(f.id) || null }));
}

/* 52481 — Persistent-findings list: findings present in both hunts, flagged
 * with age (days since first seen) to spotlight long-ignored issues. */
export function persistentFindings(huntA, huntB, now = Date.now()) {
  const pairs = matchById(huntA, huntB);
  const persistent = pairs
    .filter((p) => p.b)
    .map((p) => {
      const firstSeen = Math.min(p.a.detectedAt || now, p.b.detectedAt || now);
      return { ...p.b, ageDays: Math.floor((now - firstSeen) / 86400000), huntAId: p.a.id, huntBId: p.b.id };
    })
    .sort((x, y) => y.ageDays - x.ageDays);
  return { ok: true, count: persistent.length, persistent, auditId: tokenFor('persist', (huntA && huntA.id) || 'x', now) };
}

/* 52482 — Severity migration tracking: findings whose severity changed between
 * hunts, with the reason (rescore, new evidence, or scope change). */
export function severityMigrations(huntA, huntB) {
  const pairs = matchById(huntA, huntB);
  const migrations = pairs
    .filter((p) => p.b && p.a.severity !== p.b.severity)
    .map((p) => ({
      id: p.b.id,
      from: p.a.severity,
      to: p.b.severity,
      reason: p.b.evidence && p.b.evidence !== p.a.evidence ? 'new evidence' : 'rescore',
    }));
  return { ok: true, count: migrations.length, migrations };
}

/* 52483 — Diff summary counts: header stats (+new, −fixed, persistent, severity changes). */
export function diffSummary(huntA, huntB) {
  const pairs = matchById(huntA, huntB);
  const bIds = new Set(findingsOf(huntB).map((f) => f.id));
  const added = findingsOf(huntB).filter((f) => !pairs.some((p) => p.a.id === f.id));
  const removed = findingsOf(huntA).filter((f) => !bIds.has(f.id));
  const persistent = pairs.filter((p) => p.b).length;
  const severityChanges = severityMigrations(huntA, huntB).count;
  return { ok: true, added: added.length, removed: removed.length, persistent, severityChanges };
}

/* 52484 — Side-by-side finding cards: the same finding across two hunts with
 * evidence and scores adjacent. */
export function findingSideBySide(findingA, findingB) {
  if (!findingA || !findingB || findingA.id !== findingB.id) {
    return { ok: false, reason: 'two revisions of the same finding id are required' };
  }
  return {
    ok: true,
    id: findingA.id,
    left: { severity: findingA.severity, state: findingA.state, evidence: findingA.evidence },
    right: { severity: findingB.severity, state: findingB.state, evidence: findingB.evidence },
    changed: findingA.severity !== findingB.severity || findingA.state !== findingB.state || findingA.evidence !== findingB.evidence,
  };
}

/* 52485 — Endpoint coverage diff: which endpoints were covered in each hunt. */
export function coverageDiff(huntA, huntB) {
  const a = new Set(listOf(huntA, 'endpoints'));
  const b = new Set(listOf(huntB, 'endpoints'));
  const onlyA = [...a].filter((e) => !b.has(e)).sort();
  const onlyB = [...b].filter((e) => !a.has(e)).sort();
  const both = [...a].filter((e) => b.has(e)).sort();
  return { ok: true, onlyA, onlyB, both, coverageA: a.size, coverageB: b.size };
}

/* 52486 — Attack-surface diff: diff discovered tech, subdomains, and params. */
export function attackSurfaceDiff(huntA, huntB) {
  const diffSet = (key) => {
    const a = new Set(listOf(huntA, key));
    const b = new Set(listOf(huntB, key));
    return { added: [...b].filter((x) => !a.has(x)).sort(), removed: [...a].filter((x) => !b.has(x)).sort() };
  };
  return { ok: true, tech: diffSet('tech'), subdomains: diffSet('subdomains'), params: diffSet('params') };
}

/* 52487 — Risk-score trend line: the target's overall risk score across hunts. */
export function riskTrend(hunts) {
  if (!Array.isArray(hunts) || hunts.length === 0) return { ok: false, reason: 'at least one hunt is required' };
  const points = hunts
    .filter((h) => typeof h.riskScore === 'number')
    .sort((x, y) => x.at - y.at)
    .map((h) => ({ huntId: h.id, at: h.at, score: h.riskScore }));
  const delta = points.length >= 2 ? points[points.length - 1].score - points[0].score : 0;
  return { ok: true, points, delta, direction: delta > 0 ? 'worsening' : delta < 0 ? 'improving' : 'flat' };
}

/* 52488 — Multi-hunt overlay: overlay three or more hunts for long-term
 * trajectories (open count and risk per hunt). */
export function overlayHunts(hunts) {
  if (!Array.isArray(hunts) || hunts.length < 3) return { ok: false, reason: 'at least three hunts are required' };
  const rows = hunts
    .slice()
    .sort((x, y) => x.at - y.at)
    .map((h) => ({
      huntId: h.id,
      at: h.at,
      open: findingsOf(h).filter((f) => f.state === 'open').length,
      critical: findingsOf(h).filter((f) => f.severity === 'critical').length,
      riskScore: typeof h.riskScore === 'number' ? h.riskScore : null,
    }));
  return { ok: true, count: rows.length, rows };
}

/* 52489 — Regression delta report: build the stakeholder report payload
 * (server renders the PDF; this produces the data + sections). */
export function deltaReport(huntA, huntB, now = Date.now()) {
  const summary = diffSummary(huntA, huntB);
  if (!summary.ok) return summary;
  const fp = fpDelta(huntA, huntB);
  const rem = remediationDelta(huntA, huntB);
  return {
    ok: true,
    reportId: tokenFor('report', (huntB && huntB.id) || 'x', now),
    generatedAt: now,
    sections: [
      { name: 'summary', data: summary },
      { name: 'false-positives', data: fp },
      { name: 'remediation', data: rem },
    ],
  };
}

/* 52490 — Diff export: the comparison dataset as CSV and JSON payloads. */
export function exportDiff(diff, huntsMeta) {
  if (!diff || !Array.isArray(diff.rows)) return { ok: false, reason: 'a diff object with rows is required' };
  const header = 'id,title,severity,state,vuln_class,asset';
  const lines = diff.rows.map((r) => [r.id, `"${(r.title || '').replace(/"/g, '""')}"`, r.severity, r.state, r.vulnClass, r.asset].join(','));
  return {
    ok: true,
    csv: [header, ...lines].join('\n'),
    json: JSON.stringify({ meta: huntsMeta || null, rows: diff.rows }, null, 2),
    rowCount: diff.rows.length,
  };
}

/* 52491 — Shareable diff links: a signed token link that opens the exact
 * comparison view (filters encoded in the payload). */
export function shareableDiffLink(huntAId, huntBId, filters, now = Date.now()) {
  if (!huntAId || !huntBId) return { ok: false, reason: 'both hunt ids are required' };
  const payload = Buffer.from(JSON.stringify({ a: huntAId, b: huntBId, filters: filters || {}, iat: now }), 'utf8').toString('base64url');
  const sig = tokenFor('share', `${huntAId}:${huntBId}`, now);
  return { ok: true, url: `https://app.infinityai.dev/diff/${payload}.${sig}`, expiresInDays: 30 };
}

/* 52492 — Diff filters: filter comparisons by severity, state, vuln class, asset. */
export function filterDiff(diff, filters) {
  if (!diff || !Array.isArray(diff.rows)) return { ok: false, reason: 'a diff object with rows is required' };
  const f = filters || {};
  const rows = diff.rows.filter((r) =>
    (!f.severity || r.severity === f.severity) &&
    (!f.state || r.state === f.state) &&
    (!f.vulnClass || r.vulnClass === f.vulnClass) &&
    (!f.asset || r.asset === f.asset)
  );
  return { ok: true, total: diff.rows.length, matched: rows.length, rows };
}

/* 52493 — Diff by vulnerability class: which vuln classes grew or shrank. */
export function diffByVulnClass(diff) {
  if (!diff || !Array.isArray(diff.rows)) return { ok: false, reason: 'a diff object with rows is required' };
  const by = {};
  for (const r of diff.rows) {
    const k = r.vulnClass || 'unknown';
    by[k] = by[k] || { vulnClass: k, added: 0, removed: 0, persistent: 0 };
    if (r.change === 'added') by[k].added += 1;
    else if (r.change === 'removed') by[k].removed += 1;
    else by[k].persistent += 1;
  }
  const rows = Object.values(by).sort((x, y) => (y.added - y.removed) - (x.added - x.removed));
  return { ok: true, rows };
}

/* 52494 — Diff by asset: per-asset new/fixed/persistent breakdowns. */
export function diffByAsset(diff) {
  if (!diff || !Array.isArray(diff.rows)) return { ok: false, reason: 'a diff object with rows is required' };
  const by = {};
  for (const r of diff.rows) {
    const k = r.asset || 'unknown';
    by[k] = by[k] || { asset: k, added: 0, removed: 0, persistent: 0 };
    if (r.change === 'added') by[k].added += 1;
    else if (r.change === 'removed') by[k].removed += 1;
    else by[k].persistent += 1;
  }
  const rows = Object.values(by).sort((x, y) => y.added - x.added);
  return { ok: true, rows };
}

/* 52495 — Visual diff charts: bar + donut chart data for finding distributions. */
export function diffChartData(diff) {
  if (!diff || !Array.isArray(diff.rows)) return { ok: false, reason: 'a diff object with rows is required' };
  const sevOrder = ['critical', 'high', 'medium', 'low', 'info'];
  const bar = sevOrder.map((s) => ({ severity: s, added: 0, removed: 0, persistent: 0 }));
  const barIdx = Object.fromEntries(sevOrder.map((s, i) => [s, i]));
  const donut = { added: 0, removed: 0, persistent: 0 };
  for (const r of diff.rows) {
    const i = barIdx[r.severity];
    if (i !== undefined) bar[i][r.change === 'added' ? 'added' : r.change === 'removed' ? 'removed' : 'persistent'] += 1;
    donut[r.change === 'added' ? 'added' : r.change === 'removed' ? 'removed' : 'persistent'] += 1;
  }
  return { ok: true, bar, donut };
}

/* 52496 — Field-level finding diff: exactly which fields changed on a
 * persistent finding. */
export function findingFieldDiff(findingA, findingB) {
  if (!findingA || !findingB || findingA.id !== findingB.id) {
    return { ok: false, reason: 'two revisions of the same finding id are required' };
  }
  const fields = ['severity', 'state', 'evidence', 'asset', 'vulnClass', 'title'];
  const changed = fields
    .filter((f) => findingA[f] !== findingB[f])
    .map((f) => ({ field: f, from: findingA[f] ?? null, to: findingB[f] ?? null }));
  return { ok: true, id: findingA.id, changed };
}

/* 52497 — Evidence diff: side-by-side old vs new proof. */
export function evidenceDiff(findingA, findingB) {
  if (!findingA || !findingB || findingA.id !== findingB.id) {
    return { ok: false, reason: 'two revisions of the same finding id are required' };
  }
  return {
    ok: true,
    id: findingA.id,
    oldEvidence: findingA.evidence || '',
    newEvidence: findingB.evidence || '',
    changed: (findingA.evidence || '') !== (findingB.evidence || ''),
  };
}

/* 52498 — False-positive delta: FP counts and rates across hunts. */
export function fpDelta(huntA, huntB) {
  const rate = (hunt) => {
    const fs = findingsOf(hunt);
    const fpCount = fs.filter((f) => f.fp === true).length;
    return { total: fs.length, fpCount, rate: fs.length === 0 ? 0 : Math.round((fpCount / fs.length) * 1000) / 10 };
  };
  const a = rate(huntA);
  const b = rate(huntB);
  return {
    ok: true,
    huntA: a,
    huntB: b,
    deltaPoints: Math.round((b.rate - a.rate) * 10) / 10,
    improving: b.rate < a.rate,
  };
}

/* 52499 — Remediation delta: fixed-and-verified counts between hunts + MTTR. */
export function remediationDelta(huntA, huntB) {
  const mttr = (hunt) => {
    const fixed = findingsOf(hunt).filter((f) => f.state === 'fixed' && f.detectedAt && f.fixedAt);
    if (fixed.length === 0) return { fixed: 0, mttrHours: null };
    const avg = fixed.reduce((s, f) => s + (f.fixedAt - f.detectedAt), 0) / fixed.length;
    return { fixed: fixed.length, mttrHours: Math.round(avg / 3600000 * 10) / 10 };
  };
  const a = mttr(huntA);
  const b = mttr(huntB);
  return { ok: true, huntA: a, huntB: b, fixedDelta: b.fixed - a.fixed };
}

/* 52500 — Coverage-map diff: visual map data of crawled endpoints per hunt. */
export function coverageMapDiff(huntA, huntB) {
  const cd = coverageDiff(huntA, huntB);
  if (!cd.ok) return cd;
  const nodes = [
    ...cd.onlyA.map((e) => ({ endpoint: e, status: 'onlyA' })),
    ...cd.onlyB.map((e) => ({ endpoint: e, status: 'onlyB' })),
    ...cd.both.map((e) => ({ endpoint: e, status: 'both' })),
  ];
  return { ok: true, nodes, counts: { onlyA: cd.onlyA.length, onlyB: cd.onlyB.length, both: cd.both.length } };
}

export function buildDiffRows(huntA, huntB) {
  const pairs = matchById(huntA, huntB);
  const rows = pairs.map((p) => {
    const cur = p.b || p.a;
    return {
      id: cur.id,
      title: cur.title,
      severity: cur.severity,
      state: cur.state,
      vulnClass: cur.vulnClass,
      asset: cur.asset,
      change: p.b && p.a ? 'persistent' : p.b ? 'added' : 'removed',
    };
  });
  return { ok: true, rows };
}
