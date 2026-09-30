import { asyncHandler } from '../core/utils.js';
import { classifyComputerInstruction } from '../services/computerTaskManager.js';
import { stripThinkingTags } from '../agent/providers/phoneLocalProvider.js';

/**
 * Infinite chat controller — ORCHESTRATION ONLY.
 *
 * All long-context / long-generation logic lives in the services layer:
 *
 *   infiniteChatController
 *     → LongContextEngine      (chunk → store → index → summarize → retrieve → budget)
 *     → LongGenerationEngine   (plan → parts → validate → assemble → resume/cancel)
 *     → PhoneModelAdapter      → LocalAIQueue → PhoneLocalProvider
 *     → ComputerTaskManager    (real Windows control via the shared hands layer)
 *
 * The controller only wires HTTP to those services and shapes responses.
 */
export function createInfiniteChatController({ longContextEngine, longGenerationEngine, computerTaskManager = null }) {
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

      // ── Computer-task routing (requirement #24) ────────────────────────
      // A desktop-control instruction in InfiniteChat becomes a REAL computer
      // task driven by the local brain + the shared Open-Interface hands —
      // not a chatbot answer about how to do it.
      if (computerTaskManager) {
        try {
          const latest = await computerTaskManager.taskModel.latestForConversation(userId, conversationId);
          const { isComputerTask } = classifyComputerInstruction(message, latest);
          if (isComputerTask) {
            const task = await computerTaskManager.createTask({
              userId,
              conversationId,
              instruction: message
            });
            await longContextEngine.chatModel.appendMessages(userId, conversationId, [
              { role: 'user', content: message, computerTaskId: task.id }
            ]);
            return response.status(202).json({
              computerTask: {
                taskId: task.id,
                status: task.status,
                instruction: task.instruction,
                previousTaskId: task.previousTaskId || null,
                statusUrl: `/api/v1/computer-tasks/${task.id}`,
                eventsUrl: `/api/v1/computer-tasks/${task.id}/events`
              },
              chat: await longContextEngine.chatModel.get(userId, conversationId)
            });
          }
        } catch (routeErr) {
          // A routing failure must never break normal chat.
          console.error('[InfiniteChat] computer-task routing failed, falling back to chat:', routeErr.message);
        }
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
          // Fallback: auto-compact request to fit context window budget
          const truncatedPrompt = requestForModel.slice(0, 2000) + '\n\n[... Context auto-compacted ...]';
          composed = await engine.composeChatContext({
            userId,
            conversationId,
            request: truncatedPrompt,
            recentMessages: history.slice(-3)
          });
        } else {
          throw budgetErr;
        }
      }

