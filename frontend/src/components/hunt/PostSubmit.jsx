/**
 * PostSubmit.jsx — Infinity AI · Dark-Matter · Wave 59
 * 20 working React components for post-hunt submission lifecycle, ideas 52321–52340.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as PS from './postSubmitCore.js';

const SAMPLE_FINDING = {
  id: 'f-61',
  title: 'Stored XSS in product reviews',
  severity: 'high',
  cvss: 8.2,
  vulnClass: 'xss',
  status: 'open',
  target: 'shop',
  platform: 'hackerone',
  endpoint: 'https://shop.example.com/reviews',
  description:
    'The review body is rendered without output encoding, so attacker markup executes in victim browsers.',
  impact: 'Session theft and account takeover for any user viewing a poisoned review.',
  poc: 'curl -X POST https://shop.example.com/reviews -d "body=<script>alert(1)</script>"',
  pocTrace: [
    'Log in as any user',
    'Post a review with body <script>alert(1)</script>',
    'View the product page — the script executes',
  ],
  evidence: [
    { kind: 'screenshot', name: 'xss-alert.png' },
    { kind: 'http', summary: 'POST /reviews 200' },
  ],
  remediation:
    'Encode review output with a context-aware encoder and deploy a strict Content-Security-Policy.',
  references: ['https://owasp.org/www-community/attacks/xss/'],
};

const SAMPLE_DRAFT = {
  id: 'draft-61',
  title: 'Stored XSS in product reviews',
  platform: 'hackerone',
  severity: 'High',
  summary: 'Stored XSS via unencoded review body.',
  steps: ['1. Log in', '2. Post review', '3. View page'],
  impact: 'Session theft.',
  remediation: null,
  attachments: [{ name: 'xss-alert.png', sizeBytes: 184320 }],
  asset: 'https://shop.example.com/reviews',
  cwe: 'CWE-79',
};

const NOW = 1700000000000;

function Note({ children }) {
  return <p className="psn59-note">{children}</p>;
}

/* 52321 — Remediation suggestion insert. */
export function RemediationSuggestionInsert() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52321 · Remediation suggestion insert</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.insertRemediation(SAMPLE_DRAFT, PS.suggestRemediation(SAMPLE_FINDING).remediation)
          )
        }
      >
        Insert remediation
      </button>
      {res && res.ok && (
        <Note>
          remediation attached ({res.draft.remediation.length} chars) · source:{' '}
          {res.draft.remediationSource}
        </Note>
      )}
    </div>
  );
}

/* 52322 — Researcher handle branding. */
export function ResearcherHandleBranding() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52322 · Researcher handle branding</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.applyResearcherBranding(SAMPLE_DRAFT, {
              handle: '@hunter_x',
              name: 'A. Hunter',
              profileLinks: ['https://hackerone.com/hunter_x', 'https://x.example.com/hunter_x'],
            })
          )
        }
      >
        Apply branding
      </button>
      {res && res.ok && <pre className="psn59-mono">{res.draft.signature}</pre>}
    </div>
  );
}

/* 52323 — Batch draft creation (grouped per platform). */
export function BatchDraftCreation() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52323 · Batch draft creation</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.createBatchDrafts(
              [SAMPLE_FINDING, { ...SAMPLE_FINDING, id: 'f-62', title: 'IDOR on orders' }],
              ['hackerone', 'bugcrowd'],
              (finding, platform) => ({
                ok: true,
                draft: { id: `d-${finding.id}-${platform}`, title: finding.title, platform },
              }),
              NOW
            )
          )
        }
      >
        Create batch
      </button>
      {res && res.ok && (
        <Note>
          batch {res.batch.id} · per-platform counts:{' '}
          {Object.entries(res.batch.counts)
            .map(([p, c]) => `${p}:${c}`)
            .join(', ')}{' '}
          · errors: {res.batch.errors.length}
        </Note>
      )}
    </div>
  );
}

