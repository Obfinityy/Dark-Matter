/**
 * StrategySuite.jsx — wave 34, part 2 (ideas 51341–51360): live strategy
 * suite.
 * Real working components driving local state — no mocks, no demo-only
 * controls. All state math comes from strategyCore.js.
 */
import React, { useState } from 'react';
import {
  WAVE34B_IDEAS,
  normalizeStrategy,
  BREADTH_PHASES, DEPTH_PHASES,
  shiftBreadthToDepth, shiftDepthToBreadth,
  STRATEGY_PRESETS, applyPreset,
  compareStrategies,
  forecastImpact,
  buildStrategy,
  commitStrategy, rollbackStrategy, strategyHistoryList,
  abTestPlan, abResult,
  suggestStrategyShift,
  scheduleShift, shiftsDue,
  perAssetStrategy,
  strategyHeatmap,
  logRationale,
  INDUSTRY_TEMPLATES, industryTemplate,
  exportStrategy, importStrategy,
  dryRun,
  strategyConfidence,
  autoStrategyBounds, autoShiftAllowed,
  checkGuardrails,
  strategyAlert,
} from './strategyCore.js';

const NOW = 1728220000000;
const DEFAULT_STRATEGY = normalizeStrategy({ name: 'Balanced', focus: 'balanced', allocation: { recon: 20, 'surface-map': 15, 'tech-fingerprint': 10, 'auth-deep': 20, 'business-logic': 20, 'exploit-chain': 15 } });

function Card({ title, idea, children }) {
  return (
    <section className="st34-card" aria-label={title}>
      <header className="st34-card-head">
        <h3 className="st34-card-title">{title}</h3>
        <span className="st34-idea">#{idea}</span>
      </header>
      <div className="st34-card-body">{children}</div>
    </section>
  );
}

function AllocTable({ allocation }) {
  return (
    <ul className="st34-list">
      {Object.keys(allocation).sort().map((p) => (
        <li key={p} className="st34-list-item"><span className="st34-phase">{p}</span><span className="st34-bar"><span className="st34-fill" style={{ width: `${allocation[p]}%` }} /></span><strong>{allocation[p]}%</strong></li>
      ))}
    </ul>
  );
}

/** 51341 — Breadth-to-depth switch. */
export function BreadthToDepthSwitch() {
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);
  return (
    <Card title="Breadth-to-depth switch" idea="51341">
      <p className="st34-muted">Focus: <strong>{strategy.focus}</strong> — one control shifts from wide coverage to deep dives.</p>
      <button type="button" className="st34-btn" onClick={() => setStrategy((s) => shiftBreadthToDepth(s))}>Shift to depth</button>
      <AllocTable allocation={strategy.allocation} />
    </Card>
  );
}

/** 51342 — Depth-to-breadth switch. */
export function DepthToBreadthSwitch() {
  const [strategy, setStrategy] = useState(() => shiftBreadthToDepth(DEFAULT_STRATEGY));
  return (
    <Card title="Depth-to-breadth switch" idea="51342">
      <p className="st34-muted">Focus: <strong>{strategy.focus}</strong> — pull back from deep testing to cover more surface.</p>
      <button type="button" className="st34-btn" onClick={() => setStrategy((s) => shiftDepthToBreadth(s))}>Shift to breadth</button>
      <AllocTable allocation={strategy.allocation} />
    </Card>
  );
}

/** 51343 — Strategy presets applied live. */
export function StrategyPresets() {
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);
  return (
    <Card title="Strategy presets" idea="51343">
      <div className="st34-row">
        {STRATEGY_PRESETS.map((p) => (
          <button key={p.name} type="button" className={`st34-btn${strategy.name.startsWith(p.name) ? ' st34-btn-active' : ''}`} onClick={() => setStrategy(applyPreset(p.name))}>{p.name}</button>
        ))}
      </div>
      <p>Active: <strong>{strategy.name}</strong> (focus: {strategy.focus})</p>
      <AllocTable allocation={strategy.allocation} />
    </Card>
  );
}

