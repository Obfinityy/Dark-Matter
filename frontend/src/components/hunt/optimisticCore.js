/**
 * optimisticCore.js — wave 24 (ideas 50930–50960): optimistic / performance
 * suite pure logic.
 *
 * Ideas 50930–50960: optimistic status changes with rollback, instant hunt
 * creation, optimistic comments, instant cached filtering, skeleton-first
 * rendering, hover prefetch, debounced local search, virtualized findings and
 * timeline windows, lazy evidence images, progressive report preview,
 * optimistic bookmarks, route code splitting, cached hunt snapshots,
 * stale-while-revalidate widgets, optimistic widget reorder, instant theme
 * switching, background PDF prefetch, optimistic bulk review, client-side
 * filter/sort, the 100ms acknowledgment budget, batched detail fetches,
 * optimistic pause/resume, skeletons-over-spinners, priority content
 * loading, idle-time preloading, optimistic dismissal, worker-thread search
 * index, streaming step log, optimistic FP dismissal, deferred non-critical JS.
 *
 * Pure functions only — no DOM/window — unit-testable with node:test.
 */

// ---------------------------------------------------------------------------
// 50950 — 100ms acknowledgment budget (the global constant everything uses)
// ---------------------------------------------------------------------------

export const ACK_BUDGET_MS = 100;
/** True when an interaction acknowledged within the 100ms budget. */
export function ackWithinBudget(startedAtMs, nowMs = Date.now()) {
  return nowMs - startedAtMs <= ACK_BUDGET_MS;
}

// ---------------------------------------------------------------------------
// Generic optimistic mutation helper (used by 50930/50932/50941/50948/50952/50959)
// ---------------------------------------------------------------------------

let tempIdSeq = 0;
/** Deterministic temp ids for optimistic rows (no Math.random → testable). */
export function nextTempId(prefix = 'temp') {
  tempIdSeq += 1;
  return `${prefix}-${tempIdSeq}`;
}
export function resetTempIds() {
  tempIdSeq = 0;
}

/**
 * Apply a mutation optimistically: return the next state immediately along
 * with a commit promise; if commit rejects, roll back to previous state.
 * commit: () => Promise — the real server call, injected by the caller.
 */
export async function applyOptimistic({ current, next, commit }) {
  try {
    await commit();
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: current, rolledBack: true, error: err };
  }
}

// ---------------------------------------------------------------------------
// 50930 — Optimistic status changes
// ---------------------------------------------------------------------------

/** Optimistically flip a finding's status; rollback target is the old status. */
export function optimisticStatusChange(finding, nextStatus) {
  return {
    optimistic: { ...finding, status: nextStatus, _optimistic: true },
    rollback: { ...finding },
  };
}

// ---------------------------------------------------------------------------
// 50931 — Instant hunt creation
// ---------------------------------------------------------------------------

/** The hunt row appears in history before the create API responds. */
export function instantHuntRow(name, { owner = 'me' } = {}) {
  return {
    id: nextTempId('hunt'),
    name: (name || 'Untitled hunt').trim() || 'Untitled hunt',
    owner,
    status: 'creating',
    createdAt: new Date().toISOString(),
    _optimistic: true,
  };
}

// ---------------------------------------------------------------------------
// 50932 — Optimistic comments
// ---------------------------------------------------------------------------

/** Comment renders immediately with a "sending" tick; flips to "sent". */
export function optimisticCommentDraft(body, { author = 'me' } = {}) {
  return {
    id: nextTempId('comment'),
    body: String(body || ''),
    author,
    delivery: 'sending',
    createdAt: new Date().toISOString(),
  };
}
export function markCommentSent(comment) {
  return { ...comment, delivery: 'sent' };
}

// ---------------------------------------------------------------------------
// 50933 — Instant cached filtering
// ---------------------------------------------------------------------------

