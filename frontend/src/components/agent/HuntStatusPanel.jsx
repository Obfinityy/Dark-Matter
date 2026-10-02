/**
 * HuntStatusPanel — one compact strip under the hunt header:
 * methodology stage stepper (from the real huntState machine), pause/resume
 * controls, a link to the target queues, and the live posture score.
 *
 * Worker 6 mounts the AgentChat panel separately — this component owns only
 * status + posture so the two insertions never collide.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, Loader2, Layers } from 'lucide-react';
import { pauseJob, continueJob } from '../../services/api';
import { PostureScore } from './PostureScore';

const STAGES = ['recon', 'enumeration', 'probing', 'exploitation', 'chaining', 'reporting'];

function currentStage(job) {
  const hs = job?.huntState;
  const fromState = hs && (STAGES.includes(hs.status) ? hs.status : STAGES.includes(hs.stage) ? hs.stage : null);
  if (fromState) return fromState;
  const phase = String(job?.phase || '').toLowerCase();
  return STAGES.includes(phase) ? phase : 'recon';
}

export function HuntStatusPanel({ job, jobId, onJobChanged }) {
  const [busy, setBusy] = useState(null);
  if (!job) return null;

  const status = String(job.status || '').toLowerCase();
  const stage = currentStage(job);
  const stageIndex = STAGES.indexOf(stage);
  const active = ['running', 'resuming', 'waiting', 'created'].includes(status);
  const paused = status === 'paused';

  const act = async (name, fn) => {
    setBusy(name);
    try {
      const body = await fn();
      onJobChanged?.(body?.job || null);
    } catch {
      /* the header surface reports errors; the panel stays quiet */
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="sg-status-panel" aria-label="Hunt status">
      <ol className="sg-stage-stepper">
        {STAGES.map((s, i) => (
          <li
            key={s}
            className={`sg-stage${i < stageIndex ? ' sg-done' : ''}${i === stageIndex ? ' sg-current' : ''}`}
            title={s}
          >
            <span className="sg-stage-dot" />
            <span className="sg-stage-label">{s}</span>
          </li>
        ))}
      </ol>

      <div className="sg-status-panel-right">
        <PostureScore jobId={jobId} />
        {paused ? (
          <button
            type="button"
            className="sg-btn sg-btn-ghost sg-btn-sm"
            disabled={busy}
            onClick={() => act('resume', () => continueJob(jobId))}
          >
            {busy === 'resume' ? <Loader2 size={14} className="sg-spin" /> : <Play size={14} />} Resume
          </button>
        ) : active ? (
          <button
            type="button"
            className="sg-btn sg-btn-ghost sg-btn-sm"
            disabled={busy}
            onClick={() => act('pause', () => pauseJob(jobId))}
          >
            {busy === 'pause' ? <Loader2 size={14} className="sg-spin" /> : <Pause size={14} />} Pause
          </button>
        ) : null}
        <Link to="/agent/queues" className="sg-btn sg-btn-quiet sg-btn-sm" title="Multi-target queues">
          <Layers size={14} /> Queues
        </Link>
      </div>
    </section>
  );
}
