/**
 * RetestRound4.jsx — Infinity AI · Dark-Matter · Wave 55
 * 21 working React components for the retest round-4 suite, ideas 52161–52181.
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './retestRound4Core.js';

const SAMPLE_VERDICT = { findingId: 'f-101', retestId: 'rt-0001', verdict: 'fixed' };
const SAMPLE_FINDINGS = [
  {
    id: 'f-101',
    title: 'Reflected XSS on /search',
    severity: 'high',
    status: 'open',
    target: 'shop',
    asset: 'shop-web',
  },
  {
    id: 'f-102',
    title: 'SQL injection on /login',
    severity: 'critical',
    status: 'open',
    target: 'shop',
    asset: 'shop-web',
  },
  {
    id: 'f-103',
    title: 'Missing security headers',
    severity: 'low',
    status: 'open',
    target: 'blog',
    asset: 'blog-web',
  },
];
const NOW = 1700000000000;

/* 52161 — Retest sign-off. */
export function RetestSignOff() {
  const [res, setRes] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52161 · Retest sign-off</h3>
      <p className="rr4-note">Verdict: fixed on f-101. Sign-off closes the finding.</p>
      <div className="rr4-row">
        <button
          className="rr4-btn"
          onClick={() => setRes(C.signOffRetest(SAMPLE_VERDICT, 'approved', 'ria', NOW))}
        >
          Approve
        </button>
        <button
          className="rr4-btn rr4-btn-ghost"
          onClick={() => setRes(C.signOffRetest(SAMPLE_VERDICT, 'rejected', 'ria', NOW))}
        >
          Reject
        </button>
      </div>
      {res && (
        <p className="rr4-note">
          {res.ok
            ? `state: ${res.signOff.state} · closes finding: ${String(res.signOff.closesFinding)}`
            : `error: ${res.reason}`}
        </p>
      )}
    </div>
  );
}

/* 52162 — Retest comments and attachments. */
export function RetestCommentsAttachments() {
  const req = { id: 'rt-0001', findingId: 'f-101' };
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('Retest passed on staging, screenshots attached.');
  const add = () => {
    const r = C.addRetestComment(req, draft, 'ria', NOW);
    if (r.ok) setComments(c => [...c, r.comment]);
  };
  const attach = () => {
    const r = C.addRetestAttachment(
      req,
      { name: 'evidence.png', kind: 'screenshot', mime: 'image/png', sizeBytes: 48210 },
      NOW
    );
    if (r.ok)
      setComments(c => [
        ...c,
        {
          id: r.attachment.id,
          author: r.attachment.addedBy,
          body: `attachment: ${r.attachment.name}`,
        },
      ]);
  };
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52162 · Retest comments and attachments</h3>
      <input className="rr4-input" value={draft} onChange={e => setDraft(e.target.value)} />
      <div className="rr4-row">
        <button className="rr4-btn" onClick={add}>
          Add comment
        </button>
        <button className="rr4-btn rr4-btn-ghost" onClick={attach}>
          Attach screenshot
        </button>
      </div>
      <ul className="rr4-list">
        {comments.map(c => (
          <li key={c.id} className="rr4-note">
            <strong>{c.author}:</strong> {c.body}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52163 — CI-integrated retest. */
export function CiIntegratedRetest() {
  const results = [
    { findingId: 'f-101', retestId: 'rt-0001', verdict: 'fixed' },
    { findingId: 'f-102', retestId: 'rt-0002', verdict: 'still-vulnerable' },
  ];
  const [gate, setGate] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52163 · CI-integrated retest</h3>
      <button className="rr4-btn" onClick={() => setGate(C.evaluateCIGate(results))}>
        Evaluate merge gate
      </button>
      {gate && (
        <p className="rr4-note">
          gate {gate.pass ? 'PASSES' : 'BLOCKED'} · {gate.evaluated} retests · blockers:{' '}
          {gate.blockers.length}
          {gate.blockers.length > 0 && ` (${gate.blockers.map(b => b.findingId).join(', ')})`}
        </p>
      )}
    </div>
  );
}

/* 52164 — Retest API. */
export function RetestApiPanel() {
  const [res, setRes] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52164 · Retest API</h3>
      <div className="rr4-row">
        <button
          className="rr4-btn"
          onClick={() => setRes(C.handleRetestApiCall('request', { findingId: 'f-101' }, NOW))}
        >
          POST /request
        </button>
        <button
          className="rr4-btn rr4-btn-ghost"
          onClick={() => setRes(C.handleRetestApiCall('status', { id: 'rt-0001' }, NOW))}
        >
          GET /status
        </button>
        <button
          className="rr4-btn rr4-btn-ghost"
          onClick={() =>
            setRes(C.handleRetestApiCall('cancel', { id: 'rt-0001', reason: 'stale' }, NOW))
          }
        >
          DELETE /cancel
        </button>
      </div>
      {res && (
        <p className="rr4-note">{res.ok ? JSON.stringify(res.data) : `error: ${res.error}`}</p>
      )}
    </div>
  );
}

/* 52165 — Retest from PDF report (deep links). */
export function RetestDeepLink() {
  const [link, setLink] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52165 · Retest from PDF report</h3>
      <button className="rr4-btn" onClick={() => setLink(C.buildFindingDeepLink('f-101'))}>
        Build deep link
      </button>
      {link && link.ok && (
        <p className="rr4-note">
          <a className="rr4-link" href={link.url}>
            {link.label}
          </a>
        </p>
      )}
    </div>
  );
}

/* 52166 — Retest on bounty-status change. */
export function BountyStatusRetestTrigger() {
  const [res, setRes] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52166 · Retest on bounty-status change</h3>
      <button
        className="rr4-btn"
        onClick={() =>
          setRes(
            C.onBountyStatusChange(
              { findingId: 'f-102', status: 'needs-retest', previousStatus: 'triaged' },
              NOW
            )
          )
        }
      >
        Simulate “needs retest”
      </button>
      {res && (
        <p className="rr4-note">
          {res.ok
            ? `auto-queued ${res.request.id} · priority ${res.request.priority}`
            : `skipped: ${res.reason}`}
        </p>
      )}
    </div>
  );
}

