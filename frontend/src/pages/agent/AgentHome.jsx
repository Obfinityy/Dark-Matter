/**
 * AgentHome — the hunt launcher and mission control.
 *
 *   - Paste a target URL → the agent hunts it. If the target was hunted
 *     before, the dedup banner offers the cached report instantly instead
 *     of re-running (explicit "Start new hunt" bypasses with forceNew).
 *   - Authorization checkbox is required before any hunt starts.
 *   - Multi-target queue: paste several targets, they hunt one after another.
 *   - Recent hunts list with status, plus links to past reports.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Crosshair, Play, ShieldCheck, ListPlus, History, Bell, CalendarClock,
  Layers, AlertTriangle, Loader2, ChevronRight
} from 'lucide-react';
import {
  createJob, listJobs, listHuntRecords, listAlerts,
  extractTargetUrl
} from '../../services/api';
import { DedupBanner } from '../../components/agent/DedupBanner';

export function AgentHome() {
  const navigate = useNavigate();
  const [target, setTarget] = useState('');
  const [objective, setObjective] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deduped, setDeduped] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [records, setRecords] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [queueTargets, setQueueTargets] = useState('');

  const refresh = async () => {
    try {
      const [jobsBody, recordsBody, alertsBody] = await Promise.all([
        listJobs().catch(() => null),
        listHuntRecords().catch(() => null),
        listAlerts(true).catch(() => null)
      ]);
      if (jobsBody?.jobs) setJobs(jobsBody.jobs.slice(0, 8));
      if (recordsBody?.records) setRecords(recordsBody.records.slice(0, 6));
      if (alertsBody?.alerts) setUnreadAlerts(alertsBody.alerts.length);
    } catch { /* dashboard degrades gracefully */ }
  };

  useEffect(() => { refresh(); }, []);

  const startHunt = async (forceNew = false) => {
    const pasted = target.trim();
    if (!pasted) { setError('Paste a target URL to start hunting.'); return; }
    if (!authorized) { setError('Confirm you are authorized to test this target first.'); return; }
    setBusy(true);
    setError('');
    setDeduped(null);
    try {
      const body = await createJob({
        targetUrl: extractTargetUrl(pasted) || pasted,
        message: objective.trim() || undefined,
        authorizationConfirmed: true,
        forceNew
      });
      if (body?.deduped) {
        // Cached report — show it instantly, don't run the agent.
        setDeduped(body);
      } else if (body?.jobId) {
        navigate(`/agent/hunt/${body.jobId}`);
      } else {
        setError('The hunt did not start. Try again.');
      }
    } catch (err) {
      setError(err.code === 'AUTHORIZATION_REQUIRED'
        ? 'Confirm authorization before starting a hunt.'
        : (err.message || 'Could not start the hunt.'));
    } finally {
      setBusy(false);
    }
  };

  const startQueue = async () => {
    const targets = queueTargets.split('\n').map((t) => t.trim()).filter(Boolean);
    if (!targets.length) { setError('Add at least one target to the queue.'); return; }
    if (!authorized) { setError('Confirm you are authorized to test these targets first.'); return; }
    setBusy(true);
    setError('');
    try {
      // Fire hunts sequentially through the fair queue — the backend admits
      // them within per-user caps; the rest wait their turn.
      let firstJobId = null;
      for (const t of targets) {
        const body = await createJob({
          targetUrl: extractTargetUrl(t) || t,
          authorizationConfirmed: true,
          origin: { kind: 'queue', name: 'Quick queue' }
        });
        if (body?.jobId && !firstJobId) firstJobId = body.jobId;
      }
      navigate(firstJobId ? `/agent/hunt/${firstJobId}` : '/agent');
      refresh();
    } catch (err) {
      setError(err.message || 'Could not start the queue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dm-agent-home">
      <header className="dm-page-head">
        <div>
          <h1><Crosshair size={22} /> Agent Command Center</h1>
          <p>Paste a target. The agent hunts it like an elite human expert — non-stop until the report is submission-ready.</p>
        </div>
        <div className="dm-head-links">
          <Link to="/agent/alerts" className="dm-head-link">
            <Bell size={15} /> {unreadAlerts > 0 && <span className="dm-badge">{unreadAlerts}</span>} Alerts
          </Link>
          <Link to="/agent/schedules" className="dm-head-link"><CalendarClock size={15} /> Schedules</Link>
          <Link to="/agent/reports" className="dm-head-link"><History size={15} /> Past reports</Link>
        </div>
      </header>

      {deduped && (
        <DedupBanner
          result={deduped}
          onView={() => navigate(`/agent/reports/${deduped.huntRecord.id}`)}
          onNewHunt={() => startHunt(true)}
          onDismiss={() => setDeduped(null)}
        />
      )}

      <section className="dm-launch-card">
        <h2>Start a hunt</h2>
        <div className="dm-launch-row">
          <input
            className="dm-target-input"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://target.com  — paste any URL"
            spellCheck={false}
            onKeyDown={(e) => { if (e.key === 'Enter') startHunt(false); }}
          />
          <button className="dm-btn-primary dm-btn-big" onClick={() => startHunt(false)} disabled={busy}>
            {busy ? <Loader2 size={17} className="dm-spin" /> : <Play size={17} />}
            Hunt
          </button>
        </div>
        <input
          className="dm-objective-input"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Objective (optional) — e.g. focus on the checkout flow and API"
        />
        <label className="dm-auth-check">
          <input type="checkbox" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} />
          <ShieldCheck size={15} />
          <span>I confirm I am authorized to security-test this target (I own it or have written permission / a bounty program covers it).</span>
        </label>
        {error && <div className="dm-form-error" role="alert"><AlertTriangle size={14} /> {error}</div>}
      </section>

      <div className="dm-home-grid">
        <section className="dm-card">
          <h3><ListPlus size={16} /> Multi-target queue</h3>
          <p className="dm-card-hint">One target per line — they hunt in order, fairly.</p>
          <textarea
            className="dm-queue-input"
            value={queueTargets}
            onChange={(e) => setQueueTargets(e.target.value)}
            placeholder={'https://target-one.com\nhttps://target-two.com/app'}
            rows={4}
            spellCheck={false}
          />
          <button className="dm-btn-secondary" onClick={startQueue} disabled={busy}>
            <Layers size={14} /> Queue {queueTargets.split('\n').filter((t) => t.trim()).length || ''} targets
          </button>
        </section>

        <section className="dm-card">
          <h3><Crosshair size={16} /> Recent hunts</h3>
          {jobs.length === 0 ? (
            <p className="dm-card-hint">No hunts yet — your hunts will appear here.</p>
          ) : (
            <ul className="dm-job-list">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link to={`/agent/hunt/${job.id}`}>
                    <code>{job.target}</code>
                    <span className={`dm-job-status st-${job.status}`}>{job.status}</span>
                    <ChevronRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/agent/reports" className="dm-card-link">Browse all past reports →</Link>
        </section>
      </div>
    </div>
  );
}
