/**
 * LifecycleMgmt.jsx — Infinity AI · Dark-Matter · Wave 59
 * 20 working React components for submission lifecycle management, ideas 52341–52360.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as LC from './lifecycleCore.js';

const SAMPLE_SUBMISSIONS = [
  { id: 's-1', platform: 'hackerone', state: 'triaged', submittedAt: 1699000000000, triagedAt: 1699003600000, payout: null },
  { id: 's-2', platform: 'hackerone', state: 'paid', submittedAt: 1699000000000, triagedAt: 1699010000000, payout: 750 },
  { id: 's-3', platform: 'bugcrowd', state: 'submitted', submittedAt: 1699000000000, triagedAt: null, payout: null },
  { id: 's-4', platform: 'bugcrowd', state: 'duplicate', submittedAt: 1699000000000, triagedAt: 1699020000000, payout: null },
];

const SAMPLE_DRAFT = {
  id: 'draft-61', title: 'Stored XSS in product reviews', platform: 'hackerone',
  severity: 'High', impact: 'Session theft and account takeover for any user viewing a poisoned review.',
  steps: ['1. Log in as any user', '2. Post a review with a script payload', '3. View the product page'],
  evidence: [{ kind: 'screenshot', name: 'xss-alert.png' }],
  remediation: 'Encode review output with a context-aware encoder.',
  cwe: 'CWE-79', asset: 'https://shop.example.com/reviews',
  attachments: [{ name: 'xss-alert.png', sizeBytes: 184320 }],
};

const NOW = 1700000000000;

function Note({ children }) {
  return <p className="lc59-note">{children}</p>;
}

/* 52341 — Submission analytics. */
export function SubmissionAnalytics() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52341 · Submission analytics</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.computeSubmissionAnalytics(SAMPLE_SUBMISSIONS))}>Compute</button>
      {res && res.ok && <Note>{res.analytics.total} submissions · acceptance rate {(res.analytics.acceptanceRate * 100).toFixed(0)}% · median triage {(res.analytics.medianTimeToTriageMs / 3600000).toFixed(1)}h · payouts ${res.analytics.payout.total}</Note>}
    </div>
  );
}

/* 52342 — Per-platform acceptance stats. */
export function PerPlatformAcceptanceStats() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52342 · Per-platform acceptance stats</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.computeAcceptanceStats(SAMPLE_SUBMISSIONS))}>Rank platforms</button>
      {res && res.ok && <Note>{res.ranked.map((r) => `${r.platform}: ${(r.acceptanceRate * 100).toFixed(0)}% (${r.accepted}/${r.total})`).join(' · ')}</Note>}
    </div>
  );
}

/* 52343 — Draft versioning. */
export function DraftVersioning() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52343 · Draft versioning</h3>
      <button className="lc59-btn" onClick={() => {
        let versions = LC.appendDraftVersion([], SAMPLE_DRAFT, 'aria', NOW).versions;
        versions = LC.appendDraftVersion(versions, { ...SAMPLE_DRAFT, impact: 'Updated: full account takeover.' }, 'bhavesh', NOW + 1).versions;
        setRes({ versions, diff: LC.diffDraftVersions(versions, 1, 2) });
      }}>Version drafts</button>
      {res && <Note>{res.versions.length} version(s) kept · diff v1→v2: {res.diff.changes.map((c) => c.field).join(', ') || 'none'}</Note>}
    </div>
  );
}

/* 52344 — Collaborative draft editing. */
export function CollaborativeDraftEditing() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52344 · Collaborative draft editing</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.applyCollaborativeEdit(SAMPLE_DRAFT,
        { changes: [{ field: 'title', value: 'Stored XSS in product reviews (critical)' }], comment: 'tightened title' },
        'bhavesh', NOW))}>Apply edit</button>
      {res && res.ok && <Note>{res.edit.changes.length} change(s) by {res.edit.author} · change log entries: {res.draft.changeLog.length} · new title: “{res.draft.title}”</Note>}
    </div>
  );
}

