/**
 * FPGovernance.jsx — Infinity AI · Dark-Matter · Wave 53
 * 20 working React components for FP governance ideas 52101–52120.
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './fpGovernCore.js';

const NOW = 1700000000000;
const PREV = {
  findingId: 'f-old', signature: 'xss-reflected', reasonId: 'not-reproducible',
  reasonLabel: 'Not reproducible', justification: 'WAF blocked the payload on retest', markedBy: 'ria',
};
const DECISIONS = [
  { findingId: 'f1', title: 'XSS', severity: 'medium', engine: 'vulnDetector', status: 'pending-second-review', markedBy: 'ria', markedAt: NOW + 1000, reasonId: 'not-reproducible', isFalsePositive: true, signature: 'xss-reflected', endpoint: '/search' },
  { findingId: 'f2', title: 'SQLi', severity: 'high', engine: 'vulnDetector', status: 'disputed', markedBy: 'sam', markedAt: NOW + 2000, reasonId: 'expected-behavior', isFalsePositive: true, signature: 'sqli-error', endpoint: '/api/users', dispute: { challengedBy: 'ria', resolution: 'overturned' } },
  { findingId: 'f3', title: 'CSRF', severity: 'low', engine: 'chainBuilder', status: 'likely-fp', markedBy: 'ria', markedAt: NOW + 3000, reasonId: 'test-data', isFalsePositive: true, signature: 'csrf-token', endpoint: '/search' },
];

/* 52101 — "Same as previous FP" one-click. */
export function FpSameAsPrevious() {
  const [applied, setApplied] = useState(null);
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52101 · Same as previous FP</h3>
      <p className="fpg53-note">previous: {PREV.reasonLabel} (by {PREV.markedBy})</p>
      <button className="fpg53-btn" onClick={() => setApplied(C.sameAsPreviousFp({ findingId: 'f-new', signature: 'xss-reflected' }, PREV, 'sam', NOW))}>Apply to f-new</button>
      {applied && <p className="fpg53-note">applied {applied.reasonId}{applied.signatureMatch ? ' · signature match' : ''}</p>}
    </div>
  );
}

/* 52102 — FP review queue. */
export function FpReviewQueue() {
  const [queue] = useState(() => C.buildFpReviewQueue(DECISIONS));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52102 · FP review queue</h3>
      <ul>{queue.map((q) => <li key={q.findingId} className="fpg53-item">{q.findingId}: {q.status} · {q.severity} · by {q.markedBy}</li>)}</ul>
    </div>
  );
}

/* 52103 — FP bulk import. */
export function FpBulkImport() {
  const [res, setRes] = useState(null);
  const run = () => setRes(C.importFpDecisions(
    [
      { findingId: 'ext-1', externalReason: 'auditor-dismissed', justification: 'auditor confirmed benign', markedBy: 'auditor' },
      { findingId: 'ext-2', externalReason: 'unknown-reason', markedBy: 'auditor' },
    ],
    { 'auditor-dismissed': 'expected-behavior' },
  ));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52103 · FP bulk import</h3>
      <button className="fpg53-btn" onClick={run}>Import 2 rows</button>
      {res && <p className="fpg53-note">imported {res.importedCount}, rejected {res.rejectedCount} ({res.rejected[0] && res.rejected[0].reason})</p>}
    </div>
  );
}

/* 52104 — FP custom reason fields. */
export function FpCustomReasons() {
  const [tax, setTax] = useState(() => C.extendReasonTaxonomy(
    [{ id: 'not-reproducible', label: 'Not reproducible' }],
    [{ id: 'pentest-window', label: 'Pentest window artifact' }, { id: 'not-reproducible', label: 'Dup' }, { id: '', label: '' }],
  ));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52104 · Custom reason fields</h3>
      <p className="fpg53-note">taxonomy {tax.taxonomy.length} · added {tax.added.length} · rejected {tax.rejected.length}</p>
      <ul>{tax.taxonomy.map((r) => <li key={r.id} className="fpg53-item">{r.id}{r.custom ? ' (custom)' : ''}</li>)}</ul>
    </div>
  );
}

