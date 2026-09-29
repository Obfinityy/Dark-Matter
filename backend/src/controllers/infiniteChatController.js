import { asyncHandler } from '../core/utils.js';

/**
 * Infinite chat controller — ORCHESTRATION ONLY.
 *
 * All long-context / long-generation logic lives in the services layer:
 *
 *   infiniteChatController
 *     → LongContextEngine      (chunk → store → index → summarize → retrieve → budget)
 *     → LongGenerationEngine   (plan → parts → validate → assemble → resume/cancel)
 *     → PhoneModelAdapter      → LocalAIQueue → PhoneLocalProvider
 *
 * The controller only wires HTTP to those services and shapes responses.
 */
export function createInfiniteChatController({ longContextEngine, longGenerationEngine }) {
  return {
    // ── History ─────────────────────────────────────────────────────────
    getHistory: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const { conversationId } = request.params;
      const chat = await longContextEngine.chatModel.get(userId, conversationId);
      response.json({ chat });
    }),

    // ── Chat turn (bounded context, automatic ingestion of large input) ──
    chat: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const { conversationId, message, truncateIndex } = request.body;

      if (!message || !conversationId) {
        return response.status(400).json({ error: { message: 'Message and conversationId are required' } });
      }
      if (!longContextEngine.model.enabled) {
        return response.status(400).json({ error: { message: 'Local AI is disabled in environment.' } });
      }

      const engine = longContextEngine;
      const chatModel = engine.chatModel;

      // 0. Load existing conversation (truncate support for edits).
      const chat = await chatModel.get(userId, conversationId);
      let history = chat ? chat.messages : [];
      if (truncateIndex !== undefined && truncateIndex >= 0 && truncateIndex < history.length) {
        history = history.slice(0, truncateIndex);
      }

      // 1. Persist the user message immediately (never lose input).
      try {
        if (truncateIndex !== undefined) {
          await chatModel.updateMessages(userId, conversationId, [...history, { role: 'user', content: message }]);
        } else {
          await chatModel.appendMessages(userId, conversationId, [{ role: 'user', content: message }]);
        }
      } catch (persistErr) {
        console.error('[InfiniteChat] Failed to persist user message:', persistErr.message);
      }

      // 2. Large input? → ingest into the long-context store, replace the
      //    prompt with a bounded reference so the model never receives the
      //    whole payload at once.
      let requestForModel = message;
      let ingestion = null;
      if (message.length > engine.largeInputThreshold()) {
        try {
          ingestion = await engine.ingest({
            userId,
            conversationId,
            content: message,
            title: message.slice(0, 80),
            kind: 'chat-upload',
            summarize: true
          });
          requestForModel =
            `[The user just submitted a large ${ingestion.kind} titled "${ingestion.title}" — ` +
            `${ingestion.totalCharacters} chars, stored as ${ingestion.inputId} in ${ingestion.chunkCount} chunks ` +
            `(summary + retrieval index ready). ${ingestion.summary ? 'Global summary: ' + ingestion.summary.slice(0, 300) : ''}]\n\n` +
            `User instruction about the material: ${message.slice(0, 1500)}`;
        } catch (ingestErr) {
          console.error('[InfiniteChat] Ingestion failed, falling back to bounded prompt:', ingestErr.message);
        }
      }

      // 3. Compose the bounded context (retrieval + budget + task state).
      let composed;
      try {
        composed = await engine.composeChatContext({
          userId,
          conversationId,
          request: requestForModel,
          recentMessages: history.slice(-8)
        });
      } catch (budgetErr) {
        if (budgetErr.code === 'CONTEXT_WINDOW_EXCEEDED') {
          return response.status(413).json({
            error: {
              message: 'This single request exceeds the local model context window. Split the content or start a new chat.',
              code: 'CONTEXT_WINDOW_EXCEEDED'
            }
          });
        }
        throw budgetErr;
      }

      // 4. Model call through the queue-backed adapter.
      const startedAt = Date.now();
      try {
        const { text: reply, finishReason } = await engine.model.complete(composed.messages, {
          maxTokens: 768,
          maxAttempts: 6
        });

        if (!reply) {
          return response.status(502).json({ error: { message: 'Local AI returned no assistant content' } });
        }

        // 5. Persist assistant reply + update rolling memory (no extra model calls).
        const updatedChat = await chatModel.appendMessages(userId, conversationId, [
          { role: 'assistant', content: reply }
        ]);
        await engine.updateMemoryAfterTurn({
          conversationId,
          userMessage: message,
          assistantReply: reply
        }).catch((e) => console.warn('[InfiniteChat] memory update skipped:', e.message));

        response.json({
          reply,
          chat: updatedChat,
          longContext: {
            ingested: ingestion
              ? { inputId: ingestion.inputId, chunkCount: ingestion.chunkCount, status: ingestion.status }
              : null,
            retrievedBlocks: composed.retrievedBlocks.map((b) => ({ id: b.id, label: b.label, kind: b.kind })),
            budgetUsage: composed.usage,
            truncated: finishReason === 'length'
          }
        });
      } catch (error) {
        console.error('[InfiniteChat] model error:', error.message);
        if (error.code === 'CONTEXT_WINDOW_EXCEEDED') {
          return response.status(413).json({
            error: { message: 'Context window exceeded even after compaction.', code: error.code }
          });
        }
        if (error.status) {
          return response.status(error.status >= 500 ? 503 : error.status).json({
            error: { message: error.message, upstreamStatus: error.status }
          });
        }
        return response.status(503).json({
          error: {
            message:
              'Unable to reach the local AI on your phone. Make sure:\n• Local AI server is running\n• Allow External Connections is enabled\n• Phone and laptop are reachable\n• PHONE_AI_HOST is correct\n\nDetail: ' +
              error.message
          }
        });
      }
    }),

    // ── Explicit ingestion endpoint (documents, files, huge pastes) ─────
    ingest: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const { conversationId, content, title, kind, summarize } = request.body;
      if (!conversationId || !content) {
        return response.status(400).json({ error: { message: 'conversationId and content are required' } });
      }
      const input = await longContextEngine.ingest({
        userId,
        conversationId,
        content,
        title,
        kind: kind || 'document',
        summarize: summarize !== false
      });
      response.status(201).json({
        input: {
          inputId: input.inputId,
          title: input.title,
          kind: input.kind,
          totalCharacters: input.totalCharacters,
          estimatedTokens: input.estimatedTokens,
          chunkCount: input.chunkCount,
          status: input.status,
          hash: input.hash,
          summary: input.summary
        }
      });
    }),

    getIngestion: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const { conversationId, inputId } = request.params;
      const input = await longContextEngine.store.getInput(userId, conversationId, inputId);
      if (!input) return response.status(404).json({ error: { message: 'Input not found' } });
      response.json({ input });
    }),

    resumeIngestion: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const { conversationId, inputId } = request.params;
      const input = await longContextEngine.resumeIngest(userId, conversationId, inputId);
      response.json({ input });
    }),

    // ── Deterministic document operations ────────────────────────────────
    searchChunks: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const { conversationId } = request.params;
      const { query } = request.body || {};
      if (!query) return response.status(400).json({ error: { message: 'query is required' } });
      const results = await longContextEngine.search(userId, conversationId, query);
      response.json({ results, count: results.length });
    }),

    getChunk: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const { conversationId, inputId, chunkRef } = request.params;
      const chunk = await longContextEngine.getExactChunk(userId, conversationId, inputId, chunkRef);
      if (!chunk) return response.status(404).json({ error: { message: 'Chunk not found' } });
      response.json({ chunk });
    }),

    summarizeDocument: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const { conversationId, inputId } = request.params;
      const result = await longContextEngine.summarizeDocument(userId, conversationId, inputId);
      response.json(result);
    }),

    // ── Long generation lifecycle ────────────────────────────────────────
    startGeneration: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const { conversationId, request: userRequest, artifactHint } = request.body || {};
      if (!conversationId || !userRequest) {
        return response.status(400).json({ error: { message: 'conversationId and request are required' } });
      }
      const record = await longGenerationEngine.startGeneration({ userId, conversationId, request: userRequest, artifactHint });
      response.status(202).json({
        generationId: record.generationId,
        status: record.status,
        statusUrl: `/api/v1/infinite/generations/${record.generationId}`
      });
    }),

    getGeneration: asyncHandler(async (request, response) => {
      const userId = request.user.id;
      const record = await longGenerationEngine.get(request.params.generationId);
      if (!record || record.userId !== userId) {
        return response.status(404).json({ error: { message: 'Generation not found' } });
      }
      response.json({
        generation: {
          generationId: record.generationId,
          status: record.status,
          progress: record.progress,
          plan: record.plan
            ? {
                artifact: record.plan.artifact,
                language: record.plan.language,
                files: record.plan.files?.map((f) => f.path),
                totalSegments: record.plan.totalSegments
              }
            : null,
          parts: record.parts?.map((p) => ({
            partId: p.partId,
            sequence: p.sequence,
            filename: p.filename,
            segmentIndex: p.segmentIndex,
            size: p.content?.length || 0,
            validationOk: p.validation?.ok !== false
          })),
          errors: record.errors?.slice(-5),
          assembly: record.status === 'completed' ? record.assembly : null
        }
      });
    }),

    cancelGeneration: asyncHandler(async (request, response) => {
      const record = await longGenerationEngine.cancel(request.params.generationId, request.user.id);
      if (!record) return response.status(404).json({ error: { message: 'Generation not found' } });
      response.json({ generationId: record.generationId, status: record.status, cancelled: true });
    }),

    resumeGeneration: asyncHandler(async (request, response) => {
      const record = await longGenerationEngine.resume(request.params.generationId, request.user.id);
      if (!record) return response.status(404).json({ error: { message: 'Generation not found' } });
      response.json({ generationId: record.generationId, status: record.status });
    }),

    listGenerations: asyncHandler(async (request, response) => {
      const { conversationId } = request.query;
      const records = await longGenerationEngine.listForUser(request.user.id, conversationId, { limit: 30 });
      response.json({
        generations: records.map((r) => ({
          generationId: r.generationId,
          conversationId: r.conversationId,
          status: r.status,
          artifact: r.plan?.artifact,
          progress: r.progress,
          createdAt: r.createdAt
        }))
      });
    })
  };
}
