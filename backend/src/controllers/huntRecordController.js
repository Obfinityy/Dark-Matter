import { asyncHandler } from '../core/utils.js';

/**
 * Hunt Record Controller — the report-history browser.
 *
 * Hunt records are the persistent-artifact side of the hybrid storage design:
 * every completed hunt's final report lives in the database (hunt_records),
 * versioned per target. These endpoints let users browse and re-download any
 * past report without re-running the agent.
 */
export function createHuntRecordController({ huntRecordModel }) {
  return {
    /** GET /api/v1/hunt-records — the caller's report history, newest first */
    list: asyncHandler(async (request, response) => {
      const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 200);
      const records = await huntRecordModel.listByUser(request.user.id, { limit });
      response.json({ huntRecords: records });
    }),

    /** GET /api/v1/hunt-records/:id — one record WITH its full report markdown */
    get: asyncHandler(async (request, response) => {
      const record = await huntRecordModel.findFullById(request.user.id, request.params.id);
      if (!record) {
        return response.status(404).json({
          error: { code: 'HUNT_RECORD_NOT_FOUND', message: 'No hunt record with that id.' }
        });
      }
      response.json({ huntRecord: record });
    }),

    /** GET /api/v1/hunt-records/:id/report.md — download the final report as Markdown */
    downloadMarkdown: asyncHandler(async (request, response) => {
      const record = await huntRecordModel.findFullById(request.user.id, request.params.id);
      if (!record) {
        return response.status(404).json({
          error: { code: 'HUNT_RECORD_NOT_FOUND', message: 'No hunt record with that id.' }
        });
      }
      const filename = `hunt-report-${record.targetCanonical.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'target'}-v${record.version}.md`;
      response.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      response.send(record.reportMarkdown || '');
    })
  };
}
