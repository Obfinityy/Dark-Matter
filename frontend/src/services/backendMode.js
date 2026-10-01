/**
 * Backend connection mode.
 *
 * The user picks where the frontend talks to:
 *   - 'localhost' — the backend on the user's own machine (http://localhost:4000).
 *                     Full experience: hunts, local model runner, computer control.
 *   - 'vercel'    — the backend deployed on Vercel (stateless API only).
 *                     No long hunts, no model runner — those need localhost.
 *
 * Stored in localStorage so the choice survives reloads. The API layer reads
 * this at request time, so switching takes effect immediately — no rebuild.
 *
 * Default rule (fresh device, no saved choice): the frontend talks to the
 * backend that matches where IT is served from — localhost dev server →
 * localhost backend; any hosted domain (e.g. *.vercel.app) → the hosted
 * Vercel backend. So on the live site, login/signup always hit the real
 * cloud backend; switching to localhost is a deliberate post-login action
 * in Settings.
 */

const MODE_KEY = 'dm_backend_mode';
const VERCEL_URL_KEY = 'dm_vercel_backend_url';

/**
 * Build-time default for the Vercel backend URL.
 * Set VITE_DEFAULT_VERCEL_URL in .env (or Vercel dashboard → Environment
 * Variables) so the deployed frontend talks to your cloud backend out of
 * the box. The user can still override it anytime in Settings — localStorage
 * always wins over this default.
 */
const DEFAULT_VERCEL_URL = (import.meta.env.VITE_DEFAULT_VERCEL_URL || '').trim().replace(/\/$/, '');

export const BACKEND_MODES = {
  LOCALHOST: 'localhost',
  VERCEL: 'vercel'
};

/** Build-time default backend mode on a fresh device: 'localhost' | 'vercel'.
 *
 * Resolution order (first match wins):
 *   1. Explicit build-time override: VITE_DEFAULT_BACKEND_MODE=vercel|localhost
 *   2. Hostname heuristic — the product rule:
 *        • served from localhost / 127.0.0.1 (npm run dev) → 'localhost'
 *        • served from any hosted domain (*.vercel.app, custom domain) → 'vercel'
 *      On the live site the login screen therefore always talks to the real
 *      hosted backend; localhost is only reachable via the manual Settings
 *      switch after login.
 *   3. Safe fallback: 'localhost'.
 */
const ENV_DEFAULT_MODE = (() => {
  const raw = (import.meta.env.VITE_DEFAULT_BACKEND_MODE || '').trim().toLowerCase();
  if (raw === BACKEND_MODES.VERCEL) return BACKEND_MODES.VERCEL;
  if (raw === BACKEND_MODES.LOCALHOST) return BACKEND_MODES.LOCALHOST;
  return null;
})();

function isLocalHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '';
}

const DEFAULT_MODE = (() => {
  if (ENV_DEFAULT_MODE) return ENV_DEFAULT_MODE;
  try {
    if (typeof window !== 'undefined' && window.location) {
      return isLocalHostname(window.location.hostname) ? BACKEND_MODES.LOCALHOST : BACKEND_MODES.VERCEL;
    }
  } catch { /* non-browser context — fall through */ }
  return BACKEND_MODES.LOCALHOST;
})();

/** Build-time override for the localhost API base (default http://localhost:4000/api/v1). */
const LOCALHOST_BASE = (import.meta.env.VITE_LOCALHOST_API_URL || 'http://localhost:4000/api/v1').trim().replace(/\/$/, '');

export function getBackendMode() {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    if (mode === BACKEND_MODES.VERCEL) return BACKEND_MODES.VERCEL;
    if (mode === BACKEND_MODES.LOCALHOST) return BACKEND_MODES.LOCALHOST;
    return DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function setBackendMode(mode) {
  const value = mode === BACKEND_MODES.VERCEL ? BACKEND_MODES.VERCEL : BACKEND_MODES.LOCALHOST;
  try {
    localStorage.setItem(MODE_KEY, value);
  } catch { /* storage unavailable — falls back to localhost */ }
  // Notify the app so it can re-check connectivity immediately.
  try {
    window.dispatchEvent(new CustomEvent('dm:backend-mode-changed', { detail: { mode: value } }));
  } catch { /* ignore */ }
  return value;
}

export function getVercelBackendUrl() {
  try {
    const stored = (localStorage.getItem(VERCEL_URL_KEY) || '').trim().replace(/\/$/, '');
    // localStorage (user's Settings choice) wins; otherwise the build-time default.
    return stored || DEFAULT_VERCEL_URL;
  } catch {
    return DEFAULT_VERCEL_URL;
  }
}

export function setVercelBackendUrl(url) {
  const clean = (url || '').trim().replace(/\/$/, '');
  try {
    if (clean) localStorage.setItem(VERCEL_URL_KEY, clean);
    else localStorage.removeItem(VERCEL_URL_KEY);
  } catch { /* ignore */ }
  return clean;
}

/**
 * The API base URL for the currently selected backend mode.
 * Called at request time — switching modes needs no rebuild or reload.
 */
export function getApiBase() {
  if (getBackendMode() === BACKEND_MODES.VERCEL) {
    const url = getVercelBackendUrl();
    if (url) return `${url}/api/v1`;
    // No Vercel URL configured yet — fall back to localhost rather than
    // sending requests nowhere.
    return LOCALHOST_BASE;
  }
  return LOCALHOST_BASE;
}

/** Human label for the current mode, for status displays. */
export function getBackendModeLabel() {
  return getBackendMode() === BACKEND_MODES.VERCEL ? 'Vercel' : 'Localhost';
}

/** Quick connectivity check against the selected backend.
 *
 * TODO (future): One-click backend start — when the localhost backend is
 * unreachable, offer a "Start backend" button that launches it automatically.
 * Browsers cannot spawn local processes, so this needs one of:
 *   (a) Electron/Tauri desktop wrapper (recommended) — the app ships with the
 *       backend bundled; one click starts everything, no terminal needed.
 *   (b) A tiny local launcher service the user installs once.
 * Until then, the user runs `npm start` in backend/ manually.
 */
export async function testBackendConnection() {
  const base = getApiBase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${base}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return { ok: false, message: `Backend responded with HTTP ${response.status}` };
    return { ok: true, message: `Connected to ${getBackendModeLabel()} backend` };
  } catch (error) {
    clearTimeout(timer);
    const mode = getBackendModeLabel();
    return {
      ok: false,
      message: mode === 'Vercel'
        ? 'Vercel backend is unreachable. Check the URL in Settings.'
        : 'Localhost backend is unreachable. Run `npm start` in backend/ and try again.'
    };
  }
}
