/**
 * FPManagement.jsx — Infinity AI · Dark-Matter · Wave 52
 * 17 working React components for false-positive management ideas 52064–52080.
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './fpCore.js';

const SAMPLE_FP = {
  findingId: 'f2', vulnClass: 'xss', engine: 'vulnDetector', severity: 'medium',
  evidence: [], responseBody: '403 WAF blocked payload', title: 'Possible XSS', asset: 'shop',
  status: 'open', foundAt: 1699999000000,
};
const SAMPLE_MARKINGS = [
  { vulnClass: 'xss', target: 'shop', engine: 'vulnDetector', isFalsePositive: true, reasonId: 'not-reproducible', markedBy: 'ria', markedAt: 1700000001000, foundAt: 1699999000000 },
  { vulnClass: 'xss', target: 'shop', engine: 'vulnDetector', isFalsePositive: true, reasonId: 'not-reproducible', markedBy: 'sam', markedAt: 1700000002000, foundAt: 1699999100000 },
  { vulnClass: 'sqli', target: 'blog', engine: 'vulnDetector', isFalsePositive: true, reasonId: 'expected-behavior', markedBy: 'ria', markedAt: 1700000003000, foundAt: 1699999200000 },
  { vulnClass: 'auth', target: 'shop', engine: 'chainBuilder', isFalsePositive: false },
];

/* 52064 — Structured FP reason picker. */
export function FpReasonPicker() {
  const [picked, setPicked] = useState(null);
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52064 · FP reason picker</h3>
      {C.FP_REASONS.map((r) => (
        <button key={r.id} className="fp52-btn" onClick={() => setPicked(C.pickFpReason(r.id, 'verified'))}>{r.label}</button>
      ))}
      {picked && <p className="fp52-note">picked: {picked.label}</p>}
    </div>
  );
}

/* 52065 — Free-text FP justification requirement. */
export function FpJustification() {
  const [text, setText] = useState('');
  const v = C.validateJustification(text, 8);
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52065 · FP justification</h3>
      <textarea className="fp52-input" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Write why this high-severity finding is a false positive…" />
      <p className="fp52-note">{v.words}/{v.required} words — {v.ok ? 'acceptable' : v.reason}</p>
    </div>
  );
}

/* 52066 — Evidence-linked FP marking. */
export function FpEvidenceLink() {
  const [m, setM] = useState({ findingId: 'f2', reasonId: 'not-reproducible' });
  const link = () => setM(C.linkEvidence(m, { label: 'WAF block page', content: '<html>blocked by WAF</html>', capturedAt: 1700000000000 }));
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52066 · Evidence-linked FP</h3>
      <button className="fp52-btn" onClick={link}>Attach WAF block page</button>
      {m.evidenceLink && <p className="fp52-note">{m.evidenceLink.label}: {m.evidenceLink.content.slice(0, 40)}…</p>}
    </div>
  );
}

/* 52067 — FP confidence score. */
export function FpConfidence() {
  const score = C.fpConfidenceScore(SAMPLE_FP);
  const sorted = [SAMPLE_FP, { ...SAMPLE_FP, evidence: [{ t: 'req' }], responseBody: '200 ok' }]
    .map((f) => ({ id: f.findingId || 'f', score: C.fpConfidenceScore(f) }))
    .sort((a, b) => b.score - a.score);
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52067 · FP confidence score</h3>
      <p className="fp52-note">this finding: {score}</p>
      <ul className="fp52-list">
        {sorted.map((s) => <li key={s.id} className="fp52-item">fp likelihood {s.score}</li>)}
      </ul>
    </div>
  );
}

/* 52068 — "Marked by / when" attribution. */
export function FpAttribution() {
  const a = C.attributeFpMarking({ by: 'ria', at: 1700000001000 });
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52068 · Marked by / when</h3>
      {a.ok
        ? <p className="fp52-note">marked by {a.markedBy} at {new Date(a.markedAt).toISOString()} · <a className="fp52-link" href={`#${a.contact}`}>contact reviewer</a></p>
        : <p className="fp52-note">{a.reason}</p>}
    </div>
  );
}

