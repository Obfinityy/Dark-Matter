/**
 * SnapshotDistrib.jsx — wave 42 (ideas 51641–51660): snapshot distribution suite.
 *
 * 20 working components, each driving the pure logic in snapshotDistribCore.js
 * with real local state. Export-only gallery (not mounted in the app).
 */
import React, { useMemo, useState } from 'react';
import {
  newSnapshotComment,
  commentsForSection,
  nextSnapshotVersion,
  freezeSnapshot,
  isFrozen,
  snapshotDelta,
  diffAlertLevel,
  SNAPSHOT_API_ROUTES,
  snapshotApiDto,
  snapshotEmbedHtml,
  EMBED_THEMES,
  redactSnapshot,
  REDACT_TOKEN,
  snapshotCover,
  snapshotToc,
  severityDistribution,
  findingTrend,
  snapshotAppendices,
  signoffRequest,
  recordSignature,
  signoffStatus,
  expiringLink,
  linkExpired,
  logSnapshotAccess,
  accessLogFor,
  uniqueViewers,
  SNAPSHOT_LANGUAGES,
  snapshotSectionLabels,
  snapshotPrintPlan,
  mobileSnapshotView,
  snapshotVoiceScript,
  answerSnapshotQuestion,
  snapshotComparison,
  milestoneSnapshots,
  MILESTONE_PHASES,
} from './snapshotDistribCore.js';

const ILLUS_FINDINGS = [
  {
    id: 'f1',
    title: 'Reflected XSS on search',
    severity: 'high',
    type: 'xss',
    asset: 'app.example.com',
  },
  {
    id: 'f2',
    title: 'SQLi in product filter',
    severity: 'critical',
    type: 'sqli',
    asset: 'shop.example.com',
  },
  {
    id: 'f3',
    title: 'Verbose server header',
    severity: 'low',
    type: 'info',
    asset: 'app.example.com',
  },
];

const ILLUS_SNAPSHOT = {
  id: 'snap-9',
  huntId: 'hunt-7',
  target: 'example.com',
  takenAt: '2026-10-08T03:30:00+05:30',
  version: 3,
  findings: ILLUS_FINDINGS,
  internalNotes: 'operator suspects WAF bypass',
  sections: [
    {
      id: 's1',
      title: 'Executive summary',
      body: 'Three findings so far. The critical SQL injection in the product filter needs attention first.',
    },
    {
      id: 's2',
      title: 'Findings',
      body: 'Reflected XSS on search allows script execution. SQLi in product filter confirmed with time-based payload.',
    },
  ],
};

/* 51641 */ export function SnapshotComments() {
  const [comments, setComments] = useState([
    {
      id: 'sc-snap-9-1',
      snapshotId: 'snap-9',
      section: 'Findings',
      author: 'Priya',
      role: 'stakeholder',
      text: 'Is the XSS exploitable without login?',
      createdAt: 't1',
    },
  ]);
  const [text, setText] = useState('');
  const add = () => {
    try {
      setComments(c => [
        ...c,
        newSnapshotComment({
          snapshotId: 'snap-9',
          section: 'Findings',
          author: 'You',
          text,
          createdAt: 'now',
        }),
      ]);
      setText('');
    } catch {
      /* validation */
    }
  };
  const list = commentsForSection(comments, 'snap-9', 'Findings');
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot comments</h4>
      <ul className="sd42-list">
        {list.map(c => (
          <li key={c.id}>
            <b>{c.author}</b> <span className="sd42-dim">[{c.role}]</span>: {c.text}
          </li>
        ))}
      </ul>
      <div className="sd42-row">
        <input
          className="sd42-input"
          value={text}
          onChange={e => setText(e.target.value)}
          aria-label="Comment as stakeholder…"
        />
        <button className="sd42-btn" onClick={add}>
          Post
        </button>
      </div>
    </div>
  );
}

/* 51642 */ export function SnapshotVersionBadge() {
  const [history, setHistory] = useState([
    { id: 'snap-7', version: 1 },
    { id: 'snap-8', version: 2 },
  ]);
  const next = nextSnapshotVersion(history);
  const freeze = () =>
    setHistory(h => [
      ...h,
      freezeSnapshot(
        { id: `snap-${8 + h.length}`, target: 'example.com' },
        nextSnapshotVersion(h),
        'now'
      ),
    ]);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot versioning</h4>
      <div className="sd42-row">
        {history.map(s => (
          <span key={s.id} className="sd42-chip">
            v{s.version}
            {isFrozen(s) ? ' · sealed' : ''}
          </span>
        ))}
      </div>
      <button className="sd42-btn" onClick={freeze}>
        Freeze v{next}
      </button>
    </div>
  );
}