/* 52324 — Submission queue with priority/owner/scheduled send times. */
export function SubmissionQueueView() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52324 · Submission queue</h3>
      <button
        className="psn59-btn"
        onClick={() => {
          let q = PS.createSubmissionQueue('post-hunt', NOW).queue;
          q = PS.enqueueSubmission(
            q,
            {
              draftId: 'd-1',
              platform: 'hackerone',
              priority: 'low',
              owner: 'aria',
              scheduledSendAt: NOW + 7200000,
            },
            NOW
          ).queue;
          q = PS.enqueueSubmission(
            q,
            { draftId: 'd-2', platform: 'bugcrowd', priority: 'urgent', owner: 'bhavesh' },
            NOW + 1
          ).queue;
          const due = PS.dequeueDueSubmissions(q, NOW + 1);
          setRes({ q, due });
        }}
      >
        Build queue
      </button>
      {res && (
        <Note>
          first in queue: {res.q.items[0].draftId} ({res.q.items[0].priority}) · due now:{' '}
          {res.due.due.map(d => d.draftId).join(', ')} · remaining: {res.due.remaining}
        </Note>
      )}
    </div>
  );
}

/* 52325 — Platform inbox sync. */
export function PlatformInboxSync() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52325 · Platform inbox sync</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.syncPlatformInbox(
              { syncedIds: [] },
              [
                { id: 'm-1', type: 'status', reportId: 'r-1', platformStatus: 'triaged' },
                {
                  id: 'm-2',
                  type: 'triager-message',
                  reportId: 'r-1',
                  from: 'triager',
                  body: 'Can you confirm impact?',
                },
                { id: 'm-1', type: 'status', reportId: 'r-1' },
                { id: 'm-3', type: 'bogus', reportId: 'r-1' },
              ],
              NOW
            )
          )
        }
      >
        Sync inbox
      </button>
      {res && res.ok && (
        <Note>
          applied {res.applied.length} message(s) · skipped {res.skipped} (dup/unknown type) ·
          lastSyncAt {res.state.lastSyncAt}
        </Note>
      )}
    </div>
  );
}

/* 52326 — Status-change sync. */
export function StatusChangeSync() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52326 · Status-change sync</h3>
      <button
        className="psn59-btn"
        onClick={() => setRes(PS.applyStatusChange(SAMPLE_FINDING, 'triaged', NOW))}
      >
        Apply triaged
      </button>
      {res && res.ok && (
        <Note>
          lifecycle → {res.finding.lifecycle} · history entries:{' '}
          {res.finding.lifecycleHistory.length} · source: {res.finding.lifecycleHistory[0].source}
        </Note>
      )}
    </div>
  );
}

/* 52327 — Bounty-paid tracking. */
export function BountyPaidTracking() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52327 · Bounty-paid tracking</h3>
      <button
        className="psn59-btn"
        onClick={() => {
          let ledger = PS.recordBountyPaid(
            [],
            {
              findingId: 'f-61',
              huntId: 'h-1',
              program: 'Acme',
              researcher: 'aria',
              amount: 750,
              platform: 'hackerone',
            },
            NOW
          ).ledger;
          ledger = PS.recordBountyPaid(
            ledger,
            {
              findingId: 'f-62',
              huntId: 'h-1',
              program: 'Acme',
              researcher: 'bhavesh',
              amount: 1500,
              platform: 'bugcrowd',
            },
            NOW + 1
          ).ledger;
          setRes({
            rollup: PS.rollUpEarnings(ledger, 'researcher'),
            program: PS.rollUpEarnings(ledger, 'program'),
          });
        }}
      >
        Record payouts
      </button>
      {res && (
        <Note>
          researchers:{' '}
          {Object.entries(res.rollup.totals)
            .map(([r, t]) => `${r}: $${t.total}`)
            .join(', ')}{' '}
          · program total: ${res.program.grandTotal}
        </Note>
      )}
    </div>
  );
}

