/**
 * CompareDeep.jsx — Infinity AI · Dark-Matter · Wave 64
 * 15 working React components for deep comparison analytics, ideas 52521–52535.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React from 'react';
import * as CD from './compareDeepCore.js';

const NOW = 1700000000000;
const DAY = 86400000;
const HOUR = 3600000;

function mkHunt(id, target, at, findings, extra) {
  return Object.assign({ id, target, at, findings }, extra || {});
}

function F(id, title, vulnClass, severity, extra) {
  return Object.assign(
    {
      id,
      title,
      vulnClass,
      severity,
      state: 'open',
      asset: 'web-app',
      fp: false,
      detectedAt: NOW - 60 * DAY,
    },
    extra || {}
  );
}

const HUNT_A = mkHunt('hunt-a', 'acme.com', NOW - 90 * DAY, [
  F('a1', 'Stored XSS', 'xss', 'high', { triageDecision: 'accept', reviewer: 'r1' }),
  F('a2', 'SQLi', 'sqli', 'critical', { triageDecision: 'accept', reviewer: 'r1' }),
  F('a3', 'Reflected param', 'xss', 'low', {
    triageDecision: 'reject-fp',
    fp: true,
    reviewer: 'r2',
  }),
]);

const HUNT_B = mkHunt('hunt-b', 'acme.com', NOW - 30 * DAY, [
  F('b1', 'Stored XSS', 'xss', 'high', { triageDecision: 'accept', reviewer: 'r2' }),
  F('b2', 'DOM XSS', 'xss', 'medium', { triageDecision: 'reject-fp', fp: true, reviewer: 'r1' }),
  F('b3', 'IDOR', 'idor', 'high', { triageDecision: 'accept', reviewer: 'r2' }),
]);

function Card({ title, note, children }) {
  return (
    <div className="cd64-card">
      <div className="cd64-title">{title}</div>
      {note ? <div className="cd64-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  const cls =
    tone === 'good'
      ? 'cd64-badge cd64-badge-good'
      : tone === 'warn'
        ? 'cd64-badge cd64-badge-warn'
        : tone === 'bad'
          ? 'cd64-badge cd64-badge-bad'
          : 'cd64-badge';
  return <span className={cls}>{children}</span>;
}

/** 52521 — Triage-decision comparison. */
export function TriageDecisionCompare() {
  const r = CD.compareTriageDecisions(HUNT_A, HUNT_B);
  return (
    <Card
      title="Triage-decision comparison"
      note="Same vuln classes triaged differently across hunts."
    >
      <div className="cd64-row">
        <span>Mismatch rate</span>
        <span className="cd64-stat">{Math.round(r.mismatchRate * 100)}%</span>
      </div>
      {r.mismatches.map((m, i) => (
        <div className="cd64-row" key={i}>
          <Badge tone="warn">{m.vulnClass}</Badge>
          <span>{m.decisions.join(' vs ')}</span>
        </div>
      ))}
      {r.mismatches.length === 0 ? <div className="cd64-row">No inconsistencies found.</div> : null}
    </Card>
  );
}

/** 52522 — FP-rate comparison. */
export function FpRateCompare() {
  const r = CD.compareFpRates([HUNT_A, HUNT_B]);
  return (
    <Card title="FP-rate comparison" note="Hunt-over-hunt false-positive rates.">
      {r.perHunt.map(p => (
        <div className="cd64-row" key={p.huntId}>
          <span>{p.huntId}</span>
          <span className="cd64-stat">{Math.round(p.fpRate * 100)}% FP</span>
        </div>
      ))}
      <div className="cd64-row">
        <span>Trend</span>
        <Badge tone={r.trend === 'down' ? 'good' : r.trend === 'up' ? 'bad' : undefined}>
          {r.trend}
        </Badge>
      </div>
    </Card>
  );
}

