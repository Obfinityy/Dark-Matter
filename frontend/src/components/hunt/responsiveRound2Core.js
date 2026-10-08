/**
 * responsiveRound2Core.js — Infinity AI · Forge wave 17 (ideas 50641–50659).
 *
 * Pure, DOM-free logic behind the r2-* responsive round-2 components
 * (ResponsiveRound2.jsx/.css): long-press timing, touch/hybrid capability
 * detection, Save-Data / network degradation tiers, swipeable-carousel
 * pagination math, orientation-change scroll preservation helpers,
 * desktop-site-toggle resolution, large-slider value math, container-query
 * support detection with a column fallback, and per-viewport focus orders.
 *
 * Reuses the wave-16 breakpoint classifiers from responsiveCore.js rather
 * than redefining them, and re-exports the shared WAVE17_IDEAS registry
 * from themeCore.js (a single registry for both wave-17 modules).
 *
 * ESM with no DOM access at import time — every window/document/navigator
 * touch is guarded so this module loads and tests cleanly under Node.
 */

import {
  isMobileWidth,
  isTabletWidth,
  isDesktopWidth,
  viewportKind,
  orientationOf,
  MOBILE_MAX_PX,
  TABLET_MIN_PX,
  TABLET_MAX_PX,
  DESKTOP_MIN_PX,
} from './responsiveCore.js';

export {
  isMobileWidth,
  isTabletWidth,
  isDesktopWidth,
  viewportKind,
  orientationOf,
  MOBILE_MAX_PX,
  TABLET_MIN_PX,
  TABLET_MAX_PX,
  DESKTOP_MIN_PX,
};

export { WAVE17_IDEAS, wave17RegistryComplete } from './themeCore.js';

// ---------------------------------------------------------------------------
// Touch / hybrid capability detection (50646)
// ---------------------------------------------------------------------------

/** True when the primary input is coarse (finger). Node-safe: false. */
export function hasCoarsePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/** True when the device can hover (mouse/trackpad). Node-safe: false. */
export function hasFineHover() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(hover: hover)').matches;
  } catch {
    return false;
  }
}

/**
 * 'hybrid' — touch + hover both (convertible tablets, touch laptops);
 * 'touch' — finger only; 'mouse' — hover only / unknown.
 * Accepts injected readings so it is testable without a DOM.
 */
export function hybridUiMode({ width, coarse = hasCoarsePointer(), hover = hasFineHover() } = {}) {
  if (coarse && hover) return 'hybrid';
  if (coarse) return 'touch';
  if (
    Number.isFinite(width) &&
    isTabletWidth(width) &&
    typeof navigator !== 'undefined' &&
    navigator.maxTouchPoints > 0
  )
    return 'hybrid';
  return 'mouse';
}

// ---------------------------------------------------------------------------
// Long press (50641)
// ---------------------------------------------------------------------------

/** Hold duration that arms the quick menu. */
export const LONG_PRESS_MS = 500;
/** Pointer may drift this far before the press is cancelled. */
export const LONG_PRESS_SLOP_PX = 12;

export function longPressReady(elapsedMs) {
  return Number.isFinite(elapsedMs) && elapsedMs >= LONG_PRESS_MS;
}

export function longPressMoved(dx, dy) {
  return Math.hypot(dx || 0, dy || 0) > LONG_PRESS_SLOP_PX;
}

// ---------------------------------------------------------------------------
// Save-Data / network degradation (50649)
// ---------------------------------------------------------------------------

/** True when the browser reports Save-Data. Node-safe: false. */
export function saveDataEnabled() {
  try {
    if (typeof navigator === 'undefined' || !navigator.connection) return false;
    return navigator.connection.saveData === true;
  } catch {
    return false;
  }
}

