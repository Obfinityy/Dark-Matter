/**
 * Wave71B.jsx — Infinity AI · Dark-Matter · Wave 71
 * 20 working React components for bulk actions round 3 and the
 * post-hunt Q&A suite, ideas 52821–52840. Export-only module:
 * components are not mounted anywhere. Pure presentational,
 * props-driven.
 */
import React from 'react';
import * as EB from './wave71BCores.js';

const NOW = '2026-10-09T00:00:00Z';

const DEMO_FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'verifying', target: 'shop.example.com', owner: 'aarav', assignee: 'meera', huntId: 'hunt-42', riskScore: 92, cwe: 'CWE-89', impact: 'Full database read including customer data', cvss: { score: 9.8, vector: 'AV:N/AC:L/PR:N/UI:N' }, tags: ['checkout'], evidence: ['error-based extraction confirmed', 'curl replay recorded in poc'], pocSteps: ['Open checkout', 'Submit the recorded payload', 'Observe extracted rows'], commits: [], history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-01T09:00:00Z', reason: 'intake' }, { from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-02T09:00:00Z', reason: 'reproduced' }], createdAt: '2026-10-01T09:00:00Z', verifiedBy: 'verifier-1', sharedServices: ['payments-db'] },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'fixing', target: 'shop.example.com', owner: 'meera', assignee: 'meera', huntId: 'hunt-42', riskScore: 74, cwe: 'CWE-79', impact: 'Session theft for shoppers', tags: ['search'], evidence: ['reflected script executed'], pocSteps: ['Search with the recorded payload'], commits: [], history: [], createdAt: '2026-10-03T09:00:00Z', assets: ['shop.example.com', 'cdn.example.com'] },
  { id: 'f3', title: 'Weak TLS on mobile API', severity: 'medium', status: 'closed', target: 'api.example.com', owner: 'platform', assignee: 'platform', huntId: 'hunt-42', riskScore: 42, tags: [], evidence: ['legacy cipher negotiated'], commits: [], history: [{ from: 'verified', to: 'closed', actor: 'lead-1', at: '2026-10-06T09:00:00Z', reason: 'verified closure' }], createdAt: '2026-10-08T09:00:00Z' },
  { id: 'f4', title: 'Verbose errors in profile', severity: 'low', status: 'verified', target: 'shop.example.com', owner: 'meera', assignee: 'qa-1', huntId: 'hunt-42', riskScore: 21, tags: ['profile'], evidence: ['stack trace in error screen'], commits: [], history: [{ from: 'verifying', to: 'verified', actor: 'verifier-1', at: '2026-10-07T09:00:00Z', reason: 'retest passed' }], createdAt: '2026-10-02T09:00:00Z', verifiedBy: 'verifier-1' },
];

const DEMO_HUNT = {
  huntId: 'hunt-42',
  target: 'shop.example.com',
  findings: DEMO_FINDINGS,
  coveredCategories: ['authentication', 'input-validation'],
  attempts: [
    { check: 'authentication bypass', target: 'shop.example.com', outcome: 'no-finding', reason: 'login enforced' },
    { check: 'file-upload filter', target: 'shop.example.com', outcome: 'blocked', reason: 'upload endpoint needs vendor account' },
    { check: 'session-management fixation', target: 'shop.example.com', outcome: 'failed', reason: 'session rotated on login' },
  ],
};

const DEMO_ASSETS = [
  { id: 'shop-1', host: 'shop.example.com', criticality: 'high', sharedServices: ['payments-db'] },
  { id: 'shop-2', host: 'shop.example.com', criticality: 'medium', sharedServices: [] },
  { id: 'api-1', host: 'api.example.com', criticality: 'high', sharedServices: ['payments-db'] },
];

function Card({ title, note, children }) {
  return (
    <div className="w71b-card">
      <div className="w71b-title">{title}</div>
      {note ? <div className="w71b-note">{note}</div> : null}
      {children}
    </div>
  );
}

function Badge({ tone, children }) {
  return <span className={`w71b-badge w71b-badge-${tone || 'info'}`}>{children}</span>;
}

function Kv({ k, v }) {
  return (
    <div className="w71b-kv">
      <span className="w71b-k">{k}</span>
      <span className="w71b-v">{String(v)}</span>
    </div>
  );
}

