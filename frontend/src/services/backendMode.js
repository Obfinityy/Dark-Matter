/**
 * Backend connection — ONE rule, no switcher.
 *
 *   VITE_BACKEND_URL is set (frontend/.env, or the Vercel project env) → use it.
 *   Not set → http://localhost:4000 (the local backend).
 *
 * There is no Localhost/Cloud toggle anymore. The backend URL is decided
 * once, at build time, from the environment — never from Settings UI state.
 */

const ENV_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/+$/, '');

/** Fallback when VITE_BACKEND_URL is not set: the user's own machine. */
export const DEFAULT_BACKEND_URL = 'http://localhost:4000';

/** The backend origin (no /api/v1 suffix). */
export function getBackendUrl() {
  return ENV_BACKEND_URL || DEFAULT_BACKEND_URL;
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

/** Where the active URL came from: 'env' (VITE_BACKEND_URL) or 'default'. */
export function getBackendUrlSource() {
  return ENV_BACKEND_URL ? 'env' : 'default';
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
        : `Backend at ${getBackendUrl()} is unreachable. Check the URL and try again.`
    };
  }
}
