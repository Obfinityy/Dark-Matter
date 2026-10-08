/**
 * Wave73A.jsx — Infinity AI · Dark-Matter · Wave 73
 * 20 working React components for post-hunt Q&A and hunt
 * reopen, ideas 52881–52900. Export-only module: components
 * are not mounted anywhere. Pure presentational, props-driven.
 */
import React from 'react';
import * as XA from './wave73ACore.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_QA = [
  { id: 'qa-1', question: 'Which checkout finding is critical?', answer: 'The checkout SQL issue is critical and touches payments.', findingId: 'f1', askedBy: 'lead-1', at: '2026-10-08T09:00:00Z' },
  { id: 'qa-2', question: 'Is the invoice issue in a chain?', answer: 'Not yet recorded in a chain.', findingId: 'f3', askedBy: 'analyst-1', at: '2026-10-08T10:00:00Z' },
];

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'confirmed', target: 'shop.example.com/checkout', cwe: 'CWE-89', evidence: ['Unauthenticated checkout query returned every order id'] },
  { id: 'f3', title: 'IDOR in invoices', severity: 'high', status: 'triaged', target: 'api.example.com/invoices/1001', cwe: 'CWE-862', evidence: ['Invoice of another customer opened by changing the id'] },
];

const DEMO_HUNT = {
  huntId: 'hunt-42',
  target: 'shop.example.com',
  status: 'closed',
  closedAt: '2026-09-20T09:00:00Z',
  createdAt: '2026-09-01T09:00:00Z',
  owner: 'lead-1',
  watchers: ['lead-1', 'analyst-1'],
  assignees: ['meera'],
  findings: DEMO_FINDINGS,
  qaHistory: DEMO_QA,
  snapshot: { huntId: 'hunt-42', closedAt: '2026-09-20T09:00:00Z', findings: DEMO_FINDINGS, decisions: [{ findingId: 'f1', decision: 'confirmed' }], comments: [{ id: 'c1', text: 'Verified with the team' }], findingCount: 2 },
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  stats: { requests: 1240, durationMinutes: 95, engines: ['recon', 'vuln-scan'] },
};