/* 52105 — FP notification to hunt owner. */
export function FpOwnerNotify() {
  const [n] = useState(() => C.notifyHuntOwnerPayload(
    { findingId: 'f1', markedBy: 'ria', reasonId: 'not-reproducible', reasonLabel: 'Not reproducible', severity: 'high' },
    { userId: 'owner-bhavesh' },
  ));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52105 · Hunt-owner notification</h3>
      <p className="fpg53-note">{n.title}</p>
      <p className="fpg53-note">{n.body} · urgent: {String(n.urgent)}</p>
    </div>
  );
}

/* 52106 — FP changelog per finding. */
export function FpChangelog() {
  const [h, setH] = useState(() => C.logFpChange([], 'marked-fp', 'ria', { reasonId: 'not-reproducible' }, NOW).history);
  const [bogus, setBogus] = useState(null);
  const add = () => setH(C.logFpChange(h, 'dispute-opened', 'sam', { challenge: 'retest' }, NOW + 5000).history);
  const tryBogus = () => setBogus(C.logFpChange(h, 'bogus-event', 'x', {}, NOW));
  const s = C.fpChangelogSummary(h);
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52106 · FP changelog</h3>
      <p className="fpg53-note">{s.total} events · {JSON.stringify(s.counts)}{bogus && !bogus.ok ? ` · rejected: ${bogus.reason}` : ''}</p>
      <div className="fpg53-row">
        <button className="fpg53-btn" onClick={add}>Log dispute</button>
        <button className="fpg53-btn" onClick={tryBogus}>Log bogus</button>
      </div>
    </div>
  );
}

/* 52107 — Screenshot attach on FP justification. */
export function FpScreenshot() {
  const [m, setM] = useState({ findingId: 'f1' });
  const attach = (mime) => setM(C.attachScreenshot(m, { name: 'retest.png', mimeType: mime, sizeBytes: 120000, caption: 'manual retest', attachedAt: NOW }));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52107 · Screenshot attach</h3>
      <p className="fpg53-note">{(m.screenshots || []).length} attached{m.ok === false ? ` · rejected: ${m.reason}` : ''}</p>
      <div className="fpg53-row">
        <button className="fpg53-btn" onClick={() => attach('image/png')}>Attach PNG</button>
        <button className="fpg53-btn" onClick={() => attach('application/pdf')}>Attach PDF</button>
      </div>
    </div>
  );
}

/* 52108 — "Likely FP — needs human check" state. */
export function FpLikelyState() {
  const [m, setM] = useState(() => C.markLikelyFp({ findingId: 'f1', severity: 'medium' }, 0.82, NOW));
  const confirm = (isFp) => setM(C.confirmLikelyFp(m, 'ria', isFp, 'verified benign', NOW + 60000));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52108 · Likely-FP state</h3>
      <p className="fpg53-note">status: {m.status}{m.likelyFp ? ` · ${(m.likelyFp.probability * 100).toFixed(0)}% suspected` : ''}{m.likelyFp && m.likelyFp.confirmedBy ? ` · confirmed by ${m.likelyFp.confirmedBy}` : ''}</p>
      {m.status === 'likely-fp' && (
        <div className="fpg53-row">
          <button className="fpg53-btn" onClick={() => confirm(true)}>Confirm FP</button>
          <button className="fpg53-btn" onClick={() => confirm(false)}>Clear — real finding</button>
        </div>
      )}
    </div>
  );
}

/* 52109 — FP training-data export. */
export function FpTrainingExport() {
  const [ex] = useState(() => C.exportTrainingData([
    { findingId: 'f1', signature: 'xss-reflected', severity: 'medium', endpoint: '/search', evidence: [], isFalsePositive: true, reasonId: 'not-reproducible' },
    { findingId: 'f2', signature: 'sqli', severity: 'high', endpoint: '/login', evidence: ['e1'], isFalsePositive: false },
    { findingId: 'f3' },
  ]));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52109 · Training-data export</h3>
      <p className="fpg53-note">{ex.format} · {ex.fpCount} FP / {ex.tpCount} TP rows · skipped {ex.skipped.length}</p>
      <p className="fpg53-note">{ex.rows.map((r) => `${r.finding_id}:${r.label}`).join(' · ')}</p>
    </div>
  );
}