/** 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'. Node-safe: 'unknown'. */
export function effectiveConnectionType() {
  try {
    if (typeof navigator === 'undefined' || !navigator.connection) return 'unknown';
    return navigator.connection.effectiveType || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Degradation tier: 'full' (no change), 'reduced' (kill heavy animation,
 * blur, big shadows), 'minimal' (also drop decorative media).
 * A manual `forced` tier overrides detection (used by the demo toggle).
 */
export function degradeTier({
  saveData = saveDataEnabled(),
  effectiveType = effectiveConnectionType(),
  forced = null,
} = {}) {
  if (forced === 'reduced' || forced === 'minimal') return forced;
  if (saveData) return effectiveType === '4g' ? 'reduced' : 'minimal';
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'minimal';
  if (effectiveType === '3g') return 'reduced';
  return 'full';
}

/** CSS class a shell applies for the tier. */
export function degradeClassForTier(tier) {
  return tier === 'minimal' ? 'r2-degrade-minimal' : tier === 'reduced' ? 'r2-degrade-reduced' : '';
}

// ---------------------------------------------------------------------------
// Swipeable phase carousel (50651)
// ---------------------------------------------------------------------------

export function carouselPageCount(itemCount, perView = 1) {
  const n = Math.max(0, Math.floor(itemCount || 0));
  const pv = Math.max(1, Math.floor(perView || 1));
  return Math.max(1, Math.ceil(n / pv));
}

export function clampCarouselIndex(index, pageCount) {
  const pc = Math.max(1, pageCount || 1);
  if (!Number.isFinite(index)) return 0;
  return Math.min(pc - 1, Math.max(0, Math.floor(index)));
}

/** Translate % for the track when showing page `index`. */
export function carouselOffsetPct(index) {
  return -(Math.max(0, index || 0) * 100);
}

/** Next index after a horizontal swipe (positive dx = swipe right = back). */
export function carouselIndexAfterSwipe(index, dx, pageCount, thresholdPx = 48) {
  if (Math.abs(dx) < thresholdPx) return clampCarouselIndex(index, pageCount);
  const next = dx > 0 ? index - 1 : index + 1;
  return clampCarouselIndex(next, pageCount);
}

// ---------------------------------------------------------------------------
// Orientation-safe scroll (50644)
// ---------------------------------------------------------------------------

/**
 * Pure key describing the current viewport geometry; the scroller uses it
 * to detect an orientation change between capture and restore.
 */
export function scrollGeometryKey(width, height) {
  return `${viewportKind(width)}:${orientationOf(width, height)}:${width | 0}x${height | 0}`;
}

/**
 * Snapshot helper: capture() stores scroll offsets plus the ids of open
 * cards; restore() scrolls back and returns the open-card ids so the UI
 * can reopen them. All window access is guarded for Node.
 */
export function makeScrollPreserver() {
  let snapshot = null;
  return {
    capture(openCardIds = []) {
      const x = typeof window !== 'undefined' ? window.scrollX || 0 : 0;
      const y = typeof window !== 'undefined' ? window.scrollY || 0 : 0;
      const key =
        typeof window !== 'undefined'
          ? scrollGeometryKey(window.innerWidth, window.innerHeight)
          : 'unknown';
      snapshot = { x, y, key, openCardIds: [...openCardIds] };
      return snapshot;
    },
    restore() {
      if (!snapshot) return null;
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        try {
          window.scrollTo(snapshot.x, snapshot.y);
        } catch {
          /* scroll restore is best-effort */
        }
      }
      return { x: snapshot.x, y: snapshot.y, openCardIds: [...snapshot.openCardIds] };
    },
    peek() {
      return snapshot ? { ...snapshot, openCardIds: [...snapshot.openCardIds] } : null;
    },
  };
}

// ---------------------------------------------------------------------------
// Desktop-site toggle (50656)
// ---------------------------------------------------------------------------

export const FORCE_DESKTOP_CLASS = 'r2-force-desktop';

/** Storage-backed toggle; storage injected for Node tests. */
export function makeDesktopSiteStore(storage) {
  const mem = new Map();
  const backend = storage && typeof storage.getItem === 'function' ? storage : null;
  const KEY = 'infinity.desktopSite.v1';
  return {
    enabled() {
      try {
        const raw = backend ? backend.getItem(KEY) : (mem.get(KEY) ?? null);
        return raw === '1';
      } catch {
        return false;
      }
    },
    setEnabled(on) {
      try {
        if (backend) backend.setItem(KEY, on ? '1' : '0');
        else mem.set(KEY, on ? '1' : '0');
      } catch {
        /* storage blocked — toggle still applies for the session */
      }
    },
  };
}

/** True when the desktop layout must be forced regardless of width. */
export function shouldForceDesktop({ stored, width }) {
  return stored === true || (Number.isFinite(width) && isDesktopWidth(width));
}

// ---------------------------------------------------------------------------
// Large touch sliders (50654)
// ---------------------------------------------------------------------------

export const LARGE_SLIDER_THUMB_PX = 44;

/**
 * Value at a pointer ratio (0–1) across [min, max], snapped to step and
 * clamped. Pure math — the component wires pointer events to it.
 */
export function sliderValueAt({ min = 0, max = 100, step = 1, ratio = 0 }) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const st = step > 0 ? step : 1;
  const r = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const raw = lo + r * (hi - lo);
  const snapped = Math.round((raw - lo) / st) * st + lo;
  return Math.min(hi, Math.max(lo, snapped));
}

