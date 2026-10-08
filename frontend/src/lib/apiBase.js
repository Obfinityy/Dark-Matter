/**
 * apiBase — the single source of truth for backend connection URLs.
 *
 * Every frontend module that talks to a backend or a local service resolves
 * its base URL from here; no other file hardcodes a backend host. The
 * backend origin is configured at build time through the environment
 * (see frontend/.env.example) and resolved once, in this order:
 *
 *   1. VITE_API_BASE_URL — the canonical environment variable.
 *   2. VITE_BACKEND_URL  — the legacy environment variable, still honoured.
 *   3. DEFAULT_BACKEND_URL — the local backend used during development.
 *
 * Resolved origins never carry a trailing slash and never include the
 * /api/v1 suffix; callers append the API prefix themselves.
 *
 * Part of: Infinity AI / Dark-Matter frontend (lib).
 */

/**
 * Read one build-time environment variable, normalised for use as a URL.
 * Returns '' when the variable is unset or blank. Guarded so this module is
 * safe to import outside the browser bundle (plain Node included), where
 * import.meta.env does not exist.
 */
function readEnvOrigin(read) {
  try {
    const value = read();
    return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

const ENV_API_BASE_URL = readEnvOrigin(() => import.meta.env.VITE_API_BASE_URL);
const LEGACY_ENV_BACKEND_URL = readEnvOrigin(() => import.meta.env.VITE_BACKEND_URL);

/** Backend origin used when no environment variable is set: local development. */
export const DEFAULT_BACKEND_URL = 'http://localhost:4000';

/**
 * The backend origin (no trailing slash, no /api/v1 suffix). Single source
 * of truth for every backend request made by the frontend.
 */
export const API_BASE_URL = ENV_API_BASE_URL || LEGACY_ENV_BACKEND_URL || DEFAULT_BACKEND_URL;

/** Where API_BASE_URL came from: 'env' when configured, otherwise 'default'. */
export const API_BASE_URL_SOURCE = ENV_API_BASE_URL || LEGACY_ENV_BACKEND_URL ? 'env' : 'default';

/**
 * Base URL of the desktop Runner service that lives on the user's own
 * machine (VM sandbox host). Loopback by design: the runner binds 127.0.0.1
 * only and is never a cloud endpoint.
 */
export const LOCAL_RUNNER_BASE_URL = 'http://127.0.0.1:4100';

/** WebSocket counterpart of LOCAL_RUNNER_BASE_URL. */
export const LOCAL_RUNNER_WS_URL = 'ws://127.0.0.1:4100';

/**
 * Build the base URL of a service listening on the user's own machine
 * (e.g. a locally running model server) from its port.
 */
export function localServiceUrl(port) {
  return `http://localhost:${port}`;
}
