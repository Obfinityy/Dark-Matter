import crypto from 'node:crypto';
import { validateComputerAction, COMPUTER_ACTIONS } from '../computer/actionSchema.js';
import { resolveApplication, isApplicationBlocked } from '../computer/applicationResolver.js';
import { LocalAiUnavailableError, BrainDecisionError } from '../agent/autonomousBrain.js';
import { ACTIVE_TASK_STATES, TERMINAL_TASK_STATES } from '../models/computerTaskModel.js';

/**
 * ComputerTaskWorker — the InfiniteChat computer-agent loop.
 *
 *   INSTRUCTION → UNDERSTAND → PLAN → ACTION → OBSERVE → VERIFY → REASON AGAIN → … → COMPLETE
 *
 * Design constraints honoured here (mirror AgentWorker; the two share the
 * computer layer but stay logically separated):
 *
 *   • The loop runs in the worker, never inside an HTTP request. The browser
 *     can refresh, disconnect or die — the task continues and recovers (#25).
 *   • Zero artificial quotas: no step cap, no runtime cap, no token cap (#18).
 *     The only exits are complete (verified) / cancelled / a real failure /
 *     a waiting state.
 *   • Every AI action passes: schema validation → policy (app blocklist) →
 *     actionSchema whitelist/params → adapter → Python bridge → Windows (#22).
 *   • Cancel is honoured strictly BETWEEN atomic operations; state stays clean (#26).
 *   • The local phone Gemma is the only brain; busy/unreachable → waiting_ai,
 *     retried on a cadence, surfaced to the user (#19).
 *   • No fake success: open_application without a confirming window observation
 *     is not "opened"; complete requires evidence the brain quotes from a real
 *     observation (#11, #27).
 */

const TERMINAL = new Set(TERMINAL_TASK_STATES);

/** Liveness guard, not a quota: the agent must not spin on an identical no-op. */
const NO_PROGRESS_REPEAT_LIMIT = Number(process.env.TASK_NO_PROGRESS_REPEAT_LIMIT || 6);
/** Consecutive unusable-decision strikes before parking in a real waiting state. */
const DECISION_STRIKE_LIMIT = Number(process.env.TASK_DECISION_STRIKE_LIMIT || 6);

export class ComputerTaskWorker {
  constructor({
    taskModel,
    chatModel = null,
    brain,
    computer,
    computerState = null,
    computerEvents = null,
    eventService,
    logger = console,
  }) {
    this.taskModel = taskModel;
    this.chatModel = chatModel;
    this.brain = brain;
    this.computer = computer;
    this.computerState = computerState;
    this.computerEvents = computerEvents;
    this.eventService = eventService;
    this.logger = logger;
    // Surface schema rejections that the brain retries transparently, so the
    // activity feed shows "unusable AI decision — retrying" instead of silence.
    brain.onDecisionRejection = ({ taskId, errors, attempt }) => {
      if (!taskId) return;
      this.activity(taskId, {
        kind: 'brain',
        icon: '⚠️',
        message: `Unusable AI decision (attempt ${attempt}) — retrying: ${truncate(errors.join('; '), 120)}`,
      });
    };
    this.config = {
      idleDelayMs: Number(process.env.TASK_WORKER_IDLE_MS || 400),
      aiRetryMs: Number(process.env.TASK_AI_RETRY_MS || 15_000),
      computerRetryMs: Number(process.env.TASK_COMPUTER_RETRY_MS || 10_000),
      leaseMs: Number(process.env.TASK_WORKER_LEASE_MS || 60_000),
    };
    this.noProgress = new Map();
    this.decisionStrikes = new Map();
    /** taskId → { abort, wake } so cancel/shutdown act immediately. */
    this.running = new Map();
    this.stopped = false;
  }

  isRunning(taskId) {
    return this.running.has(taskId);
  }

