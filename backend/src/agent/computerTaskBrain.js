/**
 * ComputerTaskBrain — brain for GUI-automation tasks.
 * Plans and supervises computer-use tasks: screen
 * understanding, action selection, and verification.
 * Part of: Infinity AI / Dark-Matter backend (autonomous AI agent (reasoning, planning, memory)).
 */

import { config } from '../config.js';
import { PhoneLocalProvider } from './providers/phoneLocalProvider.js';
import { localAIQueue } from './providers/localAiQueue.js';
import {
  estimateTokens,
  modelContextCapacity,
  reservedOutputTokens,
} from '../services/longContext/tokens.js';
import {
  COMPUTER_TASK_SCHEMA_PROMPT,
  COMPUTER_TASK_SCHEMA_PROMPT_COMPACT,
  validateComputerTaskDecision,
} from './computerTaskDecisionSchema.js';
import {
  isContextWindowError,
  isUnavailableError,
  isBusyError,
  truncateToTokens,
  LocalAiUnavailableError,
  BrainDecisionError,
} from './autonomousBrain.js';
import { APPLICATION_ALIASES, BLOCKED_REASON_TEXT } from '../computer/applicationResolver.js';

/**
 * ComputerTaskBrain — the ACTIVE brain for InfiniteChat computer control.
 *
 * The brain is NOT hard-wired to any single model. The caller injects
 * `providerFor(userId)`, which resolves the user's currently selected brain
 * (Models → Run / Kaggle-Connect / phone default) through the same
 * local → remote-GPU → phone fallback chain hunts use. Every reasoning step
 * therefore thinks with the brain the user actually chose — never a template,
 * never a regex, never a canned plan.
 *
 * Mirrors AutonomousBrain's provider policy:
 *   • All inference flows through the shared LocalAIQueue (hardware scheduler,
 *     never a user quota — requirement #34, #42).
 *   • Context is finite and enforced: system + user + outputReserve
 *     <= PHONE_AI_CONTEXT_TOKENS, with automatic compaction + retry.
 */

/** Computer Task Brain. */
export class ComputerTaskBrain {
  constructor({
    provider = null,
    providerFor = null,
    queue = localAIQueue,
    configOverride = {},
    logger = console,
    onDecisionRejection = null,
  } = {}) {
    this.provider = provider || new PhoneLocalProvider(config);
    // providerFor(userId) → provider — when set, the brain is resolved per
    // task from the user's ACTIVE brain selection (local / Kaggle / phone).
    this.providerFor = typeof providerFor === 'function' ? providerFor : null;
    this.queue = queue;
    this.logger = logger;
    // Observability hook: schema rejections inside the transparent retry loop
    // would otherwise be invisible to the task record. The worker uses this to
    // surface "unusable AI decision — retrying" in the activity feed (#43).
    this.onDecisionRejection = onDecisionRejection;
    this.settings = {
      temperature: 0.2,
      maxTokens: Number(configOverride.maxTokens || process.env.TASK_BRAIN_MAX_TOKENS || 420),
      decisionRetries: Number(
        configOverride.decisionRetries ?? process.env.TASK_BRAIN_RETRIES ?? 2
      ),
      recentActionBudget: Number(process.env.TASK_BRAIN_RECENT_ACTIONS || 10),
    };
    this.capacity = Number(configOverride.capacity || modelContextCapacity());
    this.outputReserve = Number(configOverride.outputReserve || reservedOutputTokens());
    this.lastPromptDiagnostics = null;
  }

  get promptBudget() {
    return Math.max(256, this.capacity - Math.max(this.outputReserve, this.settings.maxTokens));
  }

  /** Resolve the brain for this decision: the user's ACTIVE brain when a
   *  providerFor is wired, otherwise the injected/fallback provider. */
  async resolveProvider(userId) {
    if (this.providerFor) {
      const resolved = await this.providerFor(userId);
      if (resolved) return resolved;
    }
    return this.provider;
  }

