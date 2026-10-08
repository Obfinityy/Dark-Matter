/**
 * Backend connection — ONE rule, no switcher.
 *
 * The backend origin is resolved once by frontend/src/lib/apiBase.js
 * (VITE_API_BASE_URL, then the legacy VITE_BACKEND_URL, then the local
 * development backend) and shared by every module that talks to the
 * backend. This module keeps the long-standing helper API on top of that
 * single source of truth.
 *
 * There is no Localhost/Cloud toggle. The backend URL is decided once, at
 * build time, from the environment — never from Settings UI state.
 */
import { API_BASE_URL, API_BASE_URL_SOURCE, DEFAULT_BACKEND_URL } from '../lib/apiBase.js';

export { DEFAULT_BACKEND_URL };

/** The backend origin (no /api/v1 suffix). */
export function getBackendUrl() {
  return API_BASE_URL;
}

/** Full API base: <origin>/api/v1 */
export function getApiBase() {
  return `${getBackendUrl()}/api/v1`;
}

/** True when the backend is the user's own machine. */
export function isLocalBackend() {
  try {
    const h = new URL(getBackendUrl()).hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return true;
  }
}

/** Where the active URL came from: 'env' (environment) or 'default'. */
export function getBackendUrlSource() {
  return API_BASE_URL_SOURCE;
}

/** Quick connectivity check against the configured backend. */
export async function testBackendConnection(timeoutMs = 10000) {
  const base = getApiBase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) {
      return { ok: false, message: `Backend responded with HTTP ${response.status}` };
    }
    return { ok: true, message: `Connected to backend at ${getBackendUrl()}` };
  } catch {
    clearTimeout(timer);
    return {
      ok: false,
      message: isLocalBackend()
        ? 'Localhost backend is unreachable. Run `npm start` in backend/ and try again.'
        : `Backend at ${getBackendUrl()} is unreachable. Check the URL and try again.`,
    };
  }
}
