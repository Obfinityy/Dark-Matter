/**
 * SteeringPanel.jsx — wave 29 (ideas 51121–51140): steering control layer.
 * Real working components driving local state via steeringCore.js.
 * No mocks, no decorative animations (owner's zero-animation order).
 */
import React, { useState } from 'react';
import {
  addScopeTarget,
  removeScopeTarget,
  switchTargetProfile,
  injectWordlist,
  setRateCap,
  setIntensity,
  redirectEndpoint,
  pauseModule,
  resumeModule,
  reorderPhases,
  extendTimeBudget,
  wrapUp,
  parseSteeringCommand,
  reorderPriorities,
  applyPreset,
  undoSteering,
  previewSteering,
  estimateImpact,
  logSteering,
  proposeCoSteering,
  resolveCoSteering,
  saveTemplate,
  applyTemplate,
  needsApproval,
  agentPushback,
  INTENSITY_LEVELS,
  STEERING_PRESETS,
  TARGET_PROFILES,
} from './steeringCore.js';

const seedModules = () => [
  { name: 'crawler', enabled: true, paused: false },
  { name: 'apiFuzz', enabled: true, paused: false },
  { name: 'jsAnalysis', enabled: true, paused: false },
  { name: 'sqli', enabled: true, paused: false },
];

/* 51121 — mid-hunt scope addition */
export function ScopeEditor({ scope, onChange }) {
  const [input, setInput] = useState('');
  const [ack, setAck] = useState(null);
  const add = () => {
    const { scope: next, acknowledgement } = addScopeTarget(scope, input);
    onChange(next);
    setAck(acknowledgement);
    setInput('');
  };
  return (
    <div className="steer29-card" data-testid="scope-editor">
      <h4>Scope targets</h4>
      <ul>{scope.map((t) => <li key={t}>{t}</li>)}</ul>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="sub.example.com or /path" aria-label="New scope target" />
      <button onClick={add}>Add to scope</button>
      {ack && <p className="steer29-ack">Agent: {ack.status === 'acknowledged' ? `acknowledged — now testing ${ack.target}` : `${ack.target} already in scope`}</p>}
    </div>
  );
}

/* 51122 — mid-hunt scope removal */
export function ScopeRemover({ scope, inFlight, onChange }) {
  const [result, setResult] = useState(null);
  const remove = (target) => {
    const r = removeScopeTarget(scope, inFlight, target);
    onChange(r.scope, r.remaining);
    setResult(r);
  };
  return (
    <div className="steer29-card" data-testid="scope-remover">
      <h4>Remove from scope</h4>
      {scope.map((t) => (
        <button key={t} onClick={() => remove(t)}>Remove {t}</button>
      ))}
      {result && (
        <p className="steer29-ack">
          Removed. {result.halting.length} in-flight test(s) halting gracefully.
        </p>
      )}
    </div>
  );
}

/* 51123 — target-profile switch */
export function ProfileSwitch({ plan, onChange }) {
  return (
    <div className="steer29-card" data-testid="profile-switch">
      <h4>Target profile</h4>
      {TARGET_PROFILES.map((p) => (
        <button key={p} disabled={plan.profile === p} onClick={() => onChange(switchTargetProfile(plan, p))}>
          {p}{plan.profile === p ? ' (active)' : ''}
        </button>
      ))}
      {plan.retuned && <p className="steer29-ack">Plan retuned live for {plan.profile}.</p>}
    </div>
  );
}

/* 51124 — custom wordlist injection */
export function WordlistInjector({ state, onChange }) {
  const [name, setName] = useState('custom.txt');
  const [text, setText] = useState('');
  const inject = () => {
    const words = text.split(/\s+/).filter(Boolean);
    onChange(injectWordlist(state, { name, words }));
  };
  return (
    <div className="steer29-card" data-testid="wordlist-injector">
      <h4>Inject wordlist mid-hunt</h4>
      <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Wordlist name" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="one word per line" aria-label="Wordlist words" />
      <button onClick={inject}>Inject now</button>
      <p>{(state.wordlists || []).length} wordlist(s) active</p>
    </div>
  );
}

