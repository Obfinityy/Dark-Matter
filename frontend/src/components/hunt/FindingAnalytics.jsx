/**
 * FindingAnalytics.jsx — wave 39 (ideas 51541–51560): finding analytics
 * and governance suite.
 * Real working components driving local state — no canned-only controls.
 * All logic comes from findingAnalyticsCore.js.
 * The FindingAnalyticsGallery is exported for review only; it is not
 * mounted in app UI.
 */
import React, { useState } from 'react';
import {
  FINDING_API_ROUTES,
  apiRouteList,
  apiFindingShape,
  WIDGET_KINDS,
  widgetPayload,
  heatmapCells,
  trendSeries,
  compareHunts,
  MILESTONES,
  milestonesReached,
  nextMilestone,
  leaderboard,
  coverageMeter,
  dedupReviewQueue,
  splitGroup,
  resolveReview,
  castVote,
  severityConsensus,
  slaStatus,
  agingAlerts,
  bulkTriage,
  bulkAssign,
  addTag,
  removeTag,
  tagsFor,
  findingsByTag,
  saveView,
  applyView,
  deleteView,
  presentationOrder,
  presentationStep,
  voiceBriefingScript,
  mobileCardPayload,
  offlineSnapshot,
  offlineDiff,
  redactFinding,
  redactionNotice,
} from './findingAnalyticsCore.js';

function Card({ n, title, children }) {
  return (
    <div className="an39-card" data-idea={n}>
      <div className="an39-card-head">
        <span className="an39-num">{n}</span>
        <h4>{title}</h4>
      </div>
      <div className="an39-card-body">{children}</div>
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
    module: 'vulnDetector',
    evidence: ['Quote in username returned 12 rows'],
    seq: 8,
    detectedAtMs: 1000,
    triageStatus: 'new',
  },
  {
    id: 'F-202',
    title: 'SQL injection at login form',
    type: 'sql-injection',
    severity: 'critical',
    confidence: 88,
    asset: '/api/login',
    technique: 'sqli',
    module: 'vulnDetector',
    evidence: ['Blind timing difference of 4.2s'],
    seq: 7,
    detectedAtMs: 2000,
    triageStatus: 'new',
  },
  {
    id: 'F-203',
    title: 'Reflected XSS in profile name',
    type: 'xss',
    severity: 'high',
    confidence: 74,
    asset: '/profile',
    technique: 'xss',
    module: 'vulnDetector',
    evidence: ['Script tag reflected without encoding'],
    seq: 6,
    detectedAtMs: 3000,
    triageStatus: 'triaging',
    assignee: 'Arvind',
  },
  {
    id: 'F-204',
    title: 'SSRF in avatar fetch',
    type: 'ssrf',
    severity: 'medium',
    confidence: 66,
    asset: '/api/fetch',
    technique: 'ssrf',
    module: 'vulnDetector',
    evidence: ['Server connected to a controlled URL'],
    seq: 5,
    detectedAtMs: 4000,
    triageStatus: 'new',
  },
  {
    id: 'F-205',
    title: 'Missing security headers',
    type: 'headers',
    severity: 'low',
    confidence: 95,
    asset: '/',
    technique: 'headers',
    module: 'eliteRecon',
    evidence: ['No Content-Security-Policy header'],
    seq: 4,
    detectedAtMs: 5000,
    triageStatus: 'new',
  },
  {
    id: 'F-206',
    title: 'Permissive CORS policy',
    type: 'cors',
    severity: 'low',
    confidence: 81,
    asset: '/api',
    technique: 'cors',
    module: 'corsChecker',
    evidence: ['Access-Control-Allow-Origin: * returned'],
    seq: 3,
    detectedAtMs: 6000,
    triageStatus: 'new',
  },
];

const PREV_HUNT = [
  { id: 'F-201', title: 'SQL injection in login form', severity: 'critical' },
  { id: 'F-090', title: 'Old reflected XSS', severity: 'high' },
];

/* 51541 */ export function ApiCard() {
  const [route, setRoute] = useState(FINDING_API_ROUTES[0]);
  return (
    <Card n={51541} title="Finding API">
      <ul className="an39-list">
        {apiRouteList().map(r => (
          <li key={r.path}>
            <button className="an39-link" onClick={() => setRoute([r.method, r.path, r.desc])}>
              <code>
                {r.method} {r.path}
              </code>
            </button>
          </li>
        ))}
      </ul>
      <p className="an39-note">{route[2]}</p>
      <pre className="an39-pre">
        {JSON.stringify(apiFindingShape(SAMPLE_FINDINGS[0]), null, 2).slice(0, 380)}…
      </pre>
    </Card>
  );
}

