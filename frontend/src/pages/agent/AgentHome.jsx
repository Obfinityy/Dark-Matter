/**
 * AgentHome — Hunt AI home. "Point me at a target."
 *
 * Elegant redesign: calm hero, single paste action, quiet stats,
 * recent hunts. Dark Matter design system (dm-*).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Crosshair,
  AlertTriangle,
  ChevronRight,
  Loader2,
  FileText,
  ShieldCheck,
  ArrowRight,
  Target,
} from 'lucide-react';
import { createJob, listJobs, startContinuousHunt, getHuntState } from '../../services/api';
import { normalizeTargetUrl } from '../../utils/normalizeTarget';
import { DedupBanner } from '../../components/agent/DedupBanner';
import { StatusPill } from '../../components/agent/AgentShell';
import { BrainGate } from '../../components/BrainGate';
import '../../styles/kinetic-hunt.css';

export function AgentHome() {
  const navigate = useNavigate();
  const [target, setTarget] = useState('');
  const [authConfirmed, setAuthConfirmed] = useState(false);
  // Where the hunt runs: 'backend' (this device's backend worker + local VM)
  // or 'agent' (your agent machine / Oracle VM via the agent poller — runs
  // 24/7 even with the browser closed). Persisted per browser.
  const [executor, setExecutor] = useState(() => {
    try {
      return localStorage.getItem('dm_hunt_executor') === 'agent' ? 'agent' : 'backend';
    } catch {
      return 'backend';
    }
  });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [dedup, setDedup] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  // Hunt mode: 'standard' (single sweep) or 'continuous' (non-stop hunt
  // loop until force-stopped — issue #298). Persisted per browser.
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('dm_hunt_mode') === 'continuous' ? 'continuous' : 'standard';
    } catch {
      return 'standard';
    }
  });
  // Continuous-hunt boot sequence: 'idle' | 'starting' | 'vm_booting'.
  const [bootStage, setBootStage] = useState('idle');
  const [bootHuntId, setBootHuntId] = useState(null);
  const bootCancelled = React.useRef(false);

  useEffect(() => {
    return () => {
      bootCancelled.current = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const jobsBody = await listJobs({ limit: 8 }).catch(() => null);
      if (jobsBody?.jobs) setJobs(jobsBody.jobs);
    } catch {
      /* home degrades to the hunt box rather than crashing */
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const launch = async ({ forceNew = false } = {}) => {
    const clean = normalizeTargetUrl(target);
    if (!clean) {
      setError('Paste a target first — a domain, URL, or IP.');
      return;
    }
    if (!authConfirmed) {
      setError('Please confirm you are authorized to test this target.');
      return;
    }
    setStarting(true);
    setError('');
    setDedup(null);
    try {
      if (mode === 'continuous') {
        // Continuous autonomous hunt (issue #298): brains already passed the
        // BrainGate check above (it holds the submit when a brain is missing),
        // then the hunt starts and the VM boots before the loop arms.
        setBootStage('starting');
        bootCancelled.current = false;
        const res = await startContinuousHunt({ target: clean, executor });
        const hunt = res?.hunt || res;
        const huntId = hunt?.id || res?.huntId;
        if (!huntId) {
          setError('The hunt was created but no hunt id came back.');
          setBootStage('idle');
          return;
        }
        setBootHuntId(huntId);
        setBootStage('vm_booting');
        // Wait for the loop to be contactable (driven by the hunt state —
        // there is no separate VM status endpoint on the hunts API).
        const deadline = Date.now() + 30000;
        let ready = false;
        while (!ready && Date.now() < deadline && !bootCancelled.current) {
          try {
            const { hunt: h } = await getHuntState(huntId);
            if (String(h?.status || '').toLowerCase() === 'running') ready = true;
          } catch {
            /* the loop may arm before state is queryable — keep waiting */
          }
          if (!ready) await new Promise(r => setTimeout(r, 2000));
        }
        // Even if the VM isn't ready yet, the console keeps showing the boot
        // indicator and the loop picks up live — never leave the user stuck.
        if (!bootCancelled.current)
          navigate(`/agent/hunt-live/${huntId}`, { state: { target: clean } });
        return;
      }
      const res = await createJob({
        target: clean,
        targetUrl: clean,
        authorizationConfirmed: true,
        executor,
        ...(forceNew ? { forceNew: true } : {}),
      });
      if (res?.deduped) {
        setDedup(res);
        refresh();
        return;
      }
      const job = res?.job || res;
      const jobId = job?.id || res?.jobId;
      if (jobId) navigate(`/agent/hunt/${jobId}`);
      else setError('The hunt was created but no hunt id came back.');
    } catch (err) {
      setError(err.message || 'Could not start the hunt.');
    } finally {
      setStarting(false);
    }
  };

  const startHunt = e => {
    e.preventDefault();
    launch();
  };

  const runningCount = jobs.filter(j => String(j.status).toLowerCase() === 'running').length;
  const doneCount = jobs.filter(j => String(j.status).toLowerCase() === 'completed').length;
  const totalFindings = jobs.reduce((n, j) => n + (j.findingsCount || 0), 0);

  return (
    <div className="dm-container">
      {/* ── Hero ── */}
      <header className="dm-page-head" style={{ marginTop: 'var(--dm-8)' }}>
        <span className="dm-badge dm-badge-gold" style={{ marginBottom: 'var(--dm-4)' }}>
          Autonomous bug bounty
        </span>
        <h1
          className="dm-page-title khu-hero-title"
          style={{ fontSize: 'var(--dm-text-4xl)', maxWidth: '640px' }}
        >
          {/* Kinetic word-stagger reveal. Text content is identical — words
              are split into spans purely for the entrance animation. */}
          {"Point me at a target. I'll hunt it down.".split(' ').map((word, i, words) => (
            <React.Fragment key={i}>
              <span className="khu-w" style={{ '--khu-d': `${i * 65}ms` }}>
                {word}
              </span>
              {i < words.length - 1 ? ' ' : ''}
            </React.Fragment>
          ))}
        </h1>
        <p className="dm-page-sub">
          The agent maps the attack surface, tests real hypotheses, and hands you a submission-ready
          report — while you watch it think, live.
        </p>
      </header>

      {/* ── Hunt input — the hero action: target input is the single most
          prominent element; mode/executor + auth stay secondary below it. */}
      <section className="dm-card khu-launch" style={{ marginBottom: 'var(--dm-8)' }}>
        <BrainGate required={['vision', 'hacker']} featureName="Hunt AI">
          {bootStage !== 'idle' ? (
            /* Continuous-hunt boot sequence: brain check already passed
               (BrainGate holds the submit when a brain is missing), so this
               panel walks through hunt start → VM boot → console. */
            <div role="status" aria-label="Starting continuous hunt">
              <ol
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gap: 'var(--dm-2)',
                }}
              >
                <li style={{ display: 'flex', gap: 'var(--dm-2)', alignItems: 'center' }}>
                  <ShieldCheck size={16} style={{ color: 'var(--dm-green)' }} />
                  <span>Brains ready — hacking + vision online</span>
                </li>
                <li style={{ display: 'flex', gap: 'var(--dm-2)', alignItems: 'center' }}>
                  {bootStage === 'starting' ? (
                    <Loader2
                      size={16}
                      aria-hidden="true"
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                  ) : (
                    <ShieldCheck size={16} style={{ color: 'var(--dm-green)' }} />
                  )}
                  <span>Hunt started — arming the loop…</span>
                </li>
                {bootStage === 'vm_booting' && (
                  <li style={{ display: 'flex', gap: 'var(--dm-2)', alignItems: 'center' }}>
                    <Loader2
                      size={16}
                      aria-hidden="true"
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                    <span>
                      VM: starting…
                      {bootHuntId ? ` (hunt ${bootHuntId.slice(0, 8)})` : ''}
                    </span>
                  </li>
                )}
              </ol>
              <p
                style={{
                  fontSize: 'var(--dm-text-sm)',
                  color: 'var(--dm-muted)',
                  marginTop: 'var(--dm-3)',
                  marginBottom: 0,
                }}
              >
                Opening the live hunt console…
              </p>
            </div>
          ) : (
          <form onSubmit={startHunt}>
            <div
              role="radiogroup"
              aria-label="Hunt mode"
              style={{
                display: 'flex',
                gap: 'var(--dm-2)',
                marginBottom: 'var(--dm-3)',
                flexWrap: 'wrap',
              }}
            >
              {[
                { id: 'standard', label: 'Standard hunt' },
                { id: 'continuous', label: 'Continuous hunt' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  className={`dm-btn dm-btn-sm${mode === id ? ' dm-btn-primary' : ' dm-btn-secondary'}`}
                  onClick={() => {
                    setMode(id);
                    try {
                      localStorage.setItem('dm_hunt_mode', id);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  {label}
                </button>
              ))}
              {mode === 'continuous' && (
                <span
                  style={{
                    fontSize: 'var(--dm-text-sm)',
                    color: 'var(--dm-muted)',
                    alignSelf: 'center',
                  }}
                >
                  Hunts non-stop until you force-stop it.
                </span>
              )}
            </div>
            <div className="dm-hunt-row khu-launch-row">
              <div style={{ position: 'relative', flex: 1 }}>
                <Crosshair
                  size={18}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--dm-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  id="dm-target"
                  type="text"
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder="Paste a URL you own — https://target.com"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="Target URL"
                  className="dm-input"
                  style={{ paddingLeft: '44px' }}
                />
              </div>
              <button type="submit" className="dm-btn dm-btn-primary dm-btn-lg" disabled={starting}>
                {starting && (
                  <Loader2
                    size={17}
                    aria-hidden="true"
                    style={{ animation: 'spin 1s linear infinite' }}
                  />
                )}
                {starting ? 'Starting…' : mode === 'continuous' ? 'Start continuous hunt' : 'Start hunt'}
              </button>
            </div>
            <label
              style={{
                display: 'flex',
                gap: 'var(--dm-2)',
                alignItems: 'center',
                fontSize: 'var(--dm-text-sm)',
                color: 'var(--dm-text-2)',
                cursor: 'pointer',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>Run on:</span>
              <select
                value={executor}
                onChange={e => {
                  const v = e.target.value === 'agent' ? 'agent' : 'backend';
                  setExecutor(v);
                  try {
                    localStorage.setItem('dm_hunt_executor', v);
                  } catch {
                    /* ignore */
                  }
                }}
                style={{
                  background: 'var(--dm-surface-2)',
                  color: 'var(--dm-text-1)',
                  border: '1px solid var(--dm-border)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: 'var(--dm-text-sm)',
                }}
                aria-label="Where the hunt runs"
              >
                <option value="backend">My Device</option>
                <option value="agent">My agent machine (24/7)</option>
              </select>
            </label>
            <label
              style={{
                display: 'flex',
                gap: 'var(--dm-2)',
                alignItems: 'flex-start',
                fontSize: 'var(--dm-text-sm)',
                color: 'var(--dm-text-2)',
                cursor: 'pointer',
                lineHeight: 1.5,
              }}
            >
              <input
                type="checkbox"
                checked={authConfirmed}
                onChange={e => setAuthConfirmed(e.target.checked)}
                style={{ marginTop: '3px', accentColor: 'var(--dm-gold)' }}
              />
              <span style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <ShieldCheck
                  size={15}
                  style={{ flexShrink: 0, marginTop: '2px', color: 'var(--dm-gold-soft)' }}
                />
                I confirm I'm authorized to security-test this target — I own it or have written
                permission.
              </span>
            </label>
          </form>
          )}
        </BrainGate>

        {error && (
          <div
            className="dm-notice dm-notice-red"
            style={{ marginTop: 'var(--dm-4)' }}
            role="alert"
          >
            <AlertTriangle
              size={16}
              aria-hidden="true"
              style={{ color: 'var(--dm-red)', flexShrink: 0, marginTop: '2px' }}
            />
            <span>{error}</span>
          </div>
        )}

        {dedup && (
          <div style={{ marginTop: 'var(--dm-4)' }}>
            <DedupBanner
              result={dedup}
              onView={() =>
                dedup?.huntRecord?.id && navigate(`/agent/reports/${dedup.huntRecord.id}`)
              }
              onNewHunt={() => launch({ forceNew: true })}
              onDismiss={() => setDedup(null)}
            />
          </div>
        )}
      </section>

      {/* ── Stats ── */}
      <section className="dm-grid-3" style={{ marginBottom: 'var(--dm-10)' }}>
        {[
          { n: runningCount, label: 'Hunts live now', live: runningCount > 0 },
          { n: doneCount, label: 'Hunts completed' },
          { n: totalFindings, label: 'Findings so far' },
        ].map(({ n, label, live }, i) => (
          <div
            key={label}
            className="dm-card dm-center khu-stat"
            style={{ padding: 'var(--dm-5)', '--khu-d': `${i * 80}ms` }}
          >
            <div
              style={{
                fontSize: 'var(--dm-text-3xl)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginBottom: 'var(--dm-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {n}
              {live ? <span className="visually-hidden">live now</span> : null}
              {live && <span className="khu-live-dot" aria-hidden="true" />}
            </div>
            <div style={{ fontSize: 'var(--dm-text-sm)', color: 'var(--dm-muted)' }}>{label}</div>
          </div>
        ))}
      </section>

      {/* ── Recent hunts + side cards ── */}
      <div className="dm-grid-2" style={{ alignItems: 'start' }}>
        <section className="dm-card">
          <div className="dm-section-head">
            <h2 className="dm-section-title khu-section-title">Recent hunts</h2>
            {jobs.length > 0 && (
              <Link to="/agent/reports" className="dm-section-link">
                View all <ArrowRight size={14} style={{ verticalAlign: '-2px' }} />
              </Link>
            )}
          </div>
          {jobsLoading ? (
            <div style={{ display: 'grid', gap: 'var(--dm-2)' }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="dm-row" style={{ opacity: 0.5 }}>
                  <div className="dm-row-main">
                    <div
                      style={{
                        height: '14px',
                        width: `${60 - i * 10}%`,
                        background: 'var(--dm-surface-3)',
                        borderRadius: '4px',
                        marginBottom: '6px',
                      }}
                    />
                    <div
                      style={{
                        height: '11px',
                        width: '40%',
                        background: 'var(--dm-surface-3)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="dm-empty">
              <div className="dm-empty-icon dm-empty-icon-lucide" aria-hidden="true">
                <Target size={22} />
              </div>
              <p className="dm-empty-title">No hunts yet</p>
              <p className="dm-empty-sub">Your first hunt is one paste away.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--dm-2)' }}>
              {jobs.slice(0, 6).map((job, i) => (
                <Link
                  key={job.id}
                  to={`/agent/hunt/${job.id}`}
                  className="dm-row khu-row-in"
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    '--khu-d': `${Math.min(i, 5) * 55}ms`,
                  }}
                >
                  <div className="dm-row-main">
                    <p className="dm-row-title">{job.target || job.targetHostname || job.id}</p>
                    <p className="dm-row-sub">
                      {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : ''}
                      {job.findingsCount != null && ` · ${job.findingsCount} findings`}
                    </p>
                  </div>
                  <StatusPill status={job.status} />
                  <ChevronRight size={16} style={{ color: 'var(--dm-muted)', flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gap: 'var(--dm-4)' }}>
          <section className="dm-card">
            <h3 className="dm-card-title khu-section-title">Past reports</h3>
            <p className="dm-card-sub">
              Every completed hunt is archived with a submission-ready report.
            </p>
            <Link to="/agent/reports" className="dm-btn dm-btn-secondary dm-btn-sm">
              <FileText size={14} /> Browse reports
            </Link>
          </section>

          <section className="dm-card">
            <h3 className="dm-card-title khu-section-title">How it works</h3>
            <div style={{ display: 'grid', gap: 'var(--dm-3)', marginTop: 'var(--dm-3)' }}>
              {[
                ['Paste a URL you own', 'The agent takes it from there.'],
                ['It maps the surface', 'Recon, fingerprinting, attack paths.'],
                ['Tests hypotheses, safely', 'Real probes. No damage. Full logs.'],
                ['You get the report', 'Evidence-backed PDF, ready to submit.'],
              ].map(([title, sub], i) => (
                <div key={title} style={{ display: 'flex', gap: 'var(--dm-3)' }}>
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'var(--dm-gold-glow)',
                      border: '1px solid var(--dm-gold-border)',
                      color: 'var(--dm-gold-soft)',
                      fontSize: 'var(--dm-text-sm)',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--dm-text-sm)' }}>
                      {title}
                    </p>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: 'var(--dm-text-sm)',
                        color: 'var(--dm-muted)',
                      }}
                    >
                      {sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <p className="dm-hint dm-center" style={{ marginTop: 'var(--dm-8)' }}>
        Re-pasting a hunted target returns its saved report instantly — "Start new hunt" only when
        you want a fresh look.
      </p>
    </div>
  );
}