/* 52110 — FP stats on team dashboard. */
export function FpDashStats() {
  const [s] = useState(() => C.dashboardFpStats([
    ...DECISIONS.map((d) => ({ ...d, markedAt: NOW - 86400e3 })),
    { findingId: 'f9', reasonId: 'not-reproducible', markedAt: NOW - 30 * 86400e3, status: 'false-positive' },
  ], NOW));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52110 · Dashboard FP stats</h3>
      <p className="fpg53-note">this week: {s.weekCount} · pending second review: {s.pendingSecondReview}</p>
      <ul>{s.topReasons.map((r) => <li key={r.reasonId} className="fpg53-item">{r.reasonId}: {r.count}</li>)}</ul>
    </div>
  );
}

/* 52111 — FP reason analytics by reviewer. */
export function FpReviewerAnalytics() {
  const [rows] = useState(() => C.reviewerFpAnalytics(DECISIONS));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52111 · Reviewer analytics</h3>
      <ul>{rows.map((r) => <li key={r.reviewer} className="fpg53-item">{r.reviewer}: {r.dismissals} dismissals · overturn {(r.overturnRate * 100).toFixed(0)}%</li>)}</ul>
    </div>
  );
}

/* 52112 — FP review calibration sessions. */
export function FpCalibration() {
  const [s, setS] = useState(() => C.planCalibrationSession(DECISIONS, 2, NOW));
  const vote = (fid, agree) => setS(C.recordCalibrationVerdict(s, fid, 'lead', agree, 'ok'));
  const ag = C.calibrationAgreement(s);
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52112 · Calibration session</h3>
      <p className="fpg53-note">{s.sessionId} · {s.status} · agreement {(ag.agreementRate * 100).toFixed(0)}% ({ag.agree}/{ag.votes})</p>
      {s.items.map((it) => (
        <div key={it.findingId} className="fpg53-row">
          <span className="fpg53-label">{it.findingId}</span>
          <button className="fpg53-btn" onClick={() => vote(it.findingId, true)}>Agree</button>
          <button className="fpg53-btn" onClick={() => vote(it.findingId, false)}>Disagree</button>
        </div>
      ))}
    </div>
  );
}

/* 52113 — FP impact on agent scoring. */
export function FpAgentScore() {
  const [rows] = useState(() => C.agentFpScorecard(DECISIONS, { vulnDetector: { model: 'qwen2.5', version: 'v3' }, chainBuilder: { model: 'qwen2.5', version: 'v3' } }));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52113 · Agent FP scorecard</h3>
      <ul>{rows.map((r) => <li key={r.engineId} className="fpg53-item">{r.engineId} ({r.version}): quality {r.qualityScore} · {r.falsePositives}/{r.findings} FP</li>)}</ul>
    </div>
  );
}

/* 52114 — FP pattern clustering. */
export function FpClustering() {
  const [clusters] = useState(() => C.clusterFpPatterns([
    ...DECISIONS.map((d) => ({ ...d, reasonId: d.reasonId, signature: d.signature, endpoint: d.endpoint })),
    { findingId: 'f4', signature: 'xss-reflected', endpoint: '/search', reasonId: 'not-reproducible' },
    { findingId: 'f5', signature: 'xss-stored', endpoint: '/comments', reasonId: 'test-data' },
  ], 0.3));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52114 · FP pattern clustering</h3>
      <ul>{clusters.map((c) => <li key={c.clusterId} className="fpg53-item">cluster {c.clusterId}: {c.size} members · “{c.representativeSignature}” · top reason {c.topReason}</li>)}</ul>
    </div>
  );
}

/* 52115 — FP audit export for compliance. */
export function FpAuditExport() {
  const [ex] = useState(() => C.buildFpAuditExport(DECISIONS, 'compliance-lead', NOW));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52115 · Compliance audit export</h3>
      <p className="fpg53-note">{ex.rowCount} rows · {ex.columns.length} columns · by {ex.generatedBy}</p>
      <p className="fpg53-note">{ex.rows.map((r) => `${r.finding_id}/${r.marked_by}`).join(' · ')}</p>
    </div>
  );
}

