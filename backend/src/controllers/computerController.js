import { asyncHandler } from '../core/utils.js';
import { ACTION_TYPES } from '../computer/actionSchema.js';
import { ScopeEngine } from '../agent/scopeEngine.js';

/**
 * Computer Controller — manual/observational access to the "hands" layer.
 *
 * The autonomous agent drives the computer through the worker; these endpoints
 * let the human inspect the runtime, take a screenshot, and (optionally) issue a
 * single validated action. User authorization is always enforced here: a
 * scope-bearing action must belong to an assessment the caller owns.
 */
export function createComputerController({ computerAdapter, assessmentModel }) {
  /** Build a scope engine from the caller's most recent authorization. */
  async function scopeFor(userId, assessmentId) {
    if (!assessmentId) return null;
    const assessment = await assessmentModel.collection.findOne({ id: assessmentId, userId });
    if (!assessment) return null;
    return new ScopeEngine(assessment.scope, assessment.targetHostname);
  }

  return {
    /** GET /api/v1/computer — runtime status */
    status: asyncHandler(async (request, response) => {
      response.json({
        enabled: computerAdapter.enabled,
        bridgePath: computerAdapter.bridgePath,
        whitelist: ACTION_TYPES,
        runtime: computerAdapter.status()
      });
    }),

    /** GET /api/v1/computer/capabilities — `--probe` result (no daemon started) */
    capabilities: asyncHandler(async (request, response) => {
      const probe = computerAdapter.probe();
      response.json({
        ...probe,
        // Credentials and phone settings must never reach the browser (#74).
        actions: probe.capabilities?.actions || ACTION_TYPES
      });
    }),

    /**
     * POST /api/v1/computer/screenshot
     *
     * TODO (future): Remote screen viewing — when the backend runs on a
     * remote server (not localhost), screenshots come from the SERVER's
     * display, which is meaningless to the user. Later: implement a local
     * agent on the user's machine that streams its screen to the hosted
     * backend, or a paired local viewer. The frontend LiveScreenViewer
     * already gates itself to localhost mode until then.
     */
    screenshot: asyncHandler(async (request, response) => {
      const result = await computerAdapter.getScreen(request.body?.channel || null);
      if (!result.ok) {
        return response.status(result.error?.kind === 'unavailable' ? 503 : 502).json({
          ok: false,
          error: result.error
        });
      }
      response.json({
        ok: true,
        observation: result.observation,
        // The caller decides whether to persist the base64 blob as evidence.
        base64: request.body?.includeBase64 === true ? result.output.base64 || null : undefined
      });
    }),

    /** GET /api/v1/computer/active-window */
    activeWindow: asyncHandler(async (request, response) => {
      const result = await computerAdapter.getActiveWindow();
      response.status(result.ok ? 200 : 503).json({ ok: result.ok, observation: result.observation, error: result.error });
    }),

    /** GET /api/v1/computer/browser-state */
    browserState: asyncHandler(async (request, response) => {
      const result = await computerAdapter.getBrowserState();
      response.status(result.ok ? 200 : 503).json({ ok: result.ok, observation: result.observation, error: result.error });
    }),

    /**
     * POST /api/v1/computer/action — execute ONE whitelisted action.
     * Body: { action: {...}, assessmentId, approvalGranted }
     *
     * There is no shell action and no free-form command; anything not in the
     * whitelist is rejected before it reaches the bridge (#8, #37).
     */
    action: asyncHandler(async (request, response) => {
      const { action, assessmentId, approvalGranted = true, channel = null } = request.body || {};
      if (!action) {
        return response.status(400).json({ error: { code: 'MISSING_ACTION', message: 'An action object is required' } });
      }

      const scopeEngine = await scopeFor(request.user.id, assessmentId);
      if (!scopeEngine) {
        return response.status(403).json({
          error: {
            code: 'NO_AUTHORIZATION_CONTEXT',
            message: 'An assessmentId you own is required — computer actions are only executed within an authorized assessment.'
          }
        });
      }

      const result = await computerAdapter.execute(action, {
        channel: channel || assessmentId,
        scopeEngine,
        approvalGranted
      });

      const status = result.ok ? 200 : (result.rejected ? 403 : (result.error?.kind === 'unavailable' ? 503 : 502));
      return response.status(status).json(result);
    }),

    /**
     * GET /api/v1/computer/setup — setup diagnostics (issue #1).
     *
     * Inspects every layer the computer runtime needs (bridge file, Python,
     * local venv, pyautogui, display) and returns an honest report. Failing
     * checks carry concrete fix steps; nothing here installs anything.
     */
    setup: asyncHandler(async (request, response) => {
      const report = computerAdapter.diagnose();
      response.status(report.ok ? 200 : 503).json(report);
    }),

    /**
     * POST /api/v1/computer/repair — one explicitly-authorized safe repair.
     * Body: { repair: 'create_venv' | 'install_pyautogui', userAuthorized: true }
     *
     * Without `userAuthorized: true` this only returns instructions — it never
     * acts. The only automated repairs are the safe, project-local ones
     * (venv + pip install pyautogui into it); the system Python is never
     * touched (issue #1 "Setup path").
     */
    repair: asyncHandler(async (request, response) => {
      const { repair, userAuthorized = false } = request.body || {};
      const result = computerAdapter.repair({ repair, userAuthorized });
      const status = result.repaired ? 200 : (result.requiresAuthorization ? 403 : 422);
      response.status(status).json(result);
    }),

    /**
     * POST /api/v1/computer/pause — user pauses computer control from the website.
     * The agent stops taking GUI actions and asks the user to re-enable,
     * in the user's own language. Read-only screenshots still work.
     */
    pause: asyncHandler(async (request, response) => {
      computerAdapter.setPaused(true);
      await computerAdapter.events?.publish?.(null, {
        type: 'computer.paused',
        level: 'WARN',
        message: 'Computer control paused by user — agent will not click/type until resumed'
      });
      response.json({ ok: true, paused: true });
    }),

    /**
     * POST /api/v1/computer/resume — user resumes computer control from the website.
     */
    resume: asyncHandler(async (request, response) => {
      computerAdapter.setPaused(false);
      await computerAdapter.events?.publish?.(null, {
        type: 'computer.resumed',
        level: 'INFO',
        message: 'Computer control resumed by user — agent can click/type again'
      });
      response.json({ ok: true, paused: false });
    })
  };
}