/* 52345 — Platform credential vault (encrypted-handle descriptors, never plaintext). */
export function CredentialVault() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52345 · Credential vault</h3>
      <button className="lc59-btn" onClick={() => {
        const stored = LC.storeCredentialHandle({ platform: 'hackerone', owner: 'aria', ciphertextRef: 'kms://vault/h1-aria/v3', scopes: ['read', 'submit'], maskedHint: '••••9f2a' }, NOW);
        const leaked = LC.storeCredentialHandle({ platform: 'hackerone', owner: 'aria', plaintext: 'secret-token' }, NOW);
        const rotated = stored.ok ? LC.rotateCredentialHandle(stored.credential, 'kms://vault/h1-aria/v4', NOW + 1) : null;
        setRes({ stored, leaked, rotated });
      }}>Store handle</button>
      {res && <Note>stored: {String(res.stored.ok)} · plaintext field always {String(res.stored.credential && res.stored.credential.plaintext)} · raw token attempt → {res.leaked.reason} · rotated ref: {res.rotated && res.rotated.credential.ciphertextRef}</Note>}
    </div>
  );
}

/* 52346 — Test-mode submission. */
export function TestModeSubmission() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52346 · Test-mode submission</h3>
      <button className="lc59-btn" onClick={() => {
        const sub = LC.buildTestModeSubmission(SAMPLE_DRAFT, 'hackerone').submission;
        setRes(LC.markTestModeResult(sub, { valid: true, errors: [] }, NOW));
      }}>Run sandbox check</button>
      {res && res.ok && <Note>mode: {res.submission.mode} · sandbox: {String(res.submission.sandbox)} · will create real report: {String(res.submission.willCreateRealReport)} · valid: {String(res.submission.testResult.valid)} · network calls: {res.submission.networkCalls}</Note>}
    </div>
  );
}

/* 52347 — Submission dry-run validation. */
export function DryRunValidation() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52347 · Dry-run validation</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.dryRunValidate(SAMPLE_DRAFT, 'hackerone'))}>Dry run</button>
      {res && res.ok && <Note>passed: {String(res.passed)} · {res.checks.filter((c) => c.pass).length}/{res.checks.length} checks · failed: {res.failed.join(', ') || 'none'} · attachments {(res.attachmentBytes / 1024).toFixed(1)}KB</Note>}
    </div>
  );
}

/* 52348 — Platform rate-limit handling. */
export function RateLimitHandling() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52348 · Rate-limit handling</h3>
      <button className="lc59-btn" onClick={() => {
        let limiter = LC.createRateLimiter({ hackerone: { maxPerMinute: 2, maxPerHour: 10 } }, NOW).limiter;
        const decisions = [];
        for (let i = 0; i < 3; i += 1) {
          const r = LC.rateLimitNext(limiter, 'hackerone', { id: `sub-${i}` }, NOW + i * 1000);
          limiter = r.limiter;
          decisions.push(r.decision);
        }
        setRes({ decisions, queued: limiter.buckets.hackerone.queued.length });
      }}>Send 3 fast</button>
      {res && <Note>decisions: {res.decisions.join(', ')} · queued for retry: {res.queued}</Note>}
    </div>
  );
}

/* 52349 — Submission notifications. */
export function SubmissionNotifications() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52349 · Submission notifications</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.createSubmissionNotification('status-change',
        { to: 'aria', reportId: 'r-1', findingId: 'f-61', title: 'Report triaged', body: 'HackerOne marked r-1 as triaged.' }, NOW))}>Notify</button>
      {res && res.ok && <Note>{res.notification.kind} → {res.notification.to} · “{res.notification.title}” · status: {res.notification.status}</Note>}
    </div>
  );
}

/* 52350 — Platform webhook receiver. */
export function WebhookReceiver() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52350 · Webhook receiver</h3>
      <button className="lc59-btn" onClick={() => {
        const wh = LC.receiveWebhook({ event: 'report.bounty_awarded', reportId: 'r-1', platform: 'hackerone', data: { amount: 750 } }, {}, NOW).webhook;
        setRes({ wh, patch: LC.webhookToLifecyclePatch(wh) });
      }}>Receive webhook</button>
      {res && <Note>event {res.wh.event} · patch → lifecycle {res.patch.patch.lifecycle} · payout ${res.patch.patch.payout} · source {res.patch.patch.source}</Note>}
    </div>
  );
}

