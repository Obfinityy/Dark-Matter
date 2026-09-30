import { id, now } from '../core/utils.js';

/**
 * ComputerTaskModel — durable state for an InfiniteChat computer-control task.
 *
 * This is the object that survives a browser close, an SSE disconnect and a
 * backend restart, exactly like AgentJobModel does for the bug-bounty agent.
 * The HTTP request that creates a task returns immediately; the worker owns the
 * task from then on.
 *
 * There is deliberately NO action quota, no runtime budget and no token budget.
 * A task ends when it completes (verified), fails for a real reason, or is
 * cancelled — never because an arbitrary counter ran out.
 */

export const TASK_STATES = Object.freeze([
  'queued',        // created, not yet claimed by the worker
  'understanding', // interpreting the instruction in conversation context
  'planning',      // brain produced/refreshed a plan
  'executing',     // a computer action is in flight
  'observing',     // observing the desktop after an action
  'verifying',     // checking the observed result against the goal
  'continue',      // loop decision: another action round is needed
  'ask_user',      // the brain needs information from the human
  'waiting_ai',    // local phone AI busy/unreachable — queued, retried
  'waiting_computer', // computer runtime unavailable — queued, retried
  'paused',
  'resuming',
  'completed',
  'failed',
  'cancelled'
]);

export const ACTIVE_TASK_STATES = Object.freeze([
  'queued', 'understanding', 'planning', 'executing', 'observing', 'verifying',
  'continue', 'waiting_ai', 'waiting_computer', 'resuming'
]);

export const RECOVERABLE_TASK_STATES = Object.freeze([
  'queued', 'understanding', 'planning', 'executing', 'observing', 'verifying',
  'continue', 'waiting_ai', 'waiting_computer', 'resuming'
]);

export const TERMINAL_TASK_STATES = Object.freeze(['completed', 'failed', 'cancelled']);

export class ComputerTaskModel {
  constructor(database) {
    this.collection = database.collection('computer_tasks');
  }

  /** Create a task in `queued` state. Persisted before the worker is dispatched. */
  async create({ userId, conversationId, instruction, previousTaskId = null }) {
    const timestamp = now();
    const task = {
      id: id('ctask'),
      userId,
      conversationId,
      instruction: String(instruction || '').slice(0, 5000),

      // Follow-up chaining: "make it more formal" points at the task that came
      // before it, so the brain receives the prior state verbatim.
      previousTaskId,
      continuationOf: Boolean(previousTaskId),

      status: 'queued',
      phase: 'understanding',       // understanding | planning | executing | observing | verifying | finalizing
      goal: String(instruction || '').slice(0, 5000),
      plan: [],
      planUpdatedAt: null,

      // ── Live execution state ─────────────────────────────────────────
      currentApplication: null,
      activeWindow: null,
      currentAction: null,
      lastAction: null,
      lastActionResult: null,
      lastObservation: null,
      generatedContent: null,       // e.g. the leave application the brain wrote
      verificationStatus: 'pending',// pending | verified | failed
      completedActions: [],

      // ── Progress / observability ─────────────────────────────────────
      stepCount: 0,
      brainStatus: 'idle',          // idle | thinking | decided | waiting | stopped
      computerStatus: null,
      errors: [],
      waitingReason: null,

      // ── Conversation output (mirrored into infinite_chats) ───────────
      answerDrafted: false,
      finalMessage: null,

      // ── Controls ─────────────────────────────────────────────────────
      cancelRequested: false,
      answer: null,                 // pending ask_user question
      answerReceivedAt: null,

      // ── Worker lease (duplicate-execution guard) ─────────────────────
      lease: null,
      leaseExpiresAt: null,
      workerStartedAt: null,
      heartbeatAt: null,

      // ── Checkpoint (idempotency after restart) ───────────────────────
      checkpoint: null,
      lastCommittedAction: null,

      // ── Timestamps — the ONLY source of duration ─────────────────────
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: null,
      completedAt: null,
      cancelledAt: null
    };

    await this.collection.insertOne(task);
    return task;
  }

  async get(taskId) {
    return this.collection.findOne({ id: taskId });
  }

  /** Ownership-scoped fetch — user A must never read user B's task. */
  async getForUser(userId, taskId) {
    return this.collection.findOne({ id: taskId, userId });
  }

  /** The most recent task in a conversation (follow-up resolution). */
  async latestForConversation(userId, conversationId) {
    const rows = await this.collection
      .find({ userId, conversationId })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    return rows[0] || null;
  }

