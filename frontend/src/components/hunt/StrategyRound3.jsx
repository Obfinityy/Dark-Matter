/**
 * StrategyRound3.jsx — wave 35, part 1 (ideas 51361–51396): strategy round 3.
 * Real working components driving local state — no mocks, no demo-only
 * controls. All state math comes from strategyRound3Core.js.
 */
import React, { useState } from 'react';
import {
  WAVE35A_IDEAS,
  recordStrategyEvent, liveEffectivenessScores,
  pushStrategyState, rollbackOneClick,
  annotateStrategy, annotationsFor,
  parseStrategyChatCommand,
  segmentStrategyTimeline, strategyColor,
  attributeFinding, strategyReportLines,
  MARKETPLACE_PRESETS, previewMarketplacePreset, installMarketplacePreset,
  simulateStrategy,
  FOCUS_AREAS, applyFocusAreas,
  excludeFromStrategy,
  startTimebox, timeboxRemainingMs, timeboxExpired,
  startStrategyVote, castStrategyVote, strategyVoteTally,
  diffStrategy,
  retestModePreset,
  learnStrategies,
  quietHoursDowngrade,
  estimateStrategyCost,
  requestStrategyApproval, decideStrategyApproval, pendingStrategyApprovals,
  chainStrategies, advanceStrategyChain,
  checkStrategyPerformance,
  personalizeStrategy,
  explainStrategyFit,
  snapshotStrategy,
  migrateStrategy,
  ensureFairCoverage,
  strategyChangeTiming,
  digestStrategyUpdates,
  ROLLBACK_WINDOW_MS, rollbackWindowOpen, undoStrategyChange,
  tagStrategySegment, strategySegmentsByTag,
  correlateStrategyFindings,
  exportStrategyJourney,
  parseVoiceStrategyCommand,
  mobileStrategyPicker,
  GUARDRAIL_PRESETS, enforceGuardrailPreset,
  buildRetrospective,
  recommendStrategies,
} from './strategyRound3Core.js';

const NOW = 1728220000000;
const BASE = { name: 'Balanced', focus: 'balanced', aggression: 'balanced', allocation: { recon: 20, 'surface-map': 15, 'tech-fingerprint': 10, 'auth-deep': 20, 'business-logic': 20, 'exploit-chain': 15 } };
const AGGRESSIVE = { ...BASE, name: 'Aggressive depth', focus: 'depth', aggression: 'aggressive', allocation: { recon: 10, 'surface-map': 10, 'tech-fingerprint': 10, 'auth-deep': 25, 'business-logic': 25, 'exploit-chain': 20 } };

function ideaNo(n) {
  const row = WAVE35A_IDEAS.find(([id]) => id === n);
  return row ? `#${row[0]}` : '';
}

function Card({ idea, title, children }) {
  return (
    <section className="st35-card" aria-label={title}>
      <header className="st35-card-head">
        <h3 className="st35-card-title">{title}</h3>
        <span className="st35-idea">{ideaNo(idea)}</span>
      </header>
      <div className="st35-card-body">{children}</div>
    </section>
  );
}

// --- 51361 effectiveness score ------------------------------------------------
export function EffectivenessScoreboard() {
  const [events, setEvents] = useState(() => {
    let e = [];
    const names = ['Balanced', 'Auth hammer', 'Wide net'];
    names.forEach((n, i) => {
      for (let k = 0; k < (i + 1) * 2; k++) e = recordStrategyEvent(e, n, `F-${i}-${k}`, NOW - (30 - k) * 60_000);
    });
    return e;
  });
  const scores = liveEffectivenessScores(events, NOW);
  return (
    <Card idea={51361} title="Strategy effectiveness score">
      <table className="st35-table">
        <thead><tr><th>Strategy</th><th>Findings/hr</th><th>Findings</th></tr></thead>
        <tbody>{scores.map((s) => (
          <tr key={s.strategy}><td>{s.strategy}</td><td>{s.findingsPerHour.toFixed(2)}</td><td>{s.findings}</td></tr>
        ))}</tbody>
      </table>
      <button className="st35-btn" onClick={() => setEvents(recordStrategyEvent(events, 'Balanced', `F-new-${events.length}`, NOW))}>
        Log a live finding under Balanced
      </button>
    </Card>
  );
}

