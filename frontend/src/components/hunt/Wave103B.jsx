/**
 * Wave103B.jsx — Infinity AI · Wave 103
 * 20 working React components for the scope tail and target dashboard, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X103B from './wave103BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w103b-card">
      <div className="w103b-title">{title}</div>
      {note ? <div className="w103b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w103b-badge w103b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w103b-kv">
      <span className="w103b-k">{k}</span>
      <span className="w103b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w103b-bar-row">
      <span className="w103b-k">{label}</span>
      <div className="w103b-bar"><div className="w103b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w103b-v">{value}</span>
    </div>
  );
}

export function CookieBasedScoping() {
  const data = [{ cookieName: 'session', requiredValue: 'abc', cookies: { session: 'abc' } }, { cookieName: 'session', requiredValue: 'abc', cookies: {} }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.applyCookieScope(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="CookieBasedScoping" note="Idea 54101">
      <Kv k="Result" v={v.matchedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.cookieName} v={r.status} />)}
    </Card>
  );
}
export function ThirdPartyExclusionHelper() {
  const data = [{ pageHost: 'shop.example.com', resources: ['shop.example.com', 'cdn.assets.net', 'analytics.third.io'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.suggestThirdPartyExclusions(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ThirdPartyExclusionHelper" note="Idea 54102">
      <Kv k="Result" v={v.totalSuggestions} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.pageHost} v={r.suggestions.join(', ') || 'none'} />)}
    </Card>
  );
}
export function ScopeReviewReminders() {
  const data = [{ target: 'shop', lastConfirmedDaysAgo: 120, thresholdDays: 90 }, { target: 'blog', lastConfirmedDaysAgo: 10, thresholdDays: 90 }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.planScopeReviewReminders(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeReviewReminders" note="Idea 54103">
      <Kv k="Result" v={v.overdueCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function ScopeSignOffRecord() {
  const data = [{ target: 'shop', signedBy: 'Client Lead', signedAt: '2026-10-01', approved: true }, { target: 'blog', signedBy: '', signedAt: '', approved: false }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.buildScopeSignoffRecord(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeSignOffRecord" note="Idea 54104">
      <Kv k="Result" v={v.validCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function CardGridView() {
  const data = [{ target: 'shop', health: 'healthy', riskScore: 82, owner: 'lead' }, { target: 'blog', health: 'degraded', riskScore: 30, owner: 'hunter' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.buildCardGridView(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="CardGridView" note="Idea 54105">
      <Kv k="Result" v={v.criticalCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.card} />)}
    </Card>
  );
}
export function DenseTableView() {
  const data = [{ target: 'shop', riskScore: 70, columns: ['target', 'riskScore', 'health'] }, { target: 'api', riskScore: 40, columns: ['target', 'riskScore'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.buildDenseTableView(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="DenseTableView" note="Idea 54106">
      <Kv k="Result" v={v.totalColumns} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={`${r.riskScore} (${r.band})`} />)}
    </Card>
  );
}
export function KanbanByLifecycle() {
  const data = [{ target: 'a', lifecycle: 'Active' }, { target: 'b', lifecycle: 'Pending Verification' }, { target: 'c', lifecycle: 'Active' }];
  const [column, setColumn] = useState('Active');
  const v = X103B.buildLifecycleKanban(data);
  return (
    <Card title="KanbanByLifecycle" note="Idea 54107">
      <label className="w103b-field">Column
        <select value={column} onChange={e => setColumn(e.target.value)}>
          {v.columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <Kv k="In column" v={v.columnCounts[column]} />
      <Kv k="Targets" v={(v.byColumn[column] || []).join(', ') || 'none'} />
    </Card>
  );
}
export function RiskHeatmapView() {
  const data = [{ target: 'core-api', severity: 9, exposure: 8 }, { target: 'blog', severity: 3, exposure: 2 }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.buildRiskHeatmap(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="RiskHeatmapView" note="Idea 54108">
      <Kv k="Result" v={v.criticalCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={`${r.cell} heat ${r.heat}`} />)}
    </Card>
  );
}
export function GeoMapView() {
  const data = [{ target: 'a', country: 'DE', region: 'eu-west' }, { target: 'b', country: 'DE', region: 'eu-central' }, { target: 'c', country: 'IN', region: 'ap-south' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.buildGeoMapView(data);
  const rows = showAll ? v.pins : v.pins.slice(0, 1);
  return (
    <Card title="GeoMapView" note="Idea 54109">
      <Kv k="Result" v={v.countryCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(p => <Kv key={p.country} k={p.country} v={p.targets.join(', ')} />)}
    </Card>
  );
}
export function HealthSummaryWidget() {
  const data = [{ target: 'a', health: 'healthy' }, { target: 'b', health: 'down' }, { target: 'c', health: 'degraded' }, { target: 'd', health: 'healthy' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.summarizeTargetHealth(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="HealthSummaryWidget" note="Idea 54110">
      <Kv k="Result" v={v.healthyCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.target} k={r.target} v={r.health} />)}
    </Card>
  );
}
export function NeedsVerificationWidget() {
  const data = [{ target: 'a', verified: false, daysUnverified: 21 }, { target: 'b', verified: true, daysUnverified: 0 }, { target: 'c', verified: false, daysUnverified: 3 }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.findNeedsVerification(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="NeedsVerificationWidget" note="Idea 54111">
      <Kv k="Result" v={v.count} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={`${r.daysUnverified}d unverified`} />)}
    </Card>
  );
}
export function StaleTargetsWidget() {
  const base = [{ target: 'old', lastActivityDaysAgo: 45, thresholdDays: 30 }, { target: 'fresh', lastActivityDaysAgo: 2, thresholdDays: 30 }];
  const [threshold, setThreshold] = useState(30);
  const v = X103B.findStaleTargets(base.map(d => ({ ...d, thresholdDays: threshold })));
  return (
    <Card title="StaleTargetsWidget" note="Idea 54112">
      <label className="w103b-field">Threshold days ({threshold})
        <input type="range" min="5" max="90" value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
      </label>
      <Kv k="Stale" v={v.staleCount} />
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function ExpiringScopesWidget() {
  const data = [{ target: 'a', scopeExpiresInDays: 10 }, { target: 'b', scopeExpiresInDays: 90 }, { target: 'c', scopeExpiresInDays: -3 }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.findExpiringScopes(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ExpiringScopesWidget" note="Idea 54113">
      <Kv k="Result" v={v.expiringCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function TopRiskyTargetsWidget() {
  const data = [{ target: 'core-api', riskScore: 92, trend: 'up' }, { target: 'blog', riskScore: 25, trend: 'down' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.rankTopRiskyTargets(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="TopRiskyTargetsWidget" note="Idea 54114">
      <Kv k="Result" v={v.climbingCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.label} v={r.riskScore} />)}
    </Card>
  );
}
export function RecentActivityFeed() {
  const data = [{ type: 'hunt', target: 'shop', at: '2026-10-09T10:00:00Z', actor: 'hunter' }, { type: 'finding', target: 'shop', at: '2026-10-09T12:00:00Z', actor: 'Infinity AI' }];
  const [typeFilter, setTypeFilter] = useState('all');
  const v = X103B.buildRecentActivityFeed(data);
  const rows = typeFilter === 'all' ? v.rows : v.rows.filter(r => r.type === typeFilter);
  return (
    <Card title="RecentActivityFeed" note="Idea 54115">
      <label className="w103b-field">Event type
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">all types</option>
          <option value="hunt">hunt</option>
          <option value="finding">finding</option>
          <option value="change">change</option>
          <option value="note">note</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.line} />)}
    </Card>
  );
}
export function HuntCoverageGauge() {
  const base = [{ target: 'a', active: true, huntedInPeriod: true }, { target: 'b', active: true, huntedInPeriod: false }, { target: 'c', active: false, huntedInPeriod: false }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.measureHuntCoverage(base);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="HuntCoverageGauge" note="Idea 54116">
      <Bar label="Coverage" value={v.percent} max={1} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.target} k={r.target} v={r.hunted ? 'hunted' : 'not hunted'} />)}
    </Card>
  );
}
export function FindingsBySeverityMiniBars() {
  const data = [{ target: 'shop', findingsBySeverity: { critical: 2, high: 3, medium: 1, low: 0 } }];
  const [scale, setScale] = useState(6);
  const v = X103B.buildSeverityMiniBars(data);
  const row = v.rows[0];
  return (
    <Card title="FindingsBySeverityMiniBars" note="Idea 54117">
      <label className="w103b-field">Bar scale ({scale})
        <input type="range" min="2" max="12" value={scale} onChange={e => setScale(Number(e.target.value))} />
      </label>
      {['critical', 'high', 'medium', 'low'].map(s => <Bar key={s} label={s} value={row.counts[s]} max={scale} />)}
      <Kv k="Total" v={row.total} />
    </Card>
  );
}
export function TrendSparklines() {
  const data = [{ target: 'shop', series: [1, 2, 3, 2, 4, 6] }, { target: 'blog', series: [5, 4, 4, 3] }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.buildTrendSparklines(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="TrendSparklines" note="Idea 54118">
      <Kv k="Result" v={v.risingCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={`${r.sparkline} (${r.direction})`} />)}
    </Card>
  );
}
export function QuickFiltersBar() {
  const targets = [{ name: 'shop', lifecycle: 'Active', health: 'healthy', verified: true, riskScore: 70, owner: 'lead' }, { name: 'api', lifecycle: 'Paused', health: 'down', verified: false, riskScore: 20, owner: 'hunter' }];
  const [band, setBand] = useState('high');
  const v = X103B.buildQuickFiltersBar([{ targets, filter: { riskBand: band } }]);
  const row = v.rows[0];
  return (
    <Card title="QuickFiltersBar" note="Idea 54119">
      <label className="w103b-field">Risk band
        <select value={band} onChange={e => setBand(e.target.value)}>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </label>
      <Kv k="Chips" v={row.chips.join(' ')} />
      <Kv k="Matched" v={row.targets.join(', ') || 'none'} />
    </Card>
  );
}
export function SavedDashboardLayouts() {
  const data = [{ name: 'Hunt morning', views: ['cards', 'table', 'kanban'] }, { name: 'Quick scan', views: ['cards'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X103B.manageSavedDashboardLayouts(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="SavedDashboardLayouts" note="Idea 54120">
      <Kv k="Result" v={v.completeCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.name} v={r.views.join(' + ')} />)}
    </Card>
  );
}

export const WAVE103_B_COMPONENTS = [CookieBasedScoping, ThirdPartyExclusionHelper, ScopeReviewReminders, ScopeSignOffRecord, CardGridView, DenseTableView, KanbanByLifecycle, RiskHeatmapView, GeoMapView, HealthSummaryWidget, NeedsVerificationWidget, StaleTargetsWidget, ExpiringScopesWidget, TopRiskyTargetsWidget, RecentActivityFeed, HuntCoverageGauge, FindingsBySeverityMiniBars, TrendSparklines, QuickFiltersBar, SavedDashboardLayouts];

export function Wave103BGallery() {
  return (
    <div className="w103b-gallery">
      {WAVE103_B_COMPONENTS.map((C, i) => (<C key={i} />))}
      <div className="w103b-row"><Badge tone="info">Infinity AI</Badge></div>
    </div>
  );
}
