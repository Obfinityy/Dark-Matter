/**
 * TriageRound2.jsx — Infinity AI · Dark-Matter · Wave 52
 * 23 working React components for triage round-2 ideas 52041–52063.
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './triageRound2Core.js';

const SAMPLE_FINDINGS = [
  { id: 'f1', title: 'Reflected XSS on search', severity: 'high', vulnClass: 'xss', endpoint: '/search', parameter: 'q', asset: 'shop', status: 'open', confidence: 88, reviewed: false, evidence: [{ t: 'req' }] },
  { id: 'f2', title: 'Reflected XSS on search (dup)', severity: 'medium', vulnClass: 'xss', endpoint: '/search', parameter: 'q', asset: 'shop', status: 'open', confidence: 61, evidence: [] },
  { id: 'f3', title: 'SQLi in product filter', severity: 'critical', vulnClass: 'sqli', endpoint: '/products', parameter: 'cat', asset: 'shop', status: 'open', confidence: 92, reviewed: false, slaDueAt: Date.now() - 3600000, evidence: [{ t: 'req' }, { t: 'resp' }] },
  { id: 'f4', title: 'Weak session cookie', severity: 'medium', vulnClass: 'auth', endpoint: '/login', parameter: 'session', asset: 'accounts', status: 'open', confidence: 74, reviewed: true, evidence: [] },
];

/* 52041 — Review history timeline. */
export function ReviewHistoryTimeline() {
  const timeline = C.buildReviewTimeline([
    { kind: 'view', at: 1700000001000, actor: 'ria', detail: 'opened finding' },
    { kind: 'comment', at: 1700000002000, actor: 'sam', detail: 'needs repro steps' },
    { kind: 'state-change', at: 1700000003000, actor: 'ria', detail: 'open → accepted' },
    { kind: 'override', at: 1700000004000, actor: 'lead', detail: 'severity high → critical' },
  ]);
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52041 · Review history timeline</h3>
      <ol className="tr2-list">
        {timeline.map((e, i) => (
          <li key={i} className="tr2-item">{e.kind} · {e.actor} · {new Date(e.at).toISOString()} · {e.detail}</li>
        ))}
      </ol>
    </div>
  );
}

/* 52042 — Multi-select finding comparison. */
export function FindingComparison() {
  const table = C.buildComparisonTable([SAMPLE_FINDINGS[0], SAMPLE_FINDINGS[1]]);
  if (!table.ok) return <div className="tr2-card"><p className="tr2-note">{table.reason}</p></div>;
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52042 · Finding comparison</h3>
      <table className="tr2-table">
        <thead><tr><th className="tr2-th">field</th>{table.columns.map((c) => <th key={c} className="tr2-th">{c}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.field} className={table.differs.includes(r.field) ? 'tr2-row-diff' : ''}>
              <td className="tr2-td">{r.field}</td>
              {r.values.map((v, i) => <td key={i} className="tr2-td">{String(v)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="tr2-note">differs on: {table.differs.join(', ')}</p>
    </div>
  );
}

/* 52043 — Inbox dashboard widgets. */
export function InboxWidgets() {
  const counts = C.buildWidgetCounts(SAMPLE_FINDINGS, Date.now());
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52043 · Inbox dashboard widgets</h3>
      <div className="tr2-widgets">
        <div className="tr2-widget"><span className="tr2-widget-num">{counts.openCriticals}</span><span className="tr2-widget-label">open criticals</span></div>
        <div className="tr2-widget"><span className="tr2-widget-num">{counts.unreviewed}</span><span className="tr2-widget-label">unreviewed</span></div>
        <div className="tr2-widget"><span className="tr2-widget-num">{counts.slaBreaches}</span><span className="tr2-widget-label">SLA breaches</span></div>
        <div className="tr2-widget"><span className="tr2-widget-num">{counts.totalOpen}</span><span className="tr2-widget-label">total open</span></div>
      </div>
    </div>
  );
}

/* 52044 — Triage reminders. */
export function TriageReminders() {
  const [sent, setSent] = useState([]);
  const queue = SAMPLE_FINDINGS;
  const onNudge = () => {
    const r = C.computeReminders(queue, { intervalHours: 1, channel: 'in-app', lastSentAt: 0, criticalEscalate: true }, Date.now());
    setSent(r);
  };
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52044 · Triage reminders</h3>
      <button className="tr2-btn" onClick={onNudge}>Nudge reviewers</button>
      {sent.map((s, i) => <p key={i} className="tr2-note">[{s.channel}] {s.message}</p>)}
    </div>
  );
}

/* 52045 — Offline triage queue. */
export function OfflineTriageQueue() {
  const [pack] = useState(() => C.packOfflineQueue(SAMPLE_FINDINGS, 7, 1700000000000));
  const [local, setLocal] = useState(pack);
  const [result, setResult] = useState(null);
  const decide = (id, decision) => setLocal(C.applyOfflineDecision(local, id, decision, 1700000005000));
  const sync = () => setResult(C.mergeOfflineDecisions(local, [{ id: 'f1', decision: 'accepted', updatedAt: 1700000001000 }]));
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52045 · Offline triage queue</h3>
      <p className="tr2-note">packed rev {local.rev} · {local.findings.length} findings</p>
      {local.findings.map((f) => (
        <p key={f.id} className="tr2-item">{f.id}: {f.decision || 'undecided'}
          <button className="tr2-btn" onClick={() => decide(f.id, 'accepted')}>accept</button>
          <button className="tr2-btn" onClick={() => decide(f.id, 'dismissed')}>dismiss</button>
        </p>
      ))}
      <button className="tr2-btn" onClick={sync}>Sync with conflict resolution</button>
      {result && <p className="tr2-note">merged {result.merged.length} · conflicts {result.conflicts.length}</p>}
    </div>
  );
}

