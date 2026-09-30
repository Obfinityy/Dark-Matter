import { AgentJobModel, TERMINAL_JOB_STATES } from '../models/agentJobModel.js';

/**
 * JobManager — the control plane for autonomous jobs.
 *
 * The HTTP endpoint creates a job, persists it, hands it to the worker and
 * returns the job id. The request lifecycle is NEVER tied to the job lifetime
 * (requirement #19, #69).
 *
 * Pause / Continue / Resume / Cancel semantics (requirement #17, #47, #48):
 *   Pause    → set pauseRequested; the worker finishes the current safe atomic
 *              operation, persists state, then enters `paused`.
 *   Continue → leave `paused`: clear the flag and re-dispatch from the exact
 *              persisted checkpoint.
 *   Resume   → leave an *interrupted / waiting / recoverable* state
 *              (after a restart, a phone outage, a frontend close). The brain
 *              re-reads state and memory and reassesses; it never blindly
 *              replays old actions.
 *   Cancel   → terminal. Assessment history, findings, evidence and reports are
 *              kept.
 */

export class JobManager {
  constructor({ jobModel, assessmentModel, worker, eventService = null, logger = console, config = {} }) {
    this.jobModel = jobModel;
    this.assessmentModel = assessmentModel;
    this.worker = worker;
    this.eventService = eventService;
    this.logger = logger;
    this.config = {
      leaseMs: Number(config.leaseMs || process.env.AGENT_WORKER_LEASE_MS || 60_000),
      recoverOnBoot: config.recoverOnBoot !== false
    };
    /** In-flight dispatch promises, so tests and shutdown can await them. */
    this.dispatches = new Map();
  }

  // ── Creation ──────────────────────────────────────────────────────────
  /**
   * Create a durable job. Returns as soon as the job row exists; the worker
   * picks it up on the next tick.
   */
  async createJob({ userId, assessmentId, target, scope, objective, conversationId = null }) {
    const job = await this.jobModel.create({
      userId,
      assessmentId,
      conversationId,
      target,
      scope,
      objective
    });

    await this.assessmentModel.setStatus(assessmentId, 'planning').catch?.(() => {});
    await this.publish(job.id, {
      type: 'job.created',
      level: 'INFO',
      message: `Autonomous Bug Bounty Agent job queued for ${target}`,
      data: { jobId: job.id, assessmentId, target, scope }
    });

    this.dispatch(job.id);
    return job;
  }

  /**
   * Hand a job to the worker without blocking the caller.
   * A job already running in this process is not dispatched twice (#70).
   */
  dispatch(jobId) {
    if (this.worker.isRunning(jobId)) return this.dispatches.get(jobId) || null;

    const promise = (async () => {
      try {
        return await this.worker.run(jobId);
      } catch (error) {
        this.logger.error?.(`[job-manager] dispatch ${jobId} failed: ${error.message}`);
        return { status: 'failed', error: error.message };
      } finally {
        this.dispatches.delete(jobId);
      }
    })();
    this.dispatches.set(jobId, promise);
    return promise;
  }

  /** Await a job's current dispatch (used by tests and graceful shutdown). */
  async waitFor(jobId, { timeoutMs = 60_000 } = {}) {
    const promise = this.dispatches.get(jobId);
    if (!promise) return null;
    const guard = new Promise((resolve) => setTimeout(() => resolve('timeout'), timeoutMs));
    return Promise.race([promise, guard]);
  }

  // ── Controls ──────────────────────────────────────────────────────────
  async pause(userId, jobId) {
    const job = await this.requireJob(userId, jobId);
    if (TERMINAL_JOB_STATES.includes(job.status)) {
      return { status: 'not_running', jobStatus: job.status };
    }
    await this.jobModel.requestPause(jobId);
    await this.publish(jobId, {
      type: 'job.paused',
      level: 'INFO',
      message: 'Pause requested — the current safe operation will finish, then state is persisted'
    });
    // Wake a sleeping worker so the pause lands immediately.
    this.worker.wake(jobId);
    if (!this.worker.isRunning(jobId)) {
      // Job was not running in this process (e.g. after a restart) — commit it.
      const refreshed = await this.jobModel.get(jobId);
      if (!TERMINAL_JOB_STATES.includes(refreshed.status) && refreshed.status !== 'paused') {
        await this.jobModel.transition(jobId, 'paused', { brainStatus: 'paused' });
        await this.assessmentModel.setStatus(job.assessmentId, 'paused').catch?.(() => {});
      }
    }
    return { status: 'pausing', jobId };
  }

