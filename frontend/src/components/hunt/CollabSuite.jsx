/**
 * CollabSuite.jsx — Infinity AI · Dark-Matter · Wave 57
 * 20 working React components for post-hunt collaboration, ideas 52261–52280.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as C from './collabCore.js';
import * as S from './shareCore.js';

const SAMPLE_HUNT = {
  id: 'hunt-57', target: 'shop.example.com',
  findings: [
    { id: 'f-571', title: 'Stored XSS in reviews', severity: 'high', status: 'open', description: 'Review body rendered raw.', cwe: 'CWE-79', target: 'shop' },
    { id: 'f-572', title: 'IDOR on /orders/:id', severity: 'critical', status: 'open', description: 'Enumerable order IDs.', cwe: 'CWE-639', target: 'shop' },
    { id: 'f-573', title: 'Missing security headers', severity: 'low', status: 'fixed', description: 'No CSP.', cwe: null, target: 'shop' },
  ],
};

const NOW = 1700000000000;

function Note({ children }) {
  return <p className="cb57-note">{children}</p>;
}

/* 52261 — @mention notifications. */
export function MentionNotifications() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52261 · @mention notifications</h3>
      <button className="cb57-btn" onClick={() => {
        const mentions = C.parseMentions('Hey @ria and @dev, please retest f-571. cc @ria');
        setRes(C.buildMentionNotifications(mentions, { author: 'aria', huntId: SAMPLE_HUNT.id, snippet: 'please retest', prefs: { ria: 'slack' } }, NOW));
      }}>Parse + notify</button>
      {res && res.ok && <Note>{res.notifications.length} unique mention(s): {res.notifications.map((n) => `${n.to} via ${n.channel}`).join(', ')}</Note>}
    </div>
  );
}

/* 52262 — Shared-view activity feed. */
export function SharedViewActivityFeed() {
  const [feed, setFeed] = useState([]);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52262 · Shared-view activity feed</h3>
      <button className="cb57-btn" onClick={() => {
        let f = C.feedReducer([], { type: 'ADD_EVENT', event: { kind: 'view', by: 'dev', at: NOW } });
        f = C.feedReducer(f, { type: 'ADD_EVENT', event: { kind: 'comment', by: 'ria', at: NOW + 5000 } });
        f = C.feedReducer(f, { type: 'ADD_EVENT', event: { kind: 'triage', by: 'ops', at: NOW + 2000 } });
        setFeed(f);
      }}>Seed feed</button>
      <Note>{feed.map((e) => `${e.kind}@${e.at}`).join(' → ') || 'empty (newest first)'}</Note>
    </div>
  );
}

/* 52263 — Share analytics. */
export function ShareAnalytics() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52263 · Share analytics</h3>
      <button className="cb57-btn" onClick={() => setRes(C.computeShareAnalytics([
        { viewer: 'a@x.com', at: NOW, findingId: 'f-571' },
        { viewer: 'a@x.com', at: NOW + 1, findingId: 'f-572' },
        { viewer: 'b@x.com', at: NOW + 2, findingId: 'f-571' },
      ]))}>Compute</button>
      {res && <Note>{res.opens} opens · {res.uniqueViewers} unique · top: {res.mostViewedFindings.map((m) => `${m.findingId}×${m.opens}`).join(', ')}</Note>}
    </div>
  );
}

/* 52264 — One-click copy link. */
export function OneClickCopyLink() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52264 · One-click copy link</h3>
      <button className="cb57-btn" onClick={() => {
        const base = S.createExpiringLink(SAMPLE_HUNT, { ttlMs: 86400000 }, NOW).link;
        const gated = S.setLinkPassword(base, 'digest-1').link;
        setRes(C.buildCopyLinkPayload(gated, 'https://app.example.com'));
      }}>Build copy payload</button>
      {res && res.ok && <Note>{res.payload.summary}</Note>}
    </div>
  );
}

/* 52265 — QR code for share links. */
export function QrShareLinks() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52265 · QR code for share links</h3>
      <button className="cb57-btn" onClick={() => setRes(C.buildQrDescriptor('https://app.example.com/s/h/tok123', { size: 256 }))}>Build QR descriptor</button>
      {res && res.ok && <Note>qr value len {res.qr.value.length} · {res.qr.size}px · {res.qr.label}</Note>}
    </div>
  );
}

/* 52266 — Share via email composer. */
export function ShareEmailComposer() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52266 · Share via email composer</h3>
      <button className="cb57-btn" onClick={() => setRes(C.buildEmailComposer(SAMPLE_HUNT, { to: 'cto@acme.com', linkUrl: 'https://app.example.com/s/h/x', attachPdf: true }, NOW))}>Compose</button>
      {res && res.ok && <Note>to {res.composer.to} · attachments: {res.composer.attachments.length} · subject: {res.composer.subject}</Note>}
    </div>
  );
}