/* 52116 — FP by detection engine. */
export function FpByEngine() {
  const [rows] = useState(() => C.fpRatesByEngine(DECISIONS));
  const [filtered, setFiltered] = useState([]);
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52116 · FP by detection engine</h3>
      <ul>{rows.map((r) => <li key={r.engine} className="fpg53-item">{r.engine}: {(r.fpRate * 100).toFixed(0)}% FP ({r.fps}/{r.findings})</li>)}</ul>
      <button className="fpg53-btn" onClick={() => setFiltered(C.filterFpByEngine(DECISIONS, 'vulnDetector'))}>Filter vulnDetector</button>
      {filtered.length > 0 && <p className="fpg53-note">{filtered.length} findings from vulnDetector</p>}
    </div>
  );
}

/* 52117 — FP comment threads. */
export function FpComments() {
  const [t, setT] = useState(() => C.newFpThread('f1', 'sam', NOW));
  const [text, setText] = useState('retest shows payload blocked');
  const add = () => setT(C.addFpComment(t, 'ria', text, NOW + 1000));
  const close = () => setT(C.closeFpThread(t, 'ria', NOW + 2000));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52117 · FP comment threads</h3>
      <p className="fpg53-note">thread {t.status} · {(t.comments || []).length} comments{t.ok === false ? ` · ${t.reason}` : ''}</p>
      {t.status === 'open' && (
        <div className="fpg53-row">
          <input className="fpg53-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="comment…" />
          <button className="fpg53-btn" onClick={add}>Comment</button>
          <button className="fpg53-btn" onClick={close}>Close</button>
        </div>
      )}
    </div>
  );
}

/* 52118 — "Not a vuln but hardening note" middle state. */
export function FpHardeningNote() {
  const [m, setM] = useState(null);
  const dismiss = (note) => setM(C.dismissWithHardeningNote({ findingId: 'f1', severity: 'medium' }, 'expected-behavior', note, 'ria', NOW));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52118 · Hardening-note dismissal</h3>
      <button className="fpg53-btn" onClick={() => dismiss('add rate limiting on /search')}>Dismiss w/ note</button>
      <button className="fpg53-btn" onClick={() => dismiss('  ')}>Dismiss w/o note</button>
      {m && <p className="fpg53-note">{m.ok ? `status ${m.status} · note: “${m.hardeningNote}”` : `rejected: ${m.reason}`}</p>}
    </div>
  );
}

/* 52119 — FP severity-downgrade alternative. */
export function FpDowngrade() {
  const [m, setM] = useState(null);
  const downgrade = (to) => setM(C.downgradeSeverity({ findingId: 'f1', severity: 'high' }, to, 'requires admin session', 'ria', NOW));
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52119 · Severity downgrade</h3>
      <div className="fpg53-row">
        <button className="fpg53-btn" onClick={() => downgrade('low')}>High → Low</button>
        <button className="fpg53-btn" onClick={() => downgrade('critical')}>High → Critical</button>
      </div>
      {m && <p className="fpg53-note">{m.ok ? `downgraded ${m.downgrade.from} → ${m.downgrade.to}` : `rejected: ${m.reason}`}</p>}
    </div>
  );
}

/* 52120 — FP notification digest controls. */
export function FpDigestControls() {
  const [prefs, setPrefs] = useState({ 'fp-marked': true, 'owner-alert': false });
  const rows = C.fpDigestControls(C.FP_NOTIFY_EVENTS, prefs);
  return (
    <div className="fpg53-card">
      <h3 className="fpg53-title">52120 · Digest controls</h3>
      {rows.map((r) => (
        <label key={r.event} className="fpg53-check">
          <input type="checkbox" checked={r.enabled} onChange={(e) => setPrefs({ ...prefs, [r.event]: e.target.checked })} />
          <span className="fpg53-label">{r.event}{r.known ? '' : ' (unknown)'}</span>
        </label>
      ))}
    </div>
  );
}

export function FPGovernanceGallery() {
  return (
    <div className="fpg53-gallery">
      <FpSameAsPrevious /><FpReviewQueue /><FpBulkImport /><FpCustomReasons />
      <FpOwnerNotify /><FpChangelog /><FpScreenshot /><FpLikelyState />
      <FpTrainingExport /><FpDashStats /><FpReviewerAnalytics /><FpCalibration />
      <FpAgentScore /><FpClustering /><FpAuditExport /><FpByEngine />
      <FpComments /><FpHardeningNote /><FpDowngrade /><FpDigestControls />
    </div>
  );
}