  async continue(userId, jobId) {
    const job = await this.requireJob(userId, jobId);
    if (TERMINAL_JOB_STATES.includes(job.status)) {
      return { status: 'terminal', jobStatus: job.status, message: 'A finished job cannot be continued.' };
    }
    await this.jobModel.clearPause(jobId);
    await this.jobModel.transition(jobId, 'resuming', { brainStatus: 'resuming' });
    await this.publish(jobId, {
      type: 'job.resumed',
      level: 'INFO',
      message: `Continuing from step ${job.stepCount} (phase ${job.phase})`,
      data: { stepCount: job.stepCount, phase: job.phase }
    });
    await this.assessmentModel.setStatus(job.assessmentId, 'running').catch?.(() => {});
    this.dispatch(jobId);
    return { status: 'running', jobId, resumedFromStep: job.stepCount };
  }

  /**
   * Resume an interrupted/recoverable job. State and memory are reloaded by the
   * worker; old actions are not replayed.
   */
  async resume(userId, jobId) {
    const job = await this.requireJob(userId, jobId);
    if (job.status === 'completed') {
      return { status: 'completed', jobId, message: 'Job already completed. Report is available.' };
    }
    if (job.status === 'cancelled') {
      return { status: 'cancelled', jobId, message: 'Cancelled jobs are not resumed. Create a new job to continue testing.' };
    }
    if (job.status === 'failed') {
      return { status: 'failed', jobId, message: 'Failed jobs are not auto-resumed; inspect errors and create a new job.' };
    }

    await this.jobModel.clearPause(jobId);
    await this.jobModel.incrementCounters(jobId, { resumeCount: 1 });
    await this.jobModel.transition(jobId, 'resuming', { brainStatus: 'resuming', waitingReason: null });
    await this.publish(jobId, {
      type: 'job.resumed',
      level: 'INFO',
      message: `Resuming job from the last persisted checkpoint (step ${job.stepCount}, phase ${job.phase})`,
      data: { stepCount: job.stepCount, phase: job.phase, previousStatus: job.status }
    });
    await this.assessmentModel.setStatus(job.assessmentId, 'running').catch?.(() => {});
    this.dispatch(jobId);
    return { status: 'running', jobId, recoveredFrom: job.status, stepCount: job.stepCount };
  }

  async cancel(userId, jobId) {
    const job = await this.requireJob(userId, jobId);
    if (TERMINAL_JOB_STATES.includes(job.status)) {
      return { status: job.status, jobId, message: 'Job already finished.' };
    }
    await this.jobModel.requestCancel(jobId);
    await this.publish(jobId, {
      type: 'job.cancelled',
      level: 'WARN',
      message: 'Cancel requested — the agent will stop at the next safe point. History is preserved.'
    });
    this.worker.wake(jobId);
    if (!this.worker.isRunning(jobId)) {
      await this.jobModel.transition(jobId, 'cancelled', { brainStatus: 'cancelled' });
      await this.assessmentModel.setStatus(job.assessmentId, 'stopped').catch?.(() => {});
    }
    return { status: 'cancelling', jobId };
  }

  // ── Reads (observability / replay) ────────────────────────────────────
  async requireJob(userId, jobId) {
    const job = await this.jobModel.getForUser(userId, jobId);
    if (!job) {
      const error = new Error('Job not found for this user');
      error.status = 404;
      error.code = 'JOB_NOT_FOUND';
      throw error;
    }
    return job;
  }

  /** Full state snapshot for a returning frontend (requirement #18, #67). */
  async getState(userId, jobId) {
    const job = await this.requireJob(userId, jobId);
    const findings = await this.readFindings(job.assessmentId);
    const evidenceCount = await this.countEvidence(job.assessmentId);
    const events = this.eventService ? await this.eventService.list(jobId) : [];

    return {
      job,
      runtime: {
        startedAt: job.startedAt || job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        // Duration must come from persisted timestamps, never a browser timer.
        elapsedMs: (job.completedAt ? new Date(job.completedAt) : new Date()).getTime() - new Date(job.startedAt || job.createdAt).getTime()
      },
      findings,
      evidenceCount,
      activity: (job.activity || []).slice(-300),
      eventCount: events.length,
      lastEventId: events.length ? events[events.length - 1].id : null,
      workerRunning: this.worker.isRunning(jobId),
      queue: this.worker.brain?.queue?.stats?.() || null
    };
  }

