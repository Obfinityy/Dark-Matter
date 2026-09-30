import { asyncHandler } from '../core/utils.js';

/**
 * Job Controller — REST + SSE surface of the Autonomous Bug Bounty Agent.
 *
 * Everything shown in the frontend comes from these endpoints, which read real
 * persisted state. The controller never runs the agent loop: it creates a job,
 * returns the id, and lets the worker work (requirement #69, #85).
 */
export function createJobController({ jobManager, assessmentService, eventService, computerAdapter = null }) {
  return {
    /** POST /api/v1/jobs — create an autonomous assessment job */
    create: asyncHandler(async (request, response) => {
      const userId = request.user.id; // server-derived identity, never trusted from the body
      const input = request.body || {};

      if (input.authorizationConfirmed !== true) {
        return response.status(400).json({
          error: {
            code: 'AUTHORIZATION_REQUIRED',
            message: 'Confirm that you are authorized to test this target before starting an autonomous assessment.'
          }
        });
      }

      // Create/reuse the assessment WITHOUT starting the legacy in-request brain.
      const created = await assessmentService.createFromTarget(userId, { ...input, deferStart: true });
      if (created.status !== 'assessment_created') {
        return response.status(200).json(created);
      }

      const job = await jobManager.createJob({
        userId,
        assessmentId: created.assessmentId,
        conversationId: input.conversationId || null,
        target: created.assessment.targetHostname,
        scope: created.assessment.scope,
        objective: input.message || `Assess ${created.assessment.targetHostname}`
      });

      // 202: accepted, running in the background. Deliberately no long-lived request.
      return response.status(202).json({
        status: 'accepted',
        jobId: job.id,
        assessmentId: created.assessmentId,
        target: job.target,
        scope: job.scope,
        jobStatus: job.status,
        startedAt: job.startedAt || job.createdAt
      });
    }),

    /** GET /api/v1/jobs — list the caller's jobs */
    list: asyncHandler(async (request, response) => {
      const jobs = await jobManager.list(request.user.id);
      response.json({
        jobs: jobs.map((job) => ({
          id: job.id,
          assessmentId: job.assessmentId,
          target: job.target,
          status: job.status,
          phase: job.phase,
          objective: job.currentObjective || job.objective,
          stepCount: job.stepCount,
          findingsCount: job.findingsCount,
          evidenceCount: job.evidenceCount,
          computerRuntime: job.computerRuntime,
          brainStatus: job.brainStatus,
          waitingReason: job.waitingReason,
          reportId: job.reportId,
          reportVersion: job.reportVersion,
          startedAt: job.startedAt || job.createdAt,
          updatedAt: job.updatedAt,
          completedAt: job.completedAt
        }))
      });
    }),

    /** GET /api/v1/jobs/:id — full state snapshot (fires after a refresh/reopen) */
    get: asyncHandler(async (request, response) => {
      const state = await jobManager.getState(request.user.id, request.params.id);
      const computer = computerAdapter ? computerAdapter.status() : null;
      response.json({ ...state, computer });
    }),

    /** GET /api/v1/jobs/:id/activity — the live terminal feed */
    activity: asyncHandler(async (request, response) => {
      const job = await jobManager.requireJob(request.user.id, request.params.id);
      const limit = Math.min(Number(request.query.limit || 300), 1000);
      response.json({ activity: (job.activity || []).slice(-limit) });
    }),

    /** GET /api/v1/jobs/:id/events/history — replayable event history */
    eventHistory: asyncHandler(async (request, response) => {
      const result = await jobManager.listEvents(request.user.id, request.params.id, {
        afterId: request.query.after || null,
        limit: Math.min(Number(request.query.limit || 500), 2000)
      });
      response.json(result);
    }),

    /** GET /api/v1/jobs/:id/events — SSE stream with replay from Last-Event-ID */
    events: asyncHandler(async (request, response) => {
      const job = await jobManager.requireJob(request.user.id, request.params.id);

      response.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      response.flushHeaders?.();

      const send = (event) => {
        response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      // 1. Replay what happened while the browser was closed.
      const history = await eventService.list(job.id);
      const lastEventId = request.header('last-event-id');
      const startIndex = lastEventId ? history.findIndex((event) => event.id === lastEventId) + 1 : 0;
      history.slice(Math.max(0, startIndex)).forEach(send);

      // 2. Then attach live.
      const unsubscribe = eventService.subscribe(job.id, send);
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);

      request.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        // NOTE: closing this stream NEVER stops the job. The worker owns it.
      });
    }),

    pause: asyncHandler(async (request, response) => {
      response.json(await jobManager.pause(request.user.id, request.params.id));
    }),

    continue: asyncHandler(async (request, response) => {
      response.json(await jobManager.continue(request.user.id, request.params.id));
    }),

    resume: asyncHandler(async (request, response) => {
      response.json(await jobManager.resume(request.user.id, request.params.id));
    }),

    cancel: asyncHandler(async (request, response) => {
      response.json(await jobManager.cancel(request.user.id, request.params.id));
    }),

    /** POST /api/v1/jobs/:id/ask — talk to the agent about the running job */
    ask: asyncHandler(async (request, response) => {
      const question = request.body?.message;
      if (!question) {
        return response.status(400).json({ error: { code: 'MISSING_MESSAGE', message: 'Message is required' } });
      }
      const answer = await jobManager.ask(request.user.id, request.params.id, question);
      response.json(answer);
    })
  };
}
