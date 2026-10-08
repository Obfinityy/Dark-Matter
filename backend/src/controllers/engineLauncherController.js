/**
 * engineLauncherController — Express route handlers for engine Launcher.
 * Factory that wires the engine Launcher service into REST endpoints.
 * Part of: Infinity AI / Dark-Matter backend (HTTP API controllers).
 */

import { buildLauncher, LAUNCHER_FILES } from '../services/engineLauncher.js';

/**
 * engineLauncherController.js — one-click "Dark Matter Engine" launcher.
 *
 *   GET  /api/v1/engine/launcher?os=windows|macos|linux&site=<origin>
 *        Public: downloads the launcher script for the user's OS.
 *        On the deployed site this is served by the Render backend; the
 *        launcher itself sets up the LOCAL backend + engine on the user's
 *        own computer.
 *
 *   POST /api/v1/engine/bootstrap
 *        Loopback-only (no auth): starts the llama-server engine download on
 *        the local backend. Called by the launcher after it starts the
 *        backend on the user's machine — never exposed to the network.
 */

const LOOPBACK_EXACT = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * True when the address is a loopback address (the local machine itself).
 * Exported for unit tests.
 */
export function isLoopbackAddress(addr) {
  if (addr == null) return false;
  const a = String(addr).trim().toLowerCase();
  if (LOOPBACK_EXACT.has(a)) return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a)) return true;
  return false;
}

/**
 * Strict site-origin validation — http(s) origin only, no path/query/fragment,
 * so the value can be safely embedded in the launcher script.
 * Exported for unit tests.
 */
export function sanitizeSiteOrigin(site) {
  if (typeof site !== 'string') return null;
  const s = site.trim();
  return /^https?:\/\/[a-zA-Z0-9.-]+(:[0-9]{1,5})?$/.test(s) ? s : null;
}

/** Fallback site when the query param is missing/invalid. */
export const DEFAULT_SITE = 'https://hack.thebhavesh.online';

/**
 * Creates engine launcher controller.
 * @param {object} options - Named options.
 * @returns {*} Result.
 */
export function createEngineLauncherController({ modelRunnerService }) {
  return {
    /**
     * GET /api/v1/engine/launcher — public download of the per-OS launcher.
     */
    launcher(request, response) {
      const os = String(request.query?.os || '').toLowerCase();
      const file = LAUNCHER_FILES[os];
      if (!file) {
        return response.status(400).json({
          error: {
            code: 'UNKNOWN_OS',
            message: 'Query param "os" must be one of: windows, macos, linux.',
          },
        });
      }
      const site = sanitizeSiteOrigin(request.query?.site) || DEFAULT_SITE;
      const script = buildLauncher(os, { site });
      response.set({
        'Content-Type': file.mime,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Content-Length': Buffer.byteLength(script, 'utf8'),
      });
      return response.send(script);
    },

    /**
     * POST /api/v1/engine/bootstrap — loopback-only engine download trigger.
     * The launcher calls this after starting the local backend; the Models
     * page then shows live progress over the existing SSE stream.
     */
    bootstrap: async (request, response) => {
      const remote = request.socket?.remoteAddress;
      if (!isLoopbackAddress(remote)) {
        return response.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Engine bootstrap is only available from the local machine.',
          },
        });
      }
      try {
        const device = await modelRunnerService.getDevice();
        const result = modelRunnerService.engine.startEngineDownload(device);
        return response.status(result.ready ? 200 : 202).json(result);
      } catch (error) {
        return response.status(500).json({
          error: { code: 'ENGINE_FAILED', message: error.message },
        });
      }
    },
  };
}