  /** Whether the resolved brain is configured and reachable. */
  async health(userId = null) {
    const provider = await this.resolveProvider(userId);
    if (!provider?.enabled) {
      return { available: false, reason: 'BRAIN UNAVAILABLE — no active brain is configured' };
    }
    const health = await provider.healthCheck();
    if (!health.reachable) {
      return {
        available: false,
        reason: `BRAIN UNAVAILABLE — ${health.reason || 'active brain unreachable'}`,
      };
    }
    return { available: true, reason: null, model: health.model };
  }

  // ── Prompt construction ───────────────────────────────────────────────
  buildSystemPrompt({ compact = false } = {}) {
    const aliasList = APPLICATION_ALIASES.map(entry => entry.canonical)
      .slice(0, 30)
      .join(', ');

    if (compact) {
      return `You control a real Windows desktop for the user, one JSON step at a time. Hands: click(x,y), double_click, move_mouse, type, press_key, hotkey, scroll, sleep, open_application, navigate, screenshot, get_active_window, get_browser_state. Known apps: ${aliasList}. Never open shells or password/registry/admin tools. ${COMPUTER_TASK_SCHEMA_PROMPT_COMPACT}`;
    }

    return `You are the DARKMATTER InfiniteChat computer agent. You control a REAL Windows desktop for the user — mouse, keyboard and applications. Your decisions are executed literally by a validated automation layer ("the hands"). You are precise, cautious and honest.

THE LOOP: every reply is ONE step. The engine executes your step, hands you the real observation (active window title, action result, screenshot metadata), and you decide the next step. Progress is: understand → open/focus the application → act inside it → verify by observation → complete.

COMPUTER ACTIONS (only these exist; there is NO shell, NO file picker beyond keyboard use, NO registry):
  {"type":"open_application","params":{"name":"<launch name>"}}
  {"type":"click","params":{"x":<int>,"y":<int>}}        {"type":"double_click","params":{"x":<int>,"y":<int>}}
  {"type":"move_mouse","params":{"x":<int>,"y":<int>}}   {"type":"type","params":{"text":"..."}}
  {"type":"press_key","params":{"keys":["enter"]}}        {"type":"hotkey","params":{"keys":["ctrl","s"]}}
  {"type":"scroll","params":{"amount":-3}}                {"type":"sleep","params":{"seconds":2}}
  {"type":"screenshot"}  {"type":"get_active_window"}  {"type":"get_browser_state"}
  {"type":"navigate","params":{"url":"https://..."}}

OBSERVATION RULES (critical):
- The engine gives you the ACTIVE WINDOW TITLE after each step and a screenshot capture when asked. You are a text model: you reason from window titles and structured results, NOT from looking at pixels.
- A step that "ran without error" does NOT mean it succeeded. Word opened = the active window title actually shows Word. Text typed = the engine confirms characters were sent while the editor window was active.
- Never invent window titles, screen contents or coordinates. Use what you were given; when unsure, "observe".

APPLICATION RESOLUTION:
Known applications: ${aliasList}.
When the user names one (any phrasing like "MS Word", "word", "calc"), use open_application with the matching launch name. If the application is unknown, open it via the Windows Start menu (press_key "win", type the name, press_key "enter") or ask_user if it is clearly not installed. Prefer open_application.

HARD SAFETY POLICY (absolute, never negotiable):
- NEVER open or drive: command prompts, terminals, PowerShell, registry editor, task manager, device/disk managers, group policy, services, event viewer, credential/password managers, keyloggers, security-software control panels.
${BLOCKED_REASON_TEXT}
- Only do what the user asked. No unrequested side effects: do not save, print, email, upload, delete or close anything unless the user explicitly asked (e.g. "save it as leave.docx").
- Type only the exact content the task requires. Do not "helpfully" add extra text.

CONTEXT DISCIPLINE:
- "it" / "the document" / follow-ups refer to the CURRENT TASK CONTEXT section below. A follow-up like "make it more formal" means: modify the existing document that is already on screen.
- Prefer continuing the existing application over reopening things.

${COMPUTER_TASK_SCHEMA_PROMPT}`;
  }

