/**
 * ShareSuite.jsx — Infinity AI · Dark-Matter · Wave 57
 * 20 working React components for post-hunt sharing, ideas 52241–52260.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as S from './shareCore.js';

const SAMPLE_HUNT = {
  id: 'hunt-57',
  target: 'shop.example.com',
  findings: [
    {
      id: 'f-571',
      title: 'Stored XSS in reviews',
      severity: 'high',
      status: 'open',
      vulnClass: 'xss',
      cwe: 'CWE-79',
      target: 'shop',
      assignee: 'ria',
      confidence: 'high',
      description: 'Review body rendered without encoding. Contact ria@example.com for details.',
      evidence: [{ kind: 'http', summary: 'POST /reviews', body: 'session=abc123' }],
      poc: 'curl -d "body=<script>" https://shop.example.com/reviews',
      pocPython: null,
      remediation: 'Encode review output.',
      impact: 'Session theft on victim browsers.',
      createdAt: 1700000000000,
      updatedAt: 1700000100000,
    },
    {
      id: 'f-572',
      title: 'IDOR on /orders/:id',
      severity: 'critical',
      status: 'open',
      vulnClass: 'idor',
      cwe: 'CWE-639',
      target: 'shop',
      assignee: 'dev',
      confidence: 'high',
      description: 'Order IDs enumerable; api_key=live_9f8e7d exposed in debug header.',
      evidence: [],
      poc: null,
      remediation: 'Authorize per-user.',
      impact: 'Other customers orders visible.',
      createdAt: 1700000200000,
      updatedAt: 1700000300000,
    },
    {
      id: 'f-573',
      title: 'Missing security headers',
      severity: 'low',
      status: 'fixed',
      vulnClass: 'config',
      cwe: null,
      target: 'shop',
      assignee: 'ops',
      confidence: 'medium',
      description: 'No CSP header.',
      evidence: [],
      poc: null,
      remediation: 'Add CSP.',
      createdAt: 1700000400000,
      updatedAt: 1700000500000,
    },
  ],
};

const NOW = 1700000000000;

function Note({ children }) {
  return <p className="sh57-note">{children}</p>;
}

/* 52241 — Expiring share links. */
export function ExpiringShareLinks() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52241 · Expiring share links</h3>
      <button
        className="sh57-btn"
        onClick={() =>
          setRes(S.createExpiringLink(SAMPLE_HUNT, { ttlMs: 3600000, oneTime: true }, NOW))
        }
      >
        Create 1h one-time link
      </button>
      {res && res.ok && (
        <Note>
          token {res.link.token} · expires {new Date(res.link.expiresAt).toISOString()} · one-time:{' '}
          {String(res.link.oneTime)} · {S.evaluateShareLink(res.link, {}, NOW).reason}
        </Note>
      )}
    </div>
  );
}

/* 52242 — Password-protected share links. */
export function PasswordShareLinks() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52242 · Password-protected share links</h3>
      <button
        className="sh57-btn"
        onClick={() => {
          const base = S.createExpiringLink(SAMPLE_HUNT, {}, NOW).link;
          setRes(S.setLinkPassword(base, 'digest-abc123'));
        }}
      >
        Set password gate
      </button>
      {res && res.ok && (
        <Note>
          gate required: {String(res.link.password.required)} · check 'digest-abc123':{' '}
          {S.checkLinkPassword(res.link, 'digest-abc123').reason} · check wrong:{' '}
          {S.checkLinkPassword(res.link, 'nope').reason}
        </Note>
      )}
    </div>
  );
}

/* 52243 — Role-based link permissions. */
export function RoleLinkPermissions() {
  const [role, setRole] = useState('viewer');
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52243 · Role-based link permissions</h3>
      <div className="sh57-row">
        {Object.keys(S.LINK_ROLE_PERMISSIONS).map(r => (
          <button key={r} className="sh57-chip" onClick={() => setRole(r)}>
            {r}
          </button>
        ))}
      </div>
      <Note>
        {role}: view {S.checkRoleAction(role, 'view').allowed ? '✓' : '✗'} · comment{' '}
        {S.checkRoleAction(role, 'comment').allowed ? '✓' : '✗'} · triage{' '}
        {S.checkRoleAction(role, 'triage').allowed ? '✓' : '✗'} · manage{' '}
        {S.checkRoleAction(role, 'manage').allowed ? '✓' : '✗'}
      </Note>
    </div>
  );
}

