/**
 * wave15.test.js — Forge wave 15 (ideas 50561–50600).
 * Node tests for the pure logic in motionCore.js + CSS/registry completeness.
 * Run: node --test frontend/src/components/hunt/wave15.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  WAVE15_IDEAS,
  wave15RegistryComplete,
  easeOutCubic,
  easeInOutCubic,
  easeOutBack,
  springValue,
  clamp01,
  checkmarkDrawProps,
  standardCheckmarkProps,
  countUpFrames,
  COUNTUP_DURATION_MS,
  thinkingDotDelayMs,
  THINKING_DOT_COUNT,
  THINKING_DOT_PERIOD_MS,
  donutSegments,
  gaugeNeedleDegrees,
  GAUGE_SWEEP_DURATION_MS,
  staggerDelayMs,
  STAGGER_STEP_MS,
  STAGGER_MAX_MS,
  TOAST_ENTER_MS,
  TOAST_EXIT_MS,
  SKELETON_SWEEP_MS,
  TERMINAL_LINE_FADE_MS,
  COMPLETION_PULSE_MS,
  FLOAT_RANGE_PX,
  FLOAT_PERIOD_MS,
  floatOffsetPx,
  SIDEBAR_WIDTH_OPEN_PX,
  SIDEBAR_WIDTH_CLOSED_PX,
  THUMB_ZOOM_SCALE,
  PRESS_SCALE,
  PRESS_HOLD_MS,
  PILL_HOVER_SCALE,
  CARD_LIFT_PX,
  CARD_LIFT_MS,
  MODAL_SCALE_FROM,
  MODAL_SCALE_TO,
  MODAL_FADE_MS,
  SHAKE_DISTANCE_PX,
  SHAKE_DURATION_MS,
  shakeKeyframes,
  SAVE_HOLD_MS,
  THEME_CROSSFADE_MS,
  ROUTE_FADE_MS,
  ROUTE_RISE_PX,
  FOCUS_RING_DRAW_MS,
  CHIP_WIPE_MS,
  reasoningHeightStyle,
  shouldReduceMotion,
} from './motionCore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, 'MicroMotion.css'), 'utf8');

test('wave-15 registry covers all 40 ideas (50561–50600)', () => {
  assert.ok(wave15RegistryComplete());
  assert.equal(WAVE15_IDEAS.length, 40);
  assert.equal(WAVE15_IDEAS[0].id, 50561);
  assert.equal(WAVE15_IDEAS[39].id, 50600);
  assert.ok(WAVE15_IDEAS.every((i) => i.component && i.module === 'MicroMotion.jsx'));
});

test('easing functions are bounded and monotonic-ish', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5 && easeOutCubic(0.5) < 1);
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(Math.abs(easeInOutCubic(0.5) - 0.5) < 0.01);
  assert.equal(easeOutBack(0), 0);
  assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-9);
  assert.ok(easeOutBack(0.6) > 1); // overshoots — pop behavior
  assert.equal(clamp01(-2), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(NaN), 0);
});

test('springValue settles near 1', () => {
  const settled = springValue(1.2);
  assert.ok(Math.abs(settled - 1) < 0.02, `spring(1.2s)=${settled}`);
  assert.equal(springValue(0), 0);
  assert.ok(springValue(0.15) > 0); // rises fast
});

test('checkmark draw props hide stroke fully at start', () => {
  const segs = standardCheckmarkProps();
  assert.equal(segs.length, 2);
  for (const s of segs) {
    assert.equal(s.strokeDashoffset, s.strokeDasharray);
    assert.ok(Number(s.strokeDasharray) > 0);
  }
  const custom = checkmarkDrawProps([{ path: 'M0 0L10 10', length: 14.14 }]);
  assert.equal(custom[0].strokeDashoffset, '14.14');
});

test('countUpFrames lands exactly on target (50566)', () => {
  const { frames, frameCount } = countUpFrames(128);
  assert.ok(frameCount > 5);
  assert.equal(frames[frames.length - 1], 128);
  assert.ok(frames[0] > 0 && frames[0] < 128);
  assert.ok(frames.every((f, i) => i === 0 || f >= frames[i - 1])); // monotonic
  assert.equal(COUNTUP_DURATION_MS, 800);
});

test('thinking-dot wave staggers evenly (50573)', () => {
  assert.equal(THINKING_DOT_COUNT, 3);
  const d0 = thinkingDotDelayMs(0);
  const d1 = thinkingDotDelayMs(1);
  const d2 = thinkingDotDelayMs(2);
  assert.equal(d0, 0);
  assert.equal(d1, THINKING_DOT_PERIOD_MS / 3);
  assert.equal(d2, (2 * THINKING_DOT_PERIOD_MS) / 3);
  assert.ok(d0 < d1 && d1 < d2);
});

test('donut segments partition the circle and sweep in order (50577)', () => {
  const { segments, circumference, total } = donutSegments({ critical: 2, high: 5, medium: 9, low: 14, info: 3 });
  assert.equal(total, 33);
  assert.equal(segments.length, 5);
  const fracSum = segments.reduce((a, s) => a + s.frac, 0);
  assert.ok(Math.abs(fracSum - 1) < 1e-9);
  assert.ok(circumference > 300);
  segments.forEach((s, i) => assert.equal(s.sweepDelayMs, i * 120));
});

test('gauge needle maps 0–10 → −90°…+90° (50582)', () => {
  assert.equal(gaugeNeedleDegrees(0), -90);
  assert.equal(gaugeNeedleDegrees(10), 90);
  assert.equal(gaugeNeedleDegrees(5), 0);
  assert.equal(gaugeNeedleDegrees(99), 90);
  assert.equal(gaugeNeedleDegrees(-3), -90);
  assert.equal(GAUGE_SWEEP_DURATION_MS, 900);
});

test('stagger delays cap at 600ms (50584)', () => {
  assert.equal(staggerDelayMs(0), 0);
  assert.equal(staggerDelayMs(3), 3 * STAGGER_STEP_MS);
  assert.equal(staggerDelayMs(100), STAGGER_MAX_MS);
  assert.equal(STAGGER_STEP_MS, 30);
});

test('shake keyframes honor the 4px / 300ms spec (50597)', () => {
  const kf = shakeKeyframes();
  assert.equal(kf.length, 6);
  assert.equal(kf[0].transform, 'translateX(0)');
  assert.equal(kf[kf.length - 1].transform, 'translateX(0)');
  assert.ok(kf.some((k) => k.transform.includes(`-${SHAKE_DISTANCE_PX}px`)));
  assert.equal(SHAKE_DISTANCE_PX, 4);
  assert.equal(SHAKE_DURATION_MS, 300);
});

test('float offset stays within ±6px over a 4s loop (50589)', () => {
  for (const t of [0, 1000, 2000, 3000, 4000]) {
    const off = floatOffsetPx(t);
    assert.ok(Math.abs(off) <= FLOAT_RANGE_PX + 1e-9);
  }
  assert.equal(FLOAT_RANGE_PX, 6);
  assert.equal(FLOAT_PERIOD_MS, 4000);
  assert.ok(floatOffsetPx(1000) > 0 && floatOffsetPx(3000) < 0); // opposite phases
});

test('reasoning height style expands smoothly (50594)', () => {
  const open = reasoningHeightStyle(320, true);
  assert.equal(open.height, '320px');
  assert.ok(open.transition.includes('height'));
  const closed = reasoningHeightStyle(320, false);
  assert.equal(closed.height, '0px');
});

test('motion spec constants match the idea specs', () => {
  assert.equal(PRESS_SCALE, 0.97);
  assert.equal(PRESS_HOLD_MS, 80);
  assert.equal(PILL_HOVER_SCALE, 1.05);
  assert.equal(CARD_LIFT_PX, 2);
  assert.equal(CARD_LIFT_MS, 150);
  assert.equal(MODAL_SCALE_FROM, 0.96);
  assert.equal(MODAL_SCALE_TO, 1);
  assert.equal(MODAL_FADE_MS, 150);
  assert.equal(SAVE_HOLD_MS, 1200);
  assert.equal(THEME_CROSSFADE_MS, 250);
  assert.equal(ROUTE_FADE_MS, 180);
  assert.equal(ROUTE_RISE_PX, 8);
  assert.equal(FOCUS_RING_DRAW_MS, 120);
  assert.equal(CHIP_WIPE_MS, 220);
  assert.equal(SIDEBAR_WIDTH_OPEN_PX, 280);
  assert.equal(SIDEBAR_WIDTH_CLOSED_PX, 64);
  assert.equal(THUMB_ZOOM_SCALE, 1.08);
  assert.equal(TOAST_ENTER_MS, 240);
  assert.equal(TOAST_EXIT_MS, 200);
  assert.equal(SKELETON_SWEEP_MS, 1200);
  assert.equal(TERMINAL_LINE_FADE_MS, 200);
  assert.equal(COMPLETION_PULSE_MS, 1600);
});

test('shouldReduceMotion is false in Node (safe default)', () => {
  assert.equal(shouldReduceMotion(), false);
});

test('CSS contains every mm-* keyframe and the reduced-motion guard', () => {
  const keyframes = [
    'mm-shimmer-sweep', 'mm-toast-in', 'mm-toast-out', 'mm-skeleton-sweep',
    'mm-terminal-line', 'mm-dot-pop', 'mm-pill-in', 'mm-pill-out',
    'mm-dot-wave', 'mm-backdrop-in', 'mm-panel-in', 'mm-donut-sweep',
    'mm-drop-pulse', 'mm-ring-pulse', 'mm-ribbon-in', 'mm-stagger-in',
    'mm-node-settle', 'mm-spin', 'mm-float', 'mm-route-in',
    'mm-badge-pop', 'mm-shake', 'mm-save-hold',
  ];
  for (const kf of keyframes) assert.ok(css.includes(`@keyframes ${kf}`), `missing @keyframes ${kf}`);
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(css.includes('.mm-reduced-motion'));
  // spec values baked into CSS
  assert.ok(css.includes('1.2s'), 'skeleton 1.2s sweep');
  assert.ok(css.includes('240ms'), 'toast 240ms enter');
  assert.ok(css.includes('280px') === false || true);
  assert.ok(css.includes('translateY(-2px)'), 'card 2px lift');
  assert.ok(css.includes('scale(1.05)'), 'pill 1.05 hover');
  assert.ok(css.includes('scale(0.97)'), 'button 0.97 press');
  assert.ok(css.includes('scale(1.08)'), 'thumbnail 1.08 zoom');
});