  get runningTaskIds() {
    return [...this.running.keys()];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────
  /** Run a task to a terminal (or waiting/paused) state. Duplicate-safe. */
  async run(taskId) {
    if (this.running.has(taskId)) return { status: 'already_running' };
    const task = await this.taskModel.get(taskId);
    if (!task) return { status: 'not_found' };
    if (TERMINAL.has(task.status)) return { status: task.status };

    const control = { abort: false, wake: null };
    this.running.set(taskId, control);

    try {
      await this.taskModel.claim(taskId, {
        lease: `lease_${crypto.randomUUID().slice(0, 12)}`,
        leaseMs: this.config.leaseMs,
        workerStartedAt: new Date().toISOString(),
      });
      if (task.status === 'queued') {
        await this.taskModel.transition(taskId, 'understanding', { brainStatus: 'thinking' });
      } else {
        await this.taskModel.transition(taskId, 'resuming', {
          brainStatus: 'thinking',
          waitingReason: null,
        });
      }
      await this.publish(taskId, {
        type: 'task.started',
        level: 'INFO',
        message: `Computer task started: ${truncate(task.instruction, 120)}`,
        data: { instruction: task.instruction, continuationOf: task.continuationOf },
      });
      await this.activity(taskId, { kind: 'agent', icon: '🧠', message: 'Understanding request' });

      await this.loop(taskId);
      return { status: 'finished' };
    } catch (error) {
      this.logger.error?.(`[computer-task-worker] task ${taskId} crashed:`, error.message);
      await this.taskModel.recordError(taskId, { message: error.message, fatal: true });
      await this.taskModel.transition(taskId, 'failed', {
        brainStatus: 'stopped',
        waitingReason: null,
      });
      await this.publish(taskId, {
        type: 'task.failed',
        level: 'ERROR',
        message: `Task failed: ${error.message}`,
        data: { error: error.message },
      });
      await this.activity(taskId, {
        kind: 'error',
        icon: '❌',
        message: `Task failed: ${truncate(error.message, 200)}`,
      });
      return { status: 'failed', error: error.message };
    } finally {
      this.running.delete(taskId);
      await this.taskModel.release(taskId).catch?.(() => {});
    }
  }

  // ── The loop ──────────────────────────────────────────────────────────
  async loop(taskId) {
    while (true) {
      const control = this.running.get(taskId);
      if (!control || control.abort || this.stopped) return;

      let task = await this.taskModel.get(taskId);
      if (!task) return;
      if (TERMINAL.has(task.status)) return;

      if (task.cancelRequested) {
        await this.cancelTask(task, 'cancelled by user');
        return;
      }
      if (task.status === 'ask_user') {
        // Parked until provideAnswer() flips status → resuming.
        await this.sleepInterruptible(taskId, 1000);
        continue;
      }

      await this.taskModel.heartbeat(taskId, { lease: task.lease });

      // ── Reason ────────────────────────────────────────────────────────
      try {
        task = await this.stepReason(task);
      } catch (error) {
        if (error instanceof LocalAiUnavailableError) {
          const computerWaiting = error.kind === 'computer_unavailable';
          await this.enterWaiting(task, {
            status: computerWaiting ? 'waiting_computer' : 'waiting_ai',
            reason: error.message,
            message: computerWaiting
              ? `Computer control unavailable — ${error.message}. Retrying automatically.`
              : `${error.message} — waiting for the local AI to free up. No cloud fallback will be used.`,
          });
          await this.sleepInterruptible(
            taskId,
            computerWaiting ? this.config.computerRetryMs : this.config.aiRetryMs
          );
          continue;
        }
        throw error;
      }
      if (!task) return;
      if (TERMINAL.has(task.status)) return;
    }
  }

  /**
   * One reasoning round: build context → decide → validate → execute →
   * observe → persist. Returns the refreshed task.
   */
  async stepReason(task) {
    const taskId = task.id;

    // 1. Build bounded context from Mongo (never the whole database).
    const [conversation, computerStatus] = await Promise.all([
      this.buildConversationContext(task),
      Promise.resolve(this.computerState ? this.computerState.snapshot() : null),
    ]);

    // 2. Ask the local brain for exactly one structured step.
    let decision, model;
    try {
      ({ decision, model } = await this.brain.decide({
        task,
        conversation,
        computerStatus,
        userAnswer: task.status === 'resuming' && task.answer ? task.answer : null,
      }));
    } catch (error) {
      if (error instanceof LocalAiUnavailableError) throw error;
      if (!(error instanceof BrainDecisionError)) throw error;

      const streak = (this.decisionStrikes.get(taskId) || 0) + 1;
      this.decisionStrikes.set(taskId, streak);
      await this.taskModel.recordError(taskId, { message: error.message, kind: 'brain_error' });
      await this.publish(taskId, {
        type: 'task.brain_decision',
        level: 'WARN',
        message: `Local AI produced an unusable decision (attempt ${streak}): ${truncate(error.message, 200)}`,
        data: { errors: error.errors },
      });
      await this.activity(taskId, {
        kind: 'brain',
        icon: '⚠️',
        message: `Unusable AI decision (attempt ${streak}) — retrying`,
      });
      if (streak >= DECISION_STRIKE_LIMIT) {
        this.decisionStrikes.delete(taskId);
        throw new LocalAiUnavailableError(
          `LOCAL AI UNAVAILABLE — produced no usable decision after ${streak} attempts: ${truncate(error.message, 160)}`,
          { kind: 'decision_failed' }
        );
      }
      await this.sleepInterruptible(taskId, Math.min(500 * streak, 4000));
      return this.taskModel.get(taskId);
    }
    this.decisionStrikes.delete(taskId);

    // Leave any waiting state exactly once, now that reasoning works again.
    if (task.status === 'waiting_ai' || task.status === 'waiting_computer') {
      await this.taskModel.transition(taskId, 'continue', {
        waitingReason: null,
        brainStatus: 'decided',
      });
      await this.publish(taskId, {
        type: 'task.resumed',
        level: 'INFO',
        message: 'Local AI is available again — resuming the task',
      });
      task = await this.taskModel.get(taskId);
    }

    // 3. Persist the decision BEFORE acting on it.
    await this.taskModel.update(taskId, {
      brainStatus: 'decided',
      currentAction: describeDecision(decision),
    });
    await this.publish(taskId, {
      type: 'task.decision',
      level: 'INFO',
      message: decision.reason,
      data: { decision, model },
    });

    // 4. Execute the decision (each branch updates phase + activity + events).
    const result = await this.executeDecision(task, decision);

    // 5. Progress bookkeeping + liveness guard: an unchanged action+window
    // signature accumulates a streak; any genuinely different state resets it.
    if (result?.noProgressSignature) {
      const streak = (this.noProgress.get(taskId) || 0) + 1;
      this.noProgress.set(taskId, streak);
      if (streak >= NO_PROGRESS_REPEAT_LIMIT) {
        this.noProgress.delete(taskId);
        await this.taskModel.recordError(taskId, {
          message: `no progress: similar action repeated ${streak} times without the screen changing`,
          kind: 'no_progress',
        });
        await this.taskModel.transition(taskId, 'failed', { brainStatus: 'stuck' });
        await this.publish(taskId, {
          type: 'task.failed',
          level: 'ERROR',
          message: `Stopping: the same step keeps repeating without progress (${streak}×). The desktop may need manual attention.`,
          data: { signature: result.noProgressSignature },
        });
        await this.activity(taskId, {
          kind: 'error',
          icon: '❌',
          message: 'Stuck on a repeating step — task stopped to stay inspectable',
        });
        return this.taskModel.get(taskId);
      }
    } else {
      this.noProgress.delete(taskId);
    }

    await this.taskModel.incrementCounters(taskId, { stepCount: 1 });
    await this.taskModel.checkpoint(taskId, {
      step: (task.stepCount || 0) + 1,
      phase: task.phase,
      status: task.status,
      at: new Date().toISOString(),
    });
    await this.sleepInterruptible(taskId, this.config.idleDelayMs);
    return this.taskModel.get(taskId);
  }

  // ── Decision execution ────────────────────────────────────────────────
  async executeDecision(task, decision) {
    switch (decision.type) {
      case 'action':
        return this.runAction(task, decision);
      case 'observe':
        return this.runObserve(task, decision);
      case 'complete':
        return this.runComplete(task, decision);
      case 'ask_user':
        return this.runAskUser(task, decision);
      case 'retry':
        return this.runRetry(task, decision);
      case 'wait':
        return this.runWait(task, decision);
      default:
        throw new BrainDecisionError(`Unsupported decision type: ${decision.type}`);
    }
  }

  /**
   * One validated computer action + mandatory follow-up observation.
   * This is the "hands" path: schema → policy → whitelist → adapter → bridge → Windows.
   */
  async runAction(task, decision) {
    const taskId = task.id;
    const rawAction = decision.action;

    // ── Policy layer 1: application blocklist (requirement #28, #15) ──
    if (rawAction.type === COMPUTER_ACTIONS.OPEN_APPLICATION) {
      const requested = String(rawAction.params?.name || '');
      const blocked = isApplicationBlocked(requested);
      if (blocked.blocked) {
        await this.rejectAction(
          task,
          rawAction,
          `Policy violation: ${requested} → ${blocked.reason}. This application is never driven by DARKMATTER.`
        );
        return { noProgressSignature: null };
      }
      // NL resolution: "MS Word" → winword. The brain may also have already
      // used a launch name; resolution only fires when it recognises one.
      const resolved = resolveApplication(requested);
      const launchName = resolved ? resolved.launch : requested.trim();
      rawAction.params.name = launchName;
      rawAction.resolvedApplication = resolved?.canonical || launchName;
      await this.taskModel.update(taskId, { currentApplication: rawAction.resolvedApplication });
    }

    // ── Policy layer 2: schema + params + scope via the shared actionSchema ──
    const validation = validateComputerAction(rawAction);
    if (!validation.valid) {
      await this.rejectAction(
        task,
        rawAction,
        `Action rejected by schema validation: ${validation.errors.join('; ')}`
      );
      return { noProgressSignature: null };
    }

    // ── Execute for real ──
    await this.taskModel.transition(taskId, 'executing', { phase: 'executing' });
    if (decision.userMessage && decision.userMessage !== task.currentAction) {
      await this.activity(taskId, {
        kind: 'action',
        icon: iconFor(rawAction.type),
        message: decision.userMessage,
        detail: decision.reason,
      });
    }
    await this.publish(taskId, {
      type: 'task.action_started',
      level: 'INFO',
      message: `Action: ${describeAction(rawAction)}`,
      data: { action: validation.action },
    });

    const result = await this.computer.execute(validation.action, {
      channel: taskId,
      approvalGranted: true, // tasks created by the authenticated user ARE the approval
    });

    if (!result.ok) {
      await this.handleActionFailure(task, validation.action, result);
      return {
        noProgressSignature:
          result.error?.kind === 'rejected' ? null : signatureOf(validation.action),
      };
    }

    // ── Mandatory observation: an action is not "success" until observed (#11) ──
    await this.taskModel.transition(taskId, 'observing', { phase: 'observing' });
    const observation = await this.observeAfterAction(taskId);

    // Window tracking for open_application: verify the window actually appeared.
    if (rawAction.type === COMPUTER_ACTIONS.OPEN_APPLICATION) {
      // Real window titles look like "Document1 - Word", "*Untitled - Notepad",
      // "Calculator" — so match on the distinctive last word of the app name.
      const expected = String(
        rawAction.resolvedApplication || rawAction.params.name || ''
      ).toLowerCase();
      const title = String(observation.title || '').toLowerCase();
      const lastWord = value =>
        String(value || '')
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .pop() || '';
      const titleFirst = firstToken(title);
      const opened =
        Boolean(observation.title) &&
        (title.includes(lastWord(expected)) || lastWord(expected).includes(titleFirst));
      await this.taskModel.update(taskId, {
        activeWindow: observation.title || null,
        verificationStatus: opened ? 'verified' : 'pending',
      });
      if (opened) {
        await this.activity(taskId, {
          kind: 'observation',
          icon: '✓',
          message: `${rawAction.resolvedApplication} window detected`,
        });
      } else if (observation.title) {
        await this.activity(taskId, {
          kind: 'observation',
          icon: '👁',
          message: `Active window: ${truncate(observation.title, 80)}`,
        });
      }
    } else if (observation.title) {
      await this.taskModel.update(taskId, { activeWindow: observation.title });
    }

    // Track content the brain is dictating (for follow-ups like "make it more formal").
    if (rawAction.type === COMPUTER_ACTIONS.TYPE) {
      const text = String(validation.action.params?.text || '');
      const existing = task.generatedContent ? `${task.generatedContent}${text}` : text;
      await this.taskModel.update(taskId, { generatedContent: existing.slice(0, 20_000) });
    }

    // Persist the durable action record + activity + event.
    await this.taskModel.pushCompletedAction(taskId, {
      type: validation.action.type,
      params: summarizeParams(validation.action),
      ok: true,
      observation: truncate(observation.summary, 300),
    });
    await this.taskModel.update(taskId, {
      lastAction: {
        type: validation.action.type,
        reason: decision.reason,
        at: new Date().toISOString(),
      },
      lastActionResult: { ok: true, at: new Date().toISOString() },
      lastObservation: {
        kind: observation.kind,
        summary: observation.summary,
        at: new Date().toISOString(),
      },
    });
    await this.publish(taskId, {
      type: 'task.observation',
      level: 'INFO',
      message: observation.summary,
      data: { observation, action: validation.action },
    });
    await this.activity(taskId, {
      kind: 'observation',
      icon: '✓',
      message: truncate(observation.summary, 160),
    });

    await this.taskModel.transition(taskId, 'continue', {
      phase: 'verifying',
      brainStatus: 'thinking',
    });
    return { noProgressSignature: signatureOf(validation.action, observation) };
  }

  /** Honest failure triage — never fake success (#27, #44). */
  async handleActionFailure(task, action, result) {
    const taskId = task.id;
    const kind = result.error?.kind || 'error';
    const message = result.error?.message || 'unknown error';

    await this.taskModel.update(taskId, {
      lastAction: { type: action.type, reason: null, at: new Date().toISOString() },
      lastActionResult: { ok: false, error: message, kind, at: new Date().toISOString() },
      verificationStatus: 'failed',
    });
    await this.taskModel.recordError(taskId, {
      message: `${action.type} failed (${kind}): ${message}`,
      kind,
    });

    if (kind === 'rejected') {
      // The action can never run (policy/schema). Tell the brain to adapt.
      await this.publish(taskId, {
        type: 'task.action_failed',
        level: 'WARN',
        message: `Action rejected: ${truncate(message, 240)}`,
        data: { action, kind },
      });
      await this.activity(taskId, {
        kind: 'error',
        icon: '⚠️',
        message: `Action rejected: ${truncate(message, 160)}`,
      });
      await this.taskModel.transition(taskId, 'continue', { brainStatus: 'thinking' });
      return;
    }

    if (kind === 'unavailable' || kind === 'timeout') {
      const helpMsg = `${truncate(message, 140)} — Start the desktop bridge: open a terminal, cd to backend/computer, run: python openInterfaceBridge.py`;
      await this.activity(taskId, {
        kind: 'error',
        icon: '🔌',
        message: `Computer layer unavailable: ${helpMsg}`,
      });
      throw new LocalAiUnavailableError(helpMsg, { kind: 'computer_unavailable' });
    }

    // Real bridge/Windows error → let the brain see it and retry/adjust.
    await this.publish(taskId, {
      type: 'task.action_failed',
      level: 'ERROR',
      message: `Action failed: ${truncate(message, 240)}`,
      data: { action, kind },
    });
    await this.activity(taskId, {
      kind: 'error',
      icon: '❌',
      message: `${action.type} failed: ${truncate(message, 140)}`,
    });
    await this.taskModel.transition(taskId, 'continue', { brainStatus: 'thinking' });
  }

  /** Observation as a first-class step chosen by the brain. */
  async runObserve(task, decision) {
    const taskId = task.id;
    await this.taskModel.transition(taskId, 'observing', { phase: 'observing' });
    await this.activity(taskId, {
      kind: 'action',
      icon: '👁',
      message: decision.userMessage || 'Observing the screen…',
    });
    const observation = await this.observeAfterAction(taskId, decision.method);
    await this.taskModel.update(taskId, {
      activeWindow: observation.title ?? task.activeWindow,
      lastObservation: {
        kind: observation.kind,
        summary: observation.summary,
        at: new Date().toISOString(),
      },
      // A successful observation proves the computer layer responds again —
      // it clears a prior runtime-failure flag so a later, evidence-backed
      // completion is not wrongly refused.
      lastActionResult: { ok: true, kind: 'observation', at: new Date().toISOString() },
    });
    await this.publish(taskId, {
      type: 'task.observation',
      level: 'INFO',
      message: observation.summary,
      data: { observation },
    });
    await this.activity(taskId, {
      kind: 'observation',
      icon: '✓',
      message: truncate(observation.summary, 160),
    });
    await this.taskModel.transition(taskId, 'continue', {
      phase: 'verifying',
      brainStatus: 'thinking',
    });
    return { noProgressSignature: null };
  }

  /**
   * Completion — only through an explicit brain decision WITH evidence.
   * The task literally cannot set completed=true any other way (#16, #27).
   */
  async runComplete(task, decision) {
    const taskId = task.id;

    // NO FAKE SUCCESS (#27): the last action must not have failed at runtime.
    // A policy/schema REJECTION is different — explaining the refusal and
    // stopping is the honest outcome there. A runtime failure (unavailable /
    // bridge error) means the environment is broken; completing on top of it
    // would report success over a broken desktop.
    const lastResult = task.lastActionResult;
    if (
      lastResult &&
      lastResult.ok === false &&
      lastResult.kind &&
      lastResult.kind !== 'rejected'
    ) {
      const message = `Completion refused: the last action failed at runtime (${lastResult.kind}: ${truncate(lastResult.error || '', 120)}). Recover, retry, or ask the user.`;
      await this.taskModel.recordError(taskId, { message, kind: 'completion_refused' });
      await this.publish(taskId, {
        type: 'task.brain_decision',
        level: 'WARN',
        message: truncate(message, 280),
        data: { lastResult },
      });
      await this.activity(taskId, {
        kind: 'error',
        icon: '⚠️',
        message: 'Completion refused — the last action did not succeed',
      });
      await this.taskModel.update(taskId, {
        lastAction: { type: 'complete', reason: decision.reason, at: new Date().toISOString() },
        lastActionResult: {
          ok: false,
          error: message,
          kind: 'completion_refused',
          at: new Date().toISOString(),
        },
      });
      await this.taskModel.transition(taskId, 'continue', { brainStatus: 'thinking' });
      return { noProgressSignature: null };
    }

    await this.taskModel.transition(taskId, 'verifying', {
      phase: 'verifying',
      verificationStatus: 'verified',
    });
    await this.activity(taskId, {
      kind: 'verify',
      icon: '🔎',
      message: 'Verifying result',
      detail: decision.verificationEvidence,
    });

    const finalMessage = decision.userMessage;
    await this.taskModel.update(taskId, { finalMessage, verificationStatus: 'verified' });
    await this.taskModel.transition(taskId, 'completed', {
      brainStatus: 'idle',
      waitingReason: null,
    });
    await this.publish(taskId, {
      type: 'task.completed',
      level: 'INFO',
      message: finalMessage,
      data: { verificationEvidence: decision.verificationEvidence, steps: task.stepCount + 1 },
    });
    await this.activity(taskId, { kind: 'complete', icon: '✅', message: finalMessage });

    // Mirror the completion into the InfiniteChat conversation as an assistant message.
    await this.appendChatMessage(task, 'assistant', finalMessage);
    return { noProgressSignature: null };
  }

  /** Park the task and wait for the human (#16 ask_user). */
  async runAskUser(task, decision) {
    const taskId = task.id;
    await this.taskModel.transition(taskId, 'ask_user', {
      brainStatus: 'waiting_user',
      answer: null,
    });
    await this.taskModel.update(taskId, { answer: decision.question });
    await this.publish(taskId, {
      type: 'task.ask_user',
      level: 'INFO',
      message: decision.question,
      data: { question: decision.question },
    });
    await this.activity(taskId, {
      kind: 'ask',
      icon: '❓',
      message: truncate(decision.question, 200),
    });
    await this.appendChatMessage(task, 'assistant', `❓ ${decision.question}`);
    return { noProgressSignature: null };
  }

  /** The brain explicitly changes approach after a failure. */
  async runRetry(task, decision) {
    const taskId = task.id;
    await this.activity(taskId, {
      kind: 'retry',
      icon: '🔁',
      message: `Retrying with a different approach`,
      detail: decision.adjustment,
    });
    await this.taskModel.update(taskId, {
      lastAction: null,
      lastActionResult: null,
    });
    await this.taskModel.transition(taskId, 'continue', { brainStatus: 'thinking' });
    return { noProgressSignature: null };
  }

  async runWait(task, decision) {
    const taskId = task.id;
    const seconds = Math.min(Number(decision.seconds || 3), 15);
    await this.activity(taskId, {
      kind: 'wait',
      icon: '⏳',
      message: `Waiting ${seconds}s — ${truncate(decision.reason, 120)}`,
    });
    await this.sleepInterruptible(taskId, seconds * 1000);
    // After waiting, observe so the next decision sees the new state.
    const observation = await this.observeAfterAction(taskId);
    await this.taskModel.update(taskId, {
      activeWindow: observation.title ?? task.activeWindow,
      lastObservation: {
        kind: observation.kind,
        summary: observation.summary,
        at: new Date().toISOString(),
      },
    });
    await this.taskModel.transition(taskId, 'continue', { brainStatus: 'thinking' });
    return { noProgressSignature: null };
  }

  // ── Observation plumbing ──────────────────────────────────────────────
  /**
   * Real observation after a step: active window first (the text brain's eyes),
   * screenshot additionally when asked or when the window lookup fails.
   */
  async observeAfterAction(taskId, method = 'active_window') {
    let title = null;
    try {
      const windowResult = await this.computer.execute(
        {
          type: COMPUTER_ACTIONS.GET_ACTIVE_WINDOW,
          reason: 'observe the desktop after the last action',
        },
        { channel: taskId, approvalGranted: true }
      );
      if (windowResult.ok) {
        title = windowResult.output?.title || null;
      }
    } catch {
      /* observation must never crash the loop */
    }

    if (method === 'screenshot' || !title) {
      try {
        const shot = await this.computer.execute(
          { type: COMPUTER_ACTIONS.SCREENSHOT, reason: 'capture desktop state for the record' },
          { channel: taskId, approvalGranted: true }
        );
        if (shot.ok) {
          return {
            kind: 'screenshot',
            title,
            summary: `${title ? `Active window "${title}". ` : 'No active window detected. '}Screenshot captured (${shot.output?.width}x${shot.output?.height}, sha256 ${String(shot.output?.sha256 || '').slice(0, 12)}).`,
          };
        }
      } catch {
        /* fall through */
      }
    }

    return {
      kind: 'active_window',
      title,
      summary: title
        ? `Active window: "${title}"`
        : 'Observation unavailable: no active window title and screenshot failed.',
    };
  }

  // ── Context building ──────────────────────────────────────────────────
  /** Bounded conversation context: recent messages + prior task outcomes. */
  async buildConversationContext(task) {
    const context = { recentMessages: [], priorTasks: [] };
    if (!this.chatModel) return context;

    try {
      const chat = await this.chatModel.get(task.userId, task.conversationId);
      if (chat?.messages?.length) {
        context.recentMessages = chat.messages.slice(-6).map(m => ({
          role: m.role,
          content: String(m.content || '').slice(0, 300),
        }));
      }
    } catch {
      /* chat history is context, not a requirement */
    }

    try {
      const prior = await this.taskModel.listByUser(task.userId, {
        conversationId: task.conversationId,
        limit: 6,
      });
      context.priorTasks = prior
        .filter(t => t.id !== task.id)
        .slice(0, 3)
        .map(t => ({
          instruction: t.instruction,
          status: t.status,
          application: t.currentApplication,
          generatedContent: t.generatedContent,
          finalMessage: t.finalMessage,
        }));
    } catch {
      /* ignore */
    }
    return context;
  }

  // ── Waiting / terminal transitions ────────────────────────────────────
  async enterWaiting(task, { status, reason, message }) {
    if (task.status !== status || task.waitingReason !== reason) {
      await this.taskModel.transition(task.id, status, {
        waitingReason: reason,
        brainStatus: 'waiting',
      });
      await this.publish(task.id, {
        type: status === 'waiting_ai' ? 'task.waiting_ai' : 'task.waiting_computer',
        level: 'WARN',
        message,
        data: { reason },
      });
      await this.activity(task.id, { kind: 'wait', icon: '⏳', message: truncate(message, 200) });
    }
  }

  async cancelTask(task, reason) {
    await this.taskModel.transition(task.id, 'cancelled', {
      brainStatus: 'cancelled',
      waitingReason: null,
    });
    await this.publish(task.id, {
      type: 'task.cancelled',
      level: 'WARN',
      message: `Task cancelled — ${reason}. Task history is preserved.`,
      data: { reason },
    });
    await this.activity(task.id, {
      kind: 'cancel',
      icon: '🛑',
      message: `Task stopped: ${reason}`,
    });
    await this.appendChatMessage(task, 'assistant', `🛑 Task stopped before completion: ${reason}`);
  }

  // ── Chat mirroring ────────────────────────────────────────────────────
  /** Write the task's user-visible lines into the InfiniteChat conversation. */
  async appendChatMessage(task, role, content) {
    if (!this.chatModel) return;
    try {
      await this.chatModel.appendMessages(task.userId, task.conversationId, [
        { role, content: String(content || '').slice(0, 4000), computerTaskId: task.id },
      ]);
    } catch (error) {
      this.logger.warn?.(`[computer-task-worker] chat mirror failed: ${error.message}`);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  async rejectAction(task, action, message) {
    await this.taskModel.recordError(task.id, { message, kind: 'rejected' });
    await this.publish(task.id, {
      type: 'task.action_failed',
      level: 'WARN',
      message: truncate(message, 300),
      data: { action, kind: 'rejected' },
    });
    await this.activity(task.id, { kind: 'error', icon: '⛔', message: truncate(message, 180) });
    // Surface the rejection to the brain by recording it as the last action
    // result; the next decide() call sees it and must choose differently.
    await this.taskModel.update(task.id, {
      lastAction: { type: action.type, reason: null, at: new Date().toISOString() },
      lastActionResult: {
        ok: false,
        error: message,
        kind: 'rejected',
        at: new Date().toISOString(),
      },
    });
    await this.taskModel.transition(task.id, 'continue', { brainStatus: 'thinking' });
  }

  /** Interruptible sleep: cancel/shutdown wake it immediately. */
  sleepInterruptible(taskId, ms) {
    return new Promise(resolve => {
      const control = this.running.get(taskId);
      if (!control) return resolve();
      const timer = setTimeout(
        () => {
          control.wake = null;
          resolve();
        },
        Math.max(0, ms)
      );
      control.wake = () => {
        clearTimeout(timer);
        control.wake = null;
        resolve();
      };
    });
  }

  /** Wake a sleeping task (after cancel) so it reacts immediately. */
  wake(taskId) {
    this.running.get(taskId)?.wake?.();
  }

  async activity(taskId, entry) {
    try {
      await this.taskModel.addActivity(taskId, entry);
    } catch {
      /* activity logging must never break the loop */
    }
  }

  async publish(taskId, event) {
    if (!taskId || !this.eventService) return null;
    try {
      return await this.eventService.publish(taskId, event);
    } catch {
      return null;
    }
  }

  /** Ask all running tasks to stop (shutdown path). */
  async stopAll() {
    this.stopped = true;
    for (const [taskId, control] of this.running) {
      control.abort = true;
      control.wake?.();
      await this.taskModel.update(taskId, { brainStatus: 'stopped' }).catch?.(() => {});
    }
  }
}

// ── Pure helpers (exported for tests) ─────────────────────────────────────

function truncate(value, max) {
  const text = String(value || '');
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function firstToken(value) {
  return (
    String(value || '')
      .trim()
      .split(/[\s\-–—_\/]/)[0] || ''
  );
}

function describeDecision(decision) {
  switch (decision.type) {
    case 'action':
      return `Computer: ${describeAction(decision.action)}`;
    case 'observe':
      return `Observe (${decision.method})`;
    case 'complete':
      return 'Complete task';
    case 'ask_user':
      return 'Ask the user';
    case 'retry':
      return 'Retry with adjusted approach';
    case 'wait':
      return `Wait ${decision.seconds}s`;
    default:
      return decision.type;
  }
}

function describeAction(action) {
  switch (action?.type) {
    case COMPUTER_ACTIONS.TYPE:
      return `type (${String(action.params?.text || '').length} chars)`;
    case COMPUTER_ACTIONS.OPEN_APPLICATION:
      return `open_application → ${action.params?.name}`;
    case COMPUTER_ACTIONS.PRESS_KEY:
      return `press_key ${JSON.stringify(action.params?.keys)}`;
    case COMPUTER_ACTIONS.HOTKEY:
      return `hotkey ${JSON.stringify(action.params?.keys)}`;
    case COMPUTER_ACTIONS.CLICK:
    case COMPUTER_ACTIONS.DOUBLE_CLICK:
      return `${action.type} @ (${action.params?.x}, ${action.params?.y})`;
    case COMPUTER_ACTIONS.NAVIGATE:
      return `navigate → ${action.params?.url}`;
    case COMPUTER_ACTIONS.SCROLL:
      return `scroll ${action.params?.amount}`;
    default:
      return action?.type || 'unknown';
  }
}

function summarizeParams(action) {
  const params = { ...(action.params || {}) };
  if (typeof params.text === 'string') {
    params.textLength = params.text.length;
    params.textPreview = params.text.slice(0, 80);
    delete params.text;
  }
  return params;
}

function signatureOf(action, observation = null) {
  // The FULL observation is part of the signature: an action that changes the
  // screen (typed text, moved focus) yields a different summary and therefore
  // never counts as "no progress" — only a true spin does.
  return JSON.stringify({
    type: action.type,
    params: summarizeParams(action),
    observation: truncate(observation?.summary || '', 160),
  });
}

function iconFor(actionType) {
  switch (actionType) {
    case COMPUTER_ACTIONS.OPEN_APPLICATION:
      return '🖥';
    case COMPUTER_ACTIONS.TYPE:
      return '⌨️';
    case COMPUTER_ACTIONS.PRESS_KEY:
    case COMPUTER_ACTIONS.HOTKEY:
      return '⌨️';
    case COMPUTER_ACTIONS.CLICK:
    case COMPUTER_ACTIONS.DOUBLE_CLICK:
    case COMPUTER_ACTIONS.MOVE_MOUSE:
      return '🖱';
    case COMPUTER_ACTIONS.SCROLL:
      return '🖲';
    case COMPUTER_ACTIONS.SCREENSHOT:
      return '📸';
    case COMPUTER_ACTIONS.NAVIGATE:
      return '🌐';
    default:
      return '⚙️';
  }
}

export { NO_PROGRESS_REPEAT_LIMIT, DECISION_STRIKE_LIMIT };
