/**
 * wave16.test.js — Infinity AI · Forge wave 16 (ideas 50601–50640).
 * Node tests for the pure logic in responsiveCore.js + CSS/registry completeness.
 * Run: node --test frontend/src/components/hunt/wave16.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  WAVE16_IDEAS,
  wave16RegistryComplete,
  MOBILE_MAX_PX,
  TABLET_MIN_PX,
  TABLET_MAX_PX,
  DESKTOP_MIN_PX,
  MIN_SUPPORTED_WIDTH_PX,
  CARD_TABLE_BREAKPOINT_PX,
  isMobileWidth,
  isTabletWidth,
  isDesktopWidth,
  viewportKind,
  isLandscape,
  orientationOf,
  viewportLabel,
  responsiveViewportClasses,
  isTouchDevice,
  prefersCoarsePointer,
  SWIPE_THRESHOLD_PX,
  swipeDelta,
  swipeDirection,
  classifySwipe,
  triageActionForSwipe,
  PTR_THRESHOLD_PX,
  PTR_MAX_PULL_PX,
  ptrProgress,
  ptrShouldRefresh,
  CASCADE_STEP_MS,
  CASCADE_MAX_MS,
  cascadeDelayMs,
  PINCH_MIN_SCALE,
  PINCH_MAX_SCALE,
  clampScale,
  clampPan,
  pinchTransform,
  pinchDistance,
  FLUID_MIN_PX,
  FLUID_MAX_PX,
  fluidTypeClamp,
  viewportHeightClass,
  logDensityForWidth,
  TOUCH_TARGET_MIN_PX,
  meetsTouchTarget,
  DIVIDER_MIN_RATIO,
  DIVIDER_MAX_RATIO,
  dividerRatio,
  dividerPx,
  MOTION_BUDGET_CAP_MS,
  capMotionMs,
  resolveMotionMs,
  shouldReduceMotion,
  ringProps,
  HUNT_STATUSES,
  statusChanged,
  flashClassForStatus,
  statusColor,
  SORT_FLIP_MS,
  sortNext,
  sortArrowStyle,
  CHECKBOX_DRAW_MS,
  checkboxStrokeOffset,
  RECONNECT_BANNER_MS,
  bannerClassFor,
  AUTO_FIT_MIN_PX,
  autoFitGridTemplate,
  tableModeForWidth,
  huntLayoutForWidth,
  toastPositionForWidth,
  STICKY_CTA_OFFSET_PX,
  stickyCtaVisible,
  foldableMode,
  BOTTOM_TABS,
  GESTURE_GUIDE,
} from './responsiveCore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, 'ResponsiveSuite.css'), 'utf8');
const jsx = readFileSync(join(__dirname, 'ResponsiveSuite.jsx'), 'utf8');

test('wave-16 registry covers all 40 ideas (50601–50640)', () => {
  assert.ok(wave16RegistryComplete());
  assert.equal(WAVE16_IDEAS.length, 40);
  assert.equal(WAVE16_IDEAS[0].id, 50601);
  assert.equal(WAVE16_IDEAS[39].id, 50640);
  const skips = WAVE16_IDEAS.filter(i => i.status === 'skip');
  assert.equal(skips.length, 1);
  assert.equal(skips[0].id, 50602);
  assert.ok(skips[0].note.length > 20, 'skip needs a real justification');
  assert.equal(skips[0].component, null);
  for (const idea of WAVE16_IDEAS.filter(i => i.status === 'shipped')) {
    assert.ok(idea.component, `${idea.id} shipped but has no component`);
    assert.equal(idea.module, 'ResponsiveSuite.jsx');
    assert.ok(
      jsx.includes(`export function ${idea.component}`),
      `${idea.component} missing from JSX`
    );
  }
});

test('breakpoint constants and helpers', () => {
  assert.equal(MOBILE_MAX_PX, 719);
  assert.equal(TABLET_MIN_PX, 720);
  assert.equal(TABLET_MAX_PX, 1023);
  assert.equal(DESKTOP_MIN_PX, 1024);
  assert.equal(MIN_SUPPORTED_WIDTH_PX, 320);
  assert.equal(CARD_TABLE_BREAKPOINT_PX, 720);
  assert.ok(isMobileWidth(320));
  assert.ok(isMobileWidth(719));
  assert.ok(!isMobileWidth(720));
  assert.ok(isTabletWidth(720));
  assert.ok(isTabletWidth(1023));
  assert.ok(!isTabletWidth(1024));
  assert.ok(isDesktopWidth(1024));
  assert.ok(isDesktopWidth(1920));
  assert.ok(!isMobileWidth(NaN));
  assert.equal(viewportKind(360), 'mobile');
  assert.equal(viewportKind(800), 'tablet');
  assert.equal(viewportKind(1440), 'desktop');
});

test('orientation and viewport labels', () => {
  assert.ok(isLandscape(800, 400));
  assert.ok(!isLandscape(400, 800));
  assert.equal(orientationOf(800, 400), 'landscape');
  assert.equal(orientationOf(400, 800), 'portrait');
  assert.equal(orientationOf(500, 500), 'square');
  assert.equal(orientationOf(NaN, 400), 'unknown');
  assert.equal(viewportLabel(360, 740), 'mobile-portrait');
  assert.equal(viewportLabel(1024, 700), 'desktop-landscape');
  const classes = responsiveViewportClasses(360, 740);
  assert.ok(classes.includes('rs-vp-mobile'));
  assert.ok(classes.includes('rs-vp-portrait'));
  assert.ok(responsiveViewportClasses(320, 568).includes('rs-vp-tiny'));
  assert.ok(!responsiveViewportClasses(360, 740).includes('rs-vp-tiny'));
});

test('touch detection is Node-safe', () => {
  assert.equal(isTouchDevice(), false);
  assert.equal(isTouchDevice({ navigatorLike: { maxTouchPoints: 5 } }), true);
  assert.equal(isTouchDevice({ navigatorLike: { maxTouchPoints: 0 } }), false);
  assert.equal(isTouchDevice({ windowLike: { ontouchstart: null } }), true);
  assert.equal(prefersCoarsePointer(), false);
  assert.equal(
    prefersCoarsePointer(() => ({ matches: true })),
    true
  );
});

test('swipe math: delta, direction, classification', () => {
  assert.equal(SWIPE_THRESHOLD_PX, 48);
  const d = swipeDelta(0, 0, 100, 10);
  assert.equal(d.dx, 100);
  assert.equal(d.dy, 10);
  assert.ok(Math.abs(d.distance - Math.hypot(100, 10)) < 1e-9);
  assert.equal(swipeDirection(100, 10), 'right');
  assert.equal(swipeDirection(-60, 5), 'left');
  assert.equal(swipeDirection(5, 100), 'down');
  assert.equal(swipeDirection(5, -100), 'up');
  assert.equal(swipeDirection(10, 10), 'right'); // ties go horizontal
  assert.equal(classifySwipe(10, 5), null); // below threshold: accidental
  assert.equal(classifySwipe(100, 5), 'right');
  assert.equal(classifySwipe(-80, 4), 'left');
  assert.equal(classifySwipe(4, -90), 'up');
  assert.equal(classifySwipe(20, 0, 16), 'right'); // custom threshold
});

test('triage mapping: right = reviewed, left = snooze (50640)', () => {
  assert.equal(triageActionForSwipe('right'), 'reviewed');
  assert.equal(triageActionForSwipe('left'), 'snooze');
  assert.equal(triageActionForSwipe('up'), null);
  assert.equal(triageActionForSwipe('down'), null);
  assert.equal(triageActionForSwipe(null), null);
});

test('pull-to-refresh state machine (50637)', () => {
  assert.equal(PTR_THRESHOLD_PX, 64);
  assert.equal(PTR_MAX_PULL_PX, 160);
  assert.deepEqual(ptrProgress(0), { progress: 0, state: 'idle', pullPx: 0 });
  assert.deepEqual(ptrProgress(-20), { progress: 0, state: 'idle', pullPx: 0 });
  const pulling = ptrProgress(30);
  assert.equal(pulling.state, 'pulling');
  assert.ok(pulling.progress > 0 && pulling.progress < 1);
  const ready = ptrProgress(80);
  assert.equal(ready.state, 'ready');
  assert.equal(ptrProgress(9999).progress, 1); // clamped
  assert.ok(ptrShouldRefresh(ready));
  assert.ok(!ptrShouldRefresh(pulling));
  assert.ok(!ptrShouldRefresh(ptrProgress(0)));
});

test('thumbnail cascade stagger is capped (50607)', () => {
  assert.equal(CASCADE_STEP_MS, 60);
  assert.equal(CASCADE_MAX_MS, 400);
  assert.equal(cascadeDelayMs(0), 0);
  assert.equal(cascadeDelayMs(1), 60);
  assert.equal(cascadeDelayMs(3), 180);
  assert.equal(cascadeDelayMs(100), 400); // capped
});

test('pinch-zoom math clamps scale and pan (50623)', () => {
  assert.equal(PINCH_MIN_SCALE, 0.5);
  assert.equal(PINCH_MAX_SCALE, 3);
  assert.equal(clampScale(5), 3);
  assert.equal(clampScale(0.1), 0.5);
  assert.equal(clampScale(1.5), 1.5);
  assert.equal(clampScale(NaN), 1);
  // Content exactly fills the viewport: pan must be zero.
  const locked = clampPan(50, 50, 300, 240, 300, 240, 1);
  assert.deepEqual(locked, { tx: 0, ty: 0 });
  // Zoomed 2x on 300px-wide content: max pan is (600-300)/2 = 150.
  const panned = clampPan(500, -500, 300, 240, 300, 240, 2);
  assert.equal(panned.tx, 150);
  assert.equal(panned.ty, -120);
  const t = pinchTransform(1.5, 10, -20);
  assert.ok(t.includes('scale(1.500)'));
  assert.ok(t.includes('translate(10.00px, -20.00px)'));
  assert.equal(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('fluid type clamp interpolates 14px@320w -> 16px@1280w (50633)', () => {
  assert.equal(FLUID_MIN_PX, 14);
  assert.equal(FLUID_MAX_PX, 16);
  const expr = fluidTypeClamp();
  assert.equal(expr, 'clamp(14px, 0.2083vw + 13.3333px, 16px)');
  assert.ok(css.includes(expr), 'the exact clamp() expression ships in CSS');
  const custom = fluidTypeClamp(12, 20, 320, 1280);
  assert.ok(custom.startsWith('clamp(12px,'));
  assert.ok(custom.endsWith('20px)'));
});

test('viewport-height class resolves dvh with a vh fallback (50632)', () => {
  assert.equal(viewportHeightClass(), 'rs-vh-fallback'); // Node has no CSS.supports
  assert.equal(
    viewportHeightClass(() => true),
    'rs-dvh'
  );
  assert.equal(
    viewportHeightClass(() => false),
    'rs-vh-fallback'
  );
  assert.equal(
    viewportHeightClass(() => {
      throw new Error('x');
    }),
    'rs-vh-fallback'
  );
  assert.ok(css.includes('.rs-dvh'));
  assert.ok(css.includes('100dvh'));
  assert.ok(css.includes('.rs-vh-fallback'));
});

test('adaptive log density and touch targets (50638, 50618)', () => {
  assert.equal(logDensityForWidth(360), 'compact');
  assert.equal(logDensityForWidth(1440), 'full');
  assert.equal(TOUCH_TARGET_MIN_PX, 48);
  assert.ok(meetsTouchTarget(48, 48));
  assert.ok(!meetsTouchTarget(44, 48));
  assert.ok(!meetsTouchTarget(48, 40));
  assert.ok(meetsTouchTarget(56, 56, 48));
});

test('tablet divider ratio stays in the 25–75% band (50617)', () => {
  assert.equal(DIVIDER_MIN_RATIO, 0.25);
  assert.equal(DIVIDER_MAX_RATIO, 0.75);
  assert.equal(dividerRatio(400, 800), 0.5);
  assert.equal(dividerRatio(80, 800), 0.25); // clamped to min
  assert.equal(dividerRatio(760, 800), 0.75); // clamped to max
  assert.equal(dividerRatio(0, 0), 0.5); // safe default
  assert.equal(dividerPx(0.5, 800), 400);
  assert.equal(dividerPx(0.4, 1000), 400);
});

test('animation time budget caps at 400ms (50609)', () => {
  assert.equal(MOTION_BUDGET_CAP_MS, 400);
  assert.equal(capMotionMs(600), 400);
  assert.equal(capMotionMs(400), 400);
  assert.equal(capMotionMs(250), 250);
  assert.equal(capMotionMs(-5), 0);
  assert.equal(capMotionMs(NaN), 0);
  assert.equal(resolveMotionMs(600), 400);
  assert.equal(resolveMotionMs(200), 200);
  assert.equal(resolveMotionMs(600, { reducedMotion: true }), 0);
  assert.equal(shouldReduceMotion(), false); // Node-safe
});

test('avatar ring props describe the SVG arc (50603)', () => {
  const r = ringProps(56, 5, 0.5);
  const expectedCirc = 2 * Math.PI * (28 - 2.5);
  assert.ok(Math.abs(r.circumference - expectedCirc) < 1e-9);
  assert.equal(r.dasharray, r.circumference);
  assert.ok(Math.abs(r.dashoffset - expectedCirc / 2) < 1e-9);
  assert.equal(ringProps(56, 5, 0).dashoffset, r.circumference);
  assert.equal(ringProps(56, 5, 1).dashoffset, 0);
  assert.equal(ringProps(56, 5, 2).dashoffset, 0); // clamped
});

test('status flash helpers (50601)', () => {
  assert.deepEqual(HUNT_STATUSES, ['queued', 'running', 'passed', 'failed']);
  assert.ok(statusChanged('running', 'passed'));
  assert.ok(!statusChanged('running', 'running'));
  assert.equal(flashClassForStatus('failed'), 'rs-flash rs-flash-failed');
  assert.equal(statusColor('running'), '#38bdf8');
  assert.equal(statusColor('bogus'), '#94a3b8');
});

test('sort-arrow flip timing and toggle (50606)', () => {
  assert.equal(SORT_FLIP_MS, 200);
  assert.equal(sortNext('asc'), 'desc');
  assert.equal(sortNext('desc'), 'asc');
  const down = sortArrowStyle('desc');
  assert.ok(down.transform.includes('180deg'));
  assert.ok(down.transition.includes('200ms'));
  assert.ok(sortArrowStyle('asc').transform.includes('0deg'));
});

test('checkbox draw, reconnect banner, grid template', () => {
  assert.equal(CHECKBOX_DRAW_MS, 320);
  assert.equal(checkboxStrokeOffset(18, false), 18);
  assert.equal(checkboxStrokeOffset(18, true), 0);
  assert.equal(RECONNECT_BANNER_MS, 280);
  assert.equal(bannerClassFor('catching-up'), 'rs-banner rs-banner-catching-up');
  assert.equal(bannerClassFor('online'), 'rs-banner rs-banner-online');
  assert.equal(AUTO_FIT_MIN_PX, 280);
  assert.equal(autoFitGridTemplate(), 'repeat(auto-fit, minmax(280px, 1fr))');
  assert.equal(autoFitGridTemplate(200), 'repeat(auto-fit, minmax(200px, 1fr))');
});

test('layout selectors: tables, hunt, toasts, sticky CTA', () => {
  assert.equal(tableModeForWidth(360), 'cards');
  assert.equal(tableModeForWidth(719), 'cards');
  assert.equal(tableModeForWidth(720), 'table');
  assert.equal(huntLayoutForWidth(360), 'single-column');
  assert.equal(huntLayoutForWidth(1280), 'multi-column');
  assert.equal(toastPositionForWidth(360), 'bottom');
  assert.equal(toastPositionForWidth(1280), 'top');
  assert.equal(STICKY_CTA_OFFSET_PX, 160);
  assert.ok(!stickyCtaVisible(0));
  assert.ok(!stickyCtaVisible(160));
  assert.ok(stickyCtaVisible(161));
});

test('foldable mode, bottom tabs, gesture guide', () => {
  assert.equal(foldableMode(), 'single'); // Node has no matchMedia
  assert.equal(
    foldableMode(() => ({ matches: true })),
    'dual'
  );
  assert.equal(
    foldableMode(() => ({ matches: false })),
    'single'
  );
  assert.equal(BOTTOM_TABS.length, 4);
  assert.deepEqual(
    BOTTOM_TABS.map(t => t.label),
    ['Hunt', 'Findings', 'Chat', 'More']
  );
  assert.ok(GESTURE_GUIDE.length >= 5);
  assert.ok(GESTURE_GUIDE.some(g => g.gesture === 'swipe-right'));
  assert.ok(GESTURE_GUIDE.every(g => g.label && g.icon));
});

test('JSX exports every shipped component and the gallery', () => {
  for (const idea of WAVE16_IDEAS.filter(i => i.status === 'shipped')) {
    assert.ok(jsx.includes(`export function ${idea.component}`), idea.component);
  }
  assert.ok(jsx.includes('export function ResponsiveSuiteGallery'));
  assert.ok(jsx.includes("from './responsiveCore.js'"));
  assert.ok(jsx.includes("import './ResponsiveSuite.css'"));
  assert.ok(!jsx.includes('Muse'), 'identity: never "Muse" in code');
});

test('CSS ships every rs-* building block, keyframes, and guards', () => {
  const classes = [
    '.rs-demo',
    '.rs-phone-frame',
    '.rs-flash',
    '.rs-flash-running',
    '.rs-flash-failed',
    '.rs-avatar-ring',
    '.rs-ring-fg',
    '.rs-banner',
    '.rs-banner-catching-up',
    '.rs-banner-visible',
    '.rs-spring-check',
    '.rs-sort-btn',
    '.rs-sort-arrow',
    '.rs-thumb-grid',
    '.rs-thumb-rise',
    '.rs-pp-btn',
    '.rs-pp-icon',
    '.rs-eq',
    '.rs-cap',
    '.rs-budget-bar',
    '.rs-stepper-compact',
    '.rs-hunt-col',
    '.rs-bottom-tabbar',
    '.rs-tab',
    '.rs-tab-badge',
    '.rs-swipe-row',
    '.rs-swipe-actions',
    '.rs-swipe-card',
    '.rs-timeline',
    '.rs-now-marker',
    '.rs-fab',
    '.rs-sheet',
    '.rs-sheet-overlay',
    '.rs-sheet-grip',
    '.rs-widget-col',
    '.rs-terminal',
    '.rs-twopane',
    '.rs-divider',
    '.rs-touch-chip',
    '.rs-report-card',
    '.rs-page-dots',
    '.rs-chat',
    '.rs-chat-input',
    '.rs-chat-msg',
    '.rs-data-table',
    '.rs-card-list',
    '.rs-only-mobile',
    '.rs-only-desktop',
    '.rs-mheader',
    '.rs-status-pill',
    '.rs-overflow-menu',
    '.rs-pinch',
    '.rs-pinch-hint',
    '.rs-offline-slim',
    '.rs-tour-pop',
    '.rs-tour-dots',
    '.rs-atoast',
    '.rs-palette',
    '.rs-palette-item',
    '.rs-landscape-stepper',
    '.rs-fold',
    '.rs-fold-dual',
    '.rs-tiny',
    '.rs-split',
    '.rs-split-list',
    '.rs-fluid',
    '.rs-code-block',
    '.rs-code-wrap',
    '.rs-code-nowrap',
    '.rs-toggle',
    '.rs-sticky-cta',
    '.rs-cta-btn',
    '.rs-autofit',
    '.rs-ptr',
    '.rs-ptr-indicator',
    '.rs-ptr-spinner',
    '.rs-log-row',
    '.rs-log-detail',
    '.rs-gesture-guide',
    '.rs-gesture',
    '.rs-triage-card',
    '.rs-stamp',
    '.rs-stamp-review',
    '.rs-stamp-snooze',
    '.rs-gallery',
    '.rs-btn',
    '.rs-reduced-motion',
  ];
  for (const c of classes) assert.ok(css.includes(c), `missing CSS class ${c}`);

  const keyframes = [
    'rs-flash-in',
    'rs-banner-slide',
    'rs-check-pop',
    'rs-thumb-rise',
    'rs-eq',
    'rs-sheet-up',
    'rs-spin',
    'rs-toast-in',
  ];
  for (const kf of keyframes)
    assert.ok(css.includes(`@keyframes ${kf}`), `missing @keyframes ${kf}`);

  // Media queries, safe areas, dvh, fluid type, motion guards.
  assert.ok(css.includes('@media (max-width: 719px)'));
  assert.ok(css.includes('@media (min-width: 720px) and (max-width: 1023px)'));
  assert.ok(css.includes('@media (min-width: 1024px)'));
  assert.ok(css.includes('@media (orientation: landscape)'));
  assert.ok(css.includes('@media (orientation: portrait)'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(css.includes('env(safe-area-inset-bottom)'));
  assert.ok(css.includes('clamp('));
  // 400ms budget enforced in CSS.
  assert.ok(css.includes('400ms'));
  // Touch affordances.
  assert.ok(css.includes('min-height: 48px'));
  assert.ok(css.includes('touch-action'));
  assert.ok(!css.includes('Muse'), 'identity: never "Muse" in styles');
});
