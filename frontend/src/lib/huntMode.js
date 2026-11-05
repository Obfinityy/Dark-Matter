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

// BRAIN-MODE + SCAN-DEPTH INHERITANCE (5 Nov 2026, Re-run brainMode fix).
//
// ROOT CAUSE: Re-run on an Autonomous hunt created an AI hunt. The drop
// was NOT in the backend (POST /api/v1/hunts honours the brainMode it is
// sent) and NOT in startHunt (it posts brainMode/scanDepth faithfully).
// The drop was the hunt object on the card: a fresh browser session
// restores hunt chats via syncHunts (App.jsx), whose minted card carried
// only {huntId, target, scope, status, createdAt} — no brainMode, no
// scanDepth, no mode. handleRerunHunt then read `hunt.brainMode || 'ai'`
// and got 'ai' every time. The restore mint now uses
// huntCardFromListEntry (below) and the list carries scanDepth
// (backend mapListHunt), but Re-run resolves authoritatively here too,
// so a legacy card minted before the fix still re-runs correctly:
//
//   card value -> GET /:id/brain-mode (brainMode) / GET /:id (scanDepth)
//   -> historical default ('ai' / 'standard').
//
// A Re-run must NEVER silently default to 'ai' while the source hunt's
// real mode is fetchable — the fetch hits the same backend the card came
// from, so it succeeds whenever the card is visible.
export async function resolveHuntBrainMode(hunt, fetchBrainMode) {
  if (hunt && hunt.brainMode === 'scanner') return 'scanner';
  if (hunt && hunt.brainMode === 'ai') return 'ai';
  const huntId = hunt && hunt.huntId;
  if (huntId) {
    try {
      const fetchFn = fetchBrainMode || (async (id) => (await import('./api.js')).getHuntBrainMode(id));
      const res = await fetchFn(huntId);
      const mode = res && res.data && res.data.brainMode;
      if (mode === 'scanner') return 'scanner';
      if (mode === 'ai') return 'ai';
    } catch { /* fall through to the default below */ }
  }
  return 'ai';
}

export async function resolveHuntScanDepth(hunt, fetchHunt) {
  const ok = (d) => d === 'quick' || d === 'standard' || d === 'deep';
  if (hunt && ok(hunt.scanDepth)) return hunt.scanDepth;
  const huntId = hunt && hunt.huntId;
  if (huntId) {
    try {
      const fetchFn = fetchHunt || (async (id) => (await import('./api.js')).getHunt(id));
      const res = await fetchFn(huntId);
      const depth = res && res.data && res.data.hunt && res.data.hunt.scanDepth;
      if (ok(depth)) return depth;
    } catch { /* fall through to the default below */ }
  }
  return 'standard';
}

// huntCardFromListEntry: the hunt object a restored chat card carries,
// built from one GET /api/v1/hunts list entry. Must carry everything
// Re-run / Start-from-scratch inherits — brainMode, scanDepth AND mode —
// with the same historical defaults the backend list uses (ai / standard
// / normal). A card missing any of these silently re-created the hunt in
// the wrong lane (5 Nov 2026: scanner -> ai).
export function huntCardFromListEntry(h) {
  const e = h || {};
  return {
    huntId: e.huntId,
    target: e.target,
    scope: e.scope || '',
    status: e.status || 'unknown',
    createdAt: e.createdAt,
    mode: typeof e.mode === 'string' && e.mode ? e.mode : 'normal',
    brainMode: e.brainMode === 'scanner' ? 'scanner' : 'ai',
    scanDepth: e.scanDepth === 'quick' || e.scanDepth === 'deep' ? e.scanDepth : 'standard',
  };
}
