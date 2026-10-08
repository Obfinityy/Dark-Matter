/**
 * HuntCompare.jsx — Infinity AI · Dark-Matter · Wave 63
 * 20 working React components for hunt comparison diffs, ideas 52481–52500.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as HC from './huntCompareCore.js';

const NOW = 1700000000000;
const DAY = 24 * 3600000;

const F1 = { id: 'f-xss', title: 'Stored XSS on /profile', severity: 'high', state: 'open', vulnClass: 'xss', asset: 'web-app', evidence: 'payload: <script>alert(1)</script>', detectedAt: NOW - 60 * DAY, fp: false };
const F2 = { id: 'f-sqli', title: 'SQLi on /search', severity: 'critical', state: 'open', vulnClass: 'sqli', asset: 'web-app', evidence: "payload: ' OR 1=1--", detectedAt: NOW - 45 * DAY, fp: false };
const F3 = { id: 'f-cors', title: 'CORS wildcard', severity: 'medium', state: 'fixed', vulnClass: 'misconfig', asset: 'api', evidence: 'Access-Control-Allow-Origin: *', detectedAt: NOW - 90 * DAY, fixedAt: NOW - 20 * DAY, fp: false };
const F4 = { id: 'f-fp', title: 'FP: reflected param', severity: 'low', state: 'open', vulnClass: 'xss', asset: 'web-app', evidence: 'needs-context', detectedAt: NOW - 10 * DAY, fp: true };
const F1B = { ...F1, severity: 'critical', evidence: 'payload confirmed in staging DB' };
const F5 = { id: 'f-idor', title: 'IDOR on /orders/:id', severity: 'high', state: 'open', vulnClass: 'idor', asset: 'api', evidence: 'GET /orders/124 returned other user', detectedAt: NOW - 2 * DAY, fp: false };

const HA = {
  id: 'hunt-a', target: 'acme-prod', at: NOW - 30 * DAY, riskScore: 7.2,
  findings: [F1, F2, F3, F4], endpoints: ['/login', '/search', '/profile'], tech: ['nginx', 'django'], subdomains: ['www', 'api'], params: ['q', 'page'],
  config: { depth: 'full', payloads: 5000, scope: 'all' },
};
const HB = {
  id: 'hunt-b', target: 'acme-prod', at: NOW, riskScore: 6.4,
  findings: [F1B, F2, F5, F4], endpoints: ['/login', '/search', '/orders'], tech: ['nginx', 'django', 'redis'], subdomains: ['www', 'api', 'cdn'], params: ['q'],
  config: { depth: 'full', payloads: 7000, scope: 'all' },
};
const HC_ = {
  id: 'hunt-c', target: 'acme-prod', at: NOW - 60 * DAY, riskScore: 8.1, findings: [F1, F3], endpoints: ['/login'],
};

function Note({ children }) { return <p className="hc63-note">{children}</p>; }
function Mono({ children }) { return <pre className="hc63-mono">{children}</pre>; }
function Chip({ tone, children }) {
  const cls = tone === 'warn' ? 'hc63-chip hc63-chip-warn' : tone === 'bad' ? 'hc63-chip hc63-chip-bad' : tone === 'good' ? 'hc63-chip hc63-chip-good' : 'hc63-chip';
  return <span className={cls}>{children}</span>;
}

/* 52481 — Persistent-findings list. */
export function PersistentFindingsList() {
  const r = HC.persistentFindings(HA, HB, NOW);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52481 · Persistent-findings list</h3>
      <Note>Findings present in both hunts, flagged with age to spotlight long-ignored issues.</Note>
      <div className="hc63-row"><Chip>{r.count} persistent</Chip></div>
      {r.persistent.map((f) => (
        <div className="hc63-row" key={f.id}><Chip tone={f.ageDays > 50 ? 'bad' : 'warn'}>{f.id}</Chip><span>{f.title} · {f.ageDays}d old</span></div>
      ))}
    </div>
  );
}

/* 52482 — Severity migration tracking. */
export function SeverityMigrations() {
  const r = HC.severityMigrations(HA, HB);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52482 · Severity migration tracking</h3>
      <Note>Findings whose severity changed between hunts, with the reason.</Note>
      {r.migrations.map((m) => (
        <div className="hc63-row" key={m.id}><Chip tone="warn">{m.from} → {m.to}</Chip><span>{m.id} · {m.reason}</span></div>
      ))}
      {r.count === 0 && <Note>No severity changes.</Note>}
    </div>
  );
}

/* 52483 — Diff summary counts. */
export function DiffSummary() {
  const r = HC.diffSummary(HA, HB);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52483 · Diff summary counts</h3>
      <Note>Header stats: new, fixed, persistent, severity changes.</Note>
      <div className="hc63-row">
        <Chip tone="bad">+{r.added} new</Chip>
        <Chip tone="good">−{r.removed} fixed</Chip>
        <Chip>{r.persistent} persistent</Chip>
        <Chip tone="warn">{r.severityChanges} severity Δ</Chip>
      </div>
    </div>
  );
}

