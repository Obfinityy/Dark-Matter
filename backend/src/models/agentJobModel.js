import crypto from 'node:crypto';
import { id, now } from '../core/utils.js';

/**
 * AgentJobModel — durable state for an autonomous bug-bounty job.
 *
 * This is the object that survives a browser close, an SSE disconnect and a
 * backend restart. The HTTP request that created it returns immediately; the
 * worker owns the job from then on (requirement #15, #69).
 *
 * There is deliberately NO step quota, no runtime budget and no token budget
 * here. A job ends when it completes, fails for a real reason, or is cancelled
 * (requirement #40, #77).
 */

export const JOB_STATES = Object.freeze([
  'queued',
  'starting',
  'running',
  'paused',
  'waiting',
  'resuming',
  'completed',
  'failed',
  'cancelled'
]);

/** States that a booting worker must pick back up. */
export const RECOVERABLE_JOB_STATES = Object.freeze(['queued', 'starting', 'running', 'waiting', 'resuming']);

/** Terminal states — never resumed automatically. */
export const TERMINAL_JOB_STATES = Object.freeze(['completed', 'failed', 'cancelled']);

/** Brain slots that may use a Kaggle link. */
const KAGGLE_SLOTS = ['vision', 'grounding', 'hacker'];

/**
 * Sanitize per-job Kaggle brains: { slot: {url, name} }.
 * Only http(s) Gradio URLs survive; anything else is dropped.
 */
export function sanitizeKaggleBrains(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const slot of KAGGLE_SLOTS) {
    const entry = input[slot];
    if (!entry || typeof entry !== 'object') continue;
    const url = String(entry.url || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+/i.test(url)) continue;
    out[slot] = { url: url.slice(0, 500), name: String(entry.name || '').slice(0, 100) || null };
  }
  return Object.keys(out).length ? out : null;
}

export class AgentJobModel {
  constructor(database) {
    this.collection = database.collection('agent_jobs');
  }

  static leaseId() {
    return `lease_${crypto.randomUUID().slice(0, 12)}`;
  }

  /** Create a job in `queued` state. Persisted before the worker is dispatched. */
  async create({ userId, assessmentId, conversationId = null, target, scope, objective, mode = 'AUTONOMOUS', kaggleBrains = null }) {
    const timestamp = now();
    const job = {
      id: id('job'),
      userId,
      assessmentId,
      conversationId,
      target,
      scope: scope || { included: [], excluded: [] },
      objective: String(objective || '').slice(0, 2000),
      // Kaggle brains for this hunt: { hacker: {url, name}, ... } — the
      // browser connected these links directly to Gradio (no backend).
      // The hunt's think step uses them; everything else runs locally.
      kaggleBrains: sanitizeKaggleBrains(kaggleBrains),

      status: 'queued',
      phase: 'initializing',
      currentObjective: objective || `Assess ${target}`,
      currentStep: null,
      currentAction: null,

      // ── Plan (durable, updated by the brain) ─────────────────────────
      plan: {
        phases: [],
        completedSteps: [],
        pendingSteps: [],
        updatedAt: timestamp
      },

      // ── Progress / observability ─────────────────────────────────────
      stepCount: 0,
      lastObservation: null,
      lastToolExecution: null,
      lastBrainDecision: null,
      brainStatus: 'idle',
      computerStatus: null,
      computerRuntime: 'unknown',
      findingsCount: 0,
      evidenceCount: 0,
      errors: [],
      waitingReason: null,
      reportId: null,
      reportVersion: null,

      // ── Controls ─────────────────────────────────────────────────────
      pauseRequested: false,
      cancelRequested: false,
      resumeCount: 0,

      // ── Worker lease (duplicate-execution guard) ─────────────────────
      lease: null,
      leaseExpiresAt: null,
      workerStartedAt: null,
      heartbeatAt: null,

      // ── Checkpoints (idempotency, requirement #70/#71) ───────────────
      checkpoint: null,
      lastCommittedAction: null,

      // ── Timestamps — the ONLY source of runtime duration ─────────────
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: null,
      completedAt: null,
      pausedAt: null,
      resumedAt: null
    };

    await this.collection.insertOne(job);
    return job;
  }

  async get(jobId) {
    return this.collection.findOne({ id: jobId });
  }

  /** Ownership-scoped fetch — user A must never read user B's job. */
  async getForUser(userId, jobId) {
    return this.collection.findOne({ id: jobId, userId });
  }

  async getByAssessment(assessmentId) {
    const jobs = await this.collection
      .find({ assessmentId })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    return jobs[0] || null;
  }

