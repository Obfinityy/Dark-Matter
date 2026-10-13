import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pauseHunt, resumeHunt, stopHunt } from '../lib/api';
import { HuntStreamClient, createSimulatedStream, isDemoMode } from '../lib/huntStream';
import { toast } from '../lib/toast';

const STATUS_LABELS = {
  running: 'Running',
  paused: 'Paused',
  done: 'Completed',
  stopped: 'Stopped',
  idle: 'Starting…',
  error: 'Stream unavailable',
};

const SEVERITY_CLASS = {
  critical: 'sev-critical',
  high: 'sev-high',
  medium: 'sev-medium',
  low: 'sev-low',
};

function statusClass(status) {
  switch (status) {
    case 'running': return 'hunt-running';
    case 'paused': return 'hunt-paused';
    case 'done': return 'hunt-done';
    case 'stopped': return 'hunt-stopped';
    default: return 'hunt-idle';
  }
}

export default function HuntCard({ hunt, onStatusChange }) {
  const [status, setStatus] = useState(hunt.status || 'idle');
  const [logs, setLogs] = useState(hunt.logs || []);
  const [findings, setFindings] = useState(hunt.findings || []);
  const [phase, setPhase] = useState(hunt.phase || '');
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const logEndRef = useRef(null);

  const updateStatus = (next) => {
    setStatus(next);
    onStatusChange && onStatusChange(hunt.huntId, next);
  };

  useEffect(() => {
    const handlers = {
      onEvent: (type, payload) => {
        if (type === 'thinking') {
          setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: payload.text || payload.message || '' }]);
        } else if (type === 'tool_call') {
          const line = payload.output
            ? `${payload.tool} → output received`
            : `${payload.tool}${payload.args ? ` ${payload.args}` : ''}`;
          setLogs((prev) => [...prev.slice(-99), { kind: 'tool', text: line }]);
        } else if (type === 'finding') {
          setFindings((prev) => [
            ...prev,
            {
              title: payload.title || 'Finding',
              severity: String(payload.severity || 'low').toLowerCase(),
              detail: payload.detail || '',
            },
          ]);
        } else if (type === 'status') {
          if (payload.status) updateStatus(payload.status);
          if (payload.phase) setPhase(payload.phase);
        } else if (type === 'done') {
          updateStatus('done');
          if (payload.summary) {
            setLogs((prev) => [...prev.slice(-99), { kind: 'thinking', text: payload.summary }]);
          }
        }
      },
      onError: () => {
        setStreamError(true);
        setStatus((s) => (s === 'idle' ? 'error' : s));
      },
      onClose: () => {},
    };

    let stream;
    try {
      stream = isDemoMode()
        ? createSimulatedStream(hunt.huntId, handlers)
        : new HuntStreamClient(hunt.huntId, handlers);
      stream.connect();
    } catch (err) {
      setStreamError(true);
      setStatus('error');
    }
    return () => stream && stream.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hunt.huntId]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach((f) => {
      if (c[f.severity] !== undefined) c[f.severity] += 1;
      else c.low += 1;
    });
    return c;
  }, [findings]);

  async function runControl(action, fn, successMsg) {
    setBusy(true);
    const res = await fn(hunt.huntId);
    setBusy(false);
    if (res.ok) {
      toast(successMsg, 'success');
      if (action === 'pause') updateStatus('paused');
      if (action === 'resume') updateStatus('running');
      if (action === 'stop') updateStatus('stopped');
    } else {
      toast(res.error || 'The backend did not accept the request.', 'error');
    }
  }

  return (
    <div className="hunt-card">
      <div className="hunt-header">
        <span className={`hunt-status ${statusClass(status)}`} aria-label={`Hunt status: ${STATUS_LABELS[status] || status}`}>
          <span className="status-dot" aria-hidden="true" />
          {STATUS_LABELS[status] || status}
        </span>
        <div className="hunt-title">
          <strong>Hunt</strong>
          <span className="hunt-target" title={hunt.target}>{hunt.target}</span>
        </div>
        {phase && <span className="hunt-phase">{phase}</span>}
      </div>

      {streamError && (
        <div className="hunt-stream-warning">
          Live stream unavailable — control buttons still work, but live output will not update.
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      <div className="hunt-body">
        <div className="hunt-log" ref={logEndRef} aria-live="polite">
          {logs.length === 0 && <div className="empty-hint">Waiting for hunt output…</div>}
          {logs.map((entry, idx) => (
            <div key={idx} className={`log-line log-${entry.kind}`}>
              <span className="log-prefix" aria-hidden="true">
                {entry.kind === 'tool' ? '▸' : '…'}
              </span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>

        <div className="hunt-findings">
          <div className="findings-header">
            Findings
            <span className="findings-counts">
              {counts.critical > 0 && <span className="sev sev-critical">{counts.critical} critical</span>}
              {counts.high > 0 && <span className="sev sev-high">{counts.high} high</span>}
              {counts.medium > 0 && <span className="sev sev-medium">{counts.medium} medium</span>}
              {counts.low > 0 && <span className="sev sev-low">{counts.low} low</span>}
              {findings.length === 0 && <span className="empty-hint">none yet</span>}
            </span>
          </div>
          <ul className="findings-list">
            {findings.map((f, idx) => (
              <li key={idx} className={`finding ${SEVERITY_CLASS[f.severity] || 'sev-low'}`}>
                <span className="finding-sev">{f.severity}</span>
                <span className="finding-title">{f.title}</span>
                {f.detail && <div className="finding-detail">{f.detail}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="hunt-controls">
        <button
          className="btn btn-ghost"
          disabled={busy || status !== 'running'}
          onClick={() => runControl('pause', pauseHunt, 'Hunt paused.')}
        >
          ⏸ Pause
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy || status !== 'paused'}
          onClick={() => runControl('resume', resumeHunt, 'Hunt resumed.')}
        >
          ▶ Resume
        </button>
        <button
          className="btn btn-danger"
          disabled={busy || status === 'done' || status === 'stopped'}
          onClick={() => runControl('stop', stopHunt, 'Hunt stopped.')}
        >
          ⏹ Stop
        </button>
        <span className="hunt-id">ID: {hunt.huntId}</span>
      </div>
    </div>
  );
}
