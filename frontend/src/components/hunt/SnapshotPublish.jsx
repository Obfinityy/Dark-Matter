/**
 * SnapshotPublish.jsx — wave 42 (ideas 51661–51680): snapshot publishing +
 * live confidence suite.
 *
 * 20 working components, each driving the pure logic in snapshotPublishCore.js
 * with real local state. Export-only gallery (not mounted in the app).
 */
import React, { useMemo, useState } from 'react';
import {
  addCustomSection, customSections, sectionsForSnapshot,
  snapshotToJson, findingsToCsv,
  sealSnapshot, verifySnapshotSeal,
  createCollabDoc, applyCollabEdit, collabNotes, collabPresence,
  defaultSnapshotRules, notificationTargets,
  buildSnapshotArchive, searchSnapshotArchive,
  restoreDraftFromSnapshot, plainDiffSummary,
  snapshotKpis, snapshotRiskOverview,
  remediationPreview, complianceMapping,
  clientPortalView,
  recordSnapshotFeedback, feedbackSummary,
  promoteSnapshotToFinal,
  confidenceScore, addEvidence,
  confidenceTrend, TREND_GLYPH,
  evidenceStrengthMeter,
  VALIDATION_STAGES, validationStage, advanceValidationStage, stageIndex,
  confidenceBreakdown,
} from './snapshotPublishCore.js';

const ILLUS_FINDINGS = [
  { id: 'f1', title: 'Reflected XSS on search', severity: 'high', type: 'xss', asset: 'app.example.com', evidence: [{ kind: 'poc', label: 'curl PoC' }, { kind: 'screenshot', label: 'alert() dialog' }] },
  { id: 'f2', title: 'SQLi in product filter', severity: 'critical', type: 'sqli', asset: 'shop.example.com', evidence: [{ kind: 'poc', label: 'time-based payload' }, { kind: 'log', label: 'db error log' }, { kind: 'response', label: '5s delay' }] },
  { id: 'f3', title: 'Verbose server header', severity: 'low', type: 'info', asset: 'app.example.com', evidence: [{ kind: 'header', label: 'Server: nginx/1.18' }] },
];

const ILLUS_SNAPSHOT = {
  id: 'snap-9', huntId: 'hunt-7', target: 'example.com', takenAt: '2026-10-08T03:30:00+05:30',
  version: 3, findings: ILLUS_FINDINGS, coveragePct: 62, elapsedMin: 95, resolvedCount: 1,
  sections: [{ id: 's1', title: 'Findings', body: 'Three findings confirmed.' }],
};

/* Illustrative 64-bit FNV-1a hex digest for the seal walkthrough.
 * Production seals use SHA-256 (see the node:test suite). */
function illustrativeDigest(str) {
  let h1 = 0xcbf29ce4, h2 = 0x84222325;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 16777619);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/* 51661 */ export function CustomSectionsEditor() {
  const [store, setStore] = useState({});
  const [title, setTitle] = useState('');
  const add = () => { try { setStore(s => addCustomSection(s, { title, body: 'Owner note', author: 'owner' })); setTitle(''); } catch { /* validation */ } };
  const secs = customSections(store);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot custom sections</h4>
      <div className="sd42-row"><input className="sd42-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Section title…" /><button className="sd42-btn" onClick={add}>Add (persists)</button></div>
      <ul className="sd42-list">{secs.map(s => <li key={s.title}><b>{s.title}</b> <span className="sd42-dim">by {s.author}</span></li>)}</ul>
      <p className="sd42-p sd42-dim">{sectionsForSnapshot(ILLUS_SNAPSHOT, store).length} sections on next snapshot</p>
    </div>
  );
}

/* 51662 */ export function SnapshotDataExport() {
  const [fmt, setFmt] = useState('json');
  const out = useMemo(() => (fmt === 'json' ? snapshotToJson(ILLUS_SNAPSHOT) : findingsToCsv(ILLUS_FINDINGS)), [fmt]);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot data export</h4>
      <div className="sd42-row">{['json', 'csv'].map(f => <button key={f} className={`sd42-btn${fmt === f ? ' sd42-on' : ''}`} onClick={() => setFmt(f)}>{f.toUpperCase()}</button>)}</div>
      <pre className="sd42-pre">{out.slice(0, 420)}{out.length > 420 ? '…' : ''}</pre>
    </div>
  );
}