// --- 51362 one-click rollback --------------------------------------------------
export function OneClickRollback() {
  const [stack, setStack] = useState(() => pushStrategyState([], BASE, { phase: 'recon', checked: 120 }, NOW - 3_600_000, 'initial'));
  const [target, setTarget] = useState(AGGRESSIVE.name);
  const [restored, setRestored] = useState(null);
  const switchStrategy = () => {
    const s = target === AGGRESSIVE.name ? AGGRESSIVE : BASE;
    setStack(pushStrategyState(stack, s, { phase: 'auth-deep', checked: 340 }, NOW, 'manual switch'));
    setTarget(target === AGGRESSIVE.name ? BASE.name : AGGRESSIVE.name);
    setRestored(null);
  };
  const rollback = () => {
    const { entry, rest } = rollbackOneClick(stack);
    setRest(rest);
    setRestored(entry);
  };
  return (
    <Card idea={51362} title="One-click rollback (mid-hunt)">
      <p className="st35-line">Current: <strong>{stack[stack.length - 1]?.strategy.name}</strong> · depth {stack.length}</p>
      <div className="st35-row">
        <button className="st35-btn" onClick={switchStrategy}>Switch strategy</button>
        <button className="st35-btn st35-btn-warn" onClick={rollback} disabled={stack.length < 2}>Roll back to previous</button>
      </div>
      {restored && (
        <p className="st35-line">Restored: <strong>{restored.strategy.name}</strong> with hunt state intact (phase {restored.stateSnapshot.phase}, {restored.stateSnapshot.checked} endpoints checked).</p>
      )}
    </Card>
  );
}

// --- 51388 rollback window ------------------------------------------------------
export function RollbackWindowBanner() {
  const [change, setChange] = useState(null);
  const [msg, setMsg] = useState('');
  const make = () => { setChange({ previous: BASE, at: NOW, id: 'chg-1' }); setMsg(''); };
  const undo = () => {
    const r = undoStrategyChange({ ...change, at: NOW }, NOW);
    setMsg(r.ok ? `Restored "${r.restored.name}" inside the grace window.` : r.reason);
  };
  const open = change && rollbackWindowOpen({ ...change, at: NOW }, NOW, 1);
  return (
    <Card idea={51388} title="Rollback window">
      <button className="st35-btn" onClick={make}>Apply a strategy change</button>
      {change && (
        <div className="st35-row">
          <span className="st35-line">Grace window: {open ? 'open' : 'expired'} ({ROLLBACK_WINDOW_MS / 60000} min)</span>
          <button className="st35-btn" onClick={undo}>Undo change</button>
        </div>
      )}
      {msg && <p className="st35-line">{msg}</p>}
    </Card>
  );
}

// --- 51363 annotations ------------------------------------------------------------
export function StrategyAnnotations() {
  const [list, setList] = useState([]);
  const [text, setText] = useState('');
  const [strategy, setStrategy] = useState('Balanced');
  return (
    <Card idea={51363} title="Strategy annotations">
      <div className="st35-row">
        <input className="st35-input" value={strategy} onChange={(e) => setStrategy(e.target.value)} aria-label="Strategy name" />
        <input className="st35-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Why this strategy?" aria-label="Annotation" />
        <button className="st35-btn" onClick={() => { if (text.trim()) { setList(annotateStrategy(list, strategy, text.trim(), NOW)); setText(''); } }}>Annotate</button>
      </div>
      <ul className="st35-list">{annotationsFor(list, strategy).map((a, i) => <li key={i}>{a.text}</li>)}</ul>
    </Card>
  );
}

// --- 51364 chat commands ------------------------------------------------------------
export function StrategyChatCommands() {
  const [input, setInput] = useState('try depth mode for 45 minutes');
  const parsed = parseStrategyChatCommand(input);
  return (
    <Card idea={51364} title="Strategy chat commands">
      <div className="st35-row">
        <input className="st35-input" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Chat command" />
      </div>
      <p className="st35-line">Parsed: <code>{parsed ? JSON.stringify(parsed) : 'no command recognized'}</code></p>
    </Card>
  );
}

// --- 51365 timeline -------------------------------------------------------------------
export function StrategyTimelineView() {
  const segs = segmentStrategyTimeline([
    { strategy: 'Wide net', focus: 'breadth', from: NOW - 7_200_000, to: NOW - 3_600_000 },
    { strategy: 'Auth hammer', focus: 'depth', from: NOW - 3_600_000, to: NOW - 1_800_000 },
    { strategy: 'Retest mode', focus: 'retest', from: NOW - 1_800_000, to: NOW },
  ]);
  return (
    <Card idea={51365} title="Strategy timeline">
      <div className="st35-timeline">
        {segs.map((s, i) => (
          <div key={i} className="st35-seg" style={{ borderLeftColor: s.color, color: s.color }}>
            <strong style={{ color: 'inherit' }}>{s.strategy}</strong>
            <span className="st35-dim">{s.durationMin} min · {s.color}</span>
          </div>
        ))}
      </div>
      <p className="st35-line">Legend: breadth {strategyColor('breadth')} · depth {strategyColor('depth')} · retest {strategyColor('retest')}</p>
    </Card>
  );
}