/* 52167 — Retest reminders. */
export function RetestReminders() {
  const queue = [
    {
      id: 'rt-0001',
      findingId: 'f-101',
      status: 'queued',
      assignee: 'ria',
      windowEnd: NOW - 3600000,
    },
    {
      id: 'rt-0002',
      findingId: 'f-102',
      status: 'queued',
      assignee: 'dev',
      windowEnd: NOW + 3600000,
    },
  ];
  const [due, setDue] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52167 · Retest reminders</h3>
      <button className="rr4-btn" onClick={() => setDue(C.dueReminders(queue, NOW))}>
        Check overdue
      </button>
      {due && (
        <ul className="rr4-list">
          {due.map(d => (
            <li key={d.requestId} className="rr4-note">
              nudge {d.assignee}: {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* 52168 — Retest analytics. */
export function RetestAnalytics() {
  const rows = [
    {
      findingId: 'f-101',
      verdict: 'fixed',
      team: 'web',
      asset: 'shop-web',
      startedAt: NOW - 7200000,
      completedAt: NOW - 3600000,
    },
    {
      findingId: 'f-102',
      verdict: 'still-vulnerable',
      team: 'web',
      asset: 'shop-web',
      startedAt: NOW - 7200000,
      completedAt: NOW - 1800000,
    },
    {
      findingId: 'f-103',
      verdict: 'fixed',
      team: 'cms',
      asset: 'blog-web',
      startedAt: NOW - 5400000,
      completedAt: NOW - 3600000,
    },
  ];
  const [stats, setStats] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52168 · Retest analytics</h3>
      <button className="rr4-btn" onClick={() => setStats(C.retestAnalytics(rows))}>
        Compute analytics
      </button>
      {stats && (
        <div className="rr4-note">
          <p>
            fix-verification rate: {(stats.fixVerificationRate * 100).toFixed(0)}% ·
            still-vulnerable: {(stats.stillVulnerableRate * 100).toFixed(0)}% · avg turnaround:{' '}
            {(stats.avgTurnaroundMs / 60000).toFixed(1)} min
          </p>
          <p>
            by team:{' '}
            {Object.entries(stats.byTeam)
              .map(([t, v]) => `${t} ${(v.fixVerificationRate * 100).toFixed(0)}%`)
              .join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}

/* 52169 — Chained-finding retest. */
export function ChainedFindingRetest() {
  const [batch, setBatch] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52169 · Chained-finding retest</h3>
      <button
        className="rr4-btn"
        onClick={() =>
          setBatch(C.queueChainRetest({ id: 'chain-7', findingIds: ['f-101', 'f-102'] }, {}, NOW))
        }
      >
        Queue chain retest
      </button>
      {batch && batch.ok && (
        <p className="rr4-note">
          batch {batch.batch.id}: {batch.batch.count || batch.batch.requests.length} findings queued
          together
        </p>
      )}
    </div>
  );
}

/* 52170 — Retest with proxy capture. */
export function RetestProxyCapture() {
  const [cap, setCap] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52170 · Retest with proxy capture</h3>
      <button
        className="rr4-btn"
        onClick={() => setCap(C.buildProxyCaptureConfig('https://shop.example.com/search?q=xss'))}
      >
        Enable proxy capture
      </button>
      {cap && cap.ok && (
        <p className="rr4-note">
          capture {cap.capture.id} → {cap.capture.proxy} · max{' '}
          {(cap.capture.maxBytes / 1048576).toFixed(0)} MB
        </p>
      )}
    </div>
  );
}
/* 52171 — Retest evidence diff highlighting. */
export function RetestEvidenceDiff() {
  const before =
    'HTTP/1.1 200 OK\nContent-Type: text/html\n\n<html><script>alert(1)</script></html>';
  const after =
    'HTTP/1.1 200 OK\nContent-Type: text/html\n\n<html>&lt;script&gt;alert(1)&lt;/script&gt;</html>';
  const [diff, setDiff] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52171 · Retest evidence diff highlighting</h3>
      <button className="rr4-btn" onClick={() => setDiff(C.diffEvidenceTokens(before, after))}>
        Diff evidence
      </button>
      {diff && (
        <p className="rr4-note">
          <span className="rr4-diff-added">
            {diff.ops.filter(o => o.type === 'added').length} added
          </span>
          {' · '}
          <span className="rr4-diff-removed">
            {diff.ops.filter(o => o.type === 'removed').length} removed
          </span>
          {' · '}
          {diff.unchanged} unchanged tokens
        </p>
      )}
    </div>
  );
}

/* 52172 — Bulk retest by severity. */
export function BulkRetestBySeverity() {
  const [sev, setSev] = useState('high');
  const [batch, setBatch] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52172 · Bulk retest by severity</h3>
      <select className="rr4-input" value={sev} onChange={e => setSev(e.target.value)}>
        {['critical', 'high', 'medium', 'low'].map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        className="rr4-btn"
        onClick={() => setBatch(C.bulkQueueBySeverity(SAMPLE_FINDINGS, sev, {}, NOW))}
      >
        Queue bulk retest
      </button>
      {batch && batch.ok && (
        <p className="rr4-note">
          {batch.batch.count} findings queued at ≥ {batch.batch.minSeverity}
        </p>
      )}
    </div>
  );
}

/* 52173 — Bulk retest by asset. */
export function BulkRetestByAsset() {
  const [batch, setBatch] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52173 · Bulk retest by asset</h3>
      <button
        className="rr4-btn"
        onClick={() => setBatch(C.bulkQueueByAsset(SAMPLE_FINDINGS, ['shop-web'], {}, NOW))}
      >
        Queue after infra change
      </button>
      {batch && batch.ok && (
        <p className="rr4-note">
          {batch.batch.count} findings on {batch.batch.assets.join(', ')} queued
        </p>
      )}
    </div>
  );
}

/* 52174 — Retest request export (CSV). */
export function RetestQueueExport() {
  const queue = [
    {
      id: 'rt-0001',
      findingId: 'f-101',
      status: 'queued',
      priority: 'urgent',
      trigger: 'fix-deployed',
      requestedAt: NOW,
    },
    {
      id: 'rt-0002',
      findingId: 'f-102',
      status: 'running',
      priority: 'normal',
      trigger: 'manual',
      requestedAt: NOW - 60000,
    },
  ];
  const [out, setOut] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52174 · Retest request export</h3>
      <button className="rr4-btn" onClick={() => setOut(C.queueToCsv(queue))}>
        Export queue CSV
      </button>
      {out && <pre className="rr4-mono">{out.csv}</pre>}
    </div>
  );
}

/* 52175 — Retest duplicate detection. */
export function RetestDuplicateDetection() {
  const existing = [
    {
      id: 'rt-0001',
      findingId: 'f-101',
      trigger: 'manual',
      status: 'completed',
      completedAt: NOW - 86400000,
    },
    { id: 'rt-0002', findingId: 'f-102', trigger: 'manual', status: 'queued' },
  ];
  const [res, setRes] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52175 · Retest duplicate detection</h3>
      <div className="rr4-row">
        <button
          className="rr4-btn"
          onClick={() =>
            setRes(
              C.findDuplicate({ id: 'rt-new', findingId: 'f-102', trigger: 'manual' }, existing, {
                now: NOW,
              })
            )
          }
        >
          Check f-102
        </button>
        <button
          className="rr4-btn rr4-btn-ghost"
          onClick={() =>
            setRes(
              C.findDuplicate({ id: 'rt-new', findingId: 'f-103', trigger: 'manual' }, existing, {
                now: NOW,
              })
            )
          }
        >
          Check f-103
        </button>
      </div>
      {res && (
        <p className="rr4-note">
          {res.ok && res.duplicate ? `duplicate of ${res.matchedId}` : 'no duplicate'}
        </p>
      )}
    </div>
  );
}

/* 52176 — Retest auto-trigger on WAF change. */
export function WafChangeRetestTrigger() {
  const withWaf = [...SAMPLE_FINDINGS.map(f => ({ ...f, wafBlocked: f.id === 'f-101' }))];
  const [batch, setBatch] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52176 · Retest auto-trigger on WAF change</h3>
      <button
        className="rr4-btn"
        onClick={() =>
          setBatch(C.wafChangeTrigger({ target: 'shop-web', changeId: 'waf-88' }, withWaf, NOW))
        }
      >
        Simulate WAF change
      </button>
      {batch && batch.ok && (
        <p className="rr4-note">{batch.batch.count} previously WAF-blocked findings auto-queued</p>
      )}
    </div>
  );
}

/* 52177 — Retest notification preferences. */
export function RetestNotificationPrefs() {
  const [prefs, setPrefs] = useState({
    queued: true,
    started: false,
    completed: true,
    failed: true,
    channels: ['in-app', 'email'],
  });
  const [res, setRes] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52177 · Retest notification preferences</h3>
      {C.RETEST_EVENT_KINDS.map(k => (
        <label key={k} className="rr4-check">
          <input
            type="checkbox"
            checked={prefs[k]}
            onChange={() => setPrefs(p => ({ ...p, [k]: !p[k] }))}
          />{' '}
          {k}
        </label>
      ))}
      <button
        className="rr4-btn"
        onClick={() => setRes(C.evaluateNotificationPrefs(prefs, { kind: 'started' }))}
      >
        Test “started” event
      </button>
      {res && (
        <p className="rr4-note">
          {res.notify ? `notify via ${res.channels.join(', ')}` : 'muted by preferences'}
        </p>
      )}
    </div>
  );
}

/* 52178 — Retest queue reordering. */
export function RetestQueueReorder() {
  const [queue, setQueue] = useState([
    { id: 'rt-0001', findingId: 'f-101', status: 'queued' },
    { id: 'rt-0002', findingId: 'f-102', status: 'queued' },
    { id: 'rt-0003', findingId: 'f-103', status: 'running' },
  ]);
  const move = (id, dir) => {
    const r = C.reorderQueue(queue, id, dir);
    if (r.ok) setQueue(r.queue);
  };
  const pending = queue.filter(r => r.status === 'queued');
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52178 · Retest queue reordering</h3>
      <ul className="rr4-list">
        {pending.map(r => (
          <li key={r.id} className="rr4-note">
            {r.id} ({r.findingId})
            <span className="rr4-row">
              <button className="rr4-btn rr4-btn-small" onClick={() => move(r.id, 'up')}>
                ↑
              </button>
              <button className="rr4-btn rr4-btn-small" onClick={() => move(r.id, 'down')}>
                ↓
              </button>
              <button className="rr4-btn rr4-btn-small" onClick={() => move(r.id, 'to-top')}>
                top
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52179 — Retest scoped to fix commit. */
export function RetestScopedToCommit() {
  const [res, setRes] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52179 · Retest scoped to fix commit</h3>
      <button
        className="rr4-btn"
        onClick={() =>
          setRes(
            C.scopeRetestToCommit(
              { id: 'rt-0001', findingId: 'f-101' },
              { sha: 'a1b2c3d4', message: 'fix reflected xss escaping' }
            )
          )
        }
      >
        Pin to commit a1b2c3d4
      </button>
      {res && res.ok && (
        <p className="rr4-note">
          retest {res.request.id} pinned to {res.request.fixCommit}
        </p>
      )}
    </div>
  );
}

/* 52180 — Retest evidence retention policy. */
export function RetestRetentionPolicy() {
  const items = [
    { id: 'cap-1', capturedAt: NOW - 100 * 86400000 },
    { id: 'cap-2', capturedAt: NOW - 10 * 86400000 },
  ];
  const [plan, setPlan] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52180 · Retest evidence retention policy</h3>
      <button
        className="rr4-btn"
        onClick={() => setPlan(C.retentionCleanupPlan(items, { days: 90 }, NOW))}
      >
        Run 90-day cleanup plan
      </button>
      {plan && (
        <p className="rr4-note">
          delete {plan.dueForDeletion.length} ({plan.dueForDeletion.join(', ') || 'none'}) · keep{' '}
          {plan.kept.length}
        </p>
      )}
    </div>
  );
}

/* 52181 — Retest verdict confidence. */
export function RetestVerdictConfidence() {
  const [res, setRes] = useState(null);
  return (
    <div className="rr4-card">
      <h3 className="rr4-title">52181 · Retest verdict confidence</h3>
      <button
        className="rr4-btn"
        onClick={() =>
          setRes(
            C.scoreVerdictConfidence(
              { verdict: 'fixed', findingId: 'f-101' },
              { probes: 6, agreement: 1, evidenceStrength: 'strong' }
            )
          )
        }
      >
        Score confidence
      </button>
      {res && res.ok && (
        <p className="rr4-note">
          confidence{' '}
          <span className={`rr4-conf rr4-conf-${res.level}`}>
            {res.level} ({res.score})
          </span>
          {res.needsManualReview && ' — flagged for manual review'}
        </p>
      )}
    </div>
  );
}

/* Gallery wrapper: renders every round-4 component in a grid. */
export function RetestRound4Gallery() {
  return (
    <div className="rr4-gallery">
      <RetestSignOff />
      <RetestCommentsAttachments />
      <CiIntegratedRetest />
      <RetestApiPanel />
      <RetestDeepLink />
      <BountyStatusRetestTrigger />
      <RetestReminders />
      <RetestAnalytics />
      <ChainedFindingRetest />
      <RetestProxyCapture />
      <RetestEvidenceDiff />
      <BulkRetestBySeverity />
      <BulkRetestByAsset />
      <RetestQueueExport />
      <RetestDuplicateDetection />
      <WafChangeRetestTrigger />
      <RetestNotificationPrefs />
      <RetestQueueReorder />
      <RetestScopedToCommit />
      <RetestRetentionPolicy />
      <RetestVerdictConfidence />
    </div>
  );
}
