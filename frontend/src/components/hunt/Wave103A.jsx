/**
 * Wave103A.jsx — Infinity AI · Wave 103
 * 20 working React components for scope rules depth, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X103A from './wave103ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w103a-card">
      <div className="w103a-title">{title}</div>
      {note ? <div className="w103a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w103a-badge w103a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w103a-kv">
      <span className="w103a-k">{k}</span>
      <span className="w103a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w103a-bar-row">
      <span className="w103a-k">{label}</span>
      <div className="w103a-bar"><div className="w103a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w103a-v">{value}</span>
    </div>
  );
}

export function TimeBoxedScopeRules() {
  const data = [{ pattern: '*.example.com', startsOn: '2026-01-01', endsOn: '2026-12-31' }, { pattern: 'legacy.example.com', startsOn: '2025-01-01', endsOn: '2025-12-31' }];
  const [checkOn, setCheckOn] = useState('2026-06-15');
  const v = X103A.applyTimeBoxedScopeRules(data.map(d => ({ ...d, checkOn })));
  return (
    <Card title="TimeBoxedScopeRules" note="Idea 54081">
      <Kv k="Active" v={v.activeCount} />
      <label className="w103a-field">Check date
        <input type="date" value={checkOn} onChange={e => setCheckOn(e.target.value)} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.pattern} v={r.status} />)}
    </Card>
  );
}
export function ScopeRuleComments() {
  const data = [{ ruleId: 'rule-1', comments: [{ author: 'lead', text: 'Why is the admin path excluded?', resolved: false }, { author: 'hunter', text: 'Client asked for it.', resolved: true }] }, { ruleId: 'rule-2', comments: [] }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.buildScopeRuleComments(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeRuleComments" note="Idea 54082">
      <Kv k="Open threads" v={v.totalOpen} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.ruleId} v={r.status} />)}
    </Card>
  );
}
export function ScopeRuleMentions() {
  const [text, setText] = useState('@lead can you confirm the @hunter note?');
  const v = X103A.parseScopeRuleMentions([{ ruleId: 'rule-9', text }]);
  const row = v.rows[0];
  return (
    <Card title="ScopeRuleMentions" note="Idea 54083">
      <label className="w103a-field">Comment text
        <input type="text" value={text} onChange={e => setText(e.target.value)} />
      </label>
      <Kv k="Mentions" v={row.mentions.join(', ') || 'none'} />
      <Kv k="Status" v={row.status} />
    </Card>
  );
}
export function ScopeStatisticsHeader() {
  const data = [{ target: 'shop', rules: [{ type: 'include', hostsEstimated: 120 }, { type: 'exclude', hostsEstimated: 5 }] }, { target: 'blog', rules: [{ type: 'include', hostsEstimated: 12 }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.buildScopeStatisticsHeader(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeStatisticsHeader" note="Idea 54084">
      <Kv k="Total rules" v={v.totalRules} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.target} v={r.header} />)}
    </Card>
  );
}
export function UncoveredAssetWarnings() {
  const data = [{ asset: 'api.example.com', matchedByRule: true }, { asset: 'staging.example.com', matchedByRule: false }, { asset: 'cdn.example.com', matchedByRule: false }];
  const [gapsOnly, setGapsOnly] = useState(false);
  const v = X103A.findUncoveredAssets(data);
  const rows = gapsOnly ? v.rows.filter(r => r.uncovered) : v.rows;
  return (
    <Card title="UncoveredAssetWarnings" note="Idea 54085">
      <Kv k="Uncovered" v={v.uncoveredCount} />
      <button type="button" onClick={() => setGapsOnly(f => !f)}>{gapsOnly ? 'Show all assets' : 'Show gaps only'}</button>
      {rows.map(r => <Badge key={r.key} tone={r.uncovered ? 'warn' : 'good'}>{r.asset}</Badge>)}
    </Card>
  );
}
export function ScopeCoverageMeter() {
  const data = [{ target: 'shop', knownAssets: 40 }, { target: 'blog', knownAssets: 20 }];
  const [covered, setCovered] = useState(34);
  const v = X103A.measureScopeCoverage([{ ...data[0], coveredAssets: covered }, { ...data[1], coveredAssets: 9 }]);
  const top = v.rows[0];
  return (
    <Card title="ScopeCoverageMeter" note="Idea 54086">
      <label className="w103a-field">Shop covered assets ({covered})
        <input type="range" min="0" max="40" value={covered} onChange={e => setCovered(Number(e.target.value))} />
      </label>
      <Kv k="Shop band" v={top.band} />
      <Kv k="Average" v={v.averagePercent} />
    </Card>
  );
}
export function ScopeSimulationAgainstInventory() {
  const inventory = ['api.example.com', 'www.example.com', 'shop.other.com'];
  const [pattern, setPattern] = useState('*.example.com');
  const v = X103A.simulateScopeAgainstInventory([{ pattern, assets: inventory }]);
  const row = v.rows[0];
  return (
    <Card title="ScopeSimulationAgainstInventory" note="Idea 54087">
      <label className="w103a-field">Rule pattern
        <input type="text" value={pattern} onChange={e => setPattern(e.target.value)} />
      </label>
      <Kv k="Matched" v={`${row.matchedCount}/${row.assetCount}`} />
      <Kv k="Matches" v={row.matched.join(', ') || 'none'} />
    </Card>
  );
}
export function ScopeSearch() {
  const rules = [{ pattern: '*.example.com', reason: 'Primary web inventory' }, { pattern: 'api.example.com', reason: 'Partner API surface' }, { pattern: 'legacy.example.com', reason: 'Retired host' }];
  const [query, setQuery] = useState('api');
  const v = X103A.searchScopeRules(rules.map(r => ({ ...r, query })));
  return (
    <Card title="ScopeSearch" note="Idea 54088">
      <label className="w103a-field">Search rules
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <Kv k="Hits" v={v.hitCount} />
      {v.rows.filter(r => r.matched).map(r => <Kv key={r.key} k={r.pattern} v={r.reason} />)}
    </Card>
  );
}
export function PunycodeIdnHandling() {
  const data = [{ hostname: 'münchen.example.com' }, { hostname: 'shop.example.com' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.normalizeIdnHostnames(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="PunycodeIdnHandling" note="Idea 54089">
      <Kv k="Result" v={v.idnCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.original} v={r.normalized} />)}
    </Card>
  );
}
export function CaseInsensitivityToggle() {
  const [upper, setUpper] = useState(true);
  const host = upper ? 'API.EXAMPLE.COM' : 'api.example.com';
  const v = X103A.applyCaseSensitivityToggle([{ pattern: 'api.example.com', hostname: host, caseInsensitive: true }]);
  const row = v.rows[0];
  return (
    <Card title="CaseInsensitivityToggle" note="Idea 54090">
      <button type="button" onClick={() => setUpper(f => !f)}>{upper ? 'Lowercase the host' : 'Uppercase the host'}</button>
      <Kv k="Hostname" v={host} />
      <Kv k="Matched" v={row.matched ? 'yes' : 'no'} />
    </Card>
  );
}
export function TrailingSlashNormalization() {
  const data = [{ pathPrefix: '/api', urlPath: '/api/' }, { pathPrefix: '/api', urlPath: '/api/v1/users' }, { pathPrefix: '/admin/', urlPath: '/admin' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.normalizeTrailingSlash(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="TrailingSlashNormalization" note="Idea 54091">
      <Kv k="Result" v={v.matchedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.urlPath} v={r.status} />)}
    </Card>
  );
}
export function QueryParameterScoping() {
  const data = [{ url: 'https://app.example.com/x?preview=1', paramName: 'preview', requiredValue: '1' }, { url: 'https://app.example.com/x', paramName: 'preview' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.applyQueryParameterScope(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="QueryParameterScoping" note="Idea 54092">
      <Kv k="Result" v={v.matchedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.url} v={r.status} />)}
    </Card>
  );
}
export function GeoBasedScoping() {
  const data = [{ hostname: 'app.example.de', country: 'DE', allowedCountries: ['DE', 'NL'] }, { hostname: 'app.other.cn', country: 'CN', allowedCountries: ['DE', 'NL'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.applyGeoScope(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="GeoBasedScoping" note="Idea 54093">
      <Kv k="Result" v={v.inScopeCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.hostname} v={r.status} />)}
    </Card>
  );
}
export function AsnBasedScoping() {
  const data = [{ hostname: 'cdn-a.example.com', asn: 'AS13335', blockedAsns: ['AS9009'] }, { hostname: 'cdn-b.example.com', asn: 'AS9009', blockedAsns: ['AS9009'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.applyAsnScope(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="AsnBasedScoping" note="Idea 54094">
      <Kv k="Result" v={v.inScopeCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.hostname} v={r.status} />)}
    </Card>
  );
}
export function ScopeNotesPerRule() {
  const data = [{ pattern: '*.example.com', note: 'Client approved wildcard for the whole web estate in the kickoff call.' }, { pattern: 'old.example.com', note: '' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.attachScopeRuleNotes(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeNotesPerRule" note="Idea 54095">
      <Kv k="Result" v={v.justifiedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.pattern} v={r.status} />)}
    </Card>
  );
}
export function ScopeAuditTrail() {
  const data = [{ action: 'create', actor: 'ops-lead', at: '2026-10-01T09:00:00Z', ruleId: 'r1' }, { action: 'delete', actor: 'hunter', at: '2026-10-08T10:00:00Z', ruleId: 'r2' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.buildScopeAuditTrail(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeAuditTrail" note="Idea 54096">
      <Kv k="Result" v={v.count} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.ruleId} v={`${r.action} by ${r.actor}`} />)}
    </Card>
  );
}
export function ScopeChangeNotifications() {
  const data = [{ ruleId: 'r1', changeType: 'edit', subscribers: ['lead@example.com', 'hunter@example.com'], diffSummary: 'pattern narrowed from *.example.com' }, { ruleId: 'r2', changeType: 'delete', subscribers: [], diffSummary: '' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.notifyScopeChanges(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeChangeNotifications" note="Idea 54097">
      <Kv k="Result" v={v.notifiedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.ruleId} v={r.status} />)}
    </Card>
  );
}
export function ScopeConflictHighlighting() {
  const data = [{ pattern: 'admin.example.com', type: 'include' }, { pattern: 'admin.example.com', type: 'exclude' }, { pattern: 'api.example.com', type: 'include' }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.highlightScopeConflicts(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScopeConflictHighlighting" note="Idea 54098">
      <Kv k="Result" v={v.conflictCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.pattern} v={r.status} />)}
    </Card>
  );
}
export function ScopeRuleScheduling() {
  const data = [{ pattern: '*.example.com', windowStartHour: 9, windowEndHour: 18 }, { pattern: '*.example.com', windowStartHour: 9, windowEndHour: 18 }];
  const [hour, setHour] = useState(10);
  const v = X103A.evaluateScopeRuleSchedules(data.map(d => ({ ...d, checkHour: hour })));
  return (
    <Card title="ScopeRuleScheduling" note="Idea 54099">
      <label className="w103a-field">Check hour ({hour})
        <input type="range" min="0" max="23" value={hour} onChange={e => setHour(Number(e.target.value))} />
      </label>
      <Kv k="Active" v={v.activeCount} />
      <Kv k="Status" v={v.rows[0].status} />
    </Card>
  );
}
export function HeaderBasedScoping() {
  const data = [{ requirement: { name: 'x-client', value: 'infinity-ai' }, headers: { 'X-Client': 'infinity-ai' } }, { requirement: { name: 'x-client', value: 'infinity-ai' }, headers: { 'x-client': 'other' } }];
  const [showAll, setShowAll] = useState(true);
  const v = X103A.applyHeaderScope(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="HeaderBasedScoping" note="Idea 54100">
      <Kv k="Result" v={v.matchedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.headerName} v={r.status} />)}
    </Card>
  );
}

export const WAVE103_A_COMPONENTS = [TimeBoxedScopeRules, ScopeRuleComments, ScopeRuleMentions, ScopeStatisticsHeader, UncoveredAssetWarnings, ScopeCoverageMeter, ScopeSimulationAgainstInventory, ScopeSearch, PunycodeIdnHandling, CaseInsensitivityToggle, TrailingSlashNormalization, QueryParameterScoping, GeoBasedScoping, AsnBasedScoping, ScopeNotesPerRule, ScopeAuditTrail, ScopeChangeNotifications, ScopeConflictHighlighting, ScopeRuleScheduling, HeaderBasedScoping];

export function Wave103AGallery() {
  return (
    <div className="w103a-gallery">
      {WAVE103_A_COMPONENTS.map((C, i) => (<C key={i} />))}
      <div className="w103a-row"><Badge tone="info">Infinity AI</Badge></div>
    </div>
  );
}
