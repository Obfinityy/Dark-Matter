/**
 * SteeringRound2.jsx — wave 30 (ideas 51161–51172): steering round 2 —
 * de-emphasize findings class, steer via findings feed, hunt persona
 * switch, checkpoint steering, steering analytics, emergency re-scope,
 * command aliases, scheduled steering, conflict resolver, autonomy
 * slider, notification feed, post-steering summary.
 *
 * Real working components driving local state. No mocks.
 */
import { useMemo, useState } from 'react';
import {
  HUNT_PERSONAS,
  deemphasizeFindingsClass, steerFromFindings, switchPersona,
  addCheckpoint, reachCheckpoint, steeringAnalytics, emergencyRescope,
  defineAlias, expandAlias, scheduleSteering, dueSteering,
  resolveSteeringConflict, setAutonomy, pushSteeringEvent, postSteeringSummary,
} from './governCore.js';

/* 51161 — de-emphasize findings class */
export function DeemphasizeClass({ initial = [] }) {
  const [deemphasized, setDeemphasized] = useState(initial);
  const [input, setInput] = useState('');
  const [adaptation, setAdaptation] = useState(null);
  const add = () => {
    const r = deemphasizeFindingsClass(deemphasized, input);
    setDeemphasized(r.deemphasized);
    setAdaptation(r.adaptation);
    setInput('');
  };
  return (
    <div className="gov30-card">
      <h4>De-emphasize findings class</h4>
      <div className="gov30-row">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. informational" aria-label="Finding category" />
        <button onClick={add}>De-emphasize</button>
      </div>
      <div className="gov30-chips">{deemphasized.map((c) => <span key={c} className="gov30-chip">{c}</span>)}</div>
      {adaptation && <p className="gov30-note">{adaptation.note}</p>}
    </div>
  );
}

/* 51162 — steering via findings feed */
export function FindingsFeedSteering({ findings = [] }) {
  const [selected, setSelected] = useState([]);
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const directive = useMemo(
    () => steerFromFindings(findings.filter((f) => selected.includes(f.id))),
    [findings, selected],
  );
  return (
    <div className="gov30-card">
      <h4>Steer via findings feed</h4>
      <ul className="gov30-list">
        {findings.map((f) => (
          <li key={f.id}>
            <label><input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} /> {f.title} <span className="gov30-dim">({f.category} · {f.severity})</span></label>
          </li>
        ))}
      </ul>
      {directive && <p className="gov30-note">Directive: {directive.instruction}</p>}
    </div>
  );
}

/* 51163 — hunt persona switch */
export function PersonaSwitch({ initial = 'balanced' }) {
  const [persona, setPersona] = useState(initial);
  const [profile, setProfile] = useState(null);
  const change = (p) => {
    const r = switchPersona(persona, p);
    setPersona(r.persona);
    setProfile(r.profile);
  };
  return (
    <div className="gov30-card">
      <h4>Hunt persona</h4>
      <div className="gov30-row">
        {HUNT_PERSONAS.map((p) => (
          <button key={p} className={persona === p ? 'gov30-active' : ''} onClick={() => change(p)}>{p}</button>
        ))}
      </div>
      {profile && <p className="gov30-note">{profile.rps} rps · depth {profile.depth} · {profile.noise} noise · {profile.verify} verify</p>}
    </div>
  );
}

