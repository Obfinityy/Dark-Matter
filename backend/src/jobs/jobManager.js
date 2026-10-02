import { AgentJobModel, TERMINAL_JOB_STATES } from '../models/agentJobModel.js';
import { buildAskReply } from '../services/askAgentService.js';
import { normalizeTargetUrl } from '../models/targetModel.js';

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
      recoverOnBoot: config.recoverOnBoot !== false,
      // Worker pool caps (multi-tenancy). maxConcurrent bounds simultaneous
      // hunts process-wide; maxPerUser bounds them per user. Jobs beyond the
      // caps wait in a fair round-robin queue instead of starving anyone.
      maxConcurrent: Number(config.maxConcurrent || process.env.HUNT_MAX_CONCURRENT || 4),
      maxPerUser: Number(config.maxPerUser || process.env.HUNT_MAX_PER_USER || 2)
    };
    /** In-flight dispatch promises, so tests and shutdown can await them. */
    this.dispatches = new Map();
    /**
     * Fair wait queue: [{ jobId, userId, enqueuedAt }] in FIFO order.
     * Served round-robin across users whenever a worker slot frees.
     */
    this.waitQueue = [];
    /** Slots reserved by pumpQueue but not yet counted in worker.running. */
    this.reservedSlots = 0;
    /** Last user served — round-robin rotates past them. */
    this.lastServedUserId = null;
  }

  // ── Creation ──────────────────────────────────────────────────────────
  /**
   * Create a durable job. Returns as soon as the job row exists; the worker
   * picks it up on the next tick.
   */
  async createJob({ userId, assessmentId, target, scope, objective, conversationId = null }) {
    // Hunt-start intake: accept a bare "target.com" and normalize it to a
    // full URL once, here, so every hunt origin (manual, queue, schedule)
    // stores the same canonical target. Invalid values keep the raw input —
    // downstream validation reports the problem.
    let normalizedTarget = target;
    try {
      normalizedTarget = normalizeTargetUrl(target);
    } catch {
      normalizedTarget = target;
    }
    const job = await this.jobModel.create({
      userId,
      assessmentId,
      conversationId,
      target: normalizedTarget,
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
   *
   * Admission-controlled: when the worker pool is full (HUNT_MAX_CONCURRENT)
   * or the user is at their cap (HUNT_MAX_PER_USER), the job waits in a fair
   * round-robin queue instead of being dropped or starving other users.
   */
  dispatch(jobId) {
    if (this.worker.isRunning(jobId)) return this.dispatches.get(jobId) || null;
    if (this.dispatches.has(jobId)) return this.dispatches.get(jobId);

    // Admission needs the job's owner (fairness), so it is async — but the
    // admission promise is tracked immediately so waitFor() works for queued
    // jobs too.
    const admission = this.admit(jobId).catch((error) => {
      this.logger.error?.(`[job-manager] dispatch ${jobId} failed: ${error.message}`);
      return { status: 'failed', error: error.message };
    });
    this.dispatches.set(jobId, admission);
    admission.finally(() => {
      if (this.dispatches.get(jobId) === admission) this.dispatches.delete(jobId);
    });
    return admission;
  }

  /** Decide: run now, or join the fair wait queue. */
  async admit(jobId) {
    const job = await this.jobModel.get(jobId);
    if (!job) return { status: 'not_found' };
    if (this.canRunNow(job)) {
      return this.startRun(job);
    }
    this.enqueue(job);
    const position = this.waitQueue.findIndex((entry) => entry.jobId === jobId) + 1;
    await this.publish(job.id, {
      type: 'job.queued',
      level: 'INFO',
      message: `Hunt queued at position ${position} — a worker slot will pick it up fairly`,
      data: { position, queueLength: this.waitQueue.length }
    });
    return { status: 'queued', position };
  }

  canRunNow(job) {
    if (this.worker.runningCount >= this.config.maxConcurrent) return false;
    if (job.userId && this.worker.runningCountForUser(job.userId) >= this.config.maxPerUser) return false;
    return true;
  }

  /** Start the worker run and pump the queue when a slot frees. */
  startRun(jobRef) {
    // admit() passes the job doc ({ id }), pumpQueue() passes the queue entry
    // ({ jobId }) — normalize once here.
    const id = jobRef.id || jobRef.jobId;
    // Any start counts as serving the user — this is what makes the queue
    // rotate fairly even when the first hunts were admitted directly.
    if (jobRef.userId) this.lastServedUserId = jobRef.userId;
    const promise = (async () => {
      try {
        return await this.worker.run(id);
      } catch (error) {
        this.logger.error?.(`[job-manager] dispatch ${id} failed: ${error.message}`);
        return { status: 'failed', error: error.message };
      } finally {
        this.dispatches.delete(id);
        // A slot freed — serve the fair queue on the next tick so state settles.
        setImmediate(() => this.pumpQueue().catch((error) =>
          this.logger.error?.(`[job-manager] pumpQueue failed: ${error.message}`)
        ));
      }
    })();
    this.dispatches.set(id, promise);
    return promise;
  }

  enqueue(job) {
    if (!this.waitQueue.some((entry) => entry.jobId === job.id)) {
      this.waitQueue.push({ jobId: job.id, userId: job.userId, enqueuedAt: Date.now() });
    }
  }

  /**
   * Serve the wait queue fairly: round-robin across users, each user's
   * earliest-queued job first, always respecting both pool caps. Slots are
   * reserved synchronously so concurrent pumps can never over-admit.
   */
  async pumpQueue() {
    while (this.waitQueue.length > 0) {
      if (this.worker.runningCount + this.reservedSlots >= this.config.maxConcurrent) break;
      const next = this.pickNextFair();
      if (!next) break;
      this.waitQueue = this.waitQueue.filter((entry) => entry.jobId !== next.jobId);
      this.lastServedUserId = next.userId;
      this.reservedSlots += 1;
      try {
        await this.publish(next.jobId, {
          type: 'job.dequeued',
          level: 'INFO',
          message: 'Worker slot freed — starting your queued hunt'
        });
        this.startRun(next).finally(() => {
          this.reservedSlots = Math.max(0, this.reservedSlots - 1);
        });
      } catch (error) {
        this.reservedSlots = Math.max(0, this.reservedSlots - 1);
        this.logger.error?.(`[job-manager] failed to start queued job ${next.jobId}: ${error.message}`);
      }
    }
  }

  /**
   * Fair pick: users ordered round-robin (the last-served user goes last,
   * everyone else by longest-waiting job); the first user under their
   * per-user cap wins, with their earliest-queued job.
   */
  pickNextFair() {
    const byUser = new Map();
    for (const entry of this.waitQueue) {
      if (!byUser.has(entry.userId)) byUser.set(entry.userId, []);
      byUser.get(entry.userId).push(entry);
    }
    const users = [...byUser.keys()].sort((a, b) => {
      if (a === this.lastServedUserId) return 1;
      if (b === this.lastServedUserId) return -1;
      return byUser.get(a)[0].enqueuedAt - byUser.get(b)[0].enqueuedAt;
    });
    for (const userId of users) {
      if (userId && this.worker.runningCountForUser(userId) >= this.config.maxPerUser) continue;
      return byUser.get(userId)[0];
    }
    return null;
  }

  /** Queue depth, for health/monitoring. */
  get queueDepth() {
    return this.waitQueue.length;
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
    // A queued (not yet running) job is simply dequeued — no worker to wake.
    this.waitQueue = this.waitQueue.filter((entry) => entry.jobId !== jobId);
    this.dispatches.delete(jobId);
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
   * "Agent se baat karo" — the user chats with the hunting agent mid-hunt.
   *
   * Deterministic by design: the answer is built ONLY from live persisted
   * state (job doc, findings, reasoning-cycle ledger, activity feed) via
   * buildAskReply — no LLM call, so it works on a plain local machine with
   * zero config. Numbers and "what I'm doing" are never invented; missing
   * data is reported honestly. Per-user isolation via requireJob (404 for
   * other users' jobs).
   */
  async ask(userId, jobId, question) {
    const job = await this.requireJob(userId, jobId);
    const findings = await this.readFindings(job.assessmentId);
    let recentCycles = [];
    try {
      if (this.worker.reasoningCycleModel) {
        recentCycles = await this.worker.reasoningCycleModel.recentSummaries(jobId, { limit: 3 });
      }
    } catch (_) {
      recentCycles = []; // ledger unavailable — answer without it, honestly
    }

    const answer = buildAskReply({ job, findings, recentCycles, question });

    // Best-effort: keep the conversation in the agent's memory + terminal feed.
    try {
      await this.worker.memory.rememberConversation({
        userId,
        assessmentId: job.assessmentId,
        jobId,
        conversationId: job.conversationId,
        content: `USER: ${String(question).slice(0, 500)}
AGENT: ${String(answer.reply).slice(0, 1500)}`
      });
    } catch (_) {}
    try {
      await this.publish(jobId, {
        type: 'agent.chat',
        level: 'INFO',
        message: `User asked the agent: ${String(question).slice(0, 120)}`,
        data: { question: String(question).slice(0, 300), intent: answer.intent }
      });
    } catch (_) {}
    return answer;
  }

  /**
   * Brain-powered ask: when the user's question is NOT a simple status query,
   * the AI agent itself understands and answers — no hardcoded intent rules.
   * "jo zyada bounty de sake wo bugs dikha" → the agent reasons over findings
   * and answers intelligently. "har vulnerability ka alag report bana" →
   * the agent generates them.
   *
   * Falls back to the rule-based reply if the brain is unavailable.
   */
  async askBrain(userId, jobId, question) {
    const job = await this.requireJob(userId, jobId);
    const findings = await this.readFindings(job.assessmentId);

    // Simple status questions still use the fast rule-based path.
    const simplePatterns = /^(kya kar rahe ho|what are you doing|status|progress|kitna hua|kya mila|findings?|report tayyar|ho gaya)/i;
    if (simplePatterns.test(question.trim())) {
      return this.ask(userId, jobId, question);
    }

    // Complex request → let the brain handle it.
    try {
      const jobRecord = await this.worker.jobModel.get(jobId).catch(() => null);
      const brain = this.worker.getBrainForJob ? await this.worker.getBrainForJob(jobRecord) : this.worker.brain;
      if (!brain || !brain.provider) throw new Error('brain unavailable');

      const findingsText = findings.slice(0, 20).map((f, i) =>
        `${i + 1}. [${f.severity}] ${f.title} — ${String(f.description || '').slice(0, 200)}`
      ).join('\n') || '(no findings yet)';

      const prompt = `You are the Dark-Matter bug bounty agent. The user asks you directly:

"${question}"

Job context:
- Target: ${job.target}
- Status: ${job.status}, Phase: ${job.phase}, Steps: ${job.stepCount}
- Findings so far:
${findingsText}

Answer in the user's language (Hindi/Hinglish if they wrote in Hindi, English if English).
Be concrete and helpful. If they want a filtered view of findings (e.g. "only high severity",
"which bugs give most bounty"), analyze the findings above and give exactly that.
If they want reports, describe what you'd generate. Never invent findings that aren't listed.
Keep it focused — no fluff.`;

      const reply = await brain.provider.generate(
        [{ role: 'user', content: prompt }],
        { maxTokens: 1200, timeout: 180000 }
      );
      const cleanReply = String(reply || '').trim() || 'Samajh nahi aaya — thoda aur detail me pucho.';

      // Remember the conversation
      try {
        await this.worker.memory.rememberConversation({
          userId,
          assessmentId: job.assessmentId,
          jobId,
          conversationId: job.conversationId,
          content: `USER: ${String(question).slice(0, 500)}\nAGENT: ${cleanReply.slice(0, 1500)}`
        });
      } catch (_) {}

      return { intent: 'brain', reply: cleanReply, reaction: '🧠', suggestions: [], jobStatus: job.status, phase: job.phase };
    } catch (error) {
      // Brain unavailable → fall back to rules, honestly
      return this.ask(userId, jobId, question);
    }
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
