import { asyncHandler } from '../core/utils.js';

/**
 * Payload Library Controller — the self-learning payload library.
 *
 * Every payload the agent tries is recorded with its outcome; successes rise
 * to the top of future suggestions. Read-only from the API (the agent writes
 * it during hunts) — the "Libraries" section of the UI reads these endpoints.
 */
export function createPayloadLibraryController({ payloadLibraryModel }) {
  return {
    /** GET /api/v1/payload-library?technique=&category=&limit= — top payloads */
    list: asyncHandler(async (request, response) => {
      const payloads = await payloadLibraryModel.suggest({
        technique: request.query.technique || null,
        category: request.query.category || null,
        limit: Math.min(Math.max(Number(request.query.limit) || 20, 1), 100)
      });
      response.json({ payloads });
    }),

    /** GET /api/v1/payload-library/stats — learning stats */
    stats: asyncHandler(async (request, response) => {
      response.json({ stats: await payloadLibraryModel.stats() });
    })
  };
}