/* 52351 — Bounty earnings leaderboard. */
export function EarningsLeaderboard() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52351 · Bounty earnings leaderboard</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.buildLeaderboard([
        { researcher: 'aria', program: 'Acme', amount: 750, paidAt: Date.UTC(2026, 5, 10) },
        { researcher: 'bhavesh', program: 'Acme', amount: 1500, paidAt: Date.UTC(2026, 6, 2) },
        { researcher: 'aria', program: 'Globex', amount: 300, paidAt: Date.UTC(2026, 1, 20) },
      ]))}>Build leaderboard</button>
      {res && res.ok && <Note>{res.leaderboard.researchers.map((r) => `#${r.rank} ${r.researcher}: $${r.total}`).join(' · ')} · grand total ${res.leaderboard.grandTotal}</Note>}
    </div>
  );
}

/* 52352 — Bounty tax-report export. */
export function TaxReportExport() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52352 · Tax-report export</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.exportTaxReport([
        { researcher: 'aria', program: 'Acme', amount: 750, paidAt: Date.UTC(2026, 5, 10), currency: 'USD', findingId: 'f-61' },
        { researcher: 'aria', program: 'Globex', amount: 300, paidAt: Date.UTC(2025, 11, 1), currency: 'USD', findingId: 'f-62' },
      ], 2026, 'aria'))}>Export 2026</button>
      {res && res.ok && <Note>{res.report.researcher} {res.report.year}: {res.report.count} payout(s) · total ${res.report.total} · {res.report.disclaimer}</Note>}
    </div>
  );
}

/* 52353 — Duplicate-merge before submit. */
export function DuplicateMergeView() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52353 · Duplicate-merge before submit</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.mergeDuplicates([
        { id: 'f-61', title: 'Stored XSS in reviews', endpoint: 'https://shop.example.com/reviews', evidence: [{ kind: 'screenshot' }] },
        { id: 'f-61b', title: 'XSS via review body', url: 'https://shop.example.com/reviews', evidence: [{ kind: 'http' }, { kind: 'video' }] },
      ], NOW))}>Merge duplicates</button>
      {res && res.ok && <Note>merged {res.merged.mergedIds.join(' + ')} → {res.merged.id} · {res.merged.evidenceCount} evidence item(s) · {res.merged.assets.length} asset(s)</Note>}
    </div>
  );
}

/* 52354 — Program discovery. */
export function ProgramDiscovery() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52354 · Program discovery</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.discoverPrograms([
        { name: 'Acme', platform: 'hackerone', inScope: ['shop.example.com'], bounty: true },
        { name: 'Globex', platform: 'bugcrowd', inScope: ['other.example.com'], bounty: false },
      ], ['shop.example.com']))}>Discover programs</button>
      {res && res.ok && <Note>{res.count} match(es): {res.matches.map((m) => `${m.program} (${m.platform}, bounty: ${String(m.bounty)})`).join(' · ')}</Note>}
    </div>
  );
}

/* 52355 — Scope-diff alerts. */
export function ScopeDiffAlerts() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52355 · Scope-diff alerts</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.diffProgramScope(
        { name: 'Acme', inScope: ['shop.example.com', 'api.example.com'] },
        ['shop.example.com', 'old.example.com'],
      ))}>Diff scope</button>
      {res && res.ok && <Note>changed: {String(res.changed)} · added: {res.added.join(', ') || 'none'} · removed: {res.removed.join(', ') || 'none'} · {res.alert || 'no alert'}</Note>}
    </div>
  );
}

