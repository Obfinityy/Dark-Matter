import { asyncHandler } from '../core/utils.js';

/**
 * Computer Task Controller — REST + SSE surface of the InfiniteChat
 * computer-control agent.
 *
 * The controller never runs the loop: it creates a task, returns the id, and
 * lets the worker work — the browser is never responsible for execution (#25).
 */
export function createComputerTaskController({ computerTaskManager, computerAdapter = null }) {
  return {
    /** POST /api/v1/computer-tasks — create a task from a natural-language instruction */
    create: asyncHandler(async (request, response) => {
      const userId = request.user.id; // server-derived identity, never trusted from the body
      const { instruction, conversationId } = request.body || {};

      if (!instruction || !String(instruction).trim()) {
        return response.status(400).json({
          error: { code: 'MISSING_INSTRUCTION', message: 'instruction is required' },
        });
      }
      if (!conversationId) {
        return response.status(400).json({
          error: { code: 'MISSING_CONVERSATION', message: 'conversationId is required' },
        });
      }

      const task = await computerTaskManager.createTask({
        userId,
        conversationId,
        instruction: String(instruction),
        followUpHint:
          request.body?.followUpHint === true
            ? true
            : request.body?.followUpHint === false
              ? false
              : null,
      });

      // 202: accepted, running in the background. Deliberately no long-lived request.
      return response.status(202).json({
        status: 'accepted',
        taskId: task.id,
        conversationId: task.conversationId,
        taskStatus: task.status,
        previousTaskId: task.previousTaskId || null,
        createdAt: task.createdAt,
      });
    }),

    /** GET /api/v1/computer-tasks — list the caller's tasks */
    list: asyncHandler(async (request, response) => {
      const tasks = await computerTaskManager.list(request.user.id, {
        conversationId: request.query.conversationId || null,
        limit: Math.min(Number(request.query.limit || 30), 100),
      });
      response.json({
        tasks: tasks.map(task => ({
          id: task.id,
          conversationId: task.conversationId,
          instruction: task.instruction,
          status: task.status,
          phase: task.phase,
          currentApplication: task.currentApplication,
          activeWindow: task.activeWindow,
          currentAction: task.currentAction,
          stepCount: task.stepCount,
          verificationStatus: task.verificationStatus,
          waitingReason: task.waitingReason,
          finalMessage: task.finalMessage,
          previousTaskId: task.previousTaskId || null,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          completedAt: task.completedAt,
        })),
      });
    }),

    /** GET /api/v1/computer-tasks/:id — full state snapshot (after refresh/reopen) */
    get: asyncHandler(async (request, response) => {
      const state = await computerTaskManager.getState(request.user.id, request.params.id);
      const computer = computerAdapter ? computerAdapter.status() : null;
      response.json({ ...state, computer });
    }),

    /** GET /api/v1/computer-tasks/:id/activity — the checkmark activity feed */
    activity: asyncHandler(async (request, response) => {
      const task = await computerTaskManager.requireTask(request.user.id, request.params.id);
      const limit = Math.min(Number(request.query.limit || 300), 1000);
      response.json({ activity: (task.activity || []).slice(-limit) });
    }),

    /** GET /api/v1/computer-tasks/:id/events/history — replayable event history */
    eventHistory: asyncHandler(async (request, response) => {
      const result = await computerTaskManager.listEvents(request.user.id, request.params.id, {
        afterId: request.query.after || null,
        limit: Math.min(Number(request.query.limit || 500), 2000),
      });
      response.json(result);
    }),

    /** GET /api/v1/computer-tasks/:id/events — SSE stream with replay from Last-Event-ID */
    events: asyncHandler(async (request, response) => {
      const task = await computerTaskManager.requireTask(request.user.id, request.params.id);

      response.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders?.();

      const send = event => {
        response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      // 1. Replay what happened while the browser was closed.
      const history = await computerTaskManager.listEvents(request.user.id, task.id, {
        limit: 2000,
      });
      const lastEventId = request.header('last-event-id') || request.query.lastEventId;
      const startIndex = lastEventId
        ? history.events.findIndex(event => event.id === lastEventId) + 1
        : 0;
      history.events.slice(Math.max(0, startIndex)).forEach(send);

      // 2. Then attach live.
      const unsubscribe = computerTaskManager.eventService.subscribe(task.id, send);
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);

      request.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        // NOTE: closing this stream NEVER stops the task. The worker owns it.
      });
    }),

    /** POST /api/v1/computer-tasks/:id/answer — answer an ask_user question */
    answer: asyncHandler(async (request, response) => {
      const message = request.body?.message;
      if (!message || !String(message).trim()) {
        return response.status(400).json({
          error: { code: 'MISSING_MESSAGE', message: 'message is required' },
        });
      }
      const result = await computerTaskManager.answer(
        request.user.id,
        request.params.id,
        String(message)
      );
      response.json(result);
    }),

    /** POST /api/v1/computer-tasks/:id/cancel — the Stop Task button */
    cancel: asyncHandler(async (request, response) => {
      response.json(await computerTaskManager.cancel(request.user.id, request.params.id));
    }),
  };
}