/* 52328 — Safe-harbor verification. */
export function SafeHarborVerification() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52328 · Safe-harbor verification</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.verifySafeHarbor({ name: 'Acme', safeHarbor: { stated: true } }, SAMPLE_FINDING)
          )
        }
      >
        Verify
      </button>
      {res && res.ok && (
        <Note>
          safe harbor: {String(res.safeHarbor)} · checks:{' '}
          {res.checks.map(c => `${c.id}:${c.pass ? 'pass' : 'fail'}`).join(', ')} ·{' '}
          {res.warning || 'no warnings'}
        </Note>
      )}
    </div>
  );
}

/* 52329 — Out-of-scope warning with override reason. */
export function OutOfScopeWarning() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52329 · Out-of-scope warning</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes({
            blocked: PS.checkOutOfScope(SAMPLE_FINDING, { inScope: ['other.example.com'] }),
            overridden: PS.checkOutOfScope(
              SAMPLE_FINDING,
              { inScope: ['other.example.com'] },
              { reason: 'Vendor confirmed scope extension on call', by: 'bhavesh' },
              NOW
            ),
          })
        }
      >
        Check scope
      </button>
      {res && (
        <Note>
          no override → blocked: {res.blocked.reason} · with override → ok:{' '}
          {String(res.overridden.ok)} · {res.overridden.warning}
        </Note>
      )}
    </div>
  );
}

/* 52330 — PII scrub before submit. */
export function PiiScrubView() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52330 · PII scrub before submit</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.scrubPii(
              'Victim: jane.doe@example.com, phone +1 555-010-2030, token Bearer abc.def.ghi — curl with api_key=sk_live_9f8e7d6c5b4a'
            )
          )
        }
      >
        Scrub sample
      </button>
      {res && res.ok && (
        <Note>
          {res.redactedCount} redaction(s) (
          {res.redactions.map(r => `${r.id}:${r.count}`).join(', ')})
        </Note>
      )}
      {res && res.ok && <pre className="psn59-mono">{res.scrubbed}</pre>}
    </div>
  );
}

/* 52331 — Internal review queue. */
export function InternalReviewQueue() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52331 · Internal review queue</h3>
      <button
        className="psn59-btn"
        onClick={() => {
          const q0 = PS.createReviewQueue('pre-submit', NOW).queue;
          const added = PS.reviewReducer(
            q0,
            { type: 'ADD', draftId: 'draft-61', findingId: 'f-61', submittedBy: 'aria' },
            NOW + 1
          );
          const item = added.item;
          const inReview = PS.reviewReducer(
            added.queue,
            { type: 'TRANSITION', id: item.id, to: 'in-review', by: 'bhavesh' },
            NOW + 2
          ).queue;
          const approved = PS.reviewReducer(
            inReview,
            {
              type: 'TRANSITION',
              id: item.id,
              to: 'approved',
              by: 'bhavesh',
              note: 'Looks solid.',
            },
            NOW + 3
          ).queue;
          const badJump = PS.reviewReducer(
            q0,
            { type: 'TRANSITION', id: 'nope', to: 'approved' },
            NOW + 4
          );
          setRes({
            state: approved.items[0].state,
            notes: approved.items[0].notes.length,
            badJump,
          });
        }}
      >
        Run review flow
      </button>
      {res && (
        <Note>
          final state: {res.state} · reviewer notes: {res.notes} · illegal jump blocked silently,
          unknown id ignored
        </Note>
      )}
    </div>
  );
}

