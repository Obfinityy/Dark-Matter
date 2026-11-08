// AI behaviour analysis — frontend guards (owner idea, 8 Nov 2026).
//
// Pure helpers for the HuntCard auto-call. Tested with plain
// node --test (no frontend runner exists in this repo — same pattern
// as huntMode.test.js).
//
// Trigger rule: when a SCANNER hunt transitions to finished, the card
// fires ONE POST /ai-analysis (backend is idempotent — a stored result
// is returned and the provider is never called twice for one hunt).
// A finished scanner hunt carries status 'finished' (host-side stream
// status / listHunts) or 'done' (the WS 'done' event). One attempt
// only per huntId per session — never loop on failure.

/**
 * True when the auto-call should fire now.
 * @param {object} input - { isScanner, status, huntId, attemptedHuntIds }
 *   attemptedHuntIds is a Set of huntIds already attempted this session.
 */
export function shouldAutoAnalyze({ isScanner, status, huntId, attemptedHuntIds } = {}) {
  if (!isScanner) return false;
  if (status !== 'finished' && status !== 'done') return false;
  if (!huntId) return false;
  if (attemptedHuntIds && typeof attemptedHuntIds.has === 'function' && attemptedHuntIds.has(huntId)) return false;
  return true;
}

/**
 * Normalize the POST /ai-analysis envelope ({ok, stored, analysis})
 * — or a raw analysis doc — into render state:
 *   { state: 'ready'|'unavailable'|'error', suggestions, error, note }
 * Suggestions are LEADS, never confirmed findings — the card labels
 * them as such; this helper never promotes one.
 */
export function normalizeAiAnalysis(data) {
  try {
    const doc = (data && data.analysis) || data || null;
    if (!doc || typeof doc !== 'object') {
      return { state: 'error', suggestions: [], error: 'AI analysis ka jawab nahi mila.', note: null };
    }
    if (doc.status === 'ok') {
      return {
        state: 'ready',
        suggestions: Array.isArray(doc.suggestions) ? doc.suggestions : [],
        error: null,
        note: typeof doc.note === 'string' ? doc.note : null,
      };
    }
    if (doc.status === 'ai-unavailable') {
      return {
        state: 'unavailable',
        suggestions: [],
        error: typeof doc.error === 'string' && doc.error ? doc.error : 'Meta AI abhi available nahi hai.',
        note: null,
      };
    }
    return { state: 'error', suggestions: [], error: 'AI analysis ka jawab nahi mila.', note: null };
  } catch {
    return { state: 'error', suggestions: [], error: 'AI analysis ka jawab nahi mila.', note: null };
  }
}