/** Filter changes apply to cached findings instantly (no network round-trip). */
export function instantCachedFilter(cachedFindings, predicate) {
  const list = Array.isArray(cachedFindings) ? cachedFindings : [];
  return typeof predicate === 'function' ? list.filter(predicate) : list.slice();
}

// ---------------------------------------------------------------------------
// 50934 / 50953 — Skeleton-first rendering, skeletons over spinners
// ---------------------------------------------------------------------------

export const SKELETON_THRESHOLD_MS = 300;
/** Any load expected beyond 300ms shows skeletons instead of spinners. */
export function loaderKind(expectedMs) {
  const ms = Number(expectedMs) || 0;
  if (ms <= 0) return 'none';
  return ms > SKELETON_THRESHOLD_MS ? 'skeleton' : 'spinner';
}

// ---------------------------------------------------------------------------
// 50935 — Hover prefetch
// ---------------------------------------------------------------------------

export const HOVER_PREFETCH_MS = 300;
/** Hovering a finding card for 300ms prefetches its detail view. */
export function shouldPrefetch(hoverMs) {
  return (Number(hoverMs) || 0) >= HOVER_PREFETCH_MS;
}

// ---------------------------------------------------------------------------
// 50936 — Debounced local search
// ---------------------------------------------------------------------------

export const SEARCH_DEBOUNCE_MS = 150;
/** Trailing-edge debounce; pure enough to test with timers. */
export function debounce(fn, waitMs = SEARCH_DEBOUNCE_MS) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, waitMs);
  };
}

// ---------------------------------------------------------------------------
// 50937 / 50938 — Virtualized findings list / virtualized timeline
// ---------------------------------------------------------------------------

/**
 * Compute the visible window for a virtualized list. Only visible (+overscan)
 * rows render; the rest are spacer padding — 10k+ finding lists stay smooth.
 */
export function virtualWindow({ total, rowHeight, scrollTop, viewportHeight, overscan = 5 }) {
  const n = Math.max(0, Math.floor(total));
  const rh = Math.max(1, rowHeight);
  const start = Math.max(0, Math.floor(scrollTop / rh) - overscan);
  const end = Math.min(n, Math.ceil((scrollTop + viewportHeight) / rh) + overscan);
  return {
    start,
    end,
    topPad: start * rh,
    bottomPad: (n - end) * rh,
    totalHeight: n * rh,
  };
}

// ---------------------------------------------------------------------------
// 50939 — Lazy evidence images
// ---------------------------------------------------------------------------

/** Load the thumbnail only once it scrolls into view. */
export function evidenceImageSrc({ src, placeholder, inView }) {
  return inView ? src : placeholder;
}

// ---------------------------------------------------------------------------
// 50940 — Progressive report preview
// ---------------------------------------------------------------------------

/** First report page renders before the full PDF is ready. */
export function progressivePreview(pages) {
  const list = Array.isArray(pages) ? pages : [];
  return {
    firstPage: list[0] || null,
    remaining: Math.max(0, list.length - 1),
    complete: list.length > 0,
  };
}

// ---------------------------------------------------------------------------
// 50941 — Optimistic bookmarks
// ---------------------------------------------------------------------------