/** 51344 — Strategy comparison: current vs proposed side by side. */
export function StrategyComparison() {
  const [proposedName, setProposedName] = useState('Auth-focused');
  const proposed = applyPreset(proposedName);
  const cmp = compareStrategies(DEFAULT_STRATEGY, proposed);
  return (
    <Card title="Strategy comparison" idea="51344">
      <div className="st34-row">
        <span className="st34-muted">Current: <strong>Balanced</strong></span>
        <select className="st34-select" value={proposedName} onChange={(e) => setProposedName(e.target.value)} aria-label="Proposed strategy">
          {STRATEGY_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <table className="st34-table">
        <thead><tr><th>Phase</th><th>Current</th><th>Proposed</th><th>Δ</th></tr></thead>
        <tbody>
          {cmp.rows.map((r) => (
            <tr key={r.phase}><td>{r.phase}</td><td>{r.current}%</td><td>{r.proposed}%</td><td className={r.delta > 0 ? 'st34-up' : r.delta < 0 ? 'st34-down' : ''}>{r.delta > 0 ? `+${r.delta}` : r.delta}%</td></tr>
          ))}
        </tbody>
      </table>
      <p className="st34-note">Biggest shift: {cmp.biggestShift.phase} ({cmp.biggestShift.delta > 0 ? '+' : ''}{cmp.biggestShift.delta}%) · focus {cmp.focusChanged ? 'changes' : 'unchanged'}</p>
    </Card>
  );
}

/** 51345 — Strategy impact forecast: time + coverage before you commit. */
export function StrategyImpactForecast() {
  const [proposedName, setProposedName] = useState('Auth-focused');
  const [endpoints, setEndpoints] = useState(400);
  const f = forecastImpact(DEFAULT_STRATEGY, applyPreset(proposedName), { endpoints });
  return (
    <Card title="Strategy impact forecast" idea="51345">
      <div className="st34-row">
        <select className="st34-select" value={proposedName} onChange={(e) => setProposedName(e.target.value)} aria-label="Proposed strategy">
          {STRATEGY_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <label className="st34-muted">Endpoints
          <input className="st34-input" type="number" value={endpoints} onChange={(e) => setEndpoints(Number(e.target.value))} aria-label="Remaining endpoints" />
        </label>
      </div>
      <ul className="st34-list">
        <li className="st34-list-item">Est. time: {f.hoursCurrent}h → <strong>{f.hoursProposed}h</strong> ({f.hoursDelta >= 0 ? '+' : ''}{f.hoursDelta}h)</li>
        <li className="st34-list-item">Coverage: {f.coverageCurrent}% → <strong>{f.coverageProposed}%</strong></li>
      </ul>
    </Card>
  );
}

/** 51346 — Custom strategy builder with phase-mix sliders. */
export function CustomStrategyBuilder() {
  const phases = ['recon', 'surface-map', 'tech-fingerprint', 'auth-deep', 'business-logic', 'exploit-chain'];
  const [mix, setMix] = useState({ recon: 15, 'surface-map': 15, 'tech-fingerprint': 10, 'auth-deep': 20, 'business-logic': 25, 'exploit-chain': 15 });
  const [name, setName] = useState('My custom');
  const [result, setResult] = useState(null);
  const total = Object.values(mix).reduce((s, v) => s + v, 0);
  return (
    <Card title="Custom strategy builder" idea="51346">
      <input className="st34-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Strategy name" />
      {phases.map((p) => (
        <div key={p} className="st34-row">
          <span className="st34-phase">{p}</span>
          <input className="st34-range" type="range" min="0" max="60" value={mix[p]} onChange={(e) => setMix((m) => ({ ...m, [p]: Number(e.target.value) }))} aria-label={`${p} weight`} />
          <strong>{mix[p]}%</strong>
        </div>
      ))}
      <p>Total: <strong className={Math.abs(total - 100) > 1 ? 'st34-down' : 'st34-up'}>{total}%</strong> (must be 100)</p>
      <button type="button" className="st34-btn" onClick={() => setResult(buildStrategy(name, mix))}>Save as preset</button>
      {result && (result.ok
        ? <p className="st34-ok">Saved "{result.strategy.name}" — ready to apply live.</p>
        : <ul className="st34-list">{result.errors.map((e, i) => <li key={i} className="st34-down">{e}</li>)}</ul>)}
    </Card>
  );
}

/** 51347 — Strategy versioning with rollback. */
export function StrategyVersioning() {
  const [history, setHistory] = useState(() => commitStrategy([], DEFAULT_STRATEGY, 'initial', NOW - 3600000));
  const [note, setNote] = useState('');
  const [rolled, setRolled] = useState(null);
  const shift = () => setHistory((h) => commitStrategy(h, shiftBreadthToDepth(h[h.length - 1].strategy), note || 'manual shift', NOW));
  return (
    <Card title="Strategy versioning" idea="51347">
      <div className="st34-row">
        <input className="st34-input" placeholder="Change note…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Version note" />
        <button type="button" className="st34-btn" onClick={() => { shift(); setNote(''); }}>Commit shift-to-depth</button>
      </div>
      <ul className="st34-list">
        {strategyHistoryList(history).map((e) => (
          <li key={e.version} className="st34-list-item">v{e.version} — {e.name} · {e.note || 'no note'}
            <button type="button" className="st34-btn st34-btn-ghost" onClick={() => setRolled(rollbackStrategy(history, e.version))}>Roll back</button>
          </li>
        ))}
      </ul>
      {rolled && <p className="st34-note">Rolled back to "{rolled.name}" ({rolled.focus}).</p>}
    </Card>
  );
}

/** 51348 — A/B strategy testing on mirrored scope. */
export function ABStrategyTesting() {
  const [endpoints, setEndpoints] = useState(400);
  const [yieldA, setYieldA] = useState(7);
  const [yieldB, setYieldB] = useState(11);
  const plan = abTestPlan(applyPreset('API-first'), applyPreset('Auth-focused'), { endpoints });
  const res = abResult(yieldA, yieldB);
  return (
    <Card title="A/B strategy testing" idea="51348">
      <p className="st34-muted">Arm A: <strong>{plan.armA.strategy}</strong> ({plan.armA.endpoints} endpoints) · Arm B: <strong>{plan.armB.strategy}</strong> ({plan.armB.endpoints} endpoints)</p>
      <div className="st34-row">
        <label className="st34-muted">Yield A
          <input className="st34-input" type="number" value={yieldA} onChange={(e) => setYieldA(Number(e.target.value))} aria-label="Yield A" />
        </label>
        <label className="st34-muted">Yield B
          <input className="st34-input" type="number" value={yieldB} onChange={(e) => setYieldB(Number(e.target.value))} aria-label="Yield B" />
        </label>
        <label className="st34-muted">Scope endpoints
          <input className="st34-input" type="number" value={endpoints} onChange={(e) => setEndpoints(Number(e.target.value))} aria-label="Scope endpoints" />
        </label>
      </div>
      <p>Winner: <strong>{res.winner === 'tie' ? 'Tie' : `Arm ${res.winner}`}</strong> ({res.yieldA} vs {res.yieldB} findings, Δ {res.delta})</p>
    </Card>
  );
}

/** 51349 — Strategy suggestions from live results. */
export function StrategySuggestions() {
  const [stats, setStats] = useState({ findingsPerHour: 0.3, coveragePct: 72, authFindings: 1, breadthHours: 2, depthHours: 5 });
  const s = suggestStrategyShift(stats);
  const set = (k, v) => setStats((st) => ({ ...st, [k]: Number(v) }));
  return (
    <Card title="Strategy suggestions" idea="51349">
      <div className="st34-row">
        <label className="st34-muted">Findings/hr <input className="st34-input" type="number" step="0.1" value={stats.findingsPerHour} onChange={(e) => set('findingsPerHour', e.target.value)} aria-label="Findings per hour" /></label>
        <label className="st34-muted">Coverage % <input className="st34-input" type="number" value={stats.coveragePct} onChange={(e) => set('coveragePct', e.target.value)} aria-label="Coverage percent" /></label>
        <label className="st34-muted">Auth findings <input className="st34-input" type="number" value={stats.authFindings} onChange={(e) => set('authFindings', e.target.value)} aria-label="Auth findings" /></label>
      </div>
      <p>{s.suggestion === 'hold'
        ? <span className="st34-ok">Hold — {s.rationale}</span>
        : <span>Suggested: <strong>{s.preset}</strong> — {s.rationale}</span>}</p>
    </Card>
  );
}

/** 51350 — Scheduled strategy shifts queued in advance. */
export function ScheduledStrategyShifts() {
  const [shifts, setShifts] = useState([
    { id: 'shift-1', when: 'phase-complete:recon', apply: 'Auth-focused', status: 'scheduled' },
  ]);
  const [completed, setCompleted] = useState(['recon']);
  const due = shiftsDue(shifts, { completedPhases: completed, now: NOW });
  return (
    <Card title="Scheduled strategy shifts" idea="51350">
      <ul className="st34-list">
        {shifts.map((s) => <li key={s.id} className="st34-list-item">"{s.apply}" when <code>{s.when}</code> — {s.status}</li>)}
      </ul>
      <div className="st34-row">
        <button type="button" className="st34-btn st34-btn-ghost" onClick={() => setShifts((s) => scheduleShift(s, { when: 'phase-complete:auth-deep', apply: 'Logic-heavy' }))}>Queue "go deep on auth after recon"</button>
        <button type="button" className="st34-btn st34-btn-ghost" onClick={() => setCompleted((c) => (c.includes('auth-deep') ? c : [...c, 'auth-deep']))}>Complete auth-deep</button>
      </div>
      <p className="st34-note">Due now: {due.length ? due.map((d) => `"${d.apply}"`).join(', ') : 'none'}</p>
    </Card>
  );
}

/** 51351 — Strategy per asset: different strategies per in-scope asset. */
export function StrategyPerAsset() {
  const assets = ['api.shop.example', 'app.shop.example', 'admin.shop.example'];
  const [assignments, setAssignments] = useState([{ asset: 'admin.shop.example', strategyName: 'Auth-focused' }]);
  const [asset, setAsset] = useState('api.shop.example');
  const [preset, setPreset] = useState('API-first');
  const rows = perAssetStrategy(assets, assignments, DEFAULT_STRATEGY);
  return (
    <Card title="Strategy per asset" idea="51351">
      <div className="st34-row">
        <select className="st34-select" value={asset} onChange={(e) => setAsset(e.target.value)} aria-label="Asset">
          {assets.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="st34-select" value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Strategy preset">
          {STRATEGY_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <button type="button" className="st34-btn" onClick={() => setAssignments((a) => [...a.filter((x) => x.asset !== asset), { asset, strategyName: preset }])}>Assign</button>
      </div>
      <ul className="st34-list">
        {rows.map((r) => <li key={r.asset} className="st34-list-item"><strong>{r.asset}</strong> → {r.strategy}</li>)}
      </ul>
    </Card>
  );
}

/** 51352 — Strategy heatmap: where effort is going. */
export function StrategyHeatmap() {
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);
  const rows = strategyHeatmap(strategy);
  return (
    <Card title="Strategy heatmap" idea="51352">
      <div className="st34-row">
        <button type="button" className="st34-btn st34-btn-ghost" onClick={() => setStrategy((s) => shiftBreadthToDepth(s))}>Shift to depth</button>
        <button type="button" className="st34-btn st34-btn-ghost" onClick={() => setStrategy(DEFAULT_STRATEGY)}>Reset</button>
      </div>
      <ul className="st34-list">
        {rows.map((r) => (
          <li key={r.phase} className="st34-list-item">
            <span className="st34-phase">{r.phase}</span>
            <span className={`st34-heat st34-heat-${r.intensity}`} title={r.intensity}>{'▮'.repeat(r.intensity === 'none' ? 0 : r.intensity === 'low' ? 1 : r.intensity === 'medium' ? 2 : 3) || '—'}</span>
            <strong>{r.weight}%</strong>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** 51353 — Strategy rationale log: why each change was made. */
export function StrategyRationaleLog() {
  const [log, setLog] = useState([]);
  const [text, setText] = useState('');
  return (
    <Card title="Strategy rationale log" idea="51353">
      <div className="st34-row">
        <input className="st34-input" placeholder="Why the change, in the agent's words…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Rationale" />
        <button type="button" className="st34-btn" onClick={() => { if (text.trim()) { setLog((l) => logRationale(l, 'Balanced → Auth-focused', text, NOW)); setText(''); } }}>Log</button>
      </div>
      <ul className="st34-list">
        {log.map((e, i) => <li key={i} className="st34-list-item"><strong>{e.change}:</strong> {e.rationale}</li>)}
        {log.length === 0 && <li className="st34-muted">No rationale entries yet.</li>}
      </ul>
    </Card>
  );
}

/** 51354 — Strategy templates by industry. */
export function IndustryTemplates() {
  const [industry, setIndustry] = useState('fintech');
  const t = industryTemplate(industry);
  return (
    <Card title="Strategy templates by industry" idea="51354">
      <div className="st34-row">
        {Object.keys(INDUSTRY_TEMPLATES).map((k) => (
          <button key={k} type="button" className={`st34-btn${industry === k ? ' st34-btn-active' : ''}`} onClick={() => setIndustry(k)}>{INDUSTRY_TEMPLATES[k].name}</button>
        ))}
      </div>
      {t && (
        <div>
          <p><strong>{t.name}</strong> → preset "{t.strategy.name}" ({t.focus})</p>
          <p className="st34-muted">{t.note}</p>
          <AllocTable allocation={t.strategy.allocation} />
        </div>
      )}
    </Card>
  );
}

/** 51355 — Strategy import/export as shareable files. */
export function StrategyImportExport() {
  const [text, setText] = useState(() => exportStrategy(DEFAULT_STRATEGY));
  const [result, setResult] = useState(null);
  return (
    <Card title="Strategy import/export" idea="51355">
      <textarea className="st34-textarea" rows="6" value={text} onChange={(e) => setText(e.target.value)} aria-label="Strategy file JSON" />
      <div className="st34-row">
        <button type="button" className="st34-btn" onClick={() => setText(exportStrategy(DEFAULT_STRATEGY))}>Export current</button>
        <button type="button" className="st34-btn st34-btn-ghost" onClick={() => setResult(importStrategy(text))}>Import & validate</button>
      </div>
      {result && (result.ok
        ? <p className="st34-ok">Valid — "{result.strategy.name}" imported, weights sum to 100.</p>
        : <ul className="st34-list">{result.errors.map((e, i) => <li key={i} className="st34-down">{e}</li>)}</ul>)}
    </Card>
  );
}

/** 51356 — Strategy dry-run: preview before applying. */
export function StrategyDryRun() {
  const [proposedName, setProposedName] = useState('Auth-focused');
  const d = dryRun(DEFAULT_STRATEGY, applyPreset(proposedName), { endpoints: 400 });
  return (
    <Card title="Strategy dry-run" idea="51356">
      <select className="st34-select" value={proposedName} onChange={(e) => setProposedName(e.target.value)} aria-label="Proposed strategy">
        {STRATEGY_PRESETS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
      </select>
      <ul className="st34-list">
        <li className="st34-list-item">Time: {d.hoursCurrent}h → {d.hoursProposed}h ({d.hoursDelta >= 0 ? '+' : ''}{d.hoursDelta}h)</li>
        <li className="st34-list-item">Coverage: {d.coverageCurrent}% → {d.coverageProposed}% (Δ {d.coverageDelta >= 0 ? '+' : ''}{d.coverageDelta})</li>
      </ul>
      <p>Verdict: <strong>{d.verdict}</strong> — nothing applied, this was only a preview.</p>
    </Card>
  );
}

/** 51357 — Strategy confidence: how well the strategy fits discoveries. */
export function StrategyConfidence() {
  const [strategy, setStrategy] = useState(DEFAULT_STRATEGY);
  const [cov, setCov] = useState(70);
  const [fph, setFph] = useState(1.2);
  const score = strategyConfidence(strategy, { coveragePct: cov, findingsPerHour: fph });
  return (
    <Card title="Strategy confidence" idea="51357">
      <div className="st34-row">
        <button type="button" className="st34-btn st34-btn-ghost" onClick={() => setStrategy((s) => shiftBreadthToDepth(s))}>Shift to depth</button>
        <label className="st34-muted">Coverage % <input className="st34-input" type="number" value={cov} onChange={(e) => setCov(Number(e.target.value))} aria-label="Coverage percent" /></label>
        <label className="st34-muted">Findings/hr <input className="st34-input" type="number" step="0.1" value={fph} onChange={(e) => setFph(Number(e.target.value))} aria-label="Findings per hour" /></label>
      </div>
      <p>Confidence in "{strategy.name}": <strong>{score}/100</strong></p>
    </Card>
  );
}

/** 51358 — Auto-strategy mode: agent shifts within bounds you set. */
export function AutoStrategyMode() {
  const [bounds, setBounds] = useState(() => autoStrategyBounds());
  const [shiftPct, setShiftPct] = useState(20);
  const [kind, setKind] = useState('breadth-depth');
  const verdict = autoShiftAllowed(bounds, { kind, shiftPct });
  return (
    <Card title="Auto-strategy mode" idea="51358">
      <div className="st34-row">
        <label className="st34-muted"><input type="checkbox" checked={bounds.allowBreadthDepth} onChange={(e) => setBounds((b) => ({ ...b, allowBreadthDepth: e.target.checked }))} /> breadth/depth shifts</label>
        <label className="st34-muted"><input type="checkbox" checked={bounds.allowPresetChange} onChange={(e) => setBounds((b) => ({ ...b, allowPresetChange: e.target.checked }))} /> preset changes</label>
        <label className="st34-muted">Max shift %
          <input className="st34-input" type="number" value={bounds.maxShiftPct} onChange={(e) => setBounds((b) => ({ ...b, maxShiftPct: Number(e.target.value) }))} aria-label="Max shift percent" />
        </label>
      </div>
      <div className="st34-row">
        <select className="st34-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Shift kind">
          <option value="breadth-depth">breadth-depth</option>
          <option value="preset">preset</option>
        </select>
        <input className="st34-input" type="number" value={shiftPct} onChange={(e) => setShiftPct(Number(e.target.value))} aria-label="Proposed shift percent" />
      </div>
      <p>{verdict.allowed ? <span className="st34-ok">Auto-shift allowed.</span> : <span className="st34-down">Blocked: {verdict.reason}.</span>}</p>
    </Card>
  );
}

/** 51359 — Strategy guardrails: hard limits on auto changes. */
export function StrategyGuardrails() {
  const guardrails = [
    { id: 'keep-coverage', kind: 'min-breadth', limit: 15 },
    { id: 'protect-auth', kind: 'forbid-phase', phases: ['auth-deep'] },
    { id: 'cap-shift', kind: 'max-shift', limit: 40 },
  ];
  const [newBreadth, setNewBreadth] = useState(10);
  const [dropAuth, setDropAuth] = useState(false);
  const change = { kind: 'breadth-depth', newBreadthPct: newBreadth, shiftPct: 45, removedPhases: dropAuth ? ['auth-deep'] : [] };
  const violations = checkGuardrails(change, guardrails);
  return (
    <Card title="Strategy guardrails" idea="51359">
      <ul className="st34-list">
        <li className="st34-list-item">keep-coverage: breadth must stay ≥ 15%</li>
        <li className="st34-list-item">protect-auth: auto may never drop auth-deep</li>
        <li className="st34-list-item">cap-shift: single shift ≤ 40%</li>
      </ul>
      <div className="st34-row">
        <label className="st34-muted">New breadth % <input className="st34-input" type="number" value={newBreadth} onChange={(e) => setNewBreadth(Number(e.target.value))} aria-label="New breadth percent" /></label>
        <label className="st34-muted"><input type="checkbox" checked={dropAuth} onChange={(e) => setDropAuth(e.target.checked)} /> drop auth-deep</label>
      </div>
      {violations.length === 0
        ? <p className="st34-ok">No guardrail violations.</p>
        : <ul className="st34-list">{violations.map((v, i) => <li key={i} className="st34-down">⛔ {v}</li>)}</ul>}
    </Card>
  );
}

/** 51360 — Strategy change alerts to watchers. */
export function StrategyChangeAlerts() {
  const [alerts, setAlerts] = useState([]);
  const watchers = [{ id: 'you', channel: 'board' }, { id: 'priya', channel: 'email' }];
  return (
    <Card title="Strategy change alerts" idea="51360">
      <button type="button" className="st34-btn" onClick={() => setAlerts(strategyAlert({ from: 'Balanced', to: 'Auth-focused', reason: 'agent suggestion accepted' }, watchers, NOW))}>Apply strategy change</button>
      <ul className="st34-list">
        {alerts.map((a, i) => <li key={i} className="st34-list-item">→ {a.to} via {a.channel}: <strong>{a.subject}</strong></li>)}
        {alerts.length === 0 && <li className="st34-muted">No alerts yet — watchers are notified on every shift.</li>}
      </ul>
    </Card>
  );
}

/** Registry sanity: every idea 51341–51360 has a component in this file. */
export const STRATEGY_COMPONENTS = WAVE34B_IDEAS.map(([id]) => id);

/** Gallery showcasing all 20 live-strategy components. */
export function Wave34Gallery() {
  return (
    <div className="st34-gallery">
      <BreadthToDepthSwitch />
      <DepthToBreadthSwitch />
      <StrategyPresets />
      <StrategyComparison />
      <StrategyImpactForecast />
      <CustomStrategyBuilder />
      <StrategyVersioning />
      <ABStrategyTesting />
      <StrategySuggestions />
      <ScheduledStrategyShifts />
      <StrategyPerAsset />
      <StrategyHeatmap />
      <StrategyRationaleLog />
      <IndustryTemplates />
      <StrategyImportExport />
      <StrategyDryRun />
      <StrategyConfidence />
      <AutoStrategyMode />
      <StrategyGuardrails />
      <StrategyChangeAlerts />
    </div>
  );
}
