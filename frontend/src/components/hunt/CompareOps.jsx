/**
 * CompareOps.jsx — Infinity AI · Dark-Matter · Wave 63
 * 20 working React components for comparison operations and analytics, ideas 52501–52520.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as CO from './compareOpsCore.js';

const NOW = 1700000000000;
const DAY = 24 * 3600000;
const HOUR = 3600000;

const F1 = {
  id: 'f-xss',
  title: 'Stored XSS',
  severity: 'critical',
  state: 'open',
  vulnClass: 'xss',
  asset: 'web-app',
  evidence: 'e1',
  detectedAt: NOW - 30 * DAY + 45 * 60000,
  fp: false,
};
const F2 = {
  id: 'f-sqli',
  title: 'SQLi',
  severity: 'critical',
  state: 'open',
  vulnClass: 'sqli',
  asset: 'web-app',
  evidence: 'e2',
  detectedAt: NOW - 30 * DAY + 120 * 60000,
  fp: false,
};
const F3 = {
  id: 'f-cors',
  title: 'CORS wildcard',
  severity: 'medium',
  state: 'fixed',
  vulnClass: 'misconfig',
  asset: 'api',
  evidence: 'e3',
  detectedAt: NOW - 60 * DAY + 30 * 60000,
  fixedAt: NOW - 60 * DAY + 26 * HOUR,
  fp: false,
};

const HA = {
  id: 'hunt-a',
  target: 'acme-prod',
  at: NOW - 30 * DAY,
  riskScore: 7.2,
  model: 'qwen-2.5',
  findings: [F1, F2],
  engines: [
    { name: 'vulnDetector', findings: 2 },
    { name: 'eliteRecon', findings: 0 },
  ],
  stats: {
    requests: 120000,
    payloads: 5000,
    hours: 6,
    phases: { recon: 3600000, scan: 14400000, report: 3600000 },
    endpointsCovered: 480,
    endpointsTotal: 500,
  },
  finishedAt: NOW - 30 * DAY + 6 * HOUR,
  config: { depth: 'full', payloads: 5000, scope: 'all' },
};
const HB = {
  id: 'hunt-b',
  target: 'acme-prod',
  at: NOW,
  riskScore: 6.4,
  model: 'qwen-3',
  findings: [F1, F2],
  engines: [
    { name: 'vulnDetector', findings: 1 },
    { name: 'eliteRecon', findings: 1 },
  ],
  stats: {
    requests: 150000,
    payloads: 7000,
    hours: 7,
    phases: { recon: 5400000, scan: 16200000, report: 3600000 },
    endpointsCovered: 490,
    endpointsTotal: 500,
  },
  finishedAt: NOW + 7 * HOUR,
  config: { depth: 'full', payloads: 7000, scope: 'all' },
};
const HC_ = {
  id: 'hunt-c',
  target: 'acme-prod',
  at: NOW - 60 * DAY,
  riskScore: 8.1,
  model: 'qwen-2.5',
  findings: [F3],
  engines: [{ name: 'vulnDetector', findings: 1 }],
  stats: {
    requests: 90000,
    payloads: 3000,
    hours: 4,
    phases: { recon: 3600000, scan: 7200000 },
    endpointsCovered: 300,
    endpointsTotal: 500,
  },
  finishedAt: NOW - 60 * DAY + 4 * HOUR,
  config: { depth: 'quick', payloads: 3000, scope: 'all' },
};

function Note({ children }) {
  return <p className="co63-note">{children}</p>;
}
function Mono({ children }) {
  return <pre className="co63-mono">{children}</pre>;
}
function Chip({ tone, children }) {
  const cls =
    tone === 'warn'
      ? 'co63-chip co63-chip-warn'
      : tone === 'bad'
        ? 'co63-chip co63-chip-bad'
        : tone === 'good'
          ? 'co63-chip co63-chip-good'
          : 'co63-chip';
  return <span className={cls}>{children}</span>;
}

/* 52501 — Time-to-detect comparison. */
export function TimeToDetect() {
  const r = CO.timeToDetectCompare([HA, HB]);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52501 · Time-to-detect comparison</h3>
      <Note>How quickly each hunt surfaced its critical findings.</Note>
      <table className="co63-table">
        <thead>
          <tr>
            <th>hunt</th>
            <th>criticals</th>
            <th>fastest</th>
            <th>median</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map(x => (
            <tr key={x.huntId}>
              <td>{x.huntId}</td>
              <td>{x.criticals}</td>
              <td>{x.fastestMin}m</td>
              <td>{x.medianMin}m</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 52502 — Engine performance comparison. */
export function EnginePerformance() {
  const r = CO.engineCompare([HA, HB, HC_]);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52502 · Engine performance comparison</h3>
      <Note>Which engines found what in each hunt — pipeline tuning.</Note>
      {r.rows.map(e => (
        <div className="co63-row" key={e.engine}>
          <Chip>{e.engine}</Chip>
          <span>
            {e.findings} findings · {e.avgPerHunt}/hunt
          </span>
        </div>
      ))}
    </div>
  );
}

/* 52503 — Model A vs model B comparison. */
export function ModelCompare() {
  const r = CO.modelCompare([HA, HB, HC_]);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52503 · Model A vs model B comparison</h3>
      <Note>Compare hunts run with different brains to evaluate upgrades.</Note>
      <table className="co63-table">
        <thead>
          <tr>
            <th>model</th>
            <th>hunts</th>
            <th>avg findings</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map(x => (
            <tr key={x.model}>
              <td>{x.model}</td>
              <td>{x.hunts}</td>
              <td>{x.avgFindings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 52504 — Hunt config comparison. */
export function ConfigCompare() {
  const r = CO.configDiff(HA.config, HB.config);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52504 · Hunt config comparison</h3>
      <Note>Diff the configurations (depth, payloads, scope) of two hunts.</Note>
      {r.changed.map(c => (
        <div className="co63-row" key={c.key}>
          <Chip tone="warn">{c.key}</Chip>
          <span>
            {String(c.from)} → {String(c.to)}
          </span>
        </div>
      ))}
      {r.identical && <Note>Configs identical.</Note>}
    </div>
  );
}

/* 52505 — Payload-count comparison. */
export function PayloadCompare() {
  const r = CO.payloadCompare([HA, HB]);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52505 · Payload-count comparison</h3>
      <Note>Requests, payloads, and findings per 1k requests per hunt.</Note>
      <table className="co63-table">
        <thead>
          <tr>
            <th>hunt</th>
            <th>requests</th>
            <th>payloads</th>
            <th>findings/1k</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map(x => (
            <tr key={x.huntId}>
              <td>{x.huntId}</td>
              <td>{x.requests}</td>
              <td>{x.payloads}</td>
              <td>{x.findingsPer1k}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 52506 — Duration comparison. */
export function DurationCompare() {
  const r = CO.durationCompare([HA, HB]);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52506 · Duration comparison</h3>
      <Note>Hunt runtimes side by side with phase breakdowns.</Note>
      {r.rows.map(x => (
        <div className="co63-row" key={x.huntId}>
          <Chip>{x.huntId}</Chip>
          <span>{x.totalMin} min total</span>
        </div>
      ))}
      <Mono>{JSON.stringify(HA.stats.phases, null, 2)}</Mono>
    </div>
  );
}

/* 52507 — Cost comparison. */
export function CostCompare() {
  const [rate, setRate] = useState(2.5);
  const r = CO.costCompare([HA, HB], rate);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52507 · Cost comparison</h3>
      <Note>Compute/time cost per hunt and per confirmed finding.</Note>
      <div className="co63-row">
        <input
          className="co63-input"
          type="number"
          step="0.5"
          value={rate}
          onChange={e => setRate(Number(e.target.value))}
          style={{ width: 70 }}
        />
        <span>$/hour</span>
      </div>
      {r.rows.map(x => (
        <div className="co63-row" key={x.huntId}>
          <Chip>{x.huntId}</Chip>
          <span>
            ${x.cost} total · ${x.costPerConfirmed}/confirmed
          </span>
        </div>
      ))}
    </div>
  );
}

/* 52508 — Target maturity score trend. */
export function MaturityTrend() {
  const r = CO.maturityTrend([HC_, HA, HB]);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52508 · Target maturity score trend</h3>
      <Note>Composite maturity score (coverage, fix rate, FP rate) over hunts.</Note>
      <div className="co63-row">
        <Chip tone="good">latest: {r.latest}</Chip>
      </div>
      <Mono>
        {r.points
          .map(p => `${p.huntId}: ${p.score} (cov ${p.coverage}, fix ${p.fixRate}, fp ${p.fpRate})`)
          .join('\n')}
      </Mono>
    </div>
  );
}

/* 52509 — Comparison dashboard. */
export function ComparisonDashboard() {
  const r = CO.buildComparisonDashboard(HA, HB, { charts: ['summary', 'bar'] });
  return (
    <div className="co63-card">
      <h3 className="co63-title">52509 · Comparison dashboard</h3>
      <Note>Saved comparison view with all charts in one place.</Note>
      <div className="co63-row">
        <Chip>
          {r.dashboard.huntAId} vs {r.dashboard.huntBId}
        </Chip>
      </div>
      <Mono>{r.dashboard.charts.join(', ')}</Mono>
    </div>
  );
}

/* 52510 — Scheduled comparison reports. */
export function ScheduledReports() {
  const r = CO.scheduleComparisonReport(
    'acme-prod',
    { cadence: 'monthly', recipients: ['sec@acme.dev'] },
    NOW
  );
  return (
    <div className="co63-card">
      <h3 className="co63-title">52510 · Scheduled comparison reports</h3>
      <Note>Auto-email monthly before/after comparisons to stakeholders.</Note>
      <div className="co63-row">
        <Chip tone="good">{r.schedule.cadence}</Chip>
        <span>{r.schedule.recipients.join(', ')}</span>
      </div>
      <Mono>{r.schedule.id}</Mono>
    </div>
  );
}

/* 52511 — Comparison annotations. */
export function ComparisonAnnotations() {
  const [note, setNote] = useState('v2.4 deploy introduced 3 XSS');
  const r = CO.addAnnotation('cmp-631', note, 'aria', NOW);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52511 · Comparison annotations</h3>
      <Note>Notes on a comparison for future context.</Note>
      <div className="co63-row">
        <input
          className="co63-input"
          value={note}
          onChange={e => setNote(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
      <Mono>{r.ok ? JSON.stringify(r.annotation, null, 2) : r.reason}</Mono>
    </div>
  );
}

/* 52512 — AI "what changed" summary. */
export function WhatChangedSummary() {
  const r = CO.whatChangedSummary({ added: 3, removed: 5, persistent: 12, severityChanges: 2 });
  return (
    <div className="co63-card">
      <h3 className="co63-title">52512 · AI "what changed" summary</h3>
      <Note>Natural-language summary of the meaningful differences.</Note>
      <Mono>{r.text}</Mono>
    </div>
  );
}

/* 52513 — Change attribution. */
export function ChangeAttribution() {
  const timeline = [
    { type: 'deploy', at: NOW - 3 * DAY, label: 'v2.4 deploy' },
    { type: 'config-change', at: NOW - 40 * DAY },
  ];
  const r = CO.attributeChanges([{ id: 'f-idor', detectedAt: NOW - 2 * DAY }], timeline);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52513 · Change attribution</h3>
      <Note>Link new findings to likely causes via timeline correlation.</Note>
      {r.attributions.map(a => (
        <div className="co63-row" key={a.findingId}>
          <Chip tone={a.confidence === 'high' ? 'warn' : undefined}>{a.cause}</Chip>
          <span>{a.confidence} confidence</span>
        </div>
      ))}
    </div>
  );
}

/* 52514 — Diff API. */
export function DiffApiView() {
  const [page, setPage] = useState(1);
  const rows = Array.from({ length: 45 }, (_, i) => ({ id: `f-${i}`, title: `finding ${i}` }));
  const r = CO.diffApiResponse({ rows }, { page, perPage: 20 });
  return (
    <div className="co63-card">
      <h3 className="co63-title">52514 · Diff API</h3>
      <Note>Paginated programmatic access for dashboards and gates.</Note>
      <div className="co63-row">
        <button className="co63-btn" onClick={() => setPage(p => Math.max(1, p - 1))}>
          prev
        </button>
        <Chip>
          page {r.page}/{r.pages}
        </Chip>
        <button className="co63-btn" onClick={() => setPage(p => Math.min(r.pages, p + 1))}>
          next
        </button>
      </div>
      <Mono>{r.rows.length} rows on this page</Mono>
    </div>
  );
}

/* 52515 — Diff webhooks. */
export function DiffWebhooks() {
  const r = CO.fireDiffWebhook(
    { huntAId: HA.id, huntBId: HB.id, newCriticals: 1 },
    'https://ci.acme.dev/hook'
  );
  return (
    <div className="co63-card">
      <h3 className="co63-title">52515 · Diff webhooks</h3>
      <Note>Comparison results for CI gates — fail build on new Criticals.</Note>
      <div className="co63-row">
        <Chip tone={r.payload.gate === 'fail' ? 'bad' : 'good'}>gate: {r.payload.gate}</Chip>
      </div>
      <Mono>{JSON.stringify(r.payload, null, 2)}</Mono>
    </div>
  );
}

/* 52516 — Comparison templates. */
export function ComparisonTemplates() {
  const r = CO.saveComparisonTemplate('monthly-review', { charts: ['summary', 'trend'] }, NOW);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52516 · Comparison templates</h3>
      <Note>Saved comparison setups for recurring reviews.</Note>
      <div className="co63-row">
        <Chip>{r.template.name}</Chip>
        <span>used {r.template.usageCount}×</span>
      </div>
      <Mono>{r.template.id}</Mono>
    </div>
  );
}

/* 52517 — Saved comparisons. */
export function SavedComparisons() {
  const r = CO.saveComparison('q3-review', HA.id, HB.id, {}, NOW);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52517 · Saved comparisons</h3>
      <Note>Bookmark comparisons to revisit without reconfiguring.</Note>
      <div className="co63-row">
        <Chip>{r.saved.name}</Chip>
        <span>
          {r.saved.huntAId} vs {r.saved.huntBId}
        </span>
      </div>
    </div>
  );
}

/* 52518 — New-critical comparison alerts. */
export function NewCriticalAlerts() {
  const nb = {
    ...HB,
    findings: [
      ...HB.findings,
      { id: 'f-new', title: 'New Critical RCE', severity: 'critical', state: 'open' },
    ],
  };
  const r = CO.newCriticalAlerts(HA, nb);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52518 · New-critical comparison alerts</h3>
      <Note>Alert when a comparison reveals new Criticals vs the baseline.</Note>
      {r.alerts.map(a => (
        <div className="co63-row" key={a.findingId}>
          <Chip tone="bad">{a.severity}</Chip>
          <span>{a.message}</span>
        </div>
      ))}
      {r.count === 0 && <Note>No new criticals.</Note>}
    </div>
  );
}

/* 52519 — Trend forecasting. */
export function TrendForecasting() {
  const r = CO.forecastTrend([HC_, HA, HB], 3);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52519 · Trend forecasting</h3>
      <Note>Project future finding counts and risk scores.</Note>
      <table className="co63-table">
        <thead>
          <tr>
            <th>period</th>
            <th>findings</th>
            <th>risk</th>
          </tr>
        </thead>
        <tbody>
          {r.projections.map(p => (
            <tr key={p.period}>
              <td>+{p.period}</td>
              <td>{p.projectedFindings}</td>
              <td>{p.projectedRisk}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 52520 — Seasonality analysis. */
export function SeasonalityAnalysis() {
  const releases = [{ type: 'deploy', at: NOW - 31 * DAY }];
  const r = CO.seasonalityAnalysis([HC_, HA, HB], releases);
  return (
    <div className="co63-card">
      <h3 className="co63-title">52520 · Seasonality analysis</h3>
      <Note>Post-release spikes and weekly patterns across hunt history.</Note>
      <div className="co63-row">
        <Chip tone={r.spikeCount > 0 ? 'warn' : 'good'}>{r.spikeCount} post-release spikes</Chip>
      </div>
      <Mono>{r.dayOfWeekAvg.map(d => `dow ${d.dow}: ${d.avgFindings}`).join('\n')}</Mono>
    </div>
  );
}

export const CO63_GALLERY = [
  TimeToDetect,
  EnginePerformance,
  ModelCompare,
  ConfigCompare,
  PayloadCompare,
  DurationCompare,
  CostCompare,
  MaturityTrend,
  ComparisonDashboard,
  ScheduledReports,
  ComparisonAnnotations,
  WhatChangedSummary,
  ChangeAttribution,
  DiffApiView,
  DiffWebhooks,
  ComparisonTemplates,
  SavedComparisons,
  NewCriticalAlerts,
  TrendForecasting,
  SeasonalityAnalysis,
];

export function CompareOpsGallery() {
  return (
    <div className="co63-gallery">
      {CO63_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