/* 52244 — Per-finding share links. */
export function PerFindingShareLinks() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52244 · Per-finding share links</h3>
      <button
        className="sh57-btn"
        onClick={() =>
          setRes(
            S.buildFindingLink(
              { ...SAMPLE_HUNT.findings[0], huntId: SAMPLE_HUNT.id },
              'https://app.example.com',
              {},
              NOW
            )
          )
        }
      >
        Link f-571 only
      </button>
      {res && res.ok && <p className="sh57-mono">{res.url}</p>}
    </div>
  );
}

/* 52245 — Team workspaces. */
export function TeamWorkspaces() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52245 · Team workspaces</h3>
      <button
        className="sh57-btn"
        onClick={() => {
          const ws = S.createWorkspace(
            {
              name: 'Acme Q3',
              members: [{ email: 'ria@example.com', role: 'triager' }],
              huntIds: [SAMPLE_HUNT.id],
            },
            NOW
          ).workspace;
          setRes(S.addWorkspaceEvent(ws, { kind: 'hunt-shared', by: 'aria' }, NOW));
        }}
      >
        Create workspace + event
      </button>
      {res && res.ok && (
        <Note>
          {res.workspace.name} · {res.workspace.members.length} member(s) ·{' '}
          {res.workspace.activity.length} activit(ies)
        </Note>
      )}
    </div>
  );
}

/* 52246 — Email invite to results. */
export function EmailInviteResults() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52246 · Email invite to results</h3>
      <button
        className="sh57-btn"
        onClick={() =>
          setRes(
            S.buildEmailInvite(
              'dev@example.com',
              SAMPLE_HUNT,
              'https://app.example.com',
              { role: 'commenter' },
              NOW
            )
          )
        }
      >
        Build invite
      </button>
      {res && res.ok && (
        <Note>
          to {res.invite.to} · role {res.invite.role} · deep link {res.invite.deepLink.slice(0, 60)}
          …
        </Note>
      )}
    </div>
  );
}

/* 52247 — SSO group-synced sharing. */
export function SsoGroupSharing() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52247 · SSO group-synced sharing</h3>
      <button
        className="sh57-btn"
        onClick={() =>
          setRes(
            S.resolveSsoRole(['sec-team', 'all-staff'], {
              'sec-team': 'triager',
              'all-staff': 'viewer',
            })
          )
        }
      >
        Resolve role
      </button>
      {res && res.ok && (
        <Note>
          groups → role: {res.role} (matched: {String(res.matched)})
        </Note>
      )}
    </div>
  );
}

/* 52248 — Share to Slack channel. */
export function ShareToSlack() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52248 · Share to Slack channel</h3>
      <button
        className="sh57-btn"
        onClick={() =>
          setRes(S.buildSlackPayload(SAMPLE_HUNT, 'https://app.example.com/s/h/abc', NOW))
        }
      >
        Build Slack payload
      </button>
      {res && res.ok && (
        <pre className="sh57-mono">
          {res.payload.text}
          {'\n'}
          {res.payload.blocks.length} blocks
        </pre>
      )}
    </div>
  );
}

/* 52249 — Share to Microsoft Teams. */
export function ShareToTeams() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52249 · Share to Microsoft Teams</h3>
      <button
        className="sh57-btn"
        onClick={() =>
          setRes(S.buildTeamsPayload(SAMPLE_HUNT, 'https://app.example.com/s/h/abc', NOW))
        }
      >
        Build Teams card
      </button>
      {res && res.ok && (
        <Note>
          AdaptiveCard v{res.payload.attachments[0].content.version} ·{' '}
          {res.payload.attachments[0].content.body[2].facts.length} severity facts
        </Note>
      )}
    </div>
  );
}

