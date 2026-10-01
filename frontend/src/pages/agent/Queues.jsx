/**
 * Queues — multi-target hunt queues.
 *
 * Create a named queue of targets; the backend hunts them in order within
 * the fair worker pool. Pause/resume the whole queue; delete it when done.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Pause, Play, Trash2, Plus, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { listQueues, createQueue, pauseQueue, resumeQueue, deleteQueue } from '../../services/api';

export function Queues() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [targets, setTargets] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const body = await listQueues();
      setQueues(body?.queues || []);
    } catch { setQueues([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const create = async (e) => {
    e.preventDefault();
    const list = targets.split('\n').map((t) => t.trim()).filter(Boolean);
    if (!list.length) { setError('Add at least one target.'); return; }
    if (!window.confirm('Confirm you are authorized to security-test these targets.')) return;
    setBusy(true);
    setError('');
    try {
      await createQueue({ name: name.trim() || undefined, targets: list, authorizationConfirmed: true });
      setName('');
      setTargets('');
      refresh();
    } catch (err) {
      setError(err.message || 'Could not create the queue.');
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn) => {
    try { await fn(); refresh(); }
    catch (err) { setError(err.message || 'Action failed.'); }
  };

  if (loading) return <div className="dm-page-loading"><Loader2 size={18} className="dm-spin" /> Loading queues…</div>;

  return (
    <div className="dm-queues">
      <header className="dm-page-head">
        <div>
          <h1><Layers size={22} /> Target queues</h1>
          <p>Line up targets — the agent works through them in order, sharing the pool fairly with your other hunts.</p>
        </div>
      </header>

      {error && <div className="dm-form-error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      <form className="dm-card dm-queue-form" onSubmit={create}>
        <h3><Plus size={15} /> New queue</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Queue name (optional)" />
        <textarea
          value={targets}
          onChange={(e) => setTargets(e.target.value)}
          placeholder={'https://one.com\nhttps://two.com/app'}
          rows={4}
          spellCheck={false}
          required
        />
        <button type="submit" className="dm-btn-primary" disabled={busy}>
          {busy ? <Loader2 size={15} className="dm-spin" /> : <Plus size={15} />} Create queue
        </button>
      </form>

      <div className="dm-queue-list">
        {queues.map((queue) => (
          <div key={queue.id} className="dm-card dm-queue-card">
            <div className="dm-queue-head">
              <h3>{queue.name || 'Untitled queue'}</h3>
              <span className={`dm-job-status st-${queue.status}`}>{queue.status}</span>
            </div>
            <p className="dm-card-hint">
              {(queue.targets || []).length} targets · {queue.completedCount || 0} done
              {queue.currentTarget && <> · hunting <code>{queue.currentTarget}</code></>}
            </p>
            <ul className="dm-queue-targets">
              {(queue.targets || []).slice(0, 6).map((t, i) => (
                <li key={i}><code>{typeof t === 'string' ? t : t.target}</code> <span>{t.status || ''}</span></li>
              ))}
              {(queue.targets || []).length > 6 && <li>+{(queue.targets || []).length - 6} more</li>}
            </ul>
            <div className="dm-queue-actions">
              {queue.status === 'paused' ? (
                <button className="dm-btn-ghost" onClick={() => act(() => resumeQueue(queue.id))}><Play size={13} /> Resume</button>
              ) : (
                <button className="dm-btn-ghost" onClick={() => act(() => pauseQueue(queue.id))}><Pause size={13} /> Pause</button>
              )}
              <button className="dm-btn-ghost dm-danger" onClick={() => {
                if (window.confirm('Delete this queue? Completed hunt history is kept.')) act(() => deleteQueue(queue.id));
              }}>
                <Trash2 size={13} /> Delete
              </button>
              {queue.currentJobId && (
                <Link to={`/agent/hunt/${queue.currentJobId}`} className="dm-card-link">
                  Watch live hunt <ChevronRight size={13} />
                </Link>
              )}
            </div>
          </div>
        ))}
        {queues.length === 0 && <p className="dm-card-hint">No queues yet.</p>}
      </div>
    </div>
  );
}
