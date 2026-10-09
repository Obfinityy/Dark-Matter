/**
 * Wave104B.jsx — Infinity AI · Wave 104
 * 20 working React components for dashboard sharing, inline actions, and
 * target health checks, export-only module: components are not mounted
 * anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X104B from './wave104BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w104b-card">
      <div className="w104b-title">{title}</div>
      {note ? <div className="w104b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w104b-badge w104b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w104b-kv">
      <span className="w104b-k">{k}</span>
      <span className="w104b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w104b-bar-row">
      <span className="w104b-k">{label}</span>
      <div className="w104b-bar"><div className="w104b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w104b-v">{value}</span>
    </div>
  );
}

const TARGETS = [
  { target: 'shop', domain: 'shop.example.com', owner: 'Sam Reed' },
  { target: 'api', domain: 'api.example.com', owner: 'Priya Nair' },
  { target: 'blog', domain: 'blog.example.com', owner: 'Sam Reed' },
];

export function ScheduledDashboardEmail() {
  const [format, setFormat] = useState('csv');
  const v = X104B.scheduleDashboardEmail([{ day: 'mon', format, recipients: ['lead@example.com'] }]);
  const row = v.rows[0];
  return (
    <Card title="ScheduledDashboardEmail" note="Idea 54141">
      <Kv k="Ready schedules" v={v.readyCount} />
      <label className="w104b-field">Format
        <select value={format} onChange={e => setFormat(e.target.value)}>
          <option value="csv">CSV</option>
          <option value="pdf">PDF</option>
        </select>
      </label>
      <Kv k="Status" v={row.status} />
    </Card>
  );
}
export function DashboardShareLinks() {
  const [days, setDays] = useState(5);
  const v = X104B.manageDashboardShareLinks([{ token: 'linktoken123', expiresDaysFromNow: days }]);
  const row = v.rows[0];
  return (
    <Card title="DashboardShareLinks" note="Idea 54142">
      <label className="w104b-field">Expires in days ({days})
        <input type="range" min="0" max="14" value={days} onChange={e => setDays(Number(e.target.value))} />
      </label>
      <Kv k="Link" v={row.label} />
      <Kv k="Active" v={row.active ? 'yes' : 'no'} />
    </Card>
  );
}
export function ComparisonPinning() {
  const [pinned, setPinned] = useState(['shop']);
  const v = X104B.pinComparisonTargets(TARGETS, { pinned, maxPins: 2 });
  const toggle = next => setPinned(pinned.includes(next) ? pinned.filter(t => t !== next) : pinned.concat(next));
  return (
    <Card title="ComparisonPinning" note="Idea 54143">
      <Kv k="Pinned" v={v.pinnedCount} />
      {TARGETS.map(t => (
        <button key={t.target} type="button" onClick={() => toggle(t.target)}>{`${pinned.includes(t.target) ? 'Unpin' : 'Pin'} ${t.target}`}</button>
      ))}
      <Kv k="Side-by-side" v={v.pinned.join(', ') || 'none'} />
    </Card>
  );
}
export function QuickAddFromDashboard() {
  const [name, setName] = useState('news');
  const domain = `${name}.example.com`;
  const v = X104B.quickAddTargetCandidate([{ name, domain, programName: 'web', owner: 'lead' }]);
  const row = v.rows[0];
  return (
    <Card title="QuickAddFromDashboard" note="Idea 54144">
      <label className="w104b-field">Target name
        <input type="text" value={name} onChange={e => setName(e.target.value)} />
      </label>
      <Kv k="Domain" v={row.domain} />
      <Kv k="Ready" v={row.ready ? 'yes' : 'no'} />
    </Card>
  );
}
export function InlineNoteAdding() {
  const [notes, setNotes] = useState(['Scope confirmed with the client.']);
  const v = X104B.addInlineNote([{ target: 'shop', notes }]);
  const row = v.rows[0];
  return (
    <Card title="InlineNoteAdding" note="Idea 54145">
      <Kv k="Notes" v={v.totalNotes} />
      <button type="button" onClick={() => setNotes(n => n.concat(`Follow-up ${n.length + 1}`))}>Add follow-up note</button>
      <Kv k="Latest" v={row.latest || 'none'} />
    </Card>
  );
}
export function InlineTagEditing() {
  const [tags, setTags] = useState(['pci']);
  const v = X104B.editInlineTags([{ target: 'shop', tags }], { suggestions: ['core', 'public'] });
  const row = v.rows[0];
  return (
    <Card title="InlineTagEditing" note="Idea 54146">
      <Kv k="Tags" v={row.tags.join(', ') || 'none'} />
      <button type="button" onClick={() => setTags(t => t.includes('core') ? t : t.concat('core'))}>Add core tag</button>
      <Kv k="Autocomplete" v={row.candidates.join(', ') || 'none'} />
    </Card>
  );
}
export function HealthRefreshButton() {
  const [refreshed, setRefreshed] = useState(false);
  const v = X104B.runHealthRefresh([{ target: 'shop', previousHealth: 'degraded', currentHealth: refreshed ? 'healthy' : 'degraded', refreshedMinutesAgo: refreshed ? 2 : 45 }]);
  const row = v.rows[0];
  return (
    <Card title="HealthRefreshButton" note="Idea 54147">
      <Kv k="Health" v={row.currentHealth} />
      <button type="button" onClick={() => setRefreshed(f => !f)}>{refreshed ? 'Simulate stale check' : 'Refresh health now'}</button>
      <Kv k="Changed" v={v.changedCount} />
    </Card>
  );
}
export function DashboardDateRangePicker() {
  const [days, setDays] = useState(7);
  const v = X104B.applyDashboardDateRange({ from: '2026-10-02', to: '2026-10-09', widgetCount: days });
  return (
    <Card title="DashboardDateRangePicker" note="Idea 54148">
      <label className="w104b-field">Widgets in range ({days})
        <input type="range" min="0" max="12" value={days} onChange={e => setDays(Number(e.target.value))} />
      </label>
      <Kv k="Window days" v={v.windowDays} />
      <Kv k="Status" v={v.status} />
    </Card>
  );
}
export function DashboardKeyboardShortcuts() {
  const [combo, setCombo] = useState('ctrl+k');
  const v = X104B.mapDashboardShortcuts([{ combo, action: 'search' }, { combo: '/', action: 'focus-search' }]);
  const row = v.rows[0];
  return (
    <Card title="DashboardKeyboardShortcuts" note="Idea 54149">
      <label className="w104b-field">First combo
        <input type="text" value={combo} onChange={e => setCombo(e.target.value)} />
      </label>
      <Kv k="Bound" v={`${v.boundCount}/${v.count}`} />
      <Kv k="Top status" v={row.status} />
    </Card>
  );
}
export function MobileDashboardLayout() {
  const [width, setWidth] = useState(390);
  const v = X104B.buildMobileDashboardLayout({ viewportWidth: width, widgets: 6 });
  return (
    <Card title="MobileDashboardLayout" note="Idea 54150">
      <label className="w104b-field">Viewport width ({width}px)
        <input type="range" min="320" max="1440" value={width} onChange={e => setWidth(Number(e.target.value))} />
      </label>
      <Kv k="Breakpoint" v={v.breakpoint} />
      <Kv k="Columns" v={v.columns} />
    </Card>
  );
}
export function WidgetDrillDownTargets() {
  const [showAll, setShowAll] = useState(true);
  const v = X104B.openWidgetDrilldown([
    { widget: 'Stale targets', value: 2, targets: ['old-shop', 'legacy'] },
    { widget: 'Healthy targets', value: 1, targets: ['shop'] },
  ]);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="WidgetDrillDownTargets" note="Idea 54151">
      <Kv k="Targets behind" v={v.totalBehind} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all widgets'}</button>
      {rows.map(r => <Kv key={r.key} k={r.widget} v={`${r.behindCount} target(s)`} />)}
    </Card>
  );
}
export function EmptyStateGuidanceTargets() {
  const [targetCount, setTargetCount] = useState(0);
  const v = X104B.guideEmptyStates([{ targetCount, activeFilters: 2 }]);
  const row = v.rows[0];
  return (
    <Card title="EmptyStateGuidanceTargets" note="Idea 54152">
      <label className="w104b-field">Targets in list ({targetCount})
        <input type="range" min="0" max="4" value={targetCount} onChange={e => setTargetCount(Number(e.target.value))} />
      </label>
      <Kv k="Guidance" v={row.guidance.join(' → ')} />
      <Kv k="Status" v={row.status} />
    </Card>
  );
}
export function DashboardPerformanceModeTargets() {
  const [listSize, setListSize] = useState(10000);
  const v = X104B.assessDashboardPerformance([{ listSize, measuredMs: 12, viewportLimit: 200 }]);
  const row = v.rows[0];
  return (
    <Card title="DashboardPerformanceModeTargets" note="Idea 54153">
      <label className="w104b-field">List size ({listSize})
        <input type="range" min="50" max="12000" step="50" value={listSize} onChange={e => setListSize(Number(e.target.value))} />
      </label>
      <Kv k="Virtualized" v={v.virtualizedCount === 1 ? 'yes' : 'no'} />
      <Kv k="Rendered rows" v={row.renderedCount} />
    </Card>
  );
}
export function CustomDashboardWidgets() {
  const [metric, setMetric] = useState('average');
  const v = X104B.defineCustomWidget({ field: 'riskScore', metric });
  return (
    <Card title="CustomDashboardWidgets" note="Idea 54154">
      <Kv k="Metric" v={v.metricKind} />
      <label className="w104b-field">Metric
        <select value={metric} onChange={e => setMetric(e.target.value)}>
          <option value="average">average</option>
          <option value="max">max</option>
          <option value="count">count</option>
          <option value="sum">sum</option>
        </select>
      </label>
      <Kv k="Status" v={v.status} />
    </Card>
  );
}
export function HttpStatusMonitoring() {
  const [checksDone, setChecksDone] = useState(2);
  const checks = [200, 200, 200, 503].slice(0, checksDone).map((code, i) => ({ at: `2026-10-09T0${i}:00:00Z`, statusCode: code, responseMs: 120 + i * 40 }));
  const v = X104B.monitorHttpStatus([{ target: 'shop', url: 'https://shop.example.com', checks }]);
  const row = v.rows[0];
  return (
    <Card title="HttpStatusMonitoring" note="Idea 54155">
      <label className="w104b-field">Checks recorded ({checksDone})
        <input type="range" min="1" max="4" value={checksDone} onChange={e => setChecksDone(Number(e.target.value))} />
      </label>
      <Kv k="Up rate" v={row.upRate} />
      <Kv k="Latest code" v={row.latestCode} />
    </Card>
  );
}
export function UptimePingChecks() {
  const [lossless, setLossless] = useState(true);
  const pings = lossless ? [32, 31, 30, 33] : [28, 0, 29, 0];
  const v = X104B.runUptimePingChecks([{ target: 'shop', host: 'shop.example.com', pings }]);
  const row = v.rows[0];
  return (
    <Card title="UptimePingChecks" note="Idea 54156">
      <Kv k="Reachability" v={row.reachableRate} />
      <button type="button" onClick={() => setLossless(f => !f)}>{lossless ? 'Simulate packet loss' : 'Restore clean pings'}</button>
      <Kv k="Median" v={`${row.medianMs}ms`} />
    </Card>
  );
}
export function TlsHandshakeChecks() {
  const [secure, setSecure] = useState(true);
  const v = X104B.inspectTlsHandshake([{ target: 'shop', version: secure ? 'TLS1.3' : 'TLS1.0', cipher: secure ? 'TLS_AES_256_GCM_SHA384' : 'TLS_RSA_WITH_RC4_128_SHA', ms: 42 }]);
  const row = v.rows[0];
  return (
    <Card title="TlsHandshakeChecks" note="Idea 54157">
      <Kv k="Version" v={row.version} />
      <button type="button" onClick={() => setSecure(f => !f)}>{secure ? 'Simulate legacy stack' : 'Restore modern stack'}</button>
      <Kv k="Status" v={row.status} />
    </Card>
  );
}
export function CertificateExpiryAlertsTargets() {
  const [days, setDays] = useState(6);
  const v = X104B.planCertificateExpiryAlerts([{ target: 'shop', daysUntilCertExpiry: days, channels: ['email', 'slack'] }]);
  const row = v.rows[0];
  return (
    <Card title="CertificateExpiryAlertsTargets" note="Idea 54158">
      <label className="w104b-field">Days until expiry ({days})
        <input type="range" min="0" max="60" value={days} onChange={e => setDays(Number(e.target.value))} />
      </label>
      <Kv k="Alert checkpoints" v={row.checkpoints.join(', ') || 'none'} />
      <Kv k="Status" v={row.status} />
    </Card>
  );
}
export function CertificateChainValidation() {
  const [trusted, setTrusted] = useState(true);
  const v = X104B.validateCertificateChain([{ target: 'shop', issuer: 'Example Root CA', depth: 3, trusted, daysUntilExpiry: 200 }]);
  const row = v.rows[0];
  return (
    <Card title="CertificateChainValidation" note="Idea 54159">
      <Kv k="Chain depth" v={row.depth} />
      <button type="button" onClick={() => setTrusted(f => !f)}>{trusted ? 'Simulate untrusted root' : 'Restore trusted root'}</button>
      <Kv k="Status" v={row.status} />
    </Card>
  );
}
export function DnsResolutionChecks() {
  const [flipped, setFlipped] = useState(false);
  const v = X104B.checkDnsResolution([{ target: 'shop', domain: 'shop.example.com', resolves: true, recordsPresent: true, recordChanges: flipped ? 2 : 0, unexpectedChange: flipped }]);
  const row = v.rows[0];
  return (
    <Card title="DnsResolutionChecks" note="Idea 54160">
      <Kv k="Domain" v={row.domain} />
      <button type="button" onClick={() => setFlipped(f => !f)}>{flipped ? 'Restore stable records' : 'Simulate record change'}</button>
      <Kv k="Status" v={row.status} />
    </Card>
  );
}

export const WAVE104_B_COMPONENTS = [ScheduledDashboardEmail, DashboardShareLinks, ComparisonPinning, QuickAddFromDashboard, InlineNoteAdding, InlineTagEditing, HealthRefreshButton, DashboardDateRangePicker, DashboardKeyboardShortcuts, MobileDashboardLayout, WidgetDrillDownTargets, EmptyStateGuidanceTargets, DashboardPerformanceModeTargets, CustomDashboardWidgets, HttpStatusMonitoring, UptimePingChecks, TlsHandshakeChecks, CertificateExpiryAlertsTargets, CertificateChainValidation, DnsResolutionChecks];

export function Wave104BGallery() {
  return (
    <div className="w104b-gallery">
      {WAVE104_B_COMPONENTS.map((C, i) => (<C key={i} />))}
      <div className="w104b-row"><Badge tone="info">Infinity AI</Badge></div>
    </div>
  );
}
