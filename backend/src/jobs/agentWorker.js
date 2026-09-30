import crypto from 'node:crypto';
import { ScopeEngine } from '../agent/scopeEngine.js';
import { LocalAiUnavailableError } from '../agent/autonomousBrain.js';
import { VALID_PHASES } from '../models/assessmentModel.js';

/**
 * AgentWorker — the autonomous bug-bounty loop. THE HEART OF DARKMATTER.
 *
 *   START JOB → LOAD MEMORY → LOAD TARGET/SCOPE → LOCAL AI THINKS → PLAN
 *   → SELECT ACTION → POLICY/SCOPE VALIDATION → TOOL/COMPUTER ACTION
 *   → OBSERVE → STORE → LOCAL AI REASONS AGAIN → … → COMPLETE → REPORT
 *
 * Design constraints honoured here:
 *   • The loop runs in the worker, never inside an HTTP request (#69).
 *   • Zero artificial quotas: no step cap, no runtime cap, no token cap (#40,#77).
 *     The only exits are complete / cancelled / a real failure / a waiting state.
 *   • Pause is safe: it is only honoured *between* atomic operations (#47).
 *   • Every transition is persisted before the next action, so a crash replays
 *     nothing already committed (#70, #71).
 *   • The local phone Gemma is the only brain; if it is unreachable the job goes
 *     to `waiting` with reason LOCAL AI UNAVAILABLE — never to a cloud model (#2).
 */

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);

/** Liveness guard, not a quota: the agent must not spin on an identical no-op. */
const NO_PROGRESS_REPEAT_LIMIT = Number(process.env.AGENT_NO_PROGRESS_REPEAT_LIMIT || 5);

export class AgentWorker {
  constructor({
    jobModel,
    assessmentModel,
    brain,
    memory,
    toolExecutor,
    toolExecutionModel,
    computer = null,
    computerState = null,
    computerEvents = null,
    findingLifecycle,
    evidenceModel,
    stateManager,
    eventService,
    reportService = null,
    findingModel = null,
    logger = console
  }) {
    this.jobModel = jobModel;
    this.assessmentModel = assessmentModel;
    this.brain = brain;
    this.memory = memory;
    this.toolExecutor = toolExecutor;
    this.toolExecutionModel = toolExecutionModel;
    this.computer = computer;
    this.computerState = computerState;
    this.computerEvents = computerEvents;
    this.findingLifecycle = findingLifecycle;
    this.evidenceModel = evidenceModel;
    this.stateManager = stateManager;
    this.eventService = eventService;
    this.reportService = reportService;
    this.findingModel = findingModel;
    this.logger = logger;
    this.config = {
      idleDelayMs: Number(process.env.AGENT_WORKER_IDLE_MS || 500),
      phoneRetryMs: Number(process.env.AGENT_PHONE_RETRY_MS || 15_000),
      contextRetryMs: Number(process.env.AGENT_CONTEXT_RETRY_MS || 60_000)
    };
    this.noProgress = new Map();
    this.brainErrors = new Map();

    /** jobId → { abort, wake } so pause/cancel/shutdown act immediately. */
    this.running = new Map();
    this.noProgress = new Map();
    this.brainErrors = new Map();
    this.stopped = false;
  }

  isRunning(jobId) {
    return this.running.has(jobId);
  }

