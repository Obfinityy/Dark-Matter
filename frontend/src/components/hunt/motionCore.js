/**
 * motionCore.js — Forge wave 15 (ideas 50561–50600).
 *
 * Micro-interaction + motion-design round: real, testable timing/easing/math
 * helpers behind the mm-* micro-motion components (MicroMotion.jsx/.css).
 *
 * Every animation in this suite respects `prefers-reduced-motion` via the
 * `.mm-reduced-motion` class and the CSS media query guard — no motion fires
 * for users who opted out (consistent with idea 50503, shipped in wave 13).
 */

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Read the OS-level reduced-motion preference. Safe in Node (returns false).
 */
export function shouldReduceMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// ---------------------------------------------------------------------------
// Easing functions (unitless, t in [0,1])
// ---------------------------------------------------------------------------

export function easeOutCubic(t) {
  const u = clamp01(t);
  return 1 - Math.pow(1 - u, 3);
}

export function easeInOutCubic(t) {
  const u = clamp01(t);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

export function easeOutBack(t) {
  // Gentle overshoot for pop/bounce entrances (50571, 50593).
  const u = clamp01(t);
  const c1 = 1.30158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

/**
 * Damped-spring approximation for 0→1 settle curves (50586 graph nodes).
 * t in seconds. stiffness/damping tuned so the value settles ≈1 within ~0.8s.
 */
export function springValue(t, stiffness = 170, damping = 18) {
  const clamped = Math.max(0, t);
  const w = Math.sqrt(stiffness);
  const z = damping / (2 * Math.sqrt(stiffness));
  const wd = w * Math.sqrt(Math.max(0, 1 - z * z));
  if (z >= 1) return 1 - Math.exp(-w * clamped);
  const envelope = Math.exp(-z * w * clamped);
  return 1 - envelope * (Math.cos(wd * clamped) + ((z * w) / wd) * Math.sin(wd * clamped));
}

export function clamp01(v) {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

// ---------------------------------------------------------------------------
// 50561 — self-drawing checkmark (SVG stroke animation)
// ---------------------------------------------------------------------------

/**
 * Compute stroke-dasharray/offset pairs for a self-drawing polyline path.
 * `segments` = array of { path: string, length: number } in draw order.
 */
export function checkmarkDrawProps(segments) {
  return segments.map((seg) => ({
    path: seg.path,
    strokeDasharray: `${seg.length}`,
    // Start fully hidden (offset = length), animate to 0 via CSS transition.
    strokeDashoffset: `${seg.length}`,
  }));
}

/** Standard check mark geometry (viewBox 24x24), returns dash props. */
export function standardCheckmarkProps() {
  return checkmarkDrawProps([
    { path: 'M6 12.5l4.2 4.2L18 8.5', length: 14.5 },
    { path: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', length: 56.6 },
  ]);
}

// ---------------------------------------------------------------------------
// 50566 — stat count-up (0 → value over 800ms)
// ---------------------------------------------------------------------------

export const COUNTUP_DURATION_MS = 800;

/**
 * Compute the frame sequence for a count-up animation.
 * Returns { frames: number[], durationMs, fps }.
 */
export function countUpFrames(target, { durationMs = COUNTUP_DURATION_MS, fps = 30 } = {}) {
  const frames = [];
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  for (let i = 1; i <= totalFrames; i++) {
    frames.push(Math.round(easeOutCubic(i / totalFrames) * target));
  }
  frames[frames.length - 1] = target; // land exactly
  return { frames, durationMs, fps, frameCount: frames.length };
}

// ---------------------------------------------------------------------------
// 50573 — thinking-dot wave (staggered bounce delays)
// ---------------------------------------------------------------------------

export const THINKING_DOT_COUNT = 3;
export const THINKING_DOT_PERIOD_MS = 1200;

export function thinkingDotDelayMs(index, periodMs = THINKING_DOT_PERIOD_MS) {
  return Math.round((index % THINKING_DOT_COUNT) * (periodMs / THINKING_DOT_COUNT));
}

// ---------------------------------------------------------------------------
// 50577 — severity donut segment sweep
// ---------------------------------------------------------------------------

/**
 * Convert severity counts into SVG donut segments with sweep-in offsets.
 * r = radius, circumference C = 2πr. Each segment gets stroke-dasharray
 * "len C" and an animation delay so segments sweep in one after another.
 */
export function donutSegments(counts, radius = 54) {
  const C = 2 * Math.PI * radius;
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const ORDER = ['critical', 'high', 'medium', 'low', 'info'];
  const segments = [];
  for (const key of ORDER) {
    const value = counts[key] || 0;
    if (value <= 0) continue;
    const frac = value / total;
    segments.push({
      key,
      value,
      frac,
      strokeDasharray: `${(frac * C).toFixed(2)} ${C.toFixed(2)}`,
      strokeDashoffset: `${(-acc * C).toFixed(2)}`,
      sweepDelayMs: segments.length * 120,
    });
    acc += frac;
  }
  return { segments, circumference: C, total };
}

// ---------------------------------------------------------------------------
// 50582 — gauge needle sweep (0–10 risk → -90°…+90°)
// ---------------------------------------------------------------------------

export function gaugeNeedleDegrees(score) {
  const s = Math.min(10, Math.max(0, Number(score) || 0));
  return -90 + (s / 10) * 180;
}

export const GAUGE_SWEEP_DURATION_MS = 900;

// ---------------------------------------------------------------------------
// 50584 — staggered search-result entrances
// ---------------------------------------------------------------------------

export const STAGGER_STEP_MS = 30;
export const STAGGER_MAX_MS = 600;

export function staggerDelayMs(index, stepMs = STAGGER_STEP_MS) {
  return Math.min(index * stepMs, STAGGER_MAX_MS);
}

// ---------------------------------------------------------------------------
// 50568 — toast slide-fade timing
// ---------------------------------------------------------------------------

export const TOAST_ENTER_MS = 240;
export const TOAST_EXIT_MS = 200;

// ---------------------------------------------------------------------------
// 50569 — diagonal skeleton sweep (1.2s loop)
// ---------------------------------------------------------------------------

export const SKELETON_SWEEP_MS = 1200;

// ---------------------------------------------------------------------------
// 50570 — terminal line fade (40% → 100% over 200ms)
// ---------------------------------------------------------------------------

export const TERMINAL_LINE_FADE_MS = 200;

// ---------------------------------------------------------------------------
// 50581 — completion ring pulse on hunt completion
// ---------------------------------------------------------------------------

export const COMPLETION_PULSE_MS = 1600;

// ---------------------------------------------------------------------------
// 50589 — floating empty illustration (±6px, 4s loop)
// ---------------------------------------------------------------------------

export const FLOAT_RANGE_PX = 6;
export const FLOAT_PERIOD_MS = 4000;

export function floatOffsetPx(tMs) {
  return FLOAT_RANGE_PX * Math.sin((2 * Math.PI * tMs) / FLOAT_PERIOD_MS);
}

// ---------------------------------------------------------------------------
// 50599 — sidebar width animation (280px ↔ 64px)
// ---------------------------------------------------------------------------

export const SIDEBAR_WIDTH_OPEN_PX = 280;
export const SIDEBAR_WIDTH_CLOSED_PX = 64;

// ---------------------------------------------------------------------------
// 50600 — evidence thumbnail zoom (1.08 with overlay fade)
// ---------------------------------------------------------------------------

export const THUMB_ZOOM_SCALE = 1.08;

// ---------------------------------------------------------------------------
// 50563 — button press feedback (0.97 for 80ms)
// ---------------------------------------------------------------------------

export const PRESS_SCALE = 0.97;
export const PRESS_HOLD_MS = 80;

// ---------------------------------------------------------------------------
// 50562 — pill hover scale 1.05
// ---------------------------------------------------------------------------

export const PILL_HOVER_SCALE = 1.05;

// ---------------------------------------------------------------------------
// 50574 — card hover lift (2px / 150ms)
// ---------------------------------------------------------------------------

export const CARD_LIFT_PX = 2;
export const CARD_LIFT_MS = 150;

// ---------------------------------------------------------------------------
// 50575 — modal scale-in (0.96 → 1, backdrop 150ms fade)
// ---------------------------------------------------------------------------

export const MODAL_SCALE_FROM = 0.96;
export const MODAL_SCALE_TO = 1;
export const MODAL_FADE_MS = 150;

// ---------------------------------------------------------------------------
// 50597 — invalid-input shake (4px over 300ms)
// ---------------------------------------------------------------------------

export const SHAKE_DISTANCE_PX = 4;
export const SHAKE_DURATION_MS = 300;

export function shakeKeyframes(distancePx = SHAKE_DISTANCE_PX) {
  const d = distancePx;
  return [
    { transform: 'translateX(0)', offset: 0 },
    { transform: `translateX(-${d}px)`, offset: 0.2 },
    { transform: `translateX(${d}px)`, offset: 0.4 },
    { transform: `translateX(-${d * 0.75}px)`, offset: 0.6 },
    { transform: `translateX(${d * 0.5}px)`, offset: 0.8 },
    { transform: 'translateX(0)', offset: 1 },
  ];
}

// ---------------------------------------------------------------------------
// 50598 — save checkmark: draw, hold 1.2s, fade
// ---------------------------------------------------------------------------

export const SAVE_HOLD_MS = 1200;

// ---------------------------------------------------------------------------
// 50585 — theme cross-fade (250ms)
// ---------------------------------------------------------------------------

export const THEME_CROSSFADE_MS = 250;

// ---------------------------------------------------------------------------
// 50592 — route fade-rise (180ms, 8px up)
// ---------------------------------------------------------------------------

export const ROUTE_FADE_MS = 180;
export const ROUTE_RISE_PX = 8;

// ---------------------------------------------------------------------------
// 50590 — focus-ring draw (120ms outline-offset transition)
// ---------------------------------------------------------------------------

export const FOCUS_RING_DRAW_MS = 120;

// ---------------------------------------------------------------------------
// 50596 — chip fill wipe (left-to-right color wipe)
// ---------------------------------------------------------------------------

export const CHIP_WIPE_MS = 220;

// ---------------------------------------------------------------------------
// 50594 — reasoning-section height animation target
// ---------------------------------------------------------------------------

/**
 * Measure-based height animation helper: given a content node, return the
 * inline style that expands it smoothly instead of jumping open.
 */
export function reasoningHeightStyle(contentHeightPx, open) {
  return {
    height: open ? `${Math.max(0, contentHeightPx)}px` : '0px',
    overflow: 'hidden',
    transition: 'height 240ms ease-out',
  };
}

// ---------------------------------------------------------------------------
// Wave-15 idea registry (all 40 ideas, 50561–50600)
// ---------------------------------------------------------------------------

export const WAVE15_IDEAS = [
  { id: 50561, title: 'Self-drawing checkmark', component: 'SelfDrawingCheckmark', module: 'MicroMotion.jsx' },
  { id: 50562, title: 'Pill hover scale', component: 'HoverPill', module: 'MicroMotion.jsx' },
  { id: 50563, title: 'Button press feedback', component: 'PressButton', module: 'MicroMotion.jsx' },
  { id: 50564, title: 'Sliding tab indicator', component: 'SlidingTabs', module: 'MicroMotion.jsx' },
  { id: 50565, title: 'Chevron rotation', component: 'RotatingChevron', module: 'MicroMotion.jsx' },
  { id: 50566, title: 'Stat count-up', component: 'CountUpStat', module: 'MicroMotion.jsx' },
  { id: 50567, title: 'Progress shimmer sweep', component: 'ShimmerProgress', module: 'MicroMotion.jsx' },
  { id: 50568, title: 'Toast slide-fade', component: 'SlideFadeToast', module: 'MicroMotion.jsx' },
  { id: 50569, title: 'Diagonal skeleton sweep', component: 'DiagonalSkeleton', module: 'MicroMotion.jsx' },
  { id: 50570, title: 'Terminal line fade', component: 'TerminalLine', module: 'MicroMotion.jsx' },
  { id: 50571, title: 'Timeline dot pop', component: 'TimelineDot', module: 'MicroMotion.jsx' },
  { id: 50572, title: 'Filter-pill morph', component: 'MorphPill', module: 'MicroMotion.jsx' },
  { id: 50573, title: 'Thinking-dot wave', component: 'ThinkingDots', module: 'MicroMotion.jsx' },
  { id: 50574, title: 'Card hover lift', component: 'LiftCard', module: 'MicroMotion.jsx' },
  { id: 50575, title: 'Modal scale-in', component: 'ScaleModal', module: 'MicroMotion.jsx' },
  { id: 50576, title: 'Confidence fill ease', component: 'ConfidenceFill', module: 'MicroMotion.jsx' },
  { id: 50577, title: 'Donut segment sweep', component: 'DonutSweep', module: 'MicroMotion.jsx' },
  { id: 50578, title: 'Drop-zone pulse', component: 'PulseDropZone', module: 'MicroMotion.jsx' },
  { id: 50579, title: 'Spring toggles', component: 'SpringToggle', module: 'MicroMotion.jsx' },
  { id: 50580, title: 'Smooth auto-scroll', component: 'SmoothScroller', module: 'MicroMotion.jsx' },
  { id: 50581, title: 'Completion ring pulse', component: 'CompletionRing', module: 'MicroMotion.jsx' },
  { id: 50582, title: 'Gauge needle sweep', component: 'GaugeNeedle', module: 'MicroMotion.jsx' },
  { id: 50583, title: 'Ribbon slide-in', component: 'NewRibbon', module: 'MicroMotion.jsx' },
  { id: 50584, title: 'Staggered search results', component: 'StaggerList', module: 'MicroMotion.jsx' },
  { id: 50585, title: 'Theme cross-fade', component: 'ThemeCrossFader', module: 'MicroMotion.jsx' },
  { id: 50586, title: 'Graph node settle', component: 'SettlingNodes', module: 'MicroMotion.jsx' },
  { id: 50587, title: 'Copy-button morph', component: 'MorphCopyButton', module: 'MicroMotion.jsx' },
  { id: 50588, title: 'Dual-ring spinner', component: 'DualRingSpinner', module: 'MicroMotion.jsx' },
  { id: 50589, title: 'Floating empty illustration', component: 'FloatingIllustration', module: 'MicroMotion.jsx' },
  { id: 50590, title: 'Focus-ring draw', component: 'FocusRingDemo', module: 'MicroMotion.jsx' },
  { id: 50591, title: 'Sticky-bar shadow', component: 'StickyFilterBar', module: 'MicroMotion.jsx' },
  { id: 50592, title: 'Route fade-rise', component: 'RouteFadeRise', module: 'MicroMotion.jsx' },
  { id: 50593, title: 'Badge count pop', component: 'PopBadge', module: 'MicroMotion.jsx' },
  { id: 50594, title: 'Height-animated reasoning', component: 'AnimatedReasoning', module: 'MicroMotion.jsx' },
  { id: 50595, title: 'Scrubber handle grow', component: 'GrowingScrubber', module: 'MicroMotion.jsx' },
  { id: 50596, title: 'Chip fill wipe', component: 'WipeChip', module: 'MicroMotion.jsx' },
  { id: 50597, title: 'Invalid-input shake', component: 'ShakeInput', module: 'MicroMotion.jsx' },
  { id: 50598, title: 'Save checkmark draw', component: 'SaveCheckmark', module: 'MicroMotion.jsx' },
  { id: 50599, title: 'Sidebar width animation', component: 'AnimatedSidebar', module: 'MicroMotion.jsx' },
  { id: 50600, title: 'Thumbnail zoom hover', component: 'ZoomThumbnail', module: 'MicroMotion.jsx' },
];

export function wave15RegistryComplete() {
  const ids = WAVE15_IDEAS.map((i) => i.id);
  const expected = Array.from({ length: 40 }, (_, k) => 50561 + k);
  return expected.every((id) => ids.includes(id)) && ids.length === 40;
}