/* 52046 — Duplicate collapse suggestions. */
export function DuplicateCollapse() {
  const [merged, setMerged] = useState([]);
  const suggestions = C.suggestDuplicates(SAMPLE_FINDINGS);
  const onMerge = (ids) => {
    const a = SAMPLE_FINDINGS.find((f) => f.id === ids[0]);
    const b = SAMPLE_FINDINGS.find((f) => f.id === ids[1]);
    setMerged([...merged, C.mergeFindings(a, b)]);
  };
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52046 · Duplicate collapse</h3>
      {suggestions.map((s) => (
        <p key={s.signature} className="tr2-item">{s.findingIds.join(' ≈ ')} ({s.count})
          <button className="tr2-btn" onClick={() => onMerge(s.findingIds)}>Merge</button>
        </p>
      ))}
      {merged.map((m) => <p key={m.id} className="tr2-note">merged {m.id}: {m.evidence.length} evidence items from {m.mergedFrom.join(',')}</p>)}
    </div>
  );
}

/* 52047 — Cross-hunt findings explorer. */
export function CrossHuntExplorer() {
  const [q, setQ] = useState('xss');
  const hunts = [
    { id: 'h1', name: 'Shop hunt', findings: SAMPLE_FINDINGS },
    { id: 'h2', name: 'Blog hunt', findings: [{ id: 'b1', title: 'Stored XSS in comments', vulnClass: 'xss', endpoint: '/comments', severity: 'high' }] },
  ];
  const results = C.searchAllHunts(hunts, q);
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52047 · Cross-hunt explorer</h3>
      <input className="tr2-input" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.map((r) => <p key={r.huntId + r.id} className="tr2-item">{r.huntName} · {r.id} · {r.title} ({r.severity})</p>)}
      <p className="tr2-note">{results.length} results</p>
    </div>
  );
}

/* 52048 — Triage queue per team. */
export function TeamQueues() {
  const queues = C.routeToTeams(SAMPLE_FINDINGS, { shop: 'payments-team', accounts: 'identity-team' });
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52048 · Triage queue per team</h3>
      {Object.entries(queues).map(([team, items]) => (
        <p key={team} className="tr2-item">{team}: {items.map((f) => f.id).join(', ')}</p>
      ))}
    </div>
  );
}

/* 52049 — Screen-reader accessible triage. */
export function AccessibleTriage() {
  const desc = C.describeForScreenReader(SAMPLE_FINDINGS[2]);
  return (
    <div className="tr2-card" role="region" aria-label="Triage item details">
      <h3 className="tr2-title">52049 · Screen-reader accessible triage</h3>
      <p className="tr2-note" role="status">{desc}</p>
      <ul className="tr2-list">
        {C.TRIAGE_KEYBOARD_HINTS.map((h) => <li key={h.key} className="tr2-item">{h.key}: {h.action}</li>)}
      </ul>
    </div>
  );
}

/* 52050 — Finding annotation on screenshots. */
export function ScreenshotAnnotations() {
  const [ann, setAnn] = useState([]);
  const add = () => {
    const r = C.addAnnotation(ann, { x: 120, y: 240, w: 180, h: 60, label: 'injected payload rendered here' });
    if (r.ok) setAnn(r.annotations);
  };
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52050 · Screenshot annotations</h3>
      <button className="tr2-btn" onClick={add}>Add annotation</button>
      {ann.map((a) => (
        <p key={a.id} className="tr2-item">{a.label} @ ({a.x},{a.y}) {a.w}×{a.h}
          <button className="tr2-btn" onClick={() => setAnn(C.removeAnnotation(ann, a.id))}>remove</button>
        </p>
      ))}
    </div>
  );
}

