/**
 * PausedHuntsBanner — resume hunts from their checkpoint after the browser
 * was closed.
 *
 * When the user pauses a hunt (or the browser closes mid-hunt), the backend
 * persists the exact checkpoint: step count, phase, findings so far. This
 * banner surfaces every paused hunt on the agent homepage so one tap resumes
 * from the checkpoint — the hunt never restarts from zero.
 *
 * Part of: Dark Matter frontend (Hunt AI).
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pause, Play, Loader2, X } from 'lucide-react';
import { listJobs, continueJob, resumeJob, cancelJob } from '../../services/api';

function jobTarget(job) {
  return job?.targetUrl || job?.target || job?.domain || 'a target';
}

function checkpointLabel(job) {
  const step = job?.stepCount ?? job?.stepsCompleted;
  const phase = job?.phase;
  const bits = [];
  if (typeof step === 'number') bits.push(`step ${step}`);
  if (phase) bits.push(String(phase));
  return bits.length ? `paused at ${bits.join(' · ')}` : 'paused';
}

export default function PausedHuntsBanner() {
  const navigate = useNavigate();
  const [paused, setPaused] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dm_paused_dismissed') || '[]');
    } catch {
      return [];
    }
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const body = await listJobs().catch(() => null);
      const jobs = body?.jobs || [];
      // Paused hunts wait for the user. Also surface jobs stuck in
      // 'waiting' — e.g. the worker restarted mid-hunt and needs a resume.
      setPaused(
        jobs.filter(j => {
          const s = String(j?.status || '').toLowerCase();
          return s === 'paused' || s === 'waiting';
        })
      );
    } catch {
      /* banner degrades to hidden rather than crashing the homepage */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dismiss = id => {
    setDismissed(prev => {
      const next = [...prev, id];
      try {
        localStorage.setItem('dm_paused_dismissed', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const doResume = async job => {
    const id = job?.id || job?._id;
    if (!id) return;
    setBusyId(id);
    try {
      const status = String(job?.status || '').toLowerCase();
      // Paused → continue from the persisted checkpoint.
      // Waiting → resume the worker from its last state.
      if (status === 'paused') await continueJob(id);
      else await resumeJob(id);
      navigate(`/agent/hunt-job/${id}`);
    } catch {
      // Stay on the banner; the hunt view will surface the error detail.
      navigate(`/agent/hunt-job/${id}`);
    } finally {
      setBusyId(null);
    }
  };

  const doDiscard = async job => {
    const id = job?.id || job?._id;
    if (!id) return;
    setBusyId(id);
    try {
      await cancelJob(id);
    } catch {
      /* best effort */
    } finally {
      setBusyId(null);
      dismiss(id);
      refresh();
    }
  };

  if (loading) return null;
  const visible = paused.filter(j => !dismissed.includes(j?.id || j?._id));
  if (!visible.length) return null;

  return (
    <div
      role="region"
      aria-label="Paused hunts"
      style={{
        border: '1px solid var(--dm-gold)',
        borderRadius: '12px',
        background: 'color-mix(in srgb, var(--dm-gold) 8%, var(--dm-surface-1))',
        padding: '14px 16px',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: 'var(--dm-text-base)',
          color: 'var(--dm-text-1)',
        }}
      >
        <Pause size={17} style={{ color: 'var(--dm-gold)' }} aria-hidden="true" />
        Paused hunt{visible.length > 1 ? 's' : ''} — resume from checkpoint
      </div>
      {visible.map(job => {
        const id = job?.id || job?._id;
        const busy = busyId === id;
        return (
          <div
            key={id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              fontSize: 'var(--dm-text-sm)',
              color: 'var(--dm-text-2)',
            }}
          >
            <span
              style={{
                color: 'var(--dm-text-1)',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '320px',
              }}
              title={jobTarget(job)}
            >
              {jobTarget(job)}
            </span>
            <span>{checkpointLabel(job)}</span>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => doResume(job)}
              disabled={busy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--dm-gold)',
                color: '#0a0a0a',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: 'var(--dm-text-sm)',
                fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              {busy ? <Loader2 size={14} className="sg-spin" /> : <Play size={14} />}
              Resume from checkpoint
            </button>
            <button
              type="button"
              onClick={() => doDiscard(job)}
              disabled={busy}
              title="Discard this paused hunt"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: '1px solid var(--dm-border)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: 'var(--dm-text-sm)',
                color: 'var(--dm-text-2)',
                cursor: busy ? 'wait' : 'pointer',
              }}
            >
              <X size={14} /> Discard
            </button>
          </div>
        );
      })}
      <p style={{ margin: 0, fontSize: 'var(--dm-text-xs)', color: 'var(--dm-text-3)' }}>
        Resume continues exactly where the hunt stopped — findings and progress are kept, nothing
        restarts from zero.
      </p>
    </div>
  );
}
