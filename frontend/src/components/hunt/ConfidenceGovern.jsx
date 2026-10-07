/**
 * ConfidenceGovern.jsx — wave 43 (ideas 51701–51720): confidence governance
 * & depth suite.
 *
 * 20 working components, each driving the pure logic in confidenceGovernCore.js
 * with real local state. Export-only gallery (not mounted in the app).
 */
import React, { useMemo, useState } from 'react';
import {
  disputeScore, confidenceBenchmarks, exportWithConfidence,
  CONFIDENCE_API_ROUTES, confidencePublicDTO, chatAnswerWithConfidence,
  multiModelAgreement, needsWorkTray, milestoneBadges, evidenceRequests,
  evidenceTypeBreakdown, sharingControl, trendAlerts, weightedReportingOrder,
  explainConfidence, calibrationTraining, mobileConfidenceCard,
  snapshotConfidenceDiffs, slaForConfidence, groupFindings, overrideScore,
} from './confidenceGovernCore.js';

const F = [
  { id: 'F-201', title: 'Stored XSS in comment field', severity: 'critical', confidence: 91, techniques: ['manual-review', 'scanner'], evidence: [{ type: 'screenshot' }, { type: 'response' }, { type: 'replay' }], history: [{ at: '11:02', score: 74, trigger: 'first detection' }, { at: '11:25', score: 91, trigger: 'replay confirmed' }] },
  { id: 'F-202', title: 'Open redirect on /go', severity: 'medium', confidence: 58, techniques: ['scanner'], evidence: [{ type: 'response', note: '302 to evil.example' }], history: [{ at: '11:05', score: 58, trigger: 'first detection' }] },
  { id: 'F-203', title: 'JWT accepts none alg', severity: 'high', confidence: 44, techniques: ['jwt-tool'], evidence: [], history: [{ at: '10:58', score: 70, trigger: 'first detection' }, { at: '11:18', score: 44, trigger: 'decay −26: token rejected on second service' }] },
];

const BENCH = { 'manual-review': { p25: 62, median: 78, p75: 90, n: 310 }, scanner: { p25: 40, median: 55, p75: 71, n: 812 }, 'jwt-tool': { p25: 35, median: 52, p75: 68, n: 96 } };

function Score({ v }) {
  return <span className="cg43-score">{v}</span>;
}

/* 51701 — Confidence dispute */
function DisputePanel() {
  const [note, setNote] = useState('indicator also appears on the error page');
  const [as, setAs] = useState(35);
  const [result, setResult] = useState(null);
  return (
    <div className="cg43-card">
      <h4>51701 · Confidence dispute</h4>
      <div className="cg43-row">{F[1].title} <Score v={F[1].confidence} /></div>
      <label>Your score <input type="number" min="0" max="100" value={as} onChange={(e) => setAs(+e.target.value)} /></label>
      <input className="cg43-input" value={note} onChange={(e) => setNote(e.target.value)} aria-label="reason for disagreement" />
      <button className="cg43-btn" onClick={() => { try { setResult(disputeScore(F[1], { analystScore: as, analystNote: note })); } catch (e) { setResult({ error: e.message }); } }}>Re-evaluate</button>
      {result && (result.error ? <div className="cg43-alert">{result.error}</div> : <div className="cg43-note">Re-evaluated → <Score v={result.confidence} /> (agent 60% / you 40%)</div>)}
    </div>
  );
}

/* 51702 — Confidence benchmarks */
function BenchmarkCard() {
  return (
    <div className="cg43-card">
      <h4>51702 · Confidence benchmarks</h4>
      {F.map((f) => { const b = confidenceBenchmarks(f, BENCH); return (
        <div key={f.id} className="cg43-row">{f.title} <span className="cg43-tiny">{b.note}</span></div>
      ); })}
    </div>
  );
}