/* 51542 */ export function WidgetCard() {
  const [kind, setKind] = useState('counter');
  const payload = widgetPayload(kind, SAMPLE_FINDINGS);
  return (
    <Card n={51542} title="Finding dashboard widgets">
      <div className="an39-row">
        {WIDGET_KINDS.map(k => (
          <button
            key={k}
            className={'an39-btn' + (kind === k ? ' an39-active' : '')}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <pre className="an39-pre">{JSON.stringify(payload, null, 2)}</pre>
    </Card>
  );
}

/* 51543 */ export function HeatmapCard() {
  const cells = heatmapCells(SAMPLE_FINDINGS);
  return (
    <Card n={51543} title="Finding heatmap">
      <div className="an39-heat">
        {cells.map(c => (
          <div
            key={c.asset}
            className="an39-heatcell"
            style={{ opacity: 0.25 + c.intensity * 0.75 }}
            title={`${c.asset}: ${c.count}`}
          >
            <span>{c.asset}</span>
            <strong>{c.count}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* 51544 */ export function TrendsCard() {
  const series = trendSeries(SAMPLE_FINDINGS, 0, 2000, 4);
  return (
    <Card n={51544} title="Finding trends">
      <div className="an39-trend">
        {series.map((s, i) => (
          <div key={i} className="an39-tcol">
            <div className="an39-tbars">
              {Object.entries(s.bySeverity)
                .filter(([, n]) => n > 0)
                .map(([sev, n]) => (
                  <span
                    key={sev}
                    className={'an39-tbar an39-sev-' + sev}
                    style={{ height: n * 18 }}
                    title={`${sev}: ${n}`}
                  />
                ))}
            </div>
            <span className="an39-note">{s.count}</span>
          </div>
        ))}
      </div>
      <p className="an39-note">
        Buckets of 2000ms · total {series.reduce((a, s) => a + s.count, 0)}
      </p>
    </Card>
  );
}

/* 51545 */ export function CompareCard() {
  const c = compareHunts(SAMPLE_FINDINGS, PREV_HUNT);
  return (
    <Card n={51545} title="Finding comparison">
      <ul className="an39-list">
        <li>
          Current hunt: <strong>{c.currentCount}</strong> · previous:{' '}
          <strong>{c.previousCount}</strong>
        </li>
        <li>
          New this hunt: <strong>{c.newCount}</strong>
        </li>
        <li>
          Persisting: <strong>{c.persistingCount}</strong> · resolved since last:{' '}
          <strong>{c.resolvedCount}</strong>
        </li>
      </ul>
    </Card>
  );
}

/* 51546 */ export function MilestoneCard() {
  const [total, setTotal] = useState(27);
  const next = nextMilestone(total);
  return (
    <Card n={51546} title="Finding milestones">
      <div className="an39-row">
        <button className="an39-btn" onClick={() => setTotal(Math.max(0, total - 1))}>
          −1
        </button>
        <strong>{total} findings</strong>
        <button className="an39-btn" onClick={() => setTotal(total + 1)}>
          +1
        </button>
      </div>
      <div className="an39-row">
        {milestonesReached(total).map(m => (
          <span key={m.n} className={'an39-chip' + (m.reached ? ' an39-hit' : '')}>
            {m.n}
            {m.reached ? ' ✓' : ''}
          </span>
        ))}
      </div>
      <p className="an39-note">
        {next
          ? `Next milestone: ${next.n} (${next.remaining} to go)`
          : 'All milestones reached — legendary hunt.'}
      </p>
    </Card>
  );
}

/* 51547 */ export function LeaderboardCard() {
  const [by, setBy] = useState('technique');
  const rows = leaderboard(SAMPLE_FINDINGS, by);
  return (
    <Card n={51547} title="Finding leaderboard">
      <div className="an39-row">
        {['technique', 'module'].map(b => (
          <button
            key={b}
            className={'an39-btn' + (by === b ? ' an39-active' : '')}
            onClick={() => setBy(b)}
          >
            {b}
          </button>
        ))}
      </div>
      <ol className="an39-list">
        {rows.map(r => (
          <li key={r.key}>
            {r.key} — <strong>{r.count}</strong>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* 51548 */ export function CoverageCard() {
  const [surface] = useState([
    '/api/login',
    '/profile',
    '/api/fetch',
    '/',
    '/api',
    '/admin',
    '/api/users',
  ]);
  const cov = coverageMeter(SAMPLE_FINDINGS, surface);
  return (
    <Card n={51548} title="Finding coverage meter">
      <div className="an39-meter">
        <div className="an39-meter-fill" style={{ width: cov.pct + '%' }} />
      </div>
      <p className="an39-note">
        {cov.covered}/{cov.total} assets with findings — {cov.pct}%
      </p>
      {cov.uncovered.length > 0 && (
        <p className="an39-note">Uncovered: {cov.uncovered.join(', ')}</p>
      )}
    </Card>
  );
}

/* 51549 */ export function DedupReviewCard() {
  const mergedSample = [
    {
      ...SAMPLE_FINDINGS[0],
      mergeCount: 2,
      mergeIds: ['F-202'],
      evidence: [...SAMPLE_FINDINGS[0].evidence, ...SAMPLE_FINDINGS[1].evidence],
    },
  ];
  const [queue, setQueue] = useState(dedupReviewQueue(mergedSample));
  const [split, setSplit] = useState(null);
  return (
    <Card n={51549} title="Finding deduplication review">
      <ul className="an39-list">
        {queue.map(q => (
          <li key={q.groupId}>
            {q.groupId} — auto-merged ×{q.count} ({q.mergeIds.join(', ')}) · decision:{' '}
            <strong>{q.decision}</strong>
            <div className="an39-row">
              <button
                className="an39-btn"
                onClick={() => setQueue(resolveReview(queue, q.groupId, 'keep'))}
              >
                Keep merged
              </button>
              <button
                className="an39-btn"
                onClick={() => {
                  setQueue(resolveReview(queue, q.groupId, 'split'));
                  setSplit(splitGroup(mergedSample[0]));
                }}
              >
                Split
              </button>
            </div>
          </li>
        ))}
      </ul>
      {split && (
        <p className="an39-note">
          Split into: {split.map(f => f.id).join(', ')} (each carries its own evidence slice)
        </p>
      )}
    </Card>
  );
}

/* 51550 */ export function VotingCard() {
  const [votes, setVotes] = useState(castVote([], 'F-204', 'Shubham Agarwal', 'medium'));
  const [choice, setChoice] = useState('high');
  const consensus = severityConsensus(votes, 'F-204');
  return (
    <Card n={51550} title="Finding severity voting">
      <div className="an39-row">
        {['critical', 'high', 'medium', 'low'].map(s => (
          <button
            key={s}
            className={'an39-btn' + (choice === s ? ' an39-active' : '')}
            onClick={() => setChoice(s)}
          >
            {s}
          </button>
        ))}
        <button
          className="an39-btn"
          onClick={() => setVotes(castVote(votes, 'F-204', 'Bhavesh', choice))}
        >
          Vote as Bhavesh
        </button>
      </div>
      <p className="an39-note">
        F-204 — {consensus.total} votes · consensus: <strong>{consensus.consensus}</strong>
      </p>
      <ul className="an39-list">
        {Object.entries(consensus.tally)
          .filter(([, n]) => n > 0)
          .map(([s, n]) => (
            <li key={s}>
              {s}: {n}
            </li>
          ))}
      </ul>
    </Card>
  );
}

/* 51551 */ export function SlaCard() {
  const [nowMs, setNowMs] = useState(3700000);
  const slaMs = 3600000;
  return (
    <Card n={51551} title="Finding SLA tracking">
      <div className="an39-row">
        <button className="an39-btn" onClick={() => setNowMs(nowMs + 600000)}>
          +10 min
        </button>
        <span className="an39-note">SLA: 60 min</span>
      </div>
      <ul className="an39-list">
        {SAMPLE_FINDINGS.slice(0, 3).map(f => {
          const s = slaStatus(f, nowMs, slaMs);
          return (
            <li key={f.id}>
              {f.id} — <span className={'an39-sla-' + s.state}>{s.state}</span>{' '}
              <span className="an39-note">({Math.round(s.elapsedMs / 60000)} min elapsed)</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* 51552 */ export function AgingCard() {
  const [nowMs, setNowMs] = useState(3700000);
  const stale = agingAlerts(SAMPLE_FINDINGS, nowMs, 1800000);
  return (
    <Card n={51552} title="Finding aging alerts">
      <button className="an39-btn" onClick={() => setNowMs(nowMs + 3600000)}>
        Advance clock +60 min
      </button>
      <p className="an39-note">{stale.length} critical/high findings untriaged beyond 30 min</p>
      <ul className="an39-list">
        {stale.map(f => (
          <li key={f.id}>
            {f.id} — {f.title} <span className="an39-note">needs triage</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51553 */ export function BulkCard() {
  const [feed, setFeed] = useState(SAMPLE_FINDINGS.slice());
  const [sel, setSel] = useState(new Set(['F-204', 'F-205']));
  const toggle = id => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSel(next);
  };
  const ids = [...sel];
  return (
    <Card n={51553} title="Finding bulk actions">
      <p className="an39-note">{sel.size} selected</p>
      <ul className="an39-list">
        {feed.map(f => (
          <li key={f.id}>
            <label>
              <input type="checkbox" checked={sel.has(f.id)} onChange={() => toggle(f.id)} /> {f.id}{' '}
              — {f.triageStatus}
              {f.assignee ? ` · ${f.assignee}` : ''}
            </label>
          </li>
        ))}
      </ul>
      <div className="an39-row">
        <button
          className="an39-btn"
          onClick={() => setFeed(bulkTriage(feed, ids, 'confirm').findings)}
        >
          Bulk confirm
        </button>
        <button
          className="an39-btn"
          onClick={() => setFeed(bulkTriage(feed, ids, 'dismiss').findings)}
        >
          Bulk dismiss
        </button>
        <button
          className="an39-btn"
          onClick={() => setFeed(bulkAssign(feed, ids, 'Sukrit Chakravarty').findings)}
        >
          Assign to Sukrit Chakravarty
        </button>
      </div>
    </Card>
  );
}

/* 51554 */ export function TagsCard() {
  const [tags, setTags] = useState(addTag([], 'F-203', 'xss'));
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('');
  const shown = filter ? findingsByTag(tags, SAMPLE_FINDINGS, filter) : SAMPLE_FINDINGS;
  return (
    <Card n={51554} title="Finding tag system">
      <div className="an39-row">
        <input
          className="an39-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          aria-label="new tag for F-203"
        />
        <button
          className="an39-btn"
          onClick={() => {
            if (draft.trim()) {
              setTags(addTag(tags, 'F-203', draft));
              setDraft('');
            }
          }}
        >
          Add
        </button>
      </div>
      <ul className="an39-list">
        {SAMPLE_FINDINGS.slice(0, 3).map(f => (
          <li key={f.id}>
            {f.id}:{' '}
            {tagsFor(tags, f.id).map(t => (
              <span key={t} className="an39-chip">
                {t}{' '}
                <button className="an39-x" onClick={() => setTags(removeTag(tags, f.id, t))}>
                  ×
                </button>
              </span>
            ))}
            {tagsFor(tags, f.id).length === 0 && <span className="an39-note">no tags</span>}
          </li>
        ))}
      </ul>
      <div className="an39-row">
        <input
          className="an39-input"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label="filter by tag"
        />
        <span className="an39-note">{shown.length} findings match</span>
      </div>
    </Card>
  );
}

/* 51555 */ export function ViewsCard() {
  const [views, setViews] = useState(
    saveView([], 'criticals only', { severities: ['critical'], minConfidence: 0 })
  );
  const [name, setName] = useState('');
  const [active, setActive] = useState(null);
  return (
    <Card n={51555} title="Finding saved views">
      <div className="an39-row">
        <input
          className="an39-input"
          value={name}
          onChange={e => setName(e.target.value)}
          aria-label="view name"
        />
        <button
          className="an39-btn"
          onClick={() => {
            if (name.trim()) {
              setViews(
                saveView(views, name, { severities: ['high', 'critical'], minConfidence: 70 })
              );
              setName('');
            }
          }}
        >
          Save current
        </button>
      </div>
      <ul className="an39-list">
        {views.map(v => (
          <li key={v.name}>
            <button className="an39-link" onClick={() => setActive(applyView(views, v.name))}>
              {v.name}
            </button>
            <button className="an39-x" onClick={() => setViews(deleteView(views, v.name))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {active && <p className="an39-note">Active filter: {JSON.stringify(active)}</p>}
    </Card>
  );
}

/* 51556 */ export function PresentCard() {
  const [idx, setIdx] = useState(0);
  const order = presentationOrder(SAMPLE_FINDINGS);
  const step = presentationStep(order, idx);
  return (
    <Card n={51556} title="Finding presentation mode">
      <div className="an39-present">
        <span className="an39-note">
          Slide {step.index + 1} of {step.total}
        </span>
        {step.current && (
          <>
            <h4>
              [{step.current.severity}] {step.current.title}
            </h4>
            <p className="an39-note">
              {step.current.asset} · confidence {step.current.confidence}%
            </p>
          </>
        )}
      </div>
      <div className="an39-row">
        <button
          className="an39-btn"
          disabled={!step.hasPrev}
          onClick={() => setIdx(step.index - 1)}
        >
          ← Prev
        </button>
        <button
          className="an39-btn"
          disabled={!step.hasNext}
          onClick={() => setIdx(step.index + 1)}
        >
          Next →
        </button>
      </div>
    </Card>
  );
}

/* 51557 */ export function VoiceCard() {
  const [said, setSaid] = useState(0);
  const script = voiceBriefingScript(SAMPLE_FINDINGS, 3);
  return (
    <Card n={51557} title="Finding voice briefing">
      <button className="an39-btn" onClick={() => setSaid(Math.min(script.length - 1, said + 1))}>
        Next line
      </button>
      <ol className="an39-list">
        {script.map((line, i) => (
          <li key={i} className={i === said ? 'an39-said' : ''}>
            {i <= said ? line : '…'}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* 51558 */ export function MobileCard() {
  const cards = SAMPLE_FINDINGS.slice(0, 3).map(mobileCardPayload);
  return (
    <Card n={51558} title="Finding mobile cards">
      <div className="an39-mobile">
        {cards.map(c => (
          <div key={c.id} className={'an39-mcard an39-sev-' + c.severity}>
            <strong>{c.title}</strong>
            <span className="an39-note">{c.oneLine}</span>
            <span className="an39-chip">{c.triageStatus}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* 51559 */ export function OfflineCard() {
  const [snap, setSnap] = useState(null);
  const [diff, setDiff] = useState(null);
  return (
    <Card n={51559} title="Finding offline access">
      <div className="an39-row">
        <button className="an39-btn" onClick={() => setSnap(offlineSnapshot(SAMPLE_FINDINGS))}>
          Take snapshot
        </button>
        <button
          className="an39-btn"
          onClick={() =>
            snap &&
            setDiff(
              offlineDiff(snap, [
                ...SAMPLE_FINDINGS,
                { ...SAMPLE_FINDINGS[0], id: 'F-207', title: 'New finding while offline' },
              ])
            )
          }
        >
          Diff vs live
        </button>
      </div>
      {snap && (
        <p className="an39-note">
          Snapshot v{snap.version}: {snap.count} findings cached for offline browsing.
        </p>
      )}
      {diff && (
        <p className="an39-note">
          Added since snapshot: {diff.added.join(', ') || 'none'} · removed:{' '}
          {diff.removed.join(', ') || 'none'}
        </p>
      )}
    </Card>
  );
}

/* 51560 */ export function RedactCard() {
  const [on, setOn] = useState(true);
  const f = on ? redactFinding(SAMPLE_FINDINGS[0]) : SAMPLE_FINDINGS[0];
  return (
    <Card n={51560} title="Finding redaction mode">
      <button className="an39-btn" onClick={() => setOn(!on)}>
        {on ? 'Redaction: ON' : 'Redaction: OFF'}
      </button>
      <p className="an39-note">{redactionNotice()}</p>
      <ul className="an39-list">
        {(f.evidence || []).map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </Card>
  );
}

// --- gallery (export only — not mounted in app UI) -------------------------------
export function FindingAnalyticsGallery() {
  return (
    <div className="an39-gallery">
      <h3>Wave 39 · Finding analytics & governance (20 ideas)</h3>
      <ApiCard />
      <WidgetCard />
      <HeatmapCard />
      <TrendsCard />
      <CompareCard />
      <MilestoneCard />
      <LeaderboardCard />
      <CoverageCard />
      <DedupReviewCard />
      <VotingCard />
      <SlaCard />
      <AgingCard />
      <BulkCard />
      <TagsCard />
      <ViewsCard />
      <PresentCard />
      <VoiceCard />
      <MobileCard />
      <OfflineCard />
      <RedactCard />
    </div>
  );
}