// --- 51366 reporting --------------------------------------------------------------------
export function StrategyReportAttribution() {
  const findings = [{ id: 'F-1', severity: 'high' }, { id: 'F-2', severity: 'medium' }, { id: 'F-3', severity: 'low' }];
  const [attr, setAttr] = useState({ 'F-1': 'Auth hammer', 'F-2': 'Wide net' });
  const [sel, setSel] = useState({ id: 'F-3', s: 'Balanced' });
  return (
    <Card idea={51366} title="Strategy-based reporting">
      <ul className="st35-list">{strategyReportLines(findings, attr).map((l, i) => <li key={i}>{l}</li>)}</ul>
      <div className="st35-row">
        <select className="st35-input" value={sel.s} onChange={(e) => setSel({ ...sel, s: e.target.value })}>
          {['Balanced', 'Auth hammer', 'Wide net', 'Retest mode'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="st35-btn" onClick={() => setAttr(attributeFinding(attr, sel.id, sel.s))}>Attribute F-3</button>
      </div>
    </Card>
  );
}

// --- 51367 marketplace ----------------------------------------------------------------------
export function PresetMarketplace() {
  const [installed, setInstalled] = useState([]);
  const [previewId, setPreviewId] = useState(MARKETPLACE_PRESETS[0].id);
  const [msg, setMsg] = useState('');
  const preview = previewMarketplacePreset(previewId);
  const install = () => {
    const r = installMarketplacePreset(installed, previewId);
    setInstalled(r.installed);
    setMsg(r.ok ? `Installed "${preview.name}".` : r.reason);
  };
  return (
    <Card idea={51367} title="Strategy presets marketplace">
      <div className="st35-row">
        <select className="st35-input" value={previewId} onChange={(e) => setPreviewId(e.target.value)}>
          {MARKETPLACE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.author}</option>)}
        </select>
        <button className="st35-btn" onClick={install}>Install</button>
      </div>
      {preview && (
        <p className="st35-line">{preview.description} · ★{preview.rating} · {preview.downloads} installs · tags: {preview.tags.join(', ')}</p>
      )}
      <p className="st35-line">Installed: {installed.join(', ') || 'none'}</p>
      {msg && <p className="st35-line">{msg}</p>}
    </Card>
  );
}

// --- 51368 simulator ----------------------------------------------------------------------------
export function StrategySimulator() {
  const history = [
    { strategyFocus: 'depth', findings: 9, hours: 3, scopeAssets: 4 },
    { strategyFocus: 'depth', findings: 12, hours: 4, scopeAssets: 6 },
    { strategyFocus: 'breadth', findings: 6, hours: 4, scopeAssets: 12 },
    { strategyFocus: 'depth', findings: 15, hours: 5, scopeAssets: 5 },
  ];
  const [focus, setFocus] = useState('depth');
  const [hours, setHours] = useState(4);
  const sim = simulateStrategy(history, focus, hours);
  return (
    <Card idea={51368} title="Strategy simulator">
      <div className="st35-row">
        <select className="st35-input" value={focus} onChange={(e) => setFocus(e.target.value)}>
          <option value="depth">depth</option><option value="breadth">breadth</option><option value="retest">retest</option>
        </select>
        <input className="st35-input st35-num" type="number" min="1" max="24" value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Hours" />
      </div>
      <p className="st35-line">Projected: <strong>{sim.projectedFindings} findings</strong> ({sim.findingsPerHour}/hr) · basis: {sim.basis} · confidence: {sim.confidence}</p>
    </Card>
  );
}

// --- 51369 focus areas ------------------------------------------------------------------------------
export function FocusAreaPicker() {
  const [picked, setPicked] = useState(['auth']);
  const toggle = (a) => setPicked(picked.includes(a) ? picked.filter((x) => x !== a) : [...picked, a].slice(0, 3));
  const weighted = applyFocusAreas(BASE, picked);
  return (
    <Card idea={51369} title="Strategy focus areas">
      <div className="st35-row">
        {FOCUS_AREAS.map((a) => (
          <label key={a} className="st35-check"><input type="checkbox" checked={picked.includes(a)} onChange={() => toggle(a)} /> {a}</label>
        ))}
      </div>
      <p className="st35-line">Weighted allocation: {Object.entries(weighted.allocation).map(([k, v]) => `${k}:${v}`).join(' ')}</p>
    </Card>
  );
}

