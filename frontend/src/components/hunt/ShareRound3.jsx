/**
 * ShareRound3.jsx — Infinity AI · Dark-Matter · Wave 58
 * 19 working React components for post-hunt sharing round 3, ideas 52281–52299.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as S from './shareRound3Core.js';

const SAMPLE_HUNT = {
  id: 'hunt-58', target: 'shop.example.com',
  findings: [
    {
      id: 'f-581', title: 'Stored XSS in reviews', severity: 'high', status: 'open',
      vulnClass: 'xss', endpoint: 'https://shop.example.com/reviews',
      description: 'Review body rendered without encoding.',
      evidence: [{ kind: 'http', summary: 'POST /reviews' }],
      poc: 'curl -d "body=<script>" https://shop.example.com/reviews',
      impact: 'Session theft on victim browsers.', remediation: 'Encode review output.',
    },
    {
      id: 'f-582', title: 'IDOR on /orders/:id', severity: 'critical', status: 'open',
      vulnClass: 'idor', endpoint: 'https://shop.example.com/orders/123',
      description: 'Order IDs enumerable across accounts.',
      impact: 'Other customers orders visible.',
    },
    {
      id: 'f-583', title: 'Missing CSP header', severity: 'low', status: 'fixed',
      vulnClass: 'config', endpoint: 'https://shop.example.com/',
      description: 'No Content-Security-Policy header.',
    },
  ],
};

const NOW = 1700000000000;

function Note({ children }) {
  return <p className="sr358-note">{children}</p>;
}

/* 52281 — Bounty collaborator sharing with collaboration-agreement scope model. */
export function CollabAgreements() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52281 · Collaboration agreements</h3>
      <button className="sr358-btn" onClick={() => {
        const agr = S.createCollabAgreement({
          huntId: SAMPLE_HUNT.id, scope: 'findings-triage',
          parties: [{ email: 'owner@example.com' }, { email: 'partner@example.com' }],
          allowedSeverities: ['critical', 'high'],
        }, NOW).agreement;
        const a1 = S.acceptAgreement(agr, 'owner@example.com', NOW).agreement;
        const a2 = S.acceptAgreement(a1, 'partner@example.com', NOW + 1);
        setRes({ a2, scope: S.checkAgreementScope(a2.agreement, SAMPLE_HUNT.findings[2]) });
      }}>Draft + both accept</button>
      {res && <Note>status {res.a2.agreement.status} · all accepted: {String(res.a2.allAccepted)} · low finding in scope: {String(res.scope.allowed)} ({res.scope.reason})</Note>}
    </div>
  );
}

/* 52282 — Multi-team hunt sharing with per-team filtered views + comment spaces. */
export function MultiTeamSharing() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52282 · Multi-team sharing</h3>
      <button className="sr358-btn" onClick={() => setRes(S.shareToTeams(SAMPLE_HUNT, [
        { teamId: 'red', teamName: 'Red team', minSeverity: 'high' },
        { teamId: 'blue', teamName: 'Blue team' },
      ], NOW))}>Share to 2 teams</button>
      {res && res.ok && <Note>{res.share.teams.map((t) => `${t.teamName}: ${t.view.findingIds.length} findings · space ${t.commentSpace.id}`).join(' · ')}</Note>}
    </div>
  );
}