  async listByUser(userId, { limit = 100 } = {}) {
    return this.collection.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  async listAll({ statuses = null, limit = 100 } = {}) {
    const query = statuses?.length ? { status: { $in: statuses } } : {};
    return this.collection.find(query).sort({ createdAt: 1 }).limit(limit).toArray();
  }

  /** Jobs a restarting worker should recover. */
  async listRecoverable() {
    return this.listAll({ statuses: [...RECOVERABLE_JOB_STATES, 'paused'] });
  }

  async update(jobId, patch) {
    await this.collection.updateOne({ id: jobId }, { $set: { ...patch, updatedAt: now() } });
    return this.get(jobId);
  }

  /**
   * Atomically transition a job into a new status.
   * Guards against two workers racing on the same job.
   */
  async transition(jobId, status, extra = {}) {
    if (!JOB_STATES.includes(status)) {
      throw new Error(`Invalid job status: ${status}`);
    }
    const patch = { status, ...extra };
    const timestamp = now();
    if (status === 'running' && !extra.startedAt) patch.startedAt = timestamp;
    if (status === 'completed') patch.completedAt = timestamp;
    if (status === 'paused') patch.pausedAt = timestamp;
    if (status === 'failed') patch.completedAt = timestamp;
    if (status === 'cancelled') patch.completedAt = timestamp;
    if (status === 'resuming') patch.resumedAt = timestamp;

    await this.collection.updateOne({ id: jobId }, { $set: { ...patch, updatedAt: timestamp } });
    return this.get(jobId);
  }

  /** Append a structured, human-readable activity line (drives the terminal UI). */
  async addActivity(jobId, entry) {
    return this.collection.updateOne(
      { id: jobId },
      {
        $push: {
          activity: {
            id: id('act'),
            at: now(),
            kind: entry.kind || 'info',
            message: String(entry.message || '').slice(0, 2000),
            detail: entry.detail || null
          }
        },
        $set: { updatedAt: now() }
      }
    );
  }

  async recordError(jobId, error) {
    return this.collection.updateOne(
      { id: jobId },
      {
        $push: {
          errors: {
            at: now(),
            message: String(error?.message || error || 'unknown error').slice(0, 1000),
            kind: error?.kind || null,
            fatal: Boolean(error?.fatal)
          }
        },
        $set: { updatedAt: now() }
      }
    );
  }

  /** Worker liveness — a stale lease means the worker died mid-flight. */
  async heartbeat(jobId, { lease, workerStartedAt } = {}) {
    const timestamp = now();
    const patch = { heartbeatAt: timestamp, updatedAt: timestamp };
    if (lease) patch.lease = lease;
    if (workerStartedAt) patch.workerStartedAt = workerStartedAt;
    await this.collection.updateOne({ id: jobId }, { $set: patch });
  }

  async claim(jobId, { lease, leaseMs, workerStartedAt }) {
    const timestamp = now();
    const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
    await this.collection.updateOne(
      { id: jobId },
      { $set: { lease, leaseExpiresAt, workerStartedAt, heartbeatAt: timestamp, updatedAt: timestamp } }
    );
    return this.get(jobId);
  }

  async release(jobId) {
    await this.collection.updateOne(
      { id: jobId },
      { $set: { lease: null, leaseExpiresAt: null, updatedAt: now() } }
    );
  }

  async requestPause(jobId) {
    await this.collection.updateOne({ id: jobId }, { $set: { pauseRequested: true, updatedAt: now() } });
    return this.get(jobId);
  }

  async clearPause(jobId) {
    await this.collection.updateOne({ id: jobId }, { $set: { pauseRequested: false, updatedAt: now() } });
    return this.get(jobId);
  }

  async requestCancel(jobId) {
    await this.collection.updateOne({ id: jobId }, { $set: { cancelRequested: true, updatedAt: now() } });
    return this.get(jobId);
  }

  /** Persist a checkpoint so a crash replays nothing already committed. */
  async checkpoint(jobId, checkpoint) {
    const timestamp = now();
    await this.collection.updateOne(
      { id: jobId },
      {
        $set: {
          checkpoint: { ...checkpoint, at: timestamp },
          lastCommittedAction: checkpoint.lastCommittedAction || null,
          updatedAt: timestamp
        }
      }
    );
  }

  async setPlan(jobId, plan) {
    await this.collection.updateOne(
      { id: jobId },
      { $set: { plan: { ...plan, updatedAt: now() }, updatedAt: now() } }
    );
  }

  async incrementCounters(jobId, counters = {}) {
    const inc = {};
    for (const [key, value] of Object.entries(counters)) {
      if (typeof value === 'number' && value !== 0) inc[key] = value;
    }
    if (Object.keys(inc).length) {
      await this.collection.updateOne({ id: jobId }, { $inc: inc, $set: { updatedAt: now() } });
    }
  }
}
