// Brain Console — the parent IS the brain (28 Oct 2026, owner order).
//
// Opens when the parent takes over via "Be a Brain" (POST brain-mode
// {mode:'parent'} pauses the AI loop). Shows exactly what the brain
// would have seen each turn, so the parent can decide the next action
// itself:
//   (a) the action index — every recorded action with its hash, time
//       and status; clicking one fetches its output by hash.
//   (b) the live process state — current task, goal, progress, what is
//       done, what is pending, whether the hunt is running — refreshed
//       on open and every 10s while the console is open.
//   (c) an action composer — pick a type, fill the fields, submit;
//       the returned output + hash are shown at once.
//   (d) the live Kali machine — the existing LiveMachine component,
//       embedded inline (same frame poller, same fullscreen overlay).
//   (e) "Hand back to AI" — POST brain-mode {mode:'ai'} resumes the
//       AI loop and closes the console. Closing with ✕ keeps the
//       parent as the brain (the hunt-view badge stays on).
//
// No hunt is created, no budget or model is changed here — the only
// hunt mutation this panel makes is the brain-mode switch itself.
import { useCallback, useEffect, useState } from 'react';
import {
  getHuntActions,
  getHuntActionOutput,
  getHuntProcess,
  setBrainMode,
  submitBrainAction,
  submitBrainActionJson,
} from '../lib/api';
import {
  BRAIN_ACTION_TYPES,
  BRAIN_ACTION_LABELS,
  buildBrainAction,
  shortHash,
  actionLabel,
  processSummary,
  actionStatusClass,
  parseBrainReplyJson,
  validateBrainReply,
  formatBrainError,
} from '../lib/brainActions';
// BRAIN JSON (28 Oct 2026): the canonical reply schema, shown beside
// the JSON composer. Frontend mirror of backend/src/brainReply.schema.json.
import brainReplySchema from '../lib/brainReply.schema.json';
import LiveMachine from './LiveMachine';
import { toast } from '../lib/toast';

// A starter reply for the JSON composer — the shape the schema wants,
// prefilled with the current process values when the console knows them.
function jsonTemplate(proc) {
  return JSON.stringify({
    task: (proc && proc.task) || 'Probe the login page for SQL injection',
    goal: (proc && proc.goal) || 'Find a verified vulnerability on this target',
    progress: (proc && proc.progress) || 'Logged in; first probe sent',
    action: { type: 'shell', command: 'curl -s http://172.17.0.1:3100/ | head -40' },
  }, null, 2);
}

const PROCESS_POLL_MS = 10000;

