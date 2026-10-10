/**
 * Queues — multi-target hunt queues.
 *
 * Create a named queue of targets; the backend hunts them in order within
 * the fair worker pool. Pause/resume the whole queue; delete it when done.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Pause,
  Play,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
  ChevronRight,
  CalendarClock,
} from 'lucide-react';
import './Queues.css';
import '../../styles/kinetic-data.css';
import { listQueues, createQueue, pauseQueue, resumeQueue, deleteQueue } from '../../services/api';

export function Queues() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [targets, setTargets] = useState('');
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const body = await listQueues();
      setQueues(body?.queues || []);
    } catch {
      setQueues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const create = async e => {
    e.preventDefault();
    const list = targets
      .split('\n')
      .map(t => t.trim())
      .filter(Boolean);
    if (!list.length) {
      setError('Add at least one target.');
      return;
    }
    if (!window.confirm('Confirm you are authorized to security-test these targets.')) return;
    setBusy(true);
    setError('');
    try {
      await createQueue({
        name: name.trim() || undefined,
        targets: list,
        authorizationConfirmed: true,
      });
      setName('');
      setTargets('');
      refresh();
    } catch (err) {
      setError(err.message || 'Could not create the queue.');
    } finally {
      setBusy(false);
    }
  };

  const act = async fn => {
    if (acting) return;
    setActing(true);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err.message || 'Action failed.');
    } finally {
      setActing(false);
    }
  };

  if (loading)
    return (
      <div className="dm-page-loading kda-page" role="status">
        <Loader2 size={18} aria-hidden="true" className="sg-spin" /> Loading queues…
      </div>
    );

  return (
    <div className="dm-queues kda-page">
      <header className="dm-queues-head">
        <div className="dm-page-head kda-head">
          <h1 className="kda-title">
            <Layers size={22} aria-hidden="true" />{' '}
            <span className="kda-w" style={{ '--kda-d': '0ms' }}>
              Target
            </span>{' '}
            <span className="kda-w" style={{ '--kda-d': '90ms' }}>
              queues
            </span>
          </h1>
          <p className="kda-sub" style={{ '--kda-d': '220ms' }}>
            Line up targets — the agent works through them in order, sharing the pool fairly with
            your other hunts.
          </p>
        </div>
        <Link to="/agent/schedules" className="dm-btn-ghost kda-cta">
          <CalendarClock size={13} aria-hidden="true" /> Scheduled hunts
        </Link>
      </header>

      {error && (
        <div className="dm-form-error" role="alert">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </div>
      )}

      <form className="dm-card dm-queue-form" onSubmit={create}>
        <h3>
          <Plus size={15} aria-hidden="true" /> New queue
        </h3>
        <label className="dm-form-label">
          Queue name
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Optional — e.g. staging sweep"
            autoComplete="off"
            maxLength={80}
          />
        </label>
        <label className="dm-form-label">
          Targets
          <textarea
            value={targets}
            onChange={e => setTargets(e.target.value)}
            placeholder={'https://one.com\nhttps://two.com/app'}
            rows={4}
            spellCheck={false}
            required
            aria-describedby="queue-targets-hint"
          />
          <span className="dm-form-hint" id="queue-targets-hint">
            One target per line — the agent works through them top to bottom.
          </span>
        </label>
        <button type="submit" className="dm-btn-primary" disabled={busy}>
          {busy ? (
            <Loader2 size={15} aria-hidden="true" className="sg-spin" />
          ) : (
            <Plus size={15} aria-hidden="true" />
          )}{' '}
          Create queue
        </button>
      </form>

      <div className="dm-queue-list" aria-busy={acting || undefined}>
        {queues.map((queue, i) => {
          const queueName = queue.name || 'Untitled queue';
          const total = (queue.targets || []).length;
          const done = queue.completedCount || 0;
          const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
          const paused = queue.status === 'paused';
          return (
            <div
              key={queue.id || i}
              className="dm-card dm-queue-card kda-card kda-rise"
              style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
            >
              <div className="dm-queue-head">
                <h3 className="kda-card-title">{queueName}</h3>
                <span className={`dm-job-status kda-status st-${queue.status}`}>{queue.status}</span>
              </div>
              <p className="dm-card-hint">
                {total} targets · {done} done
                {queue.currentTarget && (
                  <>
                    {' '}
                    · hunting <code>{queue.currentTarget}</code>
                  </>
                )}
              </p>
              {total > 0 && (
                <div
                  className="dm-queue-progress"
                  role="progressbar"
                  aria-valuenow={done}
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-label={`Progress of queue ${queueName}`}
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
              )}
              <ul className="dm-queue-targets">
                {(queue.targets || []).slice(0, 6).map((t, j) => (
                  <li key={j}>
                    <code>{typeof t === 'string' ? t : t.url || t.target}</code>
                    {t.status ? <span>{t.status}</span> : null}
                  </li>
                ))}
                {(queue.targets || []).length > 6 && (
                  <li>+{(queue.targets || []).length - 6} more</li>
                )}
              </ul>
              <div className="dm-queue-actions">
                {paused ? (
                  <button
                    className="dm-btn-ghost"
                    onClick={() => act(() => resumeQueue(queue.id))}
                    aria-label={`Resume queue ${queueName}`}
                    disabled={acting}
                  >
                    <Play size={13} aria-hidden="true" /> Resume
                  </button>
                ) : (
                  <button
                    className="dm-btn-ghost"
                    onClick={() => act(() => pauseQueue(queue.id))}
                    aria-label={`Pause queue ${queueName}`}
                    disabled={acting}
                  >
                    <Pause size={13} aria-hidden="true" /> Pause
                  </button>
                )}
                <button
                  className="dm-btn-ghost dm-danger"
                  aria-label={`Delete queue ${queueName}`}
                  disabled={acting}
                  onClick={() => {
                    if (window.confirm('Delete this queue? Completed hunt history is kept.'))
                      act(() => deleteQueue(queue.id));
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" /> Delete
                </button>
                {queue.currentJobId && (
                  <Link to={`/agent/hunt/${queue.currentJobId}`} className="dm-card-link">
                    Watch live hunt <ChevronRight size={13} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
        {queues.length === 0 && (
          <div className="dm-empty-state">
            <Layers size={28} aria-hidden="true" />
            <strong>No queues yet</strong>
            <p>
              Create a queue above to line up targets — the agent works through them in order,
              sharing the pool fairly with your other hunts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
