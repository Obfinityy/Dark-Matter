/**
 * Schedules — hunts that run themselves.
 *
 * Schedule a target on a cadence (once / daily / weekly). The backend fires
 * each schedule on time and sends an alert when the hunt starts; completed
 * reports land in Past reports like any other hunt.
 */
import React, { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, Loader2, AlertTriangle, Pause, Play } from 'lucide-react';
import { listSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../services/api';

const CADENCES = [
  { id: 'once', label: 'Once' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' }
];

export function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', target: '', cadence: 'weekly', nextRunAt: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      const body = await listSchedules();
      setSchedules(body?.schedules || []);
    } catch { setSchedules([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!form.target.trim()) { setError('Enter a target.'); return; }
    setBusy(true);
    setError('');
    try {
      await createSchedule({
        name: form.name.trim() || undefined,
        target: form.target.trim(),
        cadence: form.cadence,
        nextRunAt: form.nextRunAt ? new Date(form.nextRunAt).toISOString() : undefined
      });
      setForm({ name: '', target: '', cadence: 'weekly', nextRunAt: '' });
      refresh();
    } catch (err) {
      setError(err.message || 'Could not create the schedule.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (schedule) => {
    try {
      await updateSchedule(schedule.id, { enabled: !schedule.enabled });
      refresh();
    } catch (err) {
      setError(err.message || 'Could not update the schedule.');
    }
  };

  if (loading) return <div className="dm-page-loading"><Loader2 size={18} className="dm-spin" /> Loading schedules…</div>;

  return (
    <div className="dm-schedules">
      <header className="dm-page-head">
        <div>
          <h1><CalendarClock size={22} /> Scheduled hunts</h1>
          <p>Set it and forget it — the agent hunts on cadence and alerts you when each run starts and finishes.</p>
        </div>
      </header>

      {error && <div className="dm-form-error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      <form className="dm-card dm-schedule-form" onSubmit={create}>
        <h3><Plus size={15} /> New schedule</h3>
        <div className="dm-form-row">
          <input
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            placeholder="https://target.com"
            spellCheck={false}
            required
          />
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name (optional)"
          />
        </div>
        <div className="dm-form-row">
          <select value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })}>
            {CADENCES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <input
            type="datetime-local"
            value={form.nextRunAt}
            onChange={(e) => setForm({ ...form, nextRunAt: e.target.value })}
            title="First run (defaults to now)"
          />
          <button type="submit" className="dm-btn-primary" disabled={busy}>
            {busy ? <Loader2 size={15} className="dm-spin" /> : <Plus size={15} />} Schedule
          </button>
        </div>
      </form>

      <div className="dm-schedule-list">
        {schedules.map((schedule) => (
          <div key={schedule.id} className={`dm-card dm-schedule-card ${schedule.enabled ? '' : 'disabled'}`}>
            <div className="dm-schedule-head">
              <div>
                <strong>{schedule.name || schedule.target}</strong>
                <code className="dm-schedule-target">{schedule.target}</code>
              </div>
              <span className={`dm-job-status ${schedule.enabled ? 'st-running' : 'st-paused'}`}>
                {schedule.enabled ? schedule.cadence : 'disabled'}
              </span>
            </div>
            <p className="dm-card-hint">
              {schedule.nextRunAt ? <>Next run: {new Date(schedule.nextRunAt).toLocaleString()}</> : 'Next run: —'}
              {schedule.lastRunAt && <> · Last run: {new Date(schedule.lastRunAt).toLocaleString()}</>}
            </p>
            <div className="dm-queue-actions">
              <button className="dm-btn-ghost" onClick={() => toggle(schedule)}>
                {schedule.enabled ? <><Pause size={13} /> Disable</> : <><Play size={13} /> Enable</>}
              </button>
              <button className="dm-btn-ghost dm-danger" onClick={() => {
                if (window.confirm('Delete this schedule?')) deleteSchedule(schedule.id).then(refresh).catch((err) => setError(err.message));
              }}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        ))}
        {schedules.length === 0 && <p className="dm-card-hint">No schedules yet.</p>}
      </div>
    </div>
  );
}
