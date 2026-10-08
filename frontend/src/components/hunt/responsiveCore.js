/**
 * responsiveCore.js — Infinity AI · Forge wave 16 (ideas 50601–50640).
 *
 * Mobile/responsive + touch-UX round: pure, DOM-free math and state helpers
 * behind the rs-* components (ResponsiveSuite.jsx/.css).
 *
 * ESM with no DOM access at import time — every window/document/navigator
 * touch is guarded so this module loads and tests cleanly under Node.
 * Reduced-motion handling here mirrors the mm-* guards from wave 15
 * (idea 50503); the genuinely new piece for 50609 is the 400ms animation
 * time budget enforced by capMotionMs()/resolveMotionMs().
 */

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Read the OS-level reduced-motion preference. Safe in Node (false). */
export function shouldReduceMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// ---------------------------------------------------------------------------
// Breakpoints (50610, 50615, 50621, 50628, 50630, 50631)
// ---------------------------------------------------------------------------

/** Mobile: single-column hunt, bottom tab bar, card lists. */
export const MOBILE_MAX_PX = 719;
/** Tablet portrait/landscape band: two-pane and split layouts. */
export const TABLET_MIN_PX = 720;
export const TABLET_MAX_PX = 1023;
/** Desktop: full multi-column layouts. */
export const DESKTOP_MIN_PX = 1024;
/** Narrowest viewport the product supports without horizontal page scroll. */
export const MIN_SUPPORTED_WIDTH_PX = 320;
/** Tables collapse to card lists below this width (50621). */
export const CARD_TABLE_BREAKPOINT_PX = 720;

export function isMobileWidth(w) {
  return Number.isFinite(w) && w <= MOBILE_MAX_PX;
}

export function isTabletWidth(w) {
  return Number.isFinite(w) && w >= TABLET_MIN_PX && w <= TABLET_MAX_PX;
}

export function isDesktopWidth(w) {
  return Number.isFinite(w) && w >= DESKTOP_MIN_PX;
}

/** 'mobile' | 'tablet' | 'desktop'. Non-finite widths fall back to desktop. */
export function viewportKind(w) {
  if (isMobileWidth(w)) return 'mobile';
  if (isTabletWidth(w)) return 'tablet';
  return 'desktop';
}

export function isLandscape(w, h) {
  return Number.isFinite(w) && Number.isFinite(h) && w > h;
}

/** 'landscape' | 'portrait' | 'square' | 'unknown'. */
export function orientationOf(w, h) {
  if (!Number.isFinite(w) || !Number.isFinite(h)) return 'unknown';
  if (w > h) return 'landscape';
  if (h > w) return 'portrait';
  return 'square';
}

/** e.g. 'mobile-portrait', 'tablet-landscape' — handy for logging/telemetry. */
export function viewportLabel(w, h) {
  return `${viewportKind(w)}-${orientationOf(w, h)}`;
}

/** Class list a shell can put on <body> to drive rs-* responsive CSS. */
export function responsiveViewportClasses(w, h) {
  const classes = ['rs-vp', `rs-vp-${viewportKind(w)}`, `rs-vp-${orientationOf(w, h)}`];
  if (Number.isFinite(w) && w <= MIN_SUPPORTED_WIDTH_PX) classes.push('rs-vp-tiny');
  return classes;
}

// ---------------------------------------------------------------------------
// Touch / device detection (50639) — all Node-safe
// ---------------------------------------------------------------------------

/**
 * True when the device reports touch input. Accepts injected lookalikes for
 * tests; reads real globals in the browser. Never throws in Node.
 */
export function isTouchDevice({ navigatorLike = null, windowLike = null } = {}) {
  const nav = navigatorLike ?? (typeof navigator !== 'undefined' ? navigator : null);
  const win = windowLike ?? (typeof window !== 'undefined' ? window : null);
  if (nav && Number(nav.maxTouchPoints) > 0) return true;
  if (win && 'ontouchstart' in win) return true;
  return false;
}