/* 52356 — Submission SLA monitor. */
export function SlaMonitor() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52356 · Submission SLA monitor</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.monitorSubmissionSla([
        { id: 's-1', platform: 'hackerone', submittedAt: NOW - 10 * 24 * 3600 * 1000 },
        { id: 's-2', platform: 'hackerone', submittedAt: NOW - 1 * 24 * 3600 * 1000 },
        { id: 's-3', platform: 'hackerone', submittedAt: NOW - 10 * 24 * 3600 * 1000, triagedAt: NOW - 9 * 24 * 3600 * 1000 },
      ], { hackerone: 7 * 24 * 3600 * 1000 }, NOW))}>Check SLAs</button>
      {res && res.ok && <Note>breached: {res.breachedCount} ({res.breached.map((b) => b.id).join(', ') || 'none'}) · responded: {res.rows.filter((r) => r.responded).length}</Note>}
    </div>
  );
}

/* 52357 — Report-quality score. */
export function ReportQualityScore() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52357 · Report-quality score</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.scoreReportQuality(SAMPLE_DRAFT))}>Score draft</button>
      {res && res.ok && <Note>score {res.quality.score}/{res.quality.max} · grade {res.quality.grade} · missing: {res.quality.missing.join(', ') || 'nothing'}</Note>}
    </div>
  );
}

/* 52358 — Platform-specific disclosure check. */
export function DisclosureCheck() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52358 · Platform disclosure check</h3>
      <button className="lc59-btn" onClick={() => setRes(LC.checkDisclosurePolicy(SAMPLE_DRAFT, 'intigriti', { embargoDays: 45, vendorConsent: false }, NOW))}>Check policy</button>
      {res && res.ok && <Note>compliant: {String(res.compliant)} · blockers: {res.blockers.join(' | ') || 'none'}</Note>}
    </div>
  );
}

/* 52359 — Finding lifecycle state machine. */
export function LifecycleStateMachine() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52359 · Lifecycle state machine</h3>
      <button className="lc59-btn" onClick={() => {
        let lc = LC.createLifecycle('f-61', NOW).lifecycle;
        lc = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'triaged', by: 'aria', reason: 'validated' }, NOW + 1).lifecycle;
        lc = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'confirmed', by: 'bhavesh' }, NOW + 2).lifecycle;
        const illegal = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'closed' }, NOW + 3);
        setRes({ lc, illegal });
      }}>Walk lifecycle</button>
      {res && <Note>state: {res.lc.state} · history: {res.lc.history.length} entries · illegal jump confirmed→closed: {res.illegal.reason}</Note>}
    </div>
  );
}

/* 52360 — Custom lifecycle states. */
export function CustomLifecycleStates() {
  const [res, setRes] = useState(null);
  return (
    <div className="lc59-card">
      <h3 className="lc59-title">52360 · Custom lifecycle states</h3>
      <button className="lc59-btn" onClick={() => {
        let lc = LC.createLifecycle('f-61', NOW).lifecycle;
        const added = LC.addCustomState(lc, { id: 'pen-test-review', label: 'Pen-test review', color: '#f59e0b', icon: 'shield', from: ['triaged'], to: ['confirmed'] });
        lc = added.lifecycle;
        lc = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'triaged' }, NOW + 1).lifecycle;
        lc = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'pen-test-review', by: 'aria' }, NOW + 2).lifecycle;
        const reserved = LC.addCustomState(lc, { id: 'closed' });
        setRes({ lc, count: LC.listLifecycleStates(lc).states.length, reserved });
      }}>Add custom state</button>
      {res && <Note>states: {res.count} · walked to custom state: {res.lc.state} · reserved id rejected: {res.reserved.reason}</Note>}
    </div>
  );
}

export const LC59_GALLERY = [
  SubmissionAnalytics, PerPlatformAcceptanceStats, DraftVersioning, CollaborativeDraftEditing,
  CredentialVault, TestModeSubmission, DryRunValidation, RateLimitHandling,
  SubmissionNotifications, WebhookReceiver, EarningsLeaderboard, TaxReportExport,
  DuplicateMergeView, ProgramDiscovery, ScopeDiffAlerts, SlaMonitor,
  ReportQualityScore, DisclosureCheck, LifecycleStateMachine, CustomLifecycleStates,
];

export function LifecycleMgmtGallery() {
  return (
    <div className="lc59-gallery">
      {LC59_GALLERY.map((C, i) => <C key={i} />)}
    </div>
  );
}
