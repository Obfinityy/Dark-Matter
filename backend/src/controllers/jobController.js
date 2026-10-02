import { asyncHandler, extractUrl } from '../core/utils.js';
import { fingerprintTarget } from '../services/targetFingerprint.js';
import { buildDiary, sortFindingsCriticalFirst } from '../services/huntDiary.js';

/**
 * Job Controller — REST + SSE surface of the Autonomous Bug Bounty Agent.
 *
 * Everything shown in the frontend comes from these endpoints, which read real
 * persisted state. The controller never runs the agent loop: it creates a job,
 * returns the id, and lets the worker work (requirement #69, #85).
 *
 * Target dedup: POST /jobs fingerprints the pasted target and checks the
 * hunt-records database FIRST. A completed report for that target is returned
 * instantly (deduped: true) — the agent only runs when the user explicitly
 * passes forceNew: true ("Start new hunt").
 */
export function createJobController({ jobManager, assessmentService, eventService, computerAdapter = null, computerActionModel = null, reasoningCycleModel = null, huntRecordModel = null, reportService = null, findingModel = null, agentStateModel = null, evidenceModel = null }) {
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

      // Target dedup: normalize + hash the pasted target and check the
      // hunt-records database FIRST. If a completed report already exists for
      // this target, return it instantly — do NOT re-run the agent. The UI's
      // explicit "Start new hunt" button passes forceNew: true to bypass this.
      // Invalid/unparseable targets skip dedup; the normal flow validates them.
      const rawTarget = input.targetUrl || extractUrl(input.message);
      if (rawTarget && input.forceNew !== true && huntRecordModel) {
        try {
          const { hash, canonical } = fingerprintTarget(rawTarget);
          const existing = await huntRecordModel.findLatestByTarget(userId, hash);
          if (existing) {
            const full = await huntRecordModel.findFullById(userId, existing.id);
            return response.status(200).json({
              deduped: true,
              target: canonical,
              huntRecord: full,
              message: 'This target was already hunted — returning the existing report. Start a new hunt to run the agent again.'
            });
          }
        } catch {
          // fall through to normal creation/validation
        }
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
        // Full normalized URL (keeps the port: 127.0.0.1:4555 ≠ 127.0.0.1).
        // ScopeEngine and all job.target consumers accept full URLs.
        // The brain builds probe URLs from job.target; a bare hostname would
        // point every probe at the wrong port.
        target: created.assessment.targetUrl || created.assessment.targetHostname,
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
          createdAt: job.createdAt,
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

    /**
     * GET /api/v1/jobs/:id/computer-actions — the persisted computer-action
     * ledger: every hands action in order, with params, observation,
     * expected-vs-actual verdict, recovery advice and the next decision
     * (issue #1 "Persistence" + "Status reporting").
     */
    computerActions: asyncHandler(async (request, response) => {
      await jobManager.requireJob(request.user.id, request.params.id);
      if (!computerActionModel) return response.json({ actions: [] });
      const limit = Math.min(Number(request.query.limit || 200), 1000);
      const actions = await computerActionModel.listByJob(request.params.id, limit);
      response.json({ actions });
    }),

    /**
     * GET /api/v1/jobs/:id/reasoning-cycles — the persisted thinking loop
     * (issue #1 "the reasoning/thinking flow must be first-class"): each
     * step's thought → action → expected outcome → verification → adaptation.
     */
    reasoningCycles: asyncHandler(async (request, response) => {
      await jobManager.requireJob(request.user.id, request.params.id);
      if (!reasoningCycleModel) return response.json({ cycles: [] });
      const limit = Math.min(Number(request.query.limit || 100), 500);
      const cycles = await reasoningCycleModel.listByJob(request.params.id, { limit });
      response.json({ cycles });
    }),

    /** GET /api/v1/jobs/:id/events/history — replayable event history */
    eventHistory: asyncHandler(async (request, response) => {      const result = await jobManager.listEvents(request.user.id, request.params.id, {
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

    /** POST /api/v1/jobs/:id/ask — talk to the agent about the running job.
     * Uses the brain-powered path: simple status questions get fast rule-based
     * answers, everything else is understood and answered by the AI agent itself. */
    ask: asyncHandler(async (request, response) => {
      const question = request.body?.message;
      if (!question) {
        return response.status(400).json({ error: { code: 'MISSING_MESSAGE', message: 'Message is required' } });
      }
      const answer = await jobManager.askBrain(request.user.id, request.params.id, question);
      response.json(answer);
    }),

    /** GET /api/v1/jobs/:id/findings — critical-first, for the findings board */
    findings: asyncHandler(async (request, response) => {
      const job = await jobManager.requireJob(request.user.id, request.params.id);
      const findings = findingModel ? await findingModel.list(job.assessmentId) : [];
      response.json({ findings: sortFindingsCriticalFirst(findings) });
    }),

    /** GET /api/v1/jobs/:id/vulnerability-report — latest persisted final report */
    vulnerabilityReport: asyncHandler(async (request, response) => {
      const job = await jobManager.requireJob(request.user.id, request.params.id);
      const report = reportService ? await reportService.getLatest(job.assessmentId) : null;
      if (!report) {
        return response.status(404).json({
          error: { code: 'REPORT_NOT_READY', message: 'The final report is generated when the hunt completes.' }
        });
      }
      response.json({ report });
    }),

    /** GET /api/v1/jobs/:id/attack-surface — live map from the agent's state */
    attackSurface: asyncHandler(async (request, response) => {
      const job = await jobManager.requireJob(request.user.id, request.params.id);
      const state = agentStateModel ? await agentStateModel.get(job.assessmentId).catch(() => null) : null;
      response.json({
        attackSurface: {
          subdomains: state?.subdomains || [],
          endpoints: state?.endpoints || [],
          parameters: state?.parameters || [],
          technologies: state?.technologies || [],
          openPorts: state?.openPorts || [],
          updatedAt: state?.updatedAt || null
        }
      });
    }),

    /** GET /api/v1/jobs/:id/diary — the plain-language hunt diary */
    diary: asyncHandler(async (request, response) => {
      const job = await jobManager.requireJob(request.user.id, request.params.id);
      const entries = await buildDiary(
        {
          // The diary's contract wants an activityModel; the job's own
          // persisted activity array IS that source — adapted, not duplicated.
          activityModel: { list: async () => job.activity || [] },
          reasoningCycleModel,
          computerActionModel,
          // findingModel.list() is keyed by assessmentId, not jobId.
          findingModel: findingModel ? { list: async () => findingModel.list(job.assessmentId) } : null,
          evidenceModel
        },
        request.user.id,
        job.id
      );
      response.json({ diary: entries });
    }),

    /** GET /api/v1/jobs/:id/posture — posture score for the hunt's target, from real findings */
    posture: asyncHandler(async (request, response) => {
      const job = await jobManager.requireJob(request.user.id, request.params.id);
      const findings = findingModel ? await findingModel.list(job.assessmentId) : [];
      const posture = assessmentService.postureFromFindings(findings);
      // Prefer the assessment's full normalized target URL; fall back to the job's target.
      const assessment = job.assessmentId
        ? await assessmentService.get(request.user.id, job.assessmentId).catch(() => null)
        : null;
      response.json({
        posture: {
          ...posture,
          target: assessment?.targetUrl || job.target,
          assessmentId: job.assessmentId,
          jobId: job.id,
          jobStatus: job.status,
        }
      });
    })
  };
}
