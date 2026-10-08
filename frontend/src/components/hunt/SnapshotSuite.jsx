/**
 * SnapshotSuite.jsx — wave 41 (ideas 51621–51640): mid-hunt snapshot suite.
 * Real working components driving local state. All logic comes from
 * snapshotCore.js.
 * The SnapshotSuiteGallery is exported for review only; it is not
 * mounted in app UI.
 */
import React, { useState } from 'react';
import {
  FINDING_STATES,
  takeSnapshot,
  scheduleSnapshot,
  dueScheduledSnapshots,
  advanceSchedule,
  diffSnapshots,
  snapshotTimeline,
  shareSnapshotLink,
  pdfExportDescriptor,
  annotateSnapshot,
  snapshotWatermark,
  applySnapshotWatermark,
  snapshotDeltas,
  executiveSummary,
  technicalSummary,
  subscribeSnapshot,
  notifySnapshotSubscribers,
  approveSnapshot,
  shareableExternally,
  applySnapshotRetention,
  searchSnapshots,
  SNAPSHOT_TEMPLATES,
  applySnapshotTemplate,
  snapshotLanguageLabels,
  labelForLanguage,
  livePreviewDescriptor,
  snapshotCompleteness,
  markFindingState,
  findingsByState,
} from './snapshotCore.js';

function Card({ n, title, children }) {
  return (
    <div className="sn41-card" data-idea={n}>
      <div className="sn41-card-head">
        <span className="sn41-num">{n}</span>
        <h4>{title}</h4>
      </div>
      <div className="sn41-card-body">{children}</div>
    </div>
  );
}

const DEMO_HUNT = {
  id: 'H-901',
  target: 'app.example.com',
  phase: 'injection-testing',
  findings: [
    {
      id: 'F-1',
      title: 'Stored XSS in support chat',
      type: 'xss',
      severity: 'high',
      confidence: 87,
      asset: 'app.example.com/chat',
      evidence: 'script payload reflected and stored',
    },
    {
      id: 'F-2',
      title: 'Missing security headers',
      type: 'headers',
      severity: 'low',
      confidence: 95,
      asset: '/',
      evidence: 'no CSP or HSTS on responses',
    },
  ],
};