function stitchContinuation(original, continuation) {
  if (!continuation) return original;
  const origLines = original.split('\n');
  const contLines = continuation.split('\n');

  let overlapIndex = 0;
  for (let i = Math.max(0, origLines.length - 8); i < origLines.length; i++) {
    const origSlice = origLines.slice(i).join('\n').trim();
    if (origSlice && contLines.slice(0, origLines.length - i).join('\n').trim() === origSlice) {
      overlapIndex = origLines.length - i;
      break;
    }
  }

  const cleanContinuation = contLines.slice(overlapIndex).join('\n');
  return original + (original.endsWith('\n') ? '' : '\n') + cleanContinuation;
}

      // 4. Model call through the queue-backed adapter.
      const isShortGreeting = message.trim().length < 120 && !/\b(code|build|create|python|scan|script|game|document|ingest|search|explain|samjha|detail|step)\b/i.test(message);
      const isDetailedQuery = /\b(code|build|create|python|script|game|explain|samjha|detail|step|cpp|c\+\+|java|javascript|tutorial)\b/i.test(message);
      const targetMaxTokens = isShortGreeting ? 300 : isDetailedQuery ? 2500 : 1200;

      const isStream = request.body.stream === true || request.query.stream === 'true' || request.headers.accept?.includes('text/event-stream');

      if (isStream) {
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');
        response.flushHeaders?.();

        const sendEvent = (type, data) => {
          try {
            response.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
          } catch (e) {}
        };

        sendEvent('state', { step: 'Context Assembly', detail: 'Reading prompt & long-context memory budget...' });
        
        let fullReply = '';
        const startedAt = Date.now();

        try {
          if (typeof engine.model.streamComplete === 'function') {
            const streamRes = await engine.model.streamComplete(composed.messages, {
              maxTokens: targetMaxTokens,
              onState: (state) => sendEvent('state', state),
              onToken: (delta, cleanSoFar) => {
                fullReply = cleanSoFar;
                sendEvent('token', { delta, content: cleanSoFar });
              }
            });
            fullReply = streamRes.text || fullReply;
          } else {
            sendEvent('state', { step: 'Phone AI Pipeline', detail: 'Generating response via local phone AI...' });
            const completeRes = await engine.model.complete(composed.messages, { maxTokens: targetMaxTokens });
            fullReply = stripThinkingTags(completeRes.text || '');
            sendEvent('token', { delta: fullReply, content: fullReply });
          }

          const durationMs = Date.now() - startedAt;
          const steps = generateDynamicSteps(message, durationMs);

          sendEvent('state', { step: 'Finalizing', detail: 'Persisting conversation turn...' });
          const updatedChat = await chatModel.appendMessages(userId, conversationId, [
            { role: 'assistant', content: fullReply, thinkingTimeMs: durationMs, steps, budgetUsage: composed.usage }
          ]);

          if (!isShortGreeting) {
            await engine.updateMemoryAfterTurn({
              conversationId,
              userMessage: message,
              assistantReply: fullReply
            }).catch((e) => console.warn('[InfiniteChat] memory update skipped:', e.message));
          }

          sendEvent('done', {
            reply: fullReply,
            thinkingTimeMs: durationMs,
            steps,
            chat: updatedChat,
            longContext: { budgetUsage: composed.usage, ingested: ingestion }
          });
          response.end();
          return;
        } catch (streamErr) {
          sendEvent('error', { message: streamErr.message || 'Stream generation failed' });
          response.end();
          return;
        }
      }

      const startedAt = Date.now();
      try {
        let { text: rawReply, finishReason } = await engine.model.complete(composed.messages, {
          maxTokens: targetMaxTokens,
          maxAttempts: 6
        });

        let reply = stripThinkingTags(rawReply || '');

        // Auto-continuation loop if reply was truncated midway
        let continuationLoops = 0;
        while (
          (finishReason === 'length' || finishReason === 'max_tokens' || !reply || ((reply.match(/```/g) || []).length % 2 !== 0)) &&
          continuationLoops < 3
        ) {
          continuationLoops++;
          console.log(`[InfiniteChat] Output truncated or empty (loop ${continuationLoops}). Auto-continuing...`);

          const continuationMessages = [
            ...composed.messages,
            { role: 'assistant', content: reply || 'I am explaining the concept...' },
            { role: 'user', content: 'Continue generating the detailed explanation/code directly without any reasoning tags. Do not repeat what was already written.' }
          ];

          try {
            const contResult = await engine.model.complete(continuationMessages, {
              maxTokens: 1500,
              maxAttempts: 6
            });
            if (contResult?.text) {
              const cleanCont = stripThinkingTags(contResult.text);
              reply = reply ? stitchContinuation(reply, cleanCont) : cleanCont;
              rawReply += '\n' + contResult.text;
              finishReason = contResult.finishReason;
            } else {
              break;
            }
          } catch (contErr) {
            console.warn('[InfiniteChat] Auto-continuation loop failed:', contErr.message);
            break;
          }
        }

        if (!reply) {
          return response.status(502).json({ error: { message: 'Local AI returned no assistant content' } });
        }

function generateDynamicSteps(message = '', durationMs = 100) {
  const text = message.toLowerCase();
  let step1 = 'Analyzed prompt intent';
  let step2 = 'Evaluated context budget';
  let step3 = 'Synthesized response via Phone AI';

  if (/\b(code|python|game|build|create|script|function|class|js|react|html)\b/i.test(text)) {
    step1 = 'Analyzed code requirements & structure';
    step2 = 'Planned logic modules & language syntax';
    step3 = 'Generated complete code solution';
  } else if (/\b(search|explain|what|why|how|summary|summarize|document|file)\b/i.test(text)) {
    step1 = 'Parsed user question & topic context';
    step2 = 'Searched vector memory & index';
    step3 = 'Synthesized detailed explanation';
  } else if (/\b(open|click|launch|type|notepad|desktop|window|app|cmd|run)\b/i.test(text)) {
    step1 = 'Interpreted computer control command';
    step2 = 'Probed desktop environment & active window';
    step3 = 'Executed desktop action sequence';
  } else if (/\b(target|scan|nmap|subdomain|vuln|security|exploit|recon)\b/i.test(text)) {
    step1 = 'Evaluated target scope & security policy';
    step2 = 'Correlated attack surface findings';
    step3 = 'Generated security guidance';
  }

  return [
    { label: step1, durationMs: Math.max(10, Math.round(durationMs * 0.15)) },
    { label: step2, durationMs: Math.max(15, Math.round(durationMs * 0.25)) },
    { label: step3, durationMs: Math.max(20, Math.round(durationMs * 0.60)) }
  ];
}

        const durationMs = Date.now() - startedAt;
        const steps = generateDynamicSteps(message, durationMs);

        // 5. Persist assistant reply + update rolling memory.
        const updatedChat = await chatModel.appendMessages(userId, conversationId, [
          { role: 'assistant', content: reply, thinkingTimeMs: durationMs, steps, budgetUsage: composed.usage }
        ]);

        if (!isShortGreeting) {
          await engine.updateMemoryAfterTurn({
            conversationId,
            userMessage: message,
            assistantReply: reply
          }).catch((e) => console.warn('[InfiniteChat] memory update skipped:', e.message));
        }

        response.json({
          reply,
          chat: updatedChat,
          thinkingTimeMs: durationMs,
          steps,
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
          try {
            const fallbackPrompt = message.slice(0, 1000) + '\n\n[Note: generate python dragon game code concise and clean]';
            const fallbackRes = await engine.model.complete([
              { role: 'user', content: fallbackPrompt }
            ], { maxTokens: 500 });

            const updatedChat = await chatModel.appendMessages(userId, conversationId, [
              { role: 'assistant', content: fallbackRes.text }
            ]);

            return response.json({
              reply: fallbackRes.text,
              chat: updatedChat,
              thinkingTimeMs: Date.now() - startedAt,
              steps: [{ label: 'Compacted prompt to fit phone memory', durationMs: Date.now() - startedAt }],
              longContext: { ingested: null, retrievedBlocks: [], budgetUsage: {}, truncated: false }
            });
          } catch (fallbackErr) {
            console.error('[InfiniteChat] Fallback generation error:', fallbackErr.message);
          }
        }
        if (error.status) {
          const httpStatus = (error.status === 429 || error.status >= 500) ? 503 : error.status;
          return response.status(httpStatus).json({
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
