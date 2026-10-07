/**
 * wave17.test.js — Infinity AI · Forge wave 17 (ideas 50641–50680).
 * Node tests for the pure logic in themeCore.js + responsiveRound2Core.js,
 * the 40/40 WAVE17_IDEAS registry, and CSS/JSX completeness of both suites.
 * Run: node --test frontend/src/components/hunt/wave17.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  WAVE17_IDEAS,
  wave17RegistryComplete,
  THEME_IDS,
  THEME_ORDER,
  THEMES,
  themeById,
  isThemeId,
  cycleTheme,
  severityForTheme,
  chartPaletteForTheme,
  syntaxColorsForTheme,
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  contrastGrade,
  meetsAAA,
  bestTextOn,
  ACCENT_PRESETS,
  isValidHexColor,
  accentPairing,
  resolveOsTheme,
  resolveEffectiveTheme,
  sunTimes,
  isDarkOutside,
  formatMinutes,
  makePageThemeStore,
  THEME_EXPORT_VERSION,
  exportThemeJson,
  importThemeJson,
  themedEmailHtml,
} from './themeCore.js';
import {
  WAVE17_IDEAS as WAVE17_R2,
  wave17RegistryComplete as r2RegistryComplete,
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
  longPressReady,
  longPressMoved,
  hasCoarsePointer,
  hasFineHover,
  hybridUiMode,
  saveDataEnabled,
  effectiveConnectionType,
  degradeTier,
  degradeClassForTier,
  carouselPageCount,
  clampCarouselIndex,
  carouselOffsetPct,
  carouselIndexAfterSwipe,
  scrollGeometryKey,
  makeScrollPreserver,
  makeDesktopSiteStore,
  FORCE_DESKTOP_CLASS,
  shouldForceDesktop,
  sliderValueAt,
  sliderRatioFor,
  LARGE_SLIDER_THUMB_PX,
  containerQueriesSupported,
  widgetColumnsFallback,
  focusOrderForViewport,
  clampRootFontSize,
  ROOT_FONT_MIN_PX,
  ROOT_FONT_MAX_PX,
  ROOT_FONT_DEFAULT_PX,
  pxToRem,
  TESTED_MIN_WIDTH_PX,
  TESTED_MAX_WIDTH_PX,
  testedWidthLabel,
} from './responsiveRound2Core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const themeCss = readFileSync(join(__dirname, 'ThemeSuite.css'), 'utf8');
const themeJsx = readFileSync(join(__dirname, 'ThemeSuite.jsx'), 'utf8');
const r2Css = readFileSync(join(__dirname, 'ResponsiveRound2.css'), 'utf8');
const r2Jsx = readFileSync(join(__dirname, 'ResponsiveRound2.jsx'), 'utf8');

/* ---------------- Registry: 40/40 ------------------------------------ */

test('wave-17 registry covers all 40 ideas (50641–50680)', () => {
  assert.ok(wave17RegistryComplete());
  assert.ok(r2RegistryComplete());
  assert.equal(WAVE17_IDEAS, WAVE17_R2, 'single shared registry object');
  assert.equal(WAVE17_IDEAS.length, 40);
  assert.equal(WAVE17_IDEAS[0].id, 50641);
  assert.equal(WAVE17_IDEAS[39].id, 50680);
  const skips = WAVE17_IDEAS.filter((i) => i.status === 'skip');
  assert.equal(skips.length, 0, `expected zero skips, got: ${skips.map((s) => s.id).join(',')}`);
  for (const idea of WAVE17_IDEAS) {
    assert.ok(idea.component, `${idea.id} shipped but has no component`);
    assert.ok(['ThemeSuite.jsx', 'ResponsiveRound2.jsx'].includes(idea.module), `${idea.id} bad module`);
    const src = idea.module === 'ThemeSuite.jsx' ? themeJsx : r2Jsx;
    assert.ok(
      src.includes(`export function ${idea.component}`),
      `${idea.id}: ${idea.component} missing from ${idea.module}`
    );
  }
  // Responsive half lands in ResponsiveRound2.jsx, theming half in ThemeSuite.jsx.
  assert.ok(WAVE17_IDEAS.filter((i) => i.id <= 50659).every((i) => i.module === 'ResponsiveRound2.jsx'));
  assert.ok(WAVE17_IDEAS.filter((i) => i.id >= 50660).every((i) => i.module === 'ThemeSuite.jsx'));
});