/* 52250 — Share to Discord webhook. */
export function ShareToDiscord() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52250 · Share to Discord webhook</h3>
      <button
        className="sh57-btn"
        onClick={() =>
          setRes(S.buildDiscordPayload(SAMPLE_HUNT, 'https://app.example.com/s/h/abc', NOW))
        }
      >
        Build Discord payload
      </button>
      {res && res.ok && (
        <Note>
          {res.payload.embeds[0].title}: {res.payload.embeds[0].description}
        </Note>
      )}
    </div>
  );
}

/* 52251 — Embeddable results widget. */
export function EmbeddableWidget() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52251 · Embeddable results widget</h3>
      <button
        className="sh57-btn"
        onClick={() =>
          setRes(
            S.buildEmbedWidget(SAMPLE_HUNT, { baseUrl: 'https://app.example.com', token: 'tok123' })
          )
        }
      >
        Build widget
      </button>
      {res && res.ok && <p className="sh57-mono">{res.widget.html.slice(0, 90)}…</p>}
    </div>
  );
}

/* 52252 — Public vs private link toggle. */
export function PublicPrivateToggle() {
  const [vis, setVis] = useState('internal');
  const [warn, setWarn] = useState([]);
  const flip = v => {
    const link = S.createExpiringLink(SAMPLE_HUNT, {}, NOW).link;
    const r = S.setLinkVisibility(link, v);
    setVis(r.link.visibility);
    setWarn(r.warnings);
  };
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52252 · Public vs private link toggle</h3>
      <div className="sh57-row">
        <button className="sh57-chip" onClick={() => flip('internal')}>
          internal
        </button>
        <button className="sh57-chip" onClick={() => flip('public')}>
          public
        </button>
      </div>
      <Note>
        current: {vis}
        {warn.length > 0 && ` · ⚠ ${warn[0]}`}
      </Note>
    </div>
  );
}

/* 52253 — Share-link access logs. */
export function ShareLinkAccessLogs() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52253 · Share-link access logs</h3>
      <button
        className="sh57-btn"
        onClick={() => {
          const link = S.createExpiringLink(SAMPLE_HUNT, {}, NOW).link;
          let r = S.logLinkAccess([], link, { viewer: 'dev@example.com', ip: '10.1.2.3' }, NOW);
          r = S.logLinkAccess(
            r.log,
            link,
            { viewer: 'dev@example.com', ip: '10.1.2.3' },
            NOW + 1000
          );
          r = S.logLinkAccess(
            r.log,
            link,
            { viewer: 'ops@example.com', ip: '10.1.2.9' },
            NOW + 2000
          );
          setRes({ log: r.log, summary: S.summarizeAccessLog(r.log) });
        }}
      >
        Log 3 accesses
      </button>
      {res && (
        <Note>
          {res.summary.opens} opens · {res.summary.uniqueViewers} unique viewers
        </Note>
      )}
    </div>
  );
}

/* 52254 — Instant link revocation. */
export function InstantLinkRevocation() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52254 · Instant link revocation</h3>
      <button
        className="sh57-btn"
        onClick={() => {
          const link = S.createExpiringLink(SAMPLE_HUNT, {}, NOW).link;
          const revoked = S.revokeShareLink(link, { reason: 'leaked in chat' }, NOW + 5000);
          setRes({ revoked, evalAfter: S.evaluateShareLink(revoked.link, {}, NOW + 6000) });
        }}
      >
        Revoke link
      </button>
      {res && (
        <Note>
          revoked: {String(res.revoked.link.revoked)} · evaluate after: {res.evalAfter.reason} ·
          sessions invalidated: {String(res.revoked.sessionsInvalidated)}
        </Note>
      )}
    </div>
  );
}

/* 52255 — Filtered-view sharing. */
export function FilteredViewSharing() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52255 · Filtered-view sharing</h3>
      <button
        className="sh57-btn"
        onClick={() => setRes(S.buildFilteredShareView(SAMPLE_HUNT, { minSeverity: 'high' }))}
      >
        Share only high+
      </button>
      {res && res.ok && (
        <Note>
          {res.view.findings.length} findings · counts: {JSON.stringify(res.view.counts.bySeverity)}
        </Note>
      )}
    </div>
  );
}