/* 52283 — Share notification center with accept/decline reducer. */
export function ShareNotificationCenter() {
  const [state, setState] = useState([]);
  const add = () => {
    const n = S.createNotification({ to: 'dev@example.com', type: 'share-invite', from: 'aria', refId: 'hunt-58' }, NOW + state.length).notification;
    setState(S.notificationReducer(state, { type: 'NOTIF_ADD', notification: n }));
  };
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52283 · Share notification center</h3>
      <button className="sr358-btn" onClick={add}>Add invite</button>
      <ul className="sr358-list">
        {state.map((n) => (
          <li key={n.id}>
            <span className="sr358-mono">{n.type} → {n.to} [{n.status}]</span>{' '}
            <button className="sr358-chip" onClick={() => setState(S.notificationReducer(state, { type: 'NOTIF_ACCEPT', id: n.id }))}>accept</button>{' '}
            <button className="sr358-chip" onClick={() => setState(S.notificationReducer(state, { type: 'NOTIF_DECLINE', id: n.id }))}>decline</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52284 — Link preview card payloads (title, severity counts, risk score). */
export function LinkPreviewCards() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52284 · Link preview cards</h3>
      <button className="sr358-btn" onClick={() => setRes(S.buildLinkPreview(SAMPLE_HUNT, { token: 'tok-1', expiresAt: NOW + 3600000 }, NOW))}>Build preview</button>
      {res && res.ok && <Note>{res.preview.title} · {res.preview.total} findings · risk {res.preview.riskScore}/100 · {JSON.stringify(res.preview.severityCounts)}</Note>}
    </div>
  );
}

/* 52285 — Notion/Confluence live-embed descriptors. */
export function LiveEmbeds() {
  const [target, setTarget] = useState('notion');
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52285 · Notion/Confluence live embeds</h3>
      <div className="sr358-row">
        {S.EMBED_TARGETS.map((t) => <button key={t} className="sr358-chip" onClick={() => { setTarget(t); setRes(S.buildLiveEmbed(SAMPLE_HUNT, t, { baseUrl: 'https://app.example.com' }, NOW)); }}>{t}</button>)}
      </div>
      {res && res.ok && <Note>{res.embed.target}: {res.embed.kind} · refresh every {res.embed.refreshIntervalSec}s · {res.embed.instructions}</Note>}
    </div>
  );
}

/* 52286 — Shared digest email composer. */
export function SharedDigestComposer() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52286 · Shared digest composer</h3>
      <button className="sr358-btn" onClick={() => setRes(S.composeDigest(SAMPLE_HUNT, { to: 'cto@example.com', topN: 2 }, NOW))}>Compose digest</button>
      {res && res.ok && <Note>{res.digest.subject}{'\n'}{res.digest.topFindings.map((f) => f.title).join(' · ')}</Note>}
    </div>
  );
}

/* 52287 — Mobile-friendly shared-view spec. */
export function MobileSharedView() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52287 · Mobile shared-view spec</h3>
      <button className="sr358-btn" onClick={() => setRes(S.buildMobileViewSpec({ findings: ['f-581'] }, { charts: 'compact' }))}>Build spec</button>
      {res && res.ok && <Note>viewport {res.spec.viewport} · stacked cards: {String(res.spec.cardsStacked)} · touch targets ≥ {res.spec.touchTargetsMinPx}px · comments via {res.spec.commentInput}</Note>}
    </div>
  );
}

/* 52288 — Link expiry extension without regeneration. */
export function LinkExpiryExtension() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52288 · Link expiry extension</h3>
      <button className="sr358-btn" onClick={() => {
        const link = { token: 'tok-88', expiresAt: NOW + 3600000, revoked: false };
        setRes(S.extendLinkExpiry(link, 24 * 3600000, NOW));
      }}>Extend +24h</button>
      {res && res.ok && <Note>token unchanged: {String(res.tokenUnchanged)} · new expiry {new Date(res.link.expiresAt).toISOString()}</Note>}
    </div>
  );
}

/* 52289 — Share approval workflow state machine. */
export function ShareApprovalWorkflow() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52289 · Share approval workflow</h3>
      <button className="sr358-btn" onClick={() => {
        const req = S.createApprovalRequest({ huntId: SAMPLE_HUNT.id, requestedBy: 'aria', owner: 'bhavesh', reason: 'client share' }, NOW).request;
        const ok = S.approvalReducer(req, { type: 'APPROVE', by: 'bhavesh' }, NOW + 1000);
        const bad = S.approvalReducer(ok.request, { type: 'APPROVE' }, NOW + 2000);
        setRes({ ok, bad });
      }}>Approve then re-approve</button>
      {res && <Note>state: {res.ok.request.state} · re-approve blocked: {res.bad.reason}</Note>}
    </div>
  );
}

