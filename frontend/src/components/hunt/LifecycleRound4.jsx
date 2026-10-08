/**
 * LifecycleRound4.jsx — Infinity AI · Dark-Matter · Wave 61
 * 11 working React components for post-hunt finding-lifecycle round 4, ideas 52401–52411.
 * Export-only module: components are not mounted anywhere. Pure presentational,
 * props-driven; no localStorage (repo convention for wave galleries).
 */
import React, { useState } from 'react';
import * as LC4 from './lifecycleRound4Core.js';

const NOW = 1700000000000;
const DAY = 24 * 3600000;
const HOUR = 3600000;

const LF1 = { id: 'f-611', state: 'InRetest', severity: 'high', stateEnteredAt: NOW - 30 * HOUR, evidence: [{ kind: 'fix', name: 'patch.diff' }], retest: { passed: true, id: 'rt-61' }, title: 'Stored XSS in reviews', assetOwner: 'aria', history: [{ to: 'RiskAccepted', at: NOW - 40 * DAY }] };
const LF2 = { id: 'f-612', state: 'Triaged', severity: 'critical', stateEnteredAt: NOW - 9 * DAY, title: 'SQLi in search', assetOwner: 'kai' };
const LF3 = { id: 'f-613', state: 'New', severity: 'medium', stateEnteredAt: NOW - 2 * HOUR, title: 'Open redirect', autoTriaged: true };

function Note({ children }) { return <p className="lr461-note">{children}</p>; }
function Mono({ children }) { return <pre className="lr461-mono">{children}</pre>; }

/* 52401 — Agent-suggested transitions. */
export function SuggestedTransitions() {
  const suggestions = LC4.suggestTransitions(LF1, NOW).suggestions || [];
  const [applied, setApplied] = useState(null);
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52401 · Agent-suggested transitions</h3>
      <Note>Finding f-611 (Stored XSS in reviews, currently InRetest with a passing retest) evaluated for next-state suggestions.</Note>
      <ul className="lr461-list">
        {suggestions.map((s, i) => (
          <li key={i}>
            <span className="lr461-chip">{s.to}</span>
            <span>{s.reason}</span>
            <div className="lr461-row">
              <button className="lr461-btn" onClick={() => setApplied(LC4.approveTransition(s, 'bhavesh', NOW))}>Approve</button>
            </div>
          </li>
        ))}
      </ul>
      {applied && <Mono>{JSON.stringify(applied, null, 2)}</Mono>}
    </div>
  );
}

/* 52402 — State diagram visualisation. */
export function StateDiagramViz() {
  const states = [{ id: 'New' }, { id: 'Triaged' }, { id: 'InProgress' }, { id: 'Verified', terminal: true }];
  const edges = [
    { from: 'New', to: 'Triaged' },
    { from: 'Triaged', to: 'InProgress' },
    { from: 'InProgress', to: 'Verified' }
  ];
  const payload = LC4.stateDiagramPayload(states, edges);
  const nodeCount = (payload.nodes || states).length;
  const edgeCount = (payload.edges || edges).length;
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52402 · State diagram visualisation</h3>
      <Note>Canonical lifecycle path New → Triaged → InProgress → Verified rendered as a diagram payload.</Note>
      <div className="lr461-row">
        <span className="lr461-chip">{nodeCount} nodes</span>
        <span className="lr461-chip">{edgeCount} edges</span>
        <span className="lr461-chip">1 terminal state</span>
      </div>
      <Mono>{JSON.stringify(payload, null, 2)}</Mono>
    </div>
  );
}

