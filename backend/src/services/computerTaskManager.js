/**
 * computerTaskManager — computer Task manager.
 * Encapsulates computer Task business logic used by controllers and workers.
 * Part of: Infinity AI / Dark-Matter backend (business-logic services).
 */

import { ComputerTaskModel, TERMINAL_TASK_STATES } from '../models/computerTaskModel.js';

/**
 * ComputerTaskManager — the control plane for InfiniteChat computer tasks.
 *
 * Mirrors JobManager's contract: the HTTP endpoint creates a task, persists it,
 * hands it to the worker and returns the id. The request lifecycle is NEVER
 * tied to the task lifetime, so a browser refresh/close/disconnect does not
 * affect execution (requirement #25).
 */

const TERMINAL = TERMINAL_TASK_STATES;

/** Word-count heuristic for instruction classification. */
const FUZZY_FOLLOWUP_MAX_WORDS = 4;

/**
 * Strong new-task verbs: when present the instruction starts something new
 * rather than refining the previous task ("Open Word" vs "Add today's date").
 */
const NEW_TASK_PATTERN = /\b(open|launch|start|run|calculate|compute|search|browse|navigate)\b/i;

const PRONOUN_REF = /\b(it|that|this|them|the document|the file|the app)\b/i;

/** Desktop-ish verbs that indicate real computer control (English + Hinglish). */
const DESKTOP_VERB =
  /\b(open|launch|start|run|close|quit|exit|save|write|type|calculate|compute|click|press|scroll|minimi[sz]e|maximi[sz]e|switch to|navigate|khol|kholde|khol\s*de|band|bandh|bhej|likh|chal[ao]*|daba)/i;

/** Desktop-ish nouns/applications that indicate real computer control. */
const DESKTOP_NOUN =
  /\b(word|notepad|calculator|excel|powerpoint|chrome|edge|firefox|browser|paint|explorer|settings|window|document|docx|txt|xlsx|pdf|file|folder|app\b|application|desktop|screen|mouse|keyboard|taskbar|start menu|whatsapp|telegram|youtube|gmail|spotify|vlc|message)/i;

/**
 * Deterministic router helper: should this chat message become a computer
 * task (vs. normal InfiniteChat reasoning), and is it a follow-up on the
 * previous task? The BRAIN still does all real interpretation — this only
 * decides routing, conservatively.
 *
 * @returns {{isComputerTask: boolean, isFollowUp: boolean}}
 */
export function classifyComputerInstruction(message, latestTask = null) {
  const text = String(message || '').trim();
  if (!text) return { isComputerTask: false, isFollowUp: false };

  const verb = DESKTOP_VERB.test(text);
  const noun = DESKTOP_NOUN.test(text);
  const imperativeStart =
    /^(open|launch|start|run|close|quit|exit|save|write|type|calculate|compute|click|press|scroll|navigate|search|create|make|edit|add|change|fix|rename|update|minimi[sz]e|maximi[sz]e)\b/i.test(
      text
    );
  // Bare math ("25*25") opens the calculator — but NOT when the message is a
  // *question* about math ("what is 2+2?"). Those go to chat.
  const isMathQuestion =
    /[?？]/.test(text) ||
    /\b(kitna|kya|kaise|what|how|why|kyun|explain|batao|bataye)\b/i.test(text);
  const bareMathExpr = /^\s*\d[\d\s.,]*\s*[*x×+\-/^%]\s*\d[\d\s.,]*\s*[=?]?\s*$/.test(text);
  const bareMath = (/^(calculate|compute)\b/i.test(text) || bareMathExpr) && !isMathQuestion;

  let isComputerTask = false;
  let isFollowUp = false;

  if (verb && noun) {
    isComputerTask = true;
    isFollowUp = Boolean(latestTask) && !NEW_TASK_PATTERN.test(text);
  } else if (bareMath) {
    // "calculate 25 * 25" / "25*25" → Calculator even without naming it.
    isComputerTask = true;
    isFollowUp = false;
  } else if (latestTask) {
    const words = text.split(/\s+/).filter(Boolean).length;
    const refinement =
      (words <= FUZZY_FOLLOWUP_MAX_WORDS + 2 &&
        PRONOUN_REF.test(text) &&
        !NEW_TASK_PATTERN.test(text)) ||
      /\b(more|less)\s+(formal|casual|polite|professional|concise|detailed)\b/i.test(text) ||
      (words <= FUZZY_FOLLOWUP_MAX_WORDS && imperativeStart && !NEW_TASK_PATTERN.test(text));
    if (refinement) {
      isComputerTask = true;
      isFollowUp = true;
    }
  }

  return { isComputerTask, isFollowUp };
}