/* 51703 — Confidence export */
function ExportPanel() {
  const [fmt, setFmt] = useState('json');
  const out = useMemo(() => exportWithConfidence(F, fmt), [fmt]);
  return (
    <div className="cg43-card">
      <h4>51703 · Confidence export</h4>
      <select value={fmt} onChange={(e) => setFmt(e.target.value)}><option>json</option><option>csv</option><option>markdown</option></select>
      <pre className="cg43-pre">{out.slice(0, 420)}{out.length > 420 ? '…' : ''}</pre>
    </div>
  );
}

/* 51704 — Confidence API */
function ApiExplorer() {
  const dto = confidencePublicDTO(F[0]);
  return (
    <div className="cg43-card">
      <h4>51704 · Confidence API</h4>
      {CONFIDENCE_API_ROUTES.map((r) => <div key={r.path} className="cg43-tiny"><b>{r.method}</b> {r.path} — {r.desc}</div>)}
      <div className="cg43-tiny">Public DTO whitelists: {Object.keys(dto).join(', ')}</div>
    </div>
  );
}

/* 51705 — Confidence in chat answers */
function ChatConfidence() {
  const a = chatAnswerWithConfidence('The /go redirect honors arbitrary hosts — this looks exploitable.', 58);
  return (
    <div className="cg43-card">
      <h4>51705 · Confidence in chat answers</h4>
      <div className="cg43-chat">{a.text}</div>
      <div className="cg43-tiny">{a.spoken}</div>
    </div>
  );
}

/* 51706 — Multi-model agreement */
function ModelAgreement() {
  const r = multiModelAgreement({ model: 'qwen-vl', confidence: 84 }, { model: 'llama-local', confidence: 61 });
  return (
    <div className="cg43-card">
      <h4>51706 · Multi-model agreement</h4>
      <div className="cg43-duo">
        <div>{r.left.model}: <Score v={r.left.score} /></div>
        <div>{r.right.model}: <Score v={r.right.score} /></div>
      </div>
      <div className="cg43-tiny">gap {r.gap} · {r.agreement} — {r.note}</div>
    </div>
  );
}

/* 51707 — Confidence floor setting */
function FloorTray() {
  const [floor, setFloor] = useState(60);
  const t = useMemo(() => needsWorkTray(F, floor), [floor]);
  return (
    <div className="cg43-card">
      <h4>51707 · Confidence floor setting</h4>
      <label>Floor <input type="range" min="0" max="100" value={floor} onChange={(e) => setFloor(+e.target.value)} /> {floor}</label>
      <div className="cg43-tiny">Ready: {t.ready.length} · Needs work: {t.needsWork.map((f) => f.id).join(', ') || 'none'}</div>
    </div>
  );
}

/* 51708 — Confidence milestone badges */
function MilestoneBadges() {
  return (
    <div className="cg43-card">
      <h4>51708 · Confidence milestone badges</h4>
      {F.map((f) => { const m = milestoneBadges(f); return (
        <div key={f.id} className="cg43-row">{f.title}
          {m.badges.map((b) => <span key={b.id} className="cg43-badge">🏅 {b.label}</span>)}
          {m.next && <span className="cg43-tiny">next: {m.next.label} (+{m.next.needs})</span>}
        </div>
      ); })}
    </div>
  );
}

/* 51709 — Confidence-driven evidence requests */
function EvidenceRequests() {
  const [queue, setQueue] = useState([]);
  return (
    <div className="cg43-card">
      <h4>51709 · Confidence-driven evidence requests</h4>
      {F.map((f) => { const r = evidenceRequests(f); return r.needed && (
        <div key={f.id} className="cg43-note"><b>{f.id}</b> ({f.confidence})
          <button className="cg43-btn" onClick={() => setQueue((q) => [...q, ...r.requests.map((x) => ({ finding: f.id, ...x }))])}>Request evidence</button>
        </div>
      ); })}
      <div className="cg43-tiny">Queued: {queue.length} {queue.map((q) => q.kind).join(', ')}</div>
    </div>
  );
}

/* 51710 — Confidence by evidence type */
function EvidenceBreakdown() {
  return (
    <div className="cg43-card">
      <h4>51710 · Confidence by evidence type</h4>
      {F.map((f) => (
        <div key={f.id} className="cg43-row"><b>{f.id}</b> {evidenceTypeBreakdown(f).map((e) => `${e.type}×${e.count} (${e.share}%)`).join(' · ') || 'no evidence'}</div>
      ))}
    </div>
  );
}

