import { asyncHandler } from '../core/utils.js';
import { assert } from '../core/errors.js';

/**
 * Schedule Controller — scheduled hunts with alerts.
 *
 * The user sets a target + cadence once; the HuntScheduler's tick fires due
 * schedules and the alert service announces each firing. Creating a schedule
 * requires the same authorization confirmation as starting a hunt — the
 * scheduled hunts inherit it.
 */
export function createScheduleController({ huntScheduler, huntScheduleModel }) {
  return {
    /** POST /api/v1/schedules { name, target, scope?, objective?, cadence, authorizationConfirmed } */
    create: asyncHandler(async (request, response) => {
      const input = request.body || {};
      assert(
        input.authorizationConfirmed === true,
        400,
        'Confirm that you are authorized to test this target before scheduling hunts.',
        'AUTHORIZATION_REQUIRED'
      );
      assert(
        typeof input.target === 'string' && input.target.trim().length > 0,
        400,
        'A target URL is required.',
        'MISSING_TARGET'
      );
      try {
        const schedule = await huntScheduler.schedule({
          userId: request.user.id,
          name: input.name,
          target: input.target.trim(),
          scope: input.scope || null,
          objective: input.objective || null,
          cadence: input.cadence || 'weekly',
          nextRunAt: input.nextRunAt || null,
        });
        response.status(201).json({ schedule });
      } catch (error) {
        response.status(400).json({
          error: { code: 'INVALID_SCHEDULE', message: error.message },
        });
      }
    }),

    /** GET /api/v1/schedules — the caller's schedules */
    list: asyncHandler(async (request, response) => {
      response.json({ schedules: await huntScheduleModel.list(request.user.id) });
    }),

    /** PATCH /api/v1/schedules/:id { enabled?, cadence?, nextRunAt? } */
    update: asyncHandler(async (request, response) => {
      const input = request.body || {};
      const patch = {};
      if (typeof input.enabled === 'boolean') patch.enabled = input.enabled;
      if (typeof input.cadence === 'string') patch.cadence = input.cadence;
      if (typeof input.nextRunAt === 'string') patch.nextRunAt = input.nextRunAt;
      if (typeof input.name === 'string') patch.name = input.name.slice(0, 120);
      const schedule = await huntScheduleModel.update(request.user.id, request.params.id, patch);
      if (!schedule) {
        return response.status(404).json({
          error: { code: 'SCHEDULE_NOT_FOUND', message: 'No schedule with that id.' },
        });
      }
      response.json({ schedule });
    }),

    /** DELETE /api/v1/schedules/:id */
    remove: asyncHandler(async (request, response) => {
      const removed = await huntScheduleModel.remove(request.user.id, request.params.id);
      if (!removed) {
        return response.status(404).json({
          error: { code: 'SCHEDULE_NOT_FOUND', message: 'No schedule with that id.' },
        });
      }
      response.status(204).send();
    }),
  };
}
