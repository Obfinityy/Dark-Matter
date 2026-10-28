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
} from '../lib/api';
import {
  BRAIN_ACTION_TYPES,
  BRAIN_ACTION_LABELS,
  buildBrainAction,
  shortHash,
  actionLabel,
  processSummary,
  actionStatusClass,
} from '../lib/brainActions';
import LiveMachine from './LiveMachine';
import { toast } from '../lib/toast';

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
  const [findingTitle, setFindingTitle] = useState('');
  const [findingSeverity, setFindingSeverity] = useState('medium');
  const [findingDetail, setFindingDetail] = useState('');
  const [composerError, setComposerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [handBackBusy, setHandBackBusy] = useState(false);

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
    const res = await getHuntActions(huntId);
    if (res.ok && res.data && Array.isArray(res.data.actions)) {
      setActions(res.data.actions);
      setActionsError('');
    } else if (!res.ok && res.status !== 404) {
      setActionsError(res.error || 'Could not load the action index.');
    }
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
      // action appears with its real status.
      setLastResult(res.data);
      setCommand(''); setUrl(''); setSelector(''); setTypeText('');
      setRecallId(''); setFindingTitle(''); setFindingDetail('');
      refreshActions();
    } else {
      // Rejected while brainMode is 'ai' (or any other refusal):
      // say so plainly instead of pretending the action ran.
      setComposerError(res.error || 'The backend did not accept this action.');
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
              <span className="brain-process-label">Running</span>
              <span>{summary.running ? 'Yes — the hunt loop is live' : 'No — paused while you are the brain'}</span>
            </div>
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
        {actions.length === 0 && !actionsError && (
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

      {/* (c) Action composer */}
      <div className="brain-console-section">
        <div className="brain-console-section-title">Next action — you decide</div>
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
          {actionType === 'recall' && (
            <label className="brain-composer-field">
              <span>Action # (from the index above)</span>
              <input className="hunt-steer-input" type="number" min="0" step="1" value={recallId} onChange={(e) => setRecallId(e.target.value)} placeholder="e.g. 42" disabled={submitting} />
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
                <span>Evidence / detail</span>
                <textarea className="hunt-steer-input brain-composer-textarea" value={findingDetail} onChange={(e) => setFindingDetail(e.target.value)} placeholder="What you saw, the payload, the response…" rows={3} disabled={submitting} />
              </label>
            </>
          )}
          <button type="button" className="hunt-pill-btn" disabled={submitting} onClick={submitAction}>
            {submitting ? 'Sending…' : 'Submit action'}
          </button>
        </div>
        {composerError && <div className="brain-console-error" role="alert">{composerError}</div>}
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
