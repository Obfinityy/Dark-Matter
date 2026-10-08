/**
 * huntRecordController — Express route handlers for hunt Record.
 * Factory that wires the hunt Record service into REST endpoints.
 * Part of: Infinity AI / Dark-Matter backend (HTTP API controllers).
 */

import { asyncHandler } from '../core/utils.js';
import { generateSafePoc, generateRepro } from '../agent/exploitEngine.js';

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
          error: { code: 'HUNT_RECORD_NOT_FOUND', message: 'No hunt record with that id.' },
        });
      }
      response.json({ huntRecord: record });
    }),

    /** GET /api/v1/hunt-records/:id/report.md — download the final report as Markdown */
    downloadMarkdown: asyncHandler(async (request, response) => {
      const record = await huntRecordModel.findFullById(request.user.id, request.params.id);
      if (!record) {
        return response.status(404).json({
          error: { code: 'HUNT_RECORD_NOT_FOUND', message: 'No hunt record with that id.' },
        });
      }
      const filename = `hunt-report-${
        record.targetCanonical
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60) || 'target'
      }-v${record.version}.md`;
      response.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      response.send(record.reportMarkdown || '');
    }),

    /**
     * GET /api/v1/hunt-records/:id/findings/:findingId/poc — download the
     * proof-only PoC artifact for one archived finding. The PoC is generated
     * on demand from the stored finding (never stored exploit code) and must
     * pass the safety guardrail or the request fails with 422.
     */
    downloadPoc: asyncHandler(async (request, response) => {
      const record = await huntRecordModel.findFullById(request.user.id, request.params.id);
      if (!record) {
        return response.status(404).json({
          error: { code: 'HUNT_RECORD_NOT_FOUND', message: 'No hunt record with that id.' },
        });
      }
      const finding = (record.findings || []).find(f => f.id === request.params.findingId);
      if (!finding) {
        return response.status(404).json({
          error: { code: 'FINDING_NOT_FOUND', message: 'No finding with that id in this report.' },
        });
      }
      let poc;
      try {
        poc = generateSafePoc(finding);
      } catch (err) {
        return response.status(422).json({
          error: { code: 'POC_SAFETY_BLOCKED', message: err.message },
        });
      }
      if (!poc) {
        return response.status(404).json({
          error: {
            code: 'NO_POC_TEMPLATE',
            message: `No PoC template covers finding type "${finding.type || finding.vulnType}".`,
          },
        });
      }
      const ext = { html: 'html', python: 'py', bash: 'sh' }[poc.language] || 'txt';
      const filename = `poc-${String(finding.id)
        .replace(/[^a-z0-9]+/gi, '-')
        .slice(0, 40)}.${ext}`;
      const kind = String(request.query.kind || 'poc');
      const body =
        kind === 'repro'
          ? generateRepro(finding)?.[request.query.format === 'python' ? 'python' : 'curl'] ||
            'No reproducible snippet available for this finding.'
          : poc.code;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      response.setHeader('X-PoC-Safety', 'checked-proof-only');
      response.send(body);
    }),
  };
}
