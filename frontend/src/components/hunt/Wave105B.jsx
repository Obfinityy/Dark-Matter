/**
 * Wave105B.jsx — Infinity AI · Wave 105B
 * 20 working React components for health intelligence and status operations, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useState } from 'react';
import * as X105B from './wave105BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w105b-card">
      <div className="w105b-title">{title}</div>
      {note ? <div className="w105b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w105b-badge w105b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w105b-kv">
      <span className="w105b-k">{k}</span>
      <span className="w105b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w105b-bar-row">
      <span className="w105b-k">{label}</span>
      <div className="w105b-bar"><div className="w105b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w105b-v">{value}</span>
    </div>
  );
}

export function DependencyHealthRollup() {
  const [cdnDown, setCdnDown] = useState(false);
  const v = X105B.rollupDependencyHealth([{ target: 'shop', dependencies: [
    { name: 'cdn', status: cdnDown ? 'down' : 'up' },
    { name: 'dns', status: 'up' },
    { name: 'sso', status: 'degraded' },
  ] }]);
  const row = v.rows[0];
  return (
    <Card title="DependencyHealthRollup" note="Idea 54181">
      <Kv k="Status" v={row.status} />
      <label className="w105b-field">CDN dependency down
        <input type="checkbox" checked={cdnDown} onChange={e => setCdnDown(e.target.checked)} />
      </label>
      <Kv k="Down dependencies" v={row.downNames.join(', ') || 'none'} />
    </Card>
  );
}
export function ScheduledMaintenanceWindows() {
  const [hour, setHour] = useState(3);
  const v = X105B.planMaintenanceWindows([{ target: 'shop', windows: [{ startHour: 2, endHour: 4 }] }], { nowHour: hour });
  const row = v.rows[0];
  return (
    <Card title="ScheduledMaintenanceWindows" note="Idea 54182">
      <Kv k="Alerts" v={row.status} />
      <label className="w105b-field">Current hour ({hour}:00, window 02:00–04:00)
        <input type="range" min="0" max="23" value={hour} onChange={e => setHour(Number(e.target.value))} />
      </label>
    </Card>
  );
}
export function FlappingDetection() {
  const [flips, setFlips] = useState(4);
  const states = ['up'];
  for (let i = 0; i < flips; i += 1) states.push(i % 2 === 0 ? 'down' : 'up');
  const v = X105B.detectFlapping([{ target: 'unstable', states }], { transitionThreshold: 4 });
  const row = v.rows[0];
  return (
    <Card title="FlappingDetection" note="Idea 54183">
      <Kv k="Status" v={row.status} />
      <Kv k="Transitions" v={row.transitions} />
      <button type="button" onClick={() => setFlips(n => n + 1)}>Add state flip</button>
    </Card>
  );
}
export function DegradedVsDownStates() {
  const [latency, setLatency] = useState(240);
  const v = X105B.classifyTargetState([{ target: 'shop', reachable: true, latencyMs: latency, errorRate: 0.01 }]);
  const row = v.rows[0];
  return (
    <Card title="DegradedVsDownStates" note="Idea 54184">
      <Kv k="State" v={row.state} />
      <label className="w105b-field">Latency ({latency} ms)
        <input type="range" min="50" max="3000" step="10" value={latency} onChange={e => setLatency(Number(e.target.value))} />
      </label>
      <Kv k="Reason" v={row.reason} />
    </Card>
  );
}
export function HealthScoreZeroToHundred() {
  const [uptime, setUptime] = useState(99.9);
  const v = X105B.computeHealthScore([{ target: 'shop', uptimePercent: uptime, p95Ms: 200, tlsGrade: 'A', errorRate: 0.01 }]);
  const row = v.rows[0];
  return (
    <Card title="HealthScoreZeroToHundred" note="Idea 54185">
      <Kv k="Score" v={row.score} />
      <Badge tone={row.score >= 75 ? 'good' : 'warn'}>{row.band}</Badge>
      <label className="w105b-field">Uptime ({uptime}%)
        <input type="range" min="80" max="100" step="0.1" value={uptime} onChange={e => setUptime(Number(e.target.value))} />
      </label>
    </Card>
  );
}
export function HealthHistoryCharts() {
  const [outages, setOutages] = useState(1);
  const checks = [
    { at: '2026-10-09T00:00:00Z', up: true, latencyMs: 120 },
    { at: '2026-10-09T01:00:00Z', up: outages < 1, latencyMs: outages < 1 ? 200 : 0 },
    { at: '2026-10-09T02:00:00Z', up: true, latencyMs: 240 },
  ];
  const v = X105B.buildHealthHistory([{ target: 'shop', checks }]);
  const row = v.rows[0];
  return (
    <Card title="HealthHistoryCharts" note="Idea 54186">
      <Kv k="Uptime" v={row.uptime} />
      <Kv k="Incident markers" v={row.markers.length} />
      <button type="button" onClick={() => setOutages(n => (n > 0 ? 0 : 1))}>{outages > 0 ? 'Resolve 01:00 outage' : 'Replay 01:00 outage'}</button>
      {row.points.map(p => <Bar key={p.at} label={p.at.slice(11, 16)} value={p.latencyMs} max={300} />)}
    </Card>
  );
}
export function SlaCompliancePercentage() {
  const [sla, setSla] = useState(99.9);
  const v = X105B.measureSlaCompliance([{ target: 'shop', uptimePercent: 99.95, slaPercent: sla }]);
  const row = v.rows[0];
  return (
    <Card title="SlaCompliancePercentage" note="Idea 54187">
      <Kv k="Status" v={row.status} />
      <label className="w105b-field">SLA objective ({sla}%)
        <input type="range" min="98" max="100" step="0.05" value={sla} onChange={e => setSla(Number(e.target.value))} />
      </label>
      <Kv k="Margin" v={row.margin} />
    </Card>
  );
}
export function DowntimeAnnotations() {
  const [withCause, setWithCause] = useState(true);
  const notes = withCause
    ? [{ author: 'on-call', text: 'DB pool exhausted', rootCause: true }]
    : [{ author: 'on-call', text: 'Investigating', rootCause: false }];
  const v = X105B.manageDowntimeAnnotations([{ target: 'shop', incidentId: 'inc-9', notes }]);
  const row = v.rows[0];
  return (
    <Card title="DowntimeAnnotations" note="Idea 54188">
      <Kv k="Status" v={row.status} />
      <label className="w105b-field">Root cause recorded
        <input type="checkbox" checked={withCause} onChange={e => setWithCause(e.target.checked)} />
      </label>
      <Kv k="Latest note" v={row.latest || 'none'} />
    </Card>
  );
}
export function AutoPauseHuntsOnOutage() {
  const [state, setState] = useState('down');
  const v = X105B.planAutoPauseHunts([{ target: 'shop', state, runningHunts: 3 }]);
  const row = v.rows[0];
  return (
    <Card title="AutoPauseHuntsOnOutage" note="Idea 54189">
      <Kv k="Action" v={row.action} />
      <label className="w105b-field">Target state
        <select value={state} onChange={e => setState(e.target.value)}>
          <option value="up">up</option>
          <option value="degraded">degraded</option>
          <option value="down">down</option>
        </select>
      </label>
      <Kv k="Hunts affected" v={row.affectedHunts} />
    </Card>
  );
}
export function RecoveryNotifications() {
  const [backUp, setBackUp] = useState(true);
  const v = X105B.buildRecoveryNotifications([{ target: 'shop', wasDown: true, nowUp: backUp, downtimeMinutes: 47, channels: ['email', 'slack'] }]);
  const row = v.rows[0];
  return (
    <Card title="RecoveryNotifications" note="Idea 54190">
      <Kv k="Status" v={row.status} />
      <label className="w105b-field">Target back up
        <input type="checkbox" checked={backUp} onChange={e => setBackUp(e.target.checked)} />
      </label>
      <Kv k="Message" v={row.message || 'pending'} />
    </Card>
  );
}
export function IncidentTimelineTargets() {
  const [resolved, setResolved] = useState(true);
  const events = [
    { type: 'detected', at: '2026-10-09T00:00:00Z' },
    { type: 'acknowledged', at: '2026-10-09T00:20:00Z' },
    ...(resolved ? [{ type: 'resolved', at: '2026-10-09T01:30:00Z' }] : []),
  ];
  const v = X105B.buildIncidentTimeline([{ target: 'shop', incidentId: 'inc-9', events }]);
  const row = v.rows[0];
  return (
    <Card title="IncidentTimelineTargets" note="Idea 54191">
      <Kv k="Stage" v={row.stage} />
      <Kv k="Duration (min)" v={row.durationMinutes === null ? 'open' : row.durationMinutes} />
      <button type="button" onClick={() => setResolved(r => !r)}>{resolved ? 'Reopen incident' : 'Resolve incident'}</button>
    </Card>
  );
}
export function AlertChannelRouting() {
  const [severity, setSeverity] = useState('critical');
  const v = X105B.routeAlertChannels(
    [{ target: 'shop', group: 'payments', severity }],
    { rules: [{ severity: 'critical', channel: 'pagerduty' }, { group: 'payments', channel: 'slack' }, { channel: 'email' }] }
  );
  const row = v.rows[0];
  return (
    <Card title="AlertChannelRouting" note="Idea 54192">
      <Kv k="Channels" v={row.channels.join(', ')} />
      <label className="w105b-field">Severity
        <select value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="critical">critical</option>
          <option value="warning">warning</option>
          <option value="info">info</option>
        </select>
      </label>
    </Card>
  );
}
export function ConfigurableCheckIntervals() {
  const [criticality, setCriticality] = useState('high');
  const v = X105B.planCheckIntervals([{ target: 'shop', criticality, requestedMinutes: 30 }]);
  const row = v.rows[0];
  return (
    <Card title="ConfigurableCheckIntervals" note="Idea 54193">
      <Kv k="Recommended (min)" v={row.recommendedMinutes} />
      <Kv k="Status" v={row.status} />
      <label className="w105b-field">Criticality
        <select value={criticality} onChange={e => setCriticality(e.target.value)}>
          <option value="critical">critical</option>
          <option value="high">high</option>
          <option value="standard">standard</option>
          <option value="low">low</option>
        </select>
      </label>
    </Card>
  );
}
export function PerRegionStatusPage() {
  const [region, setRegion] = useState('eu');
  const data = [
    { target: 'shop', region: 'us', status: 'up', healthScore: 96 },
    { target: 'shop', region: 'eu', status: region === 'eu' ? 'down' : 'up', healthScore: region === 'eu' ? 22 : 91 },
    { target: 'api', region: 'eu', status: 'up', healthScore: 88 },
  ];
  const v = X105B.buildRegionStatusPage(data);
  return (
    <Card title="PerRegionStatusPage" note="Idea 54194">
      <Kv k="Regions down" v={v.downCount} />
      <label className="w105b-field">Outage region
        <select value={region} onChange={e => setRegion(e.target.value)}>
          <option value="none">none</option>
          <option value="eu">eu</option>
        </select>
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.label} v={r.band} />)}
    </Card>
  );
}
export function HealthCheckLogs() {
  const [retention, setRetention] = useState(2);
  const checks = [
    { at: '2026-10-09T02:00:00Z', statusCode: 200, durationMs: 100 },
    { at: '2026-10-09T01:00:00Z', statusCode: 200, durationMs: 300 },
    { at: '2026-10-09T00:00:00Z', statusCode: 500, durationMs: 200 },
  ];
  const v = X105B.retainHealthCheckLogs([{ target: 'shop', checks }], { retention });
  const row = v.rows[0];
  return (
    <Card title="HealthCheckLogs" note="Idea 54195">
      <Kv k="Retained" v={row.retainedCount} />
      <Kv k="Slowest (ms)" v={row.slowestMs} />
      <label className="w105b-field">Retention (entries {retention})
        <input type="range" min="1" max="3" value={retention} onChange={e => setRetention(Number(e.target.value))} />
      </label>
    </Card>
  );
}
export function HealthBasedTargetSorting() {
  const [threshold, setThreshold] = useState(50);
  const v = X105B.sortTargetsByHealth([
    { target: 'shop', healthScore: 92 },
    { target: 'legacy', healthScore: 34 },
  ], { threshold });
  return (
    <Card title="HealthBasedTargetSorting" note="Idea 54196">
      <Kv k="Sickest" v={v.sickest.target} />
      <label className="w105b-field">Attention threshold ({threshold})
        <input type="range" min="10" max="95" step="5" value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={`#${r.rank} ${r.target}`} value={r.healthScore} max={100} />)}
    </Card>
  );
}
export function HealthApiForIntegrations() {
  const [extraDown, setExtraDown] = useState(false);
  const data = [
    { target: 'shop', status: 'up', healthScore: 97, updatedAt: '2026-10-09T02:00:00Z' },
    { target: 'legacy', status: extraDown ? 'down' : 'degraded', healthScore: 41, updatedAt: '2026-10-09T02:00:00Z' },
  ];
  const v = X105B.exposeHealthApiPayload(data);
  return (
    <Card title="HealthApiForIntegrations" note="Idea 54197">
      <Kv k="API version" v={v.payload.version} />
      <Kv k="Targets down" v={v.downCount} />
      <label className="w105b-field">Legacy target fully down
        <input type="checkbox" checked={extraDown} onChange={e => setExtraDown(e.target.checked)} />
      </label>
    </Card>
  );
}
export function UserSelectedCheckRegions() {
  const [regions, setRegions] = useState(['us']);
  const v = X105B.selectCheckRegions([{ target: 'shop', selectedRegions: regions }], { minRegions: 2 });
  const row = v.rows[0];
  const toggle = (name) => setRegions(rs => (rs.includes(name) ? rs.filter(x => x !== name) : [...rs, name]));
  return (
    <Card title="UserSelectedCheckRegions" note="Idea 54198">
      <Kv k="Status" v={row.status} />
      <Kv k="Selected" v={row.selectedRegions.join(', ') || 'none'} />
      {['us', 'eu', 'ap'].map(name => (
        <label key={name} className="w105b-field">{name}
          <input type="checkbox" checked={regions.includes(name)} onChange={() => toggle(name)} />
        </label>
      ))}
    </Card>
  );
}
export function SsoProviderChecks() {
  const [ssoUp, setSsoUp] = useState(true);
  const v = X105B.checkSsoProviders([{ target: 'portal', provider: 'idp', endpointStatus: ssoUp ? 200 : 503, loginGated: true }]);
  const row = v.rows[0];
  return (
    <Card title="SsoProviderChecks" note="Idea 54199">
      <Kv k="Status" v={row.status} />
      <label className="w105b-field">Identity provider reachable
        <input type="checkbox" checked={ssoUp} onChange={e => setSsoUp(e.target.checked)} />
      </label>
      <Kv k="Blocking logins" v={row.blocking ? 'yes' : 'no'} />
    </Card>
  );
}
export function MobileApiChecks() {
  const [mobileDown, setMobileDown] = useState(true);
  const v = X105B.checkMobileApiHosts([{ target: 'shop', webStatus: 200, mobileApiStatus: mobileDown ? 503 : 200, mobileApiLatencyMs: 210 }]);
  const row = v.rows[0];
  return (
    <Card title="MobileApiChecks" note="Idea 54200">
      <Kv k="Status" v={row.status} />
      <label className="w105b-field">Mobile API host down
        <input type="checkbox" checked={mobileDown} onChange={e => setMobileDown(e.target.checked)} />
      </label>
    </Card>
  );
}

export const WAVE105_B_COMPONENTS = [DependencyHealthRollup, ScheduledMaintenanceWindows, FlappingDetection, DegradedVsDownStates, HealthScoreZeroToHundred, HealthHistoryCharts, SlaCompliancePercentage, DowntimeAnnotations, AutoPauseHuntsOnOutage, RecoveryNotifications, IncidentTimelineTargets, AlertChannelRouting, ConfigurableCheckIntervals, PerRegionStatusPage, HealthCheckLogs, HealthBasedTargetSorting, HealthApiForIntegrations, UserSelectedCheckRegions, SsoProviderChecks, MobileApiChecks];

export function Wave105BGallery() {
  return (
    <div className="w105b-gallery">
      {WAVE105_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