/* 52069 — FP feedback loop to learning engine. */
export function FpFeedbackLoop() {
  const [sample, setSample] = useState(null);
  const feed = () => setSample(C.buildTrainingSample({ findingId: 'f2', reasonId: 'not-reproducible', vulnClass: 'xss', engine: 'vulnDetector', notes: 'verified' }));
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52069 · FP feedback loop</h3>
      <button className="fp52-btn" onClick={feed}>Feed to learning engine</button>
      {sample && <p className="fp52-note">labeled sample: {sample.label} · {sample.reasonId} · {sample.engine}</p>}
    </div>
  );
}

/* 52070 — Auto-suggested FP reason. */
export function FpAutoSuggest() {
  const history = [
    { vulnClass: 'xss', reasonId: 'not-reproducible' },
    { vulnClass: 'xss', reasonId: 'not-reproducible' },
    { vulnClass: 'xss', reasonId: 'expected-behavior' },
  ];
  const s = C.suggestFpReason({ vulnClass: 'xss' }, history);
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52070 · Auto-suggested FP reason</h3>
      <p className="fp52-note">{s.suggestion ? `suggested: ${s.label} (${s.votes} past votes)` : s.reason}</p>
    </div>
  );
}

/* 52071 — FP rate per vulnerability class. */
export function FpRateByClass() {
  const rows = C.fpRateByClass(SAMPLE_MARKINGS);
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52071 · FP rate per vuln class</h3>
      <ul className="fp52-list">
        {rows.map((r) => <li key={r.vulnClass} className="fp52-item">{r.vulnClass}: {r.fps}/{r.total} → {Math.round(r.rate * 100)}%</li>)}
      </ul>
    </div>
  );
}

/* 52072 — FP rate per target. */
export function FpRateByTarget() {
  const rows = C.fpRateByTarget(SAMPLE_MARKINGS);
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52072 · FP rate per target</h3>
      <ul className="fp52-list">
        {rows.map((r) => <li key={r.target} className="fp52-item">{r.target}: {r.fps}/{r.total} → {Math.round(r.rate * 100)}%</li>)}
      </ul>
    </div>
  );
}

/* 52073 — FP leaderboard per detection engine. */
export function FpEngineLeaderboard() {
  const rows = C.engineFpLeaderboard(SAMPLE_MARKINGS);
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52073 · FP leaderboard per engine</h3>
      <ol className="fp52-list">
        {rows.map((r) => <li key={r.engine} className="fp52-item">{r.engine}: {Math.round(r.fpRate * 100)}% FP over {r.total} findings</li>)}
      </ol>
    </div>
  );
}

/* 52074 — One-click FP unmark. */
export function FpUnmark() {
  const [state, setState] = useState({ id: 'f2', fpMarked: true, status: 'dismissed-fp', priorStatus: 'open' });
  const [log, setLog] = useState(null);
  const unmark = () => {
    const r = C.unmarkFp(state, 1700000009000);
    if (r.ok) { setState(r.finding); setLog(r.reversalLog); }
  };
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52074 · One-click FP unmark</h3>
      <p className="fp52-note">status: {state.status} · fpMarked: {String(state.fpMarked)}</p>
      {state.fpMarked && <button className="fp52-btn" onClick={unmark}>Unmark FP</button>}
      {log && <p className="fp52-note">reversal logged: {log.action} → {log.restoredStatus}</p>}
    </div>
  );
}

/* 52075 — Two-reviewer FP approval. */
export function FpTwoReviewer() {
  const [flow, setFlow] = useState(null);
  const request = () => setFlow({ pending: C.requestFpApproval({ id: 'f3', severity: 'critical' }, 'ria', 1700000000000), result: null });
  const decide = (approver, approve) => setFlow((s) => ({ ...s, result: C.approveFpApproval(s.pending, approver, approve, 1700000001000) }));
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52075 · Two-reviewer FP approval</h3>
      <button className="fp52-btn" onClick={request}>Request FP dismissal</button>
      {flow && <p className="fp52-note">status: {flow.pending.status}</p>}
      {flow && flow.pending.needsSecond && (
        <div className="fp52-note">
          <button className="fp52-btn" onClick={() => decide('sam', true)}>Approve (sam)</button>
          <button className="fp52-btn" onClick={() => decide('sam', false)}>Reject (sam)</button>
        </div>
      )}
      {flow && flow.result && <p className="fp52-note">final: {flow.result.final}</p>}
    </div>
  );
}