/* 51711 — Confidence sharing controls */
function SharingControls() {
  const [mode, setMode] = useState('labels');
  return (
    <div className="cg43-card">
      <h4>51711 · Confidence sharing controls</h4>
      <label><input type="radio" checked={mode === 'raw'} onChange={() => setMode('raw')} /> raw scores</label>
      <label><input type="radio" checked={mode === 'labels'} onChange={() => setMode('labels')} /> simplified labels</label>
      {F.map((f) => { const s = sharingControl(f.confidence, mode); return (
        <div key={f.id} className="cg43-row">{f.title} → <b>{s.shown}</b></div>
      ); })}
    </div>
  );
}

/* 51712 — Confidence trend alerts */
function TrendAlerts() {
  const alerts = F.flatMap((f) => trendAlerts(f).map((a) => ({ id: f.id, ...a })));
  return (
    <div className="cg43-card">
      <h4>51712 · Confidence trend alerts</h4>
      {alerts.length === 0 && <div className="cg43-tiny">No sharp drops.</div>}
      {alerts.map((a, i) => <div key={i} className="cg43-alert">▼ {a.id}: {a.message}</div>)}
    </div>
  );
}

/* 51713 — Confidence-weighted reporting */
function ReportOrder() {
  const rows = useMemo(() => weightedReportingOrder(F), []);
  return (
    <div className="cg43-card">
      <h4>51713 · Confidence-weighted reporting</h4>
      {rows.map((f, i) => <div key={f.id} className="cg43-row">§{i + 1} {f.title} <span className="cg43-tiny">weight {Math.round(f.reportWeight)}</span></div>)}
    </div>
  );
}

/* 51714 — Confidence explanations */
function ConfidenceExplainer() {
  const [id, setId] = useState('F-202');
  const e = explainConfidence(F.find((f) => f.id === id));
  return (
    <div className="cg43-card">
      <h4>51714 · Confidence explanations</h4>
      <select value={id} onChange={(e2) => setId(e2.target.value)}>{F.map((f) => <option key={f.id} value={f.id}>{f.id}</option>)}</select>
      <ul>{e.points.map((p, i) => <li key={i} className="cg43-tiny">{p}</li>)}</ul>
    </div>
  );
}

/* 51715 — Confidence calibration training */
function CalibrationTraining() {
  const [adj, setAdj] = useState(null);
  const run = () => setAdj(calibrationTraining([
    { finding: { confidence: 88 }, analystSaidTrue: false },
    { finding: { confidence: 74 }, analystSaidTrue: false },
    { finding: { confidence: 52 }, analystSaidTrue: true },
  ]));
  return (
    <div className="cg43-card">
      <h4>51715 · Confidence calibration training</h4>
      <button className="cg43-btn" onClick={run}>Train from triage feedback</button>
      {adj && <div className="cg43-note">{adj.notes.join(' ')} <span className="cg43-tiny">(decayPenalty {adj.decayPenalty}, evidenceBonus {adj.evidenceBonus})</span></div>}
    </div>
  );
}

/* 51716 — Confidence in mobile view */
function MobileCard() {
  return (
    <div className="cg43-card">
      <h4>51716 · Confidence in mobile view</h4>
      <div className="cg43-phone">
        {F.map((f) => { const c = mobileConfidenceCard(f); return (
          <div key={c.id} className="cg43-mcard"><b>{c.title}</b><div><Score v={c.confidence} /> <span className="cg43-tiny">{c.trend} · {c.meaning}</span></div></div>
        ); })}
      </div>
    </div>
  );
}