test('every ThemeSuite.jsx export the registry references exists', () => {
  for (const name of [
    'ThemeProvider', 'useTheme', 'ThemePicker', 'ThemePreviewThumbnail', 'AccentPicker',
    'ContrastReadout', 'SunsetScheduler', 'ThemeJSONExportImport', 'ThemedLogo',
    'PerPageThemeMemory', 'DimThemeToggle', 'ThemeCycleHint', 'ThemedSkeleton',
    'ThemedCodeBlock', 'ThemedChart', 'ThemedEmailPreview', 'ThemeSuiteGallery',
  ]) {
    assert.ok(themeJsx.includes(`export function ${name}`), `missing export ${name}`);
  }
});

test('every ResponsiveRound2.jsx export the registry references exists', () => {
  for (const name of [
    'LongPressMenu', 'ResponsiveThumbnail', 'PrintLayoutOverride', 'OrientationSafeScroller',
    'NotchSafeBars', 'HybridTabletCard', 'CollapsibleMobileSection', 'OsTextSizeDemo',
    'SaveDataBadge', 'ShortMobileEmptyState', 'SwipeablePhaseCarousel', 'MobileTabBadge',
    'BottomSheetModal', 'LargeTouchSlider', 'FullBleedTabletGraph', 'DesktopSiteToggle',
    'ResponsiveFocusOrder', 'ContainerQueryWidget', 'TestedWidthNote', 'ResponsiveRound2Gallery',
  ]) {
    assert.ok(r2Jsx.includes(`export function ${name}`), `missing export ${name}`);
  }
});

test('identity: no other AI names in wave-17 files', () => {
  for (const [name, src] of [['themeCore', ''], ['ThemeSuite', themeJsx], ['ResponsiveRound2', r2Jsx]]) {
    assert.ok(!src.includes('Muse'), `${name} mentions Muse`);
  }
  const core = readFileSync(join(__dirname, 'themeCore.js'), 'utf8');
  const r2core = readFileSync(join(__dirname, 'responsiveRound2Core.js'), 'utf8');
  for (const [name, src] of [['themeCore.js', core], ['responsiveRound2Core.js', r2core], ['ThemeSuite.css', themeCss], ['ResponsiveRound2.css', r2Css]]) {
    assert.ok(!src.includes('Muse'), `${name} mentions Muse`);
    assert.ok(src.includes('Infinity AI'), `${name} missing Infinity AI branding`);
  }
});

/* ---------------- Theme registry ------------------------------------- */

test('four first-class themes with full palettes', () => {
  assert.deepEqual(THEME_IDS, ['dark', 'light', 'dim', 'high-contrast']);
  assert.deepEqual(THEME_ORDER, THEME_IDS);
  for (const id of THEME_IDS) {
    const t = themeById(id);
    assert.ok(t, id);
    for (const k of ['surface', 'text', 'severity', 'syntax', 'chart', 'focusRing', 'skeleton', 'scrollbar', 'themeColor']) {
      assert.ok(t[k] != null, `${id}.${k} missing`);
    }
    assert.equal(Object.keys(t.severity).length, 4);
    assert.equal(t.chart.length, 6);
    for (const k of ['keyword', 'string', 'number', 'comment', 'func', 'lineNumber', 'bg', 'text']) {
      assert.ok(isValidHexColor(t.syntax[k]), `${id}.syntax.${k} not a hex color`);
    }
  }
  assert.equal(themeById('nope'), null);
  assert.ok(isThemeId('dim'));
  assert.ok(!isThemeId('sepia'));
});