export function BulkFixVersionTagging() {
  const v = EB.bulkTagFixVersion(DEMO_FINDINGS.slice(0, 3), '2.4.1', { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk fix-version tagging" note="Idea 52821">
      <Kv k="Version" v={v.version || 'invalid'} />
      <Kv k="Tagged" v={v.taggedIds.join(', ') || 'none'} />
      <Kv k="Tag f1" v={v.updated[0] ? v.updated[0].tags.join(', ') : 'none'} />
    </Card>
  );
}

export function BulkCommitLinking() {
  const v = EB.bulkLinkCommits(DEMO_FINDINGS.slice(0, 2), { f1: 'a1b2c3d4e5f6', f2: 'not-a-sha' }, { actor: 'meera', at: NOW });
  return (
    <Card title="Bulk commit linking" note="Idea 52822">
      <Kv k="Linked" v={v.linkedIds.join(', ') || 'none'} />
      <Kv k="Invalid" v={v.invalid.length} />
      <Kv k="Sha f1" v={v.updated[0] && v.updated[0].commits[0] ? v.updated[0].commits[0].sha : 'none'} />
    </Card>
  );
}

export function BulkCloseWithReason() {
  const v = EB.bulkCloseWithReason(DEMO_FINDINGS, { reason: 'Fix verified in production', reasonCode: 'fixed-verified', actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk close with reason" note="Idea 52823">
      <Kv k="Closed" v={v.closedIds.join(', ') || 'none'} />
      <Kv k="Blocked" v={v.blocked.length} />
      <Kv k="Code" v={v.closed[0] ? v.closed[0].closeReasonCode : 'none'} />
    </Card>
  );
}

export function BulkReopenWithReason() {
  const v = EB.bulkReopenWithReason(DEMO_FINDINGS, { reason: 'Regression found in release', reasonCode: 'regression', actor: 'verifier-1', at: NOW });
  return (
    <Card title="Bulk reopen with reason" note="Idea 52824">
      <Kv k="Reopened" v={v.reopenedIds.join(', ') || 'none'} />
      <Kv k="Blocked" v={v.blocked.length} />
      <Kv k="Reopen count" v={v.reopened[0] ? v.reopened[0].reopenCount : 0} />
    </Card>
  );
}

export function BulkAssigneeNotification() {
  const v = EB.bulkNotifyAssignees(DEMO_FINDINGS, { channel: 'chat', actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk assignee notification" note="Idea 52825">
      <Kv k="Notifications" v={v.notifications.length} />
      <Kv k="Recipients" v={v.recipients.join(', ') || 'none'} />
      <Kv k="Unassigned" v={v.unassignedIds.length} />
    </Card>
  );
}

export function BulkPocBundleGeneration() {
  const v = EB.buildPocBundleManifest(DEMO_FINDINGS.slice(0, 2), { generatedAt: NOW });
  return (
    <Card title="Bulk PoC bundle generation" note="Idea 52826">
      <Kv k="Bundle" v={v.bundleName} />
      <Kv k="Files" v={v.fileCount} />
      <Kv k="Findings" v={v.totalFindings} />
      <Kv k="Checksum" v={v.checksum} />
    </Card>
  );
}

export function BulkCveRequestDrafts() {
  const v = EB.draftBulkCveRequests(DEMO_FINDINGS, { requester: 'lead-1', at: NOW });
  return (
    <Card title="Bulk CVE-request drafts" note="Idea 52827">
      <Kv k="Drafts" v={v.count} />
      <Kv k="Eligible" v={v.drafts.map(d => d.findingId).join(', ') || 'none'} />
      <Kv k="Ineligible" v={v.ineligible.length} />
    </Card>
  );
}

export function BulkSlaRecalculation() {
  const v = EB.recalculateBulkSla(DEMO_FINDINGS, {}, '2026-10-09T00:00:00Z');
  return (
    <Card title="Bulk SLA recalculation" note="Idea 52828">
      <Kv k="Recalculated" v={v.count} />
      <Kv k="Breached" v={v.breachedIds.join(', ') || 'none'} />
      <Kv k="Due f1" v={v.results[0] ? v.results[0].dueAt : 'none'} />
    </Card>
  );
}

export function BulkDecisionHistoryExport() {
  const v = EB.exportDecisionHistory(DEMO_FINDINGS, 'markdown', {});
  return (
    <Card title="Bulk export of decision history" note="Idea 52829">
      <Kv k="File" v={v.filename} />
      <Kv k="Decisions" v={v.rows} />
      <Kv k="Checksum" v={v.checksum} />
    </Card>
  );
}

export function BulkFindingSplitByAsset() {
  const v = EB.splitFindingsByAsset(DEMO_FINDINGS, { actor: 'lead-1', at: NOW });
  return (
    <Card title="Bulk finding split by asset" note="Idea 52830">
      <Kv k="Out" v={v.count} />
      <Kv k="Created" v={v.createdIds.join(', ') || 'none'} />
      <Kv k="Splits" v={v.splitCount} />
    </Card>
  );
}

export function PostHuntQaChat() {
  const v = EB.answerPostHuntQuestion(DEMO_HUNT, 'How many critical findings did you find?');
  return (
    <Card title="Post-hunt Q&A chat" note="Idea 52831">
      <Kv k="Intent" v={v.intent} />
      <div className="w71b-note">{v.answer}</div>
      <Kv k="Critical ids" v={(v.data.criticalIds || []).join(', ') || 'none'} />
    </Card>
  );
}

export function WhyCriticalExplainer() {
  const v = EB.explainCriticality(DEMO_FINDINGS[0]);
  return (
    <Card title={'"Why is this critical?" explainer'} note="Idea 52832">
      <Kv k="Verdict" v={v.verdict} />
      <Kv k="Score" v={v.score} />
      <Kv k="Factors" v={v.factors.length} />
      <div className="w71b-note">{v.summary}</div>
    </Card>
  );
}

export function ExploitChainWalkthrough() {
  const v = EB.walkthroughExploitChain({ id: 'chain-1', hops: [{ findingId: 'f2', action: 'steal a shopper session' }, { findingId: 'f1', action: 'use the session to reach checkout data' }] }, DEMO_FINDINGS);
  return (
    <Card title="Exploit-chain walkthrough" note="Idea 52833">
      <Kv k="Steps" v={v.stepCount} />
      <Kv k="Max severity" v={v.maxSeverity} />
      <div className="w71b-note">{v.breakPoint ? v.breakPoint.advice : 'no chain'}</div>
    </Card>
  );
}

export function FailedAttemptsQa() {
  const v = EB.summarizeFailedAttempts(DEMO_HUNT);
  return (
    <Card title={'"What did you try that failed?"'} note="Idea 52834">
      <Kv k="Attempts" v={v.total} />
      <Kv k="No finding" v={v.failedCount} />
      <Kv k="Failure rate" v={`${v.failureRate}%`} />
      <div className="w71b-note">{v.summary}</div>
    </Card>
  );
}

export function CoverageGapQa() {
  const v = EB.analyzeCoverageGaps(DEMO_HUNT, []);
  return (
    <Card title="Coverage-gap Q&A" note="Idea 52835">
      <Kv k="Coverage" v={`${v.coveragePercent}%`} />
      <Kv k="Tested" v={`${v.testedCount}/${v.expectedCount}`} />
      <Kv k="First gap" v={v.gaps[0] || 'none'} />
    </Card>
  );
}

export function FindingConfidenceInterrogation() {
  const v = EB.interrogateConfidence(DEMO_FINDINGS[0]);
  return (
    <Card title="Per-finding confidence interrogation" note="Idea 52836">
      <Kv k="Confidence" v={`${v.confidenceScore}/100`} />
      <Kv k="Level" v={v.level} />
      <Kv k="Open questions" v={v.questions.length} />
    </Card>
  );
}

export function BlastRadiusEstimatorQa() {
  const v = EB.estimateBlastRadius(DEMO_FINDINGS[0], { assets: DEMO_ASSETS });
  return (
    <Card title="Blast-radius estimator Q&A" note="Idea 52837">
      <Kv k="Radius" v={`${v.radiusScore}/100`} />
      <Kv k="Level" v={v.level} />
      <Kv k="Reachable" v={v.affectedCount} />
    </Card>
  );
}

export function FixSuggestionFollowUps() {
  const v = EB.suggestFixFollowUps(DEMO_FINDINGS[0]);
  return (
    <Card title="Fix-suggestion follow-ups" note="Idea 52838">
      <Kv k="Weakness" v={v.weakness} />
      <Kv k="Suggestions" v={v.suggestions.length} />
      <Kv k="Priority" v={v.suggestions[0] ? v.suggestions[0].priority : 'none'} />
    </Card>
  );
}

export function CrossHuntComparisonQuestions() {
  const v = EB.compareHuntHistory(
    { huntId: 'hunt-41', findings: [DEMO_FINDINGS[2], DEMO_FINDINGS[3]] },
    { huntId: 'hunt-42', findings: DEMO_FINDINGS },
  );
  return (
    <Card title="Cross-hunt comparison questions" note="Idea 52839">
      <Kv k="Total delta" v={v.delta.total} />
      <Kv k="Critical delta" v={v.delta.critical} />
      <div className="w71b-note">{v.summary}</div>
    </Card>
  );
}

export function BountyWriteupDrafting() {
  const v = EB.draftBountyWriteup(DEMO_FINDINGS[0], { submitter: 'Infinity AI', program: 'shop program' });
  return (
    <Card title="Bounty-writeup drafting" note="Idea 52840">
      <Kv k="Ready" v={String(v.ready)} />
      <Kv k="Words" v={v.wordCount} />
      <Kv k="Missing" v={v.missing.join(', ') || 'none'} />
      <div className="w71b-presig">{v.markdown.split('\n')[0]}</div>
    </Card>
  );
}

/** Gallery: all 20 idea-52821–52840 components, export-only. */
export function Wave71BGallery() {
  return (
    <div className="w71b-gallery">
      <BulkFixVersionTagging />
      <BulkCommitLinking />
      <BulkCloseWithReason />
      <BulkReopenWithReason />
      <BulkAssigneeNotification />
      <BulkPocBundleGeneration />
      <BulkCveRequestDrafts />
      <BulkSlaRecalculation />
      <BulkDecisionHistoryExport />
      <BulkFindingSplitByAsset />
      <PostHuntQaChat />
      <WhyCriticalExplainer />
      <ExploitChainWalkthrough />
      <FailedAttemptsQa />
      <CoverageGapQa />
      <FindingConfidenceInterrogation />
      <BlastRadiusEstimatorQa />
      <FixSuggestionFollowUps />
      <CrossHuntComparisonQuestions />
      <BountyWriteupDrafting />
    </div>
  );
}
