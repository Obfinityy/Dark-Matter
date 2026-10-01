/**
 * HuntView — the live hunt screen.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────┬──────────────┐
 *   │ Header: target + plain-language status + actions │              │
 *   ├─────────────────────────────────────────────────┤  AgentChat   │
 *   │ Fingerprint card                                │  ("agent se  │
 *   │ Live terminal                                   │   baat karo")│
 *   │ Tabs: Findings | Diary | Attack surface          │              │
 *   └─────────────────────────────────────────────────┴──────────────┘
 *
 * State rehydrates from GET /jobs/:id on mount (refresh-safe); live updates
 * arrive over SSE. Pause persists the exact checkpoint — resume continues
 * from the identical state.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Pause, Play, Square, Loader2, AlertTriangle,
  Bug, BookOpen, Map as MapIcon, ChevronLeft, Sparkles, RefreshCw
} from 'lucide-react';
import {
  getJobState, pauseJob, continueJob, cancelJob,
  getJobFindings, getJobDiary, getJobAttackSurface, getJobVulnerabilityReport,
  subscribeToJobEvents
} from '../../services/api';
import { HackerTerminal } from '../../components/agent/HackerTerminal';
import { LiveScreenViewer } from '../../components/agent/LiveScreenViewer';
import { FindingsBoard } from '../../components/agent/FindingsBoard';
import { HuntDiary } from '../../components/agent/HuntDiary';
import { AttackSurfaceMap } from '../../components/agent/AttackSurfaceMap';
import { FingerprintCard } from '../../components/agent/FingerprintCard';
import { ReportExport } from '../../components/agent/ReportExport';
import { AgentChat } from '../../components/agent/AgentChat';
import { StatusPill } from '../../components/agent/AgentShell';

const ACTIVE_STATUSES = ['running', 'resuming', 'waiting', 'created'];

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

  if (loading) {
    return (
      <div className="dm-huntview">
        <div className="dm-loading-box"><Loader2 size={18} className="dm-spin" /> Loading hunt…</div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="dm-huntview dm-huntview-error">
        <h2>Couldn't open this hunt</h2>
        <p>{error}</p>
        <div className="dm-huntview-actions">
          <Link to="/agent" className="dm-btn-secondary"><ChevronLeft size={15} /> Back to home</Link>
        </div>
      </div>
    );
  }

  const status = String(job?.status || 'unknown').toLowerCase();
  const active = ACTIVE_STATUSES.includes(status);
  const thinking = active && /think|plan|reason|analy/i.test(String(job?.phase || job?.currentPhase || ''));

  return (
    <div className="dm-huntview">
      <header className="dm-hunt-head">
        <div className="dm-hunt-head-main">
          <div className="dm-hunt-title-row">
            <Link to="/agent" className="dm-btn-ghost" aria-label="Back to home">
              <ChevronLeft size={15} />
            </Link>
            <h1>Live hunt</h1>
            <StatusPill status={status} thinking={thinking} />
          </div>
          <span className="dm-target-line">{job?.target || job?.targetHostname || jobId}</span>
          {job?.currentObjective && <p className="dm-hunt-sub">{job.currentObjective}</p>}
        </div>
        <div className="dm-hunt-actions">
          {status === 'paused' ? (
            <button className="dm-icon-btn" disabled={busy} onClick={() => doAction('resume', () => continueJob(jobId))}>
              {busy === 'resume' ? <Loader2 size={15} className="dm-spin" /> : <Play size={15} />} Resume
            </button>
          ) : active ? (
            <button className="dm-icon-btn" disabled={busy} onClick={() => doAction('pause', () => pauseJob(jobId))}>
              {busy === 'pause' ? <Loader2 size={15} className="dm-spin" /> : <Pause size={15} />} Pause
            </button>
          ) : null}
          {active && (
            <button
              className="dm-icon-btn dm-danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Cancel this hunt permanently? History is preserved.')) {
                  doAction('cancel', () => cancelJob(jobId));
                }
              }}
            >
              <Square size={14} /> Cancel
            </button>
          )}
          <ReportExport jobId={jobId} recordId={recordId} report={report} target={job?.target} />
        </div>
      </header>

      {error && <div className="dm-form-error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      <div className="dm-hunt-grid">
        <div className="dm-hunt-main-col">
          <FingerprintCard job={job} surface={surface} />

          <HackerTerminal jobId={jobId} />

          <LiveScreenViewer assessmentId={job?.assessmentId} />

          <section>
            <div className="dm-hunt-tabs" role="tablist">
              {[
                { id: 'findings', label: 'Findings', icon: Bug, count: findings.length },
                { id: 'diary', label: 'Diary', icon: BookOpen },
                { id: 'surface', label: 'Attack surface', icon: MapIcon }
              ].map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  className={`dm-tab${tab === id ? ' active' : ''}`}
                  onClick={() => setTab(id)}
                >
                  <Icon size={14} /> {label}
                  {count != null && count > 0 && <span className="dm-tab-badge">{count}</span>}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <button
                className={`dm-btn-ghost${explainer ? ' active' : ''}`}
                onClick={() => setExplainer((v) => !v)}
                title="Plain-language explanations for every finding"
              >
                <Sparkles size={14} /> Plain language
              </button>
              <button className="dm-btn-ghost" onClick={refreshDetail} title="Refresh panels" aria-label="Refresh panels">
                <RefreshCw size={14} />
              </button>
            </div>
            <div style={{ marginTop: 16 }}>
              {tab === 'findings' && <FindingsBoard findings={findings} explainer={explainer} />}
              {tab === 'diary' && <HuntDiary entries={diary} />}
              {tab === 'surface' && <AttackSurfaceMap surface={surface} />}
            </div>
          </section>
        </div>

        <aside className="dm-hunt-side">
          <AgentChat jobId={jobId} huntRunning={active} />
        </aside>
      </div>
    </div>
  );
}
