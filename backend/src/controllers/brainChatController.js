/**
 * brainChatController.js — dynamic chat with local brains.
 */
import { createBrainChatService } from '../services/brainChatService.js';
import { loadMemory, clearMemory, listChats } from '../services/chatMemoryService.js';

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_BRAINS = ['hacker', 'vision', 'grounding'];

export function createBrainChatController({ modelRunnerService }) {
  const brainChat = createBrainChatService({ modelRunnerService });

  return {
    /**
     * POST /api/v1/brain-chat
     * Body: { chatId, brain: 'hacker'|'vision'|'grounding', message, context? }
     * Returns: { reply, chatId, brain }
     */
    chat: asyncHandler(async (request, response) => {
      const { chatId, brain, message, context } = request.body || {};

      if (!chatId) {
        return response.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'chatId is required' }
        });
      }
      if (!VALID_BRAINS.includes(brain)) {
        return response.status(400).json({
          error: { code: 'BAD_REQUEST', message: `brain must be one of: ${VALID_BRAINS.join(', ')}` }
        });
      }
      if (!message?.trim()) {
        return response.status(400).json({
          error: { code: 'BAD_REQUEST', message: 'message is required' }
        });
      }

      try {
        const result = await brainChat.chatWithBrain(chatId, brain, message, context || {});
        response.json(result);
      } catch (err) {
        if (err.message?.includes('BRAIN_NOT_RUNNING')) {
          return response.status(503).json({
            error: {
              code: 'BRAIN_NOT_RUNNING',
              message: err.message,
              brain
            }
          });
        }
        throw err;
      }
    }),

    /**
     * GET /api/v1/brain-chat/brains — which brains are running
     */
    brains: asyncHandler(async (request, response) => {
      response.json({ brains: brainChat.getRunningBrains() });
    }),

    /**
     * GET /api/v1/brain-chat/:chatId/memory — load a chat's memory
     */
    getMemory: asyncHandler(async (request, response) => {
      const { chatId } = request.params;
      response.json(loadMemory(chatId));
    }),

    /**
     * DELETE /api/v1/brain-chat/:chatId/memory — clear a chat's memory
     */
    deleteMemory: asyncHandler(async (request, response) => {
      const { chatId } = request.params;
      response.json({ cleared: clearMemory(chatId) });
    }),

    /**
     * GET /api/v1/brain-chat/list — list all chats with memory
     */
    list: asyncHandler(async (request, response) => {
      response.json({ chats: listChats() });
    })
  };
}
