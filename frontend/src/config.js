// ============================================================================
// Dark Matter frontend — backend endpoint configuration.
//
// The app always uses the hosted ("Cloud") backend. There is no backend
// switcher in the UI.
// ============================================================================

// eslint-disable-next-line no-undef
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const CLOUD_BACKEND_URL =
  env.VITE_BACKEND_URL || 'https://dark-matter-90nw.onrender.com';

/** Resolve the API base URL for all backend calls — always the hosted backend. */
export function resolveApiBase() {
  return String(CLOUD_BACKEND_URL || '').replace(/\/+$/, '');
}