/* 51643 */ export function SnapshotDiffAlert() {
  const prev = {
    findings: [
      { id: 'f1', severity: 'high' },
      { id: 'f3', severity: 'low' },
    ],
  };
  const next = {
    findings: [
      ...ILLUS_FINDINGS,
      { id: 'f4', severity: 'medium', title: 'Open redirect' },
      { id: 'f5', severity: 'medium', title: 'Clickjacking' },
      { id: 'f6', severity: 'low', title: 'Cookie flags' },
    ],
  };
  const delta = useMemo(() => snapshotDelta(prev, next), []);
  const level = diffAlertLevel(delta);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot diff alerts</h4>
      <p className="sd42-p">
        +{delta.addedCount} new · −{delta.removedCount} resolved · {delta.changedCount} severity
        changes
      </p>
      <span className={`sd42-badge sd42-${level}`}>
        {level === 'none' ? 'no alert' : `${level} change`}
      </span>
    </div>
  );
}

/* 51644 */ export function SnapshotApiDocs() {
  const dto = useMemo(() => snapshotApiDto(ILLUS_SNAPSHOT), []);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot API</h4>
      <ul className="sd42-list">
        {SNAPSHOT_API_ROUTES.map(r => (
          <li key={r.path}>
            <code className="sd42-code">
              {r.method} {r.path}
            </code>{' '}
            — {r.desc}
          </li>
        ))}
      </ul>
      <details>
        <summary className="sd42-dim">Public DTO fields</summary>
        <code className="sd42-code">{Object.keys(dto).join(', ')}</code>
      </details>
    </div>
  );
}