/* 52484 — Side-by-side finding cards. */
export function SideBySideCards() {
  const r = HC.findingSideBySide(F1, F1B);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52484 · Side-by-side finding cards</h3>
      <Note>The same finding across two hunts, evidence and scores adjacent.</Note>
      <div className="hc63-row"><Chip>hunt-a: {r.left.severity}</Chip><Chip>hunt-b: {r.right.severity}</Chip><Chip tone={r.changed ? 'warn' : 'good'}>{r.changed ? 'changed' : 'identical'}</Chip></div>
      <Mono>{JSON.stringify(r.right, null, 2)}</Mono>
    </div>
  );
}

/* 52485 — Endpoint coverage diff. */
export function EndpointCoverageDiff() {
  const r = HC.coverageDiff(HA, HB);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52485 · Endpoint coverage diff</h3>
      <Note>Which endpoints each hunt covered, explaining finding differences.</Note>
      <div className="hc63-row"><Chip>only hunt-a: {r.onlyA.join(', ') || '—'}</Chip><Chip>only hunt-b: {r.onlyB.join(', ') || '—'}</Chip></div>
      <div className="hc63-row"><Chip tone="good">both: {r.both.join(', ')}</Chip></div>
    </div>
  );
}

/* 52486 — Attack-surface diff. */
export function AttackSurfaceDiff() {
  const r = HC.attackSurfaceDiff(HA, HB);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52486 · Attack-surface diff</h3>
      <Note>Tech stack, subdomain, and parameter differences.</Note>
      <Mono>{JSON.stringify(r, null, 2)}</Mono>
    </div>
  );
}

/* 52487 — Risk-score trend line. */
export function RiskTrend() {
  const r = HC.riskTrend([HC_, HA, HB]);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52487 · Risk-score trend line</h3>
      <Note>Overall risk score across every hunt over time.</Note>
      <div className="hc63-row"><Chip tone={r.direction === 'improving' ? 'good' : 'bad'}>{r.direction} ({r.delta})</Chip></div>
      <Mono>{r.points.map((p) => `${p.huntId}: ${p.score}`).join('\n')}</Mono>
    </div>
  );
}

/* 52488 — Multi-hunt overlay. */
export function MultiHuntOverlay() {
  const r = HC.overlayHunts([HC_, HA, HB]);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52488 · Multi-hunt overlay</h3>
      <Note>Three or more hunts overlaid for long-term trajectories.</Note>
      <table className="hc63-table">
        <thead><tr><th>hunt</th><th>open</th><th>critical</th><th>risk</th></tr></thead>
        <tbody>{r.rows.map((x) => <tr key={x.huntId}><td>{x.huntId}</td><td>{x.open}</td><td>{x.critical}</td><td>{x.riskScore}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/* 52489 — Regression delta report. */
export function DeltaReport() {
  const r = HC.deltaReport(HA, HB, NOW);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52489 · Regression delta report</h3>
      <Note>Stakeholder report payload (server renders the PDF).</Note>
      <div className="hc63-row"><Chip>{r.reportId}</Chip><Chip>{r.sections.length} sections</Chip></div>
      <Mono>{JSON.stringify(r.sections[0].data, null, 2)}</Mono>
    </div>
  );
}

/* 52490 — Diff export. */
export function DiffExport() {
  const rows = HC.buildDiffRows(HA, HB).rows;
  const r = HC.exportDiff({ rows }, { a: HA.id, b: HB.id });
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52490 · Diff export</h3>
      <Note>Comparison dataset as CSV / JSON for external analysis.</Note>
      <div className="hc63-row"><Chip>{r.rowCount} rows</Chip></div>
      <Mono>{r.csv.split('\n').slice(0, 3).join('\n')}</Mono>
    </div>
  );
}

/* 52491 — Shareable diff links. */
export function ShareableDiffLinks() {
  const [days, setDays] = useState(30);
  const r = HC.shareableDiffLink(HA.id, HB.id, { severity: 'high' }, NOW);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52491 · Shareable diff links</h3>
      <Note>A signed link that opens the exact comparison view.</Note>
      <div className="hc63-row">
        <input className="hc63-input" type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 70 }} />
        <span>day link</span>
      </div>
      <Mono>{r.url.slice(0, 90)}…</Mono>
    </div>
  );
}

/* 52492 — Diff filters. */
export function DiffFilters() {
  const [sev, setSev] = useState('high');
  const r = HC.filterDiff({ rows: HC.buildDiffRows(HA, HB).rows }, { severity: sev });
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52492 · Diff filters</h3>
      <Note>Filter comparisons by severity, state, vuln class, or asset.</Note>
      <div className="hc63-row">
        <select className="hc63-select" value={sev} onChange={(e) => setSev(e.target.value)}>
          {['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Chip>{r.matched}/{r.total} matched</Chip>
      </div>
    </div>
  );
}

/* 52493 — Diff by vulnerability class. */
export function DiffByVulnClass() {
  const r = HC.diffByVulnClass({ rows: HC.buildDiffRows(HA, HB).rows });
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52493 · Diff by vulnerability class</h3>
      <Note>Which vuln classes grew or shrank between hunts.</Note>
      {r.rows.map((x) => (
        <div className="hc63-row" key={x.vulnClass}><Chip tone={x.added > x.removed ? 'bad' : 'good'}>{x.vulnClass}</Chip><span>+{x.added} −{x.removed} ={x.persistent}</span></div>
      ))}
    </div>
  );
}

