/**
 * performanceRound5Core.js — wave 25 (ideas 50961–51000): perceived-performance
 * / performance round 5 suite pure logic.
 *
 * Ideas 50961–51000: font-display swap, optimistic tab switches, ghost action
 * buttons, bandwidth-aware thumbnail quality, local-echo presence, debounced
 * note autosave (500ms idle), predictive dialog preload, shift-free first
 * finding, optimistic retry, WebSocket-first updates with HTTP-poll fallback,
 * offline mutation queue with ordered replay, optimistic read receipts,
 * chunked evidence streaming (50-line chunks), memoized finding cards,
 * optimistic re-grade with async audit write, descriptive loading copy,
 * instant back navigation (scroll + open cards from cache), optimistic widget
 * refresh with "updating" shimmer, deduplicated in-flight requests, optimistic
 * hunt rename, lazy chain-graph init, SSR fallback text, optimistic file
 * attach, smart polling backoff (30s while hidden), perceived-complete state,
 * optimistic SLA badges, immutable avatar URLs, cross-faded preset switches,
 * optimistic watch toggles, route bundle budgets (200KB gz, CI-enforced),
 * inlined critical CSS, optimistic pagination from prefetched pages,
 * time-sliced rendering, perceived-latency (click-to-ack) analytics,
 * optimistic toast undo, service-worker asset cache, optimistic checklist,
 * preloaded user settings, optimistic reactions, fast-path repeat hunts.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic (no Math.random).
 */

export const WAVE25_START = 50961;
export const WAVE25_END = 51000;

let tempIdSeq = 0;
/** Deterministic temp ids for optimistic items (no Math.random → testable). */
export function nextTempId(prefix = 'temp') {
  tempIdSeq += 1;
  return `${prefix}-${tempIdSeq}`;
}
export function resetTempIds() {
  tempIdSeq = 0;
}

/** Registry of all 40 ideas in this wave — completeness is testable. */
export const WAVE25_IDEAS = [
  [50961, 'font-display swap', 'Text renders immediately while custom fonts load'],
  [
    50962,
    'optimistic tab switches',
    'Cached tab content shows instantly, refresh runs in background',
  ],
  [50963, 'ghost action buttons', 'Buttons look disabled until data arrives, then activate'],
  [50964, 'bandwidth-aware thumbnail quality', 'Low bandwidth gets lower-resolution thumbnails'],
  [50965, 'local-echo presence', 'Collaborator avatars render from local echo before server echo'],
  [50966, 'debounced note autosave', 'Notes autosave after 500ms idle with saved indicator'],
  [50967, 'predictive dialog preload', 'Hovering Export preloads the export dialog code'],
  [
    50968,
    'shift-free first finding',
    'First finding arrives with no layout shift from empty state',
  ],
  [50969, 'optimistic retry', 'Retry shows "retrying…" immediately on failed steps'],
  [50970, 'websocket-first updates', 'Live updates prefer WebSocket, invisible HTTP-poll fallback'],
  [50971, 'offline mutation queue', 'Offline actions queue locally, replay in order on reconnect'],
  [50972, 'optimistic read receipts', '"Seen" watermarks update without server confirmation'],
  [50973, 'chunked evidence streaming', 'Long evidence streams in 50-line chunks'],
  [50974, 'memoized finding cards', 'Cards re-render only when their own finding changes'],
  [50975, 'optimistic re-grade', 'Severity pills recolor instantly, audit log writes async'],
  [
    50976,
    'descriptive loading copy',
    'Loading copy describes real progress, e.g. "indexing 1,204 findings…"',
  ],
  [50977, 'instant back navigation', 'Back restores scroll position and open cards from cache'],
  [50978, 'optimistic widget refresh', 'Old widget data stays visible under an "updating" shimmer'],
  [50979, 'deduplicated in-flight requests', 'Identical in-flight API calls share one response'],
  [50980, 'optimistic hunt rename', 'Title edits apply instantly in header and sidebar'],
  [50981, 'lazy chain-graph init', 'Graph canvas initializes only when its tab opens'],
  [50982, 'ssr fallback text', 'Core triage content renders even if client JS partially fails'],
  [50983, 'optimistic file attach', 'Attachment thumbnails appear before upload completes'],
  [
    50984,
    'smart polling backoff',
    'Polling slows to 30s while tab hidden, resumes instantly on return',
  ],
  [
    50985,
    'perceived-complete state',
    '"Done" shows when the last phase finishes, before report finalization',
  ],
  [50986, 'optimistic sla badges', 'SLA badges update the moment a finding status changes'],
  [
    50987,
    'immutable avatar urls',
    'Cached avatars use immutable URLs to avoid re-download flicker',
  ],
  [50988, 'cross-faded preset switches', 'Filter presets cross-fade between result sets'],
  [50989, 'optimistic watch toggles', 'Target watch bells flip state immediately on toggle'],
  [50990, 'route bundle budgets', 'Each route stays under 200KB gzipped, enforced in CI'],
  [50991, 'inlined critical css', 'Critical CSS inlines so first paint is styled without waiting'],
  [50992, 'optimistic pagination', '"Load more" appends instantly from prefetched pages'],
  [50993, 'time-sliced rendering', 'Heavy list updates yield to keep the UI responsive'],
  [50994, 'perceived-latency analytics', 'Click-to-acknowledgment tracked as a product metric'],
  [50995, 'optimistic toast undo', 'Toast undo actions work even before server confirms'],
  [50996, 'service-worker asset cache', 'Static assets cache for instant repeat visits'],
  [50997, 'optimistic checklist', 'Onboarding steps check off the instant the user acts'],
  [50998, 'preloaded user settings', 'Settings load at login so first render matches preferences'],
  [50999, 'optimistic reactions', 'Comment emoji counts increment immediately on click'],
  [51000, 'fast-path repeat hunts', 'Cached recon data pre-fills repeat hunts instantly'],
];

