/**
 * wave25.test.js — wave 25 (ideas 50961–51000): perceived-performance round 5
 * suite pure logic.
 *
 * node:test checks for performanceRound5Core pure logic and the wave-25
 * registry completeness (40/40, zero skips).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE25_IDEAS,
  WAVE25_START,
  WAVE25_END,
  FONT_DISPLAY_VALUE,
  fontFaceBlock,
  optimisticTabSwitch,
  tabRefreshDone,
  ghostButtonState,
  pickThumbnailQuality,
  qualityThumbUrl,
  THUMB_QUALITY_WIDTHS,
  localEchoPresence,
  mergeServerEcho,
  resetPresenceEcho,
  AUTOSAVE_IDLE_MS,
  shouldAutosave,
  autosaveState,
  predictivePreload,
  DIALOG_MODULES,
  shiftFreeSlot,
  applyFirstFinding,
  optimisticRetry,
  pickTransport,
  transportEvent,
  enqueueMutation,
  replayMutationQueue,
  seenWatermark,
  confirmWatermark,
  EVIDENCE_CHUNK_LINES,
  chunkEvidence,
  streamProgress,
  cardMemoProps,
  sameCard,
  optimisticRegrade,
  formatCount,
  descriptiveLoadingCopy,
  snapshotView,
  restoreView,
  widgetRefresh,
  dedupedRequest,
  optimisticHuntRename,
  lazyGraphInit,
  graphInitDone,
  ssrFallbackText,
  optimisticAttachment,
  attachmentUploadDone,
  POLL_ACTIVE_MS,
  POLL_HIDDEN_MS,
  pollInterval,
  resumePolling,
  perceivedHuntStatus,
  SLA_HOURS,
  optimisticSlaBadge,
  immutableAvatarUrl,
  AVATAR_CACHE_CONTROL,
  presetSwitch,
  presetSwitchSettled,
  optimisticWatchToggle,
  ROUTE_BUNDLE_BUDGET_KB,
  checkBundleBudgets,
  bundleBudgetFailed,
  inlineCriticalCss,
  isCriticalSelector,
  optimisticAppend,
  shouldPrefetchPage,
  nextSlice,
  recordAckSample,
  latencyStats,
  pushUndo,
  popUndo,
  SW_CACHE_NAME,
  precacheManifest,
  swStrategy,
  optimisticCheck,
  preloadSettings,
  firstRenderThemeClass,
  optimisticReact,
  confirmReaction,
  fastPathHunt,
  nextTempId,
  resetTempIds,
} from './performanceRound5Core.js';

describe('wave 25 registry completeness', () => {
  it('covers ideas 50961–51000 with zero skips', () => {
    assert.equal(WAVE25_IDEAS.length, 40);
    const ids = WAVE25_IDEAS.map(([id]) => id);
    for (let id = WAVE25_START; id <= WAVE25_END; id++) {
      assert.ok(ids.includes(id), `idea ${id} missing from registry`);
    }
    assert.ok(WAVE25_IDEAS.every(([id, name, desc]) => name && desc));
  });
});

describe('50961 font-display swap', () => {
  it('always emits font-display: swap', () => {
    assert.equal(FONT_DISPLAY_VALUE, 'swap');
    const css = fontFaceBlock('InfinitySans', '/fonts/x.woff2');
    assert.ok(css.includes('font-display: swap'));
    assert.ok(css.includes('@font-face'));
  });
});

describe('50962 optimistic tab switches', () => {
  it('shows cached content instantly and flags background refresh', () => {
    const st = {
      activeTab: 'a',
      tabs: { b: { content: 'cached B', stale: true } },
      refreshing: false,
    };
    const next = optimisticTabSwitch(st, 'b', () => Promise.resolve());
    assert.equal(next.activeTab, 'b');
    assert.equal(next.instantContent, 'cached B');
    assert.equal(next.refreshing, true);
  });
  it('marks fetch needed for uncached tabs', () => {
    const next = optimisticTabSwitch({ activeTab: 'a', tabs: {}, refreshing: false }, 'c');
    assert.equal(next.needsFetch, true);
  });
  it('tabRefreshDone settles the tab', () => {
    const st = { activeTab: 'b', tabs: {}, refreshing: true };
    const next = tabRefreshDone(st, 'b', 'fresh B');
    assert.equal(next.refreshing, false);
    assert.equal(next.tabs.b.content, 'fresh B');
    assert.equal(next.tabs.b.stale, false);
  });
});

describe('50963 ghost action buttons', () => {
  it('renders ghosted until data is ready', () => {
    const ghost = ghostButtonState(false);
    assert.equal(ghost.disabled, true);
    assert.ok(ghost.className.includes('ghost'));
    const ready = ghostButtonState(true);
    assert.equal(ready.disabled, false);
    assert.ok(ready.className.includes('ready'));
  });
});

describe('50964 bandwidth-aware thumbnail quality', () => {
  it('maps effectiveType to quality tiers', () => {
    assert.equal(pickThumbnailQuality('2g'), 'low');
    assert.equal(pickThumbnailQuality('slow-2g'), 'low');
    assert.equal(pickThumbnailQuality('3g'), 'medium');
    assert.equal(pickThumbnailQuality('4g'), 'high');
    assert.equal(pickThumbnailQuality('4g', true), 'low'); // data saver wins
  });
  it('rewrites thumb URLs with tier widths', () => {
    const url = qualityThumbUrl('/evidence/x.png', 'low');
    assert.ok(url.includes(`w=${THUMB_QUALITY_WIDTHS.low}`));
  });
});

describe('50965 local-echo presence', () => {
  it('renders avatar from local echo and dedupes the server echo', () => {
    resetPresenceEcho();
    const echo = localEchoPresence('u1', 'Hunter 1');
    assert.equal(echo.source, 'local');
    const merged = mergeServerEcho([echo], { id: 'u1', name: 'Hunter 1' });
    assert.equal(merged.length, 1);
    assert.equal(merged[0].source, 'server');
  });
});

describe('50966 debounced note autosave', () => {
  it('saves after 500ms idle and only when dirty', () => {
    assert.equal(AUTOSAVE_IDLE_MS, 500);
    assert.equal(shouldAutosave(2000, 1000, 0), true);
    assert.equal(shouldAutosave(1200, 1000, 0), false); // only 200ms idle
    assert.equal(shouldAutosave(2000, 500, 900), false); // not dirty
  });
  it('reports saving/dirty/saved labels', () => {
    assert.equal(autosaveState(false, true).status, 'saving');
    assert.equal(autosaveState(true, false).status, 'dirty');
    assert.equal(autosaveState(false, false).status, 'saved');
  });
});

describe('50967 predictive dialog preload', () => {
  it('preloads a module exactly once', () => {
    const r1 = predictivePreload({}, 'export');
    assert.equal(r1.started, true);
    const r2 = predictivePreload(r1.preloaded, 'export');
    assert.equal(r2.started, false);
    assert.ok(DIALOG_MODULES.export);
  });
});

describe('50968 shift-free first finding', () => {
  it('reserves the slot so insertion causes no layout shift', () => {
    const slot = shiftFreeSlot(120);
    assert.equal(slot.minHeight, 120);
    const applied = applyFirstFinding(slot, { id: 'f1' });
    assert.equal(applied.items.length, 1);
    assert.equal(applied.keptHeight, 120);
  });
});

describe('50969 optimistic retry', () => {
  it('shows retrying immediately and resolves via commit', async () => {
    const step = { id: 's1', status: 'failed', attempt: 1 };
    const { optimistic, commit } = optimisticRetry(step, async () => 'ok');
    assert.equal(optimistic.status, 'retrying');
    assert.equal(optimistic.attempt, 2);
    const { step: next } = await commit();
    assert.equal(next.status, 'running');
  });
});

describe('50970 websocket-first updates', () => {
  it('prefers ws, falls back to invisible http poll', () => {
    assert.equal(pickTransport(true).transport, 'ws');
    const fb = pickTransport(false);
    assert.equal(fb.transport, 'http-poll');
    assert.equal(fb.fallback, 'invisible');
    const ev = transportEvent({ id: 'e1' }, fb);
    assert.equal(ev.via, 'http-poll');
  });
});

describe('50971 offline mutation queue', () => {
  it('queues offline and replays in order', async () => {
    let q = [];
    q = enqueueMutation(q, 'triage', {});
    q = enqueueMutation(q, 'comment', {});
    const sent = [];
    const { done, leftover } = await replayMutationQueue(q, async item => {
      sent.push(item.op);
      return 'ok';
    });
    assert.deepEqual(sent, ['triage', 'comment']);
    assert.equal(done.length, 2);
    assert.equal(leftover.length, 0);
  });
  it('keeps failed items for the next attempt', async () => {
    const q = enqueueMutation([], 'triage', {});
    const { leftover } = await replayMutationQueue(q, async () => {
      throw new Error('down');
    });
    assert.equal(leftover.length, 1);
    assert.equal(leftover[0].attempts, 1);
  });
});

describe('50972 optimistic read receipts', () => {
  it('places the seen watermark without server confirmation', () => {
    const msgs = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
    const wm = seenWatermark(msgs, 'm2');
    assert.equal(wm.afterIndex, 1);
    const confirmed = confirmWatermark(wm, 0);
    assert.equal(confirmed.afterIndex, 1); // never moves backward
  });
});

describe('50973 chunked evidence streaming', () => {
  it('splits into 50-line chunks', () => {
    const text = Array.from({ length: 135 }, (_, i) => `l${i}`).join('\n');
    const chunks = chunkEvidence(text);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].split('\n').length, EVIDENCE_CHUNK_LINES);
    const p = streamProgress(1, 3);
    assert.equal(p.pct, 33);
  });
});

describe('50974 memoized finding cards', () => {
  it('sameCard skips re-render unless own data changed', () => {
    const f = { id: 'f1', rev: 2, severity: 'high', status: 'open' };
    const a = cardMemoProps(f, true, false);
    const b = cardMemoProps(f, true, false);
    assert.equal(sameCard(a, b), true);
    assert.equal(sameCard(a, cardMemoProps({ ...f, rev: 3 }, true, false)), false);
    assert.equal(sameCard(a, cardMemoProps(f, false, false)), false);
  });
});

describe('50975 optimistic re-grade', () => {
  it('recolors instantly and audits async', async () => {
    const finding = { id: 'f1', severity: 'medium' };
    const { optimistic, commit } = optimisticRegrade(finding, 'critical', async () => 'wrote');
    assert.equal(optimistic.severity, 'critical');
    assert.equal(optimistic.regrading, true);
    const { finding: next, audited } = await commit();
    assert.equal(audited, true);
    assert.equal(next.regrading, false);
  });
});

describe('50976 descriptive loading copy', () => {
  it('describes real progress', () => {
    assert.ok(descriptiveLoadingCopy('indexing', 1204, 5000).includes('1,204'));
    assert.ok(descriptiveLoadingCopy('rendering', 3, 10).includes('Rendering row 3 of 10'));
    assert.equal(formatCount(1204), '1,204');
  });
});

describe('50977 instant back navigation', () => {
  it('snapshots and restores scroll + open cards', () => {
    const snap = snapshotView(420, ['f1', 'f3'], 'sev=high');
    const r = restoreView(snap);
    assert.equal(r.scrollY, 420);
    assert.deepEqual(r.openCardIds, ['f1', 'f3']);
    assert.equal(r.restored, true);
    assert.equal(restoreView(null).restored, false);
  });
});

describe('50978 optimistic widget refresh', () => {
  it('keeps old data visible under the shimmer', async () => {
    const widget = { id: 'w1', data: { a: 1 } };
    const { optimistic, commit } = widgetRefresh(widget, async () => ({ a: 2 }));
    assert.equal(optimistic.updating, true);
    assert.deepEqual(optimistic.data, { a: 1 });
    const { widget: next } = await commit();
    assert.deepEqual(next.data, { a: 2 });
    assert.equal(next.updating, false);
  });
});

describe('50979 deduplicated in-flight requests', () => {
  it('shares one flight for identical keys', async () => {
    const inflight = new Map();
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return 'data';
    };
    const r1 = dedupedRequest(inflight, 'k', fetcher);
    const r2 = dedupedRequest(inflight, 'k', fetcher);
    assert.equal(r1.shared, false);
    assert.equal(r2.shared, true);
    const [d1, d2] = await Promise.all([r1.promise, r2.promise]);
    assert.equal(d1, 'data');
    assert.equal(d2, 'data');
    assert.equal(calls, 1);
  });
});

describe('50980 optimistic hunt rename', () => {
  it('applies the title instantly and clears the pending flag', async () => {
    const hunts = [{ id: 'h1', title: 'Old' }];
    const { optimistic, commit } = optimisticHuntRename(hunts, 'h1', 'New', async () => ({}));
    assert.equal(optimistic[0].title, 'New');
    const { hunts: next, ok } = await commit();
    assert.equal(ok, true);
    assert.equal(next[0].renaming, false);
  });
});

describe('50981 lazy chain-graph init', () => {
  it('initializes only when the tab opens, once', () => {
    let g = { initialized: false, status: 'idle' };
    g = lazyGraphInit(g, false);
    assert.equal(g.initialized, false);
    g = lazyGraphInit(g, true);
    assert.equal(g.initialized, true);
    assert.equal(g.status, 'initializing');
    g = graphInitDone(g, 23);
    assert.equal(g.status, 'ready');
    assert.equal(g.nodeCount, 23);
    const again = lazyGraphInit(g, true);
    assert.equal(again, g); // already initialized: no-op
  });
});

describe('50982 ssr fallback text', () => {
  it('renders escaped static triage content', () => {
    const html = ssrFallbackText('Hunt <A>', [
      { severity: 'high', title: 'XSS <img>', status: 'open' },
    ]);
    assert.ok(html.includes('Hunt &lt;A&gt;'));
    assert.ok(html.includes('XSS &lt;img&gt;'));
    assert.ok(html.includes('static snapshot'));
  });
});

describe('50983 optimistic file attach', () => {
  it('shows the thumbnail placeholder before upload completes', () => {
    const att = optimisticAttachment('poc.png', 1024, 'image/png');
    assert.equal(att.placeholder, true);
    assert.equal(att.status, 'uploading');
    const done = attachmentUploadDone(att, 'https://cdn/x/poc.png');
    assert.equal(done.placeholder, false);
    assert.equal(done.progress, 100);
  });
});

describe('50984 smart polling backoff', () => {
  it('slows to 30s while hidden and polls immediately on return', () => {
    assert.equal(POLL_ACTIVE_MS, 5000);
    assert.equal(POLL_HIDDEN_MS, 30000);
    assert.equal(pollInterval(true), 30000);
    assert.equal(pollInterval(false), 5000);
    assert.equal(resumePolling(true).pollNow, true);
  });
});

describe('50985 perceived-complete state', () => {
  it('shows Done when phases finish, before report finalization', () => {
    const phases = [{ status: 'done' }, { status: 'done' }];
    const s = perceivedHuntStatus(phases, true);
    assert.equal(s.label, 'Done');
    assert.ok(s.note.includes('Finalizing'));
    const running = perceivedHuntStatus([{ status: 'running' }], false);
    assert.equal(running.label, 'Running');
  });
});

describe('50986 optimistic sla badges', () => {
  it('derives the badge from the new severity instantly', () => {
    const now = Date.now();
    const fresh = { severity: 'critical', status: 'open', createdAt: now - 1000 };
    assert.equal(optimisticSlaBadge(fresh, now).tone, 'on-track');
    const stale = { severity: 'critical', status: 'open', createdAt: now - 30 * 3600000 };
    assert.equal(optimisticSlaBadge(stale, now).tone, 'breached');
    const triaged = { severity: 'critical', status: 'triaged', createdAt: now - 30 * 3600000 };
    assert.notEqual(optimisticSlaBadge(triaged, now).tone, 'breached');
    assert.ok(Object.keys(SLA_HOURS).length >= 4);
  });
});

describe('50987 immutable avatar urls', () => {
  it('version-pins the avatar URL and declares immutable caching', () => {
    const url = immutableAvatarUrl('u1', 'abc123');
    assert.ok(url.includes('v=abc123'));
    assert.ok(AVATAR_CACHE_CONTROL.includes('immutable'));
  });
});

describe('50988 cross-faded preset switches', () => {
  it('cross-fades then settles', () => {
    const sw = presetSwitch('a', 'b', [1, 2]);
    assert.equal(sw.phase, 'crossfade');
    const settled = presetSwitchSettled(sw);
    assert.equal(settled.phase, 'settled');
    assert.deepEqual(settled.results, [1, 2]);
  });
});

describe('50989 optimistic watch toggles', () => {
  it('flips the bell immediately', async () => {
    const targets = [{ id: 't1', watched: false }];
    const { optimistic, commit } = optimisticWatchToggle(targets, 't1', async () => ({}));
    assert.equal(optimistic[0].watched, true);
    const { targets: next, ok } = await commit();
    assert.equal(ok, true);
    assert.equal(next[0].watched, true);
  });
});

describe('50990 route bundle budgets', () => {
  it('flags routes over the 200KB gz budget', () => {
    assert.equal(ROUTE_BUNDLE_BUDGET_KB, 200);
    const results = checkBundleBudgets([
      { route: '/a', gzipBytes: 150 * 1024 },
      { route: '/b', gzipBytes: 210 * 1024 },
    ]);
    assert.equal(results[0].pass, true);
    assert.equal(results[1].pass, false);
    assert.equal(bundleBudgetFailed(results).length, 1);
  });
});

describe('50991 inlined critical css', () => {
  it('inlines critical selectors into the head block', () => {
    assert.equal(isCriticalSelector('.app-header'), true);
    assert.equal(isCriticalSelector('.footer-note'), false);
    const block = inlineCriticalCss(['.app-header { color: red; }']);
    assert.ok(block.startsWith('<style'));
    assert.ok(block.includes('data-critical'));
  });
});

describe('50992 optimistic pagination', () => {
  it('appends the prefetched page instantly', () => {
    const r = optimisticAppend(['a'], { items: ['b', 'c'], hasMore: true }, 1);
    assert.deepEqual(r.items, ['a', 'b', 'c']);
    assert.equal(r.page, 2);
    assert.equal(r.appended, 2);
    assert.equal(shouldPrefetchPage(true, false), true);
    assert.equal(shouldPrefetchPage(true, true), false);
  });
});

describe('50993 time-sliced rendering', () => {
  it('yields slices that cover all items', () => {
    const items = Array.from({ length: 120 }, (_, i) => i);
    let offset = 0;
    let seen = 0;
    while (true) {
      const s = nextSlice(items, offset, 50);
      seen += s.slice.length;
      offset = s.nextOffset;
      if (s.done) break;
    }
    assert.equal(seen, 120);
    assert.equal(offset, 120);
  });
});

describe('50994 perceived-latency analytics', () => {
  it('computes p50/p95 click-to-ack stats', () => {
    let samples = [];
    samples = recordAckSample(samples, 40, 'click');
    samples = recordAckSample(samples, 120, 'click');
    const stats = latencyStats(samples);
    assert.equal(stats.n, 2);
    assert.equal(stats.p50, 120); // sorted [40,120], p50 index 1
    assert.equal(stats.p95, 120);
    assert.equal(stats.budgetMs, 100);
    assert.equal(stats.withinBudget, 1);
  });
});

describe('50995 optimistic toast undo', () => {
  it('undoes from the local stack without waiting for the server', () => {
    let items = ['a'];
    let stack = [];
    stack = pushUndo(stack, 'dismiss a', () => {
      items = [...items, 'a'];
    });
    items = items.filter(i => i !== 'a');
    assert.deepEqual(items, []);
    const { rest, reverted } = popUndo(stack);
    assert.deepEqual(rest, []);
    assert.ok(reverted === undefined); // revert() applies via side effect
    assert.deepEqual(items, ['a']); // revert re-added the item
    assert.deepEqual(popUndo([]).rest, []);
  });
});

describe('50996 service-worker asset cache', () => {
  it('precaches shell assets and prefers fresh cache entries', () => {
    assert.ok(precacheManifest().includes('/'));
    assert.ok(SW_CACHE_NAME.includes('dark-matter'));
    assert.equal(swStrategy(true, 1000, 500), 'cache');
    assert.equal(swStrategy(true, 1000, 2000), 'network-then-cache');
    assert.equal(swStrategy(false, 1000, 0), 'network-then-cache');
  });
});

describe('50997 optimistic checklist', () => {
  it('checks off instantly, confirms async', async () => {
    const steps = [{ id: 'c1', label: 'x', done: false }];
    const { optimistic, commit } = optimisticCheck(steps, 'c1', async () => ({}));
    assert.equal(optimistic[0].done, true);
    assert.equal(optimistic[0].pending, true);
    const { steps: next, ok } = await commit();
    assert.equal(ok, true);
    assert.equal(next[0].pending, false);
  });
});

describe('50998 preloaded user settings', () => {
  it('first render matches stored preferences, no theme flash', () => {
    const { settings, preloaded } = preloadSettings(
      { theme: 'light' },
      { theme: 'dark', density: 'comfortable' }
    );
    assert.equal(settings.theme, 'light');
    assert.equal(settings.density, 'comfortable');
    assert.equal(preloaded, true);
    assert.equal(firstRenderThemeClass({ theme: 'light' }), 'theme-light');
    const { preloaded: p2 } = preloadSettings(null, { theme: 'dark' });
    assert.equal(p2, false);
  });
});

describe('50999 optimistic reactions', () => {
  it('increments emoji counts immediately', () => {
    const comment = { id: 'c1', reactions: { '👍': 2 }, reactedBy: [] };
    const next = optimisticReact(comment, '👍', 'me');
    assert.equal(next.reactions['👍'], 3);
    assert.equal(next.reactionPending, true);
    const confirmed = confirmReaction(next);
    assert.equal(confirmed.reactionPending, false);
    assert.equal(confirmed.reactions['👍'], 3);
  });
});

describe('51000 fast-path repeat hunts', () => {
  it('pre-fills repeat hunts from cached recon', () => {
    const cache = { 'acme.com': { subdomains: ['api.acme.com'], techStack: ['nginx'] } };
    const hit = fastPathHunt('acme.com', cache);
    assert.equal(hit.prefilled, true);
    assert.equal(hit.config.skipRecon, true);
    assert.deepEqual(hit.config.subdomains, ['api.acme.com']);
    const miss = fastPathHunt('new.io', cache);
    assert.equal(miss.prefilled, false);
    assert.equal(miss.config.skipRecon, false);
  });
});

describe('temp ids', () => {
  it('are deterministic and resettable', () => {
    resetTempIds();
    assert.equal(nextTempId('ev'), 'ev-1');
    assert.equal(nextTempId('ev'), 'ev-2');
  });
});