/* 51125 — live request-rate cap */
export function RateCapControl({ state, onChange }) {
  const [rps, setRps] = useState(state.rateCapRps || 10);
  return (
    <div className="steer29-card" data-testid="rate-cap">
      <h4>Request-rate cap: {rps}/s</h4>
      <input type="range" min="1" max="200" value={rps} onChange={(e) => setRps(Number(e.target.value))} aria-label="Requests per second cap" />
      <button onClick={() => onChange(setRateCap(state, rps))}>Apply cap</button>
      {state.throttled && <p className="steer29-ack">Throttling active.</p>}
    </div>
  );
}

/* 51126 — scan-intensity dial */
export function IntensityDial({ state, onChange }) {
  return (
    <div className="steer29-card" data-testid="intensity-dial">
      <h4>Scan intensity</h4>
      {INTENSITY_LEVELS.map((l) => (
        <button key={l} disabled={state.intensity === l} onClick={() => onChange(setIntensity(state, l))}>{l}</button>
      ))}
      <p>{state.payloadsPerCheck || 3} payloads per check</p>
    </div>
  );
}

/* 51127 — endpoint redirect */
export function EndpointRedirect({ queue, onChange }) {
  const [ep, setEp] = useState('');
  return (
    <div className="steer29-card" data-testid="endpoint-redirect">
      <h4>Redirect to endpoint</h4>
      <input value={ep} onChange={(e) => setEp(e.target.value)} placeholder="/api/v2/admin" aria-label="Endpoint" />
      <button onClick={() => { onChange(redirectEndpoint(queue, ep)); setEp(''); }}>Investigate next</button>
      <p>Next up: {queue[0] ? queue[0].endpoint : '—'}</p>
    </div>
  );
}

/* 51128 — module-level pause */
export function ModulePauseList({ modules, onChange }) {
  return (
    <div className="steer29-card" data-testid="module-pause">
      <h4>Modules</h4>
      {modules.map((m) => (
        <div key={m.name}>
          <span>{m.name}{m.paused ? ' (paused)' : ''}{m.enabled === false ? ' (disabled)' : ''}</span>
          {m.paused
            ? <button onClick={() => onChange(resumeModule(modules, m.name))}>Resume</button>
            : <button onClick={() => onChange(pauseModule(modules, m.name))}>Pause</button>}
        </div>
      ))}
    </div>
  );
}