/** Ratio (0–1) of a value across the range — for thumb positioning. */
export function sliderRatioFor({ min = 0, max = 100, value = 0 }) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (hi === lo) return 0;
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

// ---------------------------------------------------------------------------
// Container queries (50658)
// ---------------------------------------------------------------------------

/** True when the browser supports @container queries. Node-safe: false. */
export function containerQueriesSupported() {
  try {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
    return CSS.supports('container-type', 'inline-size');
  } catch {
    return false;
  }
}

/** Fallback column count when @container is unavailable (widget width px). */
export function widgetColumnsFallback(containerWidthPx) {
  if (!Number.isFinite(containerWidthPx)) return 1;
  if (containerWidthPx >= 720) return 3;
  if (containerWidthPx >= 420) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Responsive focus order (50657)
// ---------------------------------------------------------------------------

/**
 * Tab order of landmark regions per viewport: on mobile the tab bar and
 * the main column come before secondary rails; on desktop the nav rail
 * precedes main. 50519/50466 proved order correctness — this is the
 * per-layout order those checks validate against.
 */
export function focusOrderForViewport(width) {
  const kind = viewportKind(width);
  if (kind === 'mobile') return ['header', 'tabbar', 'main', 'sections', 'fab'];
  if (kind === 'tablet') return ['header', 'nav', 'main', 'aside', 'tabbar'];
  return ['header', 'nav', 'main', 'aside', 'footer'];
}

// ---------------------------------------------------------------------------
// OS text-size respect (50648)
// ---------------------------------------------------------------------------

export const ROOT_FONT_MIN_PX = 12;
export const ROOT_FONT_MAX_PX = 24;
export const ROOT_FONT_DEFAULT_PX = 16;

/** Clamp a requested root font size into the sane range. */
export function clampRootFontSize(px) {
  if (!Number.isFinite(px)) return ROOT_FONT_DEFAULT_PX;
  return Math.min(ROOT_FONT_MAX_PX, Math.max(ROOT_FONT_MIN_PX, Math.round(px)));
}

/** px value → rem string at the given root size. */
export function pxToRem(px, rootPx = ROOT_FONT_DEFAULT_PX) {
  const root = clampRootFontSize(rootPx);
  return `${(px / root).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}rem`;
}

// ---------------------------------------------------------------------------
// Tested widths (50659)
// ---------------------------------------------------------------------------

export const TESTED_MIN_WIDTH_PX = 360;
export const TESTED_MAX_WIDTH_PX = 2560;

export function testedWidthLabel() {
  return `Optimized for ${TESTED_MIN_WIDTH_PX}px → ${TESTED_MAX_WIDTH_PX}px`;
}
