/**
 * Wave106B.jsx — Infinity AI · Wave 106B
 * 20 working React components for change intelligence, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useState } from 'react';
import * as X106B from './wave106BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w106b-card">
      <div className="w106b-title">{title}</div>
      {note ? <div className="w106b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w106b-badge w106b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w106b-kv">
      <span className="w106b-k">{k}</span>
      <span className="w106b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w106b-bar-row">
      <span className="w106b-k">{label}</span>
      <div className="w106b-bar"><div className="w106b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w106b-v">{value}</span>
    </div>
  );
}

export function SitemapChangeAlerts() {
  const [added, setAdded] = useState(2);
  const pool = ['/pricing', '/docs', '/blog'];
  const data = [{ target: 'shop', previousUrls: ['/', '/about'], currentUrls: ['/', '/about', ...pool.slice(0, added)] }];
  const v = X106B.diffSitemaps(data);
  const row = v.rows[0];
  return (
    <Card title="SitemapChangeAlerts" note="Idea 54221">
      <Kv k="Added URLs" v={v.totalAdded} />
      <label className="w106b-field">New sitemap entries ({added})
        <input type="range" min="0" max="3" value={added} onChange={e => setAdded(Number(e.target.value))} />
      </label>
      <Kv k="Newest" v={row.added.join(', ') || 'none'} />
    </Card>
  );
}
export function FaviconChangeAlerts() {
  const [rebranded, setRebranded] = useState(true);
  const v = X106B.detectFaviconChanges([{ target: 'shop', previousHash: 'fav-1a', currentHash: rebranded ? 'fav-9z' : 'fav-1a' }]);
  const row = v.rows[0];
  return (
    <Card title="FaviconChangeAlerts" note="Idea 54222">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Favicon swapped (rebrand or clone)
        <input type="checkbox" checked={rebranded} onChange={e => setRebranded(e.target.checked)} />
      </label>
      <Kv k="Swaps flagged" v={v.changedCount} />
    </Card>
  );
}
export function TitleAndMetaChangeAlerts() {
  const [titleEdited, setTitleEdited] = useState(true);
  const data = [{ target: 'shop', previousTitle: 'Shop — Home', currentTitle: titleEdited ? 'Shop — Sale now on' : 'Shop — Home', previousDescription: 'Buy things', currentDescription: 'Buy things' }];
  const v = X106B.detectTitleMetaChanges(data);
  const row = v.rows[0];
  return (
    <Card title="TitleAndMetaChangeAlerts" note="Idea 54223">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Homepage title edited
        <input type="checkbox" checked={titleEdited} onChange={e => setTitleEdited(e.target.checked)} />
      </label>
    </Card>
  );
}
export function FormChangeDetection() {
  const [wallet, setWallet] = useState(true);
  const forms = [
    { name: 'checkout', sensitive: true, previousFields: ['card', 'cvv'], currentFields: wallet ? ['card', 'cvv', 'wallet'] : ['card', 'cvv'] },
    { name: 'search', sensitive: false, previousFields: ['q'], currentFields: ['q'] },
  ];
  const v = X106B.detectFormChanges([{ target: 'shop', forms }]);
  const row = v.rows[0];
  return (
    <Card title="FormChangeDetection" note="Idea 54224">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Wallet field added to checkout form
        <input type="checkbox" checked={wallet} onChange={e => setWallet(e.target.checked)} />
      </label>
      <Kv k="Sensitive forms changed" v={row.sensitiveChangedNames.join(', ') || 'none'} />
    </Card>
  );
}
export function NewLoginPageDetection() {
  const [ssoPage, setSsoPage] = useState(true);
  const endpoints = [
    { path: '/login', hasPasswordField: true, known: true },
    ...(ssoPage ? [{ path: '/sso-login', hasPasswordField: true, known: false }] : []),
    { path: '/home', hasPasswordField: false, known: false },
  ];
  const v = X106B.detectNewLoginPages([{ target: 'shop', endpoints }]);
  const row = v.rows[0];
  return (
    <Card title="NewLoginPageDetection" note="Idea 54225">
      <Kv k="New login pages" v={v.totalNew} />
      <label className="w106b-field">New SSO login page discovered
        <input type="checkbox" checked={ssoPage} onChange={e => setSsoPage(e.target.checked)} />
      </label>
      <Kv k="Review queue" v={row.newLoginPaths.join(', ') || 'none'} />
    </Card>
  );
}
export function NewFileUploadDetection() {
  const [upload, setUpload] = useState(true);
  const endpoints = [
    { path: '/avatar', acceptsUpload: true, known: true },
    ...(upload ? [{ path: '/media/upload', acceptsUpload: true, known: false }] : []),
  ];
  const v = X106B.detectNewFileUploads([{ target: 'api', endpoints }]);
  const row = v.rows[0];
  return (
    <Card title="NewFileUploadDetection" note="Idea 54226">
      <Kv k="New upload endpoints" v={v.totalNew} />
      <label className="w106b-field">Media upload endpoint exposed
        <input type="checkbox" checked={upload} onChange={e => setUpload(e.target.checked)} />
      </label>
      <Kv k="Paths" v={row.newUploadPaths.join(', ') || 'none'} />
    </Card>
  );
}
export function WafOnOffChangeDetection() {
  const [current, setCurrent] = useState('');
  const v = X106B.detectWafChanges([{ target: 'shop', previousWaf: 'cloudflare', currentWaf: current }]);
  const row = v.rows[0];
  return (
    <Card title="WafOnOffChangeDetection" note="Idea 54227">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Current WAF (was cloudflare)
        <select value={current} onChange={e => setCurrent(e.target.value)}>
          <option value="cloudflare">cloudflare</option>
          <option value="akamai">akamai</option>
          <option value="">none</option>
        </select>
      </label>
    </Card>
  );
}
export function CdnChangeDetection() {
  const [current, setCurrent] = useState('fastly');
  const v = X106B.detectCdnChanges([{ target: 'shop', previousCdn: 'cloudfront', currentCdn: current }]);
  const row = v.rows[0];
  return (
    <Card title="CdnChangeDetection" note="Idea 54228">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Current CDN (was cloudfront)
        <select value={current} onChange={e => setCurrent(e.target.value)}>
          <option value="cloudfront">cloudfront</option>
          <option value="fastly">fastly</option>
          <option value="">none</option>
        </select>
      </label>
    </Card>
  );
}
export function TlsVersionChangeAlerts() {
  const [tls13, setTls13] = useState(false);
  const v = X106B.detectTlsVersionChanges([{ target: 'shop', previousVersions: ['TLS 1.2', 'TLS 1.3'], currentVersions: tls13 ? ['TLS 1.2', 'TLS 1.3'] : ['TLS 1.2'] }]);
  const row = v.rows[0];
  return (
    <Card title="TlsVersionChangeAlerts" note="Idea 54229">
      <Kv k="Status" v={row.status} />
      <Badge tone={row.downgraded ? 'high' : 'good'}>{row.downgraded ? 'downgrade' : 'current'}</Badge>
      <label className="w106b-field">TLS 1.3 still offered
        <input type="checkbox" checked={tls13} onChange={e => setTls13(e.target.checked)} />
      </label>
    </Card>
  );
}
export function CipherSuiteChangeAlerts() {
  const [legacy, setLegacy] = useState(true);
  const current = ['TLS_AES_128_GCM_SHA256', 'TLS_CHACHA20_POLY1305_SHA256', ...(legacy ? ['TLS_RSA_WITH_3DES_EDE_CBC_SHA'] : [])];
  const v = X106B.diffCipherSuites([{ target: 'shop', previousCiphers: ['TLS_AES_128_GCM_SHA256', 'TLS_CHACHA20_POLY1305_SHA256'], currentCiphers: current }]);
  const row = v.rows[0];
  return (
    <Card title="CipherSuiteChangeAlerts" note="Idea 54230">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Legacy 3DES cipher re-enabled
        <input type="checkbox" checked={legacy} onChange={e => setLegacy(e.target.checked)} />
      </label>
      <Kv k="Weak additions" v={row.weakAdded.length} />
    </Card>
  );
}
export function CertificateIssuerChangeAlerts() {
  const [issuer, setIssuer] = useState('DigiCert');
  const v = X106B.detectCertIssuerChanges([{ target: 'shop', previousIssuer: "Let's Encrypt", currentIssuer: issuer }]);
  const row = v.rows[0];
  return (
    <Card title="CertificateIssuerChangeAlerts" note="Idea 54231">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Current issuer (was Let&apos;s Encrypt)
        <select value={issuer} onChange={e => setIssuer(e.target.value)}>
          <option value="Let's Encrypt">Let&apos;s Encrypt</option>
          <option value="DigiCert">DigiCert</option>
          <option value="Sectigo">Sectigo</option>
        </select>
      </label>
    </Card>
  );
}
export function SanListChangeAlerts() {
  const [apiHost, setApiHost] = useState(true);
  const current = ['example.com', 'www.example.com', ...(apiHost ? ['api.example.com'] : [])];
  const v = X106B.diffSanLists([{ target: 'shop', previousSans: ['example.com', 'www.example.com'], currentSans: current }]);
  const row = v.rows[0];
  return (
    <Card title="SanListChangeAlerts" note="Idea 54232">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">api.example.com added to certificate
        <input type="checkbox" checked={apiHost} onChange={e => setApiHost(e.target.checked)} />
      </label>
      <Kv k="New hostnames" v={row.added.join(', ') || 'none'} />
    </Card>
  );
}
export function WhoisChangeAlerts() {
  const [registrar, setRegistrar] = useState('NameCheap');
  const v = X106B.diffWhoisRecords([{ target: 'example.com', previousWhois: { registrar: 'NameCheap', expiresAt: '2027-05-01' }, currentWhois: { registrar, expiresAt: '2027-05-01' } }]);
  const row = v.rows[0];
  return (
    <Card title="WhoisChangeAlerts" note="Idea 54233">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Current registrar
        <select value={registrar} onChange={e => setRegistrar(e.target.value)}>
          <option value="NameCheap">NameCheap</option>
          <option value="Unknown Registrar">Unknown Registrar</option>
        </select>
      </label>
      <Kv k="Signals" v={row.signals.join(', ') || 'none'} />
    </Card>
  );
}
export function HostingGeolocationShifts() {
  const [country, setCountry] = useState('DE');
  const v = X106B.detectGeoShifts([{ target: 'shop', previousCountry: 'US', currentCountry: country }]);
  const row = v.rows[0];
  return (
    <Card title="HostingGeolocationShifts" note="Idea 54234">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Resolved country (was US)
        <select value={country} onChange={e => setCountry(e.target.value)}>
          <option value="US">US</option>
          <option value="DE">DE</option>
          <option value="NL">NL</option>
        </select>
      </label>
    </Card>
  );
}
export function ResponseTimeShiftDetection() {
  const [current, setCurrent] = useState(700);
  const v = X106B.detectResponseTimeShifts([{ target: 'shop', baselineMs: 400, currentMs: current }], { significance: 0.25 });
  const row = v.rows[0];
  return (
    <Card title="ResponseTimeShiftDetection" note="Idea 54235">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">Current latency ({current} ms, baseline 400 ms)
        <input type="range" min="100" max="1200" step="25" value={current} onChange={e => setCurrent(Number(e.target.value))} />
      </label>
      <Bar label="Shift ratio" value={Math.abs(row.shiftRatio)} max={1} />
    </Card>
  );
}
export function StatusCodeShiftDetection() {
  const [broken, setBroken] = useState(true);
  const urls = [
    { url: '/pay', previousClass: 200, currentClass: broken ? 500 : 200 },
    { url: '/home', previousClass: 200, currentClass: 200 },
  ];
  const v = X106B.detectStatusCodeShifts([{ target: 'api', urls }]);
  const row = v.rows[0];
  return (
    <Card title="StatusCodeShiftDetection" note="Idea 54236">
      <Kv k="Status" v={row.status} />
      <label className="w106b-field">/pay now returns 5xx
        <input type="checkbox" checked={broken} onChange={e => setBroken(e.target.checked)} />
      </label>
      <Kv k="Worsened URLs" v={row.worsenedUrls.join(', ') || 'none'} />
    </Card>
  );
}
export function NewSubdomainsWithScreenshots() {
  const [captured, setCaptured] = useState(false);
  const subdomains = [
    { host: 'dev.example.com', screenshot: 'captured' },
    { host: 'beta.example.com', screenshot: captured ? 'captured' : 'pending' },
  ];
  const v = X106B.trackNewSubdomainScreenshots([{ target: 'shop', subdomains }]);
  const row = v.rows[0];
  return (
    <Card title="NewSubdomainsWithScreenshots" note="Idea 54237">
      <Kv k="Screenshots" v={`${row.capturedCount}/${row.hostCount}`} />
      <label className="w106b-field">beta.example.com screenshot captured
        <input type="checkbox" checked={captured} onChange={e => setCaptured(e.target.checked)} />
      </label>
      <Bar label="Coverage" value={row.coverage} max={1} />
    </Card>
  );
}
export function ChangeSeverityScoring() {
  const [sensitive, setSensitive] = useState(true);
  const changes = [
    { type: 'favicon', sensitive: false },
    { type: 'certificate', sensitive: false },
    { type: 'form', sensitive },
  ];
  const v = X106B.scoreChangeSeverity([{ target: 'shop', changes }]);
  const row = v.rows[0];
  return (
    <Card title="ChangeSeverityScoring" note="Idea 54238">
      <Kv k="Top grade" v={row.topGrade} />
      <Kv k="High severity" v={row.highCount} />
      <label className="w106b-field">Form change touches payment data
        <input type="checkbox" checked={sensitive} onChange={e => setSensitive(e.target.checked)} />
      </label>
    </Card>
  );
}
export function ChangeDigestEmails() {
  const [period, setPeriod] = useState('daily');
  const data = [
    { group: 'payments', changes: [
      { target: 'shop', type: 'certificate', at: '2026-10-09T01:00:00Z' },
      { target: 'shop', type: 'form', at: '2026-10-09T02:00:00Z' },
    ] },
    { group: 'marketing', changes: [{ target: 'blog', type: 'title', at: '2026-10-09T03:00:00Z' }] },
  ];
  const v = X106B.buildChangeDigests(data, { period });
  return (
    <Card title="ChangeDigestEmails" note="Idea 54239">
      <Kv k="Changes covered" v={v.totalChanges} />
      <label className="w106b-field">Digest period
        <select value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="daily">daily</option>
          <option value="weekly">weekly</option>
        </select>
      </label>
      {v.rows.map(r => <Kv key={r.key} k={r.group} v={r.subject} />)}
    </Card>
  );
}
export function PerTargetChangeTimeline() {
  const [filter, setFilter] = useState('all');
  const changes = [
    { type: 'certificate', at: '2026-10-09T01:00:00Z', detail: 'issuer changed' },
    { type: 'content', at: '2026-10-08T01:00:00Z', detail: 'page copy edited' },
    { type: 'form', at: '2026-10-09T03:00:00Z', detail: 'wallet field added' },
  ];
  const v = X106B.buildTargetChangeTimeline([{ target: 'shop', changes }], { type: filter === 'all' ? undefined : filter });
  const row = v.rows[0];
  return (
    <Card title="PerTargetChangeTimeline" note="Idea 54240">
      <Kv k="Events shown" v={row.eventCount} />
      <label className="w106b-field">Filter by change type
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">all</option>
          <option value="certificate">certificate</option>
          <option value="content">content</option>
          <option value="form">form</option>
        </select>
      </label>
      {row.events.map(e => <Kv key={`${e.at}-${e.type}`} k={`${e.at.slice(0, 10)} ${e.type}`} v={e.detail} />)}
    </Card>
  );
}

export const WAVE106_B_COMPONENTS = [SitemapChangeAlerts, FaviconChangeAlerts, TitleAndMetaChangeAlerts, FormChangeDetection, NewLoginPageDetection, NewFileUploadDetection, WafOnOffChangeDetection, CdnChangeDetection, TlsVersionChangeAlerts, CipherSuiteChangeAlerts, CertificateIssuerChangeAlerts, SanListChangeAlerts, WhoisChangeAlerts, HostingGeolocationShifts, ResponseTimeShiftDetection, StatusCodeShiftDetection, NewSubdomainsWithScreenshots, ChangeSeverityScoring, ChangeDigestEmails, PerTargetChangeTimeline];

export function Wave106BGallery() {
  return (
    <div className="w106b-gallery">
      {WAVE106_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