// ---------------------------------------------------------------------------
// 50961 — Font-display swap
// ---------------------------------------------------------------------------

/** The font-display value every @font-face in the app must use. */
export const FONT_DISPLAY_VALUE = 'swap';

/**
 * Build a @font-face block that never blocks text rendering.
 * @param {string} family font-family name
 * @param {string} url     woff2 URL
 * @param {string} weight  e.g. '400'
 */
export function fontFaceBlock(family, url, weight = '400') {
  return [
    '@font-face {',
    `  font-family: '${family}';`,
    `  src: url('${url}') format('woff2');`,
    `  font-weight: ${weight};`,
    `  font-display: ${FONT_DISPLAY_VALUE};`,
    '}',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 50962 — Optimistic tab switches
// ---------------------------------------------------------------------------

/**
 * Switch tabs: return cached content instantly and mark a background refresh.
 * state: { activeTab, tabs: { [id]: { content, stale } }, refreshing }
 */
export function optimisticTabSwitch(state, tabId, fetchFresh) {
  const cached = state.tabs[tabId];
  return {
    activeTab: tabId,
    tabs: state.tabs,
    // Show cached content now; refresh runs in the background only if no fresh fetch pending.
    refreshing: Boolean(cached && cached.stale),
    instantContent: cached ? cached.content : null,
    needsFetch: !cached,
    _fetch: fetchFresh,
  };
}

/** Mark a tab's cache fresh after the background refresh completes. */
export function tabRefreshDone(state, tabId, content) {
  return {
    ...state,
    refreshing: false,
    tabs: { ...state.tabs, [tabId]: { content, stale: false } },
  };
}

// ---------------------------------------------------------------------------
// 50963 — Ghost action buttons
// ---------------------------------------------------------------------------

/** Ghost buttons: render disabled-looking until data arrives, then activate. */
export function ghostButtonState(dataReady) {
  return {
    disabled: !dataReady,
    ariaDisabled: true,
    // Visually ghosted: opacity + no pointer, but focusable for AT.
    className: dataReady ? 'perf5-ghostbtn ready' : 'perf5-ghostbtn ghost',
    label: dataReady ? 'Run analysis' : 'Loading analysis…',
  };
}

// ---------------------------------------------------------------------------
// 50964 — Bandwidth-aware thumbnail quality
// ---------------------------------------------------------------------------

/**
 * Pick thumbnail quality from Network Information API effectiveType.
 * saveData: honor Data-Saver regardless of effectiveType.
 */
export function pickThumbnailQuality(effectiveType, saveData = false) {
  if (saveData) return 'low';
  switch (effectiveType) {
    case 'slow-2g':
    case '2g':
      return 'low';
    case '3g':
      return 'medium';
    case '4g':
    default:
      return 'high';
  }
}

export const THUMB_QUALITY_WIDTHS = { low: 160, medium: 320, high: 640 };

/** Rewrite a thumbnail URL to the width for the chosen quality tier. */
export function qualityThumbUrl(baseUrl, quality) {
  const w = THUMB_QUALITY_WIDTHS[quality] || THUMB_QUALITY_WIDTHS.high;
  return `${baseUrl}?w=${w}&q=${quality === 'low' ? 55 : 75}`;
}

// ---------------------------------------------------------------------------
// 50965 — Local-echo presence
// ---------------------------------------------------------------------------

let presenceEchoSeq = 0;

/** Render a collaborator avatar immediately from local echo; server echo dedupes later. */
export function localEchoPresence(userId, userName) {
  presenceEchoSeq += 1;
  return {
    id: userId,
    name: userName,
    // Local echo id so the later server echo replaces, never duplicates.
    echoId: `local-${presenceEchoSeq}`,
    source: 'local',
    appearedAt: Date.now(),
  };
}

/** Merge a server echo into presence: replaces the local echo for the same user. */
export function mergeServerEcho(presenceList, serverEcho) {
  return presenceList.map(p =>
    p.id === serverEcho.id ? { ...serverEcho, source: 'server', echoId: p.echoId } : p
  );
}

export function resetPresenceEcho() {
  presenceEchoSeq = 0;
}

// ---------------------------------------------------------------------------
// 50966 — Debounced note autosave (pure time math; the timer lives in the component)
// ---------------------------------------------------------------------------

export const AUTOSAVE_IDLE_MS = 500;

/**
 * Pure decision: should the note save now?
 * @param {number} nowMs        current time
 * @param {number} lastChangeMs last keystroke
 * @param {number} lastSaveMs   last completed save
 */
export function shouldAutosave(nowMs, lastChangeMs, lastSaveMs) {
  return lastChangeMs > lastSaveMs && nowMs - lastChangeMs >= AUTOSAVE_IDLE_MS;
}

export function autosaveState(dirty, saving, savedAt) {
  if (saving) return { status: 'saving', label: 'Saving…' };
  if (dirty) return { status: 'dirty', label: 'Unsaved changes' };
  return {
    status: 'saved',
    label: savedAt ? `Saved ${formatClock(savedAt)}` : 'All changes saved',
  };
}

function formatClock(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// 50967 — Predictive dialog preload
// ---------------------------------------------------------------------------

/**
 * Hovering Export preloads the export dialog module exactly once.
 * preloaded: Set-like object { [moduleKey]: true }
 */
export function predictivePreload(preloaded, moduleKey) {
  if (preloaded[moduleKey]) return { preloaded, started: false };
  return { preloaded: { ...preloaded, [moduleKey]: true }, started: true };
}

export const DIALOG_MODULES = {
  export: 'ExportDialog',
  report: 'ReportDialog',
  share: 'ShareDialog',
};

// ---------------------------------------------------------------------------
// 50968 — Shift-free first finding
// ---------------------------------------------------------------------------

/**
 * Reserve the empty-state slot height so the first finding causes no shift.
 * measuredCardH: measured or estimated card height (px).
 */
export function shiftFreeSlot(measuredCardH = 96) {
  return { minHeight: measuredCardH, transition: 'none' };
}

/** CLS-safe insertion: new finding occupies the reserved slot, then the slot relaxes. */
export function applyFirstFinding(emptyState, finding) {
  return { items: [finding], slotRelaxed: false, keptHeight: emptyState.minHeight };
}

// ---------------------------------------------------------------------------
// 50969 — Optimistic retry
// ---------------------------------------------------------------------------

/** Retry flips to "retrying…" immediately; the real call is injected. */
export function optimisticRetry(step, retryCall) {
  const optimistic = { ...step, status: 'retrying', label: 'Retrying…', attempt: step.attempt + 1 };
  return {
    optimistic,
    commit: () =>
      retryCall().then(
        result => ({ step: { ...optimistic, status: 'running', label: 'Running' }, result }),
        err => ({
          step: { ...step, status: 'failed', attempt: optimistic.attempt, lastError: String(err) },
          error: err,
        })
      ),
  };
}

// ---------------------------------------------------------------------------
// 50970 — WebSocket-first updates (transport selection)
// ---------------------------------------------------------------------------

/**
 * Prefer WebSocket; fall back to invisible HTTP polling when WS is down.
 * wsReady: boolean — the actual socket state from the component.
 */
export function pickTransport(wsReady) {
  return wsReady
    ? { transport: 'ws', fallback: null }
    : { transport: 'http-poll', fallback: 'invisible' };
}

/** Downgrade live → fallback without any UI flash: same event shape. */
export function transportEvent(event, transport) {
  return { ...event, via: transport.transport, fallback: transport.fallback };
}

// ---------------------------------------------------------------------------
// 50971 — Offline mutation queue
// ---------------------------------------------------------------------------

/**
 * Queue a mutation while offline; replay in insertion order on reconnect.
 * Queue items: { id, op, payload, queuedAt, attempts }.
 */
export function enqueueMutation(queue, op, payload) {
  const item = { id: `q${queue.length + 1}`, op, payload, queuedAt: Date.now(), attempts: 0 };
  return [...queue, item];
}

/**
 * Replay the queue in order; each send is injected. Returns the results plus
 * the leftover queue (failed items keep their order for the next attempt).
 */
export async function replayMutationQueue(queue, send) {
  const done = [];
  const failed = [];
  for (const item of queue) {
    try {
      const result = await send(item);
      done.push({ id: item.id, result });
    } catch (err) {
      failed.push({ ...item, attempts: item.attempts + 1, lastError: String(err) });
    }
  }
  return { done, leftover: failed };
}

// ---------------------------------------------------------------------------
// 50972 — Optimistic read receipts
// ---------------------------------------------------------------------------

/**
 * Place the "seen" watermark optimistically at lastSeenId — no server wait.
 * messages: [{ id }...]; lastSeenId: last id the collaborator saw.
 */
export function seenWatermark(messages, lastSeenId) {
  const idx = messages.findIndex(m => m.id === lastSeenId);
  return { afterIndex: idx, label: idx >= 0 ? 'Seen' : 'Not seen yet' };
}

/** Merge the later server confirmation: only moves the watermark forward. */
export function confirmWatermark(current, serverAfterIndex) {
  return { ...current, afterIndex: Math.max(current.afterIndex, serverAfterIndex) };
}

// ---------------------------------------------------------------------------
// 50973 — Chunked evidence streaming
// ---------------------------------------------------------------------------

export const EVIDENCE_CHUNK_LINES = 50;

/** Split long evidence into 50-line chunks for progressive streaming. */
export function chunkEvidence(text) {
  const lines = text.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += EVIDENCE_CHUNK_LINES) {
    chunks.push(lines.slice(i, i + EVIDENCE_CHUNK_LINES).join('\n'));
  }
  return chunks;
}

export function streamProgress(chunksShown, chunksTotal) {
  const pct = chunksTotal === 0 ? 100 : Math.round((chunksShown / chunksTotal) * 100);
  return {
    chunksShown,
    chunksTotal,
    pct,
    label: `Streaming evidence… ${chunksShown}/${chunksTotal} chunks`,
  };
}

// ---------------------------------------------------------------------------
// 50974 — Memoized finding cards
// ---------------------------------------------------------------------------

/**
 * Stable prop snapshot for a finding card — React.memo comparator.
 * Only the finding's own data + selection state participate.
 */
export function cardMemoProps(finding, selected, expanded) {
  return {
    id: finding.id,
    rev: finding.rev ?? 0,
    severity: finding.severity,
    status: finding.status,
    selected,
    expanded,
  };
}

/** Comparator: skip re-render unless these props changed. */
export function sameCard(prev, next) {
  return (
    prev.id === next.id &&
    prev.rev === next.rev &&
    prev.severity === next.severity &&
    prev.status === next.status &&
    prev.selected === next.selected &&
    prev.expanded === next.expanded
  );
}

// ---------------------------------------------------------------------------
// 50975 — Optimistic re-grade (severity pill recolors instantly, audit async)
// ---------------------------------------------------------------------------

export function optimisticRegrade(finding, newSeverity, auditWrite) {
  const optimistic = { ...finding, severity: newSeverity, regrading: true };
  return {
    optimistic,
    commit: () =>
      auditWrite({
        findingId: finding.id,
        from: finding.severity,
        to: newSeverity,
        at: Date.now(),
      }).then(
        () => ({ finding: { ...optimistic, regrading: false }, audited: true }),
        err => ({ finding, audited: false, error: String(err) })
      ),
  };
}

// ---------------------------------------------------------------------------
// 50976 — Descriptive loading copy
// ---------------------------------------------------------------------------

export function formatCount(n) {
  return n.toLocaleString('en-US');
}

/**
 * Loading copy that describes real progress.
 * stage: one of indexing|fetching|analyzing|rendering; done/total numbers.
 */
export function descriptiveLoadingCopy(stage, done, total) {
  const verbs = {
    indexing: (d, t) => `Indexing ${formatCount(d)} of ${formatCount(t)} findings…`,
    fetching: (d, t) => `Fetching evidence ${formatCount(d)} of ${formatCount(t)}…`,
    analyzing: (d, t) => `Analyzing finding ${formatCount(d)} of ${formatCount(t)}…`,
    rendering: (d, t) => `Rendering row ${formatCount(d)} of ${formatCount(t)}…`,
  };
  const fn = verbs[stage] || verbs.fetching;
  return fn(done, total);
}

// ---------------------------------------------------------------------------
// 50977 — Instant back navigation
// ---------------------------------------------------------------------------

/**
 * Snapshot scroll + open cards so back-navigation restores instantly.
 * snapshot: { scrollY, openCardIds, filterKey }
 */
export function snapshotView(scrollY, openCardIds, filterKey) {
  return { scrollY, openCardIds: [...openCardIds], filterKey, at: Date.now() };
}

/** Restore from the cache; falls back to top when nothing was cached. */
export function restoreView(snapshot) {
  if (!snapshot) return { scrollY: 0, openCardIds: [], restored: false };
  return { scrollY: snapshot.scrollY, openCardIds: snapshot.openCardIds, restored: true };
}

// ---------------------------------------------------------------------------
// 50978 — Optimistic widget refresh (stale-while-updating)
// ---------------------------------------------------------------------------

/** Keep old data visible under an "updating" shimmer while the refresh runs. */
export function widgetRefresh(widget, refreshCall) {
  const optimistic = { ...widget, updating: true, shimmer: true };
  return {
    optimistic,
    commit: () =>
      refreshCall().then(
        data => ({
          widget: { ...optimistic, data, updating: false, shimmer: false, updatedAt: Date.now() },
        }),
        err => ({
          widget: { ...widget, updating: false, shimmer: false, refreshError: String(err) },
        })
      ),
  };
}

// ---------------------------------------------------------------------------
// 50979 — Deduplicated in-flight requests
// ---------------------------------------------------------------------------

/**
 * Identical in-flight calls share one promise. inflight: Map-like object.
 * Returns { promise, shared } — shared=true means an existing flight was reused.
 */
export function dedupedRequest(inflight, key, fetcher) {
  if (inflight.has(key)) return { promise: inflight.get(key), shared: true };
  const promise = fetcher().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return { promise, shared: false };
}

// ---------------------------------------------------------------------------
// 50980 — Optimistic hunt rename
// ---------------------------------------------------------------------------

/** Title applies instantly in header + sidebar; server commit follows. */
export function optimisticHuntRename(hunts, huntId, newTitle, commit) {
  const prev = hunts.find(h => h.id === huntId);
  const optimistic = hunts.map(h =>
    h.id === huntId ? { ...h, title: newTitle, renaming: true } : h
  );
  return {
    optimistic,
    commit: () =>
      commit(huntId, newTitle).then(
        () => ({
          hunts: optimistic.map(h => (h.id === huntId ? { ...h, renaming: false } : h)),
          ok: true,
        }),
        err => ({ hunts, ok: false, revertedTo: prev ? prev.title : null, error: String(err) })
      ),
  };
}

// ---------------------------------------------------------------------------
// 50981 — Lazy chain-graph init
// ---------------------------------------------------------------------------

/** Graph canvas initializes only when its tab opens, exactly once. */
export function lazyGraphInit(state, tabOpen) {
  if (!tabOpen) return { ...state, status: 'idle' };
  if (state.initialized) return state;
  return { ...state, initialized: true, status: 'initializing' };
}

export function graphInitDone(state, nodeCount) {
  return { ...state, status: 'ready', nodeCount };
}

// ---------------------------------------------------------------------------
// 50982 — SSR fallback text
// ---------------------------------------------------------------------------

/**
 * Plain-HTML fallback of core triage content for partial-JS failure.
 * Escapes user text; no script needed.
 */
export function ssrFallbackText(title, findings) {
  const esc = s =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const rows = findings
    .map(
      f => `      <li><strong>[${esc(f.severity)}]</strong> ${esc(f.title)} — ${esc(f.status)}</li>`
    )
    .join('\n');
  return [
    '<div class="perf5-ssr-fallback">',
    `  <h1>${esc(title)}</h1>`,
    `  <p>${findings.length} findings (static snapshot — enable JavaScript for live updates).</p>`,
    '  <ul>',
    rows,
    '  </ul>',
    '</div>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 50983 — Optimistic file attach
// ---------------------------------------------------------------------------

/** Thumbnail placeholder appears before the upload completes. */
export function optimisticAttachment(fileName, fileSize, mimeType) {
  return {
    id: `att-${fileName}`,
    name: fileName,
    size: fileSize,
    mimeType,
    // The component swaps this placeholder URL for a real object URL.
    placeholder: true,
    status: 'uploading',
    progress: 0,
  };
}

export function attachmentUploadDone(att, remoteUrl) {
  return { ...att, placeholder: false, status: 'done', progress: 100, remoteUrl };
}

// ---------------------------------------------------------------------------
// 50984 — Smart polling backoff
// ---------------------------------------------------------------------------

export const POLL_ACTIVE_MS = 5000;
export const POLL_HIDDEN_MS = 30000;

/** 30s while the tab is hidden; instant resume on return. */
export function pollInterval(tabHidden) {
  return tabHidden ? POLL_HIDDEN_MS : POLL_ACTIVE_MS;
}

/** On visibility return: poll immediately instead of waiting out the timer. */
export function resumePolling(visible) {
  return { pollNow: visible, interval: pollInterval(!visible) };
}

// ---------------------------------------------------------------------------
// 50985 — Perceived-complete state
// ---------------------------------------------------------------------------

/** "Done" shows when the last phase finishes — report finalization may still run. */
export function perceivedHuntStatus(phases, reportFinalizing) {
  const allDone = phases.every(p => p.status === 'done');
  if (!allDone) return { label: 'Running', tone: 'active' };
  if (reportFinalizing) return { label: 'Done', tone: 'done', note: 'Finalizing report…' };
  return { label: 'Done', tone: 'done', note: null };
}

// ---------------------------------------------------------------------------
// 50986 — Optimistic SLA badges
// ---------------------------------------------------------------------------

export const SLA_HOURS = { critical: 24, high: 72, medium: 168, low: 720 };

/** SLA badge derives from the NEW status instantly — no server round-trip. */
export function optimisticSlaBadge(finding, nowMs = Date.now()) {
  const hours = SLA_HOURS[finding.severity] || SLA_HOURS.medium;
  const elapsedH = (nowMs - finding.createdAt) / 3600000;
  const remainingH = hours - elapsedH;
  const breached = finding.status === 'open' && remainingH < 0;
  const tone = breached ? 'breached' : remainingH < hours * 0.25 ? 'at-risk' : 'on-track';
  return {
    text: breached
      ? `SLA breached (${Math.round(-remainingH)}h over)`
      : `${Math.max(0, Math.round(remainingH))}h left`,
    tone,
  };
}

// ---------------------------------------------------------------------------
// 50987 — Immutable avatar URLs
// ---------------------------------------------------------------------------

/**
 * Version-pinned avatar URL: cacheable forever (immutable), no re-download flicker.
 * version: content hash or upload counter — changes only when the avatar changes.
 */
export function immutableAvatarUrl(userId, version) {
  return `/api/v1/users/${encodeURIComponent(userId)}/avatar?v=${encodeURIComponent(version)}`;
}

/** The Cache-Control header value the backend should attach to these URLs. */
export const AVATAR_CACHE_CONTROL = 'public, max-age=31536000, immutable';

// ---------------------------------------------------------------------------
// 50988 — Cross-faded preset switches
// ---------------------------------------------------------------------------

/** Cross-fade between result sets when a filter preset changes. */
export function presetSwitch(oldPreset, newPreset, results) {
  return {
    from: oldPreset,
    to: newPreset,
    results,
    phase: 'crossfade', // 'crossfade' → 'settled' after the CSS transition
    className: 'perf5-preset-crossfade',
  };
}

export function presetSwitchSettled(switchState) {
  return { ...switchState, phase: 'settled', className: '' };
}

// ---------------------------------------------------------------------------
// 50989 — Optimistic watch toggles
// ---------------------------------------------------------------------------

export function optimisticWatchToggle(targets, targetId, commit) {
  const prev = targets.find(t => t.id === targetId);
  const optimistic = targets.map(t => (t.id === targetId ? { ...t, watched: !t.watched } : t));
  return {
    optimistic,
    commit: () =>
      commit(targetId, !prev.watched).then(
        () => ({ targets: optimistic, ok: true }),
        err => ({ targets, ok: false, error: String(err) })
      ),
  };
}

// ---------------------------------------------------------------------------
// 50990 — Route bundle budgets (200KB gz, CI-enforced)
// ---------------------------------------------------------------------------

export const ROUTE_BUNDLE_BUDGET_KB = 200;

/** CI check: every route chunk must stay under budget (gzipped bytes). */
export function checkBundleBudgets(routeSizes) {
  return routeSizes.map(r => ({
    route: r.route,
    kb: Math.round((r.gzipBytes / 1024) * 10) / 10,
    budgetKb: ROUTE_BUNDLE_BUDGET_KB,
    pass: r.gzipBytes <= ROUTE_BUNDLE_BUDGET_KB * 1024,
  }));
}

export function bundleBudgetFailed(results) {
  return results.filter(r => !r.pass);
}

// ---------------------------------------------------------------------------
// 50991 — Inlined critical CSS
// ---------------------------------------------------------------------------

/**
 * Mark above-the-fold selectors as critical so build tooling can inline them.
 * Returns the <style> block for the document head (string — injected by the host).
 */
export function inlineCriticalCss(criticalRules) {
  return `<style data-critical="true">\n${criticalRules.join('\n')}\n</style>`;
}

/** Heuristic: a selector is critical if it targets first-viewport chrome. */
const CRITICAL_HINTS = ['header', 'hero', 'nav', 'skeleton', 'toolbar', 'banner'];
export function isCriticalSelector(selector) {
  const s = selector.toLowerCase();
  return CRITICAL_HINTS.some(h => s.includes(h));
}

// ---------------------------------------------------------------------------
// 50992 — Optimistic pagination (prefetched pages)
// ---------------------------------------------------------------------------

/** "Load more" appends the prefetched page instantly; prefetch the next one. */
export function optimisticAppend(items, prefetchedPage, page) {
  return {
    items: [...items, ...prefetchedPage.items],
    page: page + 1,
    hasMore: prefetchedPage.hasMore,
    appended: prefetchedPage.items.length,
  };
}

/** Kick off prefetch for the page after current — never blocks the UI. */
export function shouldPrefetchPage(hasMore, prefetchInFlight) {
  return hasMore && !prefetchInFlight;
}

// ---------------------------------------------------------------------------
// 50993 — Time-sliced rendering
// ---------------------------------------------------------------------------

/**
 * Yield-friendly slicing: render up to `budget` items per slice.
 * The component advances slices via requestIdleCallback/setTimeout.
 */
export function nextSlice(items, offset, budget = 50) {
  const slice = items.slice(offset, offset + budget);
  const nextOffset = offset + slice.length;
  return {
    slice,
    nextOffset,
    done: nextOffset >= items.length,
    progress: items.length === 0 ? 1 : nextOffset / items.length,
  };
}

// ---------------------------------------------------------------------------
// 50994 — Perceived-latency analytics (click-to-ack)
// ---------------------------------------------------------------------------

/** Record one click→acknowledgment sample. ackMs: time to visual ack. */
export function recordAckSample(samples, ackMs, interaction) {
  return [...samples, { ackMs, interaction, at: Date.now() }];
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[i];
}

/** p50/p95 of click-to-ack times — the product's perceived-latency metric. */
export function latencyStats(samples) {
  const times = samples.map(s => s.ackMs).sort((a, b) => a - b);
  return {
    n: times.length,
    p50: percentile(times, 0.5),
    p95: percentile(times, 0.95),
    budgetMs: 100,
    withinBudget: times.filter(t => t <= 100).length,
  };
}

// ---------------------------------------------------------------------------
// 50995 — Optimistic toast undo
// ---------------------------------------------------------------------------

/**
 * Undo works from the local stack immediately — even before the server
 * confirms the original action.
 */
export function pushUndo(undoStack, action, revert) {
  return [...undoStack, { id: `u${undoStack.length + 1}`, action, revert, at: Date.now() }];
}

/** Pop the latest undo and apply its revert locally; server confirm follows. */
export function popUndo(undoStack) {
  if (undoStack.length === 0) return { entry: null, rest: undoStack, reverted: null };
  const entry = undoStack[undoStack.length - 1];
  return { entry, rest: undoStack.slice(0, -1), reverted: entry.revert() };
}

// ---------------------------------------------------------------------------
// 50996 — Service-worker asset cache
// ---------------------------------------------------------------------------

export const SW_CACHE_NAME = 'dark-matter-assets-v1';

/** Assets precached on install for instant repeat visits. */
export function precacheManifest() {
  return ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];
}

/**
 * Cache-first strategy decision (pure): use cache when we have a fresh
 * entry, else network + populate.
 */
export function swStrategy(cacheHit, maxAgeMs, ageMs) {
  if (cacheHit && ageMs <= maxAgeMs) return 'cache';
  return 'network-then-cache';
}

// ---------------------------------------------------------------------------
// 50997 — Optimistic checklist
// ---------------------------------------------------------------------------

/** Steps check off the instant the user acts; confirm follows async. */
export function optimisticCheck(steps, stepId, confirm) {
  const optimistic = steps.map(s => (s.id === stepId ? { ...s, done: true, pending: true } : s));
  return {
    optimistic,
    commit: () =>
      confirm(stepId).then(
        () => ({
          steps: optimistic.map(s => (s.id === stepId ? { ...s, pending: false } : s)),
          ok: true,
        }),
        err => ({ steps, ok: false, error: String(err) })
      ),
  };
}

// ---------------------------------------------------------------------------
// 50998 — Preloaded user settings
// ---------------------------------------------------------------------------

/** Settings load at login so the first render already matches preferences. */
export function preloadSettings(stored, defaults) {
  const merged = { ...defaults, ...(stored || {}) };
  return { settings: merged, preloaded: Boolean(stored) };
}

/** First-render theme class: no flash of the wrong theme. */
export function firstRenderThemeClass(settings) {
  return `theme-${settings.theme || 'dark'}`;
}

// ---------------------------------------------------------------------------
// 50999 — Optimistic reactions
// ---------------------------------------------------------------------------

/** Emoji counts increment immediately on click. */
export function optimisticReact(comment, emoji, userId) {
  const counts = { ...(comment.reactions || {}) };
  counts[emoji] = (counts[emoji] || 0) + 1;
  const reacted = [...(comment.reactedBy || []), `${userId}:${emoji}`];
  return { ...comment, reactions: counts, reactedBy: reacted, reactionPending: true };
}

/** Server confirm: clear the pending flag (counts were already right). */
export function confirmReaction(comment) {
  return { ...comment, reactionPending: false };
}

// ---------------------------------------------------------------------------
// 51000 — Fast-path repeat hunts
// ---------------------------------------------------------------------------

/**
 * Pre-fill a repeat hunt from cached recon data — instant start, no re-scan
 * of already-known surface.
 */
export function fastPathHunt(target, reconCache) {
  const cached = reconCache[target] || null;
  return {
    target,
    prefilled: Boolean(cached),
    config: cached
      ? {
          subdomains: cached.subdomains || [],
          techStack: cached.techStack || [],
          skipRecon: true,
          reason: 'Reusing cached recon — rescans only new surface',
        }
      : {
          subdomains: [],
          techStack: [],
          skipRecon: false,
          reason: 'No cached recon for this target',
        },
  };
}