/* 52051 — Evidence chain viewer. */
export function EvidenceChainViewer() {
  const chain = C.buildEvidenceChain([
    { method: 'GET', url: '/search?q=<svg>', request: 'GET /search?q=<svg>', response: '200 reflected in HTML' },
    { method: 'POST', url: '/cart/add', request: 'POST payload in comment', response: '200 stored' },
    { method: 'GET', url: '/cart', request: 'GET /cart', response: '200 script executes' },
  ]);
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52051 · Evidence chain viewer</h3>
      <ol className="tr2-list">
        {chain.steps.map((s) => (
          <li key={s.step} className="tr2-item">step {s.step}: {s.method} {s.url} — {s.response}</li>
        ))}
      </ol>
      <p className="tr2-note">{chain.totalSteps} steps</p>
    </div>
  );
}

/* 52052 — "Explain like I'm new" toggle. */
export function ExplainLikeNew() {
  const [simple, setSimple] = useState(false);
  const detail = 'Reflected XSS via unsanitized query parameter';
  const glossary = { XSS: 'code injected into a page by an attacker', parameter: 'a value sent in the page address' };
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52052 · Explain like I&apos;m new</h3>
      <button className="tr2-btn" onClick={() => setSimple(!simple)}>{simple ? 'Show technical' : 'Explain like new'}</button>
      <p className="tr2-note">{simple ? C.simplifyFinding(detail, glossary) : detail}</p>
    </div>
  );
}

/* 52053 — Triage performance leaderboard. */
export function TriageLeaderboard() {
  const board = C.buildLeaderboard([
    { name: 'ria', reviewed: 42, accuracy: 0.93, optIn: true },
    { name: 'sam', reviewed: 51, accuracy: 0.88, optIn: true },
    { name: 'dev', reviewed: 60, accuracy: 0.99, optIn: false },
  ]);
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52053 · Triage leaderboard</h3>
      <ol className="tr2-list">
        {board.map((r) => <li key={r.name} className="tr2-item">#{r.rank} {r.name} — {r.reviewed} reviewed · {Math.round(r.accuracy * 100)}% accuracy</li>)}
      </ol>
    </div>
  );
}

/* 52054 — Review templates per vuln class. */
export function ReviewTemplates() {
  const [cls, setCls] = useState('xss');
  const items = C.getReviewTemplate(cls);
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52054 · Review templates per vuln class</h3>
      <div className="tr2-note">
        {['xss', 'sqli', 'auth', 'ssrf', 'weird'].map((c) => (
          <button key={c} className="tr2-btn" onClick={() => setCls(c)}>{c}</button>
        ))}
      </div>
      <ul className="tr2-list">
        {items.map((t, i) => <li key={i} className="tr2-item">☐ {t}</li>)}
      </ul>
    </div>
  );
}

/* 52055 — Bulk-select in inbox. */
export function BulkSelect() {
  const [sel, setSel] = useState([]);
  const all = C.selectAll(SAMPLE_FINDINGS);
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52055 · Bulk-select in inbox</h3>
      <button className="tr2-btn" onClick={() => setSel(all)}>Select all</button>
      <button className="tr2-btn" onClick={() => setSel([])}>Clear</button>
      {SAMPLE_FINDINGS.map((f) => (
        <label key={f.id} className="tr2-item">
          <input type="checkbox" checked={sel.includes(f.id)} onChange={() => setSel(C.toggleSelect(sel, f.id))} /> {f.id} · {f.title}
        </label>
      ))}
      <p className="tr2-note">{sel.length} selected</p>
    </div>
  );
}

/* 52056 — Triage heatmap. */
export function TriageHeatmap() {
  const [filter, setFilter] = useState(null);
  const cells = C.buildHeatmap(SAMPLE_FINDINGS);
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52056 · Triage heatmap</h3>
      <div className="tr2-widgets">
        {cells.map((c) => (
          <button key={c.asset + c.vulnClass} className="tr2-widget" onClick={() => setFilter(c.filter)}>
            <span className="tr2-widget-num">{c.count}</span>
            <span className="tr2-widget-label">{c.asset} · {c.vulnClass}</span>
          </button>
        ))}
      </div>
      {filter && <p className="tr2-note">filtering: {filter.asset} / {filter.vulnClass}</p>}
    </div>
  );
}