/** True when the primary pointer is coarse (finger). Safe in Node (false). */
export function prefersCoarsePointer(matchMediaFn = null) {
  const mm =
    matchMediaFn ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia.bind(window)
      : null);
  if (typeof mm !== 'function') return false;
  try {
    return !!mm('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Swipe gesture math (50612, 50640)
// ---------------------------------------------------------------------------

/** Minimum intentional swipe travel before a gesture counts. */
export const SWIPE_THRESHOLD_PX = 48;

export function swipeDelta(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return { dx, dy, distance: Math.hypot(dx, dy) };
}

/** Dominant-axis direction: 'left' | 'right' | 'up' | 'down'. */
export function swipeDirection(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

/**
 * Classify a drag as a swipe. Returns the direction, or null when the travel
 * is below `threshold` (accidental touch / scroll).
 */
export function classifySwipe(dx, dy, threshold = SWIPE_THRESHOLD_PX) {
  const { distance } = swipeDelta(0, 0, dx, dy);
  if (distance < threshold) return null;
  return swipeDirection(dx, dy);
}

/** 50640 — swipe right marks reviewed, swipe left snoozes. */
export function triageActionForSwipe(direction) {
  if (direction === 'right') return 'reviewed';
  if (direction === 'left') return 'snooze';
  return null;
}

// ---------------------------------------------------------------------------
// Pull-to-refresh state machine (50637)
// ---------------------------------------------------------------------------

export const PTR_THRESHOLD_PX = 64;
export const PTR_MAX_PULL_PX = 160;

/**
 * Pure pull state: 'idle' | 'pulling' | 'ready', plus 0..1 progress for the
 * indicator. Releasing while 'ready' triggers the refresh.
 */
export function ptrProgress(pullPx, { threshold = PTR_THRESHOLD_PX, max = PTR_MAX_PULL_PX } = {}) {
  const px = Math.max(0, pullPx);
  const progress = Math.min(1, px / max);
  const state = px <= 0 ? 'idle' : px >= threshold ? 'ready' : 'pulling';
  return { progress, state, pullPx: px };
}

export function ptrShouldRefresh(result) {
  return !!result && result.state === 'ready';
}

// ---------------------------------------------------------------------------
// Thumbnail cascade stagger (50607)
// ---------------------------------------------------------------------------

export const CASCADE_STEP_MS = 60;
export const CASCADE_MAX_MS = 400;

/** Stagger delay for item `index`, capped so long lists still feel snappy. */
export function cascadeDelayMs(index, { stepMs = CASCADE_STEP_MS, maxMs = CASCADE_MAX_MS } = {}) {
  return Math.min(maxMs, Math.max(0, index) * stepMs);
}

// ---------------------------------------------------------------------------
// Pinch-zoom transform math (50623)
// ---------------------------------------------------------------------------

export const PINCH_MIN_SCALE = 0.5;
export const PINCH_MAX_SCALE = 3;

export function clampScale(scale) {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(PINCH_MAX_SCALE, Math.max(PINCH_MIN_SCALE, scale));
}

/**
 * Clamp pan so scaled content always covers the viewport — the user can never
 * fling the evidence image into empty space.
 */
export function clampPan(tx, ty, viewW, viewH, contentW, contentH, scale) {
  const s = clampScale(scale);
  const maxX = Math.max(0, (contentW * s - viewW) / 2);
  const maxY = Math.max(0, (contentH * s - viewH) / 2);
  return {
    tx: Math.min(maxX, Math.max(-maxX, tx)),
    ty: Math.min(maxY, Math.max(-maxY, ty)),
  };
}

export function pinchTransform(scale, tx, ty) {
  return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(3)})`;
}

export function pinchDistance(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

// ---------------------------------------------------------------------------
// Fluid type scale (50633): 14px mobile base -> 16px desktop
// ---------------------------------------------------------------------------

export const FLUID_MIN_PX = 14;
export const FLUID_MAX_PX = 16;
export const FLUID_MIN_VW_PX = 320;
export const FLUID_MAX_VW_PX = 1280;

/**
 * Build a CSS clamp() fluid-size expression interpolating linearly between
 * (minVwPx, minPx) and (maxVwPx, maxPx). Default: 14px @320w -> 16px @1280w.
 */
export function fluidTypeClamp(
  minPx = FLUID_MIN_PX,
  maxPx = FLUID_MAX_PX,
  minVwPx = FLUID_MIN_VW_PX,
  maxVwPx = FLUID_MAX_VW_PX
) {
  const slope = ((maxPx - minPx) / (maxVwPx - minVwPx)) * 100;
  const intercept = minPx - (slope * minVwPx) / 100;
  return `clamp(${minPx}px, ${slope.toFixed(4)}vw + ${intercept.toFixed(4)}px, ${maxPx}px)`;
}

// ---------------------------------------------------------------------------
// Dynamic viewport units (50632): dvh with a vh fallback
// ---------------------------------------------------------------------------

/**
 * Class to use for full-height mobile panels (chat). Returns 'rs-dvh' when
 * the browser supports dynamic viewport units, else 'rs-vh-fallback' — so
 * browser chrome never clips the chat input. Node-safe (fallback).
 */
export function viewportHeightClass(cssSupportsFn = null) {
  const supports =
    cssSupportsFn ??
    (typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
      ? CSS.supports.bind(CSS)
      : null);
  if (typeof supports === 'function') {
    try {
      if (supports('height', '100dvh')) return 'rs-dvh';
    } catch {
      /* fall through to the vh fallback */
    }
  }
  return 'rs-vh-fallback';
}

// ---------------------------------------------------------------------------
// Adaptive log density (50638)
// ---------------------------------------------------------------------------

/** Compact one-line rows on phones, full multi-column rows on desktop. */
export function logDensityForWidth(w) {
  return isMobileWidth(w) ? 'compact' : 'full';
}

// ---------------------------------------------------------------------------
// Touch targets (50618): 48px minimum
// ---------------------------------------------------------------------------

export const TOUCH_TARGET_MIN_PX = 48;

export function meetsTouchTarget(widthPx, heightPx, minPx = TOUCH_TARGET_MIN_PX) {
  return widthPx >= minPx && heightPx >= minPx;
}

// ---------------------------------------------------------------------------
// Tablet two-pane draggable divider (50617)
// ---------------------------------------------------------------------------

export const DIVIDER_MIN_RATIO = 0.25;
export const DIVIDER_MAX_RATIO = 0.75;

/** Clamp a divider pixel position to a ratio band of the container width. */
export function dividerRatio(
  px,
  totalPx,
  { min = DIVIDER_MIN_RATIO, max = DIVIDER_MAX_RATIO } = {}
) {
  if (!Number.isFinite(px) || !Number.isFinite(totalPx) || totalPx <= 0) return 0.5;
  return Math.min(max, Math.max(min, px / totalPx));
}

export function dividerPx(ratio, totalPx) {
  return Math.round(ratio * totalPx);
}

// ---------------------------------------------------------------------------
// Animation time budget (50609): every animation caps at 400ms
// ---------------------------------------------------------------------------

export const MOTION_BUDGET_CAP_MS = 400;

/** Cap any requested animation/transition duration at the 400ms budget. */
export function capMotionMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.min(ms, MOTION_BUDGET_CAP_MS);
}

/**
 * Resolve the effective duration: 0 when the user prefers reduced motion,
 * otherwise the requested value capped at 400ms.
 */
export function resolveMotionMs(requestedMs, { reducedMotion = false } = {}) {
  if (reducedMotion) return 0;
  return capMotionMs(requestedMs);
}

// ---------------------------------------------------------------------------
// Avatar ring progress (50603): SVG stroke-dashoffset math
// ---------------------------------------------------------------------------

export function ringProps(sizePx, strokePx, progress) {
  const p = Math.min(1, Math.max(0, progress));
  const radius = Math.max(0, sizePx / 2 - strokePx / 2);
  const circumference = 2 * Math.PI * radius;
  return {
    radius,
    circumference,
    dasharray: circumference,
    dashoffset: circumference * (1 - p),
  };
}

// ---------------------------------------------------------------------------
// Status-change flash (50601)
// ---------------------------------------------------------------------------

export const HUNT_STATUSES = ['queued', 'running', 'passed', 'failed'];
export const STATUS_COLORS = {
  queued: '#94a3b8',
  running: '#38bdf8',
  passed: '#34d399',
  failed: '#f87171',
};

export function statusChanged(prev, next) {
  return prev !== next;
}

/** Flash class for a step row; re-mount on status change to retrigger it. */
export function flashClassForStatus(status) {
  return `rs-flash rs-flash-${status}`;
}

export function statusColor(status) {
  return STATUS_COLORS[status] ?? STATUS_COLORS.queued;
}

// ---------------------------------------------------------------------------
// Sort-arrow flip (50606)
// ---------------------------------------------------------------------------

/** Arrow rotates 180deg on every direction change. */
export const SORT_FLIP_MS = 200;

export function sortNext(current) {
  return current === 'asc' ? 'desc' : 'asc';
}

export function sortArrowStyle(direction) {
  return {
    transform: `rotate(${direction === 'asc' ? 0 : 180}deg)`,
    transition: `transform ${SORT_FLIP_MS}ms ease`,
  };
}

// ---------------------------------------------------------------------------
// Checkbox spring draw (50605)
// ---------------------------------------------------------------------------

export const CHECKBOX_DRAW_MS = 320;

export function checkboxStrokeOffset(pathLength, drawn) {
  return drawn ? 0 : pathLength;
}

// ---------------------------------------------------------------------------
// Reconnect banner (50604)
// ---------------------------------------------------------------------------

export const RECONNECT_BANNER_MS = 280;

export function bannerClassFor(connState) {
  return `rs-banner rs-banner-${connState}`;
}

// ---------------------------------------------------------------------------
// Auto-fit widget grid (50636)
// ---------------------------------------------------------------------------

export const AUTO_FIT_MIN_PX = 280;

export function autoFitGridTemplate(minPx = AUTO_FIT_MIN_PX) {
  return `repeat(auto-fit, minmax(${minPx}px, 1fr))`;
}

// ---------------------------------------------------------------------------
// Layout selectors
// ---------------------------------------------------------------------------

/** 50621 — tables become card lists below 720px. */
export function tableModeForWidth(w) {
  return w < CARD_TABLE_BREAKPOINT_PX ? 'cards' : 'table';
}

/** 50610 — small screens stack the hunt into a single column. */
export function huntLayoutForWidth(w) {
  return isMobileWidth(w) ? 'single-column' : 'multi-column';
}

/** 50626 — toasts dock to the bottom on mobile, top on desktop. */
export function toastPositionForWidth(w) {
  return isMobileWidth(w) ? 'bottom' : 'top';
}

// ---------------------------------------------------------------------------
// Sticky mobile CTA (50635)
// ---------------------------------------------------------------------------

export const STICKY_CTA_OFFSET_PX = 160;

export function stickyCtaVisible(scrollY, offset = STICKY_CTA_OFFSET_PX) {
  return scrollY > offset;
}

// ---------------------------------------------------------------------------
// Foldable devices (50629)
// ---------------------------------------------------------------------------

/** 'dual' when the CSS spanning media feature reports a folded screen. */
export function foldableMode(matchMediaFn = null) {
  const mm =
    matchMediaFn ??
    (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia.bind(window)
      : null);
  if (typeof mm !== 'function') return 'single';
  try {
    const vertical = mm('(spanning: single-fold-vertical)').matches;
    const horizontal = mm('(spanning: single-fold-horizontal)').matches;
    return vertical || horizontal ? 'dual' : 'single';
  } catch {
    return 'single';
  }
}

// ---------------------------------------------------------------------------
// Mobile bottom tab bar (50611) + gesture guide (50639)
// ---------------------------------------------------------------------------

export const BOTTOM_TABS = [
  { id: 'hunt', label: 'Hunt', icon: '◉' },
  { id: 'findings', label: 'Findings', icon: '⚑' },
  { id: 'chat', label: 'Chat', icon: '✉' },
  { id: 'more', label: 'More', icon: '⋯' },
];

/** Touch-only devices get this gesture guide instead of the shortcuts page. */
export const GESTURE_GUIDE = [
  { gesture: 'swipe-right', label: 'Swipe right — mark finding reviewed', icon: '→' },
  { gesture: 'swipe-left', label: 'Swipe left — snooze finding', icon: '←' },
  { gesture: 'pull-down', label: 'Pull down — refresh the list', icon: '↓' },
  { gesture: 'pinch', label: 'Pinch — zoom evidence screenshots', icon: '⤢' },
  { gesture: 'long-press', label: 'Long press — open quick actions', icon: '●' },
];

// ---------------------------------------------------------------------------
// Wave 16 idea registry (50601–50640)
// ---------------------------------------------------------------------------

export const WAVE16_IDEAS = [
  {
    id: 50601,
    title: 'Status-change flash',
    status: 'shipped',
    note: 'Step rows flash the new status color, then settle.',
    component: 'StatusFlashRow',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50602,
    title: 'Chat typing pulse',
    status: 'skip',
    note: 'Already live: ThinkingDots in MicroMotion.jsx (idea 50573, wave 15) — three dots with staggered opacity.',
    component: null,
    module: null,
  },
  {
    id: 50603,
    title: 'Avatar ring progress',
    status: 'shipped',
    note: 'SVG progress ring with stroke-dashoffset transition.',
    component: 'AvatarRingProgress',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50604,
    title: 'Reconnect banner slide',
    status: 'shipped',
    note: 'Catching-up banner slides down from the header on reconnect.',
    component: 'ReconnectBanner',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50605,
    title: 'Checkbox spring draw',
    status: 'shipped',
    note: 'Checkmark draws with a spring-overshoot pop.',
    component: 'SpringCheckbox',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50606,
    title: 'Sort-arrow flip',
    status: 'shipped',
    note: '200ms rotation flip on direction change.',
    component: 'SortArrowButton',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50607,
    title: 'Thumbnail cascade',
    status: 'shipped',
    note: 'Report thumbnails stagger-rise on preview open.',
    component: 'ThumbnailCascade',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50608,
    title: 'Pause-play morph',
    status: 'shipped',
    note: 'Pause button cross-fades the icon and slides the label.',
    component: 'PausePlayMorph',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50609,
    title: 'Animation time budget',
    status: 'shipped',
    note: 'New: 400ms cap helper (capMotionMs) + .rs-cap CSS guard. Reduced-motion guards already live via 50503/mm-reduced-motion.',
    component: 'MotionBudgetDemo',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50610,
    title: 'Mobile single-column hunt',
    status: 'shipped',
    note: 'Small screens stack the hunt to one column with a compact stepper.',
    component: 'MobileSingleColumnHunt',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50611,
    title: 'Mobile bottom tab bar',
    status: 'shipped',
    note: 'Hunt/Findings/Chat/More tabs with safe-area padding.',
    component: 'MobileBottomTabBar',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50612,
    title: 'Swipeable finding rows',
    status: 'shipped',
    note: 'Swipe-to-reveal review actions on mobile cards.',
    component: 'SwipeableFindingRow',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50613,
    title: 'Collapsible mobile timeline',
    status: 'shipped',
    note: 'Vertical feed with a sticky "now" marker and collapsible phases.',
    component: 'CollapsibleMobileTimeline',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50614,
    title: 'Filter FAB sheet',
    status: 'shipped',
    note: 'Floating action button opens the bottom-sheet filter panel. (50227 shipped the sheet pattern; this adds the FAB trigger.)',
    component: 'FilterFabSheet',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50615,
    title: 'Single-column widgets',
    status: 'shipped',
    note: 'One column on phones, most-used widgets first.',
    component: 'SingleColumnWidgets',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50616,
    title: 'Mobile terminal view',
    status: 'shipped',
    note: 'Monospace-optimized terminal with scroll locking.',
    component: 'MobileTerminalView',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50617,
    title: 'Tablet two-pane layout',
    status: 'shipped',
    note: 'Findings list + detail with a draggable divider.',
    component: 'TabletTwoPane',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50618,
    title: '48px touch chips',
    status: 'shipped',
    note: 'Severity chips at 48px minimum with press feedback.',
    component: 'TouchChips',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50619,
    title: 'Paginated mobile reports',
    status: 'shipped',
    note: 'Reports as paginated cards instead of a wide PDF view.',
    component: 'PaginatedMobileReports',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50620,
    title: 'Full-screen mobile chat',
    status: 'shipped',
    note: 'Full-height chat with safe-area-aware input and dvh sizing.',
    component: 'MobileChatFullscreen',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50621,
    title: 'Card-list tables',
    status: 'shipped',
    note: 'Tables collapse to card lists below 720px.',
    component: 'CardListTable',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50622,
    title: 'Condensed mobile header',
    status: 'shipped',
    note: 'Logo, hunt status pill, and an overflow menu.',
    component: 'CondensedMobileHeader',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50623,
    title: 'Pinch-zoom evidence',
    status: 'shipped',
    note: 'Evidence screenshots pinch-to-zoom with clamped pan.',
    component: 'PinchZoomEvidence',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50624,
    title: 'Slim mobile offline banner',
    status: 'shipped',
    note: 'Single-line offline banner with icon + retry. (50364 is the full queue banner; this is the slim mobile variant.)',
    component: 'SlimOfflineBanner',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50625,
    title: 'Repositioned tour steps',
    status: 'shipped',
    note: 'Tour popovers dock above CTAs and the tab bar on small screens.',
    component: 'MobileTourSteps',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50626,
    title: 'Bottom mobile toasts',
    status: 'shipped',
    note: 'Toasts dock bottom on mobile, top on desktop.',
    component: 'AdaptiveToast',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50627,
    title: 'Full-screen mobile palette',
    status: 'shipped',
    note: 'Command palette becomes a full-screen search sheet on mobile. (50235 is the desktop palette.)',
    component: 'MobilePaletteSheet',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50628,
    title: 'Landscape stepper visibility',
    status: 'shipped',
    note: 'Compact phase stepper stays above the fold in landscape.',
    component: 'LandscapeStepper',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50629,
    title: 'Foldable-device spanning',
    status: 'shipped',
    note: 'Detail pane moves to the second screen area when spanning.',
    component: 'FoldableSpanLayout',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50630,
    title: '320px minimum support',
    status: 'shipped',
    note: 'Layout audit: no horizontal page scroll at 320px.',
    component: 'TinyViewportDemo',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50631,
    title: 'Tablet portrait split',
    status: 'shipped',
    note: '40/60 list-detail split with a collapsible list.',
    component: 'TabletPortraitSplit',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50632,
    title: 'Dynamic viewport units',
    status: 'shipped',
    note: 'dvh sizing with vh fallback so chrome never clips chat input.',
    component: 'DynamicViewportDemo',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50633,
    title: 'Fluid type scale',
    status: 'shipped',
    note: '14px mobile base scaling to 16px desktop via clamp().',
    component: 'FluidTypeDemo',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50634,
    title: 'Code-wrap toggle',
    status: 'shipped',
    note: 'Wrap-lines toggle for evidence code on narrow screens.',
    component: 'CodeWrapToggle',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50635,
    title: 'Sticky mobile CTA',
    status: 'shipped',
    note: 'Start Hunt stays visible while scrolling.',
    component: 'StickyMobileCta',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50636,
    title: 'Auto-fit widget grid',
    status: 'shipped',
    note: 'CSS grid auto-fit minmax(280px, 1fr).',
    component: 'AutoFitWidgetGrid',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50637,
    title: 'Pull-to-refresh lists',
    status: 'shipped',
    note: 'Real pull state machine: idle -> pulling -> ready -> refresh.',
    component: 'PullToRefreshList',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50638,
    title: 'Adaptive log density',
    status: 'shipped',
    note: 'Compact mobile rows, full desktop rows.',
    component: 'AdaptiveLogList',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50639,
    title: 'Gesture guide',
    status: 'shipped',
    note: 'Touch-only devices get a gesture guide instead of the shortcuts page.',
    component: 'GestureGuide',
    module: 'ResponsiveSuite.jsx',
  },
  {
    id: 50640,
    title: 'Swipe triage gestures',
    status: 'shipped',
    note: 'Swipe right = reviewed, swipe left = snooze.',
    component: 'SwipeTriage',
    module: 'ResponsiveSuite.jsx',
  },
];

export function wave16RegistryComplete() {
  const ids = WAVE16_IDEAS.map(i => i.id);
  const expected = Array.from({ length: 40 }, (_, k) => 50601 + k);
  return expected.every(id => ids.includes(id)) && ids.length === 40;
}