test('cycleTheme walks the documented Ctrl+. order and wraps', () => {
  assert.equal(cycleTheme('dark'), 'light');
  assert.equal(cycleTheme('light'), 'dim');
  assert.equal(cycleTheme('dim'), 'high-contrast');
  assert.equal(cycleTheme('high-contrast'), 'dark');
  assert.equal(cycleTheme('bogus'), 'dark');
});

test('severity/chart/syntax remaps are per-theme copies', () => {
  const a = severityForTheme('dark');
  const b = severityForTheme('light');
  assert.notDeepEqual(a, b);
  a.critical = '#000000';
  assert.notEqual(severityForTheme('dark').critical, '#000000', 'must return a copy');
  const p = chartPaletteForTheme('dim');
  assert.equal(p.length, 6);
  const s = syntaxColorsForTheme('high-contrast');
  assert.ok(s.keyword);
});

/* ---------------- WCAG math ------------------------------------------- */

test('relative luminance anchors', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#ffffff'), 1);
  assert.deepEqual(hexToRgb('#abc'), { r: 170, g: 187, b: 204 });
  assert.throws(() => hexToRgb('not-a-color'), /malformed/);
});

test('contrast ratio anchors and grades', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.01);
  assert.equal(contrastRatio('#123456', '#123456'), 1);
  assert.equal(contrastGrade(21), 'AAA');
  assert.equal(contrastGrade(7), 'AAA');
  assert.equal(contrastGrade(6.9), 'AA');
  assert.equal(contrastGrade(4.5), 'AA');
  assert.equal(contrastGrade(3), 'AA-large');
  assert.equal(contrastGrade(2.9), 'fail');
});

test('high-contrast theme hits ~7:1 body text on pure black/white', () => {
  const hc = THEMES['high-contrast'];
  assert.equal(hc.surface.base, '#000000');
  assert.ok(meetsAAA(hc.text.primary, hc.surface.base), 'body text must reach AAA');
  assert.ok(meetsAAA(hc.text.secondary, hc.surface.base), 'secondary text must reach AAA');
  assert.ok(hc.transparency === false, 'no transparency in high-contrast');
  assert.equal(hc.focusRing, '#ffff00');
});

test('adaptive focus rings differ per theme', () => {
  assert.equal(THEMES.dark.focusRing, '#22d3ee');
  assert.equal(THEMES.light.focusRing, '#1d4ed8');
  assert.equal(THEMES['high-contrast'].focusRing, '#ffff00');
});

test('code line numbers reach 4.5:1 on every theme (50678)', () => {
  for (const id of THEME_IDS) {
    const syn = syntaxColorsForTheme(id);
    const ratio = contrastRatio(syn.lineNumber, syn.bg);
    assert.ok(ratio >= 4.5, `${id} line-number contrast ${ratio.toFixed(2)} < 4.5`);
  }
});

test('bestTextOn picks the readable pairing', () => {
  assert.equal(bestTextOn('#000000'), '#ffffff');
  assert.equal(bestTextOn('#ffffff'), '#000000');
  assert.equal(bestTextOn('#8b5cf6'), '#000000', 'violet: black 4.96 > white 4.23');
});

test('accent presets + auto-contrast guard (50675)', () => {
  assert.equal(ACCENT_PRESETS.length, 6);
  for (const p of ACCENT_PRESETS) assert.ok(isValidHexColor(p.hex));
  const good = accentPairing('#f59e0b', 'dark');
  assert.equal(good.accent, '#f59e0b');
  assert.ok(['#ffffff', '#000000'].includes(good.onAccent));
  assert.ok(good.ratio >= 3, 'guard must keep a usable ratio');
  const bad = accentPairing('banana', 'dark');
  assert.equal(bad.accent, THEMES.dark.accent, 'invalid hex falls back to theme accent');
  assert.ok(!isValidHexColor('#fff'));
  assert.ok(!isValidHexColor('red'));
});

/* ---------------- OS preference --------------------------------------- */