/* 52494 — Diff by asset. */
export function DiffByAsset() {
  const r = HC.diffByAsset({ rows: HC.buildDiffRows(HA, HB).rows });
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52494 · Diff by asset</h3>
      <Note>Per-asset new/fixed/persistent breakdowns for accountability.</Note>
      <table className="hc63-table">
        <thead><tr><th>asset</th><th>new</th><th>fixed</th><th>persistent</th></tr></thead>
        <tbody>{r.rows.map((x) => <tr key={x.asset}><td>{x.asset}</td><td>{x.added}</td><td>{x.removed}</td><td>{x.persistent}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/* 52495 — Visual diff charts. */
export function VisualDiffCharts() {
  const r = HC.diffChartData({ rows: HC.buildDiffRows(HA, HB).rows });
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52495 · Visual diff charts</h3>
      <Note>Bar and donut chart data for finding distributions.</Note>
      <div className="hc63-row"><Chip>{r.donut.added} added</Chip><Chip>{r.donut.removed} removed</Chip><Chip>{r.donut.persistent} persistent</Chip></div>
      <Mono>{r.bar.map((b) => `${b.severity}: +${b.added} −${b.removed}`).join('\n')}</Mono>
    </div>
  );
}

/* 52496 — Field-level finding diff. */
export function FieldLevelDiff() {
  const r = HC.findingFieldDiff(F1, F1B);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52496 · Field-level finding diff</h3>
      <Note>Exactly which fields changed on a persistent finding.</Note>
      {r.changed.map((c) => (
        <div className="hc63-row" key={c.field}><Chip tone="warn">{c.field}</Chip><span>{String(c.from)} → {String(c.to)}</span></div>
      ))}
    </div>
  );
}

/* 52497 — Evidence diff. */
export function EvidenceDiffView() {
  const r = HC.evidenceDiff(F1, F1B);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52497 · Evidence diff</h3>
      <Note>Side-by-side old vs new proof.</Note>
      <div className="hc63-row"><Chip tone={r.changed ? 'warn' : 'good'}>{r.changed ? 'evidence changed' : 'evidence same'}</Chip></div>
      <Mono>{`old: ${r.oldEvidence}\nnew: ${r.newEvidence}`}</Mono>
    </div>
  );
}

/* 52498 — False-positive delta. */
export function FpDeltaView() {
  const r = HC.fpDelta(HA, HB);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52498 · False-positive delta</h3>
      <Note>FP counts and rates across hunts — detection-quality trend.</Note>
      <div className="hc63-row"><Chip>hunt-a: {r.huntA.rate}%</Chip><Chip>hunt-b: {r.huntB.rate}%</Chip><Chip tone={r.improving ? 'good' : 'bad'}>{r.improving ? 'improving' : 'regressing'}</Chip></div>
    </div>
  );
}

/* 52499 — Remediation delta. */
export function RemediationDeltaView() {
  const r = HC.remediationDelta(HA, HB);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52499 · Remediation delta</h3>
      <Note>Fixed-and-verified counts with MTTR trends.</Note>
      <div className="hc63-row"><Chip>hunt-a fixed: {r.huntA.fixed}</Chip><Chip>hunt-b fixed: {r.huntB.fixed}</Chip><Chip tone="good">MTTR {r.huntB.mttrHours}h</Chip></div>
    </div>
  );
}

/* 52500 — Coverage-map diff. */
export function CoverageMapDiffView() {
  const r = HC.coverageMapDiff(HA, HB);
  return (
    <div className="hc63-card">
      <h3 className="hc63-title">52500 · Coverage-map diff</h3>
      <Note>Visual map of crawled endpoints in hunt A vs hunt B.</Note>
      {r.nodes.map((n) => (
        <div className="hc63-row" key={n.endpoint}><Chip tone={n.status === 'both' ? 'good' : 'warn'}>{n.status}</Chip><span>{n.endpoint}</span></div>
      ))}
    </div>
  );
}

export const HC63_GALLERY = [PersistentFindingsList, SeverityMigrations, DiffSummary, SideBySideCards, EndpointCoverageDiff, AttackSurfaceDiff, RiskTrend, MultiHuntOverlay, DeltaReport, DiffExport, ShareableDiffLinks, DiffFilters, DiffByVulnClass, DiffByAsset, VisualDiffCharts, FieldLevelDiff, EvidenceDiffView, FpDeltaView, RemediationDeltaView, CoverageMapDiffView];

export function HuntCompareGallery() { return (<div className="hc63-gallery">{HC63_GALLERY.map((C, i) => <C key={i} />)}</div>); }
