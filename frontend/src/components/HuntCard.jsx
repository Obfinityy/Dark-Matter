// Hunt card — ChatGPT idiom: an assistant message with a progress card.
// Status line ("Hunting <target>…"), expandable event feed, findings stream,
// and Pause/Resume/Stop pill buttons. All stream/control logic unchanged.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pauseHunt, resumeHunt, stopHunt, getHuntCost } from '../lib/api';
import { HuntStreamClient, createSimulatedStream, isDemoMode } from '../lib/huntStream';
import { toast } from '../lib/toast';

const SEVERITY_CLASS = {
  critical: 'sev-critical',
  high: 'sev-high',
  medium: 'sev-medium',
  low: 'sev-low',
};

function statusClass(status) {
  switch (status) {
    case 'running': return 'status-pill status-running';
    case 'paused': return 'status-pill status-paused';
    case 'out_of_credits': return 'status-pill status-paused';
    case 'done': return 'status-pill status-completed';
    case 'stopped': return 'status-pill status-stopped';
    case 'error': return 'status-pill status-failed';
    default: return 'status-pill status-paused';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'running': return 'Running';
    case 'paused': return 'Paused';
    case 'out_of_credits': return 'Out of credits';
    case 'done': return 'Completed';
    case 'stopped': return 'Stopped';
    case 'error': return 'Failed';
    default: return 'Paused';
  }
}

function statusText(status, target) {
  switch (status) {
    case 'running': return `Hunting ${target}…`;
    case 'idle': return 'Starting hunt…';
    case 'paused': return 'Hunt paused';
    case 'out_of_credits': return 'Out of credits — top up, then press Resume.';
    case 'done': return 'Hunt completed';
    case 'stopped': return 'Hunt stopped';
    case 'error': return 'Stream unavailable';
    default: return `Hunt ${status}`;
  }
}

export default function HuntCard({ hunt, onStatusChange }) {
  const [status, setStatus] = useState(hunt.status || 'idle');
  const [cost, setCost] = useState(null);
  const [logs, setLogs] = useState(hunt.logs || []);
  const [findings, setFindings] = useState(hunt.findings || []);
  const [phase, setPhase] = useState(hunt.phase || '');
  const [busy, setBusy] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const logEndRef = useRef(null);

  const updateStatus = (next) => {
    setStatus(next);
    onStatusChange && onStatusChange(hunt.huntId, next);
  };

  useEffect(() => {
    let cancelled = false;
    getHuntCost(hunt.huntId).then((res) => {
      if (!cancelled && res.ok) setCost(res);
    }).catch(() => {});
    const t = setInterval(() => {
      getHuntCost(hunt.huntId).then((res) => {
        if (!cancelled && res.ok) setCost(res);
      }).catch(() => {});
    }, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [hunt.huntId]);

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

  const totalFindings = findings.length;

  return (
    <div className="hunt-card">
      <div className="hunt-statusline">
        <span className={statusClass(status)}><span className="dot" aria-hidden="true" />{statusLabel(status)}</span>
        <span className="hunt-status-text">{statusText(status, hunt.target)}</span>
        {phase && <span className="hunt-target-inline">{phase}</span>}
        {logs.length > 0 && (
          <button
            className="hunt-toggle-feed"
            onClick={() => setShowFeed((v) => !v)}
            aria-expanded={showFeed}
          >
            {showFeed ? 'Hide progress' : 'Show progress'}
          </button>
        )}
      </div>

      {streamError && (
        <div className="hunt-stream-warning">
          Live stream unavailable — control buttons still work, but live output will not update.
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      {showFeed && (
        <div className="hunt-feed" ref={logEndRef} aria-live="polite">
          {logs.length === 0 && <div className="empty-hint">Waiting for hunt output…</div>}
          {logs.map((entry, idx) => (
            <div key={idx} className="log-line">
              <span className="log-prefix" aria-hidden="true">
                {entry.kind === 'tool' ? '▸' : '…'}
              </span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
      )}

      {totalFindings > 0 && (
        <div className="hunt-findings-block">
          <div className="hunt-findings-title">
            Findings
            {counts.critical > 0 && <span className="sev sev-critical">{counts.critical} critical</span>}
            {counts.high > 0 && <span className="sev sev-high">{counts.high} high</span>}
            {counts.medium > 0 && <span className="sev sev-medium">{counts.medium} medium</span>}
            {counts.low > 0 && <span className="sev sev-low">{counts.low} low</span>}
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
      )}

      <div className="hunt-controls">
        {cost && cost.totalUsd > 0 && (
          <span className="hunt-cost" title="Money burnt on this hunt (AWS)">
            🔥 ${cost.totalUsd.toFixed(2)}
          </span>
        )}
        <button
          className="hunt-pill-btn"
          disabled={busy || status !== 'running'}
          onClick={() => runControl('pause', pauseHunt, 'Hunt paused.')}
        >
          ❚❚ Pause
        </button>
        <button
          className="hunt-pill-btn"
          disabled={busy || (status !== 'paused' && status !== 'out_of_credits')}
          onClick={() => runControl('resume', resumeHunt, 'Hunt resumed.')}
        >
          ▶ Resume
        </button>
        <button
          className="hunt-pill-btn danger"
          disabled={busy || status === 'done' || status === 'stopped'}
          onClick={() => runControl('stop', stopHunt, 'Hunt stopped.')}
        >
          ■ Stop
        </button>
        <span className="hunt-id">ID: {hunt.huntId}</span>
      </div>
    </div>
  );
}