test('resolveOsTheme is null in Node; effective theme resolution', () => {
  assert.equal(resolveOsTheme(), null);
  assert.equal(resolveEffectiveTheme({ manual: 'light', osFollow: true }), 'light');
  assert.equal(resolveEffectiveTheme({ manual: null, osFollow: true, storedDefault: 'dim' }), 'dim');
  assert.equal(resolveEffectiveTheme({ manual: 'bogus', osFollow: false, storedDefault: 'light' }), 'light');
});

/* ---------------- Sunset math ------------------------------------------ */

test('sunTimes: New Delhi, June 21 (IST = +330)', () => {
  const t = sunTimes({ lat: 28.6139, lng: 77.209, date: new Date(Date.UTC(2026, 5, 21, 12, 0)), tzOffsetMin: 330 });
  assert.ok(!t.polarDay && !t.polarNight);
  assert.ok(t.sunriseMin > 300 && t.sunriseMin < 400, `sunrise ${t.sunriseMin}`);
  assert.ok(t.sunsetMin > 1100 && t.sunsetMin < 1220, `sunset ${t.sunsetMin}`);
  assert.ok(t.sunriseMin < t.solarNoonMin && t.solarNoonMin < t.sunsetMin);
});

test('sunTimes: polar day/night', () => {
  const day = sunTimes({ lat: 78, lng: 16, date: new Date(Date.UTC(2026, 5, 21)), tzOffsetMin: 0 });
  assert.ok(day.polarDay);
  const night = sunTimes({ lat: -78, lng: 16, date: new Date(Date.UTC(2026, 5, 21)), tzOffsetMin: 0 });
  assert.ok(night.polarNight);
  assert.throws(() => sunTimes({ lat: 91, lng: 0 }), /lat must/);
});

test('isDarkOutside: Delhi noon vs midnight (IST)', () => {
  const at = (utcH) => ({ lat: 28.6139, lng: 77.209, date: new Date(Date.UTC(2026, 5, 21, utcH, 0)), tzOffsetMin: 330 });
  assert.equal(isDarkOutside(at(6)), false, '11:30 IST is light');
  assert.equal(isDarkOutside(at(18)), true, '23:30 IST is dark');
  assert.equal(isDarkOutside({ lat: 78, lng: 16, date: new Date(Date.UTC(2026, 5, 21)), tzOffsetMin: 0 }), false);
  assert.equal(isDarkOutside({ lat: -78, lng: 16, date: new Date(Date.UTC(2026, 5, 21)), tzOffsetMin: 0 }), true);
});

test('formatMinutes', () => {
  assert.equal(formatMinutes(75), '01:15');
  assert.equal(formatMinutes(0), '00:00');
  assert.equal(formatMinutes(1470), '00:30');
});

/* ---------------- Per-page theme memory --------------------------------- */

test('makePageThemeStore: set/get/clear/resolve (in-memory)', () => {
  const store = makePageThemeStore(null);
  assert.equal(store.getPageTheme('report-preview'), null);
  assert.equal(store.resolvePageTheme('report-preview', 'dark'), 'dark');
  store.setPageTheme('report-preview', 'light');
  assert.equal(store.getPageTheme('report-preview'), 'light');
  assert.equal(store.resolvePageTheme('report-preview', 'dark'), 'light');
  assert.throws(() => store.setPageTheme('x', 'sepia'), /unknown theme/);
  store.setPageTheme('report-preview', null);
  assert.equal(store.getPageTheme('report-preview'), null);
  store.setPageTheme('hunt', 'dim');
  store.clearPageTheme('hunt');
  assert.deepEqual(store.pages(), []);
});

test('makePageThemeStore works over a storage backend', () => {
  const bag = {};
  const backend = {
    getItem: (k) => (k in bag ? bag[k] : null),
    setItem: (k, v) => { bag[k] = v; },
  };
  const store = makePageThemeStore(backend);
  store.setPageTheme('settings', 'high-contrast');
  assert.equal(makePageThemeStore(backend).getPageTheme('settings'), 'high-contrast');
});

/* ---------------- Theme JSON export/import ------------------------------- */

