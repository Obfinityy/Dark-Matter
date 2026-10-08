/**
 * Wave73B.jsx — Infinity AI · Dark-Matter · Wave 73
 * 20 working React components for hunt reopen workflows,
 * ideas 52901–52920. Export-only module: components are not
 * mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as XB from './wave73BCores.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_HUNT = {
  huntId: 'hunt-42',
  target: 'shop.example.com',
  status: 'closed',
  closedAt: '2026-09-20T09:00:00Z',
  createdAt: '2026-09-01T09:00:00Z',
  owner: 'lead-1',
  sensitive: false,
  reopenCount: 1,
  lastReopenedAt: '2026-10-01T09:00:00Z',
  reopenHistory: [{ at: '2026-10-01T09:00:00Z', reason: 'Regression detected in checkout.', category: 'regression' }],
  chapters: [
    { number: 1, kind: 'original', openedAt: '2026-09-01T09:00:00Z', closedAt: '2026-09-20T09:00:00Z', findingCount: 2 },
  ],
  findings: [
    { id: 'f1', title: 'SQLi in checkout', severity: 'critical', target: 'shop.example.com/checkout', engine: 'vuln-scan' },
    { id: 'f3', title: 'IDOR in invoices', severity: 'high', target: 'api.example.com/invoices/1001', engine: 'vuln-scan' },
  ],
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: [] },
  techStack: ['node', 'postgres'],
};

const DEMO_HUNTS = [
  DEMO_HUNT,
  { huntId: 'hunt-43', target: 'api.example.com', status: 'closed', closedAt: '2026-08-15T09:00:00Z', reopenCount: 2, reopenHistory: [{ at: '2026-09-01T09:00:00Z', reason: 'New threat intel matches this stack.', category: 'new-intel' }], findings: [] },
  { huntId: 'hunt-44', target: 'blog.example.com', status: 'open', closedAt: null, reopenCount: 0, reopenHistory: [], findings: [] },
];

function Card({ title, note, children }) {
  return (
    <div className="w73b-card">
      <div className="w73b-title">{title}</div>
      {note ? <div className="w73b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w73b-badge w73b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w73b-kv">
      <span className="w73b-k">{k}</span>
      <span className="w73b-v">{String(v)}</span>
    </div>
  );
}

export function HistoryPreservingReopen() {
  const v = XB.reopenPreservingHistory(DEMO_HUNT, { actor: 'lead-1', reason: 'Regression detected in checkout.' }, { now: NOW });
  return (
    <Card title="History-preserving reopen" note="Idea 52901">
      <Kv k="Chapters" v={v.chapterCount} />
      <Kv k="Current" v={v.currentChapter} />
      <div className="w73b-row"><Badge tone="ok">history preserved</Badge></div>
    </Card>
  );
}

export function ReopenReasonTemplates() {
  const v = XB.listReopenReasonTemplates({ templateId: 'regression', context: { huntId: 'hunt-42', target: 'shop.example.com' } });
  return (
    <Card title="Reopen reason templates" note="Idea 52902">
      <Kv k="Templates" v={v.count} />
      <Kv k="Picked" v={v.applied ? v.applied.label : 'none'} />
      <div className="w73b-note">{v.applied ? v.applied.reason.slice(0, 60) : 'none'}</div>
    </Card>
  );
}

export function ReopenApprovalWorkflow() {
  const v = XB.planReopenApprovalWorkflow(DEMO_HUNT, { id: 'analyst-1', reason: 'Regression detected in checkout.' }, {});
  return (
    <Card title="Reopen approval workflow" note="Idea 52903">
      <Kv k="Steps" v={v.stepCount} />
      <Kv k="Needs approval" v={String(v.requiresApproval)} />
      <Kv k="Pending" v={v.pendingStep || 'none'} />
    </Card>
  );
}

export function BulkReopenPostHunt() {
  const v = XB.bulkReopenHunts(DEMO_HUNTS, { reason: 'Org-wide infra change needs rechecks.' });
  return (
    <Card title="Bulk reopen (post-hunt)" note="Idea 52904">
      <Kv k="Succeeded" v={v.succeeded} />
      <Kv k="Failed" v={v.failed} />
      <Kv k="Total" v={v.total} />
    </Card>
  );
}

export function ReopenApi() {
  const v = XB.buildReopenApiRequest('hunt-42', { reason: 'Regression detected in checkout.', requestedBy: 'lead-1' }, {});
  return (
    <Card title="Reopen API" note="Idea 52905">
      <Kv k="Method" v={v.method} />
      <Kv k="Valid" v={String(v.valid)} />
      <div className="w73b-presig">{v.url.slice(0, 56)}</div>
    </Card>
  );
}

export function ReopenFromEmailLink() {
  const link = 'https://app.infinity-ai.example/hunts/hunt-42/reopen?token=abcdef123456&exp=9999999999';
  const v = XB.parseEmailReopenLink(link, { id: 'lead-1', role: 'lead' }, { now: NOW });
  return (
    <Card title="Reopen from email link" note="Idea 52906">
      <Kv k="Valid" v={String(v.valid)} />
      <Kv k="Hunt" v={v.huntId || 'none'} />
      <div className="w73b-row"><Badge tone={v.valid ? 'ok' : 'warn'}>{v.action}</Badge></div>
    </Card>
  );
}

export function ReopenFromComparisonView() {
  const v = XB.reopenFromComparison({ baseline: { huntId: 'hunt-42' }, candidate: { huntId: 'hunt-50' }, regressions: [{ id: 'f9', title: 'Checkout regression', severity: 'high' }] }, {});
  return (
    <Card title="Reopen from comparison view" note="Idea 52907">
      <Kv k="Regressions" v={v.regressionCount} />
      <Kv k="Baseline" v={v.baselineHuntId || 'none'} />
      <Kv k="Suggested" v={String(v.recommended)} />
    </Card>
  );
}

export function ThreatIntelTriggeredReopen() {
  const v = XB.suggestThreatIntelReopen({ id: 'intel-1', title: 'Checkout library advisory', tags: ['checkout'], affectedProducts: ['postgres'] }, DEMO_HUNTS, {});
  return (
    <Card title="Threat-intel-triggered reopen" note="Idea 52908">
      <Kv k="Suggestions" v={v.count} />
      <Kv k="Top" v={v.suggestions[0] ? v.suggestions[0].huntId : 'none'} />
      <div className="w73b-note">{v.summary.slice(0, 60)}</div>
    </Card>
  );
}

export function CodeChangeTriggeredReopen() {
  const v = XB.suggestCodeChangeReopen({ id: 'deploy-7', changedPaths: ['src/auth/session.js', 'src/checkout/pay.js'] }, DEMO_HUNTS, {});
  return (
    <Card title="Code-change-triggered reopen" note="Idea 52909">
      <Kv k="Suggestions" v={v.count} />
      <Kv k="Security path" v={String(v.securityRelevant)} />
      <Kv k="Files" v={v.changedCount} />
    </Card>
  );
}

export function AcquisitionTriggeredReopen() {
  const v = XB.suggestAcquisitionReopen({ id: 'acq-1', assets: [{ host: 'shop.example.com' }] }, DEMO_HUNTS, {});
  return (
    <Card title="Acquisition-triggered reopen" note="Idea 52910">
      <Kv k="New assets" v={v.newAssetCount} />
      <Kv k="Related" v={v.count} />
      <Kv k="Top" v={v.suggestions[0] ? v.suggestions[0].huntId : 'none'} />
    </Card>
  );
}

export function IncidentTriggeredReopen() {
  const v = XB.suggestIncidentReopen({ id: 'inc-3', asset: 'https://shop.example.com', severity: 'high' }, DEMO_HUNTS, {});
  return (
    <Card title="Incident-triggered reopen" note="Idea 52911">
      <Kv k="Candidates" v={v.candidates.length} />
      <Kv k="Recommended" v={v.recommendedHuntId || 'none'} />
      <div className="w73b-note">{v.summary.slice(0, 60)}</div>
    </Card>
  );
}

export function ReopenExpiryPolicy() {
  const v = XB.checkReopenExpiry(DEMO_HUNT, { maxReopenMonths: 6 }, { now: NOW });
  return (
    <Card title="Reopen expiry policy" note="Idea 52912">
      <Kv k="Age months" v={v.ageMonths} />
      <Kv k="Expired" v={String(v.expired)} />
      <Kv k="Action" v={v.action} />
    </Card>
  );
}

export function FreshEngineReopen() {
  const v = XB.planFreshEngineReopen(DEMO_HUNT, ['recon', 'vuln-scan'], {});
  return (
    <Card title="Fresh-engine reopen" note="Idea 52913">
      <Kv k="Engines" v={v.engineCount} />
      <Kv k="Baseline" v={v.preservedFindings} />
      <div className="w73b-note">{v.summary.slice(0, 60)}</div>
    </Card>
  );
}

export function ReopenCostEstimate() {
  const v = XB.estimateReopenCost(DEMO_HUNT, { freshScan: true });
  return (
    <Card title="Reopen cost estimate" note="Idea 52914">
      <Kv k="Minutes" v={v.estimatedMinutes} />
      <Kv k="Compute" v={v.computeUnits} />
      <Kv k="Fresh scan" v={String(v.freshScan)} />
    </Card>
  );
}

export function ScheduledReopen() {
  const v = XB.scheduleReopen(DEMO_HUNT, { at: '2026-11-01T09:00:00Z', reason: 'Recheck after the planned migration.', requestedBy: 'lead-1' }, { now: NOW });
  return (
    <Card title="Scheduled reopen" note="Idea 52915">
      <Kv k="Scheduled" v={String(v.scheduled)} />
      <Kv k="Date" v={v.entry ? v.entry.scheduledAt.slice(0, 10) : 'none'} />
      <Kv k="Errors" v={v.errors.length} />
    </Card>
  );
}

export function ReopenDiscussionThread() {
  const comments = [
    { id: 'c1', text: 'Should we reopen after the deploy?', position: 'for' },
    { id: 'c2', text: 'Yes, the checkout changed a lot.', position: 'for' },
  ];
  const v = XB.buildReopenDiscussionThread(DEMO_HUNT, comments, {});
  return (
    <Card title="Reopen discussion thread" note="Idea 52916">
      <Kv k="Comments" v={v.commentCount} />
      <Kv k="Decision" v={v.decision} />
      <Kv k="Open Qs" v={v.openQuestions.length} />
    </Card>
  );
}

export function ReopenedHuntBadge() {
  const v = XB.getReopenedHuntBadge(DEMO_HUNT, {});
  return (
    <Card title="Reopened-hunt badge" note="Idea 52917">
      <Kv k="Label" v={v.label} />
      <Kv k="Count" v={v.reopenCount} />
      <div className="w73b-row"><Badge tone={v.tone}>{v.label}</Badge></div>
    </Card>
  );
}

export function ReopenSearchFilter() {
  const v = XB.filterHuntsByReopen(DEMO_HUNTS, { minReopens: 1 }, {});
  return (
    <Card title="Reopen search filter" note="Idea 52918">
      <Kv k="Matched" v={v.count} />
      <Kv k="Top" v={v.hunts[0] ? v.hunts[0].huntId : 'none'} />
      <Kv k="Total hunts" v={v.total} />
    </Card>
  );
}

export function ReopenAnalytics() {
  const v = XB.analyzeReopenAnalytics(DEMO_HUNTS, {});
  return (
    <Card title="Reopen analytics" note="Idea 52919">
      <Kv k="Reopen rate" v={`${v.reopenRatePercent}%`} />
      <Kv k="Reopened" v={v.reopenedHunts} />
      <Kv k="Top reason" v={v.topReason ? v.topReason.category : 'none'} />
    </Card>
  );
}

export function ReopenVsRegressionExplainer() {
  const v = XB.explainReopenVsRegression({ regressionSuspected: true, scopeDriftPercent: 5, ageMonths: 1 }, {});
  return (
    <Card title="Reopen-vs-regression explainer" note="Idea 52920">
      <Kv k="Recommended" v={v.recommended} />
      <Kv k="Options" v={v.options.length} />
      <div className="w73b-note">{v.summary.slice(0, 60)}</div>
      <div className="w73b-row"><Badge tone="info">{`checked ${NOW.slice(0, 10)}`}</Badge></div>
    </Card>
  );
}

/** Gallery list: all 20 idea-52901–52920 components, export-only. */
export const W73_B_GALLERY = [
  HistoryPreservingReopen,
  ReopenReasonTemplates,
  ReopenApprovalWorkflow,
  BulkReopenPostHunt,
  ReopenApi,
  ReopenFromEmailLink,
  ReopenFromComparisonView,
  ThreatIntelTriggeredReopen,
  CodeChangeTriggeredReopen,
  AcquisitionTriggeredReopen,
  IncidentTriggeredReopen,
  ReopenExpiryPolicy,
  FreshEngineReopen,
  ReopenCostEstimate,
  ScheduledReopen,
  ReopenDiscussionThread,
  ReopenedHuntBadge,
  ReopenSearchFilter,
  ReopenAnalytics,
  ReopenVsRegressionExplainer,
];

/** Gallery: renders every Wave 73B component, export-only. */
export function Wave73BGallery() {
  return (
    <div className="w73b-gallery">
      {W73_B_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
