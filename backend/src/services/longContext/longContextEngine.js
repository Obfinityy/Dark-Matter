import crypto from 'crypto';
import { chunkText, hashContent } from './chunker.js';
import { LongContextStore, newId } from './longContextStore.js';
import { Retriever } from './retriever.js';
import { Summarizer } from './summarizer.js';
import { ContextBudgetManager } from './contextBudgetManager.js';
import { ContextWindowError } from './phoneModelAdapter.js';
import { estimateTokens, clampBlock } from './tokens.js';

/**
 * LongContextEngine — application-level long-context virtualization.
 *
 *   USER INPUT → normalize → chunk → store exact chunks → index
 *              → hierarchical summaries → task state
 *   QUERY TIME → retrieve relevant blocks → ContextBudgetManager
 *              → bounded prompt → Gemma
 *
 * The model context stays FINITE; this engine provides effectively unbounded
 * *application* memory. Raw input is never destroyed, never replaced by
 * summaries, and every answer is grounded in stored chunks + citations.
 */
class LongContextEngine {
  constructor({ store, model }) {
    this.store = store || new LongContextStore();
    this.model = model;
    this.retriever = new Retriever(this.store);
    this.summarizer = new Summarizer(this.store, model);
    this.budget = new ContextBudgetManager();
  }