function fmtTime(at) {
  if (!at) return '—';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return String(at);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function BrainConsole({ huntId, target, onClose, onBrainModeChange }) {
  const [proc, setProc] = useState(null);
  const [procError, setProcError] = useState('');
  const [actions, setActions] = useState([]);
  const [actionsError, setActionsError] = useState('');
  const [actionsLoading, setActionsLoading] = useState(true);
  const [selectedHash, setSelectedHash] = useState('');
  const [selectedOutput, setSelectedOutput] = useState(null);
  const [outputLoading, setOutputLoading] = useState(false);
  const [outputError, setOutputError] = useState('');

  // Composer state — one field set per action type; only the fields
  // for the chosen type are shown and sent.
  const [actionType, setActionType] = useState('shell');
  const [command, setCommand] = useState('');
  const [url, setUrl] = useState('');
  const [selector, setSelector] = useState('');
  const [typeText, setTypeText] = useState('');
  const [recallId, setRecallId] = useState('');
  // OS CONTROL (28 Oct 2026): form fields for the desktop/tool actions.
  const [osWindow, setOsWindow] = useState('');
  const [osKeys, setOsKeys] = useState('');
  const [osText, setOsText] = useState('');
  const [osX, setOsX] = useState('');
  const [osY, setOsY] = useState('');
  const [osControl, setOsControl] = useState('');
  const [osTool, setOsTool] = useState('');
  const [osIndex, setOsIndex] = useState('');
  const [osUrl, setOsUrl] = useState('');
  const [findingTitle, setFindingTitle] = useState('');
  const [findingSeverity, setFindingSeverity] = useState('medium');
  const [findingDetail, setFindingDetail] = useState('');
  // BRAIN JSON (28 Oct 2026): the claim's reproduce command + counter-
  // evidence + confidence — the backend claim gate requires them, so
  // the form asks for them like the JSON reply does (same proof
  // package, same result). confidence_rationale is required by the
  // gate whenever confidence is not high.
  const [findingCommand, setFindingCommand] = useState('');
  const [findingCounterevidence, setFindingCounterevidence] = useState('');
  const [findingConfidence, setFindingConfidence] = useState('medium');
  const [findingConfidenceRationale, setFindingConfidenceRationale] = useState('');
  const [composerError, setComposerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [handBackBusy, setHandBackBusy] = useState(false);

  // BRAIN JSON composer — a textarea for the structured reply, beside
  // the form composer (tabs; the form is never removed). The JSON is
  // canonical: the form is a friendly view of the same reply shape.
  const [composerMode, setComposerMode] = useState('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  const refreshProcess = useCallback(async () => {
    const res = await getHuntProcess(huntId);
    if (res.ok && res.data) {
      setProc(processSummary(res.data));
      setProcError('');
    } else if (!res.ok && res.status !== 404) {
      setProcError(res.error || 'Could not load the live process state.');
    }
    // A 404 here just means the backend predates this lane — the
    // panel stays usable (composer + index) and says so honestly.
    return res;
  }, [huntId]);

  const refreshActions = useCallback(async () => {
    setActionsLoading(true);
    const res = await getHuntActions(huntId);
    if (res.ok && res.data && Array.isArray(res.data.actions)) {
      setActions(res.data.actions);
      setActionsError('');
    } else if (!res.ok && res.status !== 404) {
      setActionsError(res.error || 'Could not load the action index.');
    }
    setActionsLoading(false);
    return res;
  }, [huntId]);

  // Load both on open; poll both every 10s while the console is open.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (cancelled) return;
      refreshProcess();
      refreshActions();
    };
    load();
    const t = setInterval(load, PROCESS_POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [huntId, refreshProcess, refreshActions]);

  const openOutput = async (hash) => {
    setSelectedHash(hash);
    setSelectedOutput(null);
    setOutputError('');
    setOutputLoading(true);
    const res = await getHuntActionOutput(huntId, hash);
    setOutputLoading(false);
    if (res.ok && res.data) {
      setSelectedOutput(res.data);
    } else if (res.status === 404) {
      setOutputError(`No action with hash ${shortHash(hash)} — the backend does not know this hash.`);
    } else {
      setOutputError(res.error || 'Could not load this action’s output.');
    }
  };

  const submitAction = async () => {
    setComposerError('');
    setLastResult(null);
    const fields = {
      command, url, selector, text: typeText, id: recallId,
      title: findingTitle, severity: findingSeverity, detail: findingDetail,
      claimCommand: findingCommand, counterevidence: findingCounterevidence,
      confidence: findingConfidence, confidenceRationale: findingConfidenceRationale,
      window: osWindow, keys: osKeys, text: osText, x: osX, y: osY,
      control: osControl, tool: osTool, index: osIndex,
      // intercept_replay's optional URL override lives in `url` for
      // buildBrainAction; browser_open's `url` is a different field,
      // so the replay override is passed only for that action type.
      ...(actionType === 'intercept_replay' ? { url: osUrl } : {}),
    };
    const built = buildBrainAction(actionType, fields);
    if (built.error) {
      setComposerError(built.error);
      return;
    }
    setSubmitting(true);
    const res = await submitBrainAction(huntId, built.action);
    setSubmitting(false);
    if (res.ok && res.data) {
      // The backend returns {ok, hash, output, entry} — show the
      // output + hash at once, then refresh the index so the new
      // action appears with its real status, and the process view
      // (a task block rides on the action and updates currentTask).
      setLastResult(res.data);
      setCommand(''); setUrl(''); setSelector(''); setTypeText('');
      setOsWindow(''); setOsKeys(''); setOsText(''); setOsX(''); setOsY('');
      setOsControl(''); setOsTool(''); setOsIndex(''); setOsUrl('');
      setRecallId(''); setFindingTitle(''); setFindingDetail('');
      setFindingCommand(''); setFindingCounterevidence('');
      setFindingConfidence('medium'); setFindingConfidenceRationale('');
      refreshActions();
      refreshProcess();
    } else {
      // Rejected while brainMode is 'ai' (or any other refusal):
      // say so plainly instead of pretending the action ran.
      setComposerError(formatBrainError(res));
    }
  };

  // BRAIN JSON: validate the reply against the schema client-side
  // (bad field named), then submit the whole reply to
  // POST /:id/brain-action-json. Same result contract as the form:
  // output + hash shown at once, index + process refreshed. A 400
  // from the server names the bad field in its message; a 409 means
  // the AI is the brain right now.
  const submitJsonAction = async () => {
    setJsonError('');
    setLastResult(null);
    const parsed = parseBrainReplyJson(jsonText);
    if (parsed.error) {
      setJsonError(parsed.error);
      return;
    }
    const validated = validateBrainReply(parsed.reply);
    if (validated.error) {
      setJsonError(validated.error);
      return;
    }
    setSubmitting(true);
    const res = await submitBrainActionJson(huntId, validated.reply);
    setSubmitting(false);
    if (res.ok && res.data) {
      setLastResult(res.data);
      setJsonText('');
      refreshActions();
      refreshProcess();
    } else {
      // A 400 names the bad field (errors[0].field) — show it, not
      // the bare code; a 409 means the AI is the brain right now.
      setJsonError(formatBrainError(res));
    }
  };

  const handBack = async () => {
    setHandBackBusy(true);
    const res = await setBrainMode(huntId, 'ai');
    setHandBackBusy(false);
    if (res.ok) {
      // The hunt's new state rides back to the card via the callback
      // (HuntCard updates its status pill from it).
      onBrainModeChange && onBrainModeChange('ai', res.data && res.data.state);
      toast('Handed back to the AI — the hunt loop resumes.', 'success');
      onClose && onClose();
    } else {
      toast(res.error || 'Could not hand back to the AI.', 'error');
    }
  };

  const summary = proc || processSummary(null);

  return (
    <div className="brain-console" aria-label="Brain Console — you are the brain">
      <div className="brain-console-header">
        <div className="brain-console-title">
          <span className="brain-console-badge" role="status">🧠 You are the brain</span>
          <span className="brain-console-sub">The AI loop is paused — you decide the next action.</span>
        </div>
        <div className="brain-console-header-btns">
          <button
            type="button"
            className="hunt-pill-btn"
            disabled={handBackBusy}
            onClick={handBack}
            title="Hand the hunt back to the AI — the loop resumes from the checkpoint"
          >
            {handBackBusy ? 'Handing back…' : '🤖 Hand back to AI'}
          </button>
          <button
            type="button"
            className="brain-console-close"
            onClick={() => onClose && onClose()}
            title="Close the console — you stay the brain until you hand back"
            aria-label="Close Brain Console"
          >
            ✕
          </button>
        </div>
      </div>

      {/* (b) Live process state */}
      <div className="brain-console-section">
        <div className="brain-console-section-title">
          What is happening now
          {summary.iteration !== null && <span className="brain-console-iter">iteration {summary.iteration}</span>}
          {summary.state && <span className="brain-console-state">{summary.state}</span>}
        </div>
        {procError && <div className="brain-console-error" role="alert">{procError}</div>}
        {!proc && !procError && <div className="brain-console-empty">Loading the live process state…</div>}
        {proc && (
          <div className="brain-process">
            <div className="brain-process-row">
              <span className="brain-process-label">Process status</span>
              <span className={`brain-process-status ${summary.status}`}>
                {summary.status === 'running' && '● Running'}
                {summary.status === 'complete' && '✓ Complete'}
                {summary.status === 'failed' && '✕ Failed'}
                {summary.status === 'idle' && 'Nothing reported yet'}
              </span>
              {summary.status === 'failed' && summary.error && (
                <span className="brain-process-error">{summary.error}</span>
              )}
              {summary.status === 'running' && !summary.task && (
                <span className="brain-console-empty">The hunt loop is live, no task reported yet.</span>
              )}
            </div>
            {summary.activity && (
              <div className="brain-process-row">
                <span className="brain-process-label">Live</span>
                <span>{summary.activity}{summary.in_process ? ' · in process' : ' · idle'}</span>
              </div>
            )}
            {summary.lastAction && (
              <div className="brain-process-row">
                <span className="brain-process-label">Last action</span>
                <span>{summary.lastAction.label || summary.lastAction.tool}{summary.lastAction.hash ? ` (#${summary.lastAction.hash.slice(0, 8)})` : ''}</span>
              </div>
            )}
            {summary.desktop && summary.desktop.activeTitle && (
              <div className="brain-process-row">
                <span className="brain-process-label">Desktop</span>
                <span>Focused: {summary.desktop.activeTitle}{summary.desktop.windows && summary.desktop.windows.length > 1 ? ` — ${summary.desktop.windows.join(' · ')}` : ''}</span>
              </div>
            )}
            {summary.lastScreenshot && (
              <div className="brain-process-row">
                <span className="brain-process-label">Last screenshot</span>
                <span>{summary.lastScreenshot.name}</span>
              </div>
            )}
            <div className="brain-process-row">
              <span className="brain-process-label">Current task</span>
              <span>{summary.task || 'Nothing reported yet'}</span>
            </div>
            <div className="brain-process-row">
              <span className="brain-process-label">Goal</span>
              <span>{summary.goal || 'Nothing reported yet'}</span>
            </div>
            {summary.progress && (
              <div className="brain-process-row">
                <span className="brain-process-label">Progress</span>
                <span>{summary.progress}</span>
              </div>
            )}
            {summary.summary && (
              <div className="brain-process-row">
                <span className="brain-process-label">Summary</span>
                <span>{summary.summary}</span>
              </div>
            )}
            <div className="brain-process-lists">
              <div className="brain-process-list">
                <div className="brain-process-list-title">✓ Done</div>
                {summary.done.length === 0
                  ? <div className="brain-console-empty">Nothing done yet</div>
                  : <ul>{summary.done.map((d, i) => <li key={i}>{d}</li>)}</ul>}
              </div>
              <div className="brain-process-list">
                <div className="brain-process-list-title">○ Pending</div>
                {summary.pending.length === 0
                  ? <div className="brain-console-empty">Nothing pending</div>
                  : <ul>{summary.pending.map((p, i) => <li key={i}>{p}</li>)}</ul>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* (a) Action index */}
      <div className="brain-console-section">
        <div className="brain-console-section-title">
          Action index
          <span className="brain-console-count">{actions.length} action{actions.length === 1 ? '' : 's'}</span>
        </div>
        {actionsError && <div className="brain-console-error" role="alert">{actionsError}</div>}
        {actionsLoading && !actionsError && (
          <div className="brain-console-empty">Loading the action index…</div>
        )}
        {!actionsLoading && actions.length === 0 && !actionsError && (
          <div className="brain-console-empty">No actions recorded yet — submit the first one below.</div>
        )}
        {actions.length > 0 && (
          <ul className="brain-action-list">
            {actions.map((a) => (
              <li key={a.hash || a.n}>
                <button
                  type="button"
                  className={`brain-action-row${selectedHash === a.hash ? ' selected' : ''}`}
                  onClick={() => openOutput(a.hash)}
                  title={`Show the output of action #${a.n} (${a.hash})`}
                >
                  <span className="brain-action-n">#{a.n}</span>
                  <span className="brain-action-hash" title={a.hash}>{shortHash(a.hash)}</span>
                  <span className="brain-action-label">{actionLabel(a)}</span>
                  <span className="brain-action-time">{fmtTime(a.at)}</span>
                  <span className={actionStatusClass(a.status)}>{a.status || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {outputLoading && <div className="brain-console-empty">Loading output…</div>}
        {outputError && <div className="brain-console-error" role="alert">{outputError}</div>}
        {selectedOutput && (
          <div className="brain-action-output">
            <div className="brain-action-output-title">
              Output — <span className="brain-action-hash">{selectedHash}</span>
              {selectedOutput.entry && selectedOutput.entry.tool && (
                <span className="brain-console-count">{selectedOutput.entry.tool}</span>
              )}
            </div>
            <pre>{typeof selectedOutput.output === 'string' ? selectedOutput.output : JSON.stringify(selectedOutput.output ?? selectedOutput.entry ?? '', null, 2)}</pre>
          </div>
        )}
      </div>

      {/* (c) Action composer — form and JSON side by side (tabs).
          The JSON reply is canonical; the form is a friendly view of
          the same reply shape. Both dispatch through the same
          guarded backend action, so the same action gives the same
          result either way. */}
      <div className="brain-console-section">
        <div className="brain-console-section-title">Next action — you decide</div>
        <div className="brain-composer-tabs" role="tablist" aria-label="Action composer">
          <button
            type="button"
            role="tab"
            aria-selected={composerMode === 'form'}
            className={`brain-composer-tab${composerMode === 'form' ? ' active' : ''}`}
            onClick={() => setComposerMode('form')}
          >
            Form
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={composerMode === 'json'}
            className={`brain-composer-tab${composerMode === 'json' ? ' active' : ''}`}
            onClick={() => setComposerMode('json')}
          >
            JSON reply
          </button>
        </div>
        {composerMode === 'form' && (
        <div className="brain-composer">
          <label className="brain-composer-field">
            <span>Action type</span>
            <select
              className="brain-composer-select"
              value={actionType}
              disabled={submitting}
              onChange={(e) => { setActionType(e.target.value); setComposerError(''); }}
            >
              {BRAIN_ACTION_TYPES.map((t) => (
                <option key={t} value={t}>{BRAIN_ACTION_LABELS[t]}</option>
              ))}
            </select>
          </label>
          {actionType === 'shell' && (
            <label className="brain-composer-field brain-composer-wide">
              <span>Command</span>
              <input className="hunt-steer-input" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="e.g. curl -s http://172.17.0.1:3100/ | head -40" disabled={submitting} />
            </label>
          )}
          {actionType === 'browser_open' && (
            <label className="brain-composer-field brain-composer-wide">
              <span>URL</span>
              <input className="hunt-steer-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" disabled={submitting} />
            </label>
          )}
          {(actionType === 'browser_click' || actionType === 'browser_type') && (
            <label className="brain-composer-field brain-composer-wide">
              <span>Element (selector or visible text)</span>
              <input className="hunt-steer-input" value={selector} onChange={(e) => setSelector(e.target.value)} placeholder="e.g. #login-btn or “Login”" disabled={submitting} />
            </label>
          )}
          {actionType === 'browser_type' && (
            <label className="brain-composer-field brain-composer-wide">
              <span>Text to type</span>
              <input className="hunt-steer-input" value={typeText} onChange={(e) => setTypeText(e.target.value)} placeholder="Text to type into the element" disabled={submitting} />
            </label>
          )}
          {(actionType === 'desktop_click' || actionType === 'list_controls' || actionType === 'desktop_click_control') && (
            <label className="brain-composer-field brain-composer-wide">
              <span>Window title{actionType === 'list_controls' ? ' (optional)' : ''}</span>
              <input className="hunt-steer-input" value={osWindow} onChange={(e) => setOsWindow(e.target.value)} placeholder="e.g. Burp Suite" disabled={submitting} />
            </label>
          )}
          {actionType === 'desktop_click_control' && (
            <label className="brain-composer-field brain-composer-wide">
              <span>Control name</span>
              <input className="hunt-steer-input" value={osControl} onChange={(e) => setOsControl(e.target.value)} placeholder="e.g. Repeater" disabled={submitting} />
            </label>
          )}
          {actionType === 'desktop_key' && (
            <>
              <label className="brain-composer-field">
                <span>Keys (e.g. ctrl+l, Return)</span>
                <input className="hunt-steer-input" value={osKeys} onChange={(e) => setOsKeys(e.target.value)} placeholder="ctrl+l" disabled={submitting} />
              </label>
              <label className="brain-composer-field brain-composer-wide">
                <span>Or text to type</span>
                <input className="hunt-steer-input" value={osText} onChange={(e) => setOsText(e.target.value)} placeholder="Words to type into the focused window" disabled={submitting} />
              </label>
            </>
          )}
          {actionType === 'desktop_click_at' && (
            <>
              <label className="brain-composer-field">
                <span>X (from see_screen)</span>
                <input className="hunt-steer-input" type="number" value={osX} onChange={(e) => setOsX(e.target.value)} placeholder="1240" disabled={submitting} />
              </label>
              <label className="brain-composer-field">
                <span>Y (from see_screen)</span>
                <input className="hunt-steer-input" type="number" value={osY} onChange={(e) => setOsY(e.target.value)} placeholder="310" disabled={submitting} />
              </label>
            </>
          )}
          {(actionType === 'desktop_terminal') && (
            <label className="brain-composer-field brain-composer-wide">
              <span>Command (runs visibly in the desktop terminal)</span>
              <input className="hunt-steer-input" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="e.g. nmap -sV 172.17.0.1" disabled={submitting} />
            </label>
          )}
          {(actionType === 'launch_tool' || actionType === 'download_tool') && (
            <label className="brain-composer-field brain-composer-wide">
              <span>Tool name</span>
              <input className="hunt-steer-input" value={osTool} onChange={(e) => setOsTool(e.target.value)} placeholder="e.g. burp" disabled={submitting} />
            </label>
          )}
          {(actionType === 'intercept_read' || actionType === 'intercept_replay') && (
            <>
              <label className="brain-composer-field">
                <span>Capture # (from intercept_list)</span>
                <input className="hunt-steer-input" type="number" min="1" step="1" value={osIndex} onChange={(e) => setOsIndex(e.target.value)} placeholder="3" disabled={submitting} />
              </label>
              {actionType === 'intercept_replay' && (
                <label className="brain-composer-field brain-composer-wide">
                  <span>Replay URL override (optional)</span>
                  <input className="hunt-steer-input" value={osUrl} onChange={(e) => setOsUrl(e.target.value)} placeholder="http://172.17.0.1:3100/…" disabled={submitting} />
                </label>
              )}
            </>
          )}
          {['browser_snapshot', 'screenshot', 'desktop_snapshot', 'desktop_screenshot', 'see_screen', 'proxy_start', 'intercept_list'].includes(actionType) && (
            <p className="brain-composer-hint">No fields needed — submitting runs it and shows the observation.</p>
          )}
          {actionType === 'recall' && (
            <label className="brain-composer-field">
              <span>Action # (from the index above)</span>
              <input className="hunt-steer-input" type="number" min="1" step="1" value={recallId} onChange={(e) => setRecallId(e.target.value)} placeholder="e.g. 42" disabled={submitting} />
            </label>
          )}
          {actionType === 'claim_finding' && (
            <>
              <label className="brain-composer-field brain-composer-wide">
                <span>Finding title</span>
                <input className="hunt-steer-input" value={findingTitle} onChange={(e) => setFindingTitle(e.target.value)} placeholder="e.g. Reflected XSS in the search box" disabled={submitting} />
              </label>
              <label className="brain-composer-field">
                <span>Severity</span>
                <select className="brain-composer-select" value={findingSeverity} onChange={(e) => setFindingSeverity(e.target.value)} disabled={submitting}>
                  {['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="brain-composer-field brain-composer-wide">
                <span>Reproduce command</span>
                <input className="hunt-steer-input" value={findingCommand} onChange={(e) => setFindingCommand(e.target.value)} placeholder="e.g. curl -s 'http://…/search?q=&lt;script&gt;'" disabled={submitting} />
              </label>
              <label className="brain-composer-field brain-composer-wide">
                <span>Evidence / detail</span>
                <textarea className="hunt-steer-input brain-composer-textarea" value={findingDetail} onChange={(e) => setFindingDetail(e.target.value)} placeholder="The exact output that proves it — a real excerpt of the response, not a summary" rows={3} disabled={submitting} />
              </label>
              <label className="brain-composer-field brain-composer-wide">
                <span>Counter-evidence</span>
                <textarea className="hunt-steer-input brain-composer-textarea" value={findingCounterevidence} onChange={(e) => setFindingCounterevidence(e.target.value)} placeholder="What you checked that could have disproved it — the control/baseline result beside the trigger" rows={2} disabled={submitting} />
              </label>
              <label className="brain-composer-field">
                <span>Confidence</span>
                <select className="brain-composer-select" value={findingConfidence} onChange={(e) => setFindingConfidence(e.target.value)} disabled={submitting}>
                  {['high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {findingConfidence !== 'high' && (
                <label className="brain-composer-field brain-composer-wide">
                  <span>Why not high — confidence rationale</span>
                  <input className="hunt-steer-input" value={findingConfidenceRationale} onChange={(e) => setFindingConfidenceRationale(e.target.value)} placeholder="What is still uncertain about this claim" disabled={submitting} />
                </label>
              )}
            </>
          )}
          <button type="button" className="hunt-pill-btn" disabled={submitting} onClick={submitAction}>
            {submitting ? 'Sending…' : 'Submit action'}
          </button>
        </div>
        )}
        {composerMode === 'json' && (
        <div className="brain-json">
          <div className="brain-json-main">
            <label className="brain-composer-field brain-composer-wide">
              <span>JSON reply — task, goal, progress + one action</span>
              <textarea
                className="hunt-steer-input brain-composer-textarea brain-json-textarea"
                value={jsonText}
                onChange={(e) => { setJsonText(e.target.value); setJsonError(''); }}
                placeholder='{"task": "…", "goal": "…", "progress": "…", "action": {"type": "shell", "action": "shell", "command": "…"}}'
                rows={10}
                disabled={submitting}
                spellCheck={false}
              />
            </label>
            <div className="brain-json-actions">
              <button type="button" className="hunt-pill-btn" disabled={submitting} onClick={submitJsonAction}>
                {submitting ? 'Sending…' : 'Submit JSON reply'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={submitting}
                onClick={() => { setJsonText(jsonTemplate(proc)); setJsonError(''); }}
                title="Fill the textarea with a valid example reply, using the current task/goal/progress when known"
              >
                Fill template
              </button>
            </div>
            {jsonError && <div className="brain-console-error" role="alert">{jsonError}</div>}
          </div>
          <details className="brain-schema">
            <summary>Reply schema — what the JSON must contain</summary>
            <p className="brain-schema-note">
              task, goal and progress are required (one line each, titles only — never full output).
              action.type is one of shell, browser_open, click, type, recall, claim_finding;
              click/type are the short names for browser_click/browser_type.
              recall is optional: {"{"}"hash": "…"{"}"} or {"{"}"id": 42{"}"} — fetched before acting.
              Mirror of backend/src/brainReply.schema.json.
            </p>
            <pre>{JSON.stringify(brainReplySchema, null, 2)}</pre>
          </details>
        </div>
        )}
        {composerMode === 'form' && composerError && <div className="brain-console-error" role="alert">{composerError}</div>}
        {lastResult && (
          <div className="brain-action-output">
            <div className="brain-action-output-title">
              Result — <span className="brain-action-hash">{lastResult.hash || 'no hash returned'}</span>
            </div>
            <pre>{typeof lastResult.output === 'string' ? lastResult.output : JSON.stringify(lastResult.output ?? lastResult.entry ?? '', null, 2)}</pre>
          </div>
        )}
      </div>

      {/* (d) Live machine — the existing LiveMachine component, embedded. */}
      <div className="brain-console-section">
        <div className="brain-console-section-title">Live machine — what the Kali is doing</div>
        <LiveMachine huntId={huntId} target={target} embedded />
      </div>
    </div>
  );
}