function Card({ title, note, children }) {
  return (
    <div className="w73a-card">
      <div className="w73a-title">{title}</div>
      {note ? <div className="w73a-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w73a-badge w73a-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w73a-kv">
      <span className="w73a-k">{k}</span>
      <span className="w73a-v">{String(v)}</span>
    </div>
  );
}

export function QaExport() {
  const v = XA.exportQaTranscript(DEMO_QA, 'markdown', { huntLabel: 'Hunt 42' });
  return (
    <Card title="Q&A export" note="Idea 52881">
      <Kv k="File" v={v.filename} />
      <Kv k="Entries" v={v.entryCount} />
      <Kv k="Words" v={v.wordCount} />
    </Card>
  );
}

export function QaSharing() {
  const v = XA.shareQaThread({ id: 'thread-1', huntId: 'hunt-42', title: 'Checkout Q&A', entries: DEMO_QA }, { permission: 'view' });
  return (
    <Card title="Q&A sharing" note="Idea 52882">
      <Kv k="Permission" v={v.permission} />
      <Kv k="Expires" v={v.expiresAt.slice(0, 10)} />
      <div className="w73a-note">{v.url.slice(0, 56)}</div>
    </Card>
  );
}

export function SuggestedFollowUpChips() {
  const v = XA.suggestFollowUpChips({ answer: DEMO_QA[0].answer, finding: DEMO_FINDINGS[0] }, {});
  return (
    <Card title="Suggested follow-up chips" note="Idea 52883">
      <Kv k="Chips" v={v.count} />
      <div className="w73a-row">{v.chips.map(c => <Badge key={c.label} tone="info">{c.label}</Badge>)}</div>
    </Card>
  );
}

export function MultiTurnContextRetention() {
  const turns = [
    { question: 'Which finding is critical?', answer: 'The checkout issue.', findingId: 'f1' },
    { question: 'Does it touch payments?', answer: 'Yes, checkout payments.', findingId: 'f1' },
  ];
  const v = XA.trackConversationContext(turns, {});
  return (
    <Card title="Multi-turn context retention" note="Idea 52884">
      <Kv k="Turns kept" v={v.turnsRetained} />
      <Kv k="Findings" v={v.findingIds.join(', ') || 'none'} />
      <Kv k="Topics" v={v.topics.slice(0, 3).join(', ') || 'none'} />
    </Card>
  );
}

export function MultilingualQa() {
  const v = XA.translateQaAnswer({ text: DEMO_QA[0].answer, finding: DEMO_FINDINGS[0] }, 'hinglish', {});
  return (
    <Card title="Multilingual Q&A" note="Idea 52885">
      <Kv k="Language" v={v.languageName || v.language} />
      <Kv k="Supported" v={String(v.supported)} />
      <div className="w73a-note">{String(v.translatedText).slice(0, 64)}</div>
    </Card>
  );
}

export function AnswerFeedbackButtons() {
  const v = XA.recordAnswerFeedback({ answerId: 'qa-1', helpful: true, comment: 'Clear answer' }, { helpfulCount: 4, notHelpfulCount: 1 }, {});
  return (
    <Card title="Answer feedback buttons" note="Idea 52886">
      <Kv k="Helpful" v={v.helpfulCount} />
      <Kv k="Quality" v={`${v.qualityScore}%`} />
      <div className="w73a-row"><Badge tone={v.needsReview ? 'warn' : 'ok'}>{v.needsReview ? 'needs review' : 'healthy'}</Badge></div>
    </Card>
  );
}

export function QaOverArchivedHunts() {
  const v = XA.queryArchivedHunt(DEMO_HUNT, 'checkout critical', {});
  return (
    <Card title="Q&A over archived hunts" note="Idea 52887">
      <Kv k="Sources" v={v.sourceCount} />
      <Kv k="Top" v={v.sources[0] ? v.sources[0].title : 'none'} />
      <div className="w73a-note">{v.answer.slice(0, 64)}</div>
    </Card>
  );
}

export function CodeContextQa() {
  const codebase = { files: [{ path: 'src/checkout/search.js', lines: ["const q = req.query.q;", "db.query('SELECT * FROM orders WHERE name = ' + q);"] }] };
  const v = XA.showCodeContext(DEMO_FINDINGS[0], codebase, {});
  return (
    <Card title="Code-context Q&A" note="Idea 52888">
      <Kv k="Snippets" v={v.snippetCount} />
      <Kv k="File" v={v.snippets[0] ? v.snippets[0].file : 'none'} />
      <div className="w73a-presig">{v.snippets[0] ? v.snippets[0].code.slice(0, 56) : 'none'}</div>
    </Card>
  );
}

export function HuntStatisticsQa() {
  const v = XA.answerHuntStatistics(DEMO_HUNT, 'How many requests did you send?', {});
  return (
    <Card title="Hunt-statistics Q&A" note="Idea 52889">
      <Kv k="Requests" v={v.values.requests} />
      <Kv k="Minutes" v={v.values.durationMinutes} />
      <div className="w73a-note">{v.answer.slice(0, 64)}</div>
    </Card>
  );
}

export function OneClickHuntReopen() {
  const v = XA.reopenHuntOneClick(DEMO_HUNT, { reason: 'New threat intel matches this stack.' });
  return (
    <Card title="One-click hunt reopen" note="Idea 52890">
      <Kv k="Eligible" v={String(v.eligible)} />
      <Kv k="New state" v={v.newState} />
      <div className="w73a-row"><Badge tone={v.eligible ? 'ok' : 'danger'}>{v.previousState}</Badge></div>
    </Card>
  );
}

export function ReopenReasonRequirement() {
  const v = XA.validateReopenReason('Regression detected in checkout after the last deploy.', {});
  return (
    <Card title="Reopen reason requirement" note="Idea 52891">
      <Kv k="Valid" v={String(v.valid)} />
      <Kv k="Category" v={v.category} />
      <div className="w73a-note">{v.summary.slice(0, 64)}</div>
    </Card>
  );
}

export function StateSnapshotRestore() {
  const v = XA.restoreStateSnapshot(DEMO_HUNT.snapshot, {});
  return (
    <Card title="State-snapshot restore on reopen" note="Idea 52892">
      <Kv k="Findings" v={v.restoredFindings} />
      <Kv k="Decisions" v={v.restoredDecisions} />
      <Kv k="Intact" v={String(v.intact)} />
    </Card>
  );
}

export function ReopenFromArchive() {
  const v = XA.reopenFromArchive({ ...DEMO_HUNT, status: 'archived', archivedAt: DEMO_HUNT.closedAt }, {});
  return (
    <Card title="Reopen from archive" note="Idea 52893">
      <Kv k="Success" v={String(v.success)} />
      <Kv k="Steps" v={v.steps.length} />
      <Kv k="Restored" v={v.restored.restoredFindings} />
    </Card>
  );
}

export function ReopenNotifications() {
  const v = XA.buildReopenNotifications(DEMO_HUNT, { requestedBy: 'lead-1', reason: 'New intel received.' }, {});
  return (
    <Card title="Reopen notifications" note="Idea 52894">
      <Kv k="Recipients" v={v.recipientCount} />
      <Kv k="First" v={v.notifications[0] ? v.notifications[0].recipient : 'none'} />
      <div className="w73a-note">{v.notifications[0] ? v.notifications[0].message.slice(0, 56) : 'none'}</div>
    </Card>
  );
}

export function ReopenAuditLog() {
  const v = XA.recordReopenAuditLog({ huntId: 'hunt-42', actor: 'lead-1', reason: 'New intel received.', previousState: 'closed' }, [], {});
  return (
    <Card title="Reopen audit log" note="Idea 52895">
      <Kv k="Entry" v={`#${v.entry.seq}`} />
      <Kv k="Actor" v={v.entry.actor} />
      <Kv k="Compliant" v={String(v.complianceReady)} />
    </Card>
  );
}

export function ReopenPermissionControl() {
  const v = XA.checkReopenPermission({ id: 'lead-1', role: 'lead' }, DEMO_HUNT, {});
  return (
    <Card title="Reopen permission control" note="Idea 52896">
      <Kv k="Allowed" v={String(v.allowed)} />
      <Kv k="Role" v={v.role} />
      <div className="w73a-row"><Badge tone={v.allowed ? 'ok' : 'danger'}>{v.allowed ? 'permitted' : 'denied'}</Badge></div>
    </Card>
  );
}

export function ReopenVsNewGuidance() {
  const v = XA.guideReopenVsNew(DEMO_HUNT, { newIntel: true, scopeDriftPercent: 10 }, { now: NOW });
  return (
    <Card title="Reopen-vs-new guidance" note="Idea 52897">
      <Kv k="Advice" v={v.recommendation} />
      <Kv k="Score" v={v.reopenScore} />
      <Kv k="Age days" v={v.ageDays} />
    </Card>
  );
}

export function ReIndexOnReopen() {
  const v = XA.reindexReopenedHunt(DEMO_HUNT, {}, {});
  return (
    <Card title="Re-index on reopen" note="Idea 52898">
      <Kv k="Documents" v={v.documentsIndexed} />
      <Kv k="Findings" v={v.byKind.finding || 0} />
      <Kv k="Searchable" v={String(v.searchable)} />
    </Card>
  );
}

export function ExtendedScopeReopen() {
  const v = XA.planExtendedScopeReopen(DEMO_HUNT, { include: ['blog.example.com'], exclude: [] }, {});
  return (
    <Card title="Extended-scope reopen" note="Idea 52899">
      <Kv k="Added" v={v.addedCount} />
      <Kv k="Merged" v={v.mergedScope.length} />
      <div className="w73a-note">{v.summary.slice(0, 64)}</div>
    </Card>
  );
}

export function AppendNewFindingsOnReopen() {
  const fresh = [{ id: 'f7', title: 'New header leak', severity: 'medium', target: 'shop.example.com' }];
  const v = XA.appendNewFindings(DEMO_HUNT, fresh, {});
  return (
    <Card title="Append-new-findings on reopen" note="Idea 52900">
      <Kv k="Appended" v={v.appendedCount} />
      <Kv k="Total" v={v.totalCount} />
      <div className="w73a-row"><Badge tone="info">{`checked ${NOW.slice(0, 10)}`}</Badge></div>
    </Card>
  );
}

/** Gallery list: all 20 idea-52881–52900 components, export-only. */
export const W73_A_GALLERY = [
  QaExport,
  QaSharing,
  SuggestedFollowUpChips,
  MultiTurnContextRetention,
  MultilingualQa,
  AnswerFeedbackButtons,
  QaOverArchivedHunts,
  CodeContextQa,
  HuntStatisticsQa,
  OneClickHuntReopen,
  ReopenReasonRequirement,
  StateSnapshotRestore,
  ReopenFromArchive,
  ReopenNotifications,
  ReopenAuditLog,
  ReopenPermissionControl,
  ReopenVsNewGuidance,
  ReIndexOnReopen,
  ExtendedScopeReopen,
  AppendNewFindingsOnReopen,
];

/** Gallery: renders every Wave 73A component, export-only. */
export function Wave73AGallery() {
  return (
    <div className="w73a-gallery">
      {W73_A_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
