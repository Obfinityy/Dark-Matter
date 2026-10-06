import { asyncHandler } from '../core/utils.js';
import { streamReportPdf } from '../services/reportPdfService.js';

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
    }),

    /** GET /api/v1/assessments/:id/report.md — HackerOne-style industry markdown report
     * Query params (flexible, as the user asks):
     *   ?severities=high,critical  — only these severities ("sirf high wali do")
     *   ?perFinding=true           — one standalone report per vulnerability
     *   ?findingId=xxx             — report for a single finding only
     */
    markdown: asyncHandler(async (request, response) => {
      await assessmentService.get(request.user.id, request.params.id); // ownership check
      const options = {};
      if (request.query.severities) {
        options.severities = String(request.query.severities).split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (request.query.perFinding === 'true') options.perFinding = true;
      if (request.query.findingId) options.findingId = String(request.query.findingId);
      const result = await reportService.generateMarkdown(request.user.id, request.params.id, options);
      if (result.perFinding) {
        return response.json(result);
      }
      response.type('text/markdown').send(result.markdown);
    }),

    /** GET /api/v1/assessments/:id/report.pdf — styled PDF download */
    pdf: asyncHandler(async (request, response) => {
      await assessmentService.get(request.user.id, request.params.id); // ownership check
      const report = await reportService.getLatest(request.params.id);
      if (!report) return response.status(404).json({ error: { code: 'NO_REPORT', message: 'No report has been generated for this assessment yet.' } });
      const filename = `infinity-ai-report-${String(request.params.id).slice(0, 12)}.pdf`;
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      streamReportPdf(report, response);
    })
  };
}
