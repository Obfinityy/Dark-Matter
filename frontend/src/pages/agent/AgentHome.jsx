/**
 * AgentHome — "point me at a target".
 *
 * One paste box starts a hunt. If the target was hunted before, the
 * dedup banner offers the cached report instantly instead of re-running.
 * Below: live stats and recent hunts. Simple.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Crosshair, Loader2, AlertTriangle, ChevronRight,
  Radar, FileCheck2, Target
} from 'lucide-react';
import { createJob, listJobs } from '../../services/api';
import { DedupBanner } from '../../components/agent/DedupBanner';
import { StatusPill } from '../../components/agent/AgentShell';

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
    const clean = target.trim();
    if (!clean) { setError('Paste a target first — a domain, URL, or IP.'); return; }
    if (!authConfirmed) {
      setError('Please confirm you are authorized to test this target.');
      return;
    }
    setStarting(true);
    setError('');
    setDedup(null);
    try {
      const res = await createJob({ target: clean, authorizationConfirmed: true, ...(forceNew ? { forceNew: true } : {}) });
      if (res?.deduped) {
        setDedup(res);
        refresh();
        return;
      }
      const job = res?.job || res;
      if (job?.id) navigate(`/agent/hunt/${job.id}`);
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

  return (
    <div className="dm-agent-home">
      <section className="dm-hero">
        <span className="dm-hero-eyebrow"><Radar size={13} /> Autonomous bug bounty</span>
        <h1>Point me at a target.<br /><span className="dm-hero-accent">I'll hunt it down.</span></h1>
        <p className="dm-hero-sub">
          The agent maps the attack surface, tries real payloads, and writes you a
          submission-ready report — while you watch it think, live.
        </p>

        <form className="dm-hunt-form" onSubmit={startHunt}>
          <label className="dm-hunt-label" htmlFor="dm-target">Target</label>
          <div className="dm-input-row">
            <input
              id="dm-target"
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="https://target.com"
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" className="dm-btn-primary" disabled={starting}>
              {starting ? <Loader2 size={16} className="dm-spin" /> : <Crosshair size={16} />}
              {starting ? 'Starting…' : 'Start hunt'}
            </button>
          </div>
          <label className="dm-auth-check">
            <input
              type="checkbox"
              checked={authConfirmed}
              onChange={(e) => setAuthConfirmed(e.target.checked)}
            />
            <span>I confirm I am authorized to security-test this target (I own it or have written permission).</span>
          </label>
        </form>

        {error && <div className="dm-form-error" role="alert" style={{ marginTop: 16 }}><AlertTriangle size={14} /> {error}</div>}

        {dedup && (
          <DedupBanner
            result={dedup}
            onView={() => dedup?.huntRecord?.id && navigate(`/agent/reports/${dedup.huntRecord.id}`)}
            onNewHunt={() => launch({ forceNew: true })}
            onDismiss={() => setDedup(null)}
          />
        )}
      </section>

      <div className="dm-stat-row">
        <div className="dm-stat"><strong>{runningCount}</strong><span>hunts live right now</span></div>
        <div className="dm-stat"><strong>{doneCount}</strong><span>hunts completed</span></div>
        <div className="dm-stat"><strong>{totalFindings}</strong><span>findings so far</span></div>
      </div>

      <div className="dm-home-grid">
        <div className="dm-home-col">
          <section className="dm-panel">
            <h3><Target size={15} /> Recent hunts</h3>
            {jobs.length === 0 ? (
              <p className="dm-empty-note">No hunts yet — your first one is one paste away.</p>
            ) : (
              <ul className="dm-hunt-list">
                {jobs.slice(0, 6).map((job) => (
                  <li key={job.id}>
                    <Link to={`/agent/hunt/${job.id}`} className="dm-hunt-row">
                      <div className="dm-hunt-main">
                        <span className="dm-hunt-target">{job.target || job.targetHostname || job.id}</span>
                        <span className="dm-hunt-meta">
                          {job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}
                          {job.findingsCount != null && ` · ${job.findingsCount} findings`}
                        </span>
                      </div>
                      <StatusPill status={job.status} />
                      <ChevronRight size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="dm-home-col">
          <section className="dm-panel">
            <h3><FileCheck2 size={15} /> Past reports</h3>
            <p className="dm-card-hint">Every completed hunt is archived with a submission-ready report.</p>
            <Link to="/agent/reports" className="dm-card-link" style={{ marginTop: 10 }}>
              Browse reports <ChevronRight size={13} />
            </Link>
          </section>

          <section className="dm-panel">
            <h3><Crosshair size={15} /> How it works</h3>
            <ol className="dm-how-list">
              <li>Paste a URL you own</li>
              <li>Agent maps the attack surface</li>
              <li>Tests hypotheses, safely</li>
              <li>You get a PDF report</li>
            </ol>
          </section>
        </div>
      </div>

      <footer className="dm-home-foot">
        <p className="dm-home-hint">
          Tip: re-pasting a target you've already hunted returns its saved report instantly —
          no need to burn another hunt. Use "Start new hunt" only when you want a fresh look.
        </p>
      </footer>
    </div>
  );
}
