// Mode inheritance for re-runs (27 Oct 2026, mode fix).
//
// "Start from scratch" / Re-run must start the new hunt in the OLD hunt's
// real mode — a human-mode hunt re-created in 'normal' loses the whole
// human loop (screen-seeing, Action Index, self-auth, keyword-index
// memory), which is exactly what happened to the live DVWA hunt
// h_830317bdc184 on 27 Oct 2026: the list endpoint returned hunts
// without mode, so the frontend always fell back to 'normal'.
//
// Resolution order: the hunt object itself (the list now carries mode)
// → the hunt detail (GET /:id returns the full stored meta) → the
// owner's standing default 'infinity' for new hunts. Never silently
// 'normal'.
//
// fetchHunt is injectable for tests; when omitted it dynamically
// imports getHunt from './api' (same pattern ChatPage uses elsewhere).
export async function resolveHuntMode(hunt, fetchHunt) {
  if (hunt && typeof hunt.mode === 'string' && hunt.mode) return hunt.mode;
  const huntId = hunt && hunt.huntId;
  if (huntId) {
    try {
      const fetchFn = fetchHunt || (async (id) => (await import('./api.js')).getHunt(id));
      const res = await fetchFn(huntId);
      const mode = res && res.data && res.data.hunt && res.data.hunt.mode;
      if (typeof mode === 'string' && mode) return mode;
    } catch { /* fall through to the default below */ }
  }
  return 'infinity';
}
