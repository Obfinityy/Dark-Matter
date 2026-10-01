import { asyncHandler } from '../core/utils.js';
import { assert } from '../core/errors.js';

/**
 * Queue Controller — the multi-target queue.
 *
 * A queue is an ordered list of targets the agent hunts one after another
 * (each hunt still goes through the fair worker pool). Creating a queue
 * requires the same authorization confirmation as starting a hunt — the
 * queue inherits it when its hunts fire.
 */
export function createQueueController({ targetQueueService, targetQueueModel }) {
  return {
    /** POST /api/v1/queues { name, targets: [url...], authorizationConfirmed } */
    create: asyncHandler(async (request, response) => {
      const input = request.body || {};
      assert(input.authorizationConfirmed === true, 400,
        'Confirm that you are authorized to test these targets before queueing them.',
        'AUTHORIZATION_REQUIRED');
      const queue = await targetQueueService.createQueue({
        userId: request.user.id,
        name: input.name,
        targets: input.targets
      });
      response.status(201).json({ queue });
    }),

    /** GET /api/v1/queues — the caller's queues, newest first */
    list: asyncHandler(async (request, response) => {
      response.json({ queues: await targetQueueModel.list(request.user.id) });
    }),

    /** GET /api/v1/queues/:id — one queue with per-target status */
    get: asyncHandler(async (request, response) => {
      const queue = await targetQueueModel.get(request.user.id, request.params.id);
      if (!queue) {
        return response.status(404).json({
          error: { code: 'QUEUE_NOT_FOUND', message: 'No queue with that id.' }
        });
      }
      response.json({ queue });
    }),

    /** POST /api/v1/queues/:id/pause */
    pause: asyncHandler(async (request, response) => {
      response.json({ queue: await targetQueueService.pause(request.user.id, request.params.id) });
    }),

    /** POST /api/v1/queues/:id/resume */
    resume: asyncHandler(async (request, response) => {
      response.json({ queue: await targetQueueService.resume(request.user.id, request.params.id) });
    }),

    /** DELETE /api/v1/queues/:id — remove the queue (running hunts keep going) */
    remove: asyncHandler(async (request, response) => {
      const removed = await targetQueueModel.remove(request.user.id, request.params.id);
      if (!removed) {
        return response.status(404).json({
          error: { code: 'QUEUE_NOT_FOUND', message: 'No queue with that id.' }
        });
      }
      response.status(204).send();
    })
  };
}