/* 52290 — Delegated sharing rights grants. */
export function DelegatedSharingRights() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52290 · Delegated sharing rights</h3>
      <button className="sr358-btn" onClick={() => {
        const g = S.grantDelegatedShare({ grantor: 'bhavesh', grantee: 'aria', actions: ['share-view', 'share-comment'], expiresAt: NOW + 86400000, huntIds: ['hunt-58'] }, NOW).grant;
        setRes({ view: S.canDelegateShare(g, 'share-view', 'hunt-58', NOW), manage: S.canDelegateShare(g, 'share-manage', 'hunt-58', NOW) });
      }}>Grant + check</button>
      {res && <Note>share-view allowed: {String(res.view.allowed)} · share-manage allowed: {String(res.manage.allowed)} ({res.manage.reason})</Note>}
    </div>
  );
}

/* 52291 — Share-link usage quotas evaluator. */
export function ShareLinkQuotas() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52291 · Share-link usage quotas</h3>
      <button className="sr358-btn" onClick={() => {
        const link = { token: 'tok-91', quota: { maxOpens: 5, maxOpensPerDay: 3 } };
        setRes({
          ok1: S.evaluateQuota(link, { opens: 2, dailyOpens: { '2023-11-14': 1 } }, NOW),
          ok2: S.evaluateQuota(link, { opens: 5 }, NOW),
        });
      }}>Evaluate quotas</button>
      {res && <Note>2/5 opens: allowed {String(res.ok1.allowed)} · remaining {res.ok1.remaining} · 5/5 opens: {res.ok2.reason}</Note>}
    </div>
  );
}

/* 52292 — Custom link slugs validator/generator. */
export function CustomLinkSlugs() {
  const [slug, setSlug] = useState('q3-hunt-results');
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52292 · Custom link slugs</h3>
      <div className="sr358-row">
        {['q3-hunt-results', 'Bad Slug!!', 'admin'].map((s) => (
          <button key={s} className="sr358-chip" onClick={() => { setSlug(s); setRes(S.validateSlug(s)); }}>{s}</button>
        ))}
      </div>
      {res && <Note>{slug}: {res.ok ? 'valid' : `invalid — ${res.reason}`}</Note>}
      <button className="sr358-btn" onClick={() => { const g = S.generateSlug('Q3 hunt results!', ['q3-hunt-results'], NOW); setSlug(g.slug || ''); setRes(g); }}>Generate unique</button>
    </div>
  );
}

/* 52293 — Branded share pages descriptor (logo/colors). */
export function BrandedSharePages() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52293 · Branded share pages</h3>
      <button className="sr358-btn" onClick={() => setRes(S.buildBrandedPage({ name: 'Acme Corp', primaryColor: '#e11d48' }))}>Build brand</button>
      {res && res.ok && <Note>{res.page.brand.name} · primary {res.page.brand.primaryColor} · badge: {String(res.page.showInfinityBadge)} · footer: {res.page.brand.footerText}</Note>}
    </div>
  );
}

/* 52294 — Shared team dashboard aggregator payload. */
export function SharedTeamDashboard() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52294 · Shared team dashboard</h3>
      <button className="sr358-btn" onClick={() => {
        const share = S.shareToTeams(SAMPLE_HUNT, [{ teamId: 'red' }, { teamId: 'blue', minSeverity: 'high' }], NOW).share;
        setRes(S.aggregateTeamDashboard([share, share], NOW));
      }}>Aggregate 2 shares</button>
      {res && res.ok && <Note>{res.dashboard.totals.hunts} hunts · {res.dashboard.totals.teams} teams · {res.dashboard.totals.findingsShared} findings shared</Note>}
    </div>
  );
}

/* 52295 — Share-finding-to-chat payload builder. */
export function ShareFindingToChat() {
  const [channel, setChannel] = useState('slack');
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52295 · Share finding to chat</h3>
      <div className="sr358-row">
        {S.CHAT_CHANNELS.map((c) => (
          <button key={c} className="sr358-chip" onClick={() => { setChannel(c); setRes(S.buildChatSharePayload(SAMPLE_HUNT.findings[0], c, 'https://app.example.com/s/f/abc', NOW)); }}>{c}</button>
        ))}
      </div>
      {res && res.ok && <Note>{res.channel} payload built · sentAt {new Date(res.payload.sentAt).toISOString()}</Note>}
    </div>
  );
}