function kv(rows) {
  return (
    <dl className="sn41-kv">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{String(v)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** 51621 — capture a full report draft at any moment. */
export function OneClickSnapshotCard() {
  const [snap, setSnap] = useState(null);
  return (
    <Card n={51621} title="One-click snapshot">
      <div className="sn41-row">
        <button className="sn41-btn" onClick={() => setSnap(takeSnapshot(DEMO_HUNT, 5000000))}>
          capture snapshot
        </button>
      </div>
      {snap &&
        kv([
          ['snapshot id', snap.id],
          ['target', snap.target],
          ['findings', snap.findingCount],
          ['severity mix', JSON.stringify(snap.bySeverity)],
          ['phase', snap.phase],
        ])}
    </Card>
  );
}

/** 51622 — auto-generate snapshots on a schedule. */
export function ScheduledSnapshotCard() {
  const [rules, setRules] = useState([]);
  const [intervalMin, setIntervalMin] = useState(15);
  const due = dueScheduledSnapshots(rules, 1000000);
  return (
    <Card n={51622} title="Scheduled snapshots">
      <div className="sn41-row">
        <span className="sn41-meta">every (min):</span>
        <input
          className="sn41-input"
          style={{ maxWidth: 70 }}
          type="number"
          value={intervalMin}
          onChange={e => setIntervalMin(Number(e.target.value))}
        />
        <button
          className="sn41-btn"
          onClick={() =>
            setRules(
              scheduleSnapshot(rules, {
                label: 'quarter-hourly',
                intervalMs: intervalMin * 60000,
                fromMs: 100000,
              })
            )
          }
        >
          add schedule
        </button>
      </div>
      <ul className="sn41-list">
        {rules.map(r => (
          <li key={r.id}>
            {r.label} · every {r.intervalMs / 60000} min · next at {r.nextAtMs}
            {r.nextAtMs <= 1000000 && (
              <button
                className="sn41-btn"
                style={{ marginLeft: 8 }}
                onClick={() =>
                  setRules(rules.map(x => (x.id === r.id ? advanceSchedule(x, 1000000) : x)))
                }
              >
                mark taken
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="sn41-meta">
        due now: {due.length} of {rules.length}
      </div>
    </Card>
  );
}

/** 51623 — diff any two snapshots. */
export function SnapshotDiffCard() {
  const [a] = useState(() => takeSnapshot(DEMO_HUNT, 4000000));
  const [b] = useState(() =>
    takeSnapshot(
      {
        ...DEMO_HUNT,
        findings: [
          ...DEMO_HUNT.findings,
          {
            id: 'F-3',
            title: 'IDOR in /api/orders',
            type: 'idor',
            severity: 'critical',
            confidence: 91,
            asset: 'app.example.com/api/orders',
            evidence: 'order ids enumerable',
          },
          {
            id: 'F-2',
            title: 'Missing security headers',
            type: 'headers',
            severity: 'medium',
            confidence: 95,
            asset: '/',
            evidence: 'no CSP or HSTS on responses',
          },
        ],
      },
      5000000
    )
  );
  const d = diffSnapshots(a, b);
  return (
    <Card n={51623} title="Snapshot comparison (mid-hunt)">
      {kv([
        ['from', a.id],
        ['to', b.id],
        ['added', d.addedCount + ': ' + d.addedIds.join(', ')],
        ['changed', d.changedCount + ': ' + d.changedIds.join(', ')],
        ['removed', d.removedCount],
      ])}
    </Card>
  );
}

/** 51624 — scrubbable timeline of snapshots. */
export function SnapshotTimelineCard() {
  const [snaps] = useState(() => [
    takeSnapshot(DEMO_HUNT, 3000000),
    takeSnapshot(DEMO_HUNT, 4000000),
    takeSnapshot(DEMO_HUNT, 5000000),
  ]);
  const tl = snapshotTimeline(snaps);
  return (
    <Card n={51624} title="Snapshot timeline">
      <div className="sn41-timeline">
        {tl.map((t, i) => (
          <React.Fragment key={t.id}>
            {i > 0 && (
              <div
                className="sn41-timeline-gap"
                title={'+' + Math.round(t.gapSincePrevMs / 60000) + ' min'}
              />
            )}
            <div className="sn41-timeline-node">
              #{t.index + 1}
              <br />
              {t.findingCount} findings
              <br />
              {t.approved ? 'approved' : 'draft'}
            </div>
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}

/** 51625 — share links without live controls. */
export function SnapshotShareCard() {
  const [snap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  const [audience, setAudience] = useState('stakeholder');
  const link = shareSnapshotLink(snap, audience);
  return (
    <Card n={51625} title="Snapshot sharing">
      <div className="sn41-row">
        {['stakeholder', 'client', 'audit'].map(a => (
          <button
            key={a}
            className={'sn41-btn' + (audience === a ? ' sn41-btn-picked' : '')}
            onClick={() => setAudience(a)}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="sn41-prompt-body sn41-meta" style={{ marginTop: 8, wordBreak: 'break-all' }}>
        {link.url}
      </div>
      <div className="sn41-meta">
        live controls exposed: {link.liveControlsExposed ? 'yes' : 'no'} · expires in{' '}
        {link.expiresInDays} days
      </div>
    </Card>
  );
}

/** 51626 — PDF export descriptor. */
export function SnapshotPdfCard() {
  const [snap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  const pdf = pdfExportDescriptor(snap);
  return (
    <Card n={51626} title="Snapshot PDF export">
      {kv([
        ['filename', pdf.filename],
        ['pages', pdf.pages],
        ['sections', pdf.sections.join(', ')],
        ['language', pdf.language],
      ])}
      <div className="sn41-meta">watermark applied: {pdf.watermarkApplied ? 'yes' : 'not yet'}</div>
    </Card>
  );
}

/** 51627 — notes layered on a snapshot. */
export function SnapshotAnnotateCard() {
  const [snap, setSnap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  const [note, setNote] = useState('Client cares most about the IDOR — lead with it.');
  return (
    <Card n={51627} title="Snapshot annotations (mid-hunt)">
      <div className="sn41-row">
        <input className="sn41-input" value={note} onChange={e => setNote(e.target.value)} />
        <button
          className="sn41-btn"
          onClick={() => setSnap(annotateSnapshot(snap, note, 'owner', 5100000))}
        >
          add note
        </button>
      </div>
      <ul className="sn41-list">
        {(snap.annotations || []).map(a => (
          <li key={a.id}>
            <b>{a.author}</b>: {a.note}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** 51628 — draft stamp + generation time. */
export function SnapshotWatermarkCard() {
  const [snap, setSnap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  const [text, setText] = useState('DRAFT');
  const [opacity, setOpacity] = useState(0.12);
  const wm = snapshot.watermark;
  return (
    <Card n={51628} title="Snapshot watermarking">
      <div className="sn41-row">
        <input
          className="sn41-input"
          style={{ maxWidth: 120 }}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <span className="sn41-meta">opacity:</span>
        <input
          className="sn41-input"
          style={{ maxWidth: 70 }}
          type="number"
          step="0.01"
          value={opacity}
          onChange={e => setOpacity(Number(e.target.value))}
        />
        <button
          className="sn41-btn"
          onClick={() =>
            setSnap(
              applySnapshotWatermark(
                snap,
                snapshotWatermark(text, { opacity, fontSizePx: 48, rotationDeg: -30 }),
                5000000
              )
            )
          }
        >
          apply stamp
        </button>
      </div>
      {wm && (
        <div className="sn41-watermark">
          "{wm.text}" · opacity {wm.style.opacity} · rotation {wm.style.rotationDeg}° · applied at{' '}
          {wm.appliedAtMs}
        </div>
      )}
    </Card>
  );
}

/** 51629 — what changed since the previous snapshot. */
export function SnapshotDeltasCard() {
  const [prev] = useState(() => takeSnapshot(DEMO_HUNT, 4000000));
  const [cur] = useState(() =>
    takeSnapshot(
      {
        ...DEMO_HUNT,
        findings: [
          ...DEMO_HUNT.findings,
          {
            id: 'F-3',
            title: 'IDOR in /api/orders',
            type: 'idor',
            severity: 'critical',
            confidence: 91,
            asset: 'app.example.com/api/orders',
            evidence: 'order ids enumerable',
          },
        ],
      },
      5000000
    )
  );
  const d = snapshotDeltas(cur, prev);
  return (
    <Card n={51629} title="Snapshot deltas">
      <div className="sn41-prompt-title">{d.headline}</div>
      <ul className="sn41-list">
        {d.highlights.map(h => (
          <li key={h.id}>
            <b>{h.kind}</b>: {h.title} <span className="sn41-meta">({h.severity})</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** 51630 — one-page business summary. */
export function ExecutiveModeCard() {
  const [snap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  const s = executiveSummary(snap);
  return (
    <Card n={51630} title="Executive snapshot mode">
      <div className="sn41-prompt-title">{s.headline}</div>
      <div className="sn41-prompt-body">{s.businessImpact}</div>
      <ul className="sn41-list">
        {s.topRisks.map(r => (
          <li key={r.id}>
            <b>{r.severity}</b> — {r.title}
          </li>
        ))}
      </ul>
      <div className="sn41-meta">next: {s.nextSteps.join(' · ')}</div>
    </Card>
  );
}

/** 51631 — full evidence detail. */
export function TechnicalModeCard() {
  const [snap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  const t = technicalSummary(snap);
  return (
    <Card n={51631} title="Technical snapshot mode">
      <table className="sn41-table">
        <thead>
          <tr>
            <th>id</th>
            <th>title</th>
            <th>severity</th>
            <th>confidence</th>
            <th>evidence</th>
          </tr>
        </thead>
        <tbody>
          {t.findings.map(f => (
            <tr key={f.id}>
              <td>{f.id}</td>
              <td>{f.title}</td>
              <td>{f.severity}</td>
              <td>{f.confidence}</td>
              <td>{f.evidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sn41-meta">{t.techniqueNotes}</div>
    </Card>
  );
}

/** 51632 — stakeholders auto-receive snapshots. */
export function SnapshotSubscribeCard() {
  const [subs, setSubs] = useState([]);
  const [email, setEmail] = useState('cto@example.com');
  const [snap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  const queued = notifySnapshotSubscribers(subs, snap);
  return (
    <Card n={51632} title="Snapshot subscriptions">
      <div className="sn41-row">
        <input
          className="sn41-input"
          style={{ maxWidth: 200 }}
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button
          className="sn41-btn"
          onClick={() => setSubs(subscribeSnapshot(subs, { email, role: 'stakeholder' }))}
        >
          subscribe
        </button>
      </div>
      <div className="sn41-meta">
        subscribers: {subs.length} · notifications queued: {queued.length}
      </div>
      <ul className="sn41-list">
        {subs.map(s => (
          <li key={s.id}>
            {s.email} ({s.role})
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** 51633 — reviewed before external sharing. */
export function SnapshotApprovalCard() {
  const [snap, setSnap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  return (
    <Card n={51633} title="Snapshot approval">
      <div className="sn41-row">
        <button
          className="sn41-btn"
          onClick={() => setSnap(approveSnapshot(snap, 'owner', 5200000))}
        >
          mark reviewed
        </button>
      </div>
      <div className="sn41-meta">
        approved: {snap.approved ? `yes by ${snap.approvedBy} at ${snap.approvedAtMs}` : 'no'} ·
        shareable externally: {shareableExternally(snap) ? 'yes' : 'no — needs review'}
      </div>
    </Card>
  );
}

/** 51634 — old snapshots archived per policy. */
export function SnapshotRetentionCard() {
  const [snaps] = useState(() => [takeSnapshot(DEMO_HUNT, 5000000), takeSnapshot(DEMO_HUNT, 1000)]);
  const [days, setDays] = useState(30);
  const r = applySnapshotRetention(snaps, { retainDays: days }, 5000000);
  return (
    <Card n={51634} title="Snapshot retention">
      <div className="sn41-row">
        <span className="sn41-meta">retain days:</span>
        <input
          className="sn41-input"
          style={{ maxWidth: 70 }}
          type="number"
          value={days}
          onChange={e => setDays(Number(e.target.value))}
        />
      </div>
      <div className="sn41-meta">
        kept: {r.kept.length} · archived: {r.archived.length} · policy: {r.retainDays} days
      </div>
    </Card>
  );
}

/** 51635 — search by date, finding, or note. */
export function SnapshotSearchCard() {
  const [base] = useState(() => {
    let s = takeSnapshot(DEMO_HUNT, 5000000);
    s = annotateSnapshot(s, 'Client cares about the IDOR', 'owner', 5100000);
    return s;
  });
  const [q, setQ] = useState('idor');
  const hits = searchSnapshots([base], q);
  return (
    <Card n={51635} title="Snapshot search">
      <div className="sn41-row">
        <input className="sn41-input" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="sn41-meta">
        {hits.length} match{hits.length === 1 ? '' : 'es'}
      </div>
      <ul className="sn41-list">
        {hits.map(h => (
          <li key={h.id}>
            {h.id} · {h.target} · {h.findingCount} findings
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** 51636 — branded layout on every snapshot. */
export function SnapshotTemplateCard() {
  const [key, setKey] = useState('branded');
  const [org, setOrg] = useState('Acme Security');
  const t = applySnapshotTemplate(key, { org });
  return (
    <Card n={51636} title="Snapshot templates">
      <div className="sn41-row">
        {Object.keys(SNAPSHOT_TEMPLATES).map(k => (
          <button
            key={k}
            className={'sn41-btn' + (key === k ? ' sn41-btn-picked' : '')}
            onClick={() => setKey(k)}
          >
            {k}
          </button>
        ))}
        <input
          className="sn41-input"
          style={{ maxWidth: 160 }}
          value={org}
          onChange={e => setOrg(e.target.value)}
        />
      </div>
      <div className="sn41-watermark" style={{ borderColor: t.accent }}>
        header: {t.header} · accent: {t.accent} · footer: {t.footer}
      </div>
    </Card>
  );
}

/** 51637 — snapshots in supported languages. */
export function SnapshotLanguageCard() {
  const [lang, setLang] = useState('hi');
  const dict = snapshotLanguageLabels();
  return (
    <Card n={51637} title="Snapshot language options">
      <div className="sn41-row">
        {Object.keys(dict).map(l => (
          <button
            key={l}
            className={'sn41-btn' + (lang === l ? ' sn41-btn-picked' : '')}
            onClick={() => setLang(l)}
          >
            {l}
          </button>
        ))}
      </div>
      <ul className="sn41-list">
        <li>{labelForLanguage(dict, lang, 'snapshot')}</li>
        <li>{labelForLanguage(dict, lang, 'findings')}</li>
        <li>{labelForLanguage(dict, lang, 'executiveSummary')}</li>
        <li>{labelForLanguage(dict, lang, 'generatedAt')}</li>
      </ul>
    </Card>
  );
}

/** 51638 — draft report updating as findings land. */
export function LivePreviewCard() {
  const [count, setCount] = useState(1);
  const snap = takeSnapshot(
    { ...DEMO_HUNT, findings: DEMO_HUNT.findings.slice(0, count) },
    5000000
  );
  const pv = livePreviewDescriptor(snap);
  return (
    <Card n={51638} title="Live snapshot preview">
      <div className="sn41-row">
        <button
          className="sn41-btn"
          onClick={() => setCount(c => Math.min(DEMO_HUNT.findings.length, c + 1))}
        >
          new finding lands
        </button>
        <button className="sn41-btn" onClick={() => setCount(1)}>
          reset
        </button>
      </div>
      <div className="sn41-meta">
        live: {pv.live ? 'yes' : 'no'} · findings in draft: {pv.findingCount}
      </div>
      <div className="sn41-prompt-body" style={{ marginTop: 6 }}>
        {pv.note}
      </div>
    </Card>
  );
}

/** 51639 — how close to final-report standard. */
export function CompletenessMeterCard() {
  const [snap, setSnap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  const c = snapshotCompleteness(snap);
  return (
    <Card n={51639} title="Snapshot completeness meter">
      <div className="sn41-row">
        <button
          className="sn41-btn"
          onClick={() => setSnap(approveSnapshot(snap, 'owner', 5200000))}
        >
          mark reviewed
        </button>
      </div>
      <div className="sn41-meta">
        {c.pct}% complete ({c.met}/{c.total})
      </div>
      <div className="sn41-meter">
        <div className="sn41-meter-fill" style={{ width: c.pct + '%' }} />
      </div>
      {c.missing.length > 0 && <div className="sn41-meta">missing: {c.missing.join(' · ')}</div>}
    </Card>
  );
}

/** 51640 — draft / validating / confirmed states. */
export function FindingStatesCard() {
  const [snap, setSnap] = useState(() => takeSnapshot(DEMO_HUNT, 5000000));
  const byState = findingsByState(snap);
  return (
    <Card n={51640} title="Snapshot finding states">
      <table className="sn41-table">
        <thead>
          <tr>
            <th>finding</th>
            <th>state</th>
            <th>set</th>
          </tr>
        </thead>
        <tbody>
          {(snap.findings || []).map(f => {
            const cur = (snap.stateOverrides || {})[f.id] || 'draft';
            return (
              <tr key={f.id}>
                <td>{f.title}</td>
                <td>
                  <span className={'sn41-state sn41-state-' + cur}>{cur}</span>
                </td>
                <td>
                  <select
                    className="sn41-input"
                    value={cur}
                    onChange={e => setSnap(markFindingState(snap, f.id, e.target.value))}
                  >
                    {FINDING_STATES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="sn41-meta" style={{ marginTop: 8 }}>
        draft: {byState.draft.length} · validating: {byState.validating.length} · confirmed:{' '}
        {byState.confirmed.length}
      </div>
    </Card>
  );
}

export function SnapshotSuiteGallery() {
  return (
    <div className="sn41-gallery">
      <h3>Wave 41 · Mid-hunt snapshots (51621–51640)</h3>
      <OneClickSnapshotCard />
      <ScheduledSnapshotCard />
      <SnapshotDiffCard />
      <SnapshotTimelineCard />
      <SnapshotShareCard />
      <SnapshotPdfCard />
      <SnapshotAnnotateCard />
      <SnapshotWatermarkCard />
      <SnapshotDeltasCard />
      <ExecutiveModeCard />
      <TechnicalModeCard />
      <SnapshotSubscribeCard />
      <SnapshotApprovalCard />
      <SnapshotRetentionCard />
      <SnapshotSearchCard />
      <SnapshotTemplateCard />
      <SnapshotLanguageCard />
      <LivePreviewCard />
      <CompletenessMeterCard />
      <FindingStatesCard />
    </div>
  );
}
