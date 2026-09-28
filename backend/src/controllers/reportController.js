import { asyncHandler } from '../core/utils.js';

/**
 * Report Controller — REST endpoints for report generation and retrieval.
 */
export function createReportController(reportService, assessmentService) {
  return {
    /** POST /api/v1/assessments/:id/report — generate a new report version */
    generate: asyncHandler(async (request, response) => {
      await assessmentService.get(request.user.id, request.params.id); // ownership check
      const report = await reportService.generate(request.user.id, request.params.id);
      response.status(201).json(report);
    }),

    /** GET /api/v1/assessments/:id/report — get latest report */
    getLatest: asyncHandler(async (request, response) => {
      await assessmentService.get(request.user.id, request.params.id); // ownership check
      const report = await reportService.getLatest(request.params.id);
      if (!report) return response.status(404).json({ error: { code: 'NO_REPORT', message: 'No report has been generated for this assessment yet.' } });
      response.json(report);
    }),

    /** GET /api/v1/assessments/:id/reports — list all report versions */
    listVersions: asyncHandler(async (request, response) => {
      await assessmentService.get(request.user.id, request.params.id); // ownership check
      const reports = await reportService.list(request.params.id);
      response.json({ reports });
    }),

    /** GET /api/v1/reports — list all reports for the user */
    listAll: asyncHandler(async (request, response) => {
      const reports = await reportService.listByUser(request.user.id);
      response.json({ reports });
    })
  };
}
