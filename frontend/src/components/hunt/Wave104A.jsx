/**
 * Wave104A.jsx — Infinity AI · Wave 104
 * 20 working React components for target dashboard views and widgets, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X104A from './wave104ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w104a-card">
      <div className="w104a-title">{title}</div>
      {note ? <div className="w104a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w104a-badge w104a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w104a-kv">
      <span className="w104a-k">{k}</span>
      <span className="w104a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w104a-bar-row">
      <span className="w104a-k">{label}</span>
      <div className="w104a-bar"><div className="w104a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w104a-v">{value}</span>
    </div>
  );
}

const INVENTORY = [
  { target: 'shop', team: 'red', client: 'acme', riskScore: 82, health: 'degraded', openFindings: 12, owner: 'Sam Reed', tags: ['pci'], daysSinceLastHunt: 3 },
  { target: 'blog', team: 'blue', client: 'direct', riskScore: 30, health: 'healthy', openFindings: 2, owner: 'Priya Nair', tags: ['public'], daysSinceLastHunt: 9 },
  { target: 'api', team: 'red', client: 'acme', riskScore: 70, health: 'healthy', openFindings: 5, owner: 'Sam Reed', tags: ['pci', 'core'], daysSinceLastHunt: 1 },
];

export function PerTeamDashboards() {
  const [team, setTeam] = useState('red');
  const v = X104A.buildTeamDashboards(INVENTORY);
  const teamRow = v.teams[0];
  return (
    <Card title="PerTeamDashboards" note="Idea 54121">
      <Kv k="Teams" v={v.teamCount} />
      <Kv k="Top team" v={teamRow ? teamRow.team : 'none'} />
      <Bar label={`${v.topTeam.team} average risk`} value={v.topTeam.averageRisk} max={100} />
      <label className="w104a-field">Team view
        <select value={team} onChange={e => setTeam(e.target.value)}>
          <option value="red">red team</option>
          <option value="blue">blue team</option>
          <option value="all">all teams</option>
        </select>
      </label>
      {team === 'all' ? <Kv k="Teams visible" v={v.teamCount} /> : <Kv k="Showing" v={team} />}
    </Card>
  );
}
export function PerClientDashboards() {
  const [safeOnly, setSafeOnly] = useState(false);
  const v = X104A.buildClientDashboards(INVENTORY.map(t => ({ ...t, clientSafe: t.client === 'acme', publicSummary: t.target === 'blog' ? 'Public status page summary' : 'Client-facing weekly status summary' })));
  const rows = safeOnly ? v.rows.filter(r => r.shareable) : v.rows;
  return (
    <Card title="PerClientDashboards" note="Idea 54122">
      <Kv k="Shareable" v={v.shareableCount} />
      <label className="w104a-field">Shareable only
        <input type="checkbox" checked={safeOnly} onChange={e => setSafeOnly(e.target.checked)} />
      </label>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function CustomizableColumns() {
  const [order, setOrder] = useState(1);
  const v = X104A.manageCustomColumns({ available: ['target', 'health', 'owner', 'riskScore'], columns: [{ field: 'target', label: 'Target', visible: true, order }, { field: 'riskScore', label: 'Risk', visible: true, custom: true, order: order + 1 }] });
  return (
    <Card title="CustomizableColumns" note="Idea 54123">
      <Kv k="Visible" v={v.visibleCount} />
      <Kv k="Custom fields" v={v.customCount} />
      <label className="w104a-field">First column order
        <input type="range" min="0" max="3" value={order} onChange={e => setOrder(Number(e.target.value))} />
      </label>
      <Kv k="Visible order" v={v.visibleInOrder.join(', ')} />
    </Card>
  );
}
export function DensityToggleTargets() {
  const [compact, setCompact] = useState(false);
  const v = X104A.applyDensityToggle(INVENTORY, { density: compact ? 'compact' : 'comfortable' });
  return (
    <Card title="DensityToggleTargets" note="Idea 54124">
      <Kv k="Density" v={v.density} />
      <Kv k="Row height" v={`${v.rowHeight}px`} />
      <button type="button" onClick={() => setCompact(d => !d)}>{compact ? 'Switch to comfortable' : 'Switch to compact'}</button>
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={r.mode} />)}
    </Card>
  );
}
export function TargetFaviconsAndScreenshots() {
  const [showAll, setShowAll] = useState(true);
  const v = X104A.buildTargetVisuals([
    { target: 'shop', faviconUrl: 'https://shop.example.com/favicon.ico', screenshotDaysAgo: 2 },
    { target: 'blog', faviconUrl: '', screenshotDaysAgo: 12 },
    { target: 'api', faviconUrl: 'https://api.example.com/favicon.ico', screenshotDaysAgo: 6 },
  ]);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="TargetFaviconsAndScreenshots" note="Idea 54125">
      <Kv k="Visually ready" v={v.readyCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function UptimeBadges() {
  const [floorPct, setFloorPct] = useState(99.5);
  const v = X104A.buildUptimeBadges([
    { target: 'shop', uptimePercent30d: 99.97 },
    { target: 'blog', uptimePercent30d: 99.2 },
    { target: 'api', uptimePercent30d: 100 },
  ]);
  const shown = v.rows.filter(r => r.percent >= floorPct);
  return (
    <Card title="UptimeBadges" note="Idea 54126">
      <label className="w104a-field">Minimum uptime ({floorPct}%)
        <input type="range" min="98" max="100" step="0.1" value={floorPct} onChange={e => setFloorPct(Number(e.target.value))} />
      </label>
      <Kv k="Excellent" v={v.excellentCount} />
      {shown.map(r => <Kv key={r.key} k={r.target} v={r.label} />)}
    </Card>
  );
}
export function CertificateExpiryBadges() {
  const [showAll, setShowAll] = useState(true);
  const v = X104A.buildCertificateExpiryBadges([
    { target: 'shop', daysUntilCertExpiry: 12 },
    { target: 'blog', daysUntilCertExpiry: 90 },
    { target: 'legacy', daysUntilCertExpiry: -2 },
  ]);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="CertificateExpiryBadges" note="Idea 54127">
      <Kv k="Warnings" v={v.warningCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show soonest only' : 'Show all rows'}</button>
      {rows.map(r => <Badge key={r.key} tone={r.status === 'cert-safe' ? 'good' : r.status === 'cert-expiring' ? 'warn' : 'high'}>{`${r.target} · ${r.status}`}</Badge>)}
    </Card>
  );
}
export function OwnerAvatars() {
  const [showAll, setShowAll] = useState(true);
  const v = X104A.buildOwnerAvatars([
    { owner: 'Sam Reed', photoAvailable: true },
    { owner: 'Priya Nair', photoAvailable: false },
  ]);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="OwnerAvatars" note="Idea 54128">
      <Kv k="Photos" v={v.photoCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.owner} v={r.label} />)}
    </Card>
  );
}
export function LastHuntTimestamps() {
  const [staleOnly, setStaleOnly] = useState(false);
  const v = X104A.buildLastHuntTimestamps(INVENTORY.map(t => ({ ...t, cadenceDays: 14 })));
  const rows = staleOnly ? v.rows.filter(r => r.overdue) : v.rows;
  return (
    <Card title="LastHuntTimestamps" note="Idea 54129">
      <Kv k="Overdue" v={v.overdueCount} />
      <button type="button" onClick={() => setStaleOnly(f => !f)}>{staleOnly ? 'Show all targets' : 'Show overdue only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.label} />)}
    </Card>
  );
}
export function BulkActionToolbar() {
  const [selected, setSelected] = useState({ shop: true, api: false });
  const v = X104A.buildBulkActionToolbar(INVENTORY.map(t => ({ ...t, selected: Boolean(selected[t.target]) })), { action: 'tag' });
  return (
    <Card title="BulkActionToolbar" note="Idea 54130">
      <Kv k="Selected" v={v.selectedCount} />
      {['shop', 'api'].map(t => (
        <label key={t} className="w104a-field">{t} selected
          <input type="checkbox" checked={Boolean(selected[t])} onChange={e => setSelected(s => ({ ...s, [t]: e.target.checked }))} />
        </label>
      ))}
      <Kv k="Action" v={v.action} />
    </Card>
  );
}
export function DashboardSearchTargets() {
  const [query, setQuery] = useState('pci');
  const v = X104A.applyDashboardSearchTargets(INVENTORY.map(t => ({ ...t, domain: `${t.target}.example.com`, notes: '', query })));
  return (
    <Card title="DashboardSearchTargets" note="Idea 54131">
      <label className="w104a-field">Search targets
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <Kv k="Matches" v={v.matchedCount} />
      {v.rows.filter(r => r.matched).map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function SortOptions() {
  const [sortKey, setSortKey] = useState('risk');
  const v = X104A.buildTargetSortOptions({ targets: INVENTORY, sortKey, order: 'desc' });
  return (
    <Card title="SortOptions" note="Idea 54132">
      <label className="w104a-field">Sort by
        <select value={sortKey} onChange={e => setSortKey(e.target.value)}>
          <option value="risk">risk</option>
          <option value="name">name</option>
          <option value="findings">findings</option>
          <option value="last-hunt">last hunt</option>
        </select>
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={v.sortKey === 'name' ? r.target : r.riskScore} />)}
    </Card>
  );
}
export function ScoreLeaderboard() {
  const [band, setBand] = useState('all');
  const v = X104A.buildScoreLeaderboard(INVENTORY);
  const rows = band === 'all' ? v.rows : v.rows.filter(r => r.band === band);
  return (
    <Card title="ScoreLeaderboard" note="Idea 54133">
      <Kv k="Leader" v={v.top.target} />
      <label className="w104a-field">Band
        <select value={band} onChange={e => setBand(e.target.value)}>
          <option value="all">all bands</option>
          <option value="top-10%">top-10%</option>
          <option value="top-25%">top-25%</option>
          <option value="bottom-half">bottom-half</option>
        </select>
      </label>
      {rows.map(r => <Kv key={r.key} k={`#${r.rank} ${r.target}`} v={r.riskScore} />)}
    </Card>
  );
}
export function ProgramComplianceWidget() {
  const [showAll, setShowAll] = useState(true);
  const v = X104A.buildProgramComplianceWidget([
    { target: 'shop', programScopeHosts: ['shop.example.com', 'www.example.com'], targetInScopeHosts: ['shop.example.com', 'staging.example.com'] },
    { target: 'blog', programScopeHosts: ['blog.example.com'], targetInScopeHosts: ['blog.example.com'] },
  ]);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ProgramComplianceWidget" note="Idea 54134">
      <Kv k="Drifting" v={v.driftCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function ScopeCoverageWidget() {
  const [showAll, setShowAll] = useState(true);
  const v = X104A.measureWidgetCoverage([
    { target: 'shop', totalAssets: 40, coveredAssets: 34 },
    { target: 'blog', totalAssets: 20, coveredAssets: 9 },
  ]);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeCoverageWidget" note="Idea 54135">
      <Kv k="Average" v={v.averagePercent} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Bar key={r.key} label={r.target} value={r.percent} max={1} />)}
    </Card>
  );
}
export function ChangeDigestWidget() {
  const [showAll, setShowAll] = useState(true);
  const v = X104A.buildChangeDigest([
    { target: 'shop', subdomainChanges: 2, endpointChanges: 3, certChanges: 1 },
    { target: 'blog', subdomainChanges: 0, endpointChanges: 1, certChanges: 0 },
  ]);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ChangeDigestWidget" note="Idea 54136">
      <Kv k="Total changes" v={v.totalChanges} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show busiest only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.headline} />)}
    </Card>
  );
}
export function VerificationStatusWidget() {
  const [actionOnly, setActionOnly] = useState(false);
  const v = X104A.buildVerificationWidget([
    { target: 'shop', verificationStatus: 'verified' },
    { target: 'blog', verificationStatus: 'pending' },
    { target: 'old', verificationStatus: 'expired' },
  ]);
  const rows = actionOnly ? v.rows.filter(r => r.action !== 'none') : v.rows;
  return (
    <Card title="VerificationStatusWidget" note="Idea 54137">
      <Kv k="Verified" v={v.verifiedCount} />
      <button type="button" onClick={() => setActionOnly(f => !f)}>{actionOnly ? 'Show all statuses' : 'Show action items'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={`${r.status} · ${r.action}`} />)}
    </Card>
  );
}
export function OnboardingProgressWidget() {
  const [showAll, setShowAll] = useState(true);
  const v = X104A.buildOnboardingWidget([
    { target: 'shop', stage: 'active' },
    { target: 'blog', stage: 'verified' },
    { target: 'fresh', stage: 'added' },
  ]);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="OnboardingProgressWidget" note="Idea 54138">
      <Kv k="Active targets" v={v.activeCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Bar key={r.key} label={r.target} value={r.percent} max={1} />)}
    </Card>
  );
}
export function ArchiveBrowser() {
  const [archivedOnly, setArchivedOnly] = useState(false);
  const v = X104A.browseArchive([
    { target: 'old-shop', archived: true, reason: 'program ended' },
    { target: 'blog', archived: false },
  ]);
  const rows = archivedOnly ? v.rows.filter(r => r.archived) : v.rows;
  return (
    <Card title="ArchiveBrowser" note="Idea 54139">
      <Kv k="Archived" v={v.archivedCount} />
      <button type="button" onClick={() => setArchivedOnly(f => !f)}>{archivedOnly ? 'Show everything' : 'Show archived only'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function ExportDashboardToCsv() {
  const [columnsCsv, setColumnsCsv] = useState('target,riskScore');
  const v = X104A.exportDashboardCsv({ targets: INVENTORY, columns: columnsCsv.split(',').map(s => s.trim()).filter(Boolean) });
  return (
    <Card title="ExportDashboardToCsv" note="Idea 54140">
      <label className="w104a-field">Columns (CSV)
        <input type="text" value={columnsCsv} onChange={e => setColumnsCsv(e.target.value)} />
      </label>
      <Kv k="Rows" v={v.rowCount} />
      <Kv k="Characters" v={v.charCount} />
    </Card>
  );
}

export const WAVE104_A_COMPONENTS = [PerTeamDashboards, PerClientDashboards, CustomizableColumns, DensityToggleTargets, TargetFaviconsAndScreenshots, UptimeBadges, CertificateExpiryBadges, OwnerAvatars, LastHuntTimestamps, BulkActionToolbar, DashboardSearchTargets, SortOptions, ScoreLeaderboard, ProgramComplianceWidget, ScopeCoverageWidget, ChangeDigestWidget, VerificationStatusWidget, OnboardingProgressWidget, ArchiveBrowser, ExportDashboardToCsv];

export function Wave104AGallery() {
  return (
    <div className="w104a-gallery">
      {WAVE104_A_COMPONENTS.map((C, i) => (<C key={i} />))}
      <div className="w104a-row"><Badge tone="info">Infinity AI</Badge></div>
    </div>
  );
}
