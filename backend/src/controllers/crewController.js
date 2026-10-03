import { asyncHandler } from '../core/utils.js';

/**
 * Infinity Crew Controller — REST + SSE surface for persistent AI coworkers.
 *
 * Each crew member is a long-lived AI coworker with its own computer that the
 * user manages and chats with from inside Infinity AI Control mode.
 *
 * The controller never runs the agent loop: `chat` starts a run and returns
 * immediately; progress arrives over the SSE `events` stream.
 */

const TERMINAL_EVENT_TYPES = new Set(['done', 'error', 'stopped', 'waiting']);
const HEARTBEAT_MS = 20_000;

function badRequest(response, message, code = 'INVALID_REQUEST') {
  return response.status(400).json({ error: { code, message } });
}

function notFound(response, message = 'Crew not found') {
  return response.status(404).json({ error: message });
}

// CrewService raises plain Errors for its own validation (length limits,
// unknown tool names). Those are client mistakes, not server bugs — surface
// them as 400 instead of letting them fall through to the 500 handler.
function isServiceValidationError(error) {
  const message = String(error?.message || '');
  return /required|must be|unknown tool|invalid/i.test(message);
}

function validateCrewPayload(body) {
  const errors = [];
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    errors.push('name must be a non-empty string');
  }
  if (body.role !== undefined && (typeof body.role !== 'string' || !body.role.trim())) {
    errors.push('role must be a non-empty string');
  }
  if (body.instructions !== undefined && typeof body.instructions !== 'string') {
    errors.push('instructions must be a string');
  }
  if (body.toolsAllowed !== undefined) {
    if (!Array.isArray(body.toolsAllowed) || body.toolsAllowed.some((t) => typeof t !== 'string')) {
      errors.push('toolsAllowed must be an array of strings');
    }
  }
  return errors;
}