  /**
   * Compose the user message for one reasoning step, bounded to the window.
   * Everything durable lives in Mongo; only the operative slice is prompt-fed.
   */
  buildUserMessage({
    task,
    conversation,
    decisionHistory = [],
    computerStatus = null,
    userAnswer = null,
  }) {
    const parts = [];

    parts.push('## USER REQUEST (current)');
    parts.push(task.instruction);

    if (conversation?.recentMessages?.length) {
      parts.push('\n## CONVERSATION (oldest → newest)');
      for (const message of conversation.recentMessages.slice(-6)) {
        const who = message.role === 'user' ? 'USER' : 'ASSISTANT';
        parts.push(`${who}: ${String(message.content || '').slice(0, 300)}`);
      }
    }

    if (conversation?.priorTasks?.length) {
      parts.push('\n## CURRENT TASK CONTEXT (this conversation — "it" refers to this)');
      for (const prior of conversation.priorTasks.slice(-3)) {
        const lines = [
          `- Prior request: "${String(prior.instruction).slice(0, 300)}" [${prior.status}]`,
        ];
        if (prior.application) lines.push(`  Application: ${prior.application}`);
        if (prior.generatedContent) {
          lines.push(`  Content produced (verbatim, currently in the document):`);
          lines.push(`  ---`);
          lines.push(truncateToTokens(String(prior.generatedContent), 500));
          lines.push(`  ---`);
        }
        if (prior.finalMessage) lines.push(`  Result: ${String(prior.finalMessage).slice(0, 200)}`);
        parts.push(lines.join('\n'));
      }
    }

    if (task.goal && task.goal !== task.instruction) {
      parts.push(`\n## CURRENT GOAL\n${task.goal}`);
    }

    if (task.plan?.length) {
      parts.push('\n## PLAN');
      for (const step of task.plan.slice(0, 8)) {
        parts.push(`  [${step.status === 'done' ? 'x' : ' '}] ${step.step}`);
      }
    }

    parts.push('\n## DESKTOP STATE');
    parts.push(`Status: ${task.status} · phase: ${task.phase} · steps so far: ${task.stepCount}`);
    if (task.currentApplication) parts.push(`Application in use: ${task.currentApplication}`);
    if (computerStatus) {
      parts.push(
        `Computer runtime: ${computerStatus.available ? 'connected' : 'UNAVAILABLE'}${computerStatus.reason ? ` (${computerStatus.reason})` : ''}`
      );
      if (computerStatus.screen)
        parts.push(`Screen: ${computerStatus.screen.width}x${computerStatus.screen.height}`);
    }
    if (task.activeWindow) parts.push(`Active window (last observed): "${task.activeWindow}"`);
    if (task.generatedContent) {
      parts.push('\n## CONTENT YOU PRODUCED THIS TASK (already typed into the application)');
      parts.push(truncateToTokens(task.generatedContent, 600));
    }

    if (task.lastAction) {
      parts.push('\n## LAST ACTION');
      parts.push(`${task.lastAction.type}: ${task.lastAction.reason || ''}`);
      if (task.lastActionResult) {
        parts.push(
          `Result: ${task.lastActionResult.ok === false ? `FAILED — ${task.lastActionResult.error}` : 'ok'}`
        );
      }
    }

    if (task.lastObservation) {
      parts.push('\n## LATEST OBSERVATION (real, from the hands layer)');
      parts.push(truncateToTokens(String(task.lastObservation.summary || ''), 500));
    }

    if (decisionHistory.length) {
      parts.push(
        '\n## RECENT STEPS (oldest → newest; do NOT repeat a step that already succeeded)'
      );
      for (const entry of decisionHistory.slice(-this.settings.recentActionBudget)) {
        parts.push(`  - ${entry}`);
      }
    }

    if (userAnswer) {
      parts.push(`\n## USER ANSWERED YOUR QUESTION\n"${String(userAnswer).slice(0, 1000)}"`);
    }

    parts.push('\n## YOUR TASK');
    parts.push('Choose the single next step. Reply with the JSON decision object only.');
    return parts.join('\n');
  }