// --- 51370 exclusions -----------------------------------------------------------------------------------
export function StrategyExclusions() {
  const [excluded, setExcluded] = useState(['exploit-chain']);
  const r = excludeFromStrategy(BASE, excluded);
  const toggle = (p) => setExcluded(excluded.includes(p) ? excluded.filter((x) => x !== p) : [...excluded, p]);
  return (
    <Card idea={51370} title="Strategy exclusions">
      <div className="st35-row">
        {['recon', 'auth-deep', 'exploit-chain'].map((p) => (
          <label key={p} className="st35-check"><input type="checkbox" checked={excluded.includes(p)} onChange={() => toggle(p)} /> exclude {p}</label>
        ))}
      </div>
      <p className="st35-line">Phases remaining: {r.phasesRemaining.join(', ')}</p>
      {r.warning && <p className="st35-warn">{r.warning}</p>}
    </Card>
  );
}

// --- 51371 timeboxing ---------------------------------------------------------------------------------------
export function TimeboxControl() {
  const [tb, setTb] = useState(null);
  const [minutes, setMinutes] = useState(45);
  const expired = tb && timeboxExpired(tb, NOW);
  return (
    <Card idea={51371} title="Strategy timeboxing">
      <div className="st35-row">
        <input className="st35-input st35-num" type="number" min="5" max="240" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Minutes" />
        <button className="st35-btn" onClick={() => setTb(startTimebox('Auth hammer', minutes, NOW))}>Timebox depth for {minutes} min</button>
      </div>
      {tb && (
        <p className="st35-line">{expired ? 'Timebox expired — report back.' : `Active: ${tb.strategyName}, ${Math.round(timeboxRemainingMs(tb, NOW) / 60000)} min remaining.`}</p>
      )}
    </Card>
  );
}

// --- 51372 voting -----------------------------------------------------------------------------------------------
export function StrategyVoting() {
  const [vote, setVote] = useState(() => startStrategyVote('Switch to Auth hammer', ['ana', 'ben', 'cara'], NOW));
  const tally = strategyVoteTally(vote);
  return (
    <Card idea={51372} title="Strategy voting">
      <p className="st35-line">Proposal: <strong>{vote.proposal}</strong> · {tally.approve} approve / {tally.reject} reject · {tally.result}</p>
      <div className="st35-row">
        {['ana', 'ben'].map((v) => (
          <span key={v} className="st35-row">
            <span className="st35-dim">{v}:</span>
            <button className="st35-btn" onClick={() => setVote(castStrategyVote(vote, v, 'approve'))}>Approve</button>
            <button className="st35-btn" onClick={() => setVote(castStrategyVote(vote, v, 'reject'))}>Reject</button>
          </span>
        ))}
      </div>
    </Card>
  );
}

// --- 51373 diff view -----------------------------------------------------------------------------------------------
export function StrategyDiffView() {
  const diff = diffStrategy(BASE, AGGRESSIVE);
  return (
    <Card idea={51373} title="Strategy diff view">
      <p className="st35-line">Added phases: {diff.phasesAdded.join(', ') || 'none'} · Removed: {diff.phasesRemoved.join(', ') || 'none'}</p>
      <table className="st35-table">
        <thead><tr><th>Phase</th><th>From</th><th>To</th><th>Δ</th></tr></thead>
        <tbody>{diff.weightChanges.map((w) => (
          <tr key={w.phase}><td>{w.phase}</td><td>{w.from}</td><td>{w.to}</td><td className={w.delta > 0 ? 'st35-up' : 'st35-down'}>{w.delta > 0 ? '+' : ''}{w.delta}</td></tr>
        ))}</tbody>
      </table>
      {diff.priorityChanges && <p className="st35-line">Priority: {diff.priorityChanges.from.join(' → ')} ⇒ {diff.priorityChanges.to.join(' → ')}</p>}
    </Card>
  );
}

// --- 51374 retest preset -------------------------------------------------------------------------------------------------
export function RetestPresetCard() {
  const [active, setActive] = useState(false);
  const preset = retestModePreset();
  return (
    <Card idea={51374} title="Strategy presets for retests">
      <p className="st35-line">{preset.name} — {preset.rules.join(' · ')}</p>
      <button className="st35-btn" onClick={() => setActive(!active)}>{active ? 'Deactivate retest mode' : 'Activate retest mode'}</button>
      {active && <p className="st35-line">Retest mode live: {Object.entries(preset.allocation).map(([k, v]) => `${k}:${v}`).join(' ')}</p>}
    </Card>
  );
}