  async listByUser(userId, { limit = 50, conversationId = null } = {}) {
    const query = conversationId ? { userId, conversationId } : { userId };
    return this.collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  async listAll({ statuses = null, limit = 200 } = {}) {
    const query = statuses?.length ? { status: { $in: statuses } } : {};
    return this.collection.find(query).sort({ createdAt: 1 }).limit(limit).toArray();
  }

  async listRecoverable() {
    return this.listAll({ statuses: [...RECOVERABLE_TASK_STATES] });
  }

  async update(taskId, patch) {
    await this.collection.updateOne({ id: taskId }, { $set: { ...patch, updatedAt: now() } });
    return this.get(taskId);
  }

  /**
   * Atomically transition the task into a new status.
   * Guards against two workers racing on the same task.
   */
  async transition(taskId, status, extra = {}) {
    if (!TASK_STATES.includes(status)) {
      throw new Error(`Invalid task status: ${status}`);
    }
    const timestamp = now();
    const patch = { status, ...extra };
    if (status === 'completed') patch.completedAt = timestamp;
    if (status === 'cancelled') patch.cancelledAt = timestamp;
    if (status === 'failed') patch.completedAt = timestamp;
    if (status === 'resuming') patch.startedAt = patch.startedAt || null;

    await this.collection.updateOne({ id: taskId }, { $set: { ...patch, updatedAt: timestamp } });
    return this.get(taskId);
  }

  /** Append a structured activity line (drives the InfiniteChat activity feed). */
  async addActivity(taskId, entry) {
    return this.collection.updateOne(
      { id: taskId },
      {
        $push: {
          activity: {
            id: id('tact'),
            at: now(),
            kind: entry.kind || 'info',
            icon: entry.icon || null,
            message: String(entry.message || '').slice(0, 2000),
            detail: entry.detail || null
          }
        },
        $set: { updatedAt: now() }
      }
    );
  }

  async recordError(taskId, error) {
    return this.collection.updateOne(
      { id: taskId },
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

  /** Push a completed action onto the durable history. */
  async pushCompletedAction(taskId, entry) {
    return this.collection.updateOne(
      { id: taskId },
      {
        $push: { completedActions: { ...entry, at: now() } },
        $set: { updatedAt: now() }
      }
    );
  }

  /** Worker liveness — a stale lease means the worker died mid-flight. */
  async heartbeat(taskId, { lease } = {}) {
    const timestamp = now();
    const patch = { heartbeatAt: timestamp, updatedAt: timestamp };
    if (lease) patch.lease = lease;
    await this.collection.updateOne({ id: taskId }, { $set: patch });
  }

  async claim(taskId, { lease, leaseMs, workerStartedAt }) {
    const timestamp = now();
    const leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
    await this.collection.updateOne(
      { id: taskId },
      { $set: { lease, leaseExpiresAt, workerStartedAt, heartbeatAt: timestamp, updatedAt: timestamp } }
    );
    return this.get(taskId);
  }

  async release(taskId) {
    await this.collection.updateOne(
      { id: taskId },
      { $set: { lease: null, leaseExpiresAt: null, updatedAt: now() } }
    );
  }

  async requestCancel(taskId) {
    await this.collection.updateOne({ id: taskId }, { $set: { cancelRequested: true, updatedAt: now() } });
    return this.get(taskId);
  }

  /** Record the user's answer to an ask_user pause; the worker resumes from it. */
  async provideAnswer(taskId, answer) {
    await this.collection.updateOne(
      { id: taskId },
      {
        $set: {
          answer: String(answer || '').slice(0, 4000),
          answerReceivedAt: now(),
          status: 'resuming',
          cancelRequested: false,
          updatedAt: now()
        }
      }
    );
    return this.get(taskId);
  }

  /** Persist a checkpoint so a crash replays nothing already committed. */
  async checkpoint(taskId, checkpoint) {
    const timestamp = now();
    await this.collection.updateOne(
      { id: taskId },
      {
        $set: {
          checkpoint: { ...checkpoint, at: timestamp },
          lastCommittedAction: checkpoint.lastCommittedAction || null,
          updatedAt: timestamp
        }
      }
    );
  }

  async incrementCounters(taskId, counters = {}) {
    const inc = {};
    for (const [key, value] of Object.entries(counters)) {
      if (typeof value === 'number' && value !== 0) inc[key] = value;
    }
    if (Object.keys(inc).length) {
      await this.collection.updateOne({ id: taskId }, { $inc: inc, $set: { updatedAt: now() } });
    }
  }
}