/* 52256 — External client portal. */
export function ExternalClientPortal() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52256 · External client portal</h3>
      <button
        className="sh57-btn"
        onClick={() => setRes(S.buildClientPortal(SAMPLE_HUNT, { name: 'Acme Corp' }))}
      >
        Build portal
      </button>
      {res && res.ok && (
        <Note>
          brand {res.portal.brand.name} · nav items: {res.portal.navigation.length} (stripped) ·
          manage: {String(res.portal.permissions.manage)}
        </Note>
      )}
    </div>
  );
}

/* 52257 — NDA-gated share links. */
export function NdaGatedLinks() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52257 · NDA-gated share links</h3>
      <button
        className="sh57-btn"
        onClick={() => {
          const link = S.createExpiringLink(SAMPLE_HUNT, {}, NOW).link;
          const gate = S.ndaGate(link).gate;
          setRes(S.acceptNda(gate, 'client@example.com', NOW + 1000));
        }}
      >
        Accept NDA
      </button>
      {res && res.ok && (
        <Note>
          {res.acceptance.viewer} accepted at {new Date(res.acceptance.acceptedAt).toISOString()}
        </Note>
      )}
    </div>
  );
}

/* 52258 — Summary-only sharing. */
export function SummaryOnlySharing() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52258 · Summary-only sharing</h3>
      <button className="sh57-btn" onClick={() => setRes(S.buildSummaryOnly(SAMPLE_HUNT, NOW))}>
        Build summary
      </button>
      {res && res.ok && (
        <Note>
          {res.summary.total} findings · risk {res.summary.riskScore}/100 · remediation open{' '}
          {res.summary.remediation.open} / fixed {res.summary.remediation.fixed} · details exposed:{' '}
          {res.summary.findingDetails.length}
        </Note>
      )}
    </div>
  );
}

/* 52259 — Redacted sharing mode. */
export function RedactedSharingMode() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52259 · Redacted sharing mode</h3>
      <button
        className="sh57-btn"
        onClick={() => setRes(S.redactForSharing(SAMPLE_HUNT.findings[0]))}
      >
        Redact f-571
      </button>
      {res && res.ok && (
        <Note>
          poc: {String(res.finding.poc)} · evidence body: {res.finding.evidence[0].body} ·
          description: {res.finding.description}
        </Note>
      )}
    </div>
  );
}

/* 52260 — Threaded comments on shared views. */
export function ThreadedComments() {
  const [res, setRes] = useState(null);
  return (
    <div className="sh57-card">
      <h3 className="sh57-title">52260 · Threaded comments on shared views</h3>
      <button
        className="sh57-btn"
        onClick={() => {
          let t = S.createCommentThread({ findingId: 'f-571' }, NOW).thread;
          t = S.addThreadComment(
            t,
            { author: 'ria', body: 'Confirmed on staging.' },
            NOW + 1000
          ).thread;
          const reply = S.addThreadComment(
            t,
            { author: 'dev', body: 'Fix in PR #12.', parentId: t.comments[0].id },
            NOW + 2000
          );
          setRes({
            thread: reply.thread,
            resolved: S.resolveThread(reply.thread, 'ria', NOW + 3000).thread.resolved,
          });
        }}
      >
        Thread + reply + resolve
      </button>
      {res && (
        <Note>
          {res.thread.comments.length} comments · nested:{' '}
          {res.thread.comments.filter(c => c.parentId).length} · resolved: {String(res.resolved)}
        </Note>
      )}
    </div>
  );
}

export const SHARE_GALLERY = [
  ExpiringShareLinks,
  PasswordShareLinks,
  RoleLinkPermissions,
  PerFindingShareLinks,
  TeamWorkspaces,
  EmailInviteResults,
  SsoGroupSharing,
  ShareToSlack,
  ShareToTeams,
  ShareToDiscord,
  EmbeddableWidget,
  PublicPrivateToggle,
  ShareLinkAccessLogs,
  InstantLinkRevocation,
  FilteredViewSharing,
  ExternalClientPortal,
  NdaGatedLinks,
  SummaryOnlySharing,
  RedactedSharingMode,
  ThreadedComments,
];

export function ShareGallery() {
  return (
    <div className="sh57-gallery">
      {SHARE_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