/** Manages computer task lifecycle and state. */
export class ComputerTaskManager {
  constructor({ taskModel, worker, eventService = null, logger = console, config = {} }) {
    this.taskModel = taskModel;
    this.worker = worker;
    this.eventService = eventService;
    this.logger = logger;
    this.config = {
      recoverOnBoot: config.recoverOnBoot !== false,
    };
    this.dispatches = new Map();
  }

  // ── Creation ──────────────────────────────────────────────────────────
  /**
   * Create a durable computer task from a chat instruction.
   *
   * Follow-up handling (requirement #13/#14): a short instruction that does
   * not name a new action ("more formal", "save it") is chained to the most
   * recent task in the conversation, and the brain receives that task's state
   * verbatim (document content, application, outcome). The brain still does
   * ALL the interpreting — this linking only supplies context.
   */
  async createTask({ userId, conversationId, instruction, followUpHint = null }) {
    const text = String(instruction || '').trim();
    if (!text) {
      const error = new Error('Instruction is required');
      error.status = 400;
      error.code = 'MISSING_INSTRUCTION';
      throw error;
    }
    if (!conversationId) {
      const error = new Error('conversationId is required');
      error.status = 400;
      error.code = 'MISSING_CONVERSATION';
      throw error;
    }

    const previous = await this.taskModel.latestForConversation(userId, conversationId);
    let previousTaskId = null;

    if (followUpHint === true) {
      // Router already classified this as a refinement of the previous task.
      previousTaskId = previous?.id || null;
    } else if (followUpHint !== false) {
      // Fallback heuristic (direct API use): a short instruction that does not
      // name a new action chains to the most recent task in the conversation.
      if (previous) {
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const continuesPrior =
          previous.status === 'ask_user' ||
          (wordCount <= FUZZY_FOLLOWUP_MAX_WORDS && !NEW_TASK_PATTERN.test(text)) ||
          /\b(more|less)\s+(formal|casual|polite|professional)\b/i.test(text) ||
          /\bsave (?:it|that|this)\b/i.test(text) ||
          /\bclose (?:it|that|this|word|notepad|calculator)\b/i.test(text);
        if (continuesPrior) previousTaskId = previous.id;
      }
    }

    const task = await this.taskModel.create({
      userId,
      conversationId,
      instruction: text,
      previousTaskId,
    });

    await this.publish(task.id, {
      type: 'task.created',
      level: 'INFO',
      message: `Computer task queued: ${truncate(text, 120)}`,
      data: { taskId: task.id, conversationId, instruction: text, previousTaskId },
    });

    this.dispatch(task.id);
    return task;
  }

  /**
   * Hand a task to the worker without blocking the caller.
   * A task already running in this process is not dispatched twice.
   */
  dispatch(taskId) {
    if (this.worker.isRunning(taskId)) return this.dispatches.get(taskId) || null;

    const promise = (async () => {
      try {
        return await this.worker.run(taskId);
      } catch (error) {
        this.logger.error?.(`[computer-task-manager] dispatch ${taskId} failed: ${error.message}`);
        return { status: 'failed', error: error.message };
      } finally {
        this.dispatches.delete(taskId);
      }
    })();
    this.dispatches.set(taskId, promise);
    return promise;
  }

  /** Await a task's current dispatch (tests / graceful shutdown). */
  async waitFor(taskId, { timeoutMs = 60_000 } = {}) {
    const promise = this.dispatches.get(taskId);
    if (!promise) return null;
    const guard = new Promise(resolve => setTimeout(() => resolve('timeout'), timeoutMs));
    return Promise.race([promise, guard]);
  }

  // ── Controls ──────────────────────────────────────────────────────────
  /** User answered an ask_user question — the task resumes with the answer. */
  async answer(userId, taskId, message) {
    const task = await this.requireTask(userId, taskId);
    if (task.status !== 'ask_user') {
      return {
        status: 'not_waiting',
        taskStatus: task.status,
        message: 'This task is not waiting for an answer.',
      };
    }
    await this.taskModel.provideAnswer(taskId, message);
    await this.publish(taskId, {
      type: 'task.resumed',
      level: 'INFO',
      message: 'User answered — resuming the task',
      data: { answerLength: String(message || '').length },
    });
    this.worker.wake(taskId); // a parked ask_user loop wakes and consumes the answer
    this.dispatch(taskId);
    return { status: 'resuming', taskId };
  }