test('theme JSON round-trips', () => {
  const state = {
    theme: 'dim', accent: '#06b6d4', osFollow: false, sunsetAuto: true,
    sunsetLat: 28.6139, sunsetLng: 77.209, printTheme: 'light', oledBlack: true,
    pageThemes: { 'report-preview': 'light' },
  };
  const json = exportThemeJson(state);
  const res = importThemeJson(json);
  assert.ok(res.ok);
  assert.equal(res.state.theme, 'dim');
  assert.equal(res.state.accent, '#06b6d4');
  assert.equal(res.state.pageThemes['report-preview'], 'light');
  assert.equal(res.state.printTheme, 'light');
});

test('theme JSON import rejects bad input honestly', () => {
  assert.equal(importThemeJson('nope{').ok, false);
  assert.equal(importThemeJson('[1,2]').ok, false);
  assert.ok(importThemeJson(JSON.stringify({ version: 99, theme: 'dark', accent: '#ffffff', printTheme: 'light' })).error.includes('version'));
  assert.ok(importThemeJson(JSON.stringify({ version: THEME_EXPORT_VERSION, theme: 'sepia', accent: '#ffffff', printTheme: 'light' })).error.includes('Unknown theme'));
  assert.ok(importThemeJson(JSON.stringify({ version: THEME_EXPORT_VERSION, theme: 'dark', accent: 'red', printTheme: 'light' })).error.includes('accent'));
  assert.ok(importThemeJson(JSON.stringify({ version: THEME_EXPORT_VERSION, theme: 'dark', accent: '#ffffff', printTheme: 'x' })).error.includes('printTheme'));
  assert.ok(importThemeJson(JSON.stringify({ version: THEME_EXPORT_VERSION, theme: 'dark', accent: '#ffffff', printTheme: 'light', pageThemes: { a: 'nope' } })).error.includes('Unknown theme'));
});

/* ---------------- Email templates ----------------------------------------- */

test('themedEmailHtml generates themed, escaped HTML', () => {
  const html = themedEmailHtml({
    themeId: 'light',
    title: 'Hunt <done>',
    rows: [{ label: 'Target', value: 't.test' }, { label: 'Critical', value: '2', tone: 'critical' }],
    cta: { label: 'Open', url: 'https://example.invalid/x' },
  });
  assert.ok(html.includes('Hunt &lt;done&gt;'), 'title must be escaped');
  assert.ok(html.includes(THEMES.light.surface.base));
  assert.ok(html.includes(THEMES.light.severity.critical));
  assert.ok(html.includes('color-scheme'));
  const dark = themedEmailHtml({ themeId: 'dark', title: 'x' });
  assert.ok(dark.includes(THEMES.dark.surface.base));
  assert.ok(dark !== html);
});

/* ---------------- Responsive round-2 core ---------------------------------- */

test('long-press timing helpers', () => {
  assert.equal(LONG_PRESS_MS, 500);
  assert.ok(longPressReady(500));
  assert.ok(longPressReady(900));
  assert.ok(!longPressReady(499));
  assert.ok(!longPressMoved(3, 4));
  assert.ok(longPressMoved(10, 10), 'hypot(10,10) > 12 slop');
  assert.equal(LONG_PRESS_SLOP_PX, 12);
});

test('touch capability readers are Node-safe', () => {
  assert.equal(hasCoarsePointer(), false);
  assert.equal(hasFineHover(), false);
  assert.equal(saveDataEnabled(), false);
  assert.equal(effectiveConnectionType(), 'unknown');
  assert.equal(containerQueriesSupported(), false);
});

test('hybridUiMode classification', () => {
  assert.equal(hybridUiMode({ width: 800, coarse: true, hover: true }), 'hybrid');
  assert.equal(hybridUiMode({ width: 400, coarse: true, hover: false }), 'touch');
  assert.equal(hybridUiMode({ width: 1400, coarse: false, hover: true }), 'mouse');
});

