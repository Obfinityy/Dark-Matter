/**
 * Backend connection — "My Device" (local) or cloud.
 *
 * Dark Matter is a free, local-first product: the DEFAULT is 'local' — the
 * backend on the user's own machine (http://localhost:4000, customizable in
 * Settings or the Agent home page, e.g. a dev-tunnel URL). Opening the app
 * connects straight to it; no login, no cloud account.
 *
 * The user can opt into 'cloud' — the hosted backend from the build
 * environment — via the backend switcher.
 *
 * The active origin is resolved by frontend/src/lib/apiBase.js
 * (resolveApiBaseUrl()) and shared by every module that talks to the
 * backend. With no login, no auth tokens are stored or sent at all.
 */
import {
  API_BASE_URL,
  API_BASE_URL_SOURCE,
  DEFAULT_BACKEND_URL,
  BACKEND_MODE_KEY,
  LOCAL_BACKEND_URL_KEY,
  DEFAULT_LOCAL_BACKEND_URL,
  CLOUD_BACKEND_URL,
  getBackendMode as readBackendMode,
  getLocalBackendUrl as readLocalBackendUrl,
  resolveApiBaseUrl,
} from '../lib/apiBase.js';

export { DEFAULT_BACKEND_URL, DEFAULT_LOCAL_BACKEND_URL, CLOUD_BACKEND_URL };

/** Event fired on window when the backend mode changes. */
export const BACKEND_MODE_CHANGED_EVENT = 'dm:backend-mode-changed';

/** 'cloud' | 'local' — where the app currently runs. */
export function getBackendMode() {
  return readBackendMode();
}

/** The user's own backend URL for "My Device" mode. */
export function getLocalBackendUrl() {
  return readLocalBackendUrl();
}

/**
 * Switch the backend mode. Persists the choice and notifies the app so auth
 * state and connection indicators can refresh.
 */
export function setBackendMode(mode) {
  const next = mode === 'local' ? 'local' : 'cloud';
  try {
    localStorage.setItem(BACKEND_MODE_KEY, next);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(BACKEND_MODE_CHANGED_EVENT, { detail: { mode: next } }));
  } catch {
    /* ignore */
  }
  return next;
}

/** Customize the "My Device" backend URL (e.g. a tunnel URL). */
export function setLocalBackendUrl(url) {
  const clean = String(url || '').trim().replace(/\/+$/, '');
  try {
    if (clean) localStorage.setItem(LOCAL_BACKEND_URL_KEY, clean);
    else localStorage.removeItem(LOCAL_BACKEND_URL_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(BACKEND_MODE_CHANGED_EVENT, { detail: { mode: getBackendMode() } }));
  } catch {
    /* ignore */
  }
  return getLocalBackendUrl();
}

/** The backend origin (no /api/v1 suffix) — mode-aware. */
export function getBackendUrl() {
  return resolveApiBaseUrl();
}

/** Full API base: <origin>/api/v1 */
export function getApiBase() {
  return `${getBackendUrl()}/api/v1`;
}

/** True when the backend is the user's own machine. */
export function isLocalBackend() {
  if (getBackendMode() === 'local') return true;
  try {
    const h = new URL(getBackendUrl()).hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return true;
  }
}

/** Where the active URL came from: 'env' (environment) or 'default'. */
export function getBackendUrlSource() {
  return getBackendMode() === 'local' ? 'my-device' : API_BASE_URL_SOURCE;
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
      message:
        getBackendMode() === 'local'
          ? `Can't reach your device at ${getBackendUrl()}. Make sure the Dark Matter backend is running on your machine (or double-check the tunnel link), then press Test again.`
          : `Can't reach the backend at ${getBackendUrl()}. Check the address and try again.`,
    };
  }
}