/** 52523 — MTTR comparison. */
export function MttrCompare() {
  const h1 = mkHunt('h1', 't', NOW - 90 * DAY, [
    F('x1', 'X', 'xss', 'high', { fixedAt: NOW - 80 * DAY, detectedAt: NOW - 90 * DAY }),
  ]);
  const h2 = mkHunt('h2', 't', NOW - 30 * DAY, [
    F('x2', 'X', 'xss', 'high', { fixedAt: NOW - 25 * DAY, detectedAt: NOW - 30 * DAY }),
  ]);
  const r = CD.compareMttr([h1, h2]);
  return (
    <Card title="MTTR comparison" note="Is remediation getting faster per target?">
      {r.perHunt.map(p => (
        <div className="cd64-row" key={p.huntId}>
          <span>{p.huntId}</span>
          <span className="cd64-stat">{p.mttrDays === null ? '—' : `${p.mttrDays} days`}</span>
        </div>
      ))}
      <div className="cd64-row">
        <span>Improving</span>
        <Badge tone={r.improving ? 'good' : 'warn'}>{r.improving ? 'yes' : 'no'}</Badge>
      </div>
    </Card>
  );
}

/** 52524 — Bounty-outcome comparison. */
export function BountyOutcomeCompare() {
  const ha = mkHunt(
    'ha',
    't',
    NOW - 60 * DAY,
    [
      F('y1', 'X', 'xss', 'high', {
        payoutStatus: 'accepted',
        payout: 500,
        triageDecision: 'accept',
      }),
      F('y2', 'Y', 'sqli', 'critical', { payoutStatus: 'submitted', triageDecision: 'accept' }),
    ],
    { program: 'acme-bbp' }
  );
  const r = CD.compareBountyOutcomes([ha]);
  return (
    <Card title="Bounty-outcome comparison" note="Acceptance rates and payouts per program.">
      {r.perProgram.map(p => (
        <div className="cd64-row" key={p.program}>
          <span>{p.program}</span>
          <span className="cd64-stat">
            {Math.round(p.acceptanceRate * 100)}% · ${p.payout}
          </span>
        </div>
      ))}
    </Card>
  );
}

/** 52525 — Staging vs production compare. */
export function StagingVsProd() {
  const staging = mkHunt('stg', 'stg.acme.com', NOW - 10 * DAY, [
    F('s1', 'Debug endpoint', 'misconfig', 'medium'),
  ]);
  const prod = mkHunt('prd', 'acme.com', NOW - 5 * DAY, [
    F('p1', 'Debug endpoint', 'misconfig', 'medium'),
    F('p2', 'Prod-only RCE', 'rce', 'critical'),
  ]);
  const r = CD.compareEnvHunts(staging, prod);
  return (
    <Card title="Staging vs production" note="Drift: findings only in production are risky.">
      <div className="cd64-row">
        <span>Only in prod</span>
        <Badge tone={r.onlyProd.length ? 'bad' : 'good'}>{r.onlyProd.length}</Badge>
      </div>
      {r.onlyProd.map(f => (
        <div className="cd64-row" key={f.id}>
          <span>{f.title}</span>
          <Badge tone="bad">{f.severity}</Badge>
        </div>
      ))}
      <div className="cd64-row">
        <span>Overlap</span>
        <span className="cd64-stat">{r.overlap}</span>
      </div>
    </Card>
  );
}

/** 52526 — Feature-branch compare (merge gate). */
export function BranchCompare() {
  const main = mkHunt('main', 'acme.com', NOW - 20 * DAY, [F('m1', 'XSS', 'xss', 'high')]);
  const branch = mkHunt('feat', 'acme.com', NOW - 2 * DAY, [
    F('m1', 'XSS', 'xss', 'high'),
    F('b9', 'New SSRF', 'ssrf', 'critical'),
  ]);
  const r = CD.compareBranchHunts(branch, main);
  return (
    <Card title="Feature-branch gate" note="Block merge on new severe findings.">
      <div className="cd64-row">
        <span>Gate</span>
        <Badge tone={r.gate === 'pass' ? 'good' : 'bad'}>{r.gate}</Badge>
      </div>
      {r.newSevere.map(f => (
        <div className="cd64-row" key={f.id}>
          <span>{f.title}</span>
          <Badge tone="bad">{f.severity}</Badge>
        </div>
      ))}
    </Card>
  );
}