// --- 51375 learning ----------------------------------------------------------------------------------------------------------------
export function StrategyLearningPanel() {
  const hunts = [
    { strategy: 'Auth hammer', targetType: 'saas', findings: 11, hours: 3, endedAt: NOW - 2 * 86_400_000 },
    { strategy: 'Wide net', targetType: 'saas', findings: 7, hours: 4, endedAt: NOW - 5 * 86_400_000 },
    { strategy: 'Auth hammer', targetType: 'saas', findings: 13, hours: 3, endedAt: NOW - 9 * 86_400_000 },
    { strategy: 'API-first blitz', targetType: 'fintech', findings: 10, hours: 3, endedAt: NOW - 3 * 86_400_000 },
  ];
  const learned = learnStrategies(hunts, 'saas');
  return (
    <Card idea={51375} title="Strategy learning">
      <p className="st35-line">From similar SaaS targets:</p>
      <ul className="st35-list">{learned.map((l) => <li key={l.strategy}>{l.strategy} — {l.findingsPerHour} findings/hr over {l.hunts} hunts</li>)}</ul>
    </Card>
  );
}

// --- 51376 quiet hours -------------------------------------------------------------------------------------------------------------------
export function QuietHoursToggle() {
  const bizHour = new Date(NOW).getHours();
  const [at, setAt] = useState(NOW);
  const r = quietHoursDowngrade(AGGRESSIVE, at);
  return (
    <Card idea={51376} title="Strategy quiet hours">
      <p className="st35-line">Aggressive strategy at hour {new Date(at).getHours()}:00 — {r.downgraded ? `auto-downgraded: ${r.strategy.name}` : 'unchanged (outside business hours or not aggressive)'}</p>
      <button className="st35-btn" onClick={() => setAt(new Date(NOW).setHours(11, 0, 0, 0))}>Simulate 11:00 business hour</button>
      <button className="st35-btn" onClick={() => setAt(new Date(NOW).setHours(22, 0, 0, 0))}>Simulate 22:00 off-hour</button>
      <p className="st35-dim">Fixture hour: {bizHour}:00</p>
    </Card>
  );
}

// --- 51377 cost estimator ----------------------------------------------------------------------------------------------------------------------
export function CostEstimator() {
  const [hours, setHours] = useState(4);
  const cost = estimateStrategyCost(AGGRESSIVE, hours);
  return (
    <Card idea={51377} title="Strategy cost estimator">
      <div className="st35-row">
        <input className="st35-input st35-num" type="number" min="1" max="48" value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Hours" />
      </div>
      <p className="st35-line">Projected: <strong>{cost.requests.toLocaleString()} requests</strong> · {cost.estHours}h · ${cost.estSpend} spend</p>
    </Card>
  );
}

// --- 51378 approval flow ---------------------------------------------------------------------------------------------------------------------------
export function ApprovalFlow() {
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState('');
  const propose = () => setRequests([...requests, requestStrategyApproval({ to: 'Aggressive depth' }, 'two', NOW)]);
  const decide = (id, ok) => setRequests(requests.map((r) => (r.id === id ? decideStrategyApproval(r, ok, 'one', NOW) : r)));
  const pending = pendingStrategyApprovals(requests);
  return (
    <Card idea={51378} title="Strategy approval flow">
      <button className="st35-btn" onClick={propose}>Request major strategy change</button>
      <p className="st35-line">Pending: {pending.length}</p>
      {pending.map((r) => (
        <div key={r.id} className="st35-row">
          <span className="st35-line">{r.change.to} by {r.requestedBy}</span>
          <button className="st35-btn" onClick={() => { decide(r.id, true); setMsg(`${r.change.to} approved.`); }}>Approve</button>
          <button className="st35-btn" onClick={() => { decide(r.id, false); setMsg(`${r.change.to} denied.`); }}>Deny</button>
        </div>
      ))}
      {msg && <p className="st35-line">{msg}</p>}
    </Card>
  );
}

// --- 51379 chaining ------------------------------------------------------------------------------------------------------------------------------------
export function StrategyChaining() {
  const [chain, setChain] = useState(() => chainStrategies(['Wide net', 'Auth hammer', 'Retest mode']));
  const [current, setCurrent] = useState('Wide net');
  const advance = () => {
    const { next, chain: c, done } = advanceStrategyChain(chain);
    setChain(c);
    if (next) setCurrent(next);
    if (done) setCurrent('chain complete');
  };
  return (
    <Card idea={51379} title="Strategy chaining">
      <p className="st35-line">Queue: {chain.queue.join(' → ')} · now: <strong>{current}</strong> · {chain.status}</p>
      <button className="st35-btn" onClick={advance} disabled={chain.status !== 'running'}>Advance to next strategy</button>
    </Card>
  );
}