  get runningJobIds() {
    return [...this.running.keys()];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  /**
   * Run a job to a terminal (or waiting/paused) state. Safe to call twice:
   * a duplicate dispatch is a no-op, not a second execution (#70).
   */
  async run(jobId) {
    if (this.running.has(jobId)) return { status: 'already_running' };
    const job = await this.jobModel.get(jobId);
    if (!job) return { status: 'not_found' };
    if (TERMINAL.has(job.status)) return { status: job.status };

    const control = { abort: false, wake: null };
    this.running.set(jobId, control);

    try {
      await this.jobModel.claim(jobId, {
        lease: `lease_${crypto.randomUUID().slice(0, 12)}`,
        leaseMs: Number(process.env.AGENT_WORKER_LEASE_MS || 60_000),
        workerStartedAt: new Date().toISOString()
      });
      await this.jobModel.transition(jobId, 'starting', { brainStatus: 'initializing' });
      await this.publish(jobId, {
        type: 'job.started',
        level: 'INFO',
        message: `Autonomous Bug Bounty Agent started for ${job.target}`,
        data: { target: job.target, scope: job.scope, objective: job.objective }
      });

      await this.assessmentModel.setStatus(job.assessmentId, 'running');
      await this.jobModel.transition(jobId, 'running');
      await this.recordActivity(jobId, { kind: 'agent', message: 'Agent started' });
      await this.recordActivity(jobId, { kind: 'scope', message: `Scope loaded: ${(job.scope?.included || [job.target]).join(', ')}` });

      await this.loop(jobId);
      return { status: 'finished' };
    } catch (error) {
      this.logger.error?.(`[agent-worker] job ${jobId} crashed:`, error.message);
      await this.jobModel.recordError(jobId, { message: error.message, fatal: true });
      await this.jobModel.transition(jobId, 'failed', { waitingReason: null });
      await this.assessmentModel.setStatus(job.assessmentId, 'failed', { error: error.message }).catch?.(() => {});
      await this.publish(jobId, {
        type: 'job.failed',
        level: 'ERROR',
        message: `Job failed: ${error.message}`,
        data: { error: error.message }
      });
      return { status: 'failed', error: error.message };
    } finally {
      this.running.delete(jobId);
      await this.jobModel.release(jobId).catch?.(() => {});
    }
  }

  // ── The loop itself ───────────────────────────────────────────────────
  async loop(jobId) {
    while (true) {
      const control = this.running.get(jobId);
      if (!control || control.abort || this.stopped) return;

      let job = await this.jobModel.get(jobId);
      if (!job) return;
      if (TERMINAL.has(job.status)) return;

      // ── Cancel / pause are honoured strictly *between* operations ──────
      if (job.cancelRequested) {
        await this.cancelJob(job, 'cancelled by user');
        return;
      }
      if (job.pauseRequested) {
        await this.pauseJob(job);
        return;
      }

      await this.jobModel.heartbeat(jobId, { lease: job.lease });
      await this.assessmentModel.setStatus(job.assessmentId, 'running').catch?.(() => {});

      // ── Brain availability: the phone is the only reasoning engine ─────
      const health = await this.brain.health();
      if (!health.available) {
        await this.enterWaiting(job, {
          reason: health.reason || 'LOCAL AI UNAVAILABLE',
          event: 'brain.unavailable',
          message: `LOCAL AI UNAVAILABLE — ${health.reason || 'phone model unreachable'}. Waiting to recover; no cloud fallback will be used.`
        });
        await this.sleepInterruptible(jobId, this.config.phoneRetryMs);
        continue;
      }
      // ── Reason ─────────────────────────────────────────────────────────
      // A job parked in `waiting` stays there until a decision actually
      // succeeds, so we never flip-flop status every retry.
      try {
        job = await this.stepReason(job);
      } catch (error) {
        if (error instanceof LocalAiUnavailableError) {
          await this.enterWaiting(job, {
            reason: error.message,
            event: error.kind === 'context_window' ? 'brain.decision' : 'brain.unavailable',
            message: error.kind === 'context_window'
              ? `Local model context too small: ${error.message}`
              : error.message
          });
          // A context-size problem needs an operator to raise
          // PHONE_AI_CONTEXT_TOKENS, so retry on a slower cadence.
          await this.sleepInterruptible(
            jobId,
            error.kind === 'context_window' ? this.config.contextRetryMs : this.config.phoneRetryMs
          );
          continue;
        }
        throw error;
      }
      if (!job) return;
      if (TERMINAL.has(job.status)) return;
    }
  }

  async stepReason(job) {
    const jobId = job.id;
    const scopeEngine = new ScopeEngine(job.scope, job.target);

    const [memoryContext, findings, activity, toolResults] = await Promise.all([
      this.memory.buildBrainContext({
        userId: job.userId,
        assessmentId: job.assessmentId,
        query: `${job.currentObjective || job.objective} ${job.target}`,
        maxTokens: 1100
      }),
      this.findingModel ? this.findingModel.list(job.assessmentId) : Promise.resolve([]),
      Promise.resolve(job.activity || []),
      this.toolExecutionModel.list(job.assessmentId)
    ]);

    const computerStatus = this.computerState ? this.computerState.snapshot() : null;

    let decision;
    try {
      ({ decision } = await this.brain.decide({
        job,
        memoryContext: memoryContext.text,
        // The job's persisted activity feed IS the real observation stream.
        recentObservations: (activity || []).map((item) => ({
          kind: item.kind,
          summary: item.message
        })),
        toolResults: (toolResults || []).map((execution) => ({
          tool: execution.tool,
          target: execution.target,
          summary: execution.aiSummary || execution.error || execution.status
        })),
        findings,
        computerStatus
      }));
    } catch (error) {
      if (error instanceof LocalAiUnavailableError) throw error; // outer loop handles
      await this.jobModel.recordError(jobId, { message: error.message, kind: error.code || 'brain_error' });
      await this.publish(jobId, {
        type: 'brain.decision',
        level: 'WARN',
        message: `Local AI produced an unusable decision: ${error.message}`,
        data: { raw: String(error.raw || '').slice(0, 1000) }
      });
      await this.recordActivity(jobId, { kind: 'brain', message: `Rejected malformed decision: ${error.message}` });

      // A model that keeps emitting unusable JSON is a real (recoverable)
      // condition, not a reason to spin. Back off, then park the job in
      // `waiting` so an operator can see it instead of burning CPU.
      const streak = (this.brainErrors.get(jobId) || 0) + 1;
      this.brainErrors.set(jobId, streak);
      if (streak >= 5) {
        this.brainErrors.delete(jobId);
        await this.enterWaiting(job, {
          reason: `local AI produced no usable decision after ${streak} attempts: ${error.message}`,
          event: 'brain.decision',
          message: `Local AI cannot produce a valid decision (${error.message}) — pausing reasoning until it recovers`
        });
        return this.jobModel.get(jobId);
      }
      await this.sleepInterruptible(jobId, Math.min(400 * streak, 3000));
      return this.jobModel.get(jobId);
    }      // ── Persist the decision *before* acting on it (#71) ────────────────
    if (job.status === 'waiting') {
      // Reasoning works again: leave the waiting state exactly once.
      await this.jobModel.transition(jobId, 'running', { waitingReason: null, brainStatus: 'reasoning' });
      await this.publish(jobId, {
        type: 'job.resumed',
        level: 'INFO',
        message: 'Local AI is answering again — resuming the assessment'
      });
    }

    await this.jobModel.update(jobId, {
      lastBrainDecision: {
        objective: decision.objective,
        observation: decision.observation,
        action: decision.nextAction,
        reason: decision.reason,
        expectedOutcome: decision.expectedOutcome,
        confidence: decision.confidence,
        at: new Date().toISOString()
      },
      brainStatus: 'decided',
      currentObjective: decision.objective,
      currentAction: this.describeAction(decision.nextAction)
    });

    await this.publish(jobId, {
      type: 'brain.decision',
      level: 'INFO',
      message: `Decision: ${decision.reason}`,
      data: {
        objective: decision.objective,
        action: decision.nextAction,
        confidence: decision.confidence,
        expectedOutcome: decision.expectedOutcome,
        summaryLabel: this.brain.constructor.statusLabel(decision)
      }
    });
    await this.recordActivity(jobId, {
      kind: 'decision',
      message: `Decision: ${this.describeAction(decision.nextAction)}`,
      detail: decision.reason
    });

    if (decision.phase && VALID_PHASES.includes(decision.phase) && decision.phase !== job.phase) {
      await this.stateManager.setPhase(job.assessmentId, decision.phase);
      await this.jobModel.update(jobId, { phase: decision.phase });
      await this.publish(jobId, {
        type: 'job.phase_changed',
        level: 'INFO',
        message: `Phase → ${decision.phase}`,
        data: { phase: decision.phase }
      });
    }

    // Remember anything the brain flagged as durable knowledge.
    for (const note of decision.memoryNotes || []) {
      await this.memory.rememberSemantic({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId,
        key: 'brain-note',
        content: note
      });
    }

    await this.executeDecision(job, decision, scopeEngine);

    // ── Progress bookkeeping + liveness guard ──────────────────────────
    this.brainErrors.delete(jobId);
    const refreshed = await this.jobModel.get(jobId);
    const signature = JSON.stringify(decision.nextAction);
    const repeated = refreshed.lastCommittedAction === signature;
    await this.jobModel.checkpoint(jobId, {
      lastCommittedAction: signature,
      step: refreshed.stepCount,
      phase: refreshed.phase,
      objective: refreshed.currentObjective,
      at: new Date().toISOString()
    });
    await this.jobModel.incrementCounters(jobId, { stepCount: 1 });

    const streak = repeated ? (this.noProgress.get(jobId) || 1) + 1 : 0;
    if (streak > 0) this.noProgress.set(jobId, streak);
    else this.noProgress.delete(jobId);

    if (streak >= NO_PROGRESS_REPEAT_LIMIT) {
      await this.publish(jobId, {
        type: 'job.failed',
        level: 'ERROR',
        message: `No progress after ${streak} identical actions — the agent is stuck. Stopping so state stays inspectable.`,
        data: { action: decision.nextAction }
      });
      await this.jobModel.recordError(jobId, {
        message: `no progress: repeated identical action ${streak} times`,
        kind: 'no_progress'
      });
      await this.jobModel.transition(jobId, 'failed', { brainStatus: 'stuck' });
      await this.assessmentModel.setStatus(job.assessmentId, 'failed', { error: 'Agent stalled: repeated identical action' }).catch?.(() => {});
      this.noProgress.delete(jobId);
      return this.jobModel.get(jobId);
    }

    await this.sleepInterruptible(jobId, this.config.idleDelayMs);
    return this.jobModel.get(jobId);
  }

  // ── Action execution ──────────────────────────────────────────────────
  async executeDecision(job, decision, scopeEngine) {
    const action = decision.nextAction;
    switch (action.type) {
      case 'tool':
        return this.runToolAction(job, action);
      case 'computer_action':
        return this.runComputerAction(job, action, scopeEngine);
      case 'observation':
        return this.findingLifecycle.recordObservation({
          userId: job.userId,
          assessmentId: job.assessmentId,
          jobId: job.id,
          summary: action.observation,
          refs: { url: action.target || null }
        });
      case 'hypothesis':
        return this.findingLifecycle.raiseHypothesis({
          userId: job.userId,
          assessmentId: job.assessmentId,
          jobId: job.id,
          hypothesis: action.hypothesis,
          category: action.category || 'general',
          asset: action.target || job.target,
          endpoint: action.endpoint || null
        });
      case 'validate':
        return this.runValidation(job, action);
      case 'finding':
        return this.runFinding(job, action);
      case 'plan_update':
        return this.runPlanUpdate(job, action);
      case 'wait':
        await this.recordActivity(job.id, { kind: 'wait', message: `Waiting: ${action.reason || decision.reason}` });
        return { waited: true };
      case 'complete':
        return this.completeJob(job, decision.reason);
      default:
        await this.jobModel.recordError(job.id, { message: `Unsupported action type: ${action.type}` });
        return null;
    }
  }

  async runToolAction(job, action) {
    const jobId = job.id;
    await this.jobModel.update(jobId, {
      currentAction: `tool:${action.name} → ${action.target}`,
      lastToolExecution: { tool: action.name, target: action.target, at: new Date().toISOString() }
    });
    await this.recordActivity(jobId, { kind: 'tool', message: `Tool: ${action.name} → ${action.target}` });

    try {
      const result = await this.toolExecutor.execute(job.assessmentId, job.userId, {
        tool: action.name,
        target: action.target,
        arguments: action.arguments || {},
        timeout: action.timeout
      });

      // Real evidence, from the real execution record.
      const { evidence } = await this.evidenceModel.store({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId,
        toolExecutionId: result.execution?.id || null,
        kind: 'tool_output',
        asset: action.target,
        endpoint: action.target,
        summary: `${action.name} on ${action.target}: ${String(result.aiSummary || '').slice(0, 800)}`,
        response: result.execution?.rawOutput ? String(result.execution.rawOutput).slice(0, 40_000) : null,
        sha256: result.execution?.fingerprint || null,
        metadata: { parser: action.name, outputSizeBytes: result.execution?.outputSizeBytes || 0 }
      });
      await this.jobModel.incrementCounters(jobId, { evidenceCount: 1 });

      await this.memory.rememberTool({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId,
        key: `tool:${action.name}`,
        content: `${action.name} @ ${action.target} → ${String(result.aiSummary || '').slice(0, 1500)}`,
        refs: { toolExecutionId: result.execution?.id || null, evidenceId: evidence.id, url: action.target },
        structured: { deduplicated: Boolean(result.deduplicated) }
      });

      await this.stateManager.applyToolResult(job.assessmentId, action.name, result.parsed);
      await this.stateManager.recordAction(job.assessmentId, {
        tool: action.name,
        target: action.target,
        description: action.description || decision_description(action),
        resultSummary: String(result.aiSummary || '').slice(0, 400),
        deduplicated: result.deduplicated
      });
      if (!result.deduplicated) {
        await this.assessmentModel.incrementCounters(job.assessmentId, { toolsExecuted: 1 });
      }
      const context = await this.stateManager.getContext(job.assessmentId);
      if (context) {
        await this.assessmentModel.update(job.assessmentId, {
          assetsDiscovered: context.subdomainCount,
          endpointsDiscovered: context.endpointCount
        });
      }

      await this.recordActivity(jobId, {
        kind: 'tool',
        message: `${action.name} completed — ${String(result.aiSummary || '').slice(0, 300)}`
      });
      await this.publish(jobId, {
        type: 'tool.output',
        level: 'INFO',
        message: `${action.name}: ${String(result.aiSummary || '').slice(0, 400)}`,
        data: { tool: action.name, executionId: result.execution?.id, evidenceId: evidence.id }
      });
      await this.jobModel.update(jobId, {
        lastObservation: {
          kind: 'tool_output',
          summary: String(result.aiSummary || '').slice(0, 1000),
          at: new Date().toISOString()
        }
      });
      return result;
    } catch (error) {
      await this.stateManager.recordFailedAction(job.assessmentId, {
        tool: action.name,
        target: action.target,
        error: error.message
      });
      await this.jobModel.recordError(jobId, { message: `${action.name} failed: ${error.message}`, kind: error.code || 'tool_error' });
      await this.memory.rememberTool({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId,
        key: `tool:${action.name}:failed`,
        content: `FAILED ${action.name} @ ${action.target}: ${error.message} — do not repeat this exact attempt`,
        refs: { url: action.target },
        importance: 0.7
      });
      await this.recordActivity(jobId, { kind: 'error', message: `${action.name} failed: ${error.message}` });
      await this.publish(jobId, {
        type: 'tool.output',
        level: 'ERROR',
        message: `${action.name} failed: ${error.message}`,
        data: { tool: action.name, error: error.message }
      });
      return null;
    }
  }

  async runComputerAction(job, action, scopeEngine) {
    const jobId = job.id;
    if (!this.computer) {
      await this.publish(jobId, {
        type: 'browser.observation',
        level: 'WARN',
        message: 'Computer control is not wired on this deployment',
        data: { action: action.action }
      });
      return null;
    }

    const result = await this.computer.execute(action.action, {
      channel: jobId,
      scopeEngine,
      approvalGranted: true
    });

    await this.jobModel.update(jobId, {
      computerStatus: this.computerState?.snapshot() || null,
      computerRuntime: result.ok ? 'available' : (result.error?.kind || 'unknown')
    });

    if (result.ok) {
      const observation = result.observation;
      await this.evidenceModel.store({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId,
        kind: observation.kind === 'screenshot' ? 'screenshot' : 'computer_observation',
        asset: job.target,
        endpoint: observation.url || this.computer.lastNavigationUrl || null,
        summary: observation.summary,
        sha256: observation.sha256 || null,
        artifactPath: observation.path || null,
        metadata: { action: result.action, visionUsed: false }
      });
      await this.jobModel.incrementCounters(jobId, { evidenceCount: 1 });

      await this.memory.rememberEpisodic({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId,
        key: 'computer',
        content: `COMPUTER: ${observation.summary}`,
        refs: { url: observation.url || null }
      });
      await this.jobModel.update(jobId, {
        lastObservation: { kind: observation.kind, summary: observation.summary, at: observation.at }
      });
      await this.recordActivity(jobId, { kind: 'browser', message: observation.summary });
      await this.publish(jobId, {
        type: 'browser.action',
        level: 'INFO',
        message: `${result.action.type}: ${observation.summary}`,
        data: { action: result.action, observation }
      });
      return result;
    }

    // Failure triage:
    //   • the whole runtime is gone      → wait for it to come back (#34)
    //   • this one action is impossible  → remember it and let the brain adapt
    //   • the action was rejected        → remember it and let the brain adapt
    const runtimeGone = (result.error?.kind === 'unavailable' || result.error?.kind === 'timeout')
      && this.computer.running !== true;

    if (runtimeGone) {
      await this.enterWaiting(job, {
        reason: `computer control unavailable: ${result.error.message}`,
        event: 'browser.observation',
        message: `Computer runtime unavailable (${result.error.message}) — waiting for it to come back`
      });
    } else {
      await this.memory.rememberEpisodic({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId,
        key: 'computer-rejected',
        content: `COMPUTER ACTION ${result.rejected ? 'REJECTED' : 'UNAVAILABLE'} (${result.error?.kind}): ${result.error?.message} — choose a different approach`,
        importance: 0.8
      });
      await this.recordActivity(jobId, { kind: 'error', message: `Computer action ${result.rejected ? 'rejected' : 'unavailable'}: ${result.error?.message}` });
      await this.publish(jobId, {
        type: 'browser.observation',
        level: 'WARN',
        message: `Computer action could not run: ${result.error?.message}`,
        data: { action: result.action, kind: result.error?.kind }
      });
    }
    return null;
  }

  async runValidation(job, action) {
    const requested = Array.isArray(action.evidenceIds) ? action.evidenceIds : [];
    const jobEvidence = await this.evidenceModel.listByJob(job.id);
    // Only evidence that really exists may support a validation. If the brain
    // did not name evidence, we fall back to the newest REAL job evidence — we
    // never synthesise a record to make a hypothesis look validated.
    const usable = requested.length
      ? requested.filter((id) => jobEvidence.some((item) => item.id === id))
      : jobEvidence.slice(-3).map((item) => item.id);

    if (usable.length === 0) {
      await this.memory.rememberEpisodic({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId: job.id,
        key: 'validation-blocked',
        content: `Cannot validate hypothesis "${action.hypothesis || action.hypothesisId}" — no stored evidence exists yet. Run a tool or computer action that produces evidence first.`,
        importance: 0.8
      });
      await this.recordActivity(job.id, {
        kind: 'validation',
        message: `Validation deferred: no evidence yet for "${action.hypothesis || action.hypothesisId}"`
      });
      await this.publish(job.id, {
        type: 'hypothesis.updated',
        level: 'WARN',
        message: `Validation blocked: no evidence stored for "${action.hypothesis || action.hypothesisId}"`,
        data: { status: 'needs_validation' }
      });
      return { validated: false, reason: 'no_evidence' };
    }

    return this.findingLifecycle.validate({
      userId: job.userId,
      assessmentId: job.assessmentId,
      jobId: job.id,
      hypothesisId: action.hypothesisId || null,
      hypothesis: action.hypothesis || null,
      valid: action.valid !== false,
      evidenceIds: usable
    });
  }

  async runFinding(job, action) {
    const jobEvidence = await this.evidenceModel.listByJob(job.id);
    const evidenceIds = Array.isArray(action.evidenceIds) && action.evidenceIds.length
      ? action.evidenceIds
      : jobEvidence
        .filter((item) => !action.target || String(item.asset || '').toLowerCase() === String(action.target).toLowerCase())
        .slice(-5)
        .map((item) => item.id);

    const result = await this.findingLifecycle.createFinding({
      userId: job.userId,
      assessmentId: job.assessmentId,
      jobId: job.id,
      title: action.title || action.description || 'Untitled finding',
      severity: action.severity || 'informational',
      category: action.category || 'uncategorized',
      asset: action.target || job.target,
      endpoint: action.endpoint || null,
      parameter: action.parameter || null,
      rootCause: action.rootCause || action.title || '',
      description: action.details || action.description || '',
      impact: action.impact || '',
      reproductionSteps: action.reproductionSteps || [],
      remediation: action.remediation || '',
      confidence: action.confidence ?? 0.6,
      evidenceIds,
      hypothesisId: action.hypothesisId || null
    });

    if (result.created) {
      await this.jobModel.incrementCounters(job.id, { findingsCount: 1 });
      await this.assessmentModel.incrementCounters(job.assessmentId, { findingsCount: 1 });
      await this.recordActivity(job.id, {
        kind: 'finding',
        message: `Finding confirmed: ${result.finding.title} (${result.finding.severity})`
      });
    } else if (result.reason === 'no_evidence') {
      await this.recordActivity(job.id, {
        kind: 'finding',
        message: `Finding rejected (no evidence): ${action.title || action.description}`
      });
    }
    return result;
  }

  async runPlanUpdate(job, action) {
    const plan = {
      phases: Array.isArray(action.plan.phases) ? action.plan.phases : (job.plan?.phases || []),
      pendingSteps: Array.isArray(action.plan.pendingSteps) ? action.plan.pendingSteps : [],
      completedSteps: Array.isArray(action.plan.completedSteps) ? action.plan.completedSteps : (job.plan?.completedSteps || []),
      updatedAt: new Date().toISOString()
    };
    await this.jobModel.setPlan(job.id, plan);
    await this.memory.rememberTask({
      userId: job.userId,
      assessmentId: job.assessmentId,
      jobId: job.id,
      content: renderPlanForMemory(plan),
      structured: plan
    });
    await this.publish(job.id, {
      type: 'job.plan_updated',
      level: 'INFO',
      message: 'Assessment plan updated',
      data: { plan }
    });
    await this.recordActivity(job.id, { kind: 'plan', message: 'Plan updated' });
    return plan;
  }

  // ── Terminal transitions ──────────────────────────────────────────────
  async completeJob(job, reason) {
    await this.jobModel.transition(job.id, 'resuming', { brainStatus: 'finalizing' });
    await this.publish(job.id, {
      type: 'report.started',
      level: 'INFO',
      message: 'Assessment objectives satisfied — generating the report from stored evidence'
    });
    await this.recordActivity(job.id, { kind: 'report', message: 'Report generation started' });

    let report = null;
    if (this.reportService) {
      try {
        report = await this.reportService.generate(job.userId, job.assessmentId);
        await this.jobModel.update(job.id, { reportId: report.id, reportVersion: report.version });
        await this.publish(job.id, {
          type: 'report.progress',
          level: 'INFO',
          message: `Report v${report.version} generated`,
          data: { reportId: report.id, version: report.version }
        });
        await this.recordActivity(job.id, { kind: 'report', message: `Report v${report.version} ready` });
      } catch (error) {
        await this.jobModel.recordError(job.id, { message: `Report generation failed: ${error.message}` });
        await this.publish(job.id, {
          type: 'report.progress',
          level: 'ERROR',
          message: `Report generation failed: ${error.message}`,
          data: { error: error.message }
        });
      }
    }

    await this.assessmentModel.setStatus(job.assessmentId, 'completed').catch?.(() => {});
    await this.jobModel.transition(job.id, 'completed', { brainStatus: 'idle', waitingReason: null });
    await this.publish(job.id, {
      type: 'job.completed',
      level: 'INFO',
      message: `Assessment completed — ${reason}`,
      data: { reason, reportId: report?.id || null, reportVersion: report?.version || null }
    });
    await this.recordActivity(job.id, { kind: 'agent', message: `Assessment completed — ${reason}` });
    return { completed: true, report };
  }

  async pauseJob(job) {
    await this.jobModel.transition(job.id, 'paused', { brainStatus: 'paused' });
    await this.assessmentModel.setStatus(job.assessmentId, 'paused').catch?.(() => {});
    await this.jobModel.checkpoint(job.id, {
      lastCommittedAction: job.lastCommittedAction,
      step: job.stepCount,
      phase: job.phase,
      objective: job.currentObjective,
      at: new Date().toISOString()
    });
    await this.publish(job.id, {
      type: 'job.paused',
      level: 'INFO',
      message: `Paused safely at step ${job.stepCount} (phase ${job.phase}). State persisted — nothing is lost.`,
      data: { stepCount: job.stepCount, phase: job.phase }
    });
    await this.recordActivity(job.id, { kind: 'agent', message: `Paused at step ${job.stepCount}` });
    return { paused: true };
  }

  async cancelJob(job, reason) {
    await this.jobModel.transition(job.id, 'cancelled', { brainStatus: 'cancelled', waitingReason: null });
    await this.assessmentModel.setStatus(job.assessmentId, 'stopped').catch?.(() => {});
    await this.publish(job.id, {
      type: 'job.cancelled',
      level: 'WARN',
      message: `Job cancelled — ${reason}. Assessment history is preserved.`,
      data: { reason, stepCount: job.stepCount }
    });
    await this.recordActivity(job.id, { kind: 'agent', message: `Cancelled — ${reason}` });
    return { cancelled: true };
  }

  async enterWaiting(job, { reason, event, message }) {
    if (job.status !== 'waiting' || job.waitingReason !== reason) {
      await this.jobModel.transition(job.id, 'waiting', { waitingReason: reason, brainStatus: 'waiting' });
      await this.publish(job.id, {
        type: event || 'job.waiting',
        level: 'WARN',
        message,
        data: { reason }
      });
      await this.recordActivity(job.id, { kind: 'wait', message });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  /** Interruptible sleep: pause/cancel/shutdown wake it immediately. */
  sleepInterruptible(jobId, ms) {
    return new Promise((resolve) => {
      const control = this.running.get(jobId);
      if (!control) return resolve();
      const timer = setTimeout(() => {
        control.wake = null;
        resolve();
      }, Math.max(0, ms));
      control.wake = () => {
        clearTimeout(timer);
        control.wake = null;
        resolve();
      };
    });
  }

  /** Wake a sleeping job (after a control request) so it reacts immediately. */
  wake(jobId) {
    this.running.get(jobId)?.wake?.();
  }

  describeAction(action) {
    switch (action.type) {
      case 'tool': return `Run tool ${action.name} against ${action.target}`;
      case 'computer_action': return `Computer: ${action.action?.type}${action.action?.params?.url ? ` → ${action.action.params.url}` : ''}`;
      case 'observation': return `Record observation: ${String(action.observation || '').slice(0, 120)}`;
      case 'hypothesis': return `Hypothesis: ${String(action.hypothesis || '').slice(0, 120)}`;
      case 'validate': return `Validate: ${action.hypothesis || action.hypothesisId}`;
      case 'finding': return `Confirm finding: ${action.title || action.description}`;
      case 'plan_update': return 'Update assessment plan';
      case 'wait': return 'Wait';
      case 'complete': return 'Complete assessment';
      default: return action.type;
    }
  }

  async recordActivity(jobId, entry) {
    try {
      await this.jobModel.addActivity(jobId, entry);
    } catch {
      /* activity logging must never break the loop */
    }
  }

  async publish(jobId, event) {
    if (!jobId || !this.eventService) return null;
    try {
      return await this.eventService.publish(jobId, event);
    } catch {
      return null;
    }
  }

  /** Ask a running job to stop (shutdown path). */
  async stopAll() {
    this.stopped = true;
    for (const [jobId, control] of this.running) {
      control.abort = true;
      control.wake?.();
      await this.jobModel.update(jobId, { brainStatus: 'stopped' }).catch?.(() => {});
    }
  }
}

function decision_description(action) {
  return action.description || `${action.name} on ${action.target}`;
}

function renderPlanForMemory(plan) {
  const lines = ['CURRENT TASK PLAN:'];
  for (const phase of plan.phases || []) {
    const steps = phase.steps || [];
    const done = steps.filter((step) => step.status === 'done').length;
    lines.push(`- ${phase.name} (${done}/${steps.length} done)`);
    for (const step of steps) lines.push(`   ${step.status === 'done' ? '[x]' : '[ ]'} ${step.step}`);
  }
  if (plan.pendingSteps?.length) lines.push(`- pending: ${plan.pendingSteps.join(', ')}`);
  return lines.join('\n').slice(0, 4000);
}

export { NO_PROGRESS_REPEAT_LIMIT };