/* 52076 — Bulk FP marking with shared reason. */
export function FpBulkMark() {
  const [result, setResult] = useState(null);
  const mark = () => setResult(C.bulkMarkFp([{ id: 'f1', status: 'open' }, { id: 'f2', status: 'open' }], 'test-artifact', 'ria', 1700000000000));
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52076 · Bulk FP marking</h3>
      <button className="fp52-btn" onClick={mark}>Mark 2 as test artifact</button>
      {result && <p className="fp52-note">{result.count} marked under “{result.label}”</p>}
    </div>
  );
}

/* 52077 — FP reason templates. */
export function FpReasonTemplates() {
  const [templates, setTemplates] = useState(C.FP_TEMPLATE_SAMPLES);
  const [applied, setApplied] = useState(null);
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52077 · FP reason templates</h3>
      {templates.map((t) => (
        <button key={t.id} className="fp52-btn" onClick={() => setApplied(C.getFpTemplate(t.id, templates))}>{t.id}</button>
      ))}
      <button className="fp52-btn" onClick={() => setTemplates(C.saveFpTemplate(templates, 'Response timing matches the CDN cache profile', 'sam').templates)}>Save new</button>
      {applied && applied.ok && <p className="fp52-note">{applied.text}</p>}
    </div>
  );
}

/* 52078 — "Teach the agent" button. */
export function FpTeachAgent() {
  const [note, setNote] = useState(null);
  const teach = () => setNote(C.recordTeachingNote({ findingId: 'f2', reasonId: 'not-reproducible' }, 'The WAF blocks angle brackets before the app sees them, so reflected payloads never execute.', 24));
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52078 · Teach the agent</h3>
      <button className="fp52-btn" onClick={teach}>Record 30s explanation</button>
      {note && <p className="fp52-note">{note.ok ? `saved (${note.teachingNote.durationSeconds}s)` : note.reason}</p>}
    </div>
  );
}

/* 52079 — FP analytics dashboard. */
export function FpAnalytics() {
  const a = C.fpAnalytics(SAMPLE_MARKINGS, 1700000009000);
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52079 · FP analytics dashboard</h3>
      <p className="fp52-note">overall FP rate: {Math.round(a.fpRateOverall * 100)}% · {a.totalMarked} marked</p>
      <p className="fp52-note">avg time to dismiss: {a.avgTimeToDismissMs != null ? `${Math.round(a.avgTimeToDismissMs / 1000)}s` : 'n/a'}</p>
      <ul className="fp52-list">
        {a.topReasons.map((r) => <li key={r.key} className="fp52-item">reason {r.key}: {r.count}</li>)}
        {a.topReporters.map((r) => <li key={r.key} className="fp52-item">reporter {r.key}: {r.count}</li>)}
      </ul>
    </div>
  );
}

/* 52080 — FP quarantine vs delete. */
export function FpQuarantine() {
  const [state, setState] = useState({ id: 'f2', fpMarked: true, status: 'dismissed-fp', priorStatus: 'open' });
  const [restored, setRestored] = useState(null);
  const quarantine = () => {
    const r = C.quarantineFp(state, 1700000000000);
    if (r.ok) setState(r.quarantined);
  };
  const restore = () => {
    const r = C.restoreFromQuarantine(state, 1700000005000);
    if (r.ok) { setRestored(r.finding); setState(r.finding); }
  };
  return (
    <div className="fp52-card">
      <h3 className="fp52-title">52080 · FP quarantine</h3>
      <p className="fp52-note">quarantined: {String(!!state.quarantined)} · excluded from reports: {String(!!state.excludedFromReports)}</p>
      {!state.quarantined && <button className="fp52-btn" onClick={quarantine}>Quarantine</button>}
      {state.quarantined && !restored && <button className="fp52-btn" onClick={restore}>Restore from quarantine</button>}
      {restored && <p className="fp52-note">restored to {restored.status}</p>}
    </div>
  );
}

export function FPManagementGallery() {
  return (
    <div className="fp52-gallery">
      <FpReasonPicker /><FpJustification /><FpEvidenceLink /><FpConfidence />
      <FpAttribution /><FpFeedbackLoop /><FpAutoSuggest /><FpRateByClass />
      <FpRateByTarget /><FpEngineLeaderboard /><FpUnmark /><FpTwoReviewer />
      <FpBulkMark /><FpReasonTemplates /><FpTeachAgent /><FpAnalytics />
      <FpQuarantine />
    </div>
  );
}
