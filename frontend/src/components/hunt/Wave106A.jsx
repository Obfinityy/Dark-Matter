/**
 * Wave106A.jsx — Infinity AI · Wave 106A
 * 20 working React components for change-detection alerts, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useState } from 'react';
import * as X106A from './wave106ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w106a-card">
      <div className="w106a-title">{title}</div>
      {note ? <div className="w106a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w106a-badge w106a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w106a-kv">
      <span className="w106a-k">{k}</span>
      <span className="w106a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w106a-bar-row">
      <span className="w106a-k">{label}</span>
      <div className="w106a-bar"><div className="w106a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w106a-v">{value}</span>
    </div>
  );
}

export function DatabaseBackedPageChecks() {
  const [age, setAge] = useState(120);
  const data = [
    { target: 'shop', markers: ['In stock', '$49'], pageText: 'In stock now, only $49', dataAgeSeconds: age },
    { target: 'blog', markers: ['Latest posts'], pageText: 'Latest posts from the team', dataAgeSeconds: 45 },
  ];
  const v = X106A.checkDatabaseBackedPages(data, { maxAgeSeconds: 300 });
  return (
    <Card title="DatabaseBackedPageChecks" note="Idea 54201">
      <Kv k="Fresh pages" v={v.freshCount} />
      <label className="w106a-field">Shop data age ({age}s, max 300s)
        <input type="range" min="0" max="900" step="30" value={age} onChange={e => setAge(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function WebhookReceiverChecks() {
  const [billingDown, setBillingDown] = useState(true);
  const data = [
    { target: 'hooks', ackStatus: 200, ackLatencyMs: 120 },
    { target: 'billing', ackStatus: billingDown ? 500 : 200, ackLatencyMs: 60 },
  ];
  const v = X106A.checkWebhookReceivers(data, { maxAckMs: 1000 });
  return (
    <Card title="WebhookReceiverChecks" note="Idea 54202">
      <Kv k="Acknowledged" v={v.ackedCount} />
      <label className="w106a-field">Billing receiver failing
        <input type="checkbox" checked={billingDown} onChange={e => setBillingDown(e.target.checked)} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function BusinessHoursCheckSchedule() {
  const [hour, setHour] = useState(22);
  const data = [
    { target: 'shop', startHour: 9, endHour: 17, sleepsOvernight: true },
    { target: 'api', startHour: 0, endHour: 23, sleepsOvernight: false },
  ];
  const v = X106A.planBusinessHoursChecks(data, { nowHour: hour });
  return (
    <Card title="BusinessHoursCheckSchedule" note="Idea 54203">
      <Kv k="Checks running" v={v.runningCount} />
      <label className="w106a-field">Current hour ({hour}:00, shop hours 09:00–17:00)
        <input type="range" min="0" max="23" value={hour} onChange={e => setHour(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function HealthAlertAcknowledgment() {
  const [escalated, setEscalated] = useState(true);
  const data = [
    { target: 'shop', alertId: 'inc-1', state: 'acknowledged' },
    { target: 'shop', alertId: 'inc-2', state: escalated ? 'escalated' : 'acknowledged' },
    { target: 'blog', alertId: 'inc-3', state: 'open' },
  ];
  const v = X106A.trackAlertAcknowledgments(data);
  return (
    <Card title="HealthAlertAcknowledgment" note="Idea 54204">
      <Kv k="Escalated" v={v.escalatedCount} />
      <Kv k="Acknowledged" v={v.ackedCount} />
      <label className="w106a-field">inc-2 escalated (unacknowledged)
        <input type="checkbox" checked={escalated} onChange={e => setEscalated(e.target.checked)} />
      </label>
    </Card>
  );
}
export function SubdomainDiffAlerts() {
  const [devFound, setDevFound] = useState(true);
  const data = [
    { target: 'shop', previousSubdomains: ['www.example.com', 'api.example.com'], currentSubdomains: devFound ? ['www.example.com', 'api.example.com', 'dev.example.com'] : ['www.example.com', 'api.example.com'] },
    { target: 'blog', previousSubdomains: ['a.example.com', 'b.example.com'], currentSubdomains: ['a.example.com'] },
  ];
  const v = X106A.diffSubdomains(data);
  return (
    <Card title="SubdomainDiffAlerts" note="Idea 54205">
      <Kv k="Added" v={v.totalAdded} />
      <Kv k="Removed" v={v.totalRemoved} />
      <label className="w106a-field">dev.example.com discovered
        <input type="checkbox" checked={devFound} onChange={e => setDevFound(e.target.checked)} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function NewEndpointDiscoveryAlerts() {
  const [extra, setExtra] = useState(2);
  const pool = ['/v2/search', '/admin/metrics', '/internal/debug'];
  const data = [{ target: 'api', knownEndpoints: ['/health', '/users'], crawledEndpoints: ['/health', '/users', ...pool.slice(0, extra)] }];
  const v = X106A.discoverNewEndpoints(data);
  const row = v.rows[0];
  return (
    <Card title="NewEndpointDiscoveryAlerts" note="Idea 54206">
      <Kv k="New endpoints" v={v.totalNew} />
      <label className="w106a-field">Newly crawled routes ({extra})
        <input type="range" min="0" max="3" value={extra} onChange={e => setExtra(Number(e.target.value))} />
      </label>
      <Kv k="Latest finds" v={row.newEndpoints.join(', ') || 'none'} />
    </Card>
  );
}
export function CertificateTransparencyMonitoring() {
  const [rogue, setRogue] = useState(true);
  const certs = [
    { subject: 'example.com', sans: ['www.example.com', 'api.example.com'] },
    ...(rogue ? [{ subject: 'secure-login-example.com', sans: [] }] : []),
  ];
  const v = X106A.monitorCertificateTransparency([{ target: 'shop', expectedDomains: ['example.com'], certs }]);
  const row = v.rows[0];
  return (
    <Card title="CertificateTransparencyMonitoring" note="Idea 54207">
      <Kv k="Flagged certificates" v={row.flaggedCount} />
      <label className="w106a-field">Look-alike certificate issued
        <input type="checkbox" checked={rogue} onChange={e => setRogue(e.target.checked)} />
      </label>
      <Kv k="Unexpected hosts" v={row.unexpectedHosts.join(', ') || 'none'} />
    </Card>
  );
}
export function DnsRecordChangeAlerts() {
  const [mxAdded, setMxAdded] = useState(true);
  const data = [
    { target: 'shop', recordType: 'MX', previousValues: ['mx1.example.com'], currentValues: mxAdded ? ['mx1.example.com', 'mx2.example.com'] : ['mx1.example.com'] },
    { target: 'shop', recordType: 'A', previousValues: ['192.0.2.10'], currentValues: ['192.0.2.10'] },
  ];
  const v = X106A.diffDnsRecords(data);
  return (
    <Card title="DnsRecordChangeAlerts" note="Idea 54208">
      <Kv k="Changed record sets" v={v.changedCount} />
      <label className="w106a-field">Second MX record added
        <input type="checkbox" checked={mxAdded} onChange={e => setMxAdded(e.target.checked)} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.recordType} v={r.status} />)}
    </Card>
  );
}
export function IpAddressChangeAlerts() {
  const [migrated, setMigrated] = useState(true);
  const data = [
    { target: 'shop', previousIps: ['192.0.2.10', '192.0.2.11'], currentIps: migrated ? ['198.51.100.7'] : ['192.0.2.10', '192.0.2.11'] },
    { target: 'blog', previousIps: ['203.0.113.5'], currentIps: ['203.0.113.5'] },
  ];
  const v = X106A.detectIpChanges(data);
  return (
    <Card title="IpAddressChangeAlerts" note="Idea 54209">
      <Kv k="Full swaps" v={v.fullSwapCount} />
      <label className="w106a-field">Shop migrated to a new host
        <input type="checkbox" checked={migrated} onChange={e => setMigrated(e.target.checked)} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function AsnChangeAlerts() {
  const [moved, setMoved] = useState(false);
  const data = [
    { target: 'shop', previousAsn: 'AS64500', currentAsn: moved ? 'AS64501' : 'AS64500', previousProvider: 'Host A', currentProvider: moved ? 'Host B' : 'Host A' },
    { target: 'blog', previousAsn: 'AS64510', currentAsn: 'AS64510', previousProvider: 'Host C', currentProvider: 'Host C' },
  ];
  const v = X106A.detectAsnChanges(data);
  return (
    <Card title="AsnChangeAlerts" note="Idea 54210">
      <Kv k="ASN moves" v={v.changedCount} />
      <label className="w106a-field">Shop moved provider
        <input type="checkbox" checked={moved} onChange={e => setMoved(e.target.checked)} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.target} v={r.status} />)}
    </Card>
  );
}
export function NameserverChangeAlerts() {
  const [swapped, setSwapped] = useState(true);
  const data = [
    { target: 'shop', previousNs: ['ns1.host-a.net', 'ns2.host-a.net'], currentNs: swapped ? ['ns1.host-b.net', 'ns2.host-b.net'] : ['ns1.host-a.net', 'ns2.host-a.net'] },
  ];
  const v = X106A.detectNameserverChanges(data);
  const row = v.rows[0];
  return (
    <Card title="NameserverChangeAlerts" note="Idea 54211">
      <Kv k="Status" v={row.status} />
      <label className="w106a-field">Delegation fully swapped
        <input type="checkbox" checked={swapped} onChange={e => setSwapped(e.target.checked)} />
      </label>
    </Card>
  );
}
export function SoaSerialTracking() {
  const [delta, setDelta] = useState(2);
  const v = X106A.trackSoaSerials([{ target: 'example.com', previousSerial: 2026100101, currentSerial: 2026100101 + delta }]);
  const row = v.rows[0];
  return (
    <Card title="SoaSerialTracking" note="Idea 54212">
      <Kv k="Status" v={row.status} />
      <label className="w106a-field">Serial delta ({delta})
        <input type="range" min="-3" max="6" value={delta} onChange={e => setDelta(Number(e.target.value))} />
      </label>
      <Kv k="Zones edited" v={v.editedCount} />
    </Card>
  );
}
export function TechnologyStackChangeAlerts() {
  const [swapped, setSwapped] = useState(true);
  const data = [{ target: 'shop', previousTech: ['nginx', 'react'], currentTech: swapped ? ['caddy', 'react', 'nextjs'] : ['nginx', 'react'] }];
  const v = X106A.detectTechStackChanges(data);
  const row = v.rows[0];
  return (
    <Card title="TechnologyStackChangeAlerts" note="Idea 54213">
      <Kv k="Status" v={row.status} />
      <label className="w106a-field">Server swapped and framework added
        <input type="checkbox" checked={swapped} onChange={e => setSwapped(e.target.checked)} />
      </label>
      <Kv k="Added" v={row.added.join(', ') || 'none'} />
      <Kv k="Removed" v={row.removed.join(', ') || 'none'} />
    </Card>
  );
}
export function JavascriptBundleChangeAlerts() {
  const [extraChunk, setExtraChunk] = useState(true);
  const current = [
    { name: 'app', hash: 'h1b', sizeKb: 520 },
    { name: 'vendor', hash: 'h2', sizeKb: 900 },
    ...(extraChunk ? [{ name: 'analytics', hash: 'h3', sizeKb: 60 }] : []),
  ];
  const data = [{ target: 'shop', previousBundles: [{ name: 'app', hash: 'h1', sizeKb: 400 }, { name: 'vendor', hash: 'h2', sizeKb: 900 }], currentBundles: current }];
  const v = X106A.detectJsBundleChanges(data);
  const row = v.rows[0];
  return (
    <Card title="JavascriptBundleChangeAlerts" note="Idea 54214">
      <Kv k="Bundle changes" v={row.changeCount} />
      <label className="w106a-field">New analytics chunk shipped
        <input type="checkbox" checked={extraChunk} onChange={e => setExtraChunk(e.target.checked)} />
      </label>
      <Kv k="Modified" v={row.modified.map(m => m.name).join(', ') || 'none'} />
    </Card>
  );
}
export function PageContentDiff() {
  const [edited, setEdited] = useState(true);
  const data = [{ target: 'shop', previousText: 'the quick brown fox', currentText: edited ? 'the quick red fox jumps' : 'the quick brown fox' }];
  const v = X106A.diffPageContent(data);
  const row = v.rows[0];
  return (
    <Card title="PageContentDiff" note="Idea 54215">
      <Kv k="Status" v={row.status} />
      <label className="w106a-field">Homepage copy edited
        <input type="checkbox" checked={edited} onChange={e => setEdited(e.target.checked)} />
      </label>
      <Bar label="Change ratio" value={row.changeRatio} max={1} />
    </Card>
  );
}
export function HttpHeaderChangeAlerts() {
  const [hstsGone, setHstsGone] = useState(true);
  const current = hstsGone ? { 'X-Frame-Options': 'SAMEORIGIN' } : { 'Strict-Transport-Security': 'max-age=31536000', 'X-Frame-Options': 'DENY' };
  const data = [{ target: 'shop', previousHeaders: { 'Strict-Transport-Security': 'max-age=31536000', 'X-Frame-Options': 'DENY' }, currentHeaders: current }];
  const v = X106A.diffHttpHeaders(data);
  const row = v.rows[0];
  return (
    <Card title="HttpHeaderChangeAlerts" note="Idea 54216">
      <Kv k="Status" v={row.status} />
      <label className="w106a-field">HSTS header dropped
        <input type="checkbox" checked={hstsGone} onChange={e => setHstsGone(e.target.checked)} />
      </label>
      <Kv k="Security alerts" v={v.securityAlertCount} />
    </Card>
  );
}
export function NewOpenPortsAlerts() {
  const [opened, setOpened] = useState(2);
  const pool = [8080, 8443, 9000];
  const data = [{ target: 'shop', previousPorts: [80, 443], currentPorts: [80, 443, ...pool.slice(0, opened)] }];
  const v = X106A.detectNewOpenPorts(data);
  const row = v.rows[0];
  return (
    <Card title="NewOpenPortsAlerts" note="Idea 54217">
      <Kv k="Newly open" v={v.totalNew} />
      <label className="w106a-field">Extra ports exposed ({opened})
        <input type="range" min="0" max="3" value={opened} onChange={e => setOpened(Number(e.target.value))} />
      </label>
      <Kv k="Ports" v={row.newlyOpen.join(', ') || 'none'} />
    </Card>
  );
}
export function RemovedEndpointAlerts() {
  const [gone, setGone] = useState(true);
  const data = [{ target: 'api', knownEndpoints: ['/health', '/billing', '/legacy-report'], currentEndpoints: gone ? ['/health', '/billing'] : ['/health', '/billing', '/legacy-report'] }];
  const v = X106A.detectRemovedEndpoints(data);
  const row = v.rows[0];
  return (
    <Card title="RemovedEndpointAlerts" note="Idea 54218">
      <Kv k="Status" v={row.status} />
      <label className="w106a-field">Legacy report endpoint retired
        <input type="checkbox" checked={gone} onChange={e => setGone(e.target.checked)} />
      </label>
      <Kv k="Removed" v={row.removed.join(', ') || 'none'} />
    </Card>
  );
}
export function RedirectTargetChanges() {
  const [hijacked, setHijacked] = useState(true);
  const data = [{ target: 'shop', redirects: [
    { path: '/pricing', previousTarget: '/plans', currentTarget: hijacked ? '/promo-landing' : '/plans' },
    { path: '/home', previousTarget: '/h', currentTarget: '/h' },
  ] }];
  const v = X106A.detectRedirectTargetChanges(data);
  const row = v.rows[0];
  return (
    <Card title="RedirectTargetChanges" note="Idea 54219">
      <Kv k="Changed redirects" v={row.changedCount} />
      <label className="w106a-field">/pricing destination swapped
        <input type="checkbox" checked={hijacked} onChange={e => setHijacked(e.target.checked)} />
      </label>
      <Kv k="Paths" v={row.changedPaths.join(', ') || 'none'} />
    </Card>
  );
}
export function RobotsTxtChangeAlerts() {
  const [exposed, setExposed] = useState(true);
  const data = [{ target: 'shop', previousDisallowed: ['/admin', '/tmp'], currentDisallowed: exposed ? ['/admin', '/internal'] : ['/admin', '/tmp'] }];
  const v = X106A.diffRobotsTxt(data);
  const row = v.rows[0];
  return (
    <Card title="RobotsTxtChangeAlerts" note="Idea 54220">
      <Kv k="Status" v={row.status} />
      <label className="w106a-field">/tmp newly exposed, /internal newly disallowed
        <input type="checkbox" checked={exposed} onChange={e => setExposed(e.target.checked)} />
      </label>
      <Kv k="Newly exposed" v={row.newlyExposed.join(', ') || 'none'} />
    </Card>
  );
}

export const WAVE106_A_COMPONENTS = [DatabaseBackedPageChecks, WebhookReceiverChecks, BusinessHoursCheckSchedule, HealthAlertAcknowledgment, SubdomainDiffAlerts, NewEndpointDiscoveryAlerts, CertificateTransparencyMonitoring, DnsRecordChangeAlerts, IpAddressChangeAlerts, AsnChangeAlerts, NameserverChangeAlerts, SoaSerialTracking, TechnologyStackChangeAlerts, JavascriptBundleChangeAlerts, PageContentDiff, HttpHeaderChangeAlerts, NewOpenPortsAlerts, RemovedEndpointAlerts, RedirectTargetChanges, RobotsTxtChangeAlerts];

export function Wave106AGallery() {
  return (
    <div className="w106a-gallery">
      {WAVE106_A_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