/** 52527 — Acquisition target compare. */
export function AcquisitionCompare() {
  const target = mkHunt('acq', 'newco.com', NOW - 7 * DAY, [
    F('n1', 'RCE', 'rce', 'critical'),
    F('n2', 'XSS', 'xss', 'high'),
  ]);
  const r = CD.benchmarkAcquisition(target, { avgFindings: 3, avgCritical: 0, avgFpRate: 0.1 });
  return (
    <Card title="Acquisition benchmark" note="New asset vs portfolio baseline.">
      <div className="cd64-row">
        <span>Verdict</span>
        <Badge tone={r.verdict === 'within-baseline' ? 'good' : 'warn'}>{r.verdict}</Badge>
      </div>
      <div className="cd64-row">
        <span>Δ critical</span>
        <span className="cd64-stat">
          {r.deltas.critical >= 0 ? '+' : ''}
          {r.deltas.critical}
        </span>
      </div>
    </Card>
  );
}

/** 52528 — Vendor comparison. */
export function VendorCompare() {
  const r = CD.compareVendors([
    mkHunt('v1', 'a', NOW - 30 * DAY, [F('z1', 'X', 'xss', 'high')], { vendor: 'Vendor A' }),
    mkHunt(
      'v2',
      'b',
      NOW - 30 * DAY,
      [F('z2', 'X', 'rce', 'critical'), F('z3', 'Y', 'xss', 'low', { fp: true })],
      { vendor: 'Vendor B' }
    ),
  ]);
  return (
    <Card title="Vendor comparison" note="Ranked best → worst for procurement.">
      {r.map((v, i) => (
        <div className="cd64-row" key={v.vendor}>
          <span>
            #{i + 1} {v.vendor}
          </span>
          <span className="cd64-stat">score {v.score}</span>
        </div>
      ))}
    </Card>
  );
}

/** 52529 — Comparison PDF export. */
export function ComparisonPdfExport() {
  const payload = CD.buildComparisonPdfPayload(
    { title: 'Q3 hunt comparison', hunts: [HUNT_A, HUNT_B], sections: ['summary', 'findings'] },
    { name: 'Infinity AI' }
  );
  return (
    <Card title="Comparison PDF export" note="Branded PDF payload for distribution.">
      <div className="cd64-row">
        <span>Brand</span>
        <span className="cd64-stat">{payload.brand.name}</span>
      </div>
      <div className="cd64-row">
        <span>Sections</span>
        <span className="cd64-stat">{payload.sections.join(', ')}</span>
      </div>
    </Card>
  );
}

/** 52530 — Comparison CSV export. */
export function ComparisonCsvExport() {
  const csv = CD.buildComparisonCsv(
    [
      { hunt: 'hunt-a', critical: 1, high: 2 },
      { hunt: 'hunt-b', critical: 0, high: 3 },
    ],
    ['hunt', 'critical', 'high']
  );
  return (
    <Card title="Comparison CSV export" note="Tabular diff data for analysts.">
      <pre className="cd64-note">{csv}</pre>
    </Card>
  );
}

/** 52531 — Benchmark vs industry. */
export function IndustryBenchmark() {
  const r = CD.benchmarkVsIndustry(
    { fpRate: 0.08, mttrDays: 9, criticalPerHunt: 1 },
    { fpRateP50: 0.15, mttrDaysP50: 14, criticalPerHuntP50: 2 }
  );
  return (
    <Card title="Industry benchmark" note="Your metrics vs anonymized aggregates.">
      {r.map(m => (
        <div className="cd64-row" key={m.metric}>
          <span>{m.metric}</span>
          <Badge
            tone={
              m.standing === 'better-than-median'
                ? 'good'
                : m.standing === 'worse-than-median'
                  ? 'bad'
                  : undefined
            }
          >
            {m.standing}
          </Badge>
        </div>
      ))}
    </Card>
  );
}

/** 52532 — Benchmark vs own history. */
export function HistoryBenchmark() {
  const r = CD.benchmarkVsHistory({ fpRate: 0.1, mttrDays: 8, critical: 1 }, [
    { fpRate: 0.2, mttrDays: 20, critical: 3 },
    { fpRate: 0.15, mttrDays: 12, critical: 2 },
  ]);
  return (
    <Card title="Own-history benchmark" note="Best / worst context for this target.">
      <div className="cd64-row">
        <span>Best MTTR</span>
        <span className="cd64-stat">{r.best.mttrDays} days</span>
      </div>
      <div className="cd64-row">
        <span>Worst critical</span>
        <span className="cd64-stat">{r.worst.critical}</span>
      </div>
    </Card>
  );
}

