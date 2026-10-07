/**
 * HuntView — the live hunt screen.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────┬──────────────┐
 *   │ Header: target + plain-language status + actions │  Character   │
 *   ├─────────────────────────────────────────────────┤  HuntChat    │
 *   │ Fingerprint card                                │  Panel       │
 *   │ Live terminal                                   │  ("agent se  │
 *   │ Tabs: Findings | Diary | Attack surface          │   baat karo")│
 *   └─────────────────────────────────────────────────┴──────────────┘
 *
 * State rehydrates from GET /jobs/:id on mount (refresh-safe); live updates
 * arrive over SSE. Pause persists the exact checkpoint — resume continues
 * from the identical state.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Pause, Play, Square, Loader2, AlertTriangle,
  Bug, BookOpen, Map as MapIcon, ChevronLeft, Sparkles, RefreshCw, Mic, MessageCircle
} from 'lucide-react';
import {
  getJobState, pauseJob, continueJob, cancelJob,
  getJobFindings, getJobDiary, getJobAttackSurface, getJobVulnerabilityReport,
  subscribeToJobEvents, askJob
} from '../../services/api';
import { BrainChat } from '../../components/BrainChat';
import { LiveScreenViewer } from '../../components/agent/LiveScreenViewer';
import { FindingsBoard } from '../../components/agent/FindingsBoard';
import { HuntDiary } from '../../components/agent/HuntDiary';
import { AttackSurfaceMap } from '../../components/agent/AttackSurfaceMap';
import { FingerprintCard } from '../../components/agent/FingerprintCard';
import { ReportExport } from '../../components/agent/ReportExport';
import { HuntTerminal } from './HuntTerminal';
import { AgentCharacter } from './AgentCharacter';
import { AgentChat } from '../../components/agent/AgentChat';
import { AvatarOverlay } from '../../components/agent/AvatarOverlay';
import { Avatar } from '../../components/fx/Avatar';
import { HuntStatusPanel } from '../../components/agent/HuntStatusPanel';
import { StatusPill } from '../../components/agent/AgentShell';
import { DarkVeil } from '../../components/fx/DarkVeil';
import { DecryptedText } from '../../components/fx/DecryptedText';
import { ElectricBorder } from '../../components/fx/ElectricBorder';
import { VoiceModeToggle } from '../../components/agent/VoiceInput';
import './HuntViewNew.css';
import './HuntView.css';

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
  // Hands-free voice conversation with the hunting agent (header mic toggle).
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState('idle'); // idle | listening | thinking | speaking
  // Infinity AI avatar in the Hunt view: emotion + activity come from the
  // agent-chat replies; tapping the avatar opens the full-screen voice overlay.
  const [huntEmotion, setHuntEmotion] = useState('neutral');
  const [huntAvatarState, setHuntAvatarState] = useState('idle');
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Roving-tabindex tablist: only the active tab sits in the tab order;
  // ArrowLeft/Right/Home/End move between tabs (WAI-ARIA tablist pattern).
  const tabIds = useRef({});
  const onTabsKeyDown = (e) => {
    const order = ['findings', 'diary', 'surface', 'chat'];
    const i = order.indexOf(tab);
    if (i === -1) return;
    let next = null;
    if (e.key === 'ArrowRight') next = order[(i + 1) % order.length];
    else if (e.key === 'ArrowLeft') next = order[(i - 1 + order.length) % order.length];
    else if (e.key === 'Home') next = order[0];
    else if (e.key === 'End') next = order[order.length - 1];
    else return;
    e.preventDefault();
    setTab(next);
    tabIds.current[next]?.focus();
  };

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
      <div className="sg-huntview">
        <div className="sg-loading-box" role="status"><Loader2 size={18} className="sg-spin" /> Loading hunt…</div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="sg-huntview sg-huntview-error">
        <h2>Couldn't open this hunt</h2>
        <p>{error}</p>
        <div className="sg-row">
          <Link to="/agent" className="sg-btn sg-btn-ghost"><ChevronLeft size={15} /> Back to home</Link>
        </div>
      </div>
    );
  }

  const status = String(job?.status || 'unknown').toLowerCase();
  const active = ACTIVE_STATUSES.includes(status);
  const thinking = active && /think|plan|reason|analy/i.test(String(job?.phase || job?.currentPhase || ''));

  return (
    <div className="sg-huntview hunt-new">
      <DarkVeil intensity={0.5} />
      <header className="sg-hunt-head">
        <div className="sg-hunt-head-main">
          <div className="sg-hunt-title-row">
            <Link to="/agent" className="sg-btn sg-btn-quiet" aria-label="Back to home">
              <ChevronLeft size={15} />
            </Link>
            <DecryptedText text="Live hunt" as="h1" className="hunt-title" />
            {active ? (
              <ElectricBorder active={true}>
                <StatusPill status={status} thinking={thinking} />
              </ElectricBorder>
            ) : (
              <StatusPill status={status} thinking={thinking} />
            )}
          </div>
          <span className="sg-target-line">{job?.target || job?.targetHostname || jobId}</span>
          {job?.currentObjective && <p className="sg-hunt-sub">{job.currentObjective}</p>}
        </div>
        <div className="sg-hunt-actions">
          <VoiceModeToggle
            active={voiceMode}
            onToggle={() => setVoiceMode((v) => !v)}
            className="voice-mode-icon"
          />
          {status === 'paused' ? (
            <button className="sg-btn sg-btn-ghost sg-btn-sm" disabled={busy} onClick={() => doAction('resume', () => continueJob(jobId))}>
              {busy === 'resume' ? <Loader2 size={15} className="sg-spin" /> : <Play size={15} />} Resume
            </button>
          ) : active ? (
            <button className="sg-btn sg-btn-ghost sg-btn-sm" disabled={busy} onClick={() => doAction('pause', () => pauseJob(jobId))}>
              {busy === 'pause' ? <Loader2 size={15} className="sg-spin" /> : <Pause size={15} />} Pause
            </button>
          ) : null}
          {active && (
            <button
              className="sg-btn sg-btn-ghost sg-btn-sm sg-btn-danger"
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

      {error && <div className="sg-auth-error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      <HuntStatusPanel job={job} jobId={jobId} onJobChanged={(j) => { if (j) setJob(j); }} />

      <div className="sg-hunt-grid">
        <div className="sg-hunt-main-col">
          <FingerprintCard job={job} surface={surface} />

          <HuntTerminal jobId={jobId} />

          <LiveScreenViewer assessmentId={job?.assessmentId} />

          <section>
            <div className="sg-tabs" role="tablist" aria-label="Hunt panels" onKeyDown={onTabsKeyDown}>
              {[
                { id: 'findings', label: 'Findings', icon: Bug, count: findings.length },
                { id: 'diary', label: 'Diary', icon: BookOpen },
                { id: 'surface', label: 'Attack surface', icon: MapIcon },
                { id: 'chat', label: 'Chat', icon: MessageCircle }
              ].map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  ref={(el) => { if (el) tabIds.current[id] = el; }}
                  id={`sg-tab-${id}`}
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`sg-panel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  className={`sg-tab${tab === id ? ' sg-active' : ''}`}
                  onClick={() => setTab(id)}
                >
                  <Icon size={14} /> {label}
                  {count != null && count > 0 && <span className="sg-tab-badge">{count}</span>}
                </button>
              ))}
              <span className="sg-tabs-spacer" aria-hidden="true" />
              <button
                className={`sg-btn sg-btn-quiet${explainer ? ' active' : ''}`}
                onClick={() => setExplainer((v) => !v)}
                aria-pressed={explainer}
                title="Plain-language explanations for every finding"
              >
                <Sparkles size={14} /> Plain language
              </button>
              <button className="sg-btn sg-btn-quiet" onClick={refreshDetail} title="Refresh panels" aria-label="Refresh panels">
                <RefreshCw size={14} />
              </button>
            </div>
            <div
              id={`sg-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`sg-tab-${tab}`}
              className="sg-tabpanel"
            >
              {tab === 'findings' && <FindingsBoard findings={findings} explainer={explainer} />}
              {tab === 'diary' && <HuntDiary entries={diary} />}
              {tab === 'surface' && <AttackSurfaceMap surface={surface} />}
              {tab === 'chat' && (
                <BrainChat
                  huntId={jobId}
                  target={job?.target}
                  findingsCount={findings.length}
                  currentStep={job?.currentStep}
                />
              )}
            </div>
          </section>
        </div>

        <aside className="sg-hunt-side">
          {/* Infinity AI avatar — compact inline presence. Tap to open the
              full-screen voice conversation overlay. */}
          <div className="sg-hunt-avatar-card">
            <button
              type="button"
              className="sg-hunt-avatar-btn"
              onClick={() => setOverlayOpen(true)}
              aria-label="Open voice conversation with the Infinity AI avatar"
              title="Talk to Infinity AI"
            >
              <Avatar
                gender="female"
                state={huntAvatarState}
                emotion={huntEmotion}
                size={76}
              />
              <span className="sg-hunt-avatar-cta">
                <Mic size={13} aria-hidden="true" /> Tap to talk
              </span>
            </button>
          </div>
          <AgentCharacter
            active={active}
            listening={voiceMode && voiceState === 'listening'}
            status={voiceMode
              ? (voiceState === 'listening' ? 'Listening…'
                : voiceState === 'speaking' ? 'Speaking…'
                : voiceState === 'thinking' ? 'Thinking…'
                : 'Voice chat on')
              : (active ? 'Hunting' : status === 'completed' ? 'Done' : status === 'paused' ? 'Paused' : 'Idle')}
          />
          <AgentChat
            jobId={jobId}
            huntRunning={active}
            voiceMode={voiceMode}
            onVoiceStateChange={setVoiceState}
            onToggleVoiceMode={setVoiceMode}
            onEmotion={setHuntEmotion}
            onActivity={setHuntAvatarState}
          />
        </aside>
      </div>

      {/* Full-screen avatar voice conversation (reusable overlay). */}
      <AvatarOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        gender="female"
        voice="aria"
        onAsk={async (question) => {
          const body = await askJob(jobId, question);
          const reply = body?.reply ?? body?.answer ?? body?.message ?? '';
          const emotion = typeof body?.emotion === 'string' ? body.emotion : 'neutral';
          setHuntEmotion(emotion);
          return { reply, emotion };
        }}
      />
    </div>
  );
}