/** Star/bookmark toggles respond instantly (set-based, immutable). */
export function toggleBookmark(bookmarkedIds, id) {
  const next = new Set(bookmarkedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// ---------------------------------------------------------------------------
// 50942 — Route code splitting
// ---------------------------------------------------------------------------

/** Hunt-page JS loads separately from dashboard JS. */
export const ROUTE_CHUNKS = {
  '/': 'dashboard-page',
  '/dashboard': 'dashboard-page',
  '/hunts': 'hunt-page',
  '/hunts/:id': 'hunt-page',
  '/models': 'models-page',
  '/reports': 'reports-page',
};
export function routeChunkName(route) {
  return ROUTE_CHUNKS[route] || 'shared-page';
}

// ---------------------------------------------------------------------------
// 50943 — Cached hunt snapshots
// ---------------------------------------------------------------------------

/** Reopening a hunt shows its last state instantly, then live-syncs. */
export function createSnapshotStore() {
  const store = new Map();
  return {
    save(id, data) {
      store.set(id, { data, savedAt: Date.now() });
    },
    get(id) {
      return store.get(id) || null;
    },
    isStale(id, ttlMs = 5 * 60 * 1000) {
      const s = store.get(id);
      if (!s) return true;
      return Date.now() - s.savedAt > ttlMs;
    },
    size() {
      return store.size;
    },
  };
}

// ---------------------------------------------------------------------------
// 50944 — Stale-while-revalidate widgets
// ---------------------------------------------------------------------------

/** Widgets show cached data while refreshing in the background. */
export function swrWidgetState({ data = null, isRevalidating = false } = {}) {
  return {
    data,
    isRevalidating,
    // Old data stays visible under a subtle "updating" shimmer — never blank.
    visible: data !== null,
    showShimmer: isRevalidating && data !== null,
  };
}

// ---------------------------------------------------------------------------
// 50945 — Optimistic widget reorder
// ---------------------------------------------------------------------------

/** Dragged widgets move instantly; layout persists on drop (rollback on fail). */
export function reorderList(list, fromIndex, toIndex) {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return arr;
  const [item] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, item);
  return arr;
}

// ---------------------------------------------------------------------------
// 50946 — Instant theme switching
// ---------------------------------------------------------------------------

/** CSS variables swap themes with no reload and no flash — zero JS delay. */
export const THEME_SWITCH_DELAY_MS = 0;

// ---------------------------------------------------------------------------
// 50947 — Background PDF prefetch
// ---------------------------------------------------------------------------

/** Opening the report tab prefetches the PDF in the background. */
export function shouldPrefetchPdf({ reportTabOpened, pdfCached }) {
  return Boolean(reportTabOpened) && !pdfCached;
}

// ---------------------------------------------------------------------------
// 50948 — Optimistic bulk review
// ---------------------------------------------------------------------------

/**
 * "Mark all reviewed" updates instantly with per-item rollback:
 * returns updated list + a rollback function restoring pre-op statuses.
 */
export function optimisticBulkReview(items) {
  const list = Array.isArray(items) ? items : [];
  const previous = list.map((f) => ({ id: f.id, status: f.status }));
  const updated = list.map((f) => ({ ...f, status: 'reviewed', _optimistic: true }));
  return {
    updated,
    rollback: () =>
      updated.map((f) => {
        const prev = previous.find((p) => p.id === f.id);
        const { _optimistic, ...rest } = f;
        return { ...rest, status: prev ? prev.status : rest.status };
      }),
  };
}

// ---------------------------------------------------------------------------
// 50949 — Client-side filter/sort
// ---------------------------------------------------------------------------

/** Filtering and sorting run locally when the dataset is already loaded. */
export function clientSort(items, key, dir = 'asc') {
  const arr = Array.isArray(items) ? items.slice() : [];
  const d = dir === 'desc' ? -1 : 1;
  return arr.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    if (av === undefined || av === null) return 1;
    if (bv === undefined || bv === null) return -1;
    return (av < bv ? -1 : 1) * d;
  });
}

// ---------------------------------------------------------------------------
// 50951 — Batched detail fetches
// ---------------------------------------------------------------------------