/* 51663 */ export function IntegritySeal() {
  const [sealed, setSealed] = useState(null);
  const [tampered, setTampered] = useState(false);
  const snap = tampered ? { ...ILLUS_SNAPSHOT, version: 99 } : ILLUS_SNAPSHOT;
  const ok = sealed ? verifySnapshotSeal(snap, sealed, illustrativeDigest) : null;
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot integrity seal</h4>
      <div className="sd42-row">
        <button className="sd42-btn" onClick={() => { setSealed(sealSnapshot(ILLUS_SNAPSHOT, illustrativeDigest, 'now')); setTampered(false); }}>Seal snapshot</button>
        <button className="sd42-btn" disabled={!sealed} onClick={() => setTampered(true)}>Tamper copy</button>
      </div>
      {sealed && <p className="sd42-p"><code className="sd42-code">{sealed.digest.slice(0, 16)}…</code> <span className={`sd42-badge sd42-${ok ? 'info' : 'significant'}`}>{ok ? 'seal valid' : 'seal BROKEN'}</span></p>}
      <p className="sd42-p sd42-dim">Walkthrough digest is illustrative; production seals use SHA-256.</p>
    </div>
  );
}

/* 51664 */ export function CollabNotes() {
  const [doc, setDoc] = useState(() => createCollabDoc());
  const [text, setText] = useState('');
  const edit = () => setDoc(d => applyCollabEdit(collabPresence(d, 'You', 'now'), { author: 'You', noteId: 'scope-note', text, at: 'now' }));
  const notes = collabNotes(doc);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot collaboration</h4>
      <div className="sd42-row"><input className="sd42-input" value={text} onChange={e => setText(e.target.value)} aria-label="Shared note…" /><button className="sd42-btn" onClick={edit}>Co-edit</button></div>
      <ul className="sd42-list">{notes.map(n => <li key={n.noteId}><b>{n.noteId}</b>: {n.text} <span className="sd42-dim">by {n.author}</span></li>)}</ul>
      <p className="sd42-p sd42-dim">{doc.ops.length} ops · last-writer-wins per note</p>
    </div>
  );
}

/* 51665 */ export function NotificationRules() {
  const [level, setLevel] = useState('significant');
  const targets = useMemo(() => notificationTargets(defaultSnapshotRules(), level), [level]);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot notification rules</h4>
      <div className="sd42-row">{['info', 'significant'].map(l => <button key={l} className={`sd42-btn${level === l ? ' sd42-on' : ''}`} onClick={() => setLevel(l)}>{l}</button>)}</div>
      <ul className="sd42-list">{targets.map((t, i) => <li key={i}>{t.channel} → {t.to}</li>)}</ul>
    </div>
  );
}

/* 51666 */ export function ArchiveBrowser() {
  const archive = useMemo(() => buildSnapshotArchive([
    { id: 'snap-9', huntId: 'hunt-7', target: 'example.com', version: 3 },
    { id: 'snap-8', huntId: 'hunt-7', target: 'example.com', version: 2 },
    { id: 'snap-2', huntId: 'hunt-3', target: 'shop.example.com', version: 1 },
  ]), []);
  const [q, setQ] = useState('');
  const hits = searchSnapshotArchive(archive, q);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot archive browser</h4>
      <p className="sd42-p sd42-dim">{archive.total} snapshots · {archive.hunts.length} hunts</p>
      <input className="sd42-input" value={q} onChange={e => setQ(e.target.value)} aria-label="Search archive…" />
      <ul className="sd42-list">{(q ? hits : archive.hunts.flatMap(h => archive.byHunt[h])).map(s => <li key={s.id}>{s.target} <span className="sd42-chip">v{s.version}</span> <span className="sd42-dim">{s.huntId}</span></li>)}</ul>
    </div>
  );
}

/* 51667 */ export function SnapshotRestore() {
  const [draft, setDraft] = useState({ title: 'Working draft', sections: [{ id: 'd1', title: 'Stale section' }] });
  const restore = () => setDraft(d => restoreDraftFromSnapshot(d, ILLUS_SNAPSHOT, 'now'));
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot restore</h4>
      <p className="sd42-p">{draft.restoredFrom ? `Restored from v${draft.restoredFrom.version}` : 'Draft not restored yet'} · {draft.sections.length} sections</p>
      <button className="sd42-btn" onClick={restore}>Revert draft to v3</button>
    </div>
  );
}