/* 51164 — checkpoint steering */
export function CheckpointPanel() {
  const [cps, setCps] = useState([]);
  const [phase, setPhase] = useState('');
  const add = () => { if (phase.trim()) { setCps((c) => addCheckpoint(c, phase.trim(), '')); setPhase(''); } };
  const reach = (p) => setCps((c) => reachCheckpoint(c, p));
  return (
    <div className="gov30-card">
      <h4>Plan checkpoints</h4>
      <div className="gov30-row">
        <input value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="Phase name" aria-label="Phase name" />
        <button onClick={add}>Add checkpoint</button>
      </div>
      <ul className="gov30-list">
        {cps.map((c) => (
          <li key={c.id}>{c.phase} — <span className={`gov30-status-${c.status}`}>{c.status}</span>{' '}
            {c.status === 'pending' && <button onClick={() => reach(c.phase)}>Simulate reach</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51165 — steering analytics */
export function SteeringAnalyticsView({ commands = [], findings = [] }) {
  const rows = useMemo(() => steeringAnalytics(commands, findings), [commands, findings]);
  return (
    <div className="gov30-card">
      <h4>Steering analytics</h4>
      <table className="gov30-table">
        <thead><tr><th>Command</th><th>Findings</th><th>Top severity</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.commandId}><td>{r.label}</td><td>{r.findingsAttributed}</td><td>{r.topSeverity || '—'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 51166 — emergency re-scope */
export function EmergencyRescope({ plan }) {
  const [asset, setAsset] = useState('');
  const [result, setResult] = useState(null);
  return (
    <div className="gov30-card gov30-danger">
      <h4>Emergency re-scope</h4>
      <div className="gov30-row">
        <input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="Critical asset" aria-label="Critical asset" />
        <button onClick={() => setResult(emergencyRescope(plan || { scope: [], modules: [] }, asset))}>Re-scope now</button>
      </div>
      {result && <p className="gov30-note">{result.note}</p>}
    </div>
  );
}

/* 51167 — steering command aliases */
export function AliasManager() {
  const [aliases, setAliases] = useState({});
  const [key, setKey] = useState('');
  const [cmd, setCmd] = useState('');
  const [probe, setProbe] = useState('');
  return (
    <div className="gov30-card">
      <h4>Command aliases</h4>
      <div className="gov30-row">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="shorthand" aria-label="Shorthand" />
        <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="full command" aria-label="Full command" />
        <button onClick={() => { setAliases((a) => defineAlias(a, key, cmd)); setKey(''); setCmd(''); }}>Save</button>
      </div>
      <div className="gov30-row">
        <input value={probe} onChange={(e) => setProbe(e.target.value)} placeholder="try an alias" aria-label="Try alias" />
        <span className="gov30-note">→ {expandAlias(aliases, probe)}</span>
      </div>
      <div className="gov30-chips">{Object.keys(aliases).map((k) => <span key={k} className="gov30-chip">{k} → {aliases[k]}</span>)}</div>
    </div>
  );
}

/* 51168 — scheduled steering */
export function ScheduledSteering() {
  const [queue, setQueue] = useState([]);
  const [cmd, setCmd] = useState('');
  const [at, setAt] = useState('');
  const due = dueSteering(queue, at || 'z');
  return (
    <div className="gov30-card">
      <h4>Scheduled steering</h4>
      <div className="gov30-row">
        <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="command" aria-label="Command" />
        <input value={at} onChange={(e) => setAt(e.target.value)} placeholder="at (time/phase)" aria-label="Trigger" />
        <button onClick={() => { setQueue((q) => scheduleSteering(q, cmd, at)); setCmd(''); }}>Queue</button>
      </div>
      <ul className="gov30-list">
        {queue.map((q) => <li key={q.id}>{q.command} @ {q.at} — {q.status}{due.includes(q) ? ' (DUE)' : ''}</li>)}
      </ul>
    </div>
  );
}

/* 51169 — steering conflict resolver */
export function ConflictResolver() {
  const [result, setResult] = useState(null);
  const demo = () => setResult(resolveSteeringConflict(
    { author: 'you', command: { scope: ['a.com'], rps: 10 } },
    { author: 'teammate', command: { scope: ['a.com'], rps: 25 } },
  ));
  return (
    <div className="gov30-card">
      <h4>Steering conflict resolver</h4>
      <button onClick={demo}>Run demo merge</button>
      {result && (
        <div className="gov30-note">
          <p>Merged: {JSON.stringify(result.merged)}</p>
          {result.conflicts.map((c, i) => (
            <p key={i}>Conflict on <b>{c.field}</b>: {JSON.stringify(c.fromA)} vs {JSON.stringify(c.fromB)}</p>
          ))}
          {result.needsHuman && <p>Needs human pick.</p>}
        </div>
      )}
    </div>
  );
}

/* 51170 — agent autonomy slider */
export function AutonomySlider({ initial = 50 }) {
  const [env, setEnv] = useState(() => setAutonomy(initial));
  return (
    <div className="gov30-card">
      <h4>Agent autonomy</h4>
      <input type="range" min="0" max="100" value={env.level} onChange={(e) => setEnv(setAutonomy(e.target.value))} aria-label="Autonomy level" />
      <p className="gov30-note">{env.level}% — {env.label} · self-redirect {env.maySelfRedirect ? 'on' : 'off'} · destructive needs asking: {env.mustAskBeforeDestructive ? 'yes' : 'no'}</p>
    </div>
  );
}

/* 51171 — steering notification feed */
export function SteeringFeed({ initial = [] }) {
  const [feed, setFeed] = useState(initial);
  const push = () => setFeed((f) => pushSteeringEvent(f, { kind: 'plan-change', text: `Plan updated (${f.length + 1})`, trigger: 'manual' }));
  return (
    <div className="gov30-card">
      <h4>Steering notification feed</h4>
      <button onClick={push}>Simulate plan change</button>
      <ul className="gov30-list">{feed.map((e) => <li key={e.id}>{e.text} — <span className="gov30-dim">{e.trigger}</span></li>)}</ul>
    </div>
  );
}

/* 51172 — post-steering summary */
export function PostSteeringSummaryDemo() {
  const [summary, setSummary] = useState('');
  return (
    <div className="gov30-card">
      <h4>Post-steering summary</h4>
      <button onClick={() => setSummary(postSteeringSummary({ scope: ['a.com', 'b.com'], mode: 'aggressive' }))}>Summarize last change</button>
      {summary && <p className="gov30-note">{summary}</p>}
    </div>
  );
}

/* Gallery showcasing the steering round-2 suite */
export function SteeringRound2Gallery() {
  const findings = [
    { id: 'f1', title: 'SQLi in login', category: 'injection', severity: 'critical' },
    { id: 'f2', title: 'Reflected XSS', category: 'xss', severity: 'high' },
    { id: 'f3', title: 'Blind SQLi', category: 'injection', severity: 'high' },
  ];
  return (
    <div className="gov30-gallery">
      <h3>Steering round 2 — gallery</h3>
      <DeemphasizeClass />
      <FindingsFeedSteering findings={findings} />
      <PersonaSwitch />
      <CheckpointPanel />
      <SteeringAnalyticsView commands={[{ id: 'c1', label: 'go deep on API' }]} findings={[{ foundAfter: 'c1', severity: 'high' }]} />
      <EmergencyRescope plan={{ scope: ['a.com'], modules: ['recon', 'critical-path'] }} />
      <AliasManager />
      <ScheduledSteering />
      <ConflictResolver />
      <AutonomySlider />
      <SteeringFeed />
      <PostSteeringSummaryDemo />
    </div>
  );
}
