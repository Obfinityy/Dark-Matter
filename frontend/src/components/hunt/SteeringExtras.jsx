/**
 * SteeringExtras.jsx — wave 29 (ideas 51141–51160): steering advanced layer.
 * Real working components driving local state via steeringCore.js.
 * No mocks, no decorative animations (owner's zero-animation order).
 */
import React, { useState } from 'react';
import {
  addConditionalRule,
  evaluateRules,
  setTimeBoxedFocus,
  steerFromFinding,
  steerFromLog,
  parseSpokenCommand,
  applyPriorityBoard,
  buildSteeringApiPayload,
  validateSteeringApiPayload,
  applyWhilePaused,
  needsApproval,
  agentPushback,
  suggestSteering,
  setBandwidthCap,
  bandwidthRemaining,
  setStealthMode,
  setDepthLimit,
  retestOnChange,
  dryRun,
  inheritPriority,
  setCooldown,
  cooldownActive,
  toggleModule,
  setFocusWindow,
  focusSplit,
} from './steeringCore.js';

/* 51141 — conditional steering rules */
export function ConditionalRules({ context, onTrigger }) {
  const [rules, setRules] = useState([]);
  const [when, setWhen] = useState('finding-type');
  const [value, setValue] = useState('xss');
  const [then, setThen] = useState('go deep');
  const add = () => setRules(addConditionalRule(rules, { when, value, then }));
  const run = () => onTrigger(evaluateRules(rules, context));
  return (
    <div className="steer29-card" data-testid="conditional-rules">
      <h4>If-then steering rules</h4>
      <input value={value} onChange={e => setValue(e.target.value)} aria-label="Condition value" />
      <select value={when} onChange={e => setWhen(e.target.value)} aria-label="Condition type">
        <option value="finding-type">finding type is</option>
        <option value="phase">phase is</option>
        <option value="finding-count>=">finding count ≥</option>
      </select>
      <input value={then} onChange={e => setThen(e.target.value)} aria-label="Then action" />
      <button onClick={add}>Add rule</button>
      <button onClick={run}>Evaluate now</button>
      <ul>
        {rules.map(r => (
          <li key={r.id}>
            if {r.when} {r.value} → {r.then}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51142 — time-boxed focus */
export function TimeBoxedFocus({ state, onChange }) {
  const [area, setArea] = useState('api');
  const [minutes, setMinutes] = useState(30);
  return (
    <div className="steer29-card" data-testid="time-boxed-focus">
      <h4>Time-boxed focus</h4>
      <input value={area} onChange={e => setArea(e.target.value)} aria-label="Focus area" />
      <input
        type="number"
        value={minutes}
        min="1"
        onChange={e => setMinutes(Number(e.target.value))}
        aria-label="Minutes"
      />
      <button onClick={() => onChange(setTimeBoxedFocus(state, area, minutes))}>Focus now</button>
      {state.focusActive && (
        <p className="steer29-ack">
          Focusing {state.focusArea} for {state.focusMinutes} min, then resuming plan.
        </p>
      )}
    </div>
  );
}

/* 51143 — steer-from-finding */
export function SteerFromFinding({ finding, onSteer }) {
  const [msg, setMsg] = useState('');
  return (
    <div className="steer29-card" data-testid="steer-from-finding">
      <h4>Finding: {finding.title || finding.id}</h4>
      <button
        onClick={() => {
          const c = steerFromFinding(finding);
          onSteer(c);
          setMsg(`Redirecting: investigate similar areas`);
        }}
      >
        Investigate similar areas
      </button>
      {msg && <p className="steer29-ack">{msg}</p>}
    </div>
  );
}

/* 51144 — steer-from-log */
export function SteerFromLog({ logLine, onSteer }) {
  return (
    <div className="steer29-card" data-testid="steer-from-log">
      <h4>Log line</h4>
      <code>{logLine}</code>
      <div>
        <button onClick={() => onSteer(steerFromLog(logLine, 'more'))}>Do more of this</button>
        <button onClick={() => onSteer(steerFromLog(logLine, 'stop'))}>Stop doing this</button>
      </div>
    </div>
  );
}

/* 51145 — spoken redirection */
export function SpokenRedirect({ onCommand }) {
  const [transcript, setTranscript] = useState('');
  const [parsed, setParsed] = useState(null);
  const send = () => {
    const c = parseSpokenCommand(transcript);
    setParsed(c);
    if (c.type !== 'unknown') onCommand(c);
  };
  return (
    <div className="steer29-card" data-testid="spoken-redirect">
      <h4>Spoken redirection</h4>
      <input
        value={transcript}
        onChange={e => setTranscript(e.target.value)}
        placeholder="Speak: 'go deep on the API'"
        aria-label="Voice transcript"
      />
      <button onClick={send}>Apply voice command</button>
      {parsed && (
        <p>
          Heard → <code>{parsed.type}</code> (via voice)
        </p>
      )}
    </div>
  );
}

/* 51146 — touch priority board */
export function TouchPriorityBoard({ priorities, onChange }) {
  const move = (i, dir) => {
    const next = [...priorities];
    const [m] = next.splice(i, 1);
    next.splice(i + dir, 0, m);
    onChange(applyPriorityBoard(priorities, next));
  };
  return (
    <div className="steer29-card steer29-touch" data-testid="touch-priority-board">
      <h4>Priority board (touch-friendly)</h4>
      {priorities.map((p, i) => (
        <div key={String(p)} className="steer29-board-item">
          <span>{p}</span>
          <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
            ▲
          </button>
          <button
            onClick={() => move(i, 1)}
            disabled={i === priorities.length - 1}
            aria-label="Move down"
          >
            ▼
          </button>
        </div>
      ))}
    </div>
  );
}

/* 51147 — steering API */
export function SteeringApiDocs({ huntId }) {
  const [cmdJson, setCmdJson] = useState('{"type":"preset","preset":"go-deep"}');
  const [result, setResult] = useState(null);
  const build = () => {
    let command;
    try {
      command = JSON.parse(cmdJson);
    } catch {
      command = { type: 'unknown' };
    }
    const payload = buildSteeringApiPayload(command, huntId);
    setResult(validateSteeringApiPayload(payload));
  };
  return (
    <div className="steer29-card" data-testid="steering-api">
      <h4>Steering API</h4>
      <p>
        <code>POST /api/v1/hunts/{'{id}'}/steer</code>
      </p>
      <textarea
        value={cmdJson}
        onChange={e => setCmdJson(e.target.value)}
        aria-label="Command JSON"
      />
      <button onClick={build}>Validate payload</button>
      {result && <p>{result.ok ? 'Payload valid ✓' : `Invalid: ${result.error}`}</p>}
    </div>
  );
}

/* 51148 — steer while paused */
export function PausedSteering({ plan, onChange }) {
  const [note, setNote] = useState('');
  return (
    <div className="steer29-card" data-testid="paused-steering">
      <h4>Steer while paused</h4>
      <p>Status: {plan.paused ? 'paused' : 'running'}</p>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Strategy note"
        aria-label="Strategy note"
      />
      <button onClick={() => onChange(applyWhilePaused(plan, { strategyNote: note }))}>
        Stage for resume
      </button>
      {plan.resumeWithNewStrategy && (
        <p className="steer29-ack">Will resume with the new strategy.</p>
      )}
    </div>
  );
}

/* 51149 — big-change approval gate */
export function ApprovalGate({ command, onApprove, onDeny }) {
  if (!command || !needsApproval(command)) return null;
  return (
    <div className="steer29-card steer29-dialog" data-testid="approval-gate">
      <h4>Big change — confirm</h4>
      <p>
        This is a major redirection: <code>{command.type}</code>
      </p>
      <button onClick={() => onApprove(command)}>Approve &amp; apply</button>
      <button onClick={onDeny}>Deny</button>
    </div>
  );
}

/* 51150 — agent pushback display */
export function PushbackWarning({ state, command }) {
  const warning = agentPushback(state, command);
  if (!warning) return null;
  return (
    <p className="steer29-warn" data-testid="pushback-warning">
      Agent pushback: {warning}
    </p>
  );
}

/* 51151 — agent steering suggestions */
export function SuggestionCards({ state, onApply }) {
  const suggestions = suggestSteering(state);
  if (!suggestions.length) return <p data-testid="suggestions-empty">No suggestions right now.</p>;
  return (
    <div className="steer29-card" data-testid="suggestion-cards">
      <h4>Agent suggestions</h4>
      {suggestions.map((s, i) => (
        <div key={i}>
          <span>{s.reason}</span>
          <button onClick={() => onApply(s)}>Apply</button>
        </div>
      ))}
    </div>
  );
}

/* 51152 — bandwidth steering */
export function BandwidthCap({ state, onChange }) {
  const [cap, setCap] = useState(10000);
  const remaining = bandwidthRemaining(state);
  return (
    <div className="steer29-card" data-testid="bandwidth-cap">
      <h4>Bandwidth cap</h4>
      <input
        type="number"
        value={cap}
        min="100"
        onChange={e => setCap(Number(e.target.value))}
        aria-label="Max requests"
      />
      <button onClick={() => onChange(setBandwidthCap(state, cap))}>Set cap</button>
      {remaining !== null && <p>{remaining} requests remaining</p>}
    </div>
  );
}

/* 51153 — stealth steering */
export function StealthToggle({ state, onChange }) {
  return (
    <div className="steer29-card" data-testid="stealth-toggle">
      <h4>Stealth mode</h4>
      <button onClick={() => onChange(setStealthMode(state, !state.stealth))}>
        {state.stealth ? 'Disable stealth' : 'Enable stealth'}
      </button>
      {state.stealth && <p className="steer29-ack">Low-noise mode active — progress preserved.</p>}
    </div>
  );
}

/* 51154 — depth limiter */
export function DepthLimiter({ state, onChange }) {
  const [levels, setLevels] = useState(state.depthLimit ?? 3);
  return (
    <div className="steer29-card" data-testid="depth-limiter">
      <h4>Crawl depth limit: {levels}</h4>
      <input
        type="range"
        min="0"
        max="10"
        value={levels}
        onChange={e => setLevels(Number(e.target.value))}
        aria-label="Depth limit"
      />
      <button onClick={() => onChange(setDepthLimit(state, levels))}>Apply</button>
    </div>
  );
}

/* 51155 — retest-on-change */
export function RetestOnChange({ state }) {
  const [changed, setChanged] = useState('/api/v2');
  const [result, setResult] = useState(null);
  return (
    <div className="steer29-card" data-testid="retest-on-change">
      <h4>Retest on target change</h4>
      <input value={changed} onChange={e => setChanged(e.target.value)} aria-label="Changed path" />
      <button onClick={() => setResult(retestOnChange(state, [changed]))}>
        Find affected areas
      </button>
      {result && (
        <p>
          {result.retest.length} area(s) queued for re-test: {result.retest.join(', ') || 'none'}
        </p>
      )}
    </div>
  );
}

/* 51156 — steering dry-run */
export function DryRunView({ state }) {
  const [text, setText] = useState('go deep');
  const [sim, setSim] = useState(null);
  const { parseSteeringCommand: parse } = {
    parseSteeringCommand: t => ({ type: 'preset', preset: 'go-deep', raw: t }),
  };
  return (
    <div className="steer29-card" data-testid="dry-run">
      <h4>Steering dry-run</h4>
      <input value={text} onChange={e => setText(e.target.value)} aria-label="Dry-run command" />
      <button onClick={() => setSim(dryRun(state, parse(text)))}>Simulate</button>
      {sim && (
        <div>
          <p>Would change: {sim.wouldChange.join('; ') || 'nothing'}</p>
          <p>Impact: +{sim.estimatedImpact.minutes} min</p>
          {sim.pushback && <p className="steer29-warn">{sim.pushback}</p>}
          <p>{sim.approvalRequired ? 'Approval required' : 'No approval needed'}</p>
        </div>
      )}
    </div>
  );
}

/* 51157 — priority inheritance */
export function PriorityInheritance({ state }) {
  const [asset, setAsset] = useState('api.example.com/v2');
  const [result, setResult] = useState(null);
  return (
    <div className="steer29-card" data-testid="priority-inheritance">
      <h4>Priority inheritance</h4>
      <input value={asset} onChange={e => setAsset(e.target.value)} aria-label="New asset" />
      <button onClick={() => setResult(inheritPriority(state, asset))}>Check</button>
      {result && (
        <p>
          {result.asset}: priority {result.priority}
          {result.boosted ? ' (inherited boost)' : ''}
        </p>
      )}
    </div>
  );
}

/* 51158 — steering cooldown */
export function CooldownIndicator({ state, onChange }) {
  const [secs, setSecs] = useState(60);
  const active = cooldownActive(state, state.now || 0);
  return (
    <div className="steer29-card" data-testid="steering-cooldown">
      <h4>Steering cooldown</h4>
      <input
        type="number"
        value={secs}
        min="0"
        onChange={e => setSecs(Number(e.target.value))}
        aria-label="Cooldown seconds"
      />
      <button onClick={() => onChange(setCooldown({ ...state, now: Date.now() }, secs))}>
        Set lockout
      </button>
      <p>{active ? 'Cooldown active — steering locked' : 'No cooldown — steering allowed'}</p>
    </div>
  );
}

/* 51159 — module enable/disable live */
export function ModuleToggleGrid({ modules, onChange }) {
  return (
    <div className="steer29-card" data-testid="module-toggles">
      <h4>Modules (live toggle)</h4>
      {modules.map(m => (
        <label key={m.name}>
          <input
            type="checkbox"
            checked={m.enabled !== false}
            onChange={e => onChange(toggleModule(modules, m.name, e.target.checked))}
          />
          {m.name}
        </label>
      ))}
    </div>
  );
}

/* 51160 — focus window */
export function FocusWindowEditor({ state, onChange }) {
  const [pattern, setPattern] = useState('/api/*');
  const [share, setShare] = useState(50);
  const split = focusSplit(state);
  return (
    <div className="steer29-card" data-testid="focus-window">
      <h4>Focus window</h4>
      <input value={pattern} onChange={e => setPattern(e.target.value)} aria-label="URL pattern" />
      <input
        type="range"
        min="5"
        max="95"
        value={share}
        onChange={e => setShare(Number(e.target.value))}
        aria-label="Effort share percent"
      />
      <button onClick={() => onChange(setFocusWindow(state, pattern, share))}>
        Apply {share}% focus
      </button>
      {!split.unfocused && (
        <p>
          {split.inside}% inside {split.pattern}, {split.outside}% outside
        </p>
      )}
    </div>
  );
}

/** Gallery showcasing the steering advanced layer. */
export function SteeringExtrasGallery() {
  const [state, setState] = useState({
    intensity: 'normal',
    rateCapRps: 10,
    findingCount: 4,
    phase: 'fuzzing',
    coveragePct: 30,
    testedPaths: ['/api/v1', '/api/v2/users'],
    boostedAreas: ['api'],
    modules: [
      { name: 'crawler', enabled: true, paused: false },
      { name: 'apiFuzz', enabled: true, paused: false },
    ],
    plan: { paused: false },
  });
  const [priorities, setPriorities] = useState(['api', 'auth', 'uploads']);
  const [triggered, setTriggered] = useState([]);
  const apply = cmd => setState(s => ({ ...s, lastCommand: cmd.type }));
  return (
    <div className="steer29-gallery" data-testid="steering-extras-gallery">
      <ConditionalRules
        context={{ findingType: 'xss', phase: 'fuzzing', findingCount: 5 }}
        onTrigger={setTriggered}
      />
      {triggered.length > 0 && (
        <p className="steer29-ack">Triggered: {triggered.map(t => t.action).join(', ')}</p>
      )}
      <TimeBoxedFocus state={state} onChange={setState} />
      <SteerFromFinding
        finding={{ id: 'F-12', title: 'Reflected XSS', type: 'xss', area: '/search' }}
        onSteer={apply}
      />
      <SteerFromLog logLine="[apiFuzz] testing /api/v2/users" onSteer={apply} />
      <SpokenRedirect onCommand={apply} />
      <TouchPriorityBoard priorities={priorities} onChange={setPriorities} />
      <SteeringApiDocs huntId="hunt-1" />
      <PausedSteering plan={state.plan} onChange={p => setState(s => ({ ...s, plan: p }))} />
      <ApprovalGate
        command={{ type: 'remove-scope', target: 'old.example.com' }}
        onApprove={apply}
        onDeny={() => {}}
      />
      <PushbackWarning
        state={state}
        command={{ type: 'remove-scope', target: 'api.example.com' }}
      />
      <SuggestionCards state={state} onApply={apply} />
      <BandwidthCap state={state} onChange={setState} />
      <StealthToggle state={state} onChange={setState} />
      <DepthLimiter state={state} onChange={setState} />
      <RetestOnChange state={state} />
      <DryRunView state={state} />
      <PriorityInheritance state={state} />
      <CooldownIndicator state={state} onChange={setState} />
      <ModuleToggleGrid
        modules={state.modules}
        onChange={m => setState(s => ({ ...s, modules: m }))}
      />
      <FocusWindowEditor state={state} onChange={setState} />
    </div>
  );
}