/* 51668 */ export function DiffSummary() {
  const lines = useMemo(() => plainDiffSummary(
    { findings: [{ id: 'f1', title: 'XSS', severity: 'high' }, { id: 'f9', title: 'Old', severity: 'low' }] },
    { findings: [{ id: 'f1', title: 'XSS', severity: 'critical' }, ...ILLUS_FINDINGS] },
  ), []);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot diff summary</h4>
      <ul className="sd42-list">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}

/* 51669 */ export function KpiPanel() {
  const k = useMemo(() => snapshotKpis(ILLUS_SNAPSHOT), []);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot KPI panel</h4>
      <div className="sd42-row">{[['findings', k.findings], ['critical', k.critical], ['coverage', `${k.coveragePct}%`], ['elapsed', `${k.elapsedMin}m`], ['per hour', k.perHour]].map(([l, v]) => (
        <div key={l} className="sp42-kpi"><b>{v}</b><span className="sd42-dim">{l}</span></div>
      ))}</div>
    </div>
  );
}

/* 51670 */ export function RiskOverview() {
  const r = useMemo(() => snapshotRiskOverview(ILLUS_FINDINGS), []);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot risk overview</h4>
      <p className="sd42-p">Posture: <span className={`sd42-badge sd42-${r.level === 'critical' ? 'significant' : 'info'}`}>{r.level}</span> <span className="sd42-dim">score {r.score}</span></p>
      <ul className="sd42-list">{r.drivers.map(d => <li key={d.id}><span className={`sd42-badge sd42-${d.severity}`}>{d.severity}</span> {d.title}</li>)}</ul>
    </div>
  );
}

/* 51671 */ export function RemediationPreview() {
  const items = useMemo(() => remediationPreview(ILLUS_FINDINGS), []);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot remediation preview</h4>
      <ul className="sd42-list">{items.map(i => <li key={i.findingId}><b>{i.title}</b> <span className="sd42-dim">[{i.effort} effort]</span><br />{i.guidance}</li>)}</ul>
    </div>
  );
}

/* 51672 */ export function ComplianceMapping() {
  const m = useMemo(() => complianceMapping(ILLUS_FINDINGS), []);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot compliance mapping</h4>
      {Object.entries(m).map(([fw, refs]) => (
        <div key={fw}><p className="sd42-p"><b>{fw}</b></p>
        <ul className="sd42-list">{Object.entries(refs).map(([ref, ids]) => <li key={ref}><code className="sd42-code">{ref}</code> <span className="sd42-dim">→ {ids.join(', ')}</span></li>)}</ul></div>
      ))}
    </div>
  );
}

/* 51673 */ export function ClientPortal() {
  const [brand, setBrand] = useState('Acme Corp');
  const view = useMemo(() => clientPortalView(ILLUS_SNAPSHOT, { brand }), [brand]);
  const leaked = JSON.stringify(view).includes('internalNotes');
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot client portal</h4>
      <div className="sd42-row"><input className="sd42-input" value={brand} onChange={e => setBrand(e.target.value)} /></div>
      <p className="sd42-title" style={{ color: view.accent }}>{view.brand} — {view.title}</p>
      <p className="sd42-p">{view.kpis.findings} findings · {view.kpis.critical} critical · {view.kpis.high} high</p>
      <p className="sd42-p sd42-dim">{view.note} Internals leaked: {leaked ? 'YES' : 'no'}.</p>
    </div>
  );
}

/* 51674 */ export function FeedbackCollector() {
  const [store, setStore] = useState({});
  const [rating, setRating] = useState(4);
  const submit = () => setStore(s => recordSnapshotFeedback(s, { snapshotId: 'snap-9', section: 'Findings', rating, note: '' }));
  const sum = feedbackSummary(store, 'snap-9');
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Snapshot feedback collection</h4>
      <div className="sd42-row">{[1, 2, 3, 4, 5].map(r => <button key={r} className={`sd42-btn${rating === r ? ' sd42-on' : ''}`} onClick={() => setRating(r)}>{r}★</button>)}</div>
      <button className="sd42-btn" onClick={submit}>Submit rating</button>
      <p className="sd42-p sd42-dim">{sum.count} ratings · avg Findings: {sum.avgBySection.Findings ?? '—'}</p>
    </div>
  );
}