/** 52533 — Triage SLA comparison. */
export function TriageSlaCompare() {
  const h1 = mkHunt('s1', 't', NOW - 60 * DAY, [
    F('t1', 'X', 'xss', 'high', {
      triagedAt: NOW - 60 * DAY + 48 * HOUR,
      detectedAt: NOW - 60 * DAY,
    }),
  ]);
  const h2 = mkHunt('s2', 't', NOW - 10 * DAY, [
    F('t2', 'X', 'xss', 'high', {
      triagedAt: NOW - 10 * DAY + 6 * HOUR,
      detectedAt: NOW - 10 * DAY,
    }),
  ]);
  const r = CD.compareTriageSlas([h1, h2]);
  return (
    <Card title="Triage SLA comparison" note="Is review speed improving?">
      {r.perHunt.map(p => (
        <div className="cd64-row" key={p.huntId}>
          <span>{p.huntId}</span>
          <span className="cd64-stat">
            {p.avgTriageHours === null ? '—' : `${p.avgTriageHours}h`}
          </span>
        </div>
      ))}
      <div className="cd64-row">
        <span>Improving</span>
        <Badge tone={r.improving ? 'good' : 'warn'}>{r.improving ? 'yes' : 'no'}</Badge>
      </div>
    </Card>
  );
}

/** 52534 — Hunt replay comparison. */
export function HuntReplay() {
  const oldH = mkHunt('old', 't', NOW - 120 * DAY, [F('o1', 'XSS', 'xss', 'high')], {
    engineVersion: 'v1',
  });
  const newH = mkHunt(
    'new',
    't',
    NOW - 5 * DAY,
    [F('o1', 'XSS', 'xss', 'high'), F('o2', 'New IDOR', 'idor', 'high', { engineVersion: 'v2' })],
    { engineVersion: 'v2' }
  );
  const r = CD.replayComparison(oldH, newH, 'v2');
  return (
    <Card title="Hunt replay" note="Isolate engine vs target changes.">
      <div className="cd64-row">
        <span>Engine</span>
        <span className="cd64-stat">{r.plan.engineVersion}</span>
      </div>
      <div className="cd64-row">
        <span>Attribution</span>
        <Badge tone={r.attribution === 'engine-driven' ? 'warn' : undefined}>{r.attribution}</Badge>
      </div>
    </Card>
  );
}

/** 52535 — Executive one-pager. */
export function ExecOnePager() {
  const p = CD.buildExecOnePager({
    title: 'Q3 comparison',
    hunts: [HUNT_A, HUNT_B],
    highlights: ['FP rate down 40%', 'MTTR improved to 5 days'],
    risks: ['1 new critical in prod-only drift'],
    callToAction: 'Approve remediation sprint for prod drift.',
  });
  return (
    <Card title="Executive one-pager" note="Single-page leadership summary.">
      <div className="cd64-row">
        <span>Hunts</span>
        <span className="cd64-stat">{p.huntCount}</span>
      </div>
      {p.highlights.map((h, i) => (
        <div className="cd64-row" key={i}>
          <span>{h}</span>
        </div>
      ))}
      <div className="cd64-row">
        <span>CTA</span>
        <span className="cd64-note">{p.callToAction}</span>
      </div>
    </Card>
  );
}

export const CD64_GALLERY = [
  TriageDecisionCompare,
  FpRateCompare,
  MttrCompare,
  BountyOutcomeCompare,
  StagingVsProd,
  BranchCompare,
  AcquisitionCompare,
  VendorCompare,
  ComparisonPdfExport,
  ComparisonCsvExport,
  IndustryBenchmark,
  HistoryBenchmark,
  TriageSlaCompare,
  HuntReplay,
  ExecOnePager,
];

export function CompareDeepGallery() {
  return (
    <div className="cd64-gallery">
      {CD64_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