test('degradeTier from Save-Data / connection', () => {
  assert.equal(degradeTier({ saveData: false, effectiveType: '4g' }), 'full');
  assert.equal(degradeTier({ saveData: false, effectiveType: '3g' }), 'reduced');
  assert.equal(degradeTier({ saveData: false, effectiveType: '2g' }), 'minimal');
  assert.equal(degradeTier({ saveData: true, effectiveType: '4g' }), 'reduced');
  assert.equal(degradeTier({ saveData: true, effectiveType: '3g' }), 'minimal');
  assert.equal(degradeTier({ saveData: false, effectiveType: '4g', forced: 'minimal' }), 'minimal');
  assert.equal(degradeClassForTier('reduced'), 'r2-degrade-reduced');
  assert.equal(degradeClassForTier('minimal'), 'r2-degrade-minimal');
  assert.equal(degradeClassForTier('full'), '');
});

test('carousel pagination math', () => {
  assert.equal(carouselPageCount(4, 1), 4);
  assert.equal(carouselPageCount(4, 2), 2);
  assert.equal(carouselPageCount(0, 1), 1);
  assert.equal(clampCarouselIndex(9, 4), 3);
  assert.equal(clampCarouselIndex(-2, 4), 0);
  assert.equal(clampCarouselIndex(NaN, 4), 0);
  assert.equal(carouselOffsetPct(2), -200);
  assert.equal(carouselIndexAfterSwipe(1, -80, 4), 2, 'swipe left advances');
  assert.equal(carouselIndexAfterSwipe(1, 80, 4), 0, 'swipe right goes back');
  assert.equal(carouselIndexAfterSwipe(1, 10, 4), 1, 'below threshold stays');
  assert.equal(carouselIndexAfterSwipe(3, -80, 4), 3, 'clamped at end');
});

test('scroll preservation helpers', () => {
  assert.ok(scrollGeometryKey(390, 844).startsWith('mobile:portrait:'));
  assert.ok(scrollGeometryKey(1024, 700).startsWith('desktop:landscape:'));
  const p = makeScrollPreserver();
  assert.equal(p.peek(), null);
  assert.equal(p.restore(), null);
  const snap = p.capture(['a', 'c']);
  assert.deepEqual(snap.openCardIds, ['a', 'c']);
  assert.deepEqual(p.peek().openCardIds, ['a', 'c']);
  const restored = p.restore();
  assert.deepEqual(restored.openCardIds, ['a', 'c']);
  assert.equal(restored.x, 0);
});

test('desktop-site toggle store', () => {
  const store = makeDesktopSiteStore(null);
  assert.equal(store.enabled(), false);
  store.setEnabled(true);
  assert.equal(store.enabled(), true);
  store.setEnabled(false);
  assert.equal(store.enabled(), false);
  assert.equal(FORCE_DESKTOP_CLASS, 'r2-force-desktop');
  assert.ok(shouldForceDesktop({ stored: true, width: 390 }));
  assert.ok(shouldForceDesktop({ stored: false, width: 1400 }));
  assert.ok(!shouldForceDesktop({ stored: false, width: 390 }));
});

test('large slider math', () => {
  assert.equal(LARGE_SLIDER_THUMB_PX, 44);
  assert.equal(sliderValueAt({ min: 0, max: 10, step: 0.5, ratio: 0.7 }), 7);
  assert.equal(sliderValueAt({ min: 0, max: 10, step: 1, ratio: 0.74 }), 7);
  assert.equal(sliderValueAt({ min: 0, max: 10, step: 1, ratio: -0.5 }), 0);
  assert.equal(sliderValueAt({ min: 0, max: 10, step: 1, ratio: 1.5 }), 10);
  assert.equal(sliderRatioFor({ min: 0, max: 10, value: 7 }), 0.7);
  assert.equal(sliderRatioFor({ min: 5, max: 5, value: 5 }), 0);
});

test('container-query fallback columns', () => {
  assert.equal(widgetColumnsFallback(800), 3);
  assert.equal(widgetColumnsFallback(500), 2);
  assert.equal(widgetColumnsFallback(300), 1);
  assert.equal(widgetColumnsFallback(NaN), 1);
});

