/**
 * wave24.test.js — wave 24 (ideas 50921–50960): print round 4 + optimistic /
 * performance suite pure logic.
 *
 * node:test checks for printRound4Core + optimisticCore pure logic and the
 * wave-24 registry completeness (40/40, zero skips).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE24_IDEAS,
  wave24RegistryComplete,
  preparedByLine,
  DUPLEX_MARGINS,
  duplexMarginCss,
  duplexPadPages,
  scopeAppendixData,
  scopeAppendixTitle,
  fullListPrint,
  cheatSheetPrintout,
  PRINT_CSS_TARGETS,
  printCssSupportNote,
  complianceHistoryRows,
  printerButtonProps,
  printFallbackNote,
  PR4_PREPARED_BY_CLASS,
} from './printRound4Core.js';
import {
  ACK_BUDGET_MS,
  ackWithinBudget,
  nextTempId,
  resetTempIds,
  applyOptimistic,
  optimisticStatusChange,
  instantHuntRow,
  optimisticCommentDraft,
  markCommentSent,
  instantCachedFilter,
  loaderKind,
  SKELETON_THRESHOLD_MS,
  shouldPrefetch,
  HOVER_PREFETCH_MS,
  SEARCH_DEBOUNCE_MS,
  debounce,
  virtualWindow,
  evidenceImageSrc,
  progressivePreview,
  toggleBookmark,
  routeChunkName,
  createSnapshotStore,
  swrWidgetState,
  reorderList,
  THEME_SWITCH_DELAY_MS,
  shouldPrefetchPdf,
  optimisticBulkReview,
  clientSort,
  dedupeBatch,
  flipPauseResume,
  priorityOrder,
  canIdlePreload,
  dismissNotification,
  buildSearchIndex,
  appendStepLog,
  dismissFindingAsFp,
  DEFERRED_MODULES,
  coreInteractiveReady,
} from './optimisticCore.js';

describe('wave 24 registry', () => {
  it('covers all 40 ideas 50921–50960, zero skips', () => {
    assert.equal(WAVE24_IDEAS.length, 40);
    for (let i = 0; i < 40; i++) assert.equal(WAVE24_IDEAS[i][0], 50921 + i);
    assert.ok(wave24RegistryComplete());
    assert.ok(WAVE24_IDEAS.every(e => e[2] === 'new'));
  });
});

describe('50921 prepared-by line', () => {
  it('includes reviewer name, role and date', () => {
    const line = preparedByLine({
      reviewer: 'A. Sharma',
      role: 'Lead reviewer',
      date: new Date('2026-10-07'),
    });
    assert.ok(line.includes('A. Sharma'));
    assert.ok(line.includes('Lead reviewer'));
    assert.ok(line.includes('2026'));
    assert.ok(line.startsWith('Prepared by '));
  });
  it('falls back gracefully without a reviewer', () => {
    assert.ok(preparedByLine({}).includes('Unassigned reviewer'));
  });
});

describe('50922 duplex-friendly layout', () => {
  it('mirrors margins odd vs even', () => {
    assert.notEqual(DUPLEX_MARGINS.normal.odd.left, DUPLEX_MARGINS.normal.even.left);
    assert.equal(DUPLEX_MARGINS.normal.odd.left, DUPLEX_MARGINS.normal.even.right);
    const css = duplexMarginCss('normal');
    assert.ok(css.includes('@page :left'));
    assert.ok(css.includes('@page :right'));
  });
  it('pads odd page counts to even for duplex runs', () => {
    assert.equal(duplexPadPages(7), 8);
    assert.equal(duplexPadPages(8), 8);
    assert.equal(duplexPadPages(0), 0);
  });
});

describe('50923 scope appendix', () => {
  it('merges in-scope, out-of-scope and exclusions', () => {
    const rows = scopeAppendixData({
      inScope: ['*.example.com'],
      outOfScope: [{ target: 'blog.example.com', note: 'third-party' }],
      exclusions: [{ rule: 'No DoS', reason: 'availability' }],
    });
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map(r => r.kind),
      ['in-scope', 'out-of-scope', 'exclusion']
    );
    assert.ok(scopeAppendixTitle('acme').includes('acme'));
  });
});

describe('50924 full-list print rendering', () => {
  it('renders every row with a page estimate', () => {
    const r = fullListPrint(new Array(95).fill({}), { rowsPerPage: 40 });
    assert.equal(r.total, 95);
    assert.equal(r.rows.length, 95);
    assert.equal(r.estimatedPages, 3);
    assert.equal(r.fullyRendered, true);
  });
});

describe('50925 cheat-sheet printout', () => {
  it('splits shortcuts into columns', () => {
    const s = Array.from({ length: 9 }, (_, i) => ({ keys: `Ctrl+${i}`, label: `a${i}` }));
    const card = cheatSheetPrintout(s, { columns: 2 });
    assert.equal(card.columns.length, 2);
    assert.equal(card.total, 9);
    assert.ok(card.columns[0].length >= card.columns[1].length);
  });
});

describe('50926 cross-browser print CSS', () => {
  it('lists four browser targets and engine notes', () => {
    assert.equal(PRINT_CSS_TARGETS.length, 4);
    assert.ok(printCssSupportNote('Blink').includes('@page'));
    assert.ok(printCssSupportNote('UnknownEngine').length > 0);
  });
});

describe('50927 compliance-history print', () => {
  it('shapes events into rows', () => {
    const rows = complianceHistoryRows([{ time: 't', actor: 'a', action: 'login', detail: 'd' }]);
    assert.equal(rows[0].actor, 'a');
    assert.equal(rows[0].action, 'login');
  });
});

describe('50928 printer-icon print buttons', () => {
  it('uses printer icon + label + native dialog', () => {
    const p = printerButtonProps();
    assert.equal(p.icon, 'printer');
    assert.equal(p.opensNativeDialog, true);
    assert.ok(p.label.length > 0);
  });
});

describe('50929 print fallback note', () => {
  it('suggests PDF download on failure, empty on success', () => {
    assert.ok(printFallbackNote({ browser: 'Firefox' }).includes('PDF'));
    assert.equal(printFallbackNote({ failed: false }), '');
  });
  it('exports the print CSS class constants', () => {
    assert.equal(PR4_PREPARED_BY_CLASS, 'pr4-prepared-by');
  });
});

describe('50950 100ms acknowledgment budget', () => {
  it('ACK_BUDGET_MS is 100 and ack check works', () => {
    assert.equal(ACK_BUDGET_MS, 100);
    assert.equal(ackWithinBudget(1000, 1050), true);
    assert.equal(ackWithinBudget(1000, 1101), false);
  });
});

describe('optimistic mutation helper', () => {
  it('temp ids are deterministic and unique', () => {
    resetTempIds();
    assert.equal(nextTempId('hunt'), 'hunt-1');
    assert.equal(nextTempId('hunt'), 'hunt-2');
  });
  it('keeps the optimistic state on commit success', async () => {
    const r = await applyOptimistic({ current: 1, next: 2, commit: async () => {} });
    assert.deepEqual(r, { state: 2, rolledBack: false });
  });
  it('rolls back to previous state on commit failure', async () => {
    const err = new Error('nope');
    const r = await applyOptimistic({
      current: 1,
      next: 2,
      commit: async () => {
        throw err;
      },
    });
    assert.equal(r.state, 1);
    assert.equal(r.rolledBack, true);
    assert.equal(r.error, err);
  });
});

describe('50930 optimistic status changes', () => {
  it('applies instantly and keeps the rollback target', () => {
    const f = { id: 'f1', status: 'new' };
    const { optimistic, rollback } = optimisticStatusChange(f, 'reviewed');
    assert.equal(optimistic.status, 'reviewed');
    assert.equal(optimistic._optimistic, true);
    assert.equal(rollback.status, 'new');
  });
});

describe('50931 instant hunt creation', () => {
  it('row exists before the API responds', () => {
    resetTempIds();
    const row = instantHuntRow('acme hunt');
    assert.ok(row.id.startsWith('hunt-'));
    assert.equal(row.status, 'creating');
    assert.equal(row._optimistic, true);
  });
});

describe('50932 optimistic comments', () => {
  it('renders sending then flips to sent', () => {
    const c = optimisticCommentDraft('hello');
    assert.equal(c.delivery, 'sending');
    assert.equal(markCommentSent(c).delivery, 'sent');
  });
});

describe('50933 instant cached filtering', () => {
  it('filters cached findings without a network trip', () => {
    const out = instantCachedFilter([{ s: 'a' }, { s: 'b' }], f => f.s === 'a');
    assert.equal(out.length, 1);
  });
});

describe('50934/50953 skeleton-first + skeletons over spinners', () => {
  it('shows skeletons beyond 300ms, spinners below', () => {
    assert.equal(SKELETON_THRESHOLD_MS, 300);
    assert.equal(loaderKind(500), 'skeleton');
    assert.equal(loaderKind(200), 'spinner');
    assert.equal(loaderKind(0), 'none');
  });
});

describe('50935 hover prefetch', () => {
  it('prefetches at 300ms hover', () => {
    assert.equal(HOVER_PREFETCH_MS, 300);
    assert.equal(shouldPrefetch(300), true);
    assert.equal(shouldPrefetch(299), false);
  });
});

describe('50936 debounced local search', () => {
  it('fires once on the trailing edge', async () => {
    let calls = 0;
    const d = debounce(() => calls++, 20);
    d();
    d();
    d();
    await new Promise(r => setTimeout(r, 60));
    assert.equal(calls, 1);
    assert.equal(SEARCH_DEBOUNCE_MS, 150);
  });
});

describe('50937/50938 virtualized windows', () => {
  it('returns the visible window with padding', () => {
    const w = virtualWindow({
      total: 10000,
      rowHeight: 48,
      scrollTop: 4800,
      viewportHeight: 600,
      overscan: 5,
    });
    assert.ok(w.start < 100 && w.end > 100 && w.end < 200);
    assert.equal(w.totalHeight, 480000);
    assert.ok(w.topPad > 0 && w.bottomPad > 0);
  });
  it('clamps to list bounds', () => {
    const w = virtualWindow({ total: 3, rowHeight: 48, scrollTop: 0, viewportHeight: 600 });
    assert.equal(w.start, 0);
    assert.equal(w.end, 3);
    assert.equal(w.bottomPad, 0);
  });
});

describe('50939 lazy evidence images', () => {
  it('uses placeholder until in view', () => {
    assert.equal(
      evidenceImageSrc({ src: 'full.png', placeholder: 'blur.png', inView: false }),
      'blur.png'
    );
    assert.equal(
      evidenceImageSrc({ src: 'full.png', placeholder: 'blur.png', inView: true }),
      'full.png'
    );
  });
});

describe('50940 progressive report preview', () => {
  it('first page first', () => {
    const p = progressivePreview(['p1', 'p2', 'p3']);
    assert.equal(p.firstPage, 'p1');
    assert.equal(p.remaining, 2);
    assert.equal(p.complete, true);
  });
});

describe('50941 optimistic bookmarks', () => {
  it('toggles immutably', () => {
    const a = toggleBookmark(new Set(['x']), 'y');
    assert.ok(a.has('x') && a.has('y'));
    const b = toggleBookmark(a, 'x');
    assert.ok(!b.has('x') && b.has('y'));
  });
});

describe('50942 route code splitting', () => {
  it('hunt routes load separately from dashboard routes', () => {
    assert.equal(routeChunkName('/hunts/:id'), 'hunt-page');
    assert.equal(routeChunkName('/dashboard'), 'dashboard-page');
    assert.notEqual(routeChunkName('/hunts'), routeChunkName('/dashboard'));
  });
});

describe('50943 cached hunt snapshots', () => {
  it('serves last state instantly and reports staleness', () => {
    const s = createSnapshotStore();
    assert.equal(s.get('h1'), null);
    assert.equal(s.isStale('h1'), true);
    s.save('h1', { name: 'acme' });
    assert.equal(s.get('h1').data.name, 'acme');
    assert.equal(s.isStale('h1'), false);
    assert.equal(s.isStale('h1', -1), true); // ttl below zero → always stale
  });
});

describe('50944 stale-while-revalidate widgets', () => {
  it('keeps old data visible under a shimmer while refreshing', () => {
    const w = swrWidgetState({ data: { n: 1 }, isRevalidating: true });
    assert.equal(w.visible, true);
    assert.equal(w.showShimmer, true);
    const empty = swrWidgetState({ data: null, isRevalidating: true });
    assert.equal(empty.visible, false);
    assert.equal(empty.showShimmer, false);
  });
});

describe('50945 optimistic widget reorder', () => {
  it('moves instantly and ignores out-of-range moves', () => {
    assert.deepEqual(reorderList(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
    assert.deepEqual(reorderList(['a', 'b'], 0, 9), ['a', 'b']);
  });
});

describe('50946 instant theme switching', () => {
  it('is zero-delay CSS variable swap', () => {
    assert.equal(THEME_SWITCH_DELAY_MS, 0);
  });
});

describe('50947 background PDF prefetch', () => {
  it('prefetches when the report tab opens and PDF is uncached', () => {
    assert.equal(shouldPrefetchPdf({ reportTabOpened: true, pdfCached: false }), true);
    assert.equal(shouldPrefetchPdf({ reportTabOpened: true, pdfCached: true }), false);
    assert.equal(shouldPrefetchPdf({ reportTabOpened: false, pdfCached: false }), false);
  });
});

describe('50948 optimistic bulk review', () => {
  it('updates instantly and rolls back per item', () => {
    const items = [
      { id: 'a', status: 'new' },
      { id: 'b', status: 'triaged' },
    ];
    const { updated, rollback } = optimisticBulkReview(items);
    assert.ok(updated.every(f => f.status === 'reviewed' && f._optimistic));
    const back = rollback();
    assert.equal(back.find(f => f.id === 'a').status, 'new');
    assert.equal(back.find(f => f.id === 'b').status, 'triaged');
    assert.ok(!('_optimistic' in back[0]));
  });
});

describe('50949 client-side filter/sort', () => {
  it('sorts locally both directions, nulls last', () => {
    const items = [{ v: 3 }, { v: null }, { v: 1 }, { v: 2 }];
    assert.deepEqual(
      clientSort(items, 'v').map(i => i.v),
      [1, 2, 3, null]
    );
    assert.deepEqual(
      clientSort(items, 'v', 'desc').map(i => i.v),
      [3, 2, 1, null]
    );
  });
});

describe('50951 batched detail fetches', () => {
  it('dedupes rapid expands into one call set', () => {
    assert.deepEqual(dedupeBatch(['a', 'b', 'a', 'c', 'b']), ['a', 'b', 'c']);
  });
});

describe('50952 optimistic pause/resume', () => {
  it('flips instantly', () => {
    assert.equal(flipPauseResume('running'), 'paused');
    assert.equal(flipPauseResume('paused'), 'running');
    assert.equal(flipPauseResume('done'), 'done');
  });
});

describe('50954 priority content loading', () => {
  it('titles and severity load before thumbnails', () => {
    assert.deepEqual(priorityOrder(['thumbnail', 'evidence', 'title', 'severity']), [
      'title',
      'severity',
      'evidence',
      'thumbnail',
    ]);
  });
});

describe('50955 idle-time preloading', () => {
  it('only when idle, visible tab, unmetered', () => {
    assert.equal(canIdlePreload({ idle: true, documentHidden: false, saveData: false }), true);
    assert.equal(canIdlePreload({ idle: true, documentHidden: true, saveData: false }), false);
    assert.equal(canIdlePreload({ idle: true, documentHidden: false, saveData: true }), false);
    assert.equal(canIdlePreload({ idle: false, documentHidden: false, saveData: false }), false);
  });
});

describe('50956 optimistic dismissal', () => {
  it('badge decrements instantly, returns the dismissed item', () => {
    const { list, dismissed } = dismissNotification([{ id: 'n1' }, { id: 'n2' }], 'n1');
    assert.equal(list.length, 1);
    assert.equal(dismissed.id, 'n1');
  });
});

describe('50957 worker-thread search index', () => {
  it('ranks prefix matches first, requires all tokens', () => {
    const idx = buildSearchIndex(
      [{ title: 'xss in login form' }, { title: 'login csrf token' }, { title: 'sql injection' }],
      d => d.title
    );
    assert.equal(idx.size, 3);
    const hits = idx.search('login');
    assert.equal(hits.length, 2);
    assert.equal(hits[0].title, 'login csrf token'); // prefix match wins
    assert.deepEqual(
      idx.search('login xss').map(d => d.title),
      ['xss in login form']
    );
    assert.deepEqual(idx.search('zzz'), []);
    assert.deepEqual(idx.search(''), []);
  });
});

describe('50958 streaming step log', () => {
  it('appends incrementally with sequence numbers', () => {
    let log = [];
    log = appendStepLog(log, { phase: 'recon' });
    log = appendStepLog(log, { phase: 'scan' });
    assert.equal(log.length, 2);
    assert.deepEqual([log[0].seq, log[1].seq], [0, 1]);
    assert.ok(log[0].at);
  });
});

describe('50959 optimistic FP dismissal', () => {
  it('collapses instantly with an undo payload', () => {
    const { collapsed, undo } = dismissFindingAsFp({ id: 'f9' });
    assert.equal(collapsed.fpDismissed, true);
    assert.equal(collapsed.collapsed, true);
    assert.equal(undo.cardId, 'f9');
    assert.ok(undo.label.includes('Undo'));
  });
});

describe('50960 deferred non-critical JS', () => {
  it('defers analytics + tips until the core is interactive', () => {
    assert.deepEqual(DEFERRED_MODULES, ['analytics', 'tips']);
    assert.equal(coreInteractiveReady({ firstPaintMs: 120, handlersBound: true }), true);
    assert.equal(coreInteractiveReady({ firstPaintMs: 0, handlersBound: true }), false);
    assert.equal(coreInteractiveReady({ firstPaintMs: 120, handlersBound: false }), false);
  });
});