/* 51675 */ export function FinalFromSnapshot() {
  const [final, setFinal] = useState(null);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Final-from-snapshot</h4>
      <button className="sd42-btn" onClick={() => setFinal(promoteSnapshotToFinal(ILLUS_SNAPSHOT, { promotedAt: 'now' }))}>Promote v3 to final</button>
      {final && <p className="sd42-p"><code className="sd42-code">{final.reportId}</code> <span className="sd42-dim">· {final.status} · {final.findings.length} findings carried over</span></p>}
    </div>
  );
}

/* 51676 */ export function ConfidenceScore() {
  const [finding, setFinding] = useState({ id: 'f1', title: 'Reflected XSS', evidence: [{ kind: 'poc', label: 'curl PoC' }] });
  const score = confidenceScore(finding);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Live confidence score</h4>
      <p className="sp42-score">{score}<span className="sd42-dim">/100</span></p>
      <button className="sd42-btn" onClick={() => setFinding(f => addEvidence(f, { kind: 'screenshot', label: 'alert() dialog' }))}>Add evidence → rescore</button>
      <p className="sd42-p sd42-dim">{finding.evidence.length} evidence items</p>
    </div>
  );
}

/* 51677 */ export function ConfidenceTrend() {
  const histories = { rising: [40, 55, 72], falling: [80, 70, 60], stable: [55, 56, 55], fresh: [50] };
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Confidence trend arrow</h4>
      <ul className="sd42-list">{Object.entries(histories).map(([k, h]) => {
        const t = confidenceTrend(h);
        return <li key={k}><span className="sp42-trend">{TREND_GLYPH[t]}</span> {k}: [{h.join(', ')}] → <b>{t}</b></li>;
      })}</ul>
    </div>
  );
}

/* 51678 */ export function EvidenceMeter() {
  const m = useMemo(() => evidenceStrengthMeter([{ kind: 'poc' }, { kind: 'log' }, { kind: 'screenshot' }]), []);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Evidence-strength meter</h4>
      <div className="sd42-bar"><div className={`sd42-fill sd42-${m.band === 'strong' ? 'info' : m.band === 'moderate' ? 'high' : 'significant'}`} style={{ width: `${m.score * 2}px` }} /></div>
      <p className="sd42-p">{m.score}/100 · <b>{m.band}</b> · {m.count} items ({m.kinds.join(', ')})</p>
    </div>
  );
}

/* 51679 */ export function ValidationStages() {
  const [finding, setFinding] = useState({ id: 'f2', title: 'SQLi', validationStage: 'detected' });
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Validation-stage labels</h4>
      <div className="sd42-row">{VALIDATION_STAGES.map(s => (
        <span key={s} className={`sd42-chip${stageIndex(finding) >= VALIDATION_STAGES.indexOf(s) ? ' sd42-on' : ''}`}>{s}</span>
      ))}</div>
      <p className="sd42-p">Current: <b>{validationStage(finding)}</b></p>
      <button className="sd42-btn" onClick={() => setFinding(f => advanceValidationStage(f))}>Advance stage</button>
    </div>
  );
}

/* 51680 */ export function ConfidenceBreakdown() {
  const bd = useMemo(() => confidenceBreakdown(ILLUS_FINDINGS[1]), []);
  return (
    <div className="sp42-card">
      <h4 className="sp42-h">Confidence breakdown</h4>
      <p className="sd42-p">Total: <b>{bd.total}</b>/100 {bd.capped && <span className="sd42-dim">(capped)</span>}</p>
      <ul className="sd42-list">{bd.parts.map((p, i) => <li key={i}>{p.label} <span className="sd42-dim">[{p.source}]</span>: +{p.points}</li>)}</ul>
    </div>
  );
}

export function SnapshotPublishGallery() {
  return (
    <div className="sp42-gallery">
      <CustomSectionsEditor /><SnapshotDataExport /><IntegritySeal /><CollabNotes /><NotificationRules />
      <ArchiveBrowser /><SnapshotRestore /><DiffSummary /><KpiPanel /><RiskOverview />
      <RemediationPreview /><ComplianceMapping /><ClientPortal /><FeedbackCollector /><FinalFromSnapshot />
      <ConfidenceScore /><ConfidenceTrend /><EvidenceMeter /><ValidationStages /><ConfidenceBreakdown />
    </div>
  );
}