/* 52332 — Submitter approval chain (researcher → lead → legal). */
export function SubmitterApprovalChain() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52332 · Submitter approval chain</h3>
      <button
        className="psn59-btn"
        onClick={() => {
          let c = PS.createApprovalChain('f-61', { program: 'Acme' }, NOW).chain;
          c = PS.approvalChainReducer(
            c,
            { type: 'DECIDE', decision: 'approve', by: 'aria' },
            NOW + 1
          ).chain;
          c = PS.approvalChainReducer(
            c,
            { type: 'DECIDE', decision: 'approve', by: 'bhavesh' },
            NOW + 2
          ).chain;
          c = PS.approvalChainReducer(
            c,
            { type: 'DECIDE', decision: 'approve', by: 'legal@x.com' },
            NOW + 3
          ).chain;
          setRes({ chain: c });
        }}
      >
        Run chain
      </button>
      {res && (
        <Note>
          state: {res.chain.state} · approvals:{' '}
          {res.chain.steps.map(s => `${s.role}:${s.by || '-'}`).join(' → ')}
        </Note>
      )}
    </div>
  );
}

/* 52333 — Submission history log. */
export function SubmissionHistoryLog() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52333 · Submission history log</h3>
      <button
        className="psn59-btn"
        onClick={() => {
          let log = PS.appendSubmissionHistory(
            [],
            {
              draftId: 'draft-61',
              findingId: 'f-61',
              platform: 'hackerone',
              action: 'submitted',
              by: 'aria',
              response: 'accepted',
            },
            NOW
          ).log;
          log = PS.appendSubmissionHistory(
            log,
            {
              draftId: 'draft-61',
              findingId: 'f-61',
              platform: 'hackerone',
              action: 'bounty-awarded',
              by: 'platform',
              response: '$750',
            },
            NOW + 1
          ).log;
          setRes({
            all: log.length,
            filtered: PS.filterSubmissionHistory(log, { action: 'bounty-awarded' }).records.length,
          });
        }}
      >
        Append entries
      </button>
      {res && (
        <Note>
          {res.all} record(s) in log · filtered to bounty-awarded: {res.filtered}
        </Note>
      )}
    </div>
  );
}

/* 52334 — Resubmission after fix. */
export function ResubmissionAfterFix() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52334 · Resubmission after fix</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.buildResubmissionDraft(
              SAMPLE_FINDING,
              'Output encoding deployed; CSP header added.',
              NOW
            )
          )
        }
      >
        Build retest draft
      </button>
      {res && res.ok && (
        <Note>
          {res.draft.title} · {res.draft.retestSteps.length} retest step(s) · expected:{' '}
          {res.draft.expected}
        </Note>
      )}
    </div>
  );
}

/* 52335 — Platform message templates. */
export function PlatformMessageTemplates() {
  const [kind, setKind] = useState('triage-nudge');
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52335 · Platform message templates</h3>
      <div className="psn59-row">
        {Object.keys(PS.MESSAGE_TEMPLATES).map(k => (
          <button key={k} className="psn59-chip" onClick={() => setKind(k)}>
            {k}
          </button>
        ))}
      </div>
      <Note>{PS.fillMessageTemplate(kind, { handle: '@hunter_x' }).message.subject}</Note>
      <pre className="psn59-mono">
        {PS.fillMessageTemplate(kind, { handle: '@hunter_x' }).message.body}
      </pre>
    </div>
  );
}

/* 52336 — Triager-question draft replies. */
export function TriagerQuestionReplies() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52336 · Triager-question draft replies</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.draftTriagerReply('Can you show the exact reproduction steps again?', SAMPLE_FINDING)
          )
        }
      >
        Draft reply
      </button>
      {res && res.ok && (
        <Note>
          status: {res.reply.status} · grounded in: {res.reply.groundedIn.join(', ')}
        </Note>
      )}
      {res && res.ok && <pre className="psn59-mono">{res.reply.answer}</pre>}
    </div>
  );
}

/* 52337 — Mediation escalation draft. */
export function MediationEscalationDraft() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52337 · Mediation escalation draft</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.buildMediationDraft(
              { ...SAMPLE_FINDING, reportId: 'r-1', platformStatus: 'not-applicable' },
              [
                { type: 'status-change', at: NOW - 1000, note: 'closed as not-applicable' },
                { type: 'evidence', at: NOW, note: 'video PoC attached' },
              ],
              NOW
            )
          )
        }
      >
        Build mediation draft
      </button>
      {res && res.ok && (
        <Note>
          {res.draft.summary} · {res.draft.evidenceTrail.length} trail entries · status:{' '}
          {res.draft.status}
        </Note>
      )}
    </div>
  );
}

