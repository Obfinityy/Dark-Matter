// ============================================================================
// Dark Matter frontend — backend endpoint configuration.
//
// ⭐ CLOUD_BACKEND_URL: the default hosted ("Cloud") backend.
//    It is read from the VITE_BACKEND_URL build-time env var; when unset it
//    falls back to the placeholder below. Cloudflare Pages should set
//    VITE_BACKEND_URL to the live Render backend URL.
// ============================================================================

// eslint-disable-next-line no-undef
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const CLOUD_BACKEND_URL =
  env.VITE_BACKEND_URL || 'https://dark-matter-90nw.onrender.com';

export const DEFAULT_LOCAL_URL = 'http://localhost:4000';

const MODE_KEY = 'dm.backendMode';      // 'cloud' | 'mydevice'
const LOCAL_URL_KEY = 'dm.myDeviceUrl';

export function getBackendMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'mydevice' ? 'mydevice' : 'cloud';
  } catch {
    return 'cloud';
  }
}

export function setBackendMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode === 'mydevice' ? 'mydevice' : 'cloud');
  } catch { /* storage unavailable */ }
}

export function getMyDeviceUrl() {
  try {
    return localStorage.getItem(LOCAL_URL_KEY) || DEFAULT_LOCAL_URL;
  } catch {
    return DEFAULT_LOCAL_URL;
  }
}

export function setMyDeviceUrl(url) {
  try {
    localStorage.setItem(LOCAL_URL_KEY, url);
  } catch { /* storage unavailable */ }
}

/** Resolve the API base URL for all backend calls, honouring the Settings switcher. */
export function resolveApiBase() {
  const base = getBackendMode() === 'mydevice' ? getMyDeviceUrl() : CLOUD_BACKEND_URL;
  return String(base || '').replace(/\/+$/, '');
}