/* 51717 — Confidence snapshot diffs */
function SnapshotDiffs() {
  const A = { findings: [{ id: 'F-201', confidence: 74 }, { id: 'F-202', confidence: 58 }] };
  const B = { findings: [{ id: 'F-201', confidence: 91 }, { id: 'F-203', confidence: 44 }] };
  const d = useMemo(() => snapshotConfidenceDiffs(A, B), []);
  return (
    <div className="cg43-card">
      <h4>51717 · Confidence snapshot diffs</h4>
      {d.map((x, i) => <div key={i} className="cg43-row">{x.id}: {x.change}{x.delta != null ? ` (${x.delta > 0 ? '+' : ''}${x.delta})` : ''} {x.from ?? '—'} → {x.to ?? '—'}</div>)}
    </div>
  );
}

/* 51718 — Confidence-based SLAs */
function SlaPanel() {
  return (
    <div className="cg43-card">
      <h4>51718 · Confidence-based SLAs</h4>
      {F.map((f) => { const s = slaForConfidence(f.confidence); return (
        <div key={f.id} className="cg43-row">{f.title} <span className="cg43-pill cg43-watch">{s.label}</span></div>
      ); })}
    </div>
  );
}

/* 51719 — Confidence grouping */
function GroupingView() {
  const g = useMemo(() => groupFindings(F), []);
  return (
    <div className="cg43-card">
      <h4>51719 · Confidence grouping</h4>
      {Object.entries(g).map(([k, arr]) => (
        <div key={k} className="cg43-group"><b>{k}</b> ({arr.length}): {arr.map((f) => f.id).join(', ') || '—'}</div>
      ))}
    </div>
  );
}

/* 51720 — Confidence override */
function OverridePanel() {
  const [score, setScore] = useState(70);
  const [note, setNote] = useState('');
  const [res, setRes] = useState(null);
  return (
    <div className="cg43-card">
      <h4>51720 · Confidence override</h4>
      <div className="cg43-row">{F[2].title} <Score v={F[2].confidence} /></div>
      <label>New score <input type="number" min="0" max="100" value={score} onChange={(e) => setScore(+e.target.value)} /></label>
      <input className="cg43-input" value={note} onChange={(e) => setNote(e.target.value)} aria-label="override justification, required" />
      <button className="cg43-btn" onClick={() => { try { setRes(overrideScore(F[2], score, note)); } catch (e) { setRes({ error: e.message }); } }}>Override</button>
      {res && (res.error ? <div className="cg43-alert">{res.error}</div> : <div className="cg43-note">Overridden → <Score v={res.confidence} /> · audited.</div>)}
    </div>
  );
}

export const ConfidenceGovernGallery = [
  { id: 51701, name: 'DisputePanel', render: <DisputePanel /> },
  { id: 51702, name: 'BenchmarkCard', render: <BenchmarkCard /> },
  { id: 51703, name: 'ExportPanel', render: <ExportPanel /> },
  { id: 51704, name: 'ApiExplorer', render: <ApiExplorer /> },
  { id: 51705, name: 'ChatConfidence', render: <ChatConfidence /> },
  { id: 51706, name: 'ModelAgreement', render: <ModelAgreement /> },
  { id: 51707, name: 'FloorTray', render: <FloorTray /> },
  { id: 51708, name: 'MilestoneBadges', render: <MilestoneBadges /> },
  { id: 51709, name: 'EvidenceRequests', render: <EvidenceRequests /> },
  { id: 51710, name: 'EvidenceBreakdown', render: <EvidenceBreakdown /> },
  { id: 51711, name: 'SharingControls', render: <SharingControls /> },
  { id: 51712, name: 'TrendAlerts', render: <TrendAlerts /> },
  { id: 51713, name: 'ReportOrder', render: <ReportOrder /> },
  { id: 51714, name: 'ConfidenceExplainer', render: <ConfidenceExplainer /> },
  { id: 51715, name: 'CalibrationTraining', render: <CalibrationTraining /> },
  { id: 51716, name: 'MobileCard', render: <MobileCard /> },
  { id: 51717, name: 'SnapshotDiffs', render: <SnapshotDiffs /> },
  { id: 51718, name: 'SlaPanel', render: <SlaPanel /> },
  { id: 51719, name: 'GroupingView', render: <GroupingView /> },
  { id: 51720, name: 'OverridePanel', render: <OverridePanel /> },
];

export default ConfidenceGovernGallery;