/* 52338 — Disclosure timeline tracker. */
export function DisclosureTimelineTracker() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52338 · Disclosure timeline tracker</h3>
      <button
        className="psn59-btn"
        onClick={() => {
          const tl = PS.createDisclosureTimeline(
            [
              { reportId: 'r-1', findingId: 'f-61', agreedDate: NOW + 5 * 24 * 3600 * 1000 },
              { reportId: 'r-2', findingId: 'f-62', agreedDate: NOW - 24 * 3600 * 1000 },
            ],
            NOW
          ).timeline;
          setRes(PS.upcomingDisclosures(tl, NOW));
        }}
      >
        Check timeline
      </button>
      {res && res.ok && (
        <Note>
          due within reminder window: {res.counts.due} (
          {res.due.map(d => `${d.reportId} in ${d.daysLeft}d`).join(', ')}) · lapsed:{' '}
          {res.counts.lapsed}
        </Note>
      )}
    </div>
  );
}

/* 52339 — Coordinated disclosure scheduler. */
export function CoordinatedDisclosureScheduler() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52339 · Coordinated disclosure scheduler</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.scheduleCoordinatedDisclosure(
              {
                findingId: 'f-61',
                vendor: 'Acme',
                reportedAt: NOW - 80 * 24 * 3600 * 1000,
                fixReleaseAt: NOW + 2 * 24 * 3600 * 1000,
                embargoDays: 90,
              },
              NOW
            )
          )
        }
      >
        Schedule disclosure
      </button>
      {res && res.ok && (
        <Note>
          public at {new Date(res.schedule.publicAt).toISOString().slice(0, 10)} · within 90-day
          embargo: {String(res.schedule.withinEmbargo)} · status: {res.schedule.status}
        </Note>
      )}
    </div>
  );
}

/* 52340 — CVE request draft. */
export function CveRequestDraft() {
  const [res, setRes] = useState(null);
  return (
    <div className="psn59-card">
      <h3 className="psn59-title">52340 · CVE request draft</h3>
      <button
        className="psn59-btn"
        onClick={() =>
          setRes(
            PS.buildCveRequestDraft(
              { ...SAMPLE_FINDING, cwes: ['CWE-79'] },
              { product: 'Acme Shop', vendor: 'Acme', version: '2.4.1', reporter: '@hunter_x' }
            )
          )
        }
      >
        Build CVE draft
      </button>
      {res && res.ok && (
        <Note>
          {res.draft.title} · {res.draft.product} {res.draft.version} · CWE{' '}
          {res.draft.cwe.join(', ')} · CVSS {res.draft.cvss} · status: {res.draft.status}
        </Note>
      )}
    </div>
  );
}

export const PSN59_GALLERY = [
  RemediationSuggestionInsert,
  ResearcherHandleBranding,
  BatchDraftCreation,
  SubmissionQueueView,
  PlatformInboxSync,
  StatusChangeSync,
  BountyPaidTracking,
  SafeHarborVerification,
  OutOfScopeWarning,
  PiiScrubView,
  InternalReviewQueue,
  SubmitterApprovalChain,
  SubmissionHistoryLog,
  ResubmissionAfterFix,
  PlatformMessageTemplates,
  TriagerQuestionReplies,
  MediationEscalationDraft,
  DisclosureTimelineTracker,
  CoordinatedDisclosureScheduler,
  CveRequestDraft,
];

export function PostSubmitGallery() {
  return (
    <div className="psn59-gallery">
      {PSN59_GALLERY.map((C, i) => (
        <C key={i} />
      ))}
    </div>
  );
}