/* 51645 */ export function SnapshotEmbed() {
  const [theme, setTheme] = useState('auto');
  const html = useMemo(
    () =>
      snapshotEmbedHtml({ snapshotId: 'snap-9', baseUrl: 'https://app.infinity-ai.local', theme }),
    [theme]
  );
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot embedding</h4>
      <div className="sd42-row">
        {EMBED_THEMES.map(t => (
          <button
            key={t}
            className={`sd42-btn${theme === t ? ' sd42-on' : ''}`}
            onClick={() => setTheme(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <pre className="sd42-pre">{html}</pre>
    </div>
  );
}

/* 51646 */ export function SnapshotRedaction() {
  const [on, setOn] = useState(true);
  const shown = useMemo(() => (on ? redactSnapshot(ILLUS_SNAPSHOT) : ILLUS_SNAPSHOT), [on]);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot redaction</h4>
      <label className="sd42-row">
        <input type="checkbox" checked={on} onChange={e => setOn(e.target.checked)} /> Client-safe
        copy
      </label>
      <p className="sd42-p">
        internalNotes: <code className="sd42-code">{String(shown.internalNotes)}</code>{' '}
        {on && <span className="sd42-dim">({REDACT_TOKEN} applied)</span>}
      </p>
    </div>
  );
}

/* 51647 */ export function SnapshotCoverPage() {
  const cover = useMemo(() => snapshotCover(ILLUS_SNAPSHOT), []);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot cover page</h4>
      <p className="sd42-title">{cover.title}</p>
      <p className="sd42-p">
        {cover.takenAt} · v{cover.version}
      </p>
      <p className="sd42-p">{cover.scopeSummary}</p>
    </div>
  );
}

/* 51648 */ export function SnapshotToc() {
  const toc = useMemo(
    () => snapshotToc([...ILLUS_SNAPSHOT.sections, { id: 's3', title: 'Charts', depth: 0 }]),
    []
  );
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot table of contents</h4>
      <ol className="sd42-list">
        {toc.map(t => (
          <li key={t.anchor}>
            <a className="sd42-link" href={`#${t.anchor}`}>
              {t.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* 51649 */ export function SnapshotCharts() {
  const dist = useMemo(() => severityDistribution(ILLUS_FINDINGS), []);
  const trend = useMemo(
    () =>
      findingTrend([
        { version: 1, findings: [{ severity: 'high' }] },
        { version: 2, findings: [{ severity: 'high' }, { severity: 'low' }] },
        { version: 3, findings: ILLUS_FINDINGS },
      ]),
    []
  );
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot charts</h4>
      <div className="sd42-bars">
        {Object.entries(dist).map(([k, v]) => (
          <div key={k} className="sd42-bar-row">
            <span className="sd42-dim">{k}</span>
            <div className="sd42-bar">
              <div className={`sd42-fill sd42-${k}`} style={{ width: `${v * 34}px` }} />
            </div>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <p className="sd42-p sd42-dim">
        Trend: {trend.map(t => `v${t.version}=${t.total}`).join(' → ')}
      </p>
    </div>
  );
}

/* 51650 */ export function SnapshotAppendices() {
  const apps = useMemo(() => snapshotAppendices(ILLUS_SNAPSHOT), []);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot appendices</h4>
      <ul className="sd42-list">
        {apps.map(a => (
          <li key={a.id}>
            <b>{a.title}</b>{' '}
            <span className="sd42-dim">
              ({a.kind}, {a.entries.length} entries)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51651 */ export function SnapshotSignoff() {
  const [req, setReq] = useState(() =>
    signoffRequest(
      'snap-9',
      [
        { name: 'Aarav', role: 'client' },
        { name: 'Meera', role: 'owner' },
      ],
      't0'
    )
  );
  const sign = by => setReq(r => recordSignature(r, { by, at: 'now' }));
  const st = signoffStatus(req);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot sign-off</h4>
      <p className="sd42-p">
        {st.signed}/{st.total} signed ·{' '}
        <span className={`sd42-badge sd42-${st.status}`}>{st.status}</span>
      </p>
      <div className="sd42-row">
        {req.required.map(r => (
          <button
            key={r.name}
            className="sd42-btn"
            disabled={!!r.signedAt}
            onClick={() => sign(r.name)}
          >
            {r.name}
            {r.signedAt ? ' ✓' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}

/* 51652 */ export function SnapshotExpiry() {
  const link = useMemo(
    () =>
      expiringLink({
        snapshotId: 'snap-9',
        ttlHours: 72,
        createdAt: 1000,
        baseUrl: 'https://app.infinity-ai.local',
      }),
    []
  );
  const [now, setNow] = useState(2000);
  const expired = linkExpired(link, now);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot expiry</h4>
      <p className="sd42-p">
        <code className="sd42-code">{link.url}</code>
      </p>
      <p className="sd42-p">
        Expires after {link.ttlHours}h ·{' '}
        <span className={`sd42-badge sd42-${expired ? 'significant' : 'info'}`}>
          {expired ? 'expired' : 'active'}
        </span>
      </p>
      <button className="sd42-btn" onClick={() => setNow(link.expiresAt + 1)}>
        Fast-forward past expiry
      </button>
    </div>
  );
}

/* 51653 */ export function SnapshotAccessLog() {
  const [log, setLog] = useState(() =>
    logSnapshotAccess([], {
      snapshotId: 'snap-9',
      viewer: 'priya@client.co',
      role: 'stakeholder',
      at: 't1',
    })
  );
  const entries = accessLogFor(log, 'snap-9');
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot access logs</h4>
      <p className="sd42-p">
        {uniqueViewers(log, 'snap-9').length} unique viewer{entries.length === 1 ? '' : 's'}
      </p>
      <ul className="sd42-list">
        {entries.map((e, i) => (
          <li key={i}>
            {e.viewer}{' '}
            <span className="sd42-dim">
              [{e.role}] at {e.at}
            </span>
          </li>
        ))}
      </ul>
      <button
        className="sd42-btn"
        onClick={() =>
          setLog(l =>
            logSnapshotAccess(l, {
              snapshotId: 'snap-9',
              viewer: 'ops@infinity-ai.local',
              at: 'now',
            })
          )
        }
      >
        Record a view
      </button>
    </div>
  );
}

/* 51654 */ export function SnapshotTranslate() {
  const [lang, setLang] = useState('en');
  const labels = snapshotSectionLabels(lang);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot translation</h4>
      <div className="sd42-row">
        {SNAPSHOT_LANGUAGES.map(l => (
          <button
            key={l}
            className={`sd42-btn${lang === l ? ' sd42-on' : ''}`}
            onClick={() => setLang(l)}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="sd42-p">
        {labels.cover} · {labels.findings} · {labels.charts} · {labels.appendices} ·{' '}
        {labels.signoff}
      </p>
    </div>
  );
}

/* 51655 */ export function SnapshotPrint() {
  const plan = useMemo(
    () => snapshotPrintPlan({ ...ILLUS_SNAPSHOT, sections: ILLUS_SNAPSHOT.sections }),
    []
  );
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot print optimization</h4>
      <p className="sd42-p">
        {plan.pageSize} {plan.orientation} · margins {plan.marginsMm.top}/{plan.marginsMm.right}mm
      </p>
      <p className="sd42-p sd42-dim">
        Header: {plan.header} · Footer: {plan.footer}
      </p>
    </div>
  );
}

/* 51656 */ export function SnapshotMobile() {
  const view = useMemo(() => mobileSnapshotView(ILLUS_SNAPSHOT), []);
  return (
    <div className="sd42-card sd42-phone">
      <h4 className="sd42-h">Snapshot mobile view</h4>
      <p className="sd42-title">{view.title}</p>
      <p className="sd42-p">
        {view.total} findings · {view.counts.critical} critical
      </p>
      <ul className="sd42-list">
        {view.topFindings.map(f => (
          <li key={f.id}>
            <span className={`sd42-badge sd42-${f.severity}`}>{f.severity}</span> {f.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51657 */ export function SnapshotVoiceSummary() {
  const [played, setPlayed] = useState(false);
  const v = useMemo(() => snapshotVoiceScript(ILLUS_SNAPSHOT), []);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot voice summary</h4>
      <p className="sd42-p sd42-dim">
        ~{v.estSeconds}s · voice {v.voice}
        {played ? ' · played' : ''}
      </p>
      <p className="sd42-p">“{v.script}”</p>
      <button className="sd42-btn" onClick={() => setPlayed(true)}>
        Play walkthrough
      </button>
    </div>
  );
}

/* 51658 */ export function SnapshotQA() {
  const [q, setQ] = useState('Which finding is critical?');
  const res = useMemo(() => answerSnapshotQuestion(ILLUS_SNAPSHOT, q), [q]);
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot Q&amp;A</h4>
      <div className="sd42-row">
        <input className="sd42-input" value={q} onChange={e => setQ(e.target.value)} />
        <span className="sd42-dim">confidence {res.confidence}%</span>
      </div>
      <p className="sd42-p">{res.answer}</p>
      <p className="sd42-p sd42-dim">Grounded in: {res.groundedIn.join(', ') || '—'}</p>
    </div>
  );
}

/* 51659 */ export function SnapshotCompareCharts() {
  const comp = useMemo(
    () =>
      snapshotComparison([
        { version: 1, findings: [{ severity: 'high' }] },
        { version: 2, findings: [{ severity: 'high' }, { severity: 'low' }] },
        { version: 3, findings: ILLUS_FINDINGS },
      ]),
    []
  );
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot comparison charts</h4>
      <div className="sd42-bars">
        {comp.versions.map((v, i) => (
          <div key={v} className="sd42-bar-row">
            <span className="sd42-dim">{v}</span>
            <div className="sd42-bar">
              <div className="sd42-fill sd42-high" style={{ width: `${comp.totals[i] * 34}px` }} />
            </div>
            <b>{comp.totals[i]}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 51660 */ export function SnapshotMilestones() {
  const marks = useMemo(
    () =>
      milestoneSnapshots([
        { type: 'phase-complete', phase: 'recon', at: 't1' },
        { type: 'finding', phase: 'recon', at: 't2' },
        { type: 'phase-complete', phase: 'scanning', at: 't3' },
      ]),
    []
  );
  return (
    <div className="sd42-card">
      <h4 className="sd42-h">Snapshot milestone markers</h4>
      <p className="sd42-p sd42-dim">Auto-capture on: {MILESTONE_PHASES.join(', ')}</p>
      <ul className="sd42-list">
        {marks.map(m => (
          <li key={m.id}>
            <span className="sd42-chip">{m.phase}</span> {m.reason}{' '}
            <span className="sd42-dim">at {m.at}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SnapshotDistribGallery() {
  return (
    <div className="sd42-gallery">
      <SnapshotComments />
      <SnapshotVersionBadge />
      <SnapshotDiffAlert />
      <SnapshotApiDocs />
      <SnapshotEmbed />
      <SnapshotRedaction />
      <SnapshotCoverPage />
      <SnapshotToc />
      <SnapshotCharts />
      <SnapshotAppendices />
      <SnapshotSignoff />
      <SnapshotExpiry />
      <SnapshotAccessLog />
      <SnapshotTranslate />
      <SnapshotPrint />
      <SnapshotMobile />
      <SnapshotVoiceSummary />
      <SnapshotQA />
      <SnapshotCompareCharts />
      <SnapshotMilestones />
    </div>
  );
}
