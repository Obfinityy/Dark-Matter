/**
 * continuousHuntController — Express route handlers for the continuous
 * autonomous hunt loop (issue #298).
 *
 * Endpoints (all read the persisted loop state; only pause/resume/force-stop
 * mutate the machine):
 *
 *   POST /api/v1/hunts/:id/report-snapshot — build a PDF from CURRENT
 *     findings via LiveReport.toPdfInput() + pdfReportWriter.buildReportPdf.
 *     READ-ONLY: never touches loop state, never pauses the loop.
 *   GET  /api/v1/hunts/:id/tally          — current severity tally
 *   POST /api/v1/hunts/:id/pause          — PAUSE the loop (frozen ticks)
 *   POST /api/v1/hunts/:id/resume         — RESUME the loop
 *   POST /api/v1/hunts/:id/force-stop     — FORCE_STOP (terminal), requires
 *     body { confirmed: true } — explicit user intent only
 *
 * Loops are held in a module-level registry (live loops) and restored from
 * disk via ContinuousHuntLoop.load() when the process restarted. Loops are
 * registered by whatever starts them (see registerLoop).
 */

import { asyncHandler } from '../core/utils.js';
import { ContinuousHuntLoop } from '../hunt/continuousHuntLoop.js';
import { LiveReport } from '../hunt/liveReport.js';
import { buildReportPdf } from '../services/pdfReportWriter.js';
import { tallyFor } from '../services/vulnTallyService.js';

/** Live loops, keyed by huntId. Survives across requests in-process. */
const LIVE_LOOPS = new Map();

/** Attach a running loop so the controller can serve it. Returns the loop. */
export function registerLoop(loop) {
  if (!loop || !loop.huntId) throw new Error('registerLoop requires a ContinuousHuntLoop');
  LIVE_LOOPS.set(loop.huntId, loop);
  return loop;
}

/** Drop a loop from the registry (e.g. after force-stop cleanup). */
export function unregisterLoop(huntId) {
  return LIVE_LOOPS.delete(String(huntId));
}

export function createContinuousHuntController({ dataDir, logger = console } = {}) {
  async function getLoop(huntId) {
    const id = String(huntId || '');
    let loop = LIVE_LOOPS.get(id);
    if (!loop) {
      const exists = await ContinuousHuntLoop.exists(id, dataDir);
      if (!exists) return null;
      loop = await ContinuousHuntLoop.load({ huntId: id, deps: { dataDir }, logger });
      LIVE_LOOPS.set(id, loop);
    }
    return loop;
  }

  function notFound(response, huntId) {
    return response.status(404).json({
      error: {
        code: 'LOOP_NOT_FOUND',
        message: `No continuous-hunt loop for hunt ${huntId}.`,
      },
    });
  }

  return {
    /**
     * POST /api/v1/hunts/:id/report-snapshot — PDF from current findings.
     * Read-only: loads persisted state, builds the PDF in memory, and never
     * mutates the loop (the loop keeps ticking afterwards).
     */
    reportSnapshot: asyncHandler(async (request, response) => {
      const huntId = String(request.params.id || '');
      const loop = await getLoop(huntId);
      if (!loop) return notFound(response, huntId);

      // Read-only inputs: the live report file (written incrementally by the
      // hunt) plus the loop's own persisted findings as fallback.
      let pdfInput;
      try {
        const report = await LiveReport.load({ huntId, dataDir, logger });
        pdfInput = report.toPdfInput();
      } catch {
        pdfInput = null;
      }
      if (!pdfInput || !(pdfInput.findings || []).length) {
        const state = loop.state;
        const findings = (state?.findings || []).map(f => ({
          title: f.title,
          severity: f.severity,
          description: f.description,
          evidence: f.evidence ? [f.evidence] : [],
          remediation: f.remediation ? [f.remediation] : [],
          impact: `Severity: ${f.severity}. Angle: ${f.angle || 'n/a'}.`,
        }));
        pdfInput = {
          title: `Infinity AI Security Assessment — ${state?.target || huntId}`,
          target: state?.target || huntId,
          generatedAt: new Date().toISOString(),
          summary: tallyFor(state?.findings || []),
          executiveSummary:
            `Snapshot of the continuous hunt on ${state?.target || huntId} ` +
            `(loop state: ${state?.state || 'unknown'}, tick ${state?.tick ?? 0}). ` +
            `${findings.length} finding(s) recorded so far. The hunt is still running.`,
          findings,
          recommendedFixes: [],
          stages: [],
        };
      }
      pdfInput.title = `[Snapshot] ${pdfInput.title || 'Hunt report'}`;

      const bytes = buildReportPdf(pdfInput);
      const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader(
        'Content-Disposition',
        `inline; filename="hunt-${huntId}-snapshot.pdf"`
      );
      response.setHeader('Content-Length', String(buf.length));
      return response.send(buf);
    }),

    /** GET /api/v1/hunts/:id/tally — current severity tally. */
    tally: asyncHandler(async (request, response) => {
      const huntId = String(request.params.id || '');
      const loop = await getLoop(huntId);
      if (!loop) return notFound(response, huntId);
      const snap = loop.snapshot();
      return response.json({
        ok: true,
        huntId,
        tally: snap.tally,
        state: snap.state,
        tick: snap.tick,
        findings: snap.findings,
      });
    }),

    /** POST /api/v1/hunts/:id/pause */
    pause: asyncHandler(async (request, response) => {
      const huntId = String(request.params.id || '');
      const loop = await getLoop(huntId);
      if (!loop) return notFound(response, huntId);
      const result = await loop.pause();
      return response.json({ ok: true, huntId, ...result });
    }),

    /** POST /api/v1/hunts/:id/resume */
    resume: asyncHandler(async (request, response) => {
      const huntId = String(request.params.id || '');
      const loop = await getLoop(huntId);
      if (!loop) return notFound(response, huntId);
      const result = await loop.resume();
      return response.json({ ok: true, huntId, ...result });
    }),

    /**
     * POST /api/v1/hunts/:id/force-stop — the ONLY terminal transition.
     * Requires explicit user intent: body { confirmed: true }.
     */
    forceStop: asyncHandler(async (request, response) => {
      const huntId = String(request.params.id || '');
      const loop = await getLoop(huntId);
      if (!loop) return notFound(response, huntId);
      if (request.body?.confirmed !== true) {
        return response.status(400).json({
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message:
              'Force-stop is terminal. Pass { "confirmed": true } to confirm you want to stop this hunt permanently.',
          },
        });
      }
      const result = await loop.forceStop({ confirmed: true });
      return response.json({ ok: true, huntId, ...result });
    }),
  };
}

export default { createContinuousHuntController, registerLoop, unregisterLoop };
