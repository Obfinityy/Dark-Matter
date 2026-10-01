import { asyncHandler } from '../core/utils.js';

/**
 * Alert Controller — the notification center.
 *
 * Alerts are created by the AlertService when things the user asked about
 * happen: a CRITICAL finding lands, a hunt completes, a scheduled hunt
 * starts. These endpoints are purely read/mark — creation is internal.
 */
export function createAlertController({ alertService }) {
  return {
    /** GET /api/v1/alerts — newest first, optional ?unreadOnly=true */
    list: asyncHandler(async (request, response) => {
      const alerts = await alertService.list(request.user.id, {
        unreadOnly: request.query.unreadOnly === 'true',
        limit: Math.min(Math.max(Number(request.query.limit) || 50, 1), 200)
      });
      response.json({ alerts });
    }),

    /** POST /api/v1/alerts/:id/read — mark one alert read */
    markRead: asyncHandler(async (request, response) => {
      const alert = await alertService.markRead(request.user.id, request.params.id);
      if (!alert) {
        return response.status(404).json({
          error: { code: 'ALERT_NOT_FOUND', message: 'No alert with that id.' }
        });
      }
      response.json({ alert });
    }),

    /** POST /api/v1/alerts/read-all — mark every alert read */
    markAllRead: asyncHandler(async (request, response) => {
      const result = await alertService.markAllRead(request.user.id);
      response.json(result);
    })
  };
}