/* 52267 — Role templates. */
export function RoleTemplates() {
  const [tpl, setTpl] = useState('Reviewer');
  const r = C.applyRoleTemplate(tpl);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52267 · Role templates</h3>
      <div className="cb57-row">
        {Object.keys(C.ROLE_TEMPLATES).map((t) => <button key={t} className="cb57-chip" onClick={() => setTpl(t)}>{t}</button>)}
      </div>
      {r.ok && <Note>{r.template}: {Object.entries(r.permissions).filter(([, v]) => v).map(([k]) => k).join(', ')}</Note>}
    </div>
  );
}

/* 52268 — Time-boxed guest access. */
export function TimeBoxedGuestAccess() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52268 · Time-boxed guest access</h3>
      <button className="cb57-btn" onClick={() => {
        const g = C.grantGuestAccess(SAMPLE_HUNT.id, 'auditor@external.com', NOW + 86400000, NOW).grant;
        setRes({ active: C.isGuestGrantActive(g, NOW + 1000).active, expired: C.isGuestGrantActive(g, NOW + 90000000).active });
      }}>Grant 24h</button>
      {res && <Note>active now: {String(res.active)} · active after expiry: {String(res.expired)}</Note>}
    </div>
  );
}

/* 52269 — IP-restricted share links. */
export function IpRestrictedLinks() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52269 · IP-restricted share links</h3>
      <button className="cb57-btn" onClick={() => {
        const link = S.createExpiringLink(SAMPLE_HUNT, {}, NOW).link;
        const restricted = C.restrictLinkToIps(link, ['10.0.0.0/8']).link;
        setRes({
          corp: C.checkIpAllowed(restricted, '10.1.2.3'),
          ext: C.checkIpAllowed(restricted, '8.8.8.8'),
        });
      }}>Check 10.1.2.3 vs 8.8.8.8</button>
      {res && <Note>corp: {res.corp.reason} · external: {res.ext.reason}</Note>}
    </div>
  );
}

/* 52270 — Comparison-view sharing. */
export function ComparisonViewSharing() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52270 · Comparison-view sharing</h3>
      <button className="cb57-btn" onClick={() => setRes(C.buildComparisonShare(
        { id: 'run-a', findings: SAMPLE_HUNT.findings },
        { id: 'run-b', findings: [SAMPLE_HUNT.findings[0], { id: 'f-574', title: 'New SSRF', severity: 'high' }] },
        'https://app.example.com', NOW
      ))}>Build comparison share</button>
      {res && res.ok && <Note>new: {res.share.delta.newFindings.join(',') || 'none'} · fixed: {res.share.delta.fixedFindings.join(',') || 'none'} · carried: {res.share.delta.carriedOver}</Note>}
    </div>
  );
}

/* 52271 — Remediation-board sharing. */
export function RemediationBoardSharing() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52271 · Remediation-board sharing</h3>
      <button className="cb57-btn" onClick={() => setRes(C.buildRemediationBoardShare({
        id: 'board-1', title: 'Q3 fixes',
        columns: [
          { name: 'To fix', cards: [{ id: 'c1', title: 'XSS in reviews', assignee: 'dev' }] },
          { name: 'Done', cards: [{ id: 'c2', title: 'CSP headers', assignee: 'ops' }] },
        ],
      }))}>Share board</button>
      {res && res.ok && <Note>{res.share.title}: {res.share.columns.map((c) => `${c.name}(${c.cards.length})`).join(' · ')} · finding detail excluded</Note>}
    </div>
  );
}

/* 52272 — Live shared triage sessions. */
export function LiveTriageSessions() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52272 · Live shared triage sessions</h3>
      <button className="cb57-btn" onClick={() => {
        let s = C.createTriageSession(SAMPLE_HUNT.id, ['ria'], NOW).session;
        s = C.joinTriageSession(s, 'dev', NOW + 1000).session;
        s = C.leaveTriageSession(s, 'ria').session;
        setRes(s);
      }}>Session join/leave</button>
      {res && <Note>live: {String(res.live)} · participants: {res.participants.map((p) => p.handle).join(', ') || 'none'}</Note>}
    </div>
  );
}

/* 52273 — Presence indicators. */
export function PresenceIndicators() {
  const [viewers, setViewers] = useState([]);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52273 · Presence indicators</h3>
      <button className="cb57-btn" onClick={() => {
        let v = C.presenceReducer([], { type: 'JOIN', handle: 'ria' }, NOW);
        v = C.presenceReducer(v, { type: 'JOIN', handle: 'dev' }, NOW + 1000);
        v = C.presenceReducer(v, { type: 'LEAVE', handle: 'ria' }, NOW + 2000);
        setViewers(v);
      }}>Simulate presence</button>
      <Note>viewing now: {viewers.map((v) => v.handle).join(', ') || 'nobody'}</Note>
    </div>
  );
}

