/**
 * FindingTriage.jsx — wave 39 (ideas 51521–51540): finding triage
 * collaboration suite.
 * Real working components driving local state — no canned-only controls.
 * All logic comes from findingTriageCore.js.
 * The FindingTriageGallery is exported for review only; it is not
 * mounted in app UI.
 */
import React, { useState } from 'react';
import {
  signatureOf,
  findDuplicates,
  mergeDuplicates,
  timelineSlots,
  timelinePosition,
  mapNodes,
  KANBAN_COLUMNS,
  emptyKanban,
  moveToColumn,
  kanbanColumnOf,
  TRIAGE_ACTIONS,
  triageAction,
  assignFinding,
  unassignFinding,
  newCommentThread,
  addComment,
  threadCount,
  watchFinding,
  unwatchFinding,
  watchersFor,
  recordVersion,
  versionHistory,
  diffVersions,
  evidencePreview,
  replayScript,
  replayStep,
  provenanceOf,
  provenanceLine,
  exportFindingMarkdown,
  exportFindingJson,
  shareToken,
  shareLink,
  printViewHtml,
  batchPrintViewHtml,
  notificationChannels,
  shouldNotify,
  notificationFor,
  quietBatch,
  isQuietCandidate,
  digestEmail,
  rssFeed,
  webhookPayload,
  webhookDelivery,
} from './findingTriageCore.js';

function Card({ n, title, children }) {
  return (
    <div className="tr39-card" data-idea={n}>
      <div className="tr39-card-head">
        <span className="tr39-num">{n}</span>
        <h4>{title}</h4>
      </div>
      <div className="tr39-card-body">{children}</div>
    </div>
  );
}

const SAMPLE_FINDINGS = [
  {
    id: 'F-201',
    title: 'SQL injection in login form',
    type: 'sql-injection',
    severity: 'critical',
    confidence: 92,
    asset: '/api/login',
    technique: 'sqli',
    evidence: ['Quote in username returned 12 rows', 'MySQL syntax error leaked in response'],
    seq: 8,
    detectedAtMs: 1000,
    phase: 'exploit',
    module: 'vulnDetector',
    steeringDecision: 'depth-first on auth',
    triageStatus: 'new',
    steps: [
      { action: 'send payload', detail: "' OR 1=1 -- in username", technique: 'sqli' },
      { action: 'observe response', detail: '12 rows returned', technique: 'sqli' },
    ],
  },
  {
    id: 'F-202',
    title: 'SQL injection at login form',
    type: 'sql-injection',
    severity: 'critical',
    confidence: 88,
    asset: '/api/login',
    technique: 'sqli',
    evidence: ['Blind timing difference of 4.2s'],
    seq: 7,
    detectedAtMs: 2000,
    phase: 'exploit',
    module: 'vulnDetector',
    steeringDecision: 'depth-first on auth',
    triageStatus: 'new',
    steps: [{ action: 'time-based probe', detail: 'SLEEP(5) delayed response', technique: 'sqli' }],
  },
  {
    id: 'F-203',
    title: 'Reflected XSS in profile name',
    type: 'xss',
    severity: 'high',
    confidence: 74,
    asset: '/profile',
    technique: 'xss',
    evidence: ['Script tag reflected without encoding'],
    seq: 6,
    detectedAtMs: 3000,
    phase: 'exploit',
    module: 'vulnDetector',
    steeringDecision: 'breadth-first input sweep',
    triageStatus: 'triaging',
    assignee: 'Arvind',
    steps: [{ action: 'inject payload', detail: '<script>alert(1)</script>', technique: 'xss' }],
  },
  {
    id: 'F-204',
    title: 'SSRF in avatar fetch',
    type: 'ssrf',
    severity: 'medium',
    confidence: 66,
    asset: '/api/fetch',
    technique: 'ssrf',
    evidence: ['Server connected to a controlled URL'],
    seq: 5,
    detectedAtMs: 4000,
    phase: 'exploit',
    module: 'vulnDetector',
    steeringDecision: 'auto',
    triageStatus: 'new',
    steps: [],
  },
  {
    id: 'F-205',
    title: 'Missing security headers',
    type: 'headers',
    severity: 'low',
    confidence: 95,
    asset: '/',
    technique: 'headers',
    evidence: ['No Content-Security-Policy header'],
    seq: 4,
    detectedAtMs: 5000,
    phase: 'recon',
    module: 'eliteRecon',
    steeringDecision: 'auto',
    triageStatus: 'new',
    steps: [],
  },
  {
    id: 'F-206',
    title: 'Permissive CORS policy',
    type: 'cors',
    severity: 'low',
    confidence: 81,
    asset: '/api',
    technique: 'cors',
    evidence: ['Access-Control-Allow-Origin: * returned'],
    seq: 3,
    detectedAtMs: 6000,
    phase: 'recon',
    module: 'corsChecker',
    steeringDecision: 'auto',
    triageStatus: 'new',
    steps: [],
  },
];