test('responsive focus orders per viewport', () => {
  assert.deepEqual(focusOrderForViewport(390), ['header', 'tabbar', 'main', 'sections', 'fab']);
  assert.deepEqual(focusOrderForViewport(800), ['header', 'nav', 'main', 'aside', 'tabbar']);
  assert.deepEqual(focusOrderForViewport(1440), ['header', 'nav', 'main', 'aside', 'footer']);
});

test('root font-size clamping + rem helper', () => {
  assert.equal(clampRootFontSize(16), 16);
  assert.equal(clampRootFontSize(4), ROOT_FONT_MIN_PX);
  assert.equal(clampRootFontSize(99), ROOT_FONT_MAX_PX);
  assert.equal(clampRootFontSize(NaN), ROOT_FONT_DEFAULT_PX);
  assert.equal(pxToRem(16, 16), '1rem');
  assert.equal(pxToRem(13, 16), '0.8125rem');
});

test('tested-width label', () => {
  assert.equal(TESTED_MIN_WIDTH_PX, 360);
  assert.equal(TESTED_MAX_WIDTH_PX, 2560);
  assert.equal(testedWidthLabel(), 'Optimized for 360px → 2560px');
});

/* ---------------- CSS completeness ---------------------------------------- */

test('ThemeSuite.css: four themes, cross-fade, print, focus, shimmer', () => {
  for (const id of THEME_IDS) assert.ok(themeCss.includes(`[data-theme='${id}']`), `missing theme block ${id}`);
  assert.ok(themeCss.includes('250ms'), 'cross-fade duration');
  assert.ok(themeCss.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(themeCss.includes('@media print'));
  assert.ok(themeCss.includes(':focus-visible'));
  assert.ok(themeCss.includes('@keyframes th-shimmer'));
  assert.ok(themeCss.includes('.th-fading'));
  assert.ok(themeCss.includes('.th-oled'));
  assert.ok(themeCss.includes('text-decoration: underline'), 'HC link underlines');
  assert.ok(!themeCss.includes('Muse'));
});

test('ResponsiveRound2.css: key classes, safe areas, print, container queries', () => {
  const classes = [
    '.r2-longpress-card', '.r2-quickmenu', '.r2-thumb', '.r2-print-report',
    '.r2-notch-header', '.r2-notch-bottombar', '.r2-tooltip', '.r2-collapse-sec',
    '.r2-savedata-badge', '.r2-degrade-reduced', '.r2-degrade-minimal',
    '.r2-short-empty', '.r2-carousel-track', '.r2-tab-badge', '.r2-modal',
    '.r2-as-sheet', '.r2-sheet-handle', '.r2-slider-thumb', '.r2-graph-bleed',
    '.r2-graph-legend', '.r2-menu-pop', '.r2-focusorder-chip', '.r2-cq-grid',
    '.r2-tested', '.r2-gallery',
  ];
  for (const c of classes) assert.ok(r2Css.includes(c), `missing CSS class ${c}`);
  assert.ok(r2Css.includes('safe-area-inset-top'));
  assert.ok(r2Css.includes('safe-area-inset-bottom'));
  assert.ok(r2Css.includes('@media print'));
  assert.ok(r2Css.includes('@container (min-width: 420px)'));
  assert.ok(r2Css.includes('container-type: inline-size'));
  assert.ok(r2Css.includes('@media (hover: hover)'));
  assert.ok(r2Css.includes('body.r2-force-desktop'));
  assert.ok(r2Css.includes('min-height: 44px') || r2Css.includes('min-height:44px'));
  assert.ok(!r2Css.includes('Muse'));
});

test('JSX files carry Infinity AI branding, not other AI names', () => {
  assert.ok(themeJsx.includes('Infinity AI'));
  assert.ok(r2Jsx.includes('Infinity AI'));
  assert.ok(!themeJsx.includes('Muse'));
  assert.ok(!r2Jsx.includes('Muse'));
});