  composePrompt(context, { compact = false } = {}) {
    const system = this.buildSystemPrompt({ compact });
    const systemTokens = estimateTokens(system);
    const wasCompacted = compact;

    const fullSystemTokens = estimateTokens(this.buildSystemPrompt({ compact: false }));
    const useCompact = compact || fullSystemTokens + 900 > this.promptBudget;

    const finalSystem = useCompact ? this.buildSystemPrompt({ compact: true }) : system;
    const user = this.buildUserMessage(context);
    const userTokens = estimateTokens(user);

    this.lastPromptDiagnostics = {
      capacity: this.capacity,
      outputReserve: Math.max(this.outputReserve, this.settings.maxTokens),
      systemTokens: estimateTokens(finalSystem),
      userTokens,
      total: estimateTokens(finalSystem) + userTokens,
      compact: useCompact,
      compactedByBudget: useCompact && !wasCompacted,
    };

    return { system: finalSystem, user, diagnostics: this.lastPromptDiagnostics };
  }

  /**
   * Ask the user's ACTIVE brain for the next decision.
   *
   * @throws {LocalAiUnavailableError} brain busy/unreachable → task goes waiting_ai
   * @throws {BrainDecisionError} unusable model output → retried/backed off
   */
  async decide(context) {
    const provider = await this.resolveProvider(context.task?.userId);
    const health = await this.health(context.task?.userId);
    if (!health.available) {
      throw new LocalAiUnavailableError(health.reason, { kind: 'unreachable' });
    }

    const attempts = this.settings.decisionRetries + 1;
    let compact = false;
    let lastError = null;
    let sawContextError = false;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const { system, user, diagnostics } = this.composePrompt(context, { compact });

      let raw = null;
      try {
        raw = await this.queue.enqueue(
          () =>
            provider.generateStructured(
              [
                { role: 'system', content: system },
                { role: 'user', content: user },
              ],
              null,
              { temperature: this.settings.temperature, maxTokens: this.settings.maxTokens }
            ),
          context.task?.id || 'computer-task-brain'
        );
      } catch (error) {
        lastError = error;
        if (isContextWindowError(error)) {
          sawContextError = true;
          compact = true;
          this.logger.warn?.(
            `[computer-task-brain] context too large, compacting (attempt ${attempt + 1}): ${error.message}`
          );
          continue;
        }
        if (isUnavailableError(error)) {
          const busy = isBusyError(error);
          throw new LocalAiUnavailableError(
            busy
              ? `BRAIN BUSY — serialising generations: ${error.message}`
              : `BRAIN UNAVAILABLE — ${error.message}`,
            { kind: busy ? 'busy' : 'inference_failed' }
          );
        }
        continue; // other errors: retry
      }

      const validation = validateComputerTaskDecision(raw);
      if (validation.valid) {
        return {
          decision: validation.decision,
          raw,
          model: health.model,
          diagnostics,
        };
      }

      lastError = new BrainDecisionError(
        `Model returned a decision that violates the schema: ${validation.errors.join('; ')}`,
        { raw, errors: validation.errors }
      );
      this.logger.warn?.(
        `[computer-task-brain] rejected malformed decision (attempt ${attempt + 1}): ${validation.errors.join('; ')}`
      );
      try {
        this.onDecisionRejection?.({
          taskId: context.task?.id || null,
          errors: validation.errors,
          attempt: attempt + 1,
        });
      } catch {
        /* observability must never break reasoning */
      }
      compact = true; // retry with a slimmer prompt
    }

    if (sawContextError) {
      throw new LocalAiUnavailableError(
        `LOCAL AI UNAVAILABLE — context window (${this.capacity} tokens) too small even after compaction: ${lastError?.message || 'context_window'}`,
        { kind: 'context_window' }
      );
    }
    throw lastError || new BrainDecisionError('Model produced no usable decision');
  }
}