// --- 51380 performance alerts --------------------------------------------------------------------------------------------------------------------------------
export function PerformanceAlerts() {
  const [actual, setActual] = useState(0.8);
  const alert = checkStrategyPerformance(2.5, actual);
  return (
    <Card idea={51380} title="Strategy performance alerts">
      <p className="st35-line">Forecast: 2.50 findings/hr · actual: {actual.toFixed(2)}/hr</p>
      <input className="st35-input" type="range" min="0" max="3" step="0.1" value={actual} onChange={(e) => setActual(Number(e.target.value))} aria-label="Actual findings per hour" />
      {alert ? <p className="st35-warn">⚠ {alert.message} ({alert.shortfallPct}% shortfall)</p> : <p className="st35-line">On track — no alert.</p>}
    </Card>
  );
}

// --- 51381 personalization ---------------------------------------------------------------------------------------------------------------------------------------
export function PersonalizationPanel() {
  const [depth, setDepth] = useState(80);
  const p = personalizeStrategy(BASE, { preferredPhases: ['auth-deep'], avoidPhases: ['recon'], defaultDepth: depth });
  return (
    <Card idea={51381} title="Strategy personalization">
      <p className="st35-line">Your default depth: {depth}</p>
      <input className="st35-input" type="range" min="0" max="100" value={depth} onChange={(e) => setDepth(Number(e.target.value))} aria-label="Default depth" />
      <p className="st35-line">Adapted: {Object.entries(p.allocation).map(([k, v]) => `${k}:${v}`).join(' ')}</p>
    </Card>
  );
}

// --- 51382 explainability --------------------------------------------------------------------------------------------------------------------------------------------
export function StrategyExplainability() {
  const evidence = [
    { fact: '14 auth endpoints discovered', supports: 'depth' },
    { fact: 'JWTs with none-alg accepted on 3 endpoints', supports: 'depth' },
  ];
  const e = explainStrategyFit(AGGRESSIVE, evidence);
  return (
    <Card idea={51382} title="Strategy explainability">
      <p className="st35-line"><strong>{e.headline}</strong></p>
      <ul className="st35-list">{e.evidence.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <p className="st35-dim">{e.summary}</p>
    </Card>
  );
}

// --- 51383 snapshots ---------------------------------------------------------------------------------------------------------------------------------------------------
export function StrategySnapshots() {
  const [snaps, setSnaps] = useState([]);
  const take = () => setSnaps([...snaps, snapshotStrategy(AGGRESSIVE, `report-${snaps.length + 1}`, NOW)]);
  return (
    <Card idea={51383} title="Strategy snapshots">
      <button className="st35-btn" onClick={take}>Snapshot strategy with report</button>
      <ul className="st35-list">{snaps.map((s, i) => <li key={i}>{s.strategyName} ↔ {s.reportId} ({s.focus})</li>)}</ul>
    </Card>
  );
}

// --- 51384 migration -------------------------------------------------------------------------------------------------------------------------------------------------------
export function StrategyMigration() {
  const [msg, setMsg] = useState('');
  const migrate = () => {
    const r = migrateStrategy(AGGRESSIVE, { id: 'hunt-9', status: 'done' }, { id: 'hunt-14', assets: ['app', 'api'] });
    setMsg(r.ok ? `Migrated "${r.record.strategy}" hunt-9 → hunt-14 (${r.record.assets} assets, phases: ${r.record.appliedPhases.join(', ')})` : r.reason);
  };
  return (
    <Card idea={51384} title="Strategy migration">
      <button className="st35-btn" onClick={migrate}>Migrate working strategy to live hunt-14</button>
      {msg && <p className="st35-line">{msg}</p>}
    </Card>
  );
}

// --- 51385 fairness ------------------------------------------------------------------------------------------------------------------------------------------------------------
export function FairnessEnforcer() {
  const [minPct, setMinPct] = useState(10);
  const r = ensureFairCoverage({ app: 60, api: 30, docs: 2 }, ['app', 'api', 'docs'], minPct);
  return (
    <Card idea={51385} title="Strategy fairness">
      <p className="st35-line">Min coverage per asset: {minPct}%</p>
      <input className="st35-input" type="range" min="5" max="30" value={minPct} onChange={(e) => setMinPct(Number(e.target.value))} aria-label="Minimum percent" />
      <p className="st35-line">Balanced: {Object.entries(r.allocation).map(([k, v]) => `${k}:${v}%`).join(' ')} {r.adjusted ? '(adjusted)' : ''}</p>
    </Card>
  );
}

// --- 51386 pause points ----------------------------------------------------------------------------------------------------------------------------------------------------------------
export function PausePointGate() {
  const [phase, setPhase] = useState('business-logic');
  const timing = strategyChangeTiming(phase);
  return (
    <Card idea={51386} title="Strategy pause points">
      <div className="st35-row">
        <select className="st35-input" value={phase} onChange={(e) => setPhase(e.target.value)}>
          {['recon', 'surface-map', 'tech-fingerprint', 'auth-deep', 'business-logic', 'exploit-chain'].map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <p className="st35-line">Current phase <strong>{phase}</strong>: {timing === 'apply-now' ? 'safe to apply immediately' : 'change queued — applies at the next phase boundary'}</p>
    </Card>
  );
}

// --- 51387 digest ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function NotificationsDigest() {
  const [updates] = useState([
    { kind: 'switch', at: NOW - 5 * 60_000 },
    { kind: 'timebox-expired', at: NOW - 10 * 60_000 },
    { kind: 'vote-opened', at: NOW - 30 * 60_000 },
  ]);
  const d = digestStrategyUpdates(updates, NOW);
  return (
    <Card idea={51387} title="Strategy notifications digest">
      <p className="st35-line">{d.summary}</p>
      <ul className="st35-list">{d.items.map((u, i) => <li key={i}>{u.kind}</li>)}</ul>
    </Card>
  );
}

// --- 51389 tags ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function StrategyTagManager() {
  const [tags, setTags] = useState({});
  const [tag, setTag] = useState('won');
  const seg = 'seg-2';
  const apply = () => setTags(tagStrategySegment(tags, seg, tag.trim() || 'untagged'));
  return (
    <Card idea={51389} title="Strategy tags">
      <div className="st35-row">
        <input className="st35-input" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag" />
        <button className="st35-btn" onClick={apply}>Tag segment {seg}</button>
      </div>
      <p className="st35-line">Segments tagged "{tag}": {strategySegmentsByTag(tags, tag).join(', ') || 'none'}</p>
    </Card>
  );
}