  /** Threshold (chars) above which a message is treated as "large input". */
  largeInputThreshold() {
    const raw = parseInt(process.env.LONG_CONTEXT_INPUT_THRESHOLD || '8000', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 8000;
  }

  // ─────────────────────────────────────────────────────────────────────
  // INGESTION
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Ingest a (potentially huge) piece of user content.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.conversationId
   * @param {string} params.content       exact original content
   * @param {string} [params.title]
   * @param {string} [params.kind]        prose|code|json|log|document
   * @param {boolean} [params.summarize]  build the hierarchy now (default true)
   * @param {(progress:object)=>void} [params.onProgress]
   * @returns {Promise<object>} input record
   */
  async ingest({ userId, conversationId, content, title, kind = 'document', summarize = true, onProgress }) {
    if (!content || !content.length) {
      const err = new Error('Cannot ingest empty content');
      err.status = 400;
      throw err;
    }

    const inputId = newId('input');
    const hash = hashContent(content);
    const record = {
      inputId,
      userId,
      conversationId,
      title: (title || '').trim().slice(0, 120) || `Input ${new Date().toISOString()}`,
      kind,
      totalCharacters: content.length,
      estimatedTokens: estimateTokens(content),
      hash,
      chunkCount: 0,
      status: 'chunking',   // chunking → indexing → summarizing → ready | failed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    // NOTE: raw content is intentionally NOT copied into lc_inputs again —
    // chunks ARE the exact original (startOffset/endOffset reconstruct it).
    // This avoids storing 100MB twice (requirement #36).
    await this.store.createInput(record);

    try {
      const chunks = chunkText({ text: content, inputId, conversationId, userId });
      await this.store.insertChunks(chunks);
      record.chunkCount = chunks.length;
      record.status = 'summarizing';
      await this.store.updateInput(userId, conversationId, inputId, {
        chunkCount: chunks.length,
        status: record.status,
        updatedAt: new Date().toISOString()
      });
      onProgress?.({ phase: 'chunked', inputId, chunkCount: chunks.length });

      if (summarize) {
        onProgress?.({ phase: 'summarizing', inputId, chunkCount: chunks.length });
        const { global, localCount, sectionCount } = await this.summarizer.buildHierarchy({
          userId, conversationId, input: record
        });
        record.status = 'ready';
        record.summary = global?.summary?.slice(0, 400) || null;
        record.summaryCounts = { local: localCount, section: sectionCount };
        await this.store.updateInput(userId, conversationId, inputId, {
          status: 'ready',
          summary: record.summary,
          summaryCounts: record.summaryCounts,
          updatedAt: new Date().toISOString()
        });
        onProgress?.({ phase: 'ready', inputId, chunkCount: chunks.length });
      } else {
        record.status = 'indexed';
        await this.store.updateInput(userId, conversationId, inputId, {
          status: 'indexed', updatedAt: new Date().toISOString()
        });
      }

      // Task state: remember this input in conversation memory.
      await this.addTaskMemory(conversationId, {
        type: 'input',
        inputId,
        title: record.title,
        chunkCount: chunks.length,
        hash
      });

      return record;
    } catch (error) {
      await this.store.updateInput(userId, conversationId, inputId, {
        status: 'failed',
        error: error.message.slice(0, 200),
        updatedAt: new Date().toISOString()
      }).catch(() => {});
      throw error;
    }
  }

  /** Resume an interrupted ingestion (e.g. summarization phase after restart). */
  async resumeIngest(userId, conversationId, inputId, onProgress) {
    const input = await this.store.getInput(userId, conversationId, inputId);
    if (!input) throw Object.assign(new Error('Input not found'), { status: 404 });
    if (input.status === 'ready' || input.status === 'indexed') return input;

    const chunkCount = await this.store.countChunks(userId, conversationId, inputId);
    if (chunkCount === 0) throw new Error('Input has no chunks; re-ingest required');

    const { global, localCount, sectionCount } = await this.summarizer.buildHierarchy({
      userId, conversationId, input: { ...input, chunkCount }
    });
    const updated = await this.store.updateInput(userId, conversationId, inputId, {
      status: 'ready',
      summary: global?.summary?.slice(0, 400) || null,
      summaryCounts: { local: localCount, section: sectionCount },
      updatedAt: new Date().toISOString()
    });
    onProgress?.({ phase: 'ready', inputId, chunkCount });
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // BOUNDED CHAT CONTEXT
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Compose the bounded model context for a chat turn.
   *
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.conversationId
   * @param {string} params.request            current user message (protected)
   * @param {Array<{role,content}>} params.recentMessages  recent conversation (already trimmed)
   * @param {object} [params.taskState]        existing task state (loaded if absent)
   * @param {number} [params.maxChunks]
   * @returns {Promise<{messages, usage, retrievedBlocks, taskState}>}
   */
  async composeChatContext({ userId, conversationId, request, recentMessages = [], taskState = null, maxChunks = 6 }) {
    if (!taskState) {
      taskState = await this.getTaskState(conversationId);
    }

    const inputs = await this.store.listInputs(userId, conversationId, { limit: 10 });
    let retrievedBlocks = [];
    if (inputs.length > 0) {
      retrievedBlocks = await this.retriever.retrieve({
        userId, conversationId, request, inputs, maxChunks
      });
    }

    // Serialize the critical slice of task state for the prompt.
    const taskStateBlock = this.serializeTaskState(taskState);

    // Retrieved blocks: clamp defensively; budget manager does the real math.
    const clamped = retrievedBlocks.map((b) => ({
      ...b,
      content: clampBlock(b.content, 12000)
    }));

    const { messages, usage } = this.budget.compose({
      system: this.systemPrompt(),
      taskState: taskStateBlock,
      retrievedBlocks: clamped,
      recentMessages,
      userRequest: request
    });

    return { messages, usage, retrievedBlocks, taskState };
  }

  systemPrompt() {
    return [
      'You are Infinity, the local AI assistant powering DARKMATTER.',
      'You run through a locally hosted Gemma model on the user\'s own device.',
      '',
      'CRITICAL LANGUAGE RULE:',
      '- ALWAYS detect and reply in the EXACT SAME LANGUAGE and vocabulary/script as the user\'s message.',
      '- If the user speaks in Hinglish (e.g. "game bana k de", "kya chal rha hai", "batao mera code"), reply in natural Hinglish.',
      '- If the user speaks in Hindi (e.g. "नमस्ते", "गेम बना कर दो"), reply in Hindi.',
      '- If the user speaks in English, reply in English.',
      '- Match the user\'s language style consistently throughout your entire response.',
      '',
      'CONTEXT PROTOCOL:',
      '- You may be given [TASK STATE] (persistent conversation memory),',
      '  [RETRIEVED CONTEXT] (numbered source excerpts with their source ids),',
      '  and recent conversation.',
      '- Ground every claim about provided documents/code in the retrieved excerpts',
      '  and cite their source ids like [chunk-000042].',
      '- If the answer is not present in the task state, retrieved context, or',
      '  recent conversation, say plainly that you do not have that information.',
      '  NEVER fabricate quotes, code, or facts.',
      '- Exact source (chunks) always outranks summaries for code/JSON/config questions.',
      '',
      'STYLE: Use clear markdown formatting for readability.'
    ].join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────
  // MEMORY / TASK STATE
  // ─────────────────────────────────────────────────────────────────────

  defaultTaskState() {
    return {
      conversationSummary: '',
      activeTask: null,
      requirements: [],
      decisions: [],
      constraints: [],
      referencedChunks: [],
      inputs: [],
      updatedAt: null
    };
  }

  async getTaskState(conversationId) {
    const existing = await this.store.getTaskState(conversationId);
    return existing || this.defaultTaskState();
  }

  async addTaskMemory(conversationId, entry) {
    const state = await this.getTaskState(conversationId);
    if (entry.type === 'input') {
      state.inputs = [
        ...state.inputs.filter((i) => i.inputId !== entry.inputId),
        { inputId: entry.inputId, title: entry.title, chunkCount: entry.chunkCount, hash: entry.hash, at: new Date().toISOString() }
      ].slice(-20);
    }
    state.updatedAt = new Date().toISOString();
    await this.store.saveTaskState(conversationId, state);
    return state;
  }

  /**
   * Update memory after a meaningful turn. Deterministic first (requirement
   * extraction heuristics); the rolling summary is only re-condensed when it
   * grows beyond a threshold, to avoid unnecessary model calls (#41).
   */
  async updateMemoryAfterTurn({ userId = null, conversationId, userMessage, assistantReply, existingSummary }) {
    const state = await this.getTaskState(conversationId);

    // Rolling summary: append a compact turn digest (deterministic, no model call).
    const turnDigest = `User: ${userMessage.slice(0, 200)}${userMessage.length > 200 ? '…' : ''} | Assistant: ${assistantReply.slice(0, 200)}${assistantReply.length > 200 ? '…' : ''}`;
    state.conversationSummary = [state.conversationSummary, turnDigest].filter(Boolean).join('\n').slice(-4000);

    // Heuristic requirement extraction (deterministic; no model call needed).
    const lower = userMessage.toLowerCase();
    const REQUIREMENT_HINTS = ['use ', 'must ', 'no ', 'only ', 'always ', 'never ', 'should ', 'keep ', 'requirement', 'constraint', 'prefer'];
    if (userMessage.length < 500 && REQUIREMENT_HINTS.some((h) => lower.includes(h))) {
      const req = userMessage.trim().slice(0, 200);
      if (!state.requirements.some((r) => r.text === req)) {
        state.requirements.push({ text: req, at: new Date().toISOString() });
        state.requirements = state.requirements.slice(-30);
      }
    }

    state.updatedAt = new Date().toISOString();
    await this.store.saveTaskState(conversationId, state);

    // If the rolling summary has grown unwieldy, condense it with ONE model call.
    if (estimateTokens(state.conversationSummary) > 700 && this.model.enabled) {
      try {
        const { text } = await this.model.complete(
          [
            { role: 'system', content: 'Condense the following conversation digest into a tight factual summary under 250 words. Keep names, decisions, requirements. No preamble.' },
            { role: 'user', content: state.conversationSummary }
          ],
          { maxTokens: 320, maxAttempts: 2, userId }
        );
        state.conversationSummary = text.trim();
        await this.store.saveTaskState(conversationId, state);
      } catch {
        // Summary condensation is best-effort; the raw digest remains usable.
      }
    }

    return state;
  }

  serializeTaskState(state) {
    if (!state) return null;
    const parts = [];
    if (state.conversationSummary) parts.push(`CONVERSATION DIGEST:\n${state.conversationSummary}`);
    if (state.requirements?.length) {
      parts.push(`REQUIREMENTS:\n${state.requirements.map((r) => `- ${r.text}`).join('\n')}`);
    }
    if (state.inputs?.length) {
      parts.push(`INGESTED DOCUMENTS:\n${state.inputs.map((i) => `- ${i.title} (${i.inputId}, ${i.chunkCount} chunks)`).join('\n')}`);
    }
    if (!parts.length) return null;
    return parts.join('\n\n');
  }

  // ─────────────────────────────────────────────────────────────────────
  // DETERMINISTIC DOCUMENT OPERATIONS (#29, #30)
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Exact search across stored chunks — never delegated to the model.
   * @returns {Promise<Array<{chunkId,inputId,preview,startOffset,endOffset,score}>>}
   */
  async search(userId, conversationId, query, { limit = 20 } = {}) {
    const terms = this.retriever.extractKeywords(query, { maxTerms: 8 });
    if (!terms.length) return [];
    const hits = await this.store.searchChunks(userId, conversationId, terms, { limit });
    return hits.map(({ chunk, score, matchedTerms }) => ({
      inputId: chunk.inputId,
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      preview: chunk.content.slice(0, 300),
      score,
      matchedTerms
    }));
  }

  /**
   * Exact chunk recovery — "what was the exact function in chunk 732?".
   * Returns the raw stored chunk, never a reconstruction from summaries.
   */
  async getExactChunk(userId, conversationId, inputId, chunkRef) {
    const norm = `chunk-${String(parseInt(String(chunkRef).replace(/\D/g, ''), 10) || 0).padStart(6, '0')}`;
    const chunk = await this.store.getChunk(userId, conversationId, inputId, norm);
    if (!chunk) return null;
    // Integrity check via stored hash.
    const valid = chunk.hash === hashContent(chunk.content);
    return { ...chunk, integrityOk: valid };
  }

  /**
   * Map-reduce "summarize the entire document" using the stored hierarchy.
   * If the hierarchy is not built yet, builds it first.
   */
  async summarizeDocument(userId, conversationId, inputId) {
    const input = await this.store.getInput(userId, conversationId, inputId);
    if (!input) throw Object.assign(new Error('Input not found'), { status: 404 });
    const { global } = await this.summarizer.buildHierarchy({ userId, conversationId, input });
    return { inputId, title: input.title, summary: global?.summary || null, sourceChunks: global?.sourceChunks || [] };
  }
}

export { LongContextEngine, ContextWindowError };