/** Rapid card expands batch their detail requests into a single call. */
export function dedupeBatch(ids) {
  const seen = new Set();
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 50952 — Optimistic pause/resume
// ---------------------------------------------------------------------------

/** The button flips instantly while the backend confirms asynchronously. */
export function flipPauseResume(status) {
  if (status === 'paused') return 'running';
  if (status === 'running') return 'paused';
  return status;
}

// ---------------------------------------------------------------------------
// 50954 — Priority content loading
// ---------------------------------------------------------------------------

/** Finding titles and severity load before evidence thumbnails. */
export const LOAD_PRIORITIES = { title: 0, severity: 1, summary: 2, evidence: 3, thumbnail: 4 };
export function priorityOrder(blocks) {
  return (Array.isArray(blocks) ? blocks.slice() : []).sort(
    (a, b) => (LOAD_PRIORITIES[a] ?? 99) - (LOAD_PRIORITIES[b] ?? 99)
  );
}

// ---------------------------------------------------------------------------
// 50955 — Idle-time preloading
// ---------------------------------------------------------------------------

/** Next hunt in history preloads when the browser goes idle (never hidden,
// never on metered connections). */
export function canIdlePreload({ documentHidden, saveData, idle }) {
  return Boolean(idle) && !documentHidden && !saveData;
}

// ---------------------------------------------------------------------------
// 50956 — Optimistic dismissal
// ---------------------------------------------------------------------------

/** Notification badges decrement the instant a toast is dismissed. */
export function dismissNotification(list, id) {
  const arr = Array.isArray(list) ? list : [];
  const dismissed = arr.find((n) => n.id === id) || null;
  return { list: arr.filter((n) => n.id !== id), dismissed };
}

// ---------------------------------------------------------------------------
// 50957 — Worker-thread search index
// ---------------------------------------------------------------------------

/**
 * A cached index powering instant fuzzy search on large hunts.
 * Same scoring the Web Worker runs; pure so the main-thread fallback and
 * tests share it. Token-prefix + substring scoring, best matches first.
 */
export function buildSearchIndex(docs, keyFn = (d) => d.title || '') {
  const entries = (Array.isArray(docs) ? docs : []).map((d) => ({
    doc: d,
    hay: String(keyFn(d)).toLowerCase(),
  }));
  return {
    size: entries.length,
    search(query, limit = 10) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const tokens = q.split(/\s+/);
      const scored = [];
      for (const e of entries) {
        let score = 0;
        for (const t of tokens) {
          if (e.hay.startsWith(t)) score += 3;
          else if (e.hay.includes(t)) score += 1;
          else {
            score = -1;
            break;
          }
        }
        if (score > 0) scored.push({ doc: e.doc, score });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.max(0, limit)).map((s) => s.doc);
    },
  };
}

// ---------------------------------------------------------------------------
// 50958 — Streaming step log
// ---------------------------------------------------------------------------

/** Step events append incrementally instead of waiting for batches. */
export function appendStepLog(log, event) {
  const arr = Array.isArray(log) ? log : [];
  return [...arr, { ...event, seq: arr.length, at: event.at || new Date().toISOString() }];
}

// ---------------------------------------------------------------------------
// 50959 — Optimistic FP dismissal
// ---------------------------------------------------------------------------

/** Dismissed cards collapse instantly with an undo payload for recovery. */
export function dismissFindingAsFp(card) {
  return {
    collapsed: { ...card, fpDismissed: true, collapsed: true },
    undo: { cardId: card.id, label: 'Undo dismiss', expiresInMs: 8000 },
  };
}

// ---------------------------------------------------------------------------
// 50960 — Deferred non-critical JS
// ---------------------------------------------------------------------------

/** Analytics and tips load after the interactive core is ready. */
export const DEFERRED_MODULES = ['analytics', 'tips'];
/** True once the interactive core (first paint + handlers) is ready. */
export function coreInteractiveReady({ firstPaintMs, handlersBound }) {
  return Boolean(handlersBound) && (Number(firstPaintMs) || 0) > 0;
}

// ---------------------------------------------------------------------------
// OptimisticSuite shared CSS-class constants
// ---------------------------------------------------------------------------

export const OPT_SKELETON_CLASS = 'opt-skeleton';
export const OPT_SHIMMER_CLASS = 'opt-shimmer';
export const OPT_PENDING_CLASS = 'opt-pending';
export const OPT_UNDO_CLASS = 'opt-undo-toast';
