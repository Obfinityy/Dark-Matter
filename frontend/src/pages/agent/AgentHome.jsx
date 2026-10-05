/**
 * AgentHome — "point me at a target".
 *
 * One paste box starts a hunt. Dedup returns the cached report instantly.
 * Below: live stats and recent hunts. Singularity design system.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Crosshair, AlertTriangle, ChevronRight,
  Radar, FileCheck2, Target, ShieldCheck
} from 'lucide-react';
import { createJob, listJobs } from '../../services/api';
import { normalizeTargetUrl } from '../../utils/normalizeTarget';
import { DedupBanner } from '../../components/agent/DedupBanner';
import { StatusPill } from '../../components/agent/AgentShell';
import { DarkVeil } from '../../components/fx/DarkVeil';
import { DecryptedText } from '../../components/fx/DecryptedText';
import './AgentHome.css';
import './AgentHomeNew.css';

/**
 * useCountUp — eases a number from 0 to its target on mount so stats
 * land with a subtle micro-interaction. Disabled for reduced-motion
 * users (they see the final value instantly).
 */
function useCountUp(target) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const DURATION = 650;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export function AgentHome() {
  const navigate = useNavigate();
  const [target, setTarget] = useState('');
  const [authConfirmed, setAuthConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [dedup, setDedup] = useState(null);
  const [jobs, setJobs] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const jobsBody = await listJobs({ limit: 8 }).catch(() => null);
      if (jobsBody?.jobs) setJobs(jobsBody.jobs);
    } catch { /* home degrades to the hunt box rather than crashing */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const launch = async ({ forceNew = false } = {}) => {
    // "target.com" → "https://target.com" (scheme-less input gets https://).
    const clean = normalizeTargetUrl(target);
    if (!clean) { setError('Paste a target first — a domain, URL, or IP.'); return; }
    if (!authConfirmed) {
      setError('Please confirm you are authorized to test this target.');
      return;
    }
    setStarting(true);
    setError('');
    setDedup(null);
    try {
      const res = await createJob({ target: clean, targetUrl: clean, authorizationConfirmed: true, ...(forceNew ? { forceNew: true } : {}) });
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

  const startHunt = (e) => { e.preventDefault(); launch(); };

  const runningCount = jobs.filter((j) => String(j.status).toLowerCase() === 'running').length;
  const doneCount = jobs.filter((j) => String(j.status).toLowerCase() === 'completed').length;
  const totalFindings = jobs.reduce((n, j) => n + (j.findingsCount || 0), 0);

  // Animated stat numbers — landing with a soft count-up.
  const runningShown = useCountUp(runningCount);
  const doneShown = useCountUp(doneCount);
  const findingsShown = useCountUp(totalFindings);

  return (
    <div className="sg-hunt-home home-new">
      <DarkVeil intensity={0.7} />
      {/* ── Hero ── */}
      <section className="sg-hero sg-fade-up">
        <span className="sg-pill sg-pill-brand"><Radar size={13} /> Autonomous bug bounty</span>
        <DecryptedText
          text="Point me at a target. I'll hunt it down."
          as="h1"
          className="sg-display home-hero-title"
        />
        <p className="sg-body" style={{ maxWidth: 560, fontSize: '1.08rem' }}>
          The agent maps the attack surface, tests real hypotheses, and hands you a
          submission-ready report — while you watch it think, live.
        </p>

        <form className="sg-hunt-form sg-fade-up sg-fade-up-1" onSubmit={startHunt}>
          <div className="sg-hunt-bar">
            <Crosshair size={19} className="sg-hunt-bar-icon" />
            <input
              id="sg-target"
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Paste a URL you own — https://target.com"
              spellCheck={false}
              autoComplete="off"
              aria-label="Target URL"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'sg-target-error' : undefined}
            />
            <button type="submit" className="sg-btn sg-btn-primary" disabled={starting}>
              {starting && <span className="sg-spin" style={{ display: 'inline-flex' }}>◌</span>}
              {starting ? 'Starting…' : 'Start hunt'}
            </button>
          </div>
          <label className="sg-authz">
            <input type="checkbox" checked={authConfirmed} onChange={(e) => setAuthConfirmed(e.target.checked)} />
            <span><ShieldCheck size={14} /> I confirm I'm authorized to security-test this target — I own it or have written permission.</span>
          </label>
        </form>

        {error && <div id="sg-target-error" className="sg-auth-error" role="alert" style={{ marginTop: 16, maxWidth: 640 }}><AlertTriangle size={15} /> {error}</div>}

        {dedup && (
          <div style={{ marginTop: 20, maxWidth: 640 }}>
            <DedupBanner
              result={dedup}
              onView={() => dedup?.huntRecord?.id && navigate(`/agent/reports/${dedup.huntRecord.id}`)}
              onNewHunt={() => launch({ forceNew: true })}
              onDismiss={() => setDedup(null)}
            />
          </div>
        )}
      </section>

      {/* ── Stats ── */}
      <section className="sg-stats" aria-label="Hunt statistics">
        {[
          { n: runningShown, label: 'hunts live right now', live: runningCount > 0 },
          { n: doneShown, label: 'hunts completed' },
          { n: findingsShown, label: 'findings so far' },
        ].map(({ n, label, live }, i) => (
          <div key={label} className={`sg-stat sg-fade-up sg-fade-up-${i + 1}`}>
            <strong>{n}{live && <span className="sg-live-dot" />}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      {/* ── Content grid ── */}
      <div className="sg-grid-2 sg-fade-up sg-fade-up-3" style={{ marginTop: 8 }}>
        <section className="sg-card sg-card-pad">
          <h3 className="sg-h2" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 18px' }}>
            <Target size={18} className="sg-h-icon" /> Recent hunts
          </h3>
          {jobs.length === 0 ? (
            <p className="sg-small">No hunts yet — your first one is one paste away.</p>
          ) : (
            <ul className="sg-hunt-list">
              {jobs.slice(0, 6).map((job) => (
                <li key={job.id}>
                  <Link to={`/agent/hunt/${job.id}`} className="sg-hunt-row">
                    <div className="sg-hunt-main">
                      <span className="sg-hunt-target">{job.target || job.targetHostname || job.id}</span>
                      <span className="sg-tiny">
                        {job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}
                        {job.findingsCount != null && ` · ${job.findingsCount} findings`}
                      </span>
                    </div>
                    <StatusPill status={job.status} />
                    <ChevronRight size={16} className="sg-hunt-chevron" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="sg-stack">
          <section className="sg-card sg-card-pad">
            <h3 className="sg-h2" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 12px' }}>
              <FileCheck2 size={18} className="sg-h-icon" /> Past reports
            </h3>
            <p className="sg-small">Every completed hunt is archived with a submission-ready report.</p>
            <Link to="/agent/reports" className="sg-card-link">
              Browse reports <ChevronRight size={14} />
            </Link>
          </section>

          <section className="sg-card sg-card-pad">
            <h3 className="sg-h2" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 14px' }}>
              <Crosshair size={18} className="sg-h-icon" /> How it works
            </h3>
            <ol className="sg-steps">
              <li><strong>Paste a URL you own</strong><span>The agent takes it from there.</span></li>
              <li><strong>It maps the surface</strong><span>Recon, fingerprinting, attack paths.</span></li>
              <li><strong>Tests hypotheses, safely</strong><span>Real probes. No damage. Full logs.</span></li>
              <li><strong>You get the report</strong><span>Evidence-backed PDF, ready to submit.</span></li>
            </ol>
          </section>
        </div>
      </div>

      <p className="sg-tiny sg-fade-up sg-fade-up-4" style={{ marginTop: 28, textAlign: 'center' }}>
        Re-pasting a hunted target returns its saved report instantly — "Start new hunt" only when you want a fresh look.
      </p>
    </div>
  );
}