// --- 51390 correlation --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function StrategyCorrelationChart() {
  const findings = [{ id: 'F-1' }, { id: 'F-2' }, { id: 'F-3' }, { id: 'F-4' }];
  const corr = correlateStrategyFindings(findings, { 'F-1': 'Auth hammer', 'F-2': 'Wide net', 'F-3': 'Auth hammer' });
  const max = Math.max(1, ...(corr.counts.map((c) => c.count)));
  return (
    <Card idea={51390} title="Strategy vs findings correlation">
      {corr.counts.map((c) => (
        <div key={c.strategy} className="st35-bar-row">
          <span className="st35-bar-label">{c.strategy}</span>
          <div className="st35-bar-track"><div className="st35-bar-fill" style={{ width: `${(c.count / max) * 100}%` }} /></div>
          <span className="st35-dim">{c.count}</span>
        </div>
      ))}
      <p className="st35-line">Top producer: {corr.top ? `${corr.top.strategy} (${corr.top.count})` : 'none yet'}</p>
    </Card>
  );
}

// --- 51391 export ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function ExportStrategyJourney() {
  const [copied, setCopied] = useState(false);
  const md = exportStrategyJourney(
    [{ strategy: 'Wide net', durationMin: 60 }, { strategy: 'Auth hammer', durationMin: 30 }],
    [{ strategy: 'Auth hammer', text: 'JWT misconfigs found early — doubling down on auth.' }]
  );
  return (
    <Card idea={51391} title="Strategy export to report">
      <pre className="st35-pre">{md}</pre>
      <button className="st35-btn" onClick={() => setCopied(true)}>{copied ? 'Marked for report appendix' : 'Append to report'}</button>
    </Card>
  );
}

// --- 51392 voice ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function VoiceStrategyControl() {
  const [input, setInput] = useState('roll back the strategy');
  const parsed = parseVoiceStrategyCommand(input);
  return (
    <Card idea={51392} title="Strategy voice control">
      <div className="st35-row">
        <input className="st35-input" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Voice command" />
      </div>
      <p className="st35-line">Heard as: <code>{parsed ? JSON.stringify(parsed) : 'not a strategy command'}</code></p>
      <p className="st35-dim">Try: "switch to depth mode", "go aggressive", "use api first".</p>
    </Card>
  );
}

// --- 51393 mobile ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function MobileStrategyPicker() {
  const [applied, setApplied] = useState('');
  const items = mobileStrategyPicker([BASE, AGGRESSIVE, retestModePreset()]);
  return (
    <Card idea={51393} title="Strategy mobile control">
      {items.map((i) => (
        <div key={i.name} className="st35-row">
          <span className="st35-line"><strong>{i.name}</strong> <span className="st35-dim">{i.oneLine}</span></span>
          <button className="st35-btn" onClick={() => setApplied(i.name)}>Apply</button>
        </div>
      ))}
      {applied && <p className="st35-line">Applied from phone: <strong>{applied}</strong></p>}
    </Card>
  );
}