/* 52296 — Granular finding-field permission evaluator (role × field). */
export function FindingFieldPermissions() {
  const [role, setRole] = useState('commenter');
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52296 · Finding-field permissions</h3>
      <div className="sr358-row">
        {S.FIELD_ROLES.map((r) => <button key={r} className="sr358-chip" onClick={() => setRole(r)}>{r}</button>)}
      </div>
      <Note>{role}: visible fields — {S.visibleFields(role).fields.join(', ')}</Note>
      <Note>poc allowed: {String(S.checkFieldAccess(role, 'poc').allowed)} · evidence allowed: {String(S.checkFieldAccess(role, 'evidence').allowed)}</Note>
    </div>
  );
}

/* 52297 — Share-link two-factor email-code gate. */
export function ShareLinkTwoFactorGate() {
  const [gate, setGate] = useState(null);
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52297 · Share-link two-factor email gate</h3>
      <button className="sr358-btn" onClick={() => setGate(S.issueEmailCode({ token: 'tok-97' }, 'dev@example.com', NOW).gate)}>Issue code</button>
      {gate && <Note>code sent to {gate.email} (demo shows {gate.code})</Note>}
      {gate && <div className="sr358-row">
        <button className="sr358-chip" onClick={() => setRes(S.verifyEmailCode(gate, gate.code, NOW + 1000))}>correct code</button>
        <button className="sr358-chip" onClick={() => setRes(S.verifyEmailCode(gate, '000000', NOW + 1000))}>wrong code</button>
      </div>}
      {res && <Note>verified: {String(res.verified)} {res.reason ? `(${res.reason})` : ''}</Note>}
    </div>
  );
}

/* 52298 — Shared-view print-mode spec. */
export function SharedViewPrintMode() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52298 · Shared-view print mode</h3>
      <button className="sr358-btn" onClick={() => setRes(S.buildPrintSpec({ findings: ['f-581'] }, { orientation: 'landscape' }))}>Build print spec</button>
      {res && res.ok && <Note>{res.spec.page.size} {res.spec.page.orientation} · evidence bodies printed: {String(res.spec.include.evidenceBodies)} · page numbers: {String(res.spec.footer.pageNumbers)}</Note>}
    </div>
  );
}

/* 52299 — Share access request flow with owner approval routing. */
export function ShareAccessRequests() {
  const [res, setRes] = useState(null);
  return (
    <div className="sr358-card">
      <h3 className="sr358-title">52299 · Share access requests</h3>
      <button className="sr358-btn" onClick={() => {
        const req = S.requestAccess({ huntId: SAMPLE_HUNT.id, requester: 'client@example.com', owner: 'bhavesh', role: 'viewer' }, NOW).request;
        const routed = S.accessRequestReducer(req, { type: 'ROUTE' }, NOW + 1000).request;
        setRes(S.accessRequestReducer(routed, { type: 'APPROVE', by: 'bhavesh' }, NOW + 2000));
      }}>Request → route → approve</button>
      {res && res.ok && <Note>final state: {res.request.state} · decided by {res.request.decidedBy} · routed to owner: {res.request.routedTo}</Note>}
    </div>
  );
}

export const SR3_GALLERY = [
  CollabAgreements, MultiTeamSharing, ShareNotificationCenter, LinkPreviewCards,
  LiveEmbeds, SharedDigestComposer, MobileSharedView, LinkExpiryExtension,
  ShareApprovalWorkflow, DelegatedSharingRights, ShareLinkQuotas, CustomLinkSlugs,
  BrandedSharePages, SharedTeamDashboard, ShareFindingToChat, FindingFieldPermissions,
  ShareLinkTwoFactorGate, SharedViewPrintMode, ShareAccessRequests,
];

export function ShareRound3Gallery() {
  return (
    <div className="sr358-gallery">
      {SR3_GALLERY.map((C, i) => <C key={i} />)}
    </div>
  );
}