/* 51521 */ export function DuplicateCard() {
  const [merged, setMerged] = useState(null);
  const dupes = findDuplicates(SAMPLE_FINDINGS, SAMPLE_FINDINGS[0]);
  return (
    <Card n={51521} title="Live duplicate detection">
      <p className="tr39-note">
        F-201 signature: <code>{signatureOf(SAMPLE_FINDINGS[0])}</code>
      </p>
      <p className="tr39-note">
        Near-duplicates of F-201: {dupes.length ? dupes.join(', ') : 'none'}
      </p>
      <button className="tr39-btn" onClick={() => setMerged(mergeDuplicates(SAMPLE_FINDINGS))}>
        Merge duplicates
      </button>
      {merged && (
        <ul className="tr39-list">
          {merged.map(f => (
            <li key={f.id}>
              {f.id}{' '}
              {f.mergeCount > 1 && (
                <span className="tr39-tag">
                  merged ×{f.mergeCount} ({f.mergeIds.join(', ')})
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* 51522 */ export function TimelineCard() {
  const [sel, setSel] = useState(null);
  const slots = timelineSlots(SAMPLE_FINDINGS, 0, 2000);
  return (
    <Card n={51522} title="Finding timeline view">
      <div className="tr39-timeline">
        {slots.map(s => (
          <button
            key={s.bucket}
            className={'tr39-slot' + (sel === s.bucket ? ' tr39-active' : '')}
            onClick={() => setSel(sel === s.bucket ? null : s.bucket)}
          >
            <span className="tr39-bar" style={{ height: 8 + s.count * 14 }} />
            <span>{s.count}</span>
          </button>
        ))}
      </div>
      {sel != null && (
        <ul className="tr39-list">
          {SAMPLE_FINDINGS.filter(f => Math.floor((f.detectedAtMs - 0) / 2000) === sel).map(f => (
            <li key={f.id}>
              {f.id} — {f.title}{' '}
              <span className="tr39-note">
                (pos {timelinePosition(f.detectedAtMs, 0, 7000).toFixed(2)})
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* 51523 */ export function MapCard() {
  const nodes = mapNodes(SAMPLE_FINDINGS, 4);
  return (
    <Card n={51523} title="Finding map view">
      <div className="tr39-map">
        {nodes.map(nd => (
          <div
            key={nd.asset}
            className={'tr39-node tr39-sev-' + nd.topSeverity}
            style={{ left: (nd.x / 4) * 100 + '%', top: (nd.y / 4.5) * 100 + '%' }}
            title={nd.asset}
          >
            {nd.count}
          </div>
        ))}
      </div>
      <ul className="tr39-list">
        {nodes.map(nd => (
          <li key={nd.asset}>
            {nd.asset} — {nd.count} findings, top: {nd.topSeverity}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51524 */ export function KanbanCard() {
  const [board, setBoard] = useState(() => {
    let b = emptyKanban();
    for (const f of SAMPLE_FINDINGS)
      b = moveToColumn(b, f.id, f.triageStatus === 'triaging' ? 'triaging' : 'new');
    return b;
  });
  const [selId, setSelId] = useState('F-201');
  return (
    <Card n={51524} title="Finding kanban board">
      <div className="tr39-kanban">
        {KANBAN_COLUMNS.map(c => (
          <div key={c} className="tr39-col">
            <h5>
              {c} ({board[c].length})
            </h5>
            {board[c].map(id => (
              <div key={id} className="tr39-chip">
                {id}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="tr39-row">
        <select value={selId} onChange={e => setSelId(e.target.value)}>
          {SAMPLE_FINDINGS.map(f => (
            <option key={f.id} value={f.id}>
              {f.id}
            </option>
          ))}
        </select>
        {KANBAN_COLUMNS.map(c => (
          <button
            key={c}
            className="tr39-btn"
            onClick={() => setBoard(moveToColumn(board, selId, c))}
          >
            → {c}
          </button>
        ))}
      </div>
      <p className="tr39-note">
        {selId} currently in: {kanbanColumnOf(board, selId)}
      </p>
    </Card>
  );
}

/* 51525 */ export function TriageCard() {
  const [feed, setFeed] = useState(SAMPLE_FINDINGS.slice(0, 3));
  return (
    <Card n={51525} title="Live triage actions">
      <ul className="tr39-list">
        {feed.map(f => (
          <li key={f.id}>
            {f.id} — <span className={'tr39-sev-' + f.severity}>{f.severity}</span> · status:{' '}
            <strong>{f.triageStatus}</strong>
            <div className="tr39-row">
              {TRIAGE_ACTIONS.map(a => (
                <button
                  key={a}
                  className="tr39-btn"
                  onClick={() => setFeed(feed.map(x => (x.id === f.id ? triageAction(x, a) : x)))}
                >
                  {a}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51526 */ export function AssignCard() {
  const [feed, setFeed] = useState(SAMPLE_FINDINGS.slice(0, 3));
  const [who, setWho] = useState('Shubham Agarwal');
  return (
    <Card n={51526} title="Finding assignment">
      <input
        className="tr39-input"
        value={who}
        onChange={e => setWho(e.target.value)}
        aria-label="teammate name"
      />
      <ul className="tr39-list">
        {feed.map(f => (
          <li key={f.id}>
            {f.id} — assignee: <strong>{f.assignee || 'unassigned'}</strong>
            <div className="tr39-row">
              <button
                className="tr39-btn"
                onClick={() => setFeed(feed.map(x => (x.id === f.id ? assignFinding(x, who) : x)))}
              >
                Assign
              </button>
              <button
                className="tr39-btn"
                onClick={() => setFeed(feed.map(x => (x.id === f.id ? unassignFinding(x) : x)))}
              >
                Unassign
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51527 */ export function CommentsCard() {
  const [threads, setThreads] = useState({ 'F-201': newCommentThread('F-201') });
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    setThreads({
      ...threads,
      'F-201': addComment(threads['F-201'], { author: 'Bhavesh', text: draft, tsMs: 9000 }),
    });
    setDraft('');
  };
  return (
    <Card n={51527} title="Finding comments">
      <p className="tr39-note">Thread on F-201 · {threadCount(threads['F-201'])} comments</p>
      <ul className="tr39-list">
        {threads['F-201'].comments.map(c => (
          <li key={c.id}>
            <strong>{c.author}:</strong> {c.text}
          </li>
        ))}
      </ul>
      <div className="tr39-row">
        <input
          className="tr39-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          aria-label="discuss this finding"
        />
        <button className="tr39-btn" onClick={add}>
          Post
        </button>
      </div>
    </Card>
  );
}

/* 51528 */ export function WatchersCard() {
  const [watchers, setWatchers] = useState(watchFinding([], 'F-201', 'Sukrit Chakravarty'));
  const toggle = (id, user) => {
    const watching = watchersFor(watchers, id).includes(user);
    setWatchers(watching ? unwatchFinding(watchers, id, user) : watchFinding(watchers, id, user));
  };
  return (
    <Card n={51528} title="Finding watchers">
      <ul className="tr39-list">
        {SAMPLE_FINDINGS.slice(0, 3).map(f => {
          const ws = watchersFor(watchers, f.id);
          return (
            <li key={f.id}>
              {f.id} — watchers: {ws.length ? ws.join(', ') : 'none'}
              <button className="tr39-btn" onClick={() => toggle(f.id, 'Bhavesh')}>
                {ws.includes('Bhavesh') ? 'Unfollow' : 'Follow'}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* 51529 */ export function VersionCard() {
  const [history, setHistory] = useState([]);
  const [f, setF] = useState(SAMPLE_FINDINGS[0]);
  const snap = () => setHistory(recordVersion(history, f, 10000 + history.length * 1000));
  const bump = () =>
    setF({ ...f, confidence: Math.min(99, (f.confidence || 0) + 2), triageStatus: 'triaging' });
  const versions = versionHistory(history, f.id);
  const diff =
    versions.length >= 2
      ? diffVersions(versions[versions.length - 2].snapshot, versions[versions.length - 1].snapshot)
      : [];
  return (
    <Card n={51529} title="Finding version history">
      <div className="tr39-row">
        <button className="tr39-btn" onClick={bump}>
          Evolve finding (confidence +2, triaging)
        </button>
        <button className="tr39-btn" onClick={snap}>
          Record version
        </button>
      </div>
      <p className="tr39-note">{versions.length} versions recorded</p>
      <ul className="tr39-list">
        {versions.map((v, i) => (
          <li key={i}>
            v{i + 1} — sev {v.snapshot.severity}, conf {v.snapshot.confidence}, status{' '}
            {v.snapshot.triageStatus}
          </li>
        ))}
      </ul>
      {diff.length > 0 && (
        <p className="tr39-note">
          Latest diff: {diff.map(d => `${d.field}: ${d.from} → ${d.to}`).join('; ')}
        </p>
      )}
    </Card>
  );
}

/* 51530 */ export function EvidencePreviewCard() {
  const [expanded, setExpanded] = useState({});
  const f = SAMPLE_FINDINGS[0];
  const prev = evidencePreview(f.evidence, expanded[f.id] ? 99 : 2);
  return (
    <Card n={51530} title="Inline evidence preview">
      <p className="tr39-note">
        {f.id} — {f.title}
      </p>
      <ul className="tr39-list">
        {prev.preview.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
      {prev.more > 0 && (
        <button className="tr39-btn" onClick={() => setExpanded({ ...expanded, [f.id]: true })}>
          Show {prev.more} more
        </button>
      )}
    </Card>
  );
}

/* 51531 */ export function ReplayCard() {
  const [idx, setIdx] = useState(0);
  const script = replayScript(SAMPLE_FINDINGS[0]);
  const step = replayStep(script, idx);
  return (
    <Card n={51531} title="Finding replay">
      <p className="tr39-note">F-201 — {step.total} steps</p>
      {step.current && (
        <p>
          <strong>Step {step.current.n}:</strong> {step.current.action} —{' '}
          <code>{step.current.detail}</code>
        </p>
      )}
      <div className="tr39-row">
        <button
          className="tr39-btn"
          disabled={!step.hasPrev}
          onClick={() => setIdx(step.index - 1)}
        >
          ← Prev
        </button>
        <button
          className="tr39-btn"
          disabled={!step.hasNext}
          onClick={() => setIdx(step.index + 1)}
        >
          Next →
        </button>
      </div>
    </Card>
  );
}

/* 51532 */ export function ProvenanceCard() {
  return (
    <Card n={51532} title="Finding provenance">
      <ul className="tr39-list">
        {SAMPLE_FINDINGS.slice(0, 4).map(f => {
          const p = provenanceOf(f);
          return (
            <li key={f.id}>
              {f.id} — {provenanceLine(p)} <span className="tr39-note">({p.technique})</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* 51533 */ export function ExportCard() {
  const [mode, setMode] = useState('md');
  const f = SAMPLE_FINDINGS[0];
  const text = mode === 'md' ? exportFindingMarkdown(f) : exportFindingJson(f);
  return (
    <Card n={51533} title="Finding export">
      <div className="tr39-row">
        <button
          className={'tr39-btn' + (mode === 'md' ? ' tr39-active' : '')}
          onClick={() => setMode('md')}
        >
          Markdown
        </button>
        <button
          className={'tr39-btn' + (mode === 'json' ? ' tr39-active' : '')}
          onClick={() => setMode('json')}
        >
          JSON
        </button>
      </div>
      <pre className="tr39-pre">
        {text.slice(0, 420)}
        {text.length > 420 ? '…' : ''}
      </pre>
    </Card>
  );
}

/* 51534 */ export function ShareCard() {
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const f = SAMPLE_FINDINGS[0];
  return (
    <Card n={51534} title="Finding share links">
      <p className="tr39-note">
        Token: <code>{shareToken(f.id)}</code> (read-only)
      </p>
      <button
        className="tr39-btn"
        onClick={() => {
          setLink(shareLink(f));
          setCopied(false);
        }}
      >
        Generate link
      </button>
      {link && (
        <div className="tr39-row">
          <code className="tr39-note">{link}</code>
          <button className="tr39-btn" onClick={() => setCopied(true)}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      )}
    </Card>
  );
}

/* 51535 */ export function PrintCard() {
  const [batch, setBatch] = useState(false);
  const html = batch
    ? batchPrintViewHtml(SAMPLE_FINDINGS.slice(0, 2), 'Nightly hunt')
    : printViewHtml(SAMPLE_FINDINGS[0]);
  return (
    <Card n={51535} title="Finding print view">
      <button className="tr39-btn" onClick={() => setBatch(!batch)}>
        {batch ? 'Show single' : 'Show batch'}
      </button>
      <div className="tr39-print" dangerouslySetInnerHTML={{ __html: html }} />
    </Card>
  );
}

/* 51536 */ export function NotifyCard() {
  const [threshold, setThreshold] = useState('high');
  const [muted, setMuted] = useState(false);
  const prefs = { threshold, muted };
  return (
    <Card n={51536} title="Finding notifications">
      <div className="tr39-row">
        <label>
          Threshold:
          <select value={threshold} onChange={e => setThreshold(e.target.value)}>
            {['critical', 'high', 'medium', 'low'].map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="tr39-btn" onClick={() => setMuted(!muted)}>
          {muted ? 'Unmute' : 'Mute all'}
        </button>
      </div>
      <ul className="tr39-list">
        {SAMPLE_FINDINGS.map(f => {
          const n = notificationFor(f, prefs);
          return (
            <li key={f.id}>
              {f.id} [{f.severity}] —{' '}
              {n ? (
                `notify via ${n.channels.join(', ')}`
              ) : (
                <span className="tr39-note">silent</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="tr39-note">
        Channel map: critical → {notificationChannels('critical').join(', ')}
      </p>
    </Card>
  );
}

/* 51537 */ export function QuietCard() {
  const [on, setOn] = useState(true);
  const { loud, digest } = quietBatch(on ? SAMPLE_FINDINGS : []);
  return (
    <Card n={51537} title="Quiet finding mode">
      <button className="tr39-btn" onClick={() => setOn(!on)}>
        {on ? 'Quiet mode: ON' : 'Quiet mode: OFF'}
      </button>
      <p className="tr39-note">
        Loud now: {loud.length} · batched to digest: {digest.length}
      </p>
      <ul className="tr39-list">
        {digest.map(f => (
          <li key={f.id}>
            {f.id} — {f.title} <span className="tr39-note">(low → hourly digest)</span>
          </li>
        ))}
      </ul>
      {!on && <p className="tr39-note">Everything notifies immediately.</p>}
    </Card>
  );
}

/* 51538 */ export function DigestCard() {
  const [period, setPeriod] = useState('hourly');
  const email = digestEmail(SAMPLE_FINDINGS.slice(2), 'Nightly hunt', period);
  return (
    <Card n={51538} title="Finding digest emails">
      <div className="tr39-row">
        {['hourly', 'daily'].map(p => (
          <button
            key={p}
            className={'tr39-btn' + (period === p ? ' tr39-active' : '')}
            onClick={() => setPeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <p className="tr39-note">
        <strong>{email.subject}</strong>
      </p>
      <pre className="tr39-pre">{email.body}</pre>
    </Card>
  );
}

/* 51539 */ export function RssCard() {
  const [show, setShow] = useState(false);
  const xml = rssFeed(SAMPLE_FINDINGS.slice(0, 3), 'Nightly hunt');
  return (
    <Card n={51539} title="Finding RSS feed">
      <button className="tr39-btn" onClick={() => setShow(!show)}>
        {show ? 'Hide XML' : 'Preview XML'}
      </button>
      {show && <pre className="tr39-pre">{xml.slice(0, 700)}…</pre>}
    </Card>
  );
}

/* 51540 */ export function WebhookCard() {
  const [endpoint, setEndpoint] = useState('https://hooks.example.com/infinity');
  const [sent, setSent] = useState(null);
  const fire = () => {
    const payload = webhookPayload(SAMPLE_FINDINGS[0], 'finding.created', 12000);
    setSent(webhookDelivery(payload, endpoint));
  };
  return (
    <Card n={51540} title="Finding webhook">
      <input
        className="tr39-input"
        value={endpoint}
        onChange={e => setEndpoint(e.target.value)}
        aria-label="webhook endpoint"
      />
      <button className="tr39-btn" onClick={fire}>
        Build delivery
      </button>
      {sent && (
        <pre className="tr39-pre">
          {JSON.stringify(
            { endpoint: sent.endpoint, idempotencyKey: sent.idempotencyKey },
            null,
            2
          )}
        </pre>
      )}
      {!sent && (
        <p className="tr39-note">
          Quiet-candidate? F-205: {isQuietCandidate(SAMPLE_FINDINGS[4]) ? 'yes (low)' : 'no'}
        </p>
      )}
    </Card>
  );
}

// --- gallery (export only — not mounted in app UI) -------------------------------
export function FindingTriageGallery() {
  return (
    <div className="tr39-gallery">
      <h3>Wave 39 · Finding triage collaboration (20 ideas)</h3>
      <DuplicateCard />
      <TimelineCard />
      <MapCard />
      <KanbanCard />
      <TriageCard />
      <AssignCard />
      <CommentsCard />
      <WatchersCard />
      <VersionCard />
      <EvidencePreviewCard />
      <ReplayCard />
      <ProvenanceCard />
      <ExportCard />
      <ShareCard />
      <PrintCard />
      <NotifyCard />
      <QuietCard />
      <DigestCard />
      <RssCard />
      <WebhookCard />
    </div>
  );
}
