/**
 * payloadLibraryController — Express route handlers for payload Library.
 * Factory that wires the payload Library services into REST endpoints.
 * Part of: Infinity AI / Dark-Matter backend (HTTP API controllers).
 */

import { asyncHandler } from '../core/utils.js';
import { normalizeSlug } from '../services/payloadLibraryService.js';

/**
 * Payload Library Controller — two complementary libraries behind one API:
 *
 * 1. The self-learning payload library (payloadLibraryModel): every payload
 *    the agent tries is recorded with its outcome; successes rise to the top
 *    of future suggestions. Read-only from the API (the agent writes it
 *    during hunts).
 * 2. The curated Payload Library dataset (payloadLibraryService): 1,400+
 *    payloads across 22 vulnerability classes, derived from the MIT-licensed
 *    PayloadsAllTheThings corpus (see THIRD_PARTY_NOTICES.md). Pure data —
 *    the backend never fires these at any target by itself.
 */
export function createPayloadLibraryController({ payloadLibraryModel, payloadLibraryService }) {
  return {
    /** GET /api/v1/payload-library?technique=&category=&limit= — top learned payloads */
    list: asyncHandler(async (request, response) => {
      const payloads = await payloadLibraryModel.suggest({
        technique: request.query.technique || null,
        category: request.query.category || null,
        limit: Math.min(Math.max(Number(request.query.limit) || 20, 1), 100),
      });
      response.json({ payloads });
    }),

    /** GET /api/v1/payload-library/stats — learning stats + dataset stats */
    stats: asyncHandler(async (request, response) => {
      const stats = await payloadLibraryModel.stats();
      const library = payloadLibraryService ? await payloadLibraryService.getStats() : null;
      response.json({ stats, library });
    }),

    /** GET /api/v1/payload-library/categories — dataset categories + counts */
    categories: asyncHandler(async (request, response) => {
      const categories = await payloadLibraryService.listCategories();
      response.json({ categories });
    }),

    /** GET /api/v1/payload-library/search?q=&limit= — full-text dataset search */
    search: asyncHandler(async (request, response) => {
      const query = String(request.query.q || '').slice(0, 200);
      if (!query.trim()) {
        response.status(400).json({ error: { code: 'QUERY_REQUIRED', message: 'Query parameter "q" is required.' } });
        return;
      }
      const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 200);
      response.json(await payloadLibraryService.searchPayloads(query, { limit }));
    }),

    /** GET /api/v1/payload-library/:category?limit=&offset= — paged dataset payloads */
    catalog: asyncHandler(async (request, response) => {
      const category = normalizeSlug(request.params.category);
      const categories = await payloadLibraryService.listCategories();
      if (!categories.some(c => c.slug === category)) {
        response.status(404).json({
          error: { code: 'UNKNOWN_CATEGORY', message: `Unknown payload category "${request.params.category}".` },
          categories: categories.map(c => c.slug),
        });
        return;
      }
      const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 500);
      const offset = Math.max(Number(request.query.offset) || 0, 0);
      response.json(await payloadLibraryService.getPayloads(category, { limit, offset }));
    }),
  };
}
