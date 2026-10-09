/**
 * Wave102A.jsx — Infinity AI · Wave 102
 * 20 working React components for wave 102, export-only module:
 * components are not mounted anywhere. Interactive, props/state-driven views over the pure cores.
 */
import React, { useMemo, useState } from 'react';
import * as X102A from './wave102ACore.js';

function Card({ title, note, children }) {
  return (
    <div className="w102a-card">
      <div className="w102a-title">{title}</div>
      {note ? <div className="w102a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w102a-badge w102a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w102a-kv">
      <span className="w102a-k">{k}</span>
      <span className="w102a-v">{String(v)}</span>
    </div>
  );
}

function Bar({ label, value, max = 1 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="w102a-bar-row">
      <span className="w102a-k">{label}</span>
      <div className="w102a-bar"><div className="w102a-bar-fill" style={{ width: `${pct}%` }} /></div>
      <span className="w102a-v">{value}</span>
    </div>
  );
}

export function WhoisPreview() {
  const data = [{ domain: 'shop.example.com', registrar: 'Registrar A', createdYear: 2018, expiresYear: 2027, privacyProtected: true }, { domain: 'new.example.com', registrar: '', createdYear: 2025, expiresYear: 2026, privacyProtected: false }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.summarizeWhoisPreview(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="WhoisPreview" note="Idea 54041">
      <Kv k="Result" v={v.completeCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function CertificatePreview() {
  const data = [{ host: 'shop.example.com', issuer: 'Issuer A', sans: ['shop.example.com', 'www.shop.example.com'], notAfterDays: 120 }, { host: 'old.example.com', issuer: 'Issuer B', sans: ['old.example.com'], notAfterDays: 12 }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.previewTlsCertificate(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="CertificatePreview" note="Idea 54042">
      <Kv k="Result" v={v.validCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function RateLimitDiscoveryNote() {
  const data = [{ endpoint: '/v1/search', limitPerMinute: 60, retryAfterSeconds: 30, headerPresent: true }, { endpoint: '/v1/export', limitPerMinute: 0, retryAfterSeconds: 0, headerPresent: false }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.buildRateLimitDiscoveryNote(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="RateLimitDiscoveryNote" note="Idea 54043">
      <Kv k="Result" v={v.documentedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function LanguageLocaleDetection() {
  const data = [{ target: 'shop.example.com', htmlLang: 'en-US', textHints: ['hello'] }, { target: 'boutique.example.com', htmlLang: 'fr-FR', textHints: ['bonjour'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.detectLanguageLocale(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="LanguageLocaleDetection" note="Idea 54044">
      <Kv k="Result" v={v.agreedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function JsBundleInventoryPreview() {
  const data = [{ target: 'shop.example.com', bundles: [{ name: 'app.js', sizeKb: 320 }, { name: 'vendor.js', sizeKb: 260 }] }, { target: 'blog.example.com', bundles: [{ name: 'main.js', sizeKb: 90 }] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.countJsBundleInventory(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="JsBundleInventoryPreview" note="Idea 54045">
      <Kv k="Result" v={v.heavyCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function FormCountPreview() {
  const data = [{ target: 'shop.example.com', forms: [{ action: '/checkout', inputs: 6, uploads: 1 }, { action: '/search', inputs: 1, uploads: 0 }] }, { target: 'static.example.com', forms: [] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.countFormInputs(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="FormCountPreview" note="Idea 54046">
      <Kv k="Result" v={v.uploadCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function PortPreScanLite() {
  const data = [{ host: 'shop.example.com', openPorts: [80, 443, 8080] }, { host: 'quiet.example.com', openPorts: [22] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.evaluateTopPortsPreScan(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="PortPreScanLite" note="Idea 54047">
      <Kv k="Result" v={v.promisingCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function OnboardingProgressApi() {
  const data = [{ targetId: 't-1', stepsDone: 5, stepsTotal: 5, blocked: false }, { targetId: 't-2', stepsDone: 2, stepsTotal: 6, blocked: true }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.buildOnboardingProgressPayload(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="OnboardingProgressApi" note="Idea 54048">
      <Kv k="Result" v={v.completeCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function WelcomeTourPerTargetType() {
  const data = [{ targetType: 'web' }, { targetType: 'api' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.buildWelcomeTourSteps(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="WelcomeTourPerTargetType" note="Idea 54049">
      <Kv k="Result" v={v.tailoredCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function AttestationCheckbox() {
  const data = [{ target: 'shop.example.com', confirmed: true, attestedAt: '2026-10-09T10:00:00Z' }, { target: 'blog.example.com', confirmed: false, attestedAt: '' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.buildAttestationRecord(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="AttestationCheckbox" note="Idea 54050">
      <Kv k="Result" v={v.validCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function NotesPromptAtAdd() {
  const data = [{ target: 'api.example.com', huntStyle: 'api' }, { target: 'shop.example.com', huntStyle: 'standard' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.buildFirstNotePrompt(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="NotesPromptAtAdd" note="Idea 54051">
      <Kv k="Result" v={v.tailoredCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function ScreenshotGallerySeed() {
  const data = [{ target: 'shop.example.com', pages: ['/', '/login', '/pricing', '/dashboard'] }, { target: 'blog.example.com', pages: ['/'] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.planScreenshotGallerySeed(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="ScreenshotGallerySeed" note="Idea 54052">
      <Kv k="Result" v={v.richCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function CanonicalAliasConfirmation() {
  const data = [{ host: 'www.shop.example.com' }, { host: 'example.com' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.resolveCanonicalAliases(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="CanonicalAliasConfirmation" note="Idea 54053">
      <Kv k="Result" v={v.confirmedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function OnboardingCompletionWebhook() {
  const data = [{ targetId: 't-1', completed: true, completedAt: '2026-10-09T10:00:00Z' }, { targetId: 't-2', completed: false, completedAt: '' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.buildOnboardingCompletionWebhook(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="OnboardingCompletionWebhook" note="Idea 54054">
      <Kv k="Result" v={v.readyCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function DualPaneScopeEditor() {
  const data = [{ target: 'shop', inScope: ['a.example.com', 'b.example.com'], exclusions: ['b.example.com'] }, { target: 'blog', inScope: ['c.example.com'], exclusions: [] }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.buildDualPaneScopeEditor(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="DualPaneScopeEditor" note="Idea 54055">
      <Kv k="Result" v={v.cleanCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function WildcardSyntaxSupport() {
  const data = [{ pattern: '*.example.com', hostname: 'api.example.com' }, { pattern: '*.example.com', hostname: 'example.com' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.matchWildcardPattern(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="WildcardSyntaxSupport" note="Idea 54056">
      <Kv k="Result" v={v.matchedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function RegexScopeRules() {
  const data = [ { pattern: '^api\\.example\\.com$', hostname: 'api.example.com' }, { pattern: '^web\\.example\\.com$', hostname: 'api.example.com' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.buildRegexScopeRule(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="RegexScopeRules" note="Idea 54057">
      <Kv k="Result" v={v.matchedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function CidrRangeScoping() {
  const data = [{ cidr: '10.0.0.0/24', ip: '10.0.0.42', peerCidr: '10.0.0.128/25' }, { cidr: '10.0.0.0/24', ip: '10.0.1.42', peerCidr: '' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.checkCidrContainment(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="CidrRangeScoping" note="Idea 54058">
      <Kv k="Result" v={v.insideCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function PortLevelScoping() {
  const data = [{ portSpec: '80,443,8000-9000', port: 8443 }, { portSpec: '80,443', port: 22 }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.matchPortRangeScope(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="PortLevelScoping" note="Idea 54059">
      <Kv k="Result" v={v.matchedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}
export function PathPrefixScoping() {
  const data = [{ pathPrefix: '/v1', urlPath: '/v1/users' }, { pathPrefix: '/v1', urlPath: '/v2/users' }];
  const [showAll, setShowAll] = useState(true);
  const v = X102A.matchPathPrefixScope(data);
  const rows = showAll ? v.rows : v.rows.slice(0, 1);
  return (
    <Card title="PathPrefixScoping" note="Idea 54060">
      <Kv k="Result" v={v.matchedCount} />
      <button type="button" onClick={() => setShowAll(f => !f)}>{showAll ? 'Show first only' : 'Show all rows'}</button>
      {rows.map(r => <Kv key={r.key} k={r.key} v={r.status} />)}
    </Card>
  );
}

export const WAVE102_A_COMPONENTS = [WhoisPreview, CertificatePreview, RateLimitDiscoveryNote, LanguageLocaleDetection, JsBundleInventoryPreview, FormCountPreview, PortPreScanLite, OnboardingProgressApi, WelcomeTourPerTargetType, AttestationCheckbox, NotesPromptAtAdd, ScreenshotGallerySeed, CanonicalAliasConfirmation, OnboardingCompletionWebhook, DualPaneScopeEditor, WildcardSyntaxSupport, RegexScopeRules, CidrRangeScoping, PortLevelScoping, PathPrefixScoping];

export function Wave102AGallery() {
  return (
    <div className="w102a-gallery">
      {WAVE102_A_COMPONENTS.map((C, i) => (<C key={i} />))}
      <div className="w102a-row"><Badge tone="info">Infinity AI</Badge></div>
    </div>
  );
}
