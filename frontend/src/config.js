// ============================================================================
// Dark Matter frontend — backend endpoint configuration.
//
// Resolution order:
//   1. VITE_BACKEND_URL when set at build time (production builds MUST
//      set this to the live backend URL — do not rely on the fallback).
//   2. Otherwise, an origin-aware fallback (partial progress on #306):
//      - the app itself served from localhost / 127.0.0.1 (local dev)
//        -> the local backend at http://localhost:4000, so a fresh
//        local checkout works with VITE_BACKEND_URL unset, exactly as
//        .env.example promises;
//      - any other origin (hosted frontend) -> the hosted backend.
// The old code always fell back to the hosted backend, so local dev
// with an unset VITE_BACKEND_URL silently talked to the cloud backend
// instead of the local one — contradicting both .env.example and the
// local-first flow in issue #306. The full #306 feature (hosted
// frontend auto-connecting to the user's local backend, with a
// dev-tunnel fallback and honest unreachable guidance) is still open;
// this change only fixes the config contradiction.
// ============================================================================

// eslint-disable-next-line no-undef
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

function isLocalOrigin() {
  try {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return false;
  }
}

export const BACKEND_URL =
  env.VITE_BACKEND_URL || (isLocalOrigin() ? 'http://localhost:4000' : 'https://api.thebhavesh.online');

/** Resolve the API base URL for all backend calls. */
export function resolveApiBase() {
  return String(BACKEND_URL || '').replace(/\/+$/, '');
}
