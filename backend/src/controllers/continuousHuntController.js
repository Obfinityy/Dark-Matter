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
import { startHunt, getLiveLoop, subscribeBus, answerChat } from '../hunt/continuousHuntManager.js';

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

export function createContinuousHuntController({ dataDir, logger = console, brainDeps = {} } = {}) {
  async function getLoop(huntId) {
    const id = String(huntId || '');
    // Serving order matters. (1) Explicitly registered loops first — this is
    // the real running loop wired by startHunt (and by tests). (2) The
    // manager's LIVE registry — the single source of truth for running hunts
    // with their tick driver. (3) Disk restore only when no live loop exists.
    // Never serve a stale disk copy while a live loop exists: pause/resume/
    // force-stop/tally must act on the real loop, not a phantom.
    let loop = LIVE_LOOPS.get(id) || (await getLiveLoop(id, { dataDir, logger }));
    if (!loop) {
      const exists = await ContinuousHuntLoop.exists(id, dataDir);
      if (!exists) return null;
      loop = await ContinuousHuntLoop.load({ huntId: id, deps: { dataDir }, logger });
    }
    LIVE_LOOPS.set(id, loop);
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

    /**
     * POST /api/v1/hunts — start a continuous hunt.
     * Body: { target | targetUrl, authorizationConfirmed, executor? }.
     * The loop starts immediately and never stops on its own.
     */
    create: asyncHandler(async (request, response) => {
      const target = String(request.body?.target || request.body?.targetUrl || '').trim();
      if (!target) {
        return response.status(400).json({
          error: { code: 'MISSING_TARGET', message: 'A target link is required to start a hunt.' },
        });
      }
      if (request.body?.authorizationConfirmed !== true) {
        return response.status(400).json({
          error: {
            code: 'AUTHORIZATION_REQUIRED',
            message: 'Confirm you are authorized to test this target (authorizationConfirmed: true).',
          },
        });
      }
      try {
        const { huntId, loop } = await startHunt({
          target,
          executor: request.body?.executor || 'local',
          deps: { dataDir },
          logger,
        });
        const snap = loop.snapshot();
        return response.status(201).json({
          ok: true,
          huntId,
          hunt: {
            id: huntId,
            target,
            status: 'running',
            loopState: snap.state,
            tick: snap.tick,
            tally: snap.tally,
          },
        });
      } catch (error) {
        return response.status(400).json({
          error: { code: 'HUNT_START_FAILED', message: String(error?.message || error) },
        });
      }
    }),

    /**
     * GET /api/v1/hunts/:id/events — SSE stream. Replays recent history
     * (tally, findings, think-aloud) then attaches live. Closing this stream
     * NEVER stops the hunt.
     */
    events: asyncHandler(async (request, response) => {
      const huntId = String(request.params.id || '');
      const loop = (await getLiveLoop(huntId, { dataDir, logger })) || (await getLoop(huntId));
      if (!loop) return notFound(response, huntId);

      response.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders?.();

      const send = event => {
        response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      };

      // 1. Replay: current tally + recent findings + recent think-aloud.
      const snap = loop.snapshot();
      send({
        id: `replay-tally-${Date.now()}`,
        type: 'vuln_tally',
        message: 'Current tally',
        data: snap.tally,
        ts: new Date().toISOString(),
      });
      for (const f of (snap.findings || []).slice(-20)) {
        send({
          id: `replay-finding-${f.id || Math.random()}`,
          type: 'finding.created',
          message: `[${String(f.severity || 'info').toUpperCase()}] ${f.title}`,
          data: f,
          ts: f.ts || new Date().toISOString(),
        });
      }
      for (const t of (snap.trace || []).slice(-30)) {
        send({
          id: `replay-trace-${t.ts}-${t.tick}`,
          type: 'think.trace',
          message: String(t.text).slice(0, 280),
          data: t,
          ts: t.ts,
        });
      }

      // 2. Attach live.
      const unsubscribe = subscribeBus(huntId, send);
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15_000);
      request.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        // Closing this stream NEVER stops the hunt. Only force-stop does.
      });
    }),

    /**
     * POST /api/v1/hunts/:id/chat — mid-hunt chat, answered by the HACKING
     * brain with live loop context. Read-only w.r.t. the loop: the hunt
     * keeps running. When the brain is unreachable the reply is the honest
     * unavailable message — never a template.
     */
    chat: asyncHandler(async (request, response) => {
      const huntId = String(request.params.id || '');
      const message = String(request.body?.message || '').trim();
      if (!message) {
        return response.status(400).json({
          error: { code: 'MISSING_MESSAGE', message: 'message is required' },
        });
      }
      try {
        const result = await answerChat(huntId, message, {
          dataDir,
          logger,
          userId: request.user?.id || null,
          brainDeps,
        });
        return response.json(result);
      } catch (error) {
        return response.status(404).json({
          error: { code: 'CHAT_FAILED', message: String(error?.message || error) },
        });
      }
    }),
  };
}

export default { createContinuousHuntController, registerLoop, unregisterLoop };
