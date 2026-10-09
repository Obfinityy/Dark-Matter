/**
 * Wave101B.jsx — Infinity AI · Wave 101
 * 20 working React components for target onboarding operations, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X101B from './wave101BCores.js';

function Card({ title, note, children }) {
  return (
    <div className="w101b-card">
      <div className="w101b-title">{title}</div>
      {note ? <div className="w101b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w101b-badge w101b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w101b-kv">
      <span className="w101b-k">{k}</span>
      <span className="w101b-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w101b-bar-row">
      <span className="w101b-k">{label}</span>
      <div className="w101b-bar"><div className="w101b-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w101b-v">{value}</span>
    </div>
  );
}

export function ScopePreFillFromProgram() {
  const data = [
    { target: 'shop.example.com', programScopeItems: 6, prefilledItems: 6 },
    { target: 'blog.example.com', programScopeItems: 6, prefilledItems: 2 },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X101B.prefillScopeFromProgram(data);
  const rows = readyOnly ? v.rows.filter(r => r.prefilled) : v.rows;
  return (
    <Card title="ScopePreFillFromProgram" note="Idea 54021">
      <Kv k="Scope pre-filled" v={v.prefilledCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all targets' : 'Show pre-filled only'}</button>
      {rows.map(r => <Bar key={r.key} label={r.target} value={r.fillRate} max={1} />)}
    </Card>
  );
}
export function VerificationFileDownload() {
  const data = [
    { target: 'shop.example.com', fileType: 'html', downloads: 3, fileSizeKb: 2 },
    { target: 'odd.example.com', fileType: 'exe', downloads: 0, fileSizeKb: 0 },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X101B.downloadVerificationFile(data);
  const rows = readyOnly ? v.rows.filter(r => r.verified) : v.rows;
  return (
    <Card title="VerificationFileDownload" note="Idea 54022">
      <Kv k="Files ready" v={v.verifiedCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all targets' : 'Show ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.target} fetches`} v={r.downloads} />)}
    </Card>
  );
}
export function DnsTxtInstructionsGenerator() {
  const data = [
    { domain: 'good.example.com', token: 'tok-1234', ttlSeconds: 300, txtHost: '_verify' },
    { domain: 'bare.example.com', token: '', ttlSeconds: 0, txtHost: '' },
  ];
  const [readyOnly, setReadyOnly] = useState(false);
  const v = X101B.generateDnsTxtInstructions(data);
  const rows = readyOnly ? v.rows.filter(r => r.generated) : v.rows;
  return (
    <Card title="DnsTxtInstructionsGenerator" note="Idea 54023">
      <Kv k="Instructions ready" v={v.generatedCount} />
      <button type="button" onClick={() => setReadyOnly(f => !f)}>{readyOnly ? 'Show all domains' : 'Show ready only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.domain} host`} v={r.txtHost || 'none'} />)}
    </Card>
  );
}
export function MetaTagSnippetGenerator() {
  const data = [
    { target: 'shop.example.com', metaName: 'ownership', metaContent: 'abc-123', inserted: true },
    { target: 'blog.example.com', metaName: 'ownership', metaContent: '', inserted: false },
  ];
  const [liveOnly, setLiveOnly] = useState(false);
  const v = X101B.generateMetaTagSnippet(data);
  const rows = liveOnly ? v.rows.filter(r => r.valid) : v.rows;
  return (
    <Card title="MetaTagSnippetGenerator" note="Idea 54024">
      <Kv k="Snippets live" v={v.validCount} />
      <button type="button" onClick={() => setLiveOnly(f => !f)}>{liveOnly ? 'Show all targets' : 'Show live only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.target} tag`} v={r.metaName} />)}
    </Card>
  );
}
export function SubdomainCountPreview() {
  const data = [
    { domain: 'big.example.com', subdomainsFound: 25, probedHosts: 100 },
    { domain: 'tiny.example.com', subdomainsFound: 3, probedHosts: 20 },
  ];
  const [found, setFound] = useState(25);
  const v = X101B.previewSubdomainCount([{ ...data[0], subdomainsFound: found }, data[1]]);
  return (
    <Card title="SubdomainCountPreview" note="Idea 54025">
      <Kv k="Rich surfaces" v={v.richCount} />
      <label className="w101b-field">First domain subdomains found ({found})
        <input type="range" min="0" max="60" value={found} onChange={e => setFound(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.domain} found`} v={r.subdomainsFound} />)}
    </Card>
  );
}
export function IpResolutionPreview() {
  const data = [
    { host: 'api.example.com', ipsResolved: 3, ipv6Count: 1, resolvesOk: true },
    { host: 'old.example.com', ipsResolved: 0, ipv6Count: 0, resolvesOk: false },
  ];
  const [okOnly, setOkOnly] = useState(false);
  const v = X101B.previewIpResolution(data);
  const rows = okOnly ? v.rows.filter(r => r.resolved) : v.rows;
  return (
    <Card title="IpResolutionPreview" note="Idea 54026">
      <Kv k="Hosts resolved" v={v.resolvedCount} />
      <button type="button" onClick={() => setOkOnly(f => !f)}>{okOnly ? 'Show all hosts' : 'Show resolved only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.host} addresses`} v={r.ipsResolved} />)}
    </Card>
  );
}
export function WafCdnPreview() {
  const data = [
    { target: 'shop.example.com', wafDetected: true, cdnDetected: true, provider: 'edge-a' },
    { target: 'bare.example.com', wafDetected: false, cdnDetected: false, provider: '' },
  ];
  const [shieldedOnly, setShieldedOnly] = useState(false);
  const v = X101B.previewWafCdn(data);
  const rows = shieldedOnly ? v.rows.filter(r => r.shielded) : v.rows;
  return (
    <Card title="WafCdnPreview" note="Idea 54027">
      <Kv k="Shielded" v={v.shieldedCount} />
      <button type="button" onClick={() => setShieldedOnly(f => !f)}>{shieldedOnly ? 'Show all targets' : 'Show shielded only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.target} state`} v={r.status} />)}
    </Card>
  );
}
export function RobotsAndSitemapPreview() {
  const data = [
    { target: 'shop.example.com', robotsFound: true, sitemapFound: true, disallowedPaths: 2 },
    { target: 'blog.example.com', robotsFound: true, sitemapFound: false, disallowedPaths: 0 },
  ];
  const [fullOnly, setFullOnly] = useState(false);
  const v = X101B.previewRobotsAndSitemap(data);
  const rows = fullOnly ? v.rows.filter(r => r.complete) : v.rows;
  return (
    <Card title="RobotsAndSitemapPreview" note="Idea 54028">
      <Kv k="Files complete" v={v.completeCount} />
      <button type="button" onClick={() => setFullOnly(f => !f)}>{fullOnly ? 'Show all targets' : 'Show complete only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.target} blocked paths`} v={r.disallowedPaths} />)}
    </Card>
  );
}
export function SecurityHeaderPreview() {
  const data = [
    { target: 'shop.example.com', headersTotal: 6, headersPresent: 6, strictTransport: true },
    { target: 'blog.example.com', headersTotal: 6, headersPresent: 2, strictTransport: false },
  ];
  const [present, setPresent] = useState(6);
  const v = X101B.previewSecurityHeaders([{ ...data[0], headersPresent: present }, data[1]]);
  return (
    <Card title="SecurityHeaderPreview" note="Idea 54029">
      <Kv k="Headers strong" v={v.securedCount} />
      <label className="w101b-field">First target headers present ({present})
        <input type="range" min="0" max="6" value={present} onChange={e => setPresent(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Bar key={r.key} label={r.target} value={r.headerCoverage} max={1} />)}
    </Card>
  );
}
export function CookieAndAuthPreview() {
  const data = [
    { target: 'shop.example.com', cookiesFound: 5, secureCookies: 5, authDetected: true },
    { target: 'blog.example.com', cookiesFound: 4, secureCookies: 1, authDetected: true },
  ];
  const [secure, setSecure] = useState(5);
  const v = X101B.previewCookiesAndAuth([{ ...data[0], secureCookies: secure }, data[1]]);
  return (
    <Card title="CookieAndAuthPreview" note="Idea 54030">
      <Kv k="Sessions safe" v={v.safeCount} />
      <label className="w101b-field">First target secured cookies ({secure})
        <input type="range" min="0" max="5" value={secure} onChange={e => setSecure(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.target} secure rate`} v={r.secureRate} />)}
    </Card>
  );
}
export function OnboardingAuditLog() {
  const data = [
    { actor: 'ana', action: 'target-added', sequence: 1, detailPresent: true },
    { actor: 'bob', action: 'scope-set', sequence: 2, detailPresent: false },
  ];
  const [detailedOnly, setDetailedOnly] = useState(false);
  const v = X101B.buildOnboardingAuditLog(data);
  const rows = detailedOnly ? v.rows.filter(r => r.detailPresent) : v.rows;
  return (
    <Card title="OnboardingAuditLog" note="Idea 54031">
      <Kv k="Detailed entries" v={v.detailedCount} />
      <button type="button" onClick={() => setDetailedOnly(f => !f)}>{detailedOnly ? 'Show all entries' : 'Show detailed only'}</button>
      {rows.map(r => <Kv key={r.key} k={`#${r.sequence} ${r.actor}`} v={r.action} />)}
    </Card>
  );
}
export function BulkDraftPromotion() {
  const data = [
    { batchId: 'batch-a', draftsSelected: 8, promoted: 8, blocked: 0 },
    { batchId: 'batch-b', draftsSelected: 6, promoted: 3, blocked: 1 },
  ];
  const [fullOnly, setFullOnly] = useState(false);
  const v = X101B.promoteBulkDrafts(data);
  const rows = fullOnly ? v.rows.filter(r => r.fullyPromoted) : v.rows;
  return (
    <Card title="BulkDraftPromotion" note="Idea 54032">
      <Kv k="Batches promoted" v={v.fullyPromotedCount} />
      <button type="button" onClick={() => setFullOnly(f => !f)}>{fullOnly ? 'Show all batches' : 'Show promoted only'}</button>
      {rows.map(r => <Bar key={r.key} label={r.batchId} value={r.promotionRate} max={1} />)}
    </Card>
  );
}
export function OnboardingUndo() {
  const data = [
    { actionId: 'act-1', undoable: true, undone: true, reversibleWindowMin: 60 },
    { actionId: 'act-2', undoable: true, undone: false, reversibleWindowMin: 30 },
  ];
  const [openOnly, setOpenOnly] = useState(false);
  const v = X101B.undoOnboardingActions(data);
  const rows = openOnly ? v.rows.filter(r => r.available) : v.rows;
  return (
    <Card title="OnboardingUndo" note="Idea 54033">
      <Kv k="Undo available" v={v.availableCount} />
      <button type="button" onClick={() => setOpenOnly(f => !f)}>{openOnly ? 'Show all actions' : 'Show reversible only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.actionId} window`} v={r.reversibleWindowMin} />)}
    </Card>
  );
}
export function ContactDetailsCapture() {
  const data = [
    { target: 'shop.example.com', contactEmails: 2, contactForms: 1, verifiedContacts: 2 },
    { target: 'quiet.example.com', contactEmails: 1, contactForms: 0, verifiedContacts: 0 },
  ];
  const [verified, setVerified] = useState(2);
  const v = X101B.captureContactDetails([{ ...data[0], verifiedContacts: verified }, data[1]]);
  return (
    <Card title="ContactDetailsCapture" note="Idea 54034">
      <Kv k="Reachable" v={v.reachableCount} />
      <label className="w101b-field">First target verified contacts ({verified})
        <input type="range" min="0" max="3" value={verified} onChange={e => setVerified(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.target} reach`} v={r.reachRate} />)}
    </Card>
  );
}
export function NotificationPreferencesPerTarget() {
  const data = [
    { target: 'shop.example.com', channelsEnabled: 3, channelsTotal: 4, muteAll: false },
    { target: 'quiet.example.com', channelsEnabled: 0, channelsTotal: 4, muteAll: true },
  ];
  const [enabled, setEnabled] = useState(3);
  const v = X101B.manageNotificationPreferences([{ ...data[0], channelsEnabled: enabled }, data[1]]);
  return (
    <Card title="NotificationPreferencesPerTarget" note="Idea 54035">
      <Kv k="Alerts active" v={v.activeCount} />
      <label className="w101b-field">First target channels enabled ({enabled})
        <input type="range" min="0" max="4" value={enabled} onChange={e => setEnabled(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.target} state`} v={r.status} />)}
    </Card>
  );
}
export function HuntSlaSetting() {
  const data = [
    { huntType: 'standard', slaHours: 48, breachedHunts: 1, totalHunts: 20 },
    { huntType: 'rush', slaHours: 4, breachedHunts: 3, totalHunts: 10 },
  ];
  const [hours, setHours] = useState(48);
  const v = X101B.setHuntSla([{ ...data[0], slaHours: hours }, data[1]]);
  return (
    <Card title="HuntSlaSetting" note="Idea 54036">
      <Kv k="Windows holding" v={v.withinCount} />
      <label className="w101b-field">First hunt type window in hours ({hours})
        <input type="range" min="4" max="96" step="4" value={hours} onChange={e => setHours(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.huntType} breach rate`} v={r.breachRate} />)}
    </Card>
  );
}
export function QuickStartHuntSuggestion() {
  const data = [
    { targetType: 'web', suggestedChecks: 5, estimatedMinutes: 20, accepted: true },
    { targetType: 'api', suggestedChecks: 2, estimatedMinutes: 90, accepted: false },
  ];
  const [minutes, setMinutes] = useState(20);
  const v = X101B.suggestQuickStartHunt([{ ...data[0], estimatedMinutes: minutes }, data[1]]);
  return (
    <Card title="QuickStartHuntSuggestion" note="Idea 54037">
      <Kv k="Quick starts" v={v.quickCount} />
      <label className="w101b-field">First suggestion minutes ({minutes})
        <input type="range" min="5" max="120" step="5" value={minutes} onChange={e => setMinutes(Number(e.target.value))} />
      </label>
      {v.rows.map(r => <Kv key={r.key} k={`${r.targetType} minutes`} v={r.estimatedMinutes} />)}
    </Card>
  );
}
export function BrowserExtensionImport() {
  const data = [
    { source: 'extension-a', importedTargets: 9, rejectedTargets: 1, duplicatesSkipped: 2 },
    { source: 'extension-b', importedTargets: 2, rejectedTargets: 6, duplicatesSkipped: 0 },
  ];
  const [cleanOnly, setCleanOnly] = useState(false);
  const v = X101B.importFromBrowserExtension(data);
  const rows = cleanOnly ? v.rows.filter(r => r.clean) : v.rows;
  return (
    <Card title="BrowserExtensionImport" note="Idea 54038">
      <Kv k="Clean imports" v={v.cleanCount} />
      <button type="button" onClick={() => setCleanOnly(f => !f)}>{cleanOnly ? 'Show all sources' : 'Show clean only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.source} imported`} v={r.importedTargets} />)}
    </Card>
  );
}
export function MobileAppBinding() {
  const data = [
    { device: 'phone-1', bound: true, targetsSynced: 4, lastSyncOk: true },
    { device: 'phone-2', bound: false, targetsSynced: 0, lastSyncOk: false },
  ];
  const [syncedOnly, setSyncedOnly] = useState(false);
  const v = X101B.bindMobileApp(data);
  const rows = syncedOnly ? v.rows.filter(r => r.synced) : v.rows;
  return (
    <Card title="MobileAppBinding" note="Idea 54039">
      <Kv k="Syncing devices" v={v.syncedCount} />
      <button type="button" onClick={() => setSyncedOnly(f => !f)}>{syncedOnly ? 'Show all devices' : 'Show syncing only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.device} synced`} v={r.targetsSynced} />)}
    </Card>
  );
}
export function CloudAccountBinding() {
  const data = [
    { provider: 'cloud-a', account: 'acct-1', connected: true, resourcesDiscovered: 12 },
    { provider: 'cloud-b', account: '', connected: false, resourcesDiscovered: 0 },
  ];
  const [boundOnly, setBoundOnly] = useState(false);
  const v = X101B.bindCloudAccount(data);
  const rows = boundOnly ? v.rows.filter(r => r.bound) : v.rows;
  return (
    <Card title="CloudAccountBinding" note="Idea 54040">
      <Kv k="Cloud-bound" v={v.boundCount} />
      <button type="button" onClick={() => setBoundOnly(f => !f)}>{boundOnly ? 'Show all accounts' : 'Show bound only'}</button>
      {rows.map(r => <Kv key={r.key} k={`${r.provider} resources`} v={r.resourcesDiscovered} />)}
      <div className="w101b-row"><Badge tone="info">Infinity AI</Badge></div>
    </Card>
  );
}

export const WAVE101_B_COMPONENTS = [ScopePreFillFromProgram, VerificationFileDownload, DnsTxtInstructionsGenerator, MetaTagSnippetGenerator, SubdomainCountPreview, IpResolutionPreview, WafCdnPreview, RobotsAndSitemapPreview, SecurityHeaderPreview, CookieAndAuthPreview, OnboardingAuditLog, BulkDraftPromotion, OnboardingUndo, ContactDetailsCapture, NotificationPreferencesPerTarget, HuntSlaSetting, QuickStartHuntSuggestion, BrowserExtensionImport, MobileAppBinding, CloudAccountBinding];

export function Wave101BGallery() {
  return (
    <div className="w101b-gallery">
      {WAVE101_B_COMPONENTS.map((C, i) => (<C key={i} />))}
    </div>
  );
}