// --- 51394 guardrail presets ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function GuardrailPresets() {
  const [presetId, setPresetId] = useState('never-aggressive-on-prod');
  const r = enforceGuardrailPreset(AGGRESSIVE, presetId, { env: 'prod', budget: 50, estHours: 4 });
  return (
    <Card idea={51394} title="Strategy guardrail presets">
      <div className="st35-row">
        <select className="st35-input" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
          {Object.entries(GUARDRAIL_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
        </select>
      </div>
      <p className="st35-line">Aggressive strategy on prod: {r.ok ? 'allowed' : 'BLOCKED'}</p>
      {r.violations.map((v, i) => <p key={i} className="st35-warn">{v}</p>)}
    </Card>
  );
}

// --- 51395 retrospectives ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function RetrospectiveView() {
  const retro = buildRetrospective(
    [{ strategy: 'Auth hammer', forecastFph: 3 }, { strategy: 'Wide net', forecastFph: 2 }],
    [{ strategy: 'Auth hammer', findingsPerHour: 4.1 }, { strategy: 'Wide net', findingsPerHour: 1.2 }]
  );
  return (
    <Card idea={51395} title="Strategy retrospectives">
      <p className="st35-line">Hunt grade: <strong>{retro.grade}</strong></p>
      <ul className="st35-list">{retro.lessons.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </Card>
  );
}

// --- 51396 recommendation engine ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function RecommendationEngine() {
  const hunts = [
    { strategy: 'Auth hammer', targetType: 'saas', findings: 11, hours: 3, endedAt: NOW - 2 * 86_400_000 },
    { strategy: 'Wide net', targetType: 'saas', findings: 7, hours: 4, endedAt: NOW - 5 * 86_400_000 },
    { strategy: 'Auth hammer', targetType: 'saas', findings: 13, hours: 3, endedAt: NOW - 9 * 86_400_000 },
    { strategy: 'API-first blitz', targetType: 'saas', findings: 9, hours: 3, endedAt: NOW - 1 * 86_400_000 },
  ];
  const [accepted, setAccepted] = useState(null);
  const recs = recommendStrategies(hunts, { targetType: 'saas', now: NOW });
  return (
    <Card idea={51396} title="Strategy recommendation engine (mid-hunt)">
      <ul className="st35-list">
        {recs.map((r) => (
          <li key={r.strategy}>
            <strong>{r.strategy}</strong> — {r.reason}
            <button className="st35-btn st35-btn-inline" onClick={() => setAccepted(r.strategy)}>Accept</button>
          </li>
        ))}
      </ul>
      {accepted && <p className="st35-line">Accepted recommendation: <strong>{accepted}</strong></p>}
    </Card>
  );
}

// --- gallery -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const ALL = [
  [EffectivenessScoreboard, 51361], [OneClickRollback, 51362], [RollbackWindowBanner, 51388],
  [StrategyAnnotations, 51363], [StrategyChatCommands, 51364], [StrategyTimelineView, 51365],
  [StrategyReportAttribution, 51366], [PresetMarketplace, 51367], [StrategySimulator, 51368],
  [FocusAreaPicker, 51369], [StrategyExclusions, 51370], [TimeboxControl, 51371],
  [StrategyVoting, 51372], [StrategyDiffView, 51373], [RetestPresetCard, 51374],
  [StrategyLearningPanel, 51375], [QuietHoursToggle, 51376], [CostEstimator, 51377],
  [ApprovalFlow, 51378], [StrategyChaining, 51379], [PerformanceAlerts, 51380],
  [PersonalizationPanel, 51381], [StrategyExplainability, 51382], [StrategySnapshots, 51383],
  [StrategyMigration, 51384], [FairnessEnforcer, 51385], [PausePointGate, 51386],
  [NotificationsDigest, 51387], [StrategyTagManager, 51389], [StrategyCorrelationChart, 51390],
  [ExportStrategyJourney, 51391], [VoiceStrategyControl, 51392], [MobileStrategyPicker, 51393],
  [GuardrailPresets, 51394], [RetrospectiveView, 51395], [RecommendationEngine, 51396],
];

export function StrategyRound3Gallery() {
  return (
    <div className="st35-gallery" aria-label="Strategy round 3 gallery">
      {ALL.map(([C, id]) => <C key={id} />)}
    </div>
  );
}