  /** Stop/Cancel button. The worker stops before the next action; state stays clean. */
  async cancel(userId, taskId) {
    const task = await this.requireTask(userId, taskId);
    if (TERMINAL.includes(task.status)) {
      return { status: task.status, taskId, message: 'Task already finished.' };
    }
    await this.taskModel.requestCancel(taskId);
    await this.publish(taskId, {
      type: 'task.cancelled',
      level: 'WARN',
      message: 'Stop requested — the task will halt at the next safe point. History is preserved.',
    });
    this.worker.wake(taskId);
    if (!this.worker.isRunning(taskId)) {
      await this.taskModel.transition(taskId, 'cancelled', { brainStatus: 'cancelled' });
      await this.publish(taskId, {
        type: 'task.cancelled',
        level: 'WARN',
        message: 'Task cancelled — history is preserved.',
      });
    }
    return { status: 'cancelling', taskId };
  }

  // ── Reads (observability / replay) ────────────────────────────────────
  async requireTask(userId, taskId) {
    const task = await this.taskModel.getForUser(userId, taskId);
    if (!task) {
      const error = new Error('Computer task not found for this user');
      error.status = 404;
      error.code = 'TASK_NOT_FOUND';
      throw error;
    }
    return task;
  }

  /** Full state snapshot for a returning frontend (refresh/reconnect). */
  async getState(userId, taskId) {
    const task = await this.requireTask(userId, taskId);
    const events = this.eventService ? await this.eventService.list(taskId) : [];
    return {
      task,
      activity: (task.activity || []).slice(-300),
      eventCount: events.length,
      lastEventId: events.length ? events[events.length - 1].id : null,
      workerRunning: this.worker.isRunning(taskId),
      queue: this.worker.brain?.queue?.stats?.() || null,
    };
  }

  /** Event history for replay after a reconnect. */
  async listEvents(userId, taskId, { afterId = null, limit = 500 } = {}) {
    await this.requireTask(userId, taskId);
    if (!this.eventService) return { events: [] };
    const events = await this.eventService.list(taskId);
    let sliced = events;
    if (afterId) {
      const index = events.findIndex(event => event.id === afterId);
      sliced = index >= 0 ? events.slice(index + 1) : events;
    }
    return { events: sliced.slice(-limit) };
  }

  async list(userId, { conversationId = null, limit = 30 } = {}) {
    return this.taskModel.listByUser(userId, { conversationId, limit });
  }

  // ── Crash / restart recovery ──────────────────────────────────────────
  /** Called once at boot: non-terminal tasks are picked back up. */
  async recoverIncompleteTasks() {
    if (!this.config.recoverOnBoot) return { recovered: 0, paused: 0 };
    const tasks = await this.taskModel.listRecoverable();
    let recovered = 0;
    for (const task of tasks) {
      if (task.status === 'ask_user') continue; // stays parked for the human
      if (task.cancelRequested) {
        await this.taskModel.transition(task.id, 'cancelled', { brainStatus: 'cancelled' });
        continue;
      }
      if (this.worker.isRunning(task.id)) continue;
      await this.taskModel.transition(task.id, 'resuming', {
        brainStatus: 'recovering',
        waitingReason: null,
      });
      await this.publish(task.id, {
        type: 'task.resumed',
        level: 'INFO',
        message: `Backend restarted — recovering computer task from checkpoint (step ${task.stepCount})`,
        data: { stepCount: task.stepCount },
      });
      this.dispatch(task.id);
      recovered += 1;
    }
    if (recovered) {
      this.logger.log?.(`[computer-task-manager] recovery: ${recovered} task(s) resumed`);
    }
    return { recovered, paused: 0 };
  }

  async stopAll() {
    await this.worker.stopAll();
  }

  async publish(taskId, event) {
    if (!this.eventService || !taskId) return null;
    try {
      return await this.eventService.publish(taskId, event);
    } catch {
      return null;
    }
  }
}

function truncate(value, max) {
  const text = String(value || '');
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export { ComputerTaskModel };