/* 52274 — Shared saved filters. */
export function SharedSavedFilters() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52274 · Shared saved filters</h3>
      <button className="cb57-btn" onClick={() => {
        const r = C.publishSavedFilter([], { name: 'Open criticals', filters: { severity: 'critical', status: 'open' }, publishedBy: 'ria' }, NOW).library;
        setRes(C.listPublishedFilters(r));
      }}>Publish filter</button>
      {res && <Note>{res.length} published: {res.map((f) => f.name).join(', ')}</Note>}
    </div>
  );
}

/* 52275 — Shared FP rule library. */
export function SharedFpRuleLibrary() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52275 · Shared FP rule library</h3>
      <button className="cb57-btn" onClick={() => {
        const r = C.addFpRule([], { pattern: 'scanner-user-agent', owner: 'ria', reviewInDays: 0 }, NOW - 1000).library;
        setRes({ added: r.length, due: C.dueFpRules(r, NOW).length });
      }}>Add rule due now</button>
      {res && <Note>{res.added} rule(s) · due for review: {res.due}</Note>}
    </div>
  );
}

/* 52276 — Shared hunt templates. */
export function SharedHuntTemplates() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52276 · Shared hunt templates</h3>
      <button className="cb57-btn" onClick={() => {
        const t = C.publishHuntTemplate({ name: 'Shop quick pass', config: { depth: 'quick', techniques: ['xss', 'sqli'] }, publishedBy: 'aria' }, NOW).template;
        setRes(C.instantiateTemplate(t, 'shop2.example.com'));
      }}>Publish + instantiate</button>
      {res && res.ok && <Note>target {res.hunt.target} · template {res.hunt.templateId} · techniques: {res.hunt.config.techniques.join(', ')}</Note>}
    </div>
  );
}

/* 52277 — Share to Jira/Asana/Linear. */
export function ShareToTickets() {
  const [sys, setSys] = useState('jira');
  const r = C.buildTicketPayload(SAMPLE_HUNT.findings[0], sys, 'https://app.example.com');
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52277 · Share to Jira/Asana/Linear</h3>
      <div className="cb57-row">
        {['jira', 'asana', 'linear'].map((s) => <button key={s} className="cb57-chip" onClick={() => setSys(s)}>{s}</button>)}
      </div>
      {r.ok && <Note>{r.ticket.system}: {r.ticket.title}</Note>}
    </div>
  );
}

/* 52278 — Share manifest export. */
export function ShareManifestExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52278 · Share manifest export</h3>
      <button className="cb57-btn" onClick={() => setRes(C.buildShareManifest([
        { token: 'sh_1', withWhom: 'dev@acme.com', when: NOW, role: 'viewer' },
        { token: 'sh_2', withWhom: 'cto@acme.com', when: NOW + 1000, role: 'commenter' },
      ], NOW + 2000))}>Export manifest</button>
      {res && res.ok && <Note>{res.manifest.entries.length} entries · exported {new Date(res.manifest.exportedAt).toISOString()}</Note>}
    </div>
  );
}

/* 52279 — Per-viewer watermarking. */
export function PerViewerWatermarking() {
  const [res, setRes] = useState(null);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52279 · Per-viewer watermarking</h3>
      <button className="cb57-btn" onClick={() => setRes(C.buildWatermark('dev@acme.com'))}>Build watermark</button>
      {res && res.ok && <Note>text "{res.watermark.text}" · opacity {res.watermark.opacity} · {res.watermark.position}</Note>}
    </div>
  );
}

/* 52280 — Screenshot-deterrence notice. */
export function ScreenshotDeterrenceNotice() {
  const [level, setLevel] = useState('standard');
  const r = C.screenshotNotice(level);
  return (
    <div className="cb57-card">
      <h3 className="cb57-title">52280 · Screenshot-deterrence notice</h3>
      <div className="cb57-row">
        <button className="cb57-chip" onClick={() => setLevel('standard')}>standard</button>
        <button className="cb57-chip" onClick={() => setLevel('strict')}>strict</button>
      </div>
      {r.ok && <div className="cb57-banner">{r.notice.text}</div>}
    </div>
  );
}

export const COLLAB_GALLERY = [
  MentionNotifications, SharedViewActivityFeed, ShareAnalytics, OneClickCopyLink,
  QrShareLinks, ShareEmailComposer, RoleTemplates, TimeBoxedGuestAccess,
  IpRestrictedLinks, ComparisonViewSharing, RemediationBoardSharing, LiveTriageSessions,
  PresenceIndicators, SharedSavedFilters, SharedFpRuleLibrary, SharedHuntTemplates,
  ShareToTickets, ShareManifestExport, PerViewerWatermarking, ScreenshotDeterrenceNotice,
];

export function CollabGallery() {
  return (
    <div className="cb57-gallery">
      {COLLAB_GALLERY.map((Cpt, i) => <Cpt key={i} />)}
    </div>
  );
}
