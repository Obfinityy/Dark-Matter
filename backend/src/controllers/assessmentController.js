/**
 * assessmentController — Express route handlers for assessment.
 * Factory that wires the assessment service into REST endpoints.
 * Part of: Infinity AI / Dark-Matter backend (HTTP API controllers).
 */

import { asyncHandler } from '../core/utils.js';

/**
 * Assessment Controller — REST endpoints for assessments.
 */
export function createAssessmentController(assessmentService, eventService) {
  return {
    /** POST /api/v1/assessments — create a new assessment */
    create: asyncHandler(async (request, response) => {
      const input = request.body || {};
      const result = await assessmentService.createFromTarget(request.user.id, input);
      response.status(result.status === 'started' ? 202 : 200).json(result);
    }),

    /** GET /api/v1/assessments — list all assessments */
    list: asyncHandler(async (request, response) => {
      const assessments = await assessmentService.list(request.user.id);
      response.json({ assessments });
    }),

    /** GET /api/v1/assessments/:id — get assessment details */
    get: asyncHandler(async (request, response) => {
      const assessment = await assessmentService.get(request.user.id, request.params.id);
      response.json(assessment);
    }),

    /** POST /api/v1/assessments/:id/start — start an assessment */
    start: asyncHandler(async (request, response) => {
      const result = await assessmentService.resume(request.user.id, request.params.id);
      response.json(result);
    }),

    /** POST /api/v1/assessments/:id/pause — pause an assessment */
    pause: asyncHandler(async (request, response) => {
      const result = await assessmentService.pause(request.user.id, request.params.id);
      response.json(result);
    }),

    /** POST /api/v1/assessments/:id/resume — resume an assessment */
    resume: asyncHandler(async (request, response) => {
      const result = await assessmentService.resume(request.user.id, request.params.id);
      response.json(result);
    }),

    /** POST /api/v1/assessments/:id/stop — stop an assessment */
    stop: asyncHandler(async (request, response) => {
      const result = await assessmentService.stop(request.user.id, request.params.id);
      response.json(result);
    }),

    /** GET /api/v1/assessments/:id/timeline — get full investigation timeline */
    timeline: asyncHandler(async (request, response) => {
      await assessmentService.get(request.user.id, request.params.id); // ownership check
      const events = await assessmentService.getTimeline(request.params.id);
      response.json({ events });
    }),

    /** GET /api/v1/assessments/:id/findings — get findings */
    findings: asyncHandler(async (request, response) => {
      await assessmentService.get(request.user.id, request.params.id); // ownership check
      const findings = await request.app.locals.services.findingModel.list(request.params.id);
      response.json({ findings });
    }),

    /** GET /api/v1/assessments/:id/tool-executions — get tool execution history */
    toolExecutions: asyncHandler(async (request, response) => {
      await assessmentService.get(request.user.id, request.params.id); // ownership check
      const executions = await request.app.locals.services.toolExecutionModel.list(
        request.params.id
      );
      response.json({ executions });
    }),

    /** POST /api/v1/assessments/:id/chat — send a chat message */
    chat: asyncHandler(async (request, response) => {
      const message = request.body?.message;
      if (!message)
        return response
          .status(400)
          .json({ error: { code: 'MISSING_MESSAGE', message: 'Message is required' } });
      const result = await assessmentService.chat(request.user.id, request.params.id, message);
      response.json(result);
    }),

    /** GET /api/v1/assessments/:id/events — SSE stream */
    events: asyncHandler(async (request, response) => {
      const assessment = await assessmentService.get(request.user.id, request.params.id);
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

      const lastEventId = request.header('last-event-id');
      const events = await eventService.list(assessment.id);
      const startIndex = lastEventId ? events.findIndex(e => e.id === lastEventId) + 1 : 0;
      events.slice(Math.max(0, startIndex)).forEach(send);

      const unsubscribe = eventService.subscribe(assessment.id, send);
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);
      request.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    }),
  };
}