/* 52403 — Bulk state import. */
export function BulkStateImport() {
  const [csv, setCsv] = useState('f-611,Verified,retest passed\nf-612,InProgress,picked up');
  const [result, setResult] = useState(null);
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52403 · Bulk state import</h3>
      <Note>Paste finding id, target state, and an optional reason per line, then parse.</Note>
      <textarea className="lr461-textarea" rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} />
      <div className="lr461-row">
        <button className="lr461-btn" onClick={() => setResult(LC4.parseStateImport(csv, [LF1, LF2], NOW))}>Parse import</button>
      </div>
      {result && (
        <>
          <div className="lr461-row">
            <span className="lr461-chip">{(result.rows || []).length} rows</span>
            <span className="lr461-chip">{(result.errors || []).length} errors</span>
          </div>
          <Mono>{JSON.stringify(result, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52404 — State migration tool. */
export function StateMigrationTool() {
  const remap = { InProgress: 'Fixing', Triaged: 'Triage' };
  const preview = LC4.previewStateRemap([LF1, LF2, LF3], remap, NOW);
  const affected = preview.affected || preview.rows || [];
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52404 · State migration tool</h3>
      <Note>Previewing remap: InProgress → Fixing, Triaged → Triage across the sample findings.</Note>
      <div className="lr461-row">
        <span className="lr461-chip">{affected.length} affected</span>
        <span className="lr461-chip">{3 - affected.length} unchanged</span>
      </div>
      <ul className="lr461-list">
        {affected.map((r, i) => (
          <li key={i}><span className="lr461-chip">{r.id || r.findingId}</span> {r.from} → {r.to}</li>
        ))}
      </ul>
      <Mono>{JSON.stringify(preview, null, 2)}</Mono>
    </div>
  );
}

/* 52405 — Archived finding states. */
export function ArchivedFindingStates() {
  const [archived, setArchived] = useState(null);
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52405 · Archived finding states</h3>
      <Note>Archive f-611 with its full state trail preserved for reporting.</Note>
      <div className="lr461-row">
        <button className="lr461-btn" onClick={() => setArchived(LC4.archiveFindingWithState(LF1, 'bhavesh', NOW))}>Archive finding</button>
      </div>
      {archived && (
        <>
          <div className="lr461-row">
            <span className="lr461-chip">final state: {(archived.archived || {}).finalState}</span>
          </div>
          <Note>Report hint: {archived.reportHint}</Note>
          <Mono>{JSON.stringify(archived, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52406 — State search. */
export function StateSearch() {
  const [term, setTerm] = useState('RiskAccepted');
  const result = LC4.searchFindingsByState([LF1, LF2], term, NOW);
  const current = result.current || [];
  const ever = result.ever || result.history || [];
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52406 · State search</h3>
      <Note>Search findings by current state or any state they have ever held.</Note>
      <div className="lr461-row">
        <input className="lr461-input" value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      <div className="lr461-row">
        <span className="lr461-chip">{current.length} currently in {term}</span>
        <span className="lr461-chip">{ever.length} ever in {term}</span>
      </div>
      <ul className="lr461-list">
        {current.map((id, i) => <li key={i}><span className="lr461-chip">{id}</span> — current state</li>)}
        {ever.map((id, i) => <li key={'e' + i}><span className="lr461-chip">{id}</span> — held historically</li>)}
      </ul>
    </div>
  );
}

/* 52407 — State assignment rules. */
export function StateAssignmentRules() {
  const rules = [{ id: 'r-1', onState: 'InProgress', assignee: 'assetOwner' }];
  const event = { type: 'enterState', to: 'InProgress' };
  const [result, setResult] = useState(null);
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52407 · State assignment rules</h3>
      <Note>Rule r-1 routes findings entering InProgress to the asset owner. Firing the event on f-612 below.</Note>
      <div className="lr461-row">
        <button className="lr461-btn" onClick={() => setResult(LC4.evaluateAssignmentRules(rules, LF2, event, NOW))}>Fire enterState event</button>
      </div>
      {result && (
        <>
          <ul className="lr461-list">
            {(result.assignments || []).map((a, i) => (
              <li key={i}><span className="lr461-chip">{result.findingId}</span> assigned to {a.assignee} via rule {a.ruleId}</li>
            ))}
          </ul>
          <Mono>{JSON.stringify(result, null, 2)}</Mono>
        </>
      )}
    </div>
  );
}

/* 52408 — Transition throughput leaderboard. */
export function ThroughputLeaderboard() {
  const transitions = [
    { actor: 'aria', to: 'Verified', at: NOW - 2 * DAY, actorOptedIn: true },
    { actor: 'kai', to: 'Closed', at: NOW - DAY, actorOptedIn: true }
  ];
  const [anonymize, setAnonymize] = useState(false);
  const board = LC4.throughputLeaderboard(transitions, NOW, { anonymize });
  const rows = board.rows || board.entries || [];
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52408 · Transition throughput leaderboard</h3>
      <Note>Ranked by verified transitions over the trailing window.</Note>
      <div className="lr461-row">
        <label>
          <input type="checkbox" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} /> Anonymize actors
        </label>
      </div>
      <ul className="lr461-list">
        {rows.map((r, i) => (
          <li key={i}><span className="lr461-chip">#{i + 1}</span> {r.actor} — {r.closed} transitions closed</li>
        ))}
      </ul>
      <Mono>{JSON.stringify(board, null, 2)}</Mono>
    </div>
  );
}

/* 52409 — Transition comments. */
export function TransitionComments() {
  const [threads, setThreads] = useState({});
  const [author, setAuthor] = useState('bhavesh');
  const [text, setText] = useState('');
  const thread = threads['t-611'] || [];
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52409 · Transition comments</h3>
      <Note>Discussion thread attached to transition t-611.</Note>
      <div className="lr461-row">
        <input className="lr461-input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" />
        <input className="lr461-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Comment" />
        <button className="lr461-btn" onClick={() => { const res = LC4.addTransitionComment(threads, 't-611', { author, body: text }, NOW); if (res.ok) setThreads(res.threads); setText(''); }}>Add comment</button>
      </div>
      <ul className="lr461-list">
        {thread.map((c, i) => (
          <li key={i}><span className="lr461-chip">{c.author}</span> {c.body}</li>
        ))}
      </ul>
    </div>
  );
}

/* 52410 — Scheduled state reviews. */
export function ScheduledStateReviews() {
  const reviews = LC4.scheduleStateReviews([LF1, LF2, LF3], NOW, { lead: 'bhavesh' });
  const rows = reviews.reviews || reviews || [];
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52410 · Scheduled state reviews</h3>
      <Note>Stale-state findings queued for periodic review, led by bhavesh.</Note>
      <table className="lr461-table">
        <thead><tr><th>Finding</th><th>Review at</th><th>Cadence</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.findingId || r.id}</td>
              <td>{new Date(r.nextReviewAt).toISOString()}</td>
              <td>{r.cadence || reviews.cadence}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Mono>{JSON.stringify(reviews, null, 2)}</Mono>
    </div>
  );
}

/* 52411 — State dashboard widgets. */
export function StateDashboardWidgets() {
  const payload = LC4.stateWidgetPayload([LF1, LF2, LF3], NOW);
  const counts = payload.counts || payload.byState || {};
  const entries = Object.entries(counts);
  const max = Math.max(1, ...entries.map(([, v]) => Number(v) || 0));
  return (
    <div className="lr461-card">
      <h3 className="lr461-title">52411 · State dashboard widgets</h3>
      <Note>Live distribution of findings across lifecycle states.</Note>
      <div className="lr461-row">
        <span className="lr461-chip">avg aging: {payload.avgAgingDays} days</span>
      </div>
      <ul className="lr461-list">
        {entries.map(([state, count]) => (
          <li key={state}>
            <span className="lr461-chip">{state}</span> {count}
            <div className="lr461-bar"><div className="lr461-bar-fill" style={{ width: ((Number(count) || 0) / max * 100) + '%' }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const LR61_GALLERY = [SuggestedTransitions, StateDiagramViz, BulkStateImport, StateMigrationTool, ArchivedFindingStates, StateSearch, StateAssignmentRules, ThroughputLeaderboard, TransitionComments, ScheduledStateReviews, StateDashboardWidgets];

export function LifecycleRound4Gallery() { return (<div className="lr461-gallery">{LR61_GALLERY.map((C, i) => <C key={i} />)}</div>); }