/* 51129 — phase reordering */
export function PhaseReorder({ phases, onChange }) {
  const move = (i, dir) => onChange(reorderPhases(phases, i, i + dir));
  return (
    <div className="steer29-card" data-testid="phase-reorder">
      <h4>Phase order</h4>
      <ol>
        {phases.map((p, i) => (
          <li key={p}>{p}
            <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p} up`}>↑</button>
            <button onClick={() => move(i, 1)} disabled={i === phases.length - 1} aria-label={`Move ${p} down`}>↓</button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* 51130 — time-budget extension */
export function TimeBudgetExtender({ plan, onChange }) {
  const [extra, setExtra] = useState(60);
  return (
    <div className="steer29-card" data-testid="time-budget">
      <h4>Time budget: {plan.timeBudgetMin || 60} min</h4>
      <input type="number" value={extra} min="1" onChange={(e) => setExtra(Number(e.target.value))} aria-label="Extra minutes" />
      <button onClick={() => onChange(extendTimeBudget(plan, extra))}>Grant extra time</button>
    </div>
  );
}

/* 51131 — wrap-up command */
export function WrapUpButton({ plan, onChange }) {
  const [minutes, setMinutes] = useState(10);
  return (
    <div className="steer29-card" data-testid="wrap-up">
      <h4>Wrap up hunt</h4>
      <input type="number" value={minutes} min="1" onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Wrap-up minutes" />
      <button onClick={() => onChange(wrapUp(plan, minutes))}>Finish within {minutes} min</button>
      {plan.mode === 'wrap-up' && <p className="steer29-ack">Condensed final sweep armed.</p>}
    </div>
  );
}

/* 51132 — natural-language steering */
export function NLSteeringInput({ state, onApply }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [pushback, setPushback] = useState(null);
  const send = () => {
    const cmd = parseSteeringCommand(text);
    setParsed(cmd);
    setPushback(agentPushback(state, cmd));
    if (cmd.type !== 'unknown') onApply(cmd);
  };
  return (
    <div className="steer29-card" data-testid="nl-steering">
      <h4>Steer in plain words</h4>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder='e.g. "spend more time on the API"' aria-label="Steering command" />
      <button onClick={send}>Send</button>
      {parsed && <p>Parsed: <code>{parsed.type}</code></p>}
      {pushback && <p className="steer29-warn">{pushback}</p>}
      {needsApproval(parsed) && <p className="steer29-warn">Big change — confirmation required.</p>}
    </div>
  );
}

/* 51133 — drag-and-drop priorities */
export function PriorityList({ priorities, onChange }) {
  const move = (i, dir) => onChange(reorderPriorities(priorities, i, i + dir));
  return (
    <div className="steer29-card" data-testid="priority-list">
      <h4>Hunt priorities</h4>
      <ol>
        {priorities.map((p, i) => (
          <li key={String(p)}>{p}
            <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button onClick={() => move(i, 1)} disabled={i === priorities.length - 1} aria-label="Move down">↓</button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* 51134 — steering presets */
export function PresetButtons({ state, onChange }) {
  return (
    <div className="steer29-card" data-testid="steering-presets">
      <h4>Steering presets</h4>
      {STEERING_PRESETS.map((p) => (
        <button key={p} disabled={state.activePreset === p} onClick={() => onChange(applyPreset(state, p))}>
          {p === 'go-wide' ? 'Go wide' : p === 'go-deep' ? 'Go deep' : 'Be quiet'}
        </button>
      ))}
      {state.activePreset && <p className="steer29-ack">Preset active: {state.activePreset}</p>}
    </div>
  );
}

/* 51135 — undo steering */
export function UndoButton({ history, onUndo }) {
  const [msg, setMsg] = useState('');
  const undo = () => {
    const r = undoSteering(history);
    setMsg(r.restored ? `Undone: ${r.undone.raw || r.undone.type}` : 'Nothing to undo');
    if (r.restored) onUndo(r.state, r.history);
  };
  return (
    <div className="steer29-card" data-testid="undo-steering">
      <button onClick={undo} disabled={!history.length}>Undo last steering</button>
      {msg && <p className="steer29-ack">{msg}</p>}
    </div>
  );
}

/* 51136 + 51137 — steering preview + impact estimate */
export function SteeringPreviewDialog({ state, command, onConfirm, onCancel }) {
  if (!command) return null;
  const preview = previewSteering(state, command);
  const impact = estimateImpact(state, command);
  return (
    <div className="steer29-card steer29-dialog" data-testid="steering-preview">
      <h4>Preview steering change</h4>
      <ul>{preview.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
      <p>Estimated impact: +{impact.minutes} min, +{impact.requests} requests</p>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

/* 51138 — steering history log */
export function SteeringHistory({ history, onLog }) {
  const [by, setBy] = useState('owner');
  const [summary, setSummary] = useState('');
  return (
    <div className="steer29-card" data-testid="steering-history">
      <h4>Steering history</h4>
      <ol>
        {history.map((h) => (
          <li key={h.seq}>#{h.seq} {h.by}: {h.summary || h.command.type}</li>
        ))}
      </ol>
      <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What changed?" aria-label="Change summary" />
      <button onClick={() => { onLog(logSteering(history, { by, command: { type: 'manual' }, summary })); setSummary(''); }}>Log entry</button>
    </div>
  );
}

/* 51139 — co-steering */
export function CoSteeringPanel({ proposals, onChange }) {
  const [by, setBy] = useState('teammate');
  const [text, setText] = useState('');
  const propose = () => {
    onChange(proposeCoSteering(proposals, { by, command: parseSteeringCommand(text) }));
    setText('');
  };
  const resolve = (id, ok) => {
    const r = resolveCoSteering(proposals, id, ok);
    onChange(r.proposals);
  };
  return (
    <div className="steer29-card" data-testid="co-steering">
      <h4>Co-steering proposals</h4>
      {proposals.map((p) => (
        <div key={p.id}>{p.by}: {p.command.type} — {p.status}
          {p.status === 'pending' && (
            <>
              <button onClick={() => resolve(p.id, true)}>Approve</button>
              <button onClick={() => resolve(p.id, false)}>Deny</button>
            </>
          )}
        </div>
      ))}
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Propose a steering change" aria-label="Proposal" />
      <button onClick={propose}>Propose</button>
    </div>
  );
}

/* 51140 — saved steering templates */
export function TemplateManager({ state, templates, onStateChange, onTemplatesChange }) {
  const [name, setName] = useState('');
  return (
    <div className="steer29-card" data-testid="steering-templates">
      <h4>Steering templates</h4>
      {Object.keys(templates).map((t) => (
        <button key={t} onClick={() => onStateChange(applyTemplate(state, templates, t))}>Apply {t}</button>
      ))}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" aria-label="Template name" />
      <button onClick={() => { onTemplatesChange(saveTemplate(templates, name, { intensity: state.intensity, rateCapRps: state.rateCapRps })); setName(''); }}>
        Save current as template
      </button>
    </div>
  );
}

/** Gallery showcasing the steering control layer. */
export function SteeringGallery() {
  const [scope, setScope] = useState(['example.com']);
  const [inFlight, setInFlight] = useState([{ id: 1, target: 'example.com/api' }]);
  const [plan, setPlan] = useState({ profile: 'generic', timeBudgetMin: 60, perPhaseMin: { recon: 20, fuzz: 40 } });
  const [state, setState] = useState({ intensity: 'normal', rateCapRps: 10 });
  const [queue, setQueue] = useState([]);
  const [modules, setModules] = useState(seedModules());
  const [phases, setPhases] = useState(['recon', 'fuzz', 'verify', 'report']);
  const [priorities, setPriorities] = useState(['api', 'auth', 'uploads']);
  const [history, setHistory] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [templates, setTemplates] = useState({});
  const [previewCmd, setPreviewCmd] = useState(null);
  const apply = (cmd) => {
    const before = { ...state };
    let next = { ...state };
    if (cmd.type === 'set-intensity') next = setIntensity(next, cmd.level);
    if (cmd.type === 'preset') next = applyPreset(next, cmd.preset);
    setHistory(logSteering(history, { by: 'owner', command: cmd, summary: cmd.raw }));
    setState(next);
    void before;
  };
  return (
    <div className="steer29-gallery" data-testid="steering-gallery">
      <ScopeEditor scope={scope} onChange={setScope} />
      <ScopeRemover scope={scope} inFlight={inFlight} onChange={(s, r) => { setScope(s); setInFlight(r); }} />
      <ProfileSwitch plan={plan} onChange={setPlan} />
      <WordlistInjector state={state} onChange={setState} />
      <RateCapControl state={state} onChange={setState} />
      <IntensityDial state={state} onChange={setState} />
      <EndpointRedirect queue={queue} onChange={setQueue} />
      <ModulePauseList modules={modules} onChange={setModules} />
      <PhaseReorder phases={phases} onChange={setPhases} />
      <TimeBudgetExtender plan={plan} onChange={setPlan} />
      <WrapUpButton plan={plan} onChange={setPlan} />
      <NLSteeringInput state={state} onApply={(c) => setPreviewCmd(c)} />
      <PriorityList priorities={priorities} onChange={setPriorities} />
      <PresetButtons state={state} onChange={setState} />
      <UndoButton history={history} onUndo={(s, h) => { setState(s); setHistory(h); }} />
      <SteeringPreviewDialog state={state} command={previewCmd} onConfirm={() => { apply(previewCmd); setPreviewCmd(null); }} onCancel={() => setPreviewCmd(null)} />
      <SteeringHistory history={history} onLog={setHistory} />
      <CoSteeringPanel proposals={proposals} onChange={setProposals} />
      <TemplateManager state={state} templates={templates} onStateChange={setState} onTemplatesChange={setTemplates} />
    </div>
  );
}
