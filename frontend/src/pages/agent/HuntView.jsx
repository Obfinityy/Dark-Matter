/**
 * HuntView — the live hunt screen.
 *
 * Layout (infinity-level, never a generic chatbot):
 *   ┌────────────────────────────────────────────────────────┐
 *   │ Fingerprint card (target, phase, steps, scope)          │
 *   ├──────────────────────────────┬─────────────────────────┤
 *   │ Hacker terminal (live)       │ Tabs: Findings │ Diary  │
 *   │                              │       │ Attack surface   │
 *   ├──────────────────────────────┴─────────────────────────┤
 *   │ Controls: pause / resume / cancel · ask the agent ·     │
 *   │           report export (Markdown + PDF)                │
 *   └────────────────────────────────────────────────────────┘
 *
 * State rehydrates from GET /jobs/:id on mount (refresh-safe); live updates
 * arrive over SSE. Pause persists the exact checkpoint — resume continues
 * from the identical state.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Pause, Play, Square, Send, Loader2, AlertTriangle,
  Bug, BookOpen, Map as MapIcon, FileDown, ChevronLeft, Sparkles
} from 'lucide-react';
import {
  getJobState, pauseJob, continueJob, cancelJob, askJob,
  getJobFindings, getJobDiary, getJobAttackSurface, getJobVulnerabilityReport,
  subscribeToJobEvents
} from '../../services/api';
import { HackerTerminal } from '../../components/agent/HackerTerminal';
import { FindingsBoard } from '../../components/agent/FindingsBoard';
import { HuntDiary } from '../../components/agent/HuntDiary';
import { AttackSurfaceMap } from '../../components/agent/AttackSurfaceMap';
import { FingerprintCard } from '../../components/agent/FingerprintCard';
import { ReportExport } from '../../components/agent/ReportExport';

const TERMINAL_STATUSES = ['running', 'resuming', 'waiting'];

export function HuntView() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [findings, setFindings] = useState([]);
  const [diary, setDiary] = useState([]);
  const [surface, setSurface] = useState({});
  const [report, setReport] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [tab, setTab] = useState('findings');
  const [explainer, setExplainer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [askText, setAskText] = useState('');
  const [askAnswer, setAskAnswer] = useState('');
  const [askBusy, setAskBusy] = useState(false);

  const refreshDetail = useCallback(async () => {
    try {
      const [f, d, s] = await Promise.all([
        getJobFindings(jobId).catch(() => null),
        getJobDiary(jobId).catch(() => null),
        getJobAttackSurface(jobId).catch(() => null)
      ]);
      if (f?.findings) setFindings(f.findings);
      if (d?.diary) setDiary(d.diary);
      if (s?.attackSurface) setSurface(s.attackSurface);
    } catch { /* panels degrade gracefully */ }
  }, [jobId]);

  const refreshReport = useCallback(async () => {
    try {
      const body = await getJobVulnerabilityReport(jobId);
      if (body?.report) {
        setReport(body.report);
        // The archived hunt record id arrives via the report.archived event;
        // fall back to matching by job when the event was missed.
        if (body.report.huntRecordId) setRecordId(body.report.huntRecordId);
      }
    } catch { /* 404 until the hunt completes — expected */ }
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getJobState(jobId)
      .then((body) => {
        if (cancelled) return;
        setJob(body?.job || body);
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load the hunt.');
          setLoading(false);
        }
      });
    refreshDetail();
    refreshReport();
    return () => { cancelled = true; };
  }, [jobId, refreshDetail, refreshReport]);

  // Live job events → patch header state, refresh panels on meaningful events.
  useEffect(() => {
    const unsubscribe = subscribeToJobEvents(jobId, {
      onEvent: (event) => {
        const type = event.__sseType || event.type || '';
        if (type === 'job.phase_changed' || type.startsWith('job.')) {
          setJob((prev) => (prev ? { ...prev, ...event.data?.job, status: event.data?.status || prev.status } : prev));
        }
        if (type === 'report.archived' && event.data?.huntRecordId) {
          setRecordId(event.data.huntRecordId);
          refreshReport();
        }
        if (type === 'job.completed' || type === 'job.failed' || type === 'job.cancelled') {
          refreshReport();
        }
        if (type.startsWith('finding.') || type === 'observation.recorded') {
          refreshDetail();
        }
      },
      onError: () => {}
    });
    return () => unsubscribe?.();
  }, [jobId, refreshDetail, refreshReport]);

  const doAction = async (name, fn) => {
    setBusy(name);
    setError('');
    try {
      const body = await fn();
      if (body?.job) setJob(body.job);
      else {
        const fresh = await getJobState(jobId);
        setJob(fresh?.job || fresh);
      }
      refreshDetail();
    } catch (err) {
      setError(err.message || `Could not ${name} the hunt.`);
    } finally {
      setBusy(null);
    }
  };

  const ask = async (e) => {
    e?.preventDefault();
    if (!askText.trim() || askBusy) return;
    setAskBusy(true);
    try {
      const body = await askJob(jobId, askText.trim());
      setAskAnswer(body?.answer || body?.reply || 'The agent did not answer.');
      setAskText('');
    } catch (err) {
      setAskAnswer(`Couldn't reach the agent: ${err.message}`);
    } finally {
      setAskBusy(false);
    }
  };

  if (loading) return <div className="dm-page-loading">Loading hunt…</div>;
  if (error && !job) return <div className="dm-page-error"><AlertTriangle size={18} /> {error}</div>;

  const status = job?.status || 'unknown';
  const running = TERMINAL_STATUSES.includes(status) || status === 'created';

  return (
    <div className="dm-hunt-view">
      <Link to="/agent" className="dm-back"><ChevronLeft size={14} /> Command center</Link>

      <FingerprintCard job={job} surface={surface} />

      <div className="dm-hunt-controls">
        {status === 'paused' ? (
          <button className="dm-btn-primary" disabled={busy} onClick={() => doAction('resume', () => continueJob(jobId))}>
            {busy === 'resume' ? <Loader2 size={15} className="dm-spin" /> : <Play size={15} />} Resume from checkpoint
          </button>
        ) : running ? (
          <button className="dm-btn-secondary" disabled={busy} onClick={() => doAction('pause', () => pauseJob(jobId))}>
            {busy === 'pause' ? <Loader2 size={15} className="dm-spin" /> : <Pause size={15} />} Pause
          </button>
        ) : null}
        {running && (
          <button className="dm-btn-danger-ghost" disabled={busy} onClick={() => {
            if (window.confirm('Cancel this hunt permanently? History is preserved.')) doAction('cancel', () => cancelJob(jobId));
          }}>
            <Square size={14} /> Cancel
          </button>
        )}
        <span className="dm-hunt-spacer" />
        <ReportExport jobId={jobId} recordId={recordId} report={report} target={job?.target} />
      </div>

      {error && <div className="dm-form-error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      <div className="dm-hunt-grid">
        <div className="dm-hunt-left">
          <HackerTerminal jobId={jobId} />
          <form className="dm-ask-bar" onSubmit={ask}>
            <input
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              placeholder="Ask the agent about its hunt — e.g. what are you testing right now?"
            />
            <button type="submit" disabled={askBusy || !askText.trim()}>
              {askBusy ? <Loader2 size={15} className="dm-spin" /> : <Send size={15} />}
            </button>
          </form>
          {askAnswer && <div className="dm-ask-answer"><strong>Agent:</strong> {askAnswer}</div>}
        </div>

        <div className="dm-hunt-right">
          <div className="dm-tabs">
            {[
              { id: 'findings', label: 'Findings', icon: Bug, count: findings.length },
              { id: 'diary', label: 'Diary', icon: BookOpen },
              { id: 'surface', label: 'Attack surface', icon: MapIcon }
            ].map(({ id, label, icon: Icon, count }) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                <Icon size={14} /> {label} {count != null && count > 0 && <span className="dm-tab-count">{count}</span>}
              </button>
            ))}
            <button
              className={`dm-explainer-toggle ${explainer ? 'active' : ''}`}
              onClick={() => setExplainer((v) => !v)}
              title="Plain-language mode"
            >
              <Sparkles size={14} /> Plain language
            </button>
            <button className="dm-tab-refresh" onClick={refreshDetail} title="Refresh panels">
              <FileDown size={14} />
            </button>
          </div>
          <div className="dm-tab-body">
            {tab === 'findings' && <FindingsBoard findings={findings} explainer={explainer} />}
            {tab === 'diary' && <HuntDiary entries={diary} />}
            {tab === 'surface' && <AttackSurfaceMap surface={surface} />}
          </div>
        </div>
      </div>
    </div>
  );
}
