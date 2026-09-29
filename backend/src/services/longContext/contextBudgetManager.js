import {
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  modelContextCapacity,
  reservedOutputTokens
} from './tokens.js';

/**
 * ContextBudgetManager — the single authority on what enters the model window.
 *
 * It composes the outbound prompt in priority order, tracking a token budget,
 * and *downgrades* lower-priority material (older messages, long summaries)
 * before it ever touches the current user request.
 *
 * Priority order (highest first):
 *   1. current user request      (never silently truncated)
 *   2. system instructions
 *   3. critical task state
 *   4. directly relevant retrieved source
 *   5. recent conversation
 *   6. older conversation
 *   7. low-value summaries
 *
 * The model context is FINITE. The manager guarantees:
 *   system + taskState + retrieved + recent + request + outputReserve <= capacity
 */
export class ContextBudgetManager {
  constructor({ capacity = modelContextCapacity(), outputReserve = reservedOutputTokens() } = {}) {
    this.capacity = capacity;
    this.outputReserve = outputReserve;
  }

  /**
   * Build the final message list for the model from prioritized parts.
   *
   * @param {object} parts
   * @param {string|null} parts.system            system instruction text
   * @param {string|null} parts.taskState         serialized task state block
   * @param {Array<{id:string,label:string,content:string}>} parts.retrievedBlocks
   *        retrieved chunks/summaries, most relevant first
   * @param {Array<{role:string,content:string}>} parts.recentMessages
   *        recent conversation, oldest first (will be included newest-first budget-wise)
   * @param {string} parts.userRequest            the CURRENT user request — protected
   * @param {object} [options]
   * @param {number} [options.outputReserve]      override output reserve
   * @returns {{ messages: Array<{role,content}>, usage: object }}
   */
  compose(parts) {
    const {
      system = null,
      taskState = null,
      retrievedBlocks = [],
      recentMessages = [],
      userRequest = ''
    } = parts;

    const options = arguments[1] || {};
    const outputReserve = options.outputReserve ?? this.outputReserve;
    const available = this.capacity - outputReserve;

    const usage = {
      capacity: this.capacity,
      outputReserve,
      available,
      system: 0,
      taskState: 0,
      retrieved: 0,
      recent: 0,
      request: 0,
      droppedRetrieved: 0,
      droppedRecent: 0
    };

    const messages = [];

    // ── 1. System instructions ────────────────────────────────────────
    let systemMsg = null;
    if (system) {
      systemMsg = { role: 'system', content: system };
      usage.system = estimateMessageTokens(systemMsg);
      messages.push(systemMsg);
    }

    // ── 2. Current user request (PROTECTED) ───────────────────────────
    // The current request is never silently truncated. If it alone cannot fit
    // with the minimum viable prompt, we fail loudly with ContextWindowError —
    // the engine then ingests it as chunks and references it instead.
    const requestMsg = { role: 'user', content: userRequest };
    usage.request = estimateMessageTokens(requestMsg);

    const minimumOverhead = usage.system + 16 /* task header etc */;
    if (usage.request + minimumOverhead + outputReserve > this.capacity) {
      const err = new Error('Current request alone exceeds the model context window');
      err.code = 'CONTEXT_WINDOW_EXCEEDED';
      err.detail = { requestTokens: usage.request, capacity: this.capacity, outputReserve };
      throw err;
    }

    // ── 3. Task state (critical facts; compacted if pathologically large) ──
    let taskMsg = null;
    if (taskState) {
      let content = taskState;
      let cost = estimateTokens(content) + 4;
      const taskCeiling = Math.max(0, Math.min(available - usage.request, Math.floor(available * 0.25)));
      if (cost > taskCeiling) {
        // Hard-compact task state rather than dropping it entirely.
        content = content.slice(0, Math.max(0, taskCeiling * 3));
        cost = estimateTokens(content) + 4;
      }
      if (cost <= taskCeiling) {
        taskMsg = { role: 'system', content: `[TASK STATE]\n${content}` };
        usage.taskState = cost;
        messages.push(taskMsg);
      } else {
        usage.droppedTaskState = true;
      }
    }

    // ── 4. Retrieved blocks (most relevant first; drop from the tail) ─
    const includedRetrieved = [];
    let remaining = available - usage.request - usage.system - usage.taskState;
    for (const block of retrievedBlocks) {
      const cost = estimateTokens(block.content) + 24 /* citation header */;
      if (cost > remaining) {
        usage.droppedRetrieved += 1;
        continue;
      }
      includedRetrieved.push(block);
      remaining -= cost;
      usage.retrieved += cost;
    }

    // ── 5/6. Recent + older conversation (newest-first inclusion) ─────
    const includedRecent = [];
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      const cost = estimateMessageTokens(msg);
      if (cost > remaining) {
        usage.droppedRecent += recentMessages.length - includedRecent.length;
        break;
      }
      includedRecent.unshift(msg);
      remaining -= cost;
      usage.recent += cost;
    }

    // Assemble: system, taskState, [retrieved as user-context block], recent..., request
    if (includedRetrieved.length > 0) {
      const blockText = includedRetrieved
        .map((b) => `--- [${b.label}] (source: ${b.id}) ---\n${b.content}`)
        .join('\n\n');
      messages.push({
        role: 'system',
        content: `[RETRIEVED CONTEXT — cite sources when using this material]\n\n${blockText}`
      });
    }

    for (const msg of includedRecent) {
      messages.push(msg);
    }

    messages.push(requestMsg);

    // Guard against alternating-role strictness in some runtimes: merge any
    // consecutive same-role messages into one.
    const merged = [];
    for (const msg of messages) {
      const prev = merged[merged.length - 1];
      if (prev && prev.role === msg.role && prev.role !== 'system') {
        prev.content = `${prev.content}\n\n${msg.content}`;
      } else {
        merged.push(msg);
      }
    }

    usage.total = estimateMessagesTokens(merged);
    usage.messages = merged.length;
    return { messages: merged, usage };
  }
}
