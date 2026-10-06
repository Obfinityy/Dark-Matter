import crypto from 'node:crypto';
import { ScopeEngine } from '../agent/scopeEngine.js';
import { LocalAiUnavailableError, AutonomousBrain } from '../agent/autonomousBrain.js';
import { VALID_PHASES } from '../models/assessmentModel.js';
import { checkOutcome } from '../computer/outcomeCheck.js';
import { stageForPhase, describeHuntState, techniquesForStage } from '../agent/methodology.js';
import { suggestRecovery, formatRecoveryAdvice } from '../computer/recoveryAdvisor.js';
import { VulnerabilityReportBuilder, renderHuntReportMarkdown } from '../services/vulnerabilityReportBuilder.js';
import { fingerprintTargetLenient } from '../services/targetFingerprint.js';
import { buildBrainChain as buildExploitChain, suggestChains } from '../services/chainService.js';
import { initialHuntState, safeTransition } from '../agent/huntStateMachine.js';
import { DeterministicBrain } from '../agent/deterministicBrain.js';
import { buildBrainChain, ResilientBrainProvider } from '../agent/providers/resilientBrainProvider.js';
import { createSlotBrainProvider, createFeatureBrains, FEATURE_SLOTS } from '../agent/providers/brainProviderFactory.js';
import { createTripleBrainOrchestrator } from '../services/tripleBrainOrchestrator.js';
import { TripleBrainHuntAdapter } from '../agent/tripleBrainHuntAdapter.js';
import { LocalAIQueue, localAIQueue } from '../agent/providers/localAiQueue.js';

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
    computerActionModel = null,
    reasoningCycleModel = null,
    findingLifecycle,
    evidenceModel,
    stateManager,
    eventService,
    reportService = null,
    findingModel = null,
    alertService = null,
    targetQueueService = null,
    payloadLibraryModel = null,
    brainProviderModel = null,
    huntContextManager = null,
    appConfig = null,
    huntRecordModel = null, // persistent artifact store (hybrid storage: DB side)
    modelRunnerService = null, // local GGUF runner (no-Ollama "Download → Run")
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
    this.computerActionModel = computerActionModel;
    this.reasoningCycleModel = reasoningCycleModel;
    // Stash for the current step's verification verdict (set by the action
    // runners, consumed by the reasoning-cycle bookkeeping in stepReason).
    this.lastStepVerification = null;    this.findingLifecycle = findingLifecycle;
    this.evidenceModel = evidenceModel;
    this.stateManager = stateManager;
    this.eventService = eventService;
    this.reportService = reportService;
    this.findingModel = findingModel;
    this.alertService = alertService;
    this.targetQueueService = targetQueueService;
    this.payloadLibraryModel = payloadLibraryModel;
    this.brainProviderModel = brainProviderModel;
    this.huntContextManager = huntContextManager;
    this.appConfig = appConfig;
    this.huntRecordModel = huntRecordModel;
    this.modelRunnerService = modelRunnerService;
    // Per-user brain instances (multi-tenancy): userId → AutonomousBrain.
    // Each brain has its OWN provider (their model, their endpoint) and its
    // OWN inference queue — no shared mutable state between users, and one
    // user's reasoning never waits behind another's. this.brain remains as
    // the fallback/default (conversational mode, tests without a provider
    // model).
    this.brains = new Map();
    this.logger = logger;
    this.config = {
      idleDelayMs: Number(process.env.AGENT_WORKER_IDLE_MS || 500),
      phoneRetryMs: Number(process.env.AGENT_PHONE_RETRY_MS || 15_000),
      contextRetryMs: Number(process.env.AGENT_CONTEXT_RETRY_MS || 60_000),
      // When no LLM brain is reachable, fall back to the deterministic
      // rule-based strategy instead of parking the hunt in `waiting`.
      // Disable with AGENT_DETERMINISTIC_FALLBACK=0.
      deterministicFallback: process.env.AGENT_DETERMINISTIC_FALLBACK !== '0'
    };
    this.noProgress = new Map();
    this.brainErrors = new Map();

    /** jobId → { abort, wake } so pause/cancel/shutdown act immediately. */
    this.running = new Map();
    /**
     * jobId → DeterministicBrain override, set when a job's LLM brain is
     * unreachable and the deterministic fallback engages. The job keeps
     * hunting autonomously (rule-based strategy) instead of parking in
     * `waiting`. Checked first by getBrainForJob().
     */
    this.brainOverrides = new Map();
    // Per-user running sets (multi-tenancy): userId → Set(jobId). Lets the
    // JobManager enforce HUNT_MAX_PER_USER without scanning job docs.
    // Each user's hunts are isolated here — no shared mutable state.
    this.runningByUser = new Map();
    this.noProgress = new Map();
    this.brainErrors = new Map();
    this.stopped = false;
    /**
     * jobId → computer_actions record id of the most recent computer action,
     * so the brain's *next* decision can be linked back to the action whose
     * outcome it was based on (issue #1 "Persistence").
     */
    this.pendingComputerAction = new Map();
  }

  // ── Per-user brains (multi-tenancy) ────────────────────────────────────
  /**
   * Resolve the brain for a job's user. Each user gets their OWN
   * AutonomousBrain: their selected provider (phone Gemma or their Ollama
   * model), their own endpoint URL, their own inference queue. Brains are
   * cached per user and rebuilt when the user switches models.
   *
   * Falls back to the shared default brain when no provider model is wired
   * (tests, single-user embedded use).
   */
  async getBrainForJob(job) {
    // Deterministic fallback engaged for this job (LLM unreachable) — the
    // override always wins so the hunt keeps driving itself.
    if (job?.id && this.brainOverrides.has(job.id)) return this.brainOverrides.get(job.id);
    if (!this.brainProviderModel || !job?.userId) return this.brain;
    if (this.brains.has(job.userId)) return this.brains.get(job.userId);

    const selection = await this.brainProviderModel.getSelection(job.userId);
    // Brain fallback chain (local → next downloaded model → Kaggle remote →
    // phone API): if the user's chosen brain dies mid-hunt, the hunt keeps
    // thinking on the next available brain instead of dying with it.
    let downloaded = null;
    if (selection.provider === 'local' && this.modelRunnerService?.library) {
      try {
        downloaded = await this.modelRunnerService.library();
      } catch (err) {
        this.logger?.warn?.(`[agentWorker] model library unavailable for fallback chain: ${err?.message}`);
      }
    }
    const chain = buildBrainChain({
      selection,
      appConfig: this.appConfig || {},
      runner: this.modelRunnerService,
      downloaded
    });
    const provider = new ResilientBrainProvider(chain);
    this.logger?.info?.(
      `[agentWorker] brain chain for user ${job.userId}: ${chain.map((l) => l.name).join(' → ')}`
    );
    // The phone is ONE piece of hardware: its brains share the hardware
    // queue. Every Ollama brain gets a PRIVATE queue — the agent's
    // thinking loop is never throttled by another user's inference.
    const queue = selection.provider === 'phone'
      ? localAIQueue
      : new LocalAIQueue({ maxConcurrency: 2 });
    const brain = new AutonomousBrain({
      memory: this.memory,
      eventService: this.eventService,
      computer: this.computer,
      provider,
      queue,
    });
    this.brains.set(job.userId, brain);
    return brain;
  }

  /**
   * Resolve the three brain-slot providers for a hunt's user.
   * Hunt uses all three brains:
   *   - vision: sees screenshots, main reasoning
   *   - grounding: returns x,y coordinates for UI elements
   *   - hacker: uncensored security strategy
   * Each slot resolves to its local model (own localhost port) or its Kaggle link.
   * @returns {Promise<{ vision, grounding, hacker }>} providers (null for unconfigured slots)
   */
  async getSlotBrainsForJob(job) {
    if (!this.brainProviderModel || !job?.userId) return { vision: null, grounding: null, hacker: null };
    const selection = await this.brainProviderModel.getSelection(job.userId);
    const deps = { appConfig: this.appConfig || {}, runner: this.modelRunnerService };
    const brains = {};
    for (const slot of FEATURE_SLOTS.hunt) {
      try {
        brains[slot] = createSlotBrainProvider(slot, selection, deps);
      } catch {
        brains[slot] = null;
      }
    }
    return brains;
  }

  /**
   * Build the triple-brain orchestrator for a hunt's user.
   *
   * The orchestrator coordinates the three LOCAL slot servers directly
   * (vision on its port, grounding on its port, hacker on its port) and runs
   * the think → see → act loop. Slots with no running model are logged
   * clearly and the loop degrades gracefully to the available brains.
   *
   * @returns {Promise<TripleBrainOrchestrator|null>} null when the worker has
   *   no brainProviderModel or the job has no user.
   */
  async getTripleBrainOrchestratorForJob(job) {
    if (!this.brainProviderModel || !job?.userId) return null;
    const selection = await this.brainProviderModel.getSelection(job.userId);
    return createTripleBrainOrchestrator({
      runner: this.modelRunnerService || null,
      selection,
      appConfig: this.appConfig || {},
      logger: this.logger || console
    });
  }

  /**
   * Cached triple-brain orchestrator per user. The orchestrator warns about
   * missing slots ONCE per lifetime (logBrainStatus), so it must survive
   * across loop iterations — a fresh orchestrator per iteration would spam
   * the MISSING warnings every cycle. Cleared by refreshBrainForUser().
   */
  async getCachedTripleBrainOrchestrator(job) {
    if (!this.tripleBrainOrchestrators) this.tripleBrainOrchestrators = new Map();
    const key = job?.userId;
    if (key && !this.tripleBrainOrchestrators.has(key)) {
      const orchestrator = await this.getTripleBrainOrchestratorForJob(job);
      if (orchestrator) this.tripleBrainOrchestrators.set(key, orchestrator);
    }
    return (key && this.tripleBrainOrchestrators.get(key)) || null;
  }

  /**
   * Build the triple-brain hunt adapter for a job whose resilient brain
   * chain is unhealthy. Returns { adapter, live, missing, mode } when at
   * least one slot server is usable, else null — the loop then falls
   * through to the deterministic fallback as before.
   *
   * Missing slots are logged LOUDLY (one line per slot: running model +
   * localhost port, or MISSING) via orchestrator.logBrainStatus().
   */
  async tripleBrainFallbackFor(job) {
    if (!this.brainProviderModel || !job?.userId) return null;
    try {
      const orchestrator = await this.getCachedTripleBrainOrchestrator(job);
      if (!orchestrator) return null;
      const missing = orchestrator.logBrainStatus();
      const checks = await orchestrator.healthCheck();
      const live = Object.entries(checks || {})
        .filter(([, c]) => c?.ok)
        .map(([slot]) => slot);
      if (!live.length) {
        this.logger?.warn?.(
          `[agentWorker] triple-brain: no usable slot servers for user ${job.userId} ` +
          `(missing: ${missing.join(', ') || 'all three slots'}) — falling back to deterministic strategy`
        );
        return null;
      }
      const adapter = new TripleBrainHuntAdapter({
        orchestrator,
        deterministic: this.deterministicFallbackFor(job),
        logger: this.logger,
      });
      const mode = checks?.hacker?.ok ? 'triple-brain' : 'triple-brain-degraded';
      this.logger?.info?.(
        `[agentWorker] triple-brain engaged for job ${job.id}: live=[${live.join(', ')}]` +
        (missing.length ? ` missing=[${missing.join(', ')}]` : '')
      );
      return { adapter, live, missing, mode };
    } catch (error) {
      this.logger?.warn?.(
        `[agentWorker] triple-brain wiring failed: ${error?.message} — falling back to deterministic strategy`
      );
      return null;
    }
  }

  /**
   * Drop a user's cached brain so the next reasoning step rebuilds it from
   * their current model selection. Called when the user switches models.
   */
  refreshBrainForUser(userId) {
    if (userId) this.brains.delete(userId);
    if (userId) this.tripleBrainOrchestrators?.delete(userId);
  }

  // ── Hunt state awareness ─────────────────────────────────────────────
  /**
   * Persist the agent's explicit self-state ("I just did X → next I do Y").
   * Every reasoning cycle reads this FIRST — it is what makes the system an
   * agent instead of a script. Transitions go through the state machine so
   * illegal moves are caught (and logged, never fatal).
   *
   * @param {string} jobId
   * @param {object} patch - { status?, stage?, lastAction?, lastOutcome?,
   *                           lastHypothesis?, nextIntent? }
   * @returns the refreshed job (with the new huntState), or null
   */
  async updateHuntState(jobId, patch = {}) {
    const job = await this.jobModel.get(jobId);
    if (!job) return null;
    const current = job.huntState || initialHuntState();
    const next = safeTransition(current, patch.status || current.status, {
      ...patch,
      stepsTaken: job.stepCount || 0,
    }, this.logger);
    await this.jobModel.update(jobId, { huntState: next });
    return { ...job, huntState: next };
  }

  isRunning(jobId) {
    return this.running.has(jobId);
  }

  get runningJobIds() {
    return [...this.running.keys()];
  }

  /**
   * Build the deterministic fallback brain for a job whose LLM is
   * unreachable. Returns null when the fallback is disabled (or the worker
   * lacks the models the strategy needs) — the loop then parks in `waiting`
   * as before.
   */
  deterministicFallbackFor(job) {
    if (!this.config.deterministicFallback) return null;
    if (!this.toolExecutionModel || !this.evidenceModel) return null;
    return new DeterministicBrain({
      toolExecutionModel: this.toolExecutionModel,
      evidenceModel: this.evidenceModel,
      logger: this.logger
    });
  }

  /** Total hunts currently executing in this process. */
  get runningCount() {
    return this.running.size;
  }

  /** Hunts currently executing for one user (per-user isolation accounting). */
  runningCountForUser(userId) {
    return this.runningByUser.get(userId)?.size || 0;
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
    if (job.userId) {
      let userSet = this.runningByUser.get(job.userId);
      if (!userSet) {
        userSet = new Set();
        this.runningByUser.set(job.userId, userSet);
      }
      userSet.add(jobId);
    }

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
      if (job.userId) {
        const userSet = this.runningByUser.get(job.userId);
        if (userSet) {
          userSet.delete(jobId);
          if (userSet.size === 0) this.runningByUser.delete(job.userId);
        }
      }
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

      // ── Brain availability: resolve the JOB's brain (per-user provider) ──
      // this.brain is only the boot-time fallback; the user may have
      // switched to the local runner (or any other provider) since.
      const loopBrain = await this.getBrainForJob(job);
      const health = await loopBrain.health();
      if (!health.available) {
        // ── Triple-brain slot wiring (overnight mission ②) ──────────────
        // Before dropping to the deterministic rule-based strategy, try the
        // user's three LOCAL slot servers (vision / grounding / hacker on
        // localhost). Missing slots are logged loudly by logBrainStatus();
        // usable slots drive the hunt with real model thinking instead of
        // rules. Deterministic remains the last resort.
        const triple = await this.tripleBrainFallbackFor(job);
        if (triple) {
          this.brainOverrides.set(job.id, triple.adapter);
          await this.jobModel.update(jobId, { brainStatus: triple.mode });
          await this.publish(jobId, {
            type: 'brain.triple',
            level: 'INFO',
            message: `Resilient brain chain unreachable — hunting with the triple-brain local slots (${triple.live.join(', ')})${triple.missing.length ? `; MISSING brains: ${triple.missing.join(', ')}` : ''}.`,
            data: { live: triple.live, missing: triple.missing, mode: triple.mode }
          });
          await this.recordActivity(jobId, {
            kind: 'brain',
            message: `Triple-brain engaged (local slots): ${triple.live.join(', ')} live${triple.missing.length ? `; MISSING: ${triple.missing.join(', ')}` : ''}`
          });
          continue;
        }
        // No LLM reachable and no triple-brain slot usable. Instead of
        // parking the hunt in `waiting`, engage the deterministic rule-based
        // strategy: the same loop, the same tools, the same evidence gates —
        // decided by expert-authored rules instead of a model. Published
        // honestly as brain.deterministic.
        const fallback = this.deterministicFallbackFor(job);
        if (fallback) {
          this.brainOverrides.set(job.id, fallback);
          await this.jobModel.update(jobId, { brainStatus: 'deterministic' });
          await this.publish(jobId, {
            type: 'brain.deterministic',
            level: 'WARN',
            message: `No local AI reachable (${health.reason || health.provider || 'provider down'}) — running the deterministic rule-based hunt strategy. Every action still passes policy, scope, and evidence gates.`,
            data: { reason: health.reason, provider: health.provider, strategy: 'deterministicBrain' }
          });
          await this.recordActivity(jobId, {
            kind: 'brain',
            message: 'Deterministic rule-based strategy engaged (local AI unreachable) — the hunt drives itself'
          });
          continue;
        }
        // health.reason already starts with "LOCAL AI UNAVAILABLE — …"; strip it
        // here so the terminal message doesn't repeat the prefix.
        const waitReason = String(health.reason || 'phone model unreachable').replace(/^LOCAL AI UNAVAILABLE — /i, '');
        await this.enterWaiting(job, {
          reason: health.reason || 'LOCAL AI UNAVAILABLE',
          event: 'brain.unavailable',
          message: `LOCAL AI UNAVAILABLE — ${waitReason}. Waiting to recover; no cloud fallback will be used.`
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

  /**
   * Build the "learned hints" injected into the brain context each cycle:
   * proven payloads, cross-hunt patterns, and — the autonomy hop — chain
   * candidates computed from THIS hunt's confirmed findings, so a new
   * finding reshapes the attack plan mid-hunt.
   */
  async buildLearnedHints({ job, methodologyStage, findings }) {
    // Payloads that worked before (self-learning library) and chain
    // candidates between confirmed findings are injected into the hunt
    // context, so the brain reasons over them every cycle.
    let learnedHints = '';
    try {
      if (this.payloadLibraryModel) {
        const stageTechniques = techniquesForStage(methodologyStage).map((t) => t.id);
        const hints = [];
        for (const techId of stageTechniques.slice(0, 5)) {
          const suggested = await this.payloadLibraryModel.suggest({ technique: techId, limit: 2 });
          hints.push(...suggested);
        }
        const proven = hints.filter((h) => h.successes > 0).slice(0, 5);
        if (proven.length) {
          learnedHints += '\nPROVEN PAYLOADS (worked in past hunts — prefer these for the matching technique):\n' +
            proven.map((h) => `- [${h.technique}] "${h.payload.slice(0, 120)}" (${h.successes}× success)`).join('\n');
        }
      }
        // --- Cross-hunt memory (idea #2): what did past hunts on THIS or
        // similar targets find? Surface patterns so the agent checks them first.
        if (this.findingModel && job.userId && job.target) {
          const targetHost = String(job.target).toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
          const pastFindings = await this.findingModel.listByUser(job.userId).catch(() => []);
          const relevant = pastFindings
            .filter((f) => {
              const asset = String(f.affectedAsset || f.target || '').toLowerCase();
              return asset.includes(targetHost) || targetHost.includes(asset.split('/')[0]);
            })
            .slice(0, 5);
          if (relevant.length) {
            learnedHints += '\nPAST HUNTS ON THIS TARGET (patterns found before — check these FIRST):\n' +
              relevant.map((f) => `- [${f.severity}] ${f.title} (${f.category || 'vuln'})`).join('\n');
          }
          // Pattern learning (idea #5): most successful vuln categories across ALL past hunts
          const byCategory = {};
          for (const f of pastFindings.slice(0, 50)) {
            const cat = f.category || 'general';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
          }
          const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
          if (topCats.length) {
            learnedHints += '\nYOUR STRONGEST PATTERNS (vuln types you find most — prioritize these):\n' +
              topCats.map(([cat, n]) => `- ${cat} (${n}× found)`).join('\n');
          }
        }
        if (Array.isArray(findings) && findings.length >= 2) {
          const existingChains = findings.filter((f) => f.category === 'vulnerability-chain');
          const chains = suggestChains(findings, existingChains).slice(0, 3);
          if (chains.length) {
            learnedHints += '\nCHAIN CANDIDATES (confirmed findings that combine into bigger attacks — file them with category "vulnerability-chain"): \n' +
              chains.map((c) => `- ${c.title} → severity ${c.severity.toUpperCase()}: ${c.description.slice(0, 160)}…`).join('\n');
          }
        }
    } catch (error) {
      this.logger.warn?.(`[agent-worker] learned-context enrichment failed: ${error.message}`);
    }
    return learnedHints;
  }

  async stepReason(job) {
    const jobId = job.id;
    const scopeEngine = new ScopeEngine(job.scope, job.target);

    // ── State awareness: the agent reads its own state FIRST ──────────
    // Every reasoning cycle begins from an explicit, persisted hunt state:
    // "nothing has started yet" → "I just did X" → "so next I should do Y".
    if (!job.huntState) {
      const initialized = await this.updateHuntState(jobId, { status: 'idle' });
      if (initialized) job = initialized;
    }

    const brain = await this.getBrainForJob(job);

    // ── Hierarchical context assembly (finite window, guaranteed fit) ──
    // HOT (sliding window over recent activity) + WARM (rolling hunt summary)
    // + COLD (file memory + payload library), all token-budgeted by the
    // HuntContextManager. Decision-critical facts (target, scope, objective)
    // live in the brain's fixed message sections and are never dropped.
    const [memoryContext, findings, toolResults, recentCycles] = await Promise.all([
      this.memory.buildBrainContext({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId: job.id,
        query: `${job.currentObjective || job.objective} ${job.target}`,
        maxTokens: 1100
      }),
      this.findingModel ? this.findingModel.list(job.assessmentId) : Promise.resolve([]),
      this.toolExecutionModel.list(job.assessmentId),
      // The persisted thinking loop: the brain always knows the full flow
      // state, even after a restart (issue #1 "the brain must always know").
      this.reasoningCycleModel
        ? this.reasoningCycleModel.recentSummaries(jobId, { limit: 6 })
        : Promise.resolve([])
    ]);

    // Periodic summarization: every K steps the hunt's aging history is
    // compressed into the warm rolling summary (brain-written, with a
    // deterministic extractive fallback). The brain never loses track of
    // what was tried, what was found, and what's pending — at step 500
    // exactly as at step 5.
    if (this.huntContextManager) {
      try {
        await this.huntContextManager.maybeRefreshSummary({ job, brain });
        const refreshed = await this.jobModel.get(jobId);
        if (refreshed) job = refreshed;
      } catch (error) {
        this.logger.warn?.(`[agent-worker] summary refresh failed: ${error.message}`);
      }
    }

    const computerStatus = this.computerState ? this.computerState.snapshot() : null;

    // ── Hunt state: where the methodology stands ───────────────────────
    // The brain must always know which techniques were already tried so the
    // hunt keeps moving to new angles instead of repeating or stopping.
    const methodologyStage = stageForPhase(job.phase);
    const techniquesTried = Array.isArray(job.techniquesTried) ? job.techniquesTried : [];
    const huntContext = describeHuntState({
      stage: methodologyStage,
      tried: techniquesTried,
      findingsCount: job.findingsCount || 0
    });

    // ── The agent hunts with everything it has learned ───────────────
    // (assembled by buildLearnedHints so the chain-injection is unit-testable)
    const learnedHints = await this.buildLearnedHints({ job, methodologyStage, findings });

    // Token-budgeted variable context for this step (falls back to the
    // legacy inline assembly when no context manager is wired, e.g. tests).
    let stepContext = null;
    if (this.huntContextManager) {
      try {
        stepContext = await this.huntContextManager.buildStepContext(job, {
          findings,
          recentCycles,
          learnedHints,
        });
      } catch (error) {
        this.logger.warn?.(`[agent-worker] context assembly failed, using fallback: ${error.message}`);
      }
    }

    const budgetedToolResults = (toolResults || []).slice(0, 6).map((execution) => ({
      tool: execution.tool,
      target: execution.target,
      summary: String(execution.aiSummary || execution.error || execution.status || '').slice(0, 600)
    }));

    const fallbackObservations = (job.activity || []).slice(-12).map((item) => ({
      kind: item.kind,
      summary: String(item.message || item.text || '').slice(0, 400)
    }));

    // --- Hypothesis Engine: load active hypotheses so the brain can track
    // competing theories across steps (idea #1: human-expert thinking) ---
    try {
      if (this.stateManager && job.assessmentId) {
        const state = await this.stateManager.getState?.(job.assessmentId)
          || await this.stateManager.agentStateModel?.get(job.assessmentId);
        const hyps = state?.hypotheses || state?.state?.hypotheses || [];
        job.hypotheses = hyps
          .filter((h) => !['killed', 'confirmed', 'disproven'].includes(h.status))
          .slice(0, 8)
          .map((h) => ({
            text: h.hypothesis || h.text,
            status: h.status || 'open',
            confidence: h.confidence,
            evidence: h.evidence,
            nextTest: h.nextTest
          }));
      }
    } catch (error) {
      this.logger.warn?.(`[agent-worker] hypothesis load failed: ${error.message}`);
    }

    // The warm summary rides along with the hunt context — compressed
    // experience the brain must treat as ground truth about this hunt.
    const composeHuntContext = (ctx) => {
      const warm = ctx && ctx.warmSummary
        ? `WARM MEMORY — rolling hunt summary (compressed experience, trust it):\n${ctx.warmSummary}\n\n`
        : '';
      return `${warm}${huntContext}${learnedHints}`;
    };

    const reasonOnce = async (ctx) => {
      const { decision } = await brain.decide({
        job,
        memoryContext: memoryContext.text,
        // The job's persisted activity feed IS the real observation stream —
        // windowed by the context manager so the prompt always fits.
        recentObservations: ctx ? ctx.hotObservations : fallbackObservations,
        toolResults: budgetedToolResults,
        findings: ctx ? ctx.findings : findings,
        computerStatus,
        recentCycles: ctx ? ctx.recentCycles : recentCycles,
        huntContext: composeHuntContext(ctx)
      });
      return decision;
    };

    let decision;
    try {
      decision = await reasonOnce(stepContext);
    } catch (error) {
      // Recovery: on a context-window failure, auto-compact (force a summary
      // refresh, shrink the hot window) and retry ONCE on a strictly smaller
      // prompt — instead of dying or parking blindly.
      if (error instanceof LocalAiUnavailableError && error.kind === 'context_window' && this.huntContextManager && !job.__compactRetried) {
        try {
          const { job: compactedJob, tightenedBudgets } = await this.huntContextManager.emergencyCompact({ job, brain });
          if (compactedJob) job = compactedJob;
          job.__compactRetried = true;
          stepContext = await this.huntContextManager.buildStepContext(job, {
            findings,
            recentCycles,
            learnedHints,
            variableBudgetTokens: tightenedBudgets.variableBudgetTokens,
            hotBudgetTokens: tightenedBudgets.hotBudgetTokens,
          });
          await this.publish(jobId, {
            type: 'brain.thinking',
            level: 'WARN',
            message: 'Local model context overflowed — auto-compacted hunt history and retrying with a smaller prompt'
          });
          decision = await reasonOnce(stepContext);
        } catch (retryError) {
          throw retryError; // outer loop handles: waiting state + slow retry
        }
      } else if (error instanceof LocalAiUnavailableError) {
        throw error; // outer loop handles
      } else {
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
      }
    }
    // ── State awareness: "I just decided X → so next I do Y" ─────────
    // The decision is recorded into the explicit hunt state BEFORE it runs,
    // so the next cycle (even after a crash/restart) knows exactly where
    // the hunt stands.
    {
      const nextAction = decision.nextAction || {};
      const decidedStage = nextAction.type === 'validate' ? 'verifying'
        : (decision.methodologyStage || methodologyStage);
      const firstHypothesis = Array.isArray(decision.hypotheses) && decision.hypotheses[0]
        ? decision.hypotheses[0].hypothesis
        : null;
      const updated = await this.updateHuntState(jobId, {
        status: decidedStage,
        stage: methodologyStage,
        lastAction: this.describeAction(nextAction),
        lastHypothesis: firstHypothesis || nextAction.hypothesis || job.huntState?.lastHypothesis || null,
        nextIntent: decision.expectedOutcome || decision.reason,
      });
      if (updated) job = updated;
      // The agent's file memory gets the same note — a human-readable trace
      // of what was decided and why.
      if (this.memory && typeof this.memory.appendJournal === 'function') {
        await this.memory.appendJournal({
          userId: job.userId,
          jobId: job.id,
          text: `Decided: ${this.describeAction(nextAction)}. Reason: ${decision.reason || '—'}`,
        }).catch(() => {});
      }
    }

      // ── Persist the decision *before* acting on it (#71) ────────────────
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
        summaryLabel: brain.constructor.statusLabel(decision)
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

    // ── Reasoning cycle: persist the thinking loop ─────────────────────
    // observation → thought → plan → action → expected outcome is recorded
    // now; the verification half lands after the action runs below, and the
    // adaptation half when the NEXT decision arrives (its reasoning IS the
    // adaptation to this cycle's verification).
    let cycle = null;
    if (this.reasoningCycleModel) {
      try {
        const previous = await this.reasoningCycleModel.getOpenCycle(jobId);
        cycle = await this.reasoningCycleModel.openCycle({
          userId: job.userId,
          assessmentId: job.assessmentId,
          jobId,
          stepNumber: (job.stepCount || 0) + 1,
          decision,
          plan: job.plan || null
        });
        if (previous && previous.id !== cycle.id) {
          await this.reasoningCycleModel.recordAdaptation(previous.id, {
            nextCycleId: cycle.id,
            nextObjective: decision.objective,
            nextReason: decision.reason
          });
        }
      } catch (error) {
        this.logger.warn?.(`[agent-worker] reasoning cycle open failed: ${error.message}`);
      }
    }

    this.lastStepVerification = null;
    await this.executeDecision(job, decision, scopeEngine);

    // The verification half of the thinking loop: what the action's outcome
    // check actually concluded (matched / mismatched / error / skipped).
    if (cycle && this.reasoningCycleModel) {
      try {
        const verification = this.lastStepVerification || {
          outcome: 'skipped',
          reason: 'this action type carries no expected-outcome check'
        };
        await this.reasoningCycleModel.recordVerification(cycle.id, verification);
        // ── State awareness: "I just did X (outcome Y)" ───────────────
        // The verified outcome lands in the explicit hunt state, so the next
        // cycle reasons from what ACTUALLY happened — not what was planned.
        {
          const outcomeText = `${verification.outcome || 'unknown'}${verification.reason ? ` — ${verification.reason}` : ''}`;
          const updated = await this.updateHuntState(jobId, { lastOutcome: outcomeText });
          if (updated) job = updated;
        }
        // The LEARN half: persist the lesson so the next cycle is smarter.
        if (verification.outcome === 'mismatched' || verification.outcome === 'error') {
          await this.reasoningCycleModel.recordLearning(cycle.id, {
            lesson: `Step ${cycle.stepNumber} (${cycle.technique || 'unknown technique'}): expected "${cycle.expectedOutcome || '?'}" but got "${verification.reason || '?'}" — do not repeat this exact approach; adapt the hypothesis.`
          });
        }
        // Track the tried technique on the job so the hunt never repeats an
        // angle and the UI can show real progress (non-stop hunting).
        if (cycle.technique) {
          const tried = Array.isArray(job.techniquesTried) ? job.techniquesTried : [];
          if (!tried.some((t) => (t.techniqueId || t) === cycle.technique)) {
            await this.jobModel.update(jobId, {
              techniquesTried: [...tried, {
                techniqueId: cycle.technique,
                stage: cycle.methodologyStage || methodologyStage,
                stepNumber: cycle.stepNumber,
                verification: verification.outcome,
                at: new Date().toISOString()
              }].slice(-200)
            });
          }
        }
        // ── Self-learning payload library ────────────────────────────
        // What the agent tried, and whether it worked, is remembered across
        // hunts. A payload that confirmed a finding once is suggested first
        // the next time the same technique is used — this is the agent
        // genuinely getting better with experience.
        if (this.payloadLibraryModel) {
          try {
            const attempt = this.extractPayloadAttempt(decision, cycle);
            if (attempt) {
              const outcome = verification.outcome === 'matched' ? 'success'
                : (verification.outcome === 'mismatched' || verification.outcome === 'error') ? 'failure'
                : 'neutral';
              await this.payloadLibraryModel.recordOutcome(attempt, outcome);
            }
          } catch (error) {
            this.logger.warn?.(`[agent-worker] payload learning failed: ${error.message}`);
          }
        }
      } catch (error) {
        this.logger.warn?.(`[agent-worker] reasoning cycle verification failed: ${error.message}`);
      }
    }
    this.lastStepVerification = null;

    // ── Attack surface: merge the brain's discoveries ──────────────────
    // Dedupe by kind+value; keep first-seen and refresh last-seen. This is
    // the live map the frontend draws, and the fingerprint card reads the
    // 'technology' entries.
    if (Array.isArray(decision.discoveredAssets) && decision.discoveredAssets.length) {
      try {
        await this.mergeDiscoveredAssets(jobId, job.assets, decision.discoveredAssets, cycle?.stepNumber || 0);
      } catch (error) {
        this.logger.warn?.(`[agent-worker] asset merge failed: ${error.message}`);
      }
    }

    // The brain has now decided *after* seeing the last computer action's
    // outcome — link the decision back to that action's ledger record so the
    // observe → decide edge is persisted (issue #1 "Persistence").
    await this.linkComputerActionDecision(jobId, decision);

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
        return this.runToolAction(job, action, scopeEngine);
      case 'parallel_tools':
        return this.runParallelToolsAction(job, action, scopeEngine);
      case 'computer_action':
        return this.runComputerAction(job, action, scopeEngine, decision);
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

  async runToolAction(job, action, scopeEngine = null) {
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
      }, { scopeEngine });

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

  /**
   * Run multiple independent tools in parallel (idea #3).
   * Each tool's result is stored as evidence + memory, same as a single run.
   */
  async runParallelToolsAction(job, action, scopeEngine = null) {
    const jobId = job.id;
    const tools = (action.tools || action.parallelTools || []).slice(0, 6);
    const names = tools.map((t) => t.name).join(', ');
    await this.jobModel.update(jobId, {
      currentAction: `parallel:[${names}] → ${job.target}`,
    });
    await this.recordActivity(jobId, { kind: 'tool', message: `Parallel tools: ${names}` });

    const requests = tools.map((t) => ({
      tool: t.name,
      target: t.target || action.target || job.target,
      arguments: t.arguments || {},
      timeout: t.timeout
    }));

    const results = await this.toolExecutor.executeParallel(job.assessmentId, job.userId, requests, { scopeEngine });
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    // Store each successful result as evidence + memory.
    for (const r of succeeded) {
      const res = r.result;
      try {
        await this.memory.rememberTool({
          userId: job.userId,
          assessmentId: job.assessmentId,
          jobId,
          key: `tool:${r.request.tool}`,
          content: `${r.request.tool} @ ${r.request.target} → ${String(res.aiSummary || '').slice(0, 1500)}`,
          refs: { toolExecutionId: res.execution?.id || null, url: r.request.target },
        });
        await this.stateManager.applyToolResult(job.assessmentId, r.request.tool, res.parsed);
      } catch { /* non-fatal */ }
    }
    for (const r of failed) {
      await this.recordActivity(jobId, { kind: 'error', message: `${r.request.tool} failed: ${r.error}` });
    }

    await this.recordActivity(jobId, {
      kind: 'tool',
      message: `Parallel batch done: ${succeeded.length} ok, ${failed.length} failed`
    });
    await this.publish(jobId, {
      type: 'tool.output',
      level: 'INFO',
      message: `Parallel recon: ${succeeded.map((r) => r.request.tool).join(', ')} completed`,
      data: { tools: succeeded.map((r) => r.request.tool), failed: failed.map((r) => r.request.tool) }
    });
    await this.jobModel.update(jobId, {
      lastObservation: {
        kind: 'parallel_tool_output',
        summary: succeeded.map((r) => `${r.request.tool}: ${String(r.result.aiSummary || '').slice(0, 300)}`).join('\n').slice(0, 1000),
        at: new Date().toISOString()
      }
    });
    return { succeeded: succeeded.length, failed: failed.length, results };
  }

  /**
   * Run one computer ("hands") action inside the autonomous loop.
   *
   * Implements the issue #1 observe → decide → act → observe cycle:
   *   1. the action is persisted *before* it runs (ComputerActionModel),
   *   2. after a meaningful action the screen is re-observed once it settles,
   *   3. the brain's `expectedOutcome` is compared against the real
   *      observation(s) and the verdict is published + persisted,
   *   4. failures produce concrete recovery strategies (recoveryAdvisor),
   *   5. the brain's next decision is linked back to this action's record.
   */
  async runComputerAction(job, action, scopeEngine, decision = null) {
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

    // Persist the action BEFORE it runs — an interrupted action must still be
    // on the ledger (issue #1 "Persistence").
    let actionRecord = null;
    if (this.computerActionModel) {
      try {
        actionRecord = await this.computerActionModel.record({
          jobId,
          assessmentId: job.assessmentId,
          userId: job.userId,
          action: action.action?.type,
          params: action.action?.params || {},
          expectedOutcome: action.action?.expectedOutcome || null,
          decision: decision
            ? { objective: decision.objective, reason: decision.reason, expectedOutcome: decision.expectedOutcome }
            : null
        });
      } catch (error) {
        this.logger.warn?.(`[agent-worker] computer action ledger unavailable: ${error.message}`);
      }
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

    const finishRecord = async (fields) => {
      if (actionRecord && this.computerActionModel) {
        try {
          await this.computerActionModel.markFinished(actionRecord.id, fields);
        } catch (error) {
          this.logger.warn?.(`[agent-worker] computer action ledger write failed: ${error.message}`);
        }
      }
      // The next decision the brain makes belongs to this action's outcome.
      if (actionRecord) this.pendingComputerAction.set(jobId, actionRecord.id);
    };

    if (result.ok) {
      const observation = result.observation;

      // The "observe" half of the loop: meaningful actions get a second,
      // post-settle look at the real screen (issue #1).
      let followUpObservation = null;
      if (typeof this.computer.observeAfterAction === 'function') {
        try {
          followUpObservation = await this.computer.observeAfterAction(result.action, { channel: jobId });
        } catch (error) {
          this.logger.warn?.(`[agent-worker] post-action re-observe failed: ${error.message}`);
        }
      }

      // Expected-vs-actual: an explicit verdict, not a raw observation the
      // brain might misread.
      const outcomeCheck = checkOutcome({
        expectedOutcome: action.action?.expectedOutcome,
        observation,
        followUpObservation
      });
      await this.publish(jobId, {
        type: 'browser.outcome',
        level: outcomeCheck.matched === false ? 'WARN' : 'INFO',
        message: outcomeCheck.matched === false
          ? `Outcome MISMATCH — expected "${action.action?.expectedOutcome}", observed "${observation.summary}${followUpObservation ? ` / ${followUpObservation.summary}` : ''}"`
          : `Outcome check: ${outcomeCheck.reason}`,
        data: {
          expected: action.action?.expectedOutcome || null,
          actual: observation.summary,
          followUp: followUpObservation?.summary || null,
          matched: outcomeCheck.matched,
          reason: outcomeCheck.reason
        }
      });
      if (outcomeCheck.matched === false) {
        await this.memory.rememberEpisodic({
          userId: job.userId,
          assessmentId: job.assessmentId,
          jobId,
          key: 'computer-outcome-mismatch',
          content: `COMPUTER OUTCOME MISMATCH: expected "${action.action?.expectedOutcome}" but observed "${observation.summary}". Do not assume the action worked — verify before building on it.`,
          importance: 0.85
        });
      }

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
        content: `COMPUTER: ${observation.summary}${followUpObservation ? ` | After settling: ${followUpObservation.summary}` : ''}`,
        refs: { url: observation.url || null }
      });
      await this.jobModel.update(jobId, {
        lastObservation: {
          kind: observation.kind,
          summary: observation.summary,
          followUp: followUpObservation?.summary || null,
          at: observation.at
        }
      });
      await this.recordActivity(jobId, {
        kind: 'browser',
        message: observation.summary,
        detail: followUpObservation ? `After settling: ${followUpObservation.summary}` : undefined
      });
      await this.publish(jobId, {
        type: 'browser.action',
        level: 'INFO',
        message: `${result.action.type}: ${observation.summary}`,
        data: { action: result.action, observation, followUpObservation, outcomeCheck }
      });

      await finishRecord({
        ok: true,
        output: result.output,
        observation,
        followUpObservation,
        outcomeCheck,
        durationMs: result.durationMs
      });
      // The verification verdict for this step's reasoning cycle.
      this.lastStepVerification = {
        outcome: outcomeCheck.matched === true ? 'matched' : outcomeCheck.matched === false ? 'mismatched' : 'skipped',
        reason: outcomeCheck.reason
      };
      return result;
    }

    // Failure triage:
    //   • the whole runtime is gone      → wait for it to come back (#34)
    //   • computer disabled by config    → NEVER wait: it will not come back.
    //     Record it and let the brain adapt to network-only tools.
    //   • this one action is impossible  → recovery strategies + brain adapts
    //   • the action was rejected        → recovery strategies + brain adapts
    const computerDisabledByConfig = this.computer?.enabled === false;
    const runtimeGone = !computerDisabledByConfig
      && (result.error?.kind === 'unavailable' || result.error?.kind === 'timeout')
      && this.computer.running !== true;
    // Concrete recovery strategies (issue #1 "Recoverable failures") — the
    // brain gets options, not just an error string.
    const recoveryAdvice = suggestRecovery({
      action: result.action,
      error: result.error,
      observation: null
    });
    await finishRecord({
      ok: false,
      output: null,
      observation: null,
      followUpObservation: null,
      outcomeCheck: null,
      error: result.error,
      durationMs: result.durationMs,
      recoveryAdvice
    });

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
        content: `COMPUTER ACTION ${result.rejected ? 'REJECTED' : 'UNAVAILABLE'} (${result.error?.kind}): ${result.error?.message} — recovery options:\n${formatRecoveryAdvice(recoveryAdvice)}`,
        importance: 0.8
      });
      await this.recordActivity(jobId, {
        kind: 'error',
        message: `Computer action ${result.rejected ? 'rejected' : 'unavailable'}: ${result.error?.message}`,
        detail: formatRecoveryAdvice(recoveryAdvice)
      });
      await this.publish(jobId, {
        type: 'browser.observation',
        level: 'WARN',
        message: `Computer action could not run: ${result.error?.message}`,
        data: { action: result.action, kind: result.error?.kind, recoveryAdvice }
      });
    }
    // The verification verdict for this step's reasoning cycle.
    this.lastStepVerification = {
      outcome: 'error',
      reason: result.error?.message || 'computer action failed'
    };
    return null;
  }

  /**
   * Link the brain's next decision back to the computer action whose outcome
   * it was based on, closing the persistence loop (issue #1).
   */
  async linkComputerActionDecision(jobId, decision) {
    const recordId = this.pendingComputerAction.get(jobId);
    if (!recordId || !this.computerActionModel || !decision) return;
    this.pendingComputerAction.delete(jobId);
    try {
      await this.computerActionModel.linkNextDecision(recordId, decision);
    } catch (error) {
      this.logger.warn?.(`[agent-worker] linking next decision failed: ${error.message}`);
    }
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
      hypothesisId: action.hypothesisId || null,
      cvssMetrics: action.cvssMetrics || null
    });

    if (result.created) {
      await this.jobModel.incrementCounters(job.id, { findingsCount: 1 });
      // Auto evidence capture (P1): every finding auto-attaches a fresh
      // screenshot + the recent command log + timestamps.
      await this.captureFindingEvidence(job, result.finding);
      await this.assessmentModel.incrementCounters(job.assessmentId, { findingsCount: 1 });
      await this.recordActivity(job.id, {
        kind: 'finding',
        message: `Finding confirmed: ${result.finding.title} (${result.finding.severity})`
      });

      // Critical-finding alert (P1): the user asked to be told the moment a
      // critical lands — never silently. Best-effort; never fails the hunt.
      if (result.finding.severity === 'critical' && this.alertService) {
        try {
          await this.alertService.notifyCriticalFinding({ userId: job.userId, job, finding: result.finding });
        } catch (error) {
          this.logger.warn?.(`[agent-worker] critical-finding alert failed: ${error.message}`);
        }
      }

      // Vulnerability chaining (P1): the brain may propose that this finding
      // chains with earlier ones (action.chain = { findingIds, title, ... }).
      // buildBrainChain VALIDATES the proposal — every referenced finding must
      // exist, belong to this hunt, and be confirmed — and escalates severity.
      // A rejected proposal is recorded as activity, never silently dropped.
      if (action.chain && Array.isArray(action.chain.findingIds) && action.chain.findingIds.length >= 2) {
        await this.recordBrainChain(job, action.chain, result.finding);
      }
    } else if (result.reason === 'no_evidence') {
      await this.recordActivity(job.id, {
        kind: 'finding',
        message: `Finding rejected (no evidence): ${action.title || action.description}`
      });
    }
    return result;
  }

  /**
   * Validate + record a brain-proposed vulnerability chain.
   *
   * The brain proposes chains ("XSS → session hijack → account takeover") as
   * action.chain. buildBrainChain() enforces the trust rules: every linked
   * finding must be real, belong to THIS hunt, and be confirmed. The validated
   * chain is filed as its own finding (category 'vulnerability-chain') with
   * escalated severity, so it shows up in the report and the findings board.
   */
  async recordBrainChain(job, chainProposal, triggerFinding) {
    try {
      const jobFindings = this.findingModel
        ? await this.findingModel.list(job.assessmentId)
        : [];
      // Include the just-created finding — the brain usually chains it.
      const allFindings = [...jobFindings];
      if (triggerFinding && !allFindings.some((f) => f.id === triggerFinding.id)) {
        allFindings.push(triggerFinding);
      }
      const chain = buildExploitChain(chainProposal, allFindings, job.id);
      // A chain's evidence IS its components' evidence — collect it, because
      // createFinding() rejects evidence-less findings (anti-fabrication rule).
      const componentById = new Map(allFindings.map((f) => [f.id, f]));
      const chainEvidenceIds = [];
      for (const componentId of chain.metadata?.chainOf || []) {
        const component = componentById.get(componentId);
        const ids = component?.evidence || component?.evidenceIds || [];
        for (const evidenceId of ids) {
          if (evidenceId && !chainEvidenceIds.includes(evidenceId)) chainEvidenceIds.push(evidenceId);
        }
      }
      const created = await this.findingLifecycle.createFinding({
        userId: job.userId,
        assessmentId: job.assessmentId,
        jobId: job.id,
        title: chain.title,
        severity: chain.severity,
        category: chain.category,
        asset: chain.target || job.target,
        endpoint: chain.endpoint || null,
        rootCause: `Chained: ${(chain.metadata?.chainOf || []).join(' → ')}`,
        description: chain.description,
        impact: chain.impact,
        reproductionSteps: chain.reproductionSteps || [],
        remediation: chain.remediation,
        confidence: 0.7,
        evidenceIds: chainEvidenceIds
      });
      if (created.created) {
        await this.jobModel.incrementCounters(job.id, { findingsCount: 1, chainsCount: 1 });
        await this.recordActivity(job.id, {
          kind: 'chain',
          message: `Vulnerability chain confirmed: ${chain.title} (escalated to ${chain.severity})`
        });
        await this.publish(job.id, {
          type: 'chain.confirmed',
          level: 'WARN',
          message: `Chained vulnerability: ${chain.title}`,
          data: { title: chain.title, severity: chain.severity, chainOf: chain.metadata.chainOf }
        });
      }
    } catch (error) {
      // Validation failed (unknown finding, cross-hunt reference, unconfirmed
      // link) — recorded visibly so the brain learns, never silently dropped.
      await this.recordActivity(job.id, {
        kind: 'chain',
        message: `Chain proposal rejected: ${error.message}`
      });
    }
  }

  /**
   * Merge brain-reported discoveries into the job's live attack-surface map.
   * Dedupes on kind+value (case-insensitive); refreshes lastSeen on repeat
   * sightings. Bounded at 500 assets.
   */
  async mergeDiscoveredAssets(jobId, existing, discovered, stepNumber) {
    const assets = Array.isArray(existing) ? [...existing] : [];
    const keyOf = (kind, value) => `${kind}::${String(value).toLowerCase()}`;
    const seen = new Set(assets.map((a) => keyOf(a.kind, a.value)));
    const at = new Date().toISOString();
    let changed = false;
    for (const item of discovered) {
      const key = keyOf(item.kind, item.value);
      const known = assets.find((a) => keyOf(a.kind, a.value) === key);
      if (known) {
        known.lastSeen = at;
        known.lastStep = stepNumber;
        changed = true;
      } else if (!seen.has(key)) {
        seen.add(key);
        assets.push({
          kind: item.kind,
          value: item.value,
          detail: item.detail || null,
          firstSeen: at,
          lastSeen: at,
          firstStep: stepNumber,
          lastStep: stepNumber
        });
        changed = true;
      }
    }
    if (changed) {
      await this.jobModel.update(jobId, { assets: assets.slice(-500) });
    }
    return assets;
  }

  /**
   * Auto evidence capture (P1): the moment a finding is confirmed, attach a
   * fresh screenshot of the current state plus the recent command log, each
   * timestamped. The finding's report then carries real proof, not just the
   * brain's word.
   */
  async captureFindingEvidence(job, finding) {
    const jobId = job.id;
    const capturedIds = [];
    const at = new Date().toISOString();

    // 1. Fresh screenshot of whatever the agent is looking at.
    if (this.computer) {
      try {
        const scopeEngine = new ScopeEngine(job.scope, job.target);
        const result = await this.computer.execute(
          { type: 'screenshot', params: {} },
          { channel: jobId, scopeEngine, approvalGranted: true }
        );
        if (result?.ok && result.observation) {
          const stored = await this.evidenceModel.store({
            userId: job.userId,
            assessmentId: job.assessmentId,
            jobId,
            findingId: finding.id,
            kind: 'screenshot',
            asset: job.target,
            endpoint: finding.affectedEndpoint || null,
            summary: `Auto-captured at finding confirmation: ${result.observation.summary}`,
            sha256: result.observation.sha256 || null,
            artifactPath: result.observation.path || null,
            metadata: { autoCaptured: true, at }
          });
          capturedIds.push(stored.evidence.id);
        }
      } catch (error) {
        this.logger.warn?.(`[agent-worker] auto screenshot failed: ${error.message}`);
      }
    }

    // 2. The recent command log: what the agent actually ran (terminal +
    // GUI actions with outputs), so the report's reproduction section is
    // grounded in the real hunt.
    if (this.computerActionModel) {
      try {
        const recent = await this.computerActionModel.listByJob(jobId, 15);
        if (recent.length) {
          const log = recent.map((action) => {
            const cmd = action.action === 'run_command' && action.params?.command
              ? `$ ${action.params.command}`
              : `${action.action} ${JSON.stringify(action.params || {}).slice(0, 200)}`;
            const rawOut = action.output?.stdout || action.output?.outputPreview || action.observation?.summary || action.error?.message || '';
            const out = String(rawOut).slice(0, 400);
            return `[${action.startedAt || '?'}] ${cmd}${out ? `\n    → ${out}` : ''}`;
          }).join('\n');
          const stored = await this.evidenceModel.store({
            userId: job.userId,
            assessmentId: job.assessmentId,
            jobId,
            findingId: finding.id,
            kind: 'terminal_output',
            asset: job.target,
            endpoint: finding.affectedEndpoint || null,
            summary: `Auto-captured command log (${recent.length} recent actions) at finding confirmation`,
            metadata: { autoCaptured: true, at, log: log.slice(0, 8000) }
          });
          capturedIds.push(stored.evidence.id);
        }
      } catch (error) {
        this.logger.warn?.(`[agent-worker] auto command-log capture failed: ${error.message}`);
      }
    }

    if (capturedIds.length) {
      await this.evidenceModel.linkToFinding(finding.id, capturedIds);
      await this.recordActivity(jobId, {
        kind: 'evidence',
        message: `Auto-attached ${capturedIds.length} evidence item(s) to finding "${finding.title}"`
      });
    }
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

    // ── Hybrid storage: archive the completed hunt as a persistent artifact ──
    // Working memory lived in files while the hunt ran; the finished product
    // (final report Markdown + finding summary) is archived in the DATABASE,
    // which is the source of truth for "what have we already hunted" and what
    // target dedup checks before ever running the agent again. A repeat hunt
    // of the same target saves a NEW version — history is never overwritten.
    // Archival failures must NEVER fail the hunt completion itself.
    let huntRecord = null;
    if (report && this.huntRecordModel) {
      try {
        huntRecord = await this.archiveHuntRecord(job, report);
        await this.publish(job.id, {
          type: 'report.archived',
          level: 'INFO',
          message: `Report archived as hunt record v${huntRecord.version}`,
          data: { huntRecordId: huntRecord.id, version: huntRecord.version }
        });
        await this.recordActivity(job.id, { kind: 'report', message: `Report archived (hunt record v${huntRecord.version})` });
      } catch (error) {
        this.logger.warn?.(`[agent-worker] hunt record archival failed for job ${job.id}: ${error.message}`);
        await this.recordActivity(job.id, { kind: 'report', message: `Report archival failed: ${error.message}` });
      }
    }

    await this.assessmentModel.setStatus(job.assessmentId, 'completed').catch?.(() => {});
    await this.jobModel.transition(job.id, 'completed', { brainStatus: 'idle', waitingReason: null });

    // ── Recursive self-learning (LOCAL ONLY) ──────────────────────────
    // The agent teaches itself from every hunt. Learnings stay in
    // ~/.darkmatter/recursive/ on the user's own machine — never cloud.
    // Each hunt makes the next one smarter: payloads evolve, strategies
    // sharpen. Best-effort: learning must never fail a completed hunt.
    try {
      const { observeHunt } = await import('../engines/recursiveLearner.js');
      const findings = this.findingModel ? await this.findingModel.list(job.assessmentId).catch(() => []) : [];
      const toolExecs = this.toolExecutionModel ? await this.toolExecutionModel.list(job.assessmentId).catch(() => []) : [];
      const learned = observeHunt({
        target: job.target,
        techStack: job.techStack || [],
        findings: findings.map((f) => ({ type: f.type || f.category, payload: f.evidence?.payload })),
        payloadsTried: toolExecs.map((t) => ({ payload: t.arguments?.payload || t.tool })),
        durationMs: Date.now() - new Date(job.startedAt || job.createdAt).getTime(),
      });
      await this.publish(job.id, {
        type: 'agent.evolved',
        level: 'INFO',
        message: `Agent evolved from this hunt: ${learned.newVariants} new payload variants bred, ${learned.totalPayloads} in arsenal across ${learned.huntsObserved} hunts`,
        data: learned,
      });
    } catch (error) {
      this.logger.warn?.(`[agent-worker] recursive learning failed for job ${job.id}: ${error.message}`);
    }

    await this.publish(job.id, {
      type: 'job.completed',
      level: 'INFO',
      message: `Assessment completed — ${reason}`,
      data: { reason, reportId: report?.id || null, reportVersion: report?.version || null, huntRecordId: huntRecord?.id || null }
    });
    await this.recordActivity(job.id, { kind: 'agent', message: `Assessment completed — ${reason}` });

    // Hunt-complete alert + multi-target queue advance. Best-effort: neither
    // may fail a completion that already happened.
    if (this.alertService) {
      try {
        const summary = report?.findingsSummary || {};
        await this.alertService.notifyHuntComplete({
          userId: job.userId,
          job,
          stats: {
            total: summary.total ?? 0,
            critical: summary.critical ?? 0,
            high: summary.high ?? 0
          }
        });
      } catch (error) {
        this.logger.warn?.(`[agent-worker] hunt_complete alert failed: ${error.message}`);
      }
    }
    if (this.targetQueueService) {
      try {
        await this.targetQueueService.onJobComplete(job);
      } catch (error) {
        this.logger.warn?.(`[agent-worker] queue advance failed: ${error.message}`);
      }
    }
    return { completed: true, report, huntRecord };
  }

  /**
   * Archive a completed hunt's final report into the database (hunt_records).
   *
   * Fingerprints the target URL leniently (job.target is a bare hostname, the
   * assessment carries the full normalized URL) and renders the report object
   * to Markdown — the persistent, re-downloadable artifact.
   */
  async archiveHuntRecord(job, report) {
    const assessment = await this.assessmentModel.get(job.userId, job.assessmentId).catch(() => null);
    const targetUrl = assessment?.targetUrl || job.target;
    const fingerprint = fingerprintTargetLenient(targetUrl);
    const startedAt = job.startedAt || job.createdAt;
    const durationMs = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;
    const summary = report.findingsSummary || {};
    return this.huntRecordModel.create({
      userId: job.userId,
      target: targetUrl,
      targetCanonical: fingerprint?.canonical || String(targetUrl || ''),
      // Unparseable targets still get a stable (non-dedupable) key — archival
      // must never throw on a weird target string.
      targetHash: fingerprint?.hash || `unparseable:${String(targetUrl || '').toLowerCase()}`,
      jobId: job.id,
      assessmentId: job.assessmentId,
      reportMarkdown: report.markdown || renderHuntReportMarkdown(report),
      summary: {
        totalFindings: summary.total ?? report.totalFindings ?? 0,
        critical: summary.critical ?? 0,
        high: summary.high ?? 0,
        medium: summary.medium ?? 0,
        low: summary.low ?? 0,
        info: summary.informational ?? 0,
        steps: job.stepCount ?? 0,
        durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? Math.round(durationMs) : 0
      },
      findings: (report.detailedFindings || []).map((finding) => ({
        id: finding.id,
        title: finding.title,
        severity: finding.severity,
        category: finding.category,
        affectedAsset: finding.affectedAsset,
        affectedEndpoint: finding.affectedEndpoint,
        confidence: finding.confidence,
        status: finding.status
      }))
    });
  }

  async pauseJob(job) {
    await this.jobModel.transition(job.id, 'paused', { brainStatus: 'paused' });
    await this.updateHuntState(job.id, { status: 'paused' });
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
      await this.updateHuntState(job.id, { status: 'waiting', lastOutcome: `waiting — ${reason}` });
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

  /**
   * Extract the "payload" the agent tried from a decision, for the
   * self-learning payload library. The interesting payloads are the probe
   * strings: commands run, text typed into the target, URLs opened.
   * Returns null when the decision carried no learnable payload.
   */
  extractPayloadAttempt(decision, cycle) {
    const next = decision && decision.nextAction;
    if (!next) return null;

    let payload = null;
    let description = null;

    if (next.type === 'computer_action' && next.action && typeof next.action === 'object') {
      const params = next.action.params || {};
      if (next.action.type === 'run_command' && params.command) {
        payload = String(params.command);
        description = 'shell command';
      } else if (next.action.type === 'type' && params.text) {
        payload = String(params.text);
        description = 'typed input';
      } else if (next.action.type === 'open_url' && params.url) {
        payload = String(params.url);
        description = 'opened URL';
      }
    } else if (next.type === 'tool' && next.args && typeof next.args === 'object') {
      // Tool executions with string args (e.g. a probe string) are learnable.
      const probeArg = Object.values(next.args).find((v) => typeof v === 'string' && v.length > 0 && v.length <= 2000);
      if (probeArg) {
        payload = String(probeArg);
        description = `tool ${next.name || 'execution'} argument`;
      }
    }

    if (!payload || payload.length > 2000) return null;

    return {
      technique: (cycle && cycle.technique) || null,
      category: next.category || null,
      payload,
      description,
      context: (decision.reason || '').slice(0, 300),
    };
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