/* 52057 — Finding relationship graph. */
export function RelationshipGraph() {
  const g = C.buildRelationshipGraph([
    ...SAMPLE_FINDINGS,
    { id: 'f5', title: 'XSS chained to session', vulnClass: 'xss', endpoint: '/search', parameter: 'q', chainId: 'chain-1' },
  ]);
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52057 · Finding relationship graph</h3>
      <p className="tr2-note">{g.nodes.length} nodes · {g.edges.length} edges</p>
      <ul className="tr2-list">
        {g.edges.slice(0, 8).map((e, i) => <li key={i} className="tr2-item">{e.from} ↔ {e.to} ({e.via})</li>)}
      </ul>
    </div>
  );
}

/* 52058 — "First look" guided tour. */
export function FirstLookTour() {
  const [step, setStep] = useState(0);
  const tour = C.buildFirstLookTour(SAMPLE_FINDINGS);
  const cur = tour.steps[step];
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52058 · First look tour</h3>
      {cur && <p className="tr2-item">step {cur.step}/{tour.totalSteps}: {cur.headline} — {cur.tip}</p>}
      <button className="tr2-btn" onClick={() => setStep(Math.max(0, step - 1))}>Back</button>
      <button className="tr2-btn" onClick={() => setStep(Math.min(tour.totalSteps - 1, step + 1))}>Next</button>
    </div>
  );
}

/* 52059 — Reviewer workload balancer. */
export function WorkloadBalancer() {
  const [plan, setPlan] = useState(null);
  const balance = () => setPlan(C.balanceWorkload(SAMPLE_FINDINGS, [{ name: 'ria', load: 12 }, { name: 'sam', load: 3 }]));
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52059 · Workload balancer</h3>
      <button className="tr2-btn" onClick={balance}>Auto-distribute</button>
      {plan && plan.assignments.map((a) => <p key={a.findingId} className="tr2-item">{a.findingId} → {a.reviewer}</p>)}
    </div>
  );
}

/* 52060 — Triage export of decisions. */
export function TriageExport() {
  const [csv, setCsv] = useState('');
  const onExport = () => setCsv(C.exportDecisions([
    { findingId: 'f1', decidedBy: 'ria', decision: 'accepted', decidedAt: 1700000001000 },
    { findingId: 'f2', decidedBy: 'sam', decision: 'dismissed', decidedAt: 1700000002000 },
  ]));
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52060 · Triage export</h3>
      <button className="tr2-btn" onClick={onExport}>Export CSV</button>
      {csv && <pre className="tr2-note">{csv}</pre>}
    </div>
  );
}

/* 52061 — Comment reactions. */
export function CommentReactions() {
  const [comment, setComment] = useState({ text: 'looks reproducible', reactions: {} });
  const react = (emoji) => setComment(C.toggleReaction(comment, emoji, 'ria'));
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52061 · Comment reactions</h3>
      <p className="tr2-item">“{comment.text}”</p>
      {C.reactionOptions().map((e) => (
        <button key={e} className="tr2-btn" onClick={() => react(e)}>{e} {(comment.reactions[e] || []).length}</button>
      ))}
    </div>
  );
}

/* 52062 — Finding watchers. */
export function FindingWatchers() {
  const [f, setF] = useState({ id: 'f3', watchers: ['sam'] });
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52062 · Finding watchers</h3>
      <p className="tr2-item">watchers: {C.notifiableWatchers(f).join(', ') || 'none'}</p>
      <button className="tr2-btn" onClick={() => setF(C.watchFinding(f, 'ria'))}>Watch</button>
      <button className="tr2-btn" onClick={() => setF(C.unwatchFinding(f, 'ria'))}>Unwatch</button>
    </div>
  );
}

/* 52063 — Triage inbox API. */
export function TriageApiDocs() {
  const endpoints = C.describeTriageApi();
  return (
    <div className="tr2-card">
      <h3 className="tr2-title">52063 · Triage inbox API</h3>
      <ul className="tr2-list">
        {endpoints.map((e) => (
          <li key={e.method + e.path} className="tr2-item"><code>{e.method}</code> {e.path} — {e.summary}</li>
        ))}
      </ul>
    </div>
  );
}

export function TriageRound2Gallery() {
  return (
    <div className="tr2-gallery">
      <ReviewHistoryTimeline /><FindingComparison /><InboxWidgets /><TriageReminders />
      <OfflineTriageQueue /><DuplicateCollapse /><CrossHuntExplorer /><TeamQueues />
      <AccessibleTriage /><ScreenshotAnnotations /><EvidenceChainViewer /><ExplainLikeNew />
      <TriageLeaderboard /><ReviewTemplates /><BulkSelect /><TriageHeatmap />
      <RelationshipGraph /><FirstLookTour /><WorkloadBalancer /><TriageExport />
      <CommentReactions /><FindingWatchers /><TriageApiDocs />
    </div>
  );
}