  async readFindings(assessmentId) {
    const model = this.worker.findingModel;
    return model ? model.list(assessmentId) : [];
  }

  async countEvidence(assessmentId) {
    const model = this.worker.evidenceModel;
    if (!model) return 0;
    const rows = await model.list(assessmentId);
    return rows.length;
  }

  /** Event history for replay after a reconnect (requirement #50). */
  async listEvents(userId, jobId, { afterId = null, limit = 500 } = {}) {
    await this.requireJob(userId, jobId);
    if (!this.eventService) return { events: [] };
    const events = await this.eventService.list(jobId);
    let sliced = events;
    if (afterId) {
      const index = events.findIndex((event) => event.id === afterId);
      sliced = index >= 0 ? events.slice(index + 1) : events;
    }
    return { events: sliced.slice(-limit) };
  }

  async list(userId) {
    return this.jobModel.listByUser(userId);
  }

  /**
   * Agent → Chat (requirement #60): the user asks the running assessment a
   * question. The local brain answers from CURRENT persisted memory, findings
   * and state. If it is not in memory, the answer is "unknown" — never invented
   * (requirement #62).
   */
  async ask(userId, jobId, question) {
    const job = await this.requireJob(userId, jobId);
    const memoryContext = await this.worker.memory.buildBrainContext({
      userId,
      assessmentId: job.assessmentId,
      query: question,
      maxTokens: 1400
    });
    const findings = await this.readFindings(job.assessmentId);
    const answer = await this.worker.brain.answerQuestion({ job, question, memoryContext: memoryContext.text, findings });

    await this.worker.memory.rememberConversation({
      userId,
      assessmentId: job.assessmentId,
      jobId,
      conversationId: job.conversationId,
      content: `USER: ${String(question).slice(0, 500)}\nAGENT: ${String(answer.text || '').slice(0, 1500)}`
    });
    await this.publish(jobId, {
      type: 'agent.chat',
      level: 'INFO',
      message: `Agent answered a user question`,
      data: { question: String(question).slice(0, 300) }
    });
    return { answer: answer.text, model: answer.model, jobStatus: job.status, phase: job.phase };
  }

  // ── Crash / restart recovery (requirement #13 phase, #70) ─────────────
  /**
   * Called once at boot. Jobs left in a non-terminal state and jobs whose
   * worker lease expired are picked back up. Jobs that were explicitly paused
   * STAY paused — a restart must not silently override a user's pause.
   */
  async recoverIncompleteJobs() {
    if (!this.config.recoverOnBoot) return { recovered: 0, paused: 0 };

    const jobs = await this.jobModel.listRecoverable();
    let recovered = 0;
    let paused = 0;

    for (const job of jobs) {
      if (job.status === 'paused' || job.pauseRequested) {
        paused += 1;
        continue;
      }
      if (job.cancelRequested) {
        await this.jobModel.transition(job.id, 'cancelled', { brainStatus: 'cancelled' });
        continue;
      }
      if (this.worker.isRunning(job.id)) continue;

      await this.jobModel.transition(job.id, 'resuming', {
        brainStatus: 'recovering',
        waitingReason: null
      });
      await this.publish(job.id, {
        type: 'job.resumed',
        level: 'INFO',
        message: `Backend restarted — recovering job from checkpoint (step ${job.stepCount}, phase ${job.phase})`,
        data: { stepCount: job.stepCount, phase: job.phase }
      });
      this.dispatch(job.id);
      recovered += 1;
    }

    if (recovered || paused) {
      this.logger.log?.(`[job-manager] recovery: ${recovered} job(s) resumed, ${paused} left paused`);
    }
    return { recovered, paused };
  }

  async stopAll() {
    await this.worker.stopAll();
  }

  async publish(jobId, event) {
    if (!this.eventService || !jobId) return null;
    try {
      return await this.eventService.publish(jobId, event);
    } catch {
      return null;
    }
  }
}

export { AgentJobModel, TERMINAL_JOB_STATES };