export function createCrewController({ crewService, crewWorker }) {
  // Latest run per crew — updated by chat(). Used to resolve which run an
  // SSE stream or stop request refers to when the caller only knows the crew.
  const latestRunByCrew = new Map();

  async function latestRunForCrew(crewId) {
    if (typeof crewWorker.latestRunForCrew === 'function') {
      return crewWorker.latestRunForCrew(crewId);
    }
    const runId = latestRunByCrew.get(crewId);
    if (!runId) return null;
    try {
      return await crewWorker.getRun(runId);
    } catch {
      return null;
    }
  }

  async function resolveRunId(crewId, bodyRunId) {
    if (bodyRunId) return bodyRunId;
    const run = await latestRunForCrew(crewId);
    return run?.runId || run?.id || null;
  }

  return {
    /** POST /api/v1/crew — create a persistent AI coworker */
    create: asyncHandler(async (request, response) => {
      const body = request.body || {};
      const { name, role, instructions, toolsAllowed } = body;
      if (!name || !String(name).trim()) return badRequest(response, 'name is required', 'MISSING_NAME');
      if (!role || !String(role).trim()) return badRequest(response, 'role is required', 'MISSING_ROLE');

      const errors = validateCrewPayload(body);
      if (errors.length) return badRequest(response, errors.join('; '), 'INVALID_CREW');

      let crew;
      try {
        crew = await crewService.create({
          name: String(name).trim(),
          role: String(role).trim(),
          instructions: instructions == null ? '' : String(instructions),
          toolsAllowed: Array.isArray(toolsAllowed) ? toolsAllowed : []
        });
      } catch (error) {
        if (isServiceValidationError(error)) {
          return badRequest(response, error.message, 'INVALID_CREW');
        }
        throw error;
      }
      return response.status(201).json({ crew });
    }),

    /** GET /api/v1/crew — list all coworkers */
    list: asyncHandler(async (_request, response) => {
      const crews = await crewService.list();
      response.json({ crews });
    }),

    /** GET /api/v1/crew/:id — one coworker */
    get: asyncHandler(async (request, response) => {
      const crew = await crewService.get(request.params.id);
      if (!crew) return notFound(response);
      response.json({ crew });
    }),

    /** PATCH /api/v1/crew/:id — rename / re-role / re-instruct a coworker */
    update: asyncHandler(async (request, response) => {
      const body = request.body || {};
      const errors = validateCrewPayload(body);
      if (errors.length) return badRequest(response, errors.join('; '), 'INVALID_CREW');

      const patch = {};
      if (body.name !== undefined) patch.name = String(body.name).trim();
      if (body.role !== undefined) patch.role = String(body.role).trim();
      if (body.instructions !== undefined) patch.instructions = String(body.instructions);
      if (body.toolsAllowed !== undefined) patch.toolsAllowed = body.toolsAllowed;

      let crew;
      try {
        crew = await crewService.update(request.params.id, patch);
      } catch (error) {
        if (isServiceValidationError(error)) {
          return badRequest(response, error.message, 'INVALID_CREW');
        }
        throw error;
      }
      if (!crew) return notFound(response);
      response.json({ crew });
    }),

    /** DELETE /api/v1/crew/:id — remove a coworker */
    remove: asyncHandler(async (request, response) => {
      const deleted = await crewService.remove(request.params.id);
      if (!deleted) return notFound(response);
      response.json({ ok: true });
    }),

    /** POST /api/v1/crew/:id/chat — send a message; starts a background run */
    chat: asyncHandler(async (request, response) => {
      const crew = await crewService.get(request.params.id);
      if (!crew) return notFound(response);

      const message = request.body?.message;
      if (!message || !String(message).trim()) {
        return badRequest(response, 'message is required', 'MISSING_MESSAGE');
      }

      const { runId, status } = await crewWorker.startRun({
        crewId: request.params.id,
        userId: request.user.id, // server-derived identity, never trusted from the body
        message: String(message)
      });
      latestRunByCrew.set(request.params.id, runId);
      response.json({ runId, status });
    }),

    /** GET /api/v1/crew/:id/events — SSE stream of the crew's latest run */
    events: asyncHandler(async (request, response) => {
      const crew = await crewService.get(request.params.id);
      if (!crew) return notFound(response);

      const run = await latestRunForCrew(request.params.id);
      if (!run) {
        return response.status(404).json({
          error: { code: 'NO_RUN', message: 'No run for this crew yet — send a chat message first' }
        });
      }
      const runId = run.runId || run.id;

      response.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      response.flushHeaders?.();

      const send = (event) => {
        response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      let finished = false;
      let unsubscribe = () => {};
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), HEARTBEAT_MS);
      const finish = () => {
        if (finished) return;
        finished = true;
        clearInterval(heartbeat);
        try { unsubscribe(); } catch { /* already gone */ }
        response.end();
      };
      request.on('close', finish);

      // 1. Replay what happened while the browser was closed.
      const stored = await crewWorker.getEvents(runId);
      (Array.isArray(stored) ? stored : []).forEach((event) => {
        if (!finished) send(event);
      });

      // 2. If the run already reached a terminal state, close after replay.
      const state = await crewWorker.getRun(runId).catch(() => null);
      const status = state?.status || run?.status;
      if (TERMINAL_EVENT_TYPES.has(status) || stored.some((e) => TERMINAL_EVENT_TYPES.has(e.type))) {
        finish();
        return;
      }

      // 3. Otherwise attach live and end the stream on the terminal event.
      unsubscribe = crewWorker.subscribe(runId, (event) => {
        if (finished) return;
        send(event);
        if (TERMINAL_EVENT_TYPES.has(event.type)) {
          // Give the transport a tick to flush before closing.
          setImmediate(finish);
        }
      });
    }),

    /** POST /api/v1/crew/:id/stop — stop the crew's latest run */
    stop: asyncHandler(async (request, response) => {
      const crew = await crewService.get(request.params.id);
      if (!crew) return notFound(response);

      const runId = await resolveRunId(request.params.id, request.body?.runId);
      if (!runId) {
        return response.status(404).json({
          error: { code: 'NO_RUN', message: 'No run to stop for this crew' }
        });
      }
      await crewWorker.stopRun(runId);
      response.json({ ok: true });
    })
  };
}
