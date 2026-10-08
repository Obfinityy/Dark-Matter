/**
 * themeCore.js — Infinity AI · Forge wave 17 (ideas 50660–50680).
 *
 * Pure, DOM-free logic behind the th-* theming suite (ThemeSuite.jsx/.css):
 * the THEMES registry with full per-theme palettes (surfaces, text, accent,
 * severity hues, syntax colors, chart palette, focus ring, skeleton,
 * scrollbar), WCAG relative-luminance + contrast math, per-theme severity
 * remapping, accent presets with an auto-contrast text-pairing guard,
 * approximate sunrise/sunset from lat/lng for the sunset auto-switch, OS
 * preference resolution, a per-page theme-memory store API, theme JSON
 * export/import with schema validation, and an HTML email template
 * generator themed to the recipient's preference.
 *
 * Also carries the WAVE17_IDEAS registry (ideas 50641–50680) shared by both
 * wave-17 modules; responsiveRound2Core.js re-exports it.
 *
 * ESM with no DOM access at import time — every window/document/navigator
 * touch is guarded so this module loads and tests cleanly under Node.
 */

/* ---------------------------------------------------------------------------
 * Theme registry (50660, 50666, 50667)
 * Four first-class themes. 'dark' is the default. 'dim' is the intermediate
 * theme between dark and light. 'high-contrast' targets WCAG AAA: pure
 * black/white surfaces, ~7:1+ body text, thick focus rings, no transparency.
 * ------------------------------------------------------------------------- */

export const THEME_IDS = ['dark', 'light', 'dim', 'high-contrast'];

/**
 * Ctrl+. cycle order. The keybinding itself ships in wave 12
 * (ShortcutsManager.jsx — theme-cycle binding); cycleTheme() is the pure
 * step function the hint chip and the provider share so no second binding
 * is ever registered.
 */
export const THEME_ORDER = ['dark', 'light', 'dim', 'high-contrast'];

export const THEMES = {
  dark: {
    id: 'dark',
    label: 'Dark',
    kind: 'dark',
    surface: {
      base: '#0b0e14',
      raised: '#11151d',
      overlay: '#171c28',
      border: '#263046',
      card: '#121722',
    },
    text: { primary: '#e9edf5', secondary: '#a9b2c6', muted: '#7c869c' },
    accent: '#8b5cf6',
    severity: { critical: '#f87171', high: '#fb923c', medium: '#facc15', low: '#4ade80' },
    syntax: {
      bg: '#0d1117',
      text: '#c9d1d9',
      keyword: '#c792ea',
      string: '#9ece6a',
      number: '#ff9e64',
      comment: '#7b87a3',
      func: '#7aa2f7',
      lineNumber: '#8b96ad',
    },
    chart: ['#8b5cf6', '#38bdf8', '#4ade80', '#facc15', '#fb923c', '#f472b6'],
    focusRing: '#22d3ee',
    skeleton: { base: '#161b26', shimmer: 'rgba(255,255,255,0.09)' },
    scrollbar: { thumb: '#2c3550', track: '#0b0e14' },
    selection: 'rgba(139,92,246,0.35)',
    themeColor: '#0b0e14',
    gradients: true,
    transparency: true,
  },
  light: {
    id: 'light',
    label: 'Light',
    kind: 'light',
    surface: {
      base: '#ffffff',
      raised: '#f4f6fa',
      overlay: '#eceff5',
      border: '#d4dae6',
      card: '#f8fafd',
    },
    text: { primary: '#141a26', secondary: '#3d4659', muted: '#5b6579' },
    accent: '#6d28d9',
    severity: { critical: '#dc2626', high: '#c2410c', medium: '#a16207', low: '#15803d' },
    syntax: {
      bg: '#f6f8fb',
      text: '#24292f',
      keyword: '#7c3aed',
      string: '#2f7d32',
      number: '#b45309',
      comment: '#6e7781',
      func: '#1d4ed8',
      lineNumber: '#5b6579',
    },
    chart: ['#6d28d9', '#0284c7', '#15803d', '#a16207', '#c2410c', '#be185d'],
    focusRing: '#1d4ed8',
    skeleton: { base: '#e6eaf1', shimmer: 'rgba(255,255,255,0.75)' },
    scrollbar: { thumb: '#b9c2d4', track: '#f4f6fa' },
    selection: 'rgba(109,40,217,0.22)',
    themeColor: '#ffffff',
    gradients: false,
    transparency: true,
  },
  dim: {
    id: 'dim',
    label: 'Dim',
    kind: 'dark',
    surface: {
      base: '#171a21',
      raised: '#1f232d',
      overlay: '#262b38',
      border: '#333a4e',
      card: '#1c2029',
    },
    text: { primary: '#dfe4ee', secondary: '#a3adbf', muted: '#7e8799' },
    accent: '#a78bfa',
    severity: { critical: '#fca5a5', high: '#fdba74', medium: '#fde047', low: '#86efac' },
    syntax: {
      bg: '#191d26',
      text: '#cdd5e2',
      keyword: '#c4b5fd',
      string: '#a3d977',
      number: '#f5a97f',
      comment: '#7d889e',
      func: '#8fb3fa',
      lineNumber: '#8b96ad',
    },
    chart: ['#a78bfa', '#7dd3fc', '#86efac', '#fde047', '#fdba74', '#f9a8d4'],
    focusRing: '#67e8f9',
    skeleton: { base: '#232936', shimmer: 'rgba(255,255,255,0.07)' },
    scrollbar: { thumb: '#3a4358', track: '#171a21' },
    selection: 'rgba(167,139,250,0.32)',
    themeColor: '#171a21',
    gradients: true,
    transparency: true,
  },
  'high-contrast': {
    id: 'high-contrast',
    label: 'High contrast',
    kind: 'hc',
    surface: {
      base: '#000000',
      raised: '#000000',
      overlay: '#0a0a0a',
      border: '#ffffff',
      card: '#000000',
    },
    text: { primary: '#ffffff', secondary: '#f2f2f2', muted: '#e0e0e0' },
    accent: '#ffd400',
    severity: { critical: '#ff7a7a', high: '#ffb020', medium: '#ffe14d', low: '#7dff9b' },
    syntax: {
      bg: '#000000',
      text: '#ffffff',
      keyword: '#ffd400',
      string: '#7dff9b',
      number: '#ffb020',
      comment: '#d9d9d9',
      func: '#7dd3fc',
      lineNumber: '#e0e0e0',
    },
    chart: ['#ffd400', '#7dd3fc', '#7dff9b', '#ff7a7a', '#ffb020', '#f9a8d4'],
    focusRing: '#ffff00',
    skeleton: { base: '#1a1a1a', shimmer: 'rgba(255,255,255,0.25)' },
    scrollbar: { thumb: '#ffffff', track: '#000000' },
    selection: 'rgba(255,212,0,0.45)',
    themeColor: '#000000',
    gradients: false,
    transparency: false,
  },
};

export function themeById(id) {
  return THEMES[id] || null;
}

export function isThemeId(id) {
  return Object.prototype.hasOwnProperty.call(THEMES, id);
}

/** Next theme in the Ctrl+. cycle order (wraps). Unknown input → 'dark'. */
export function cycleTheme(current) {
  const i = THEME_ORDER.indexOf(current);
  return THEME_ORDER[(i + 1 + THEME_ORDER.length) % THEME_ORDER.length];
}

/** Severity hues remapped per theme (50664). Returns a fresh object. */
export function severityForTheme(themeId) {
  const t = themeById(themeId) || THEMES.dark;
  return { ...t.severity };
}

/** Chart palette for a theme (50669). Returns a fresh array. */
export function chartPaletteForTheme(themeId) {
  const t = themeById(themeId) || THEMES.dark;
  return [...t.chart];
}

/** Syntax token colors for code blocks (50668). Returns a fresh object. */
export function syntaxColorsForTheme(themeId) {
  const t = themeById(themeId) || THEMES.dark;
  return { ...t.syntax };
}

/* ---------------------------------------------------------------------------
 * WCAG contrast math (50660, 50664, 50675, 50678)
 * ------------------------------------------------------------------------- */

/** '#rrggbb' / '#rgb' → { r, g, b } in 0–255. Throws on malformed input. */
export function hexToRgb(hex) {
  if (typeof hex !== 'string') throw new TypeError('hex must be a string');
  const h = hex.trim().replace(/^#/, '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map(c => c + c)
          .join('')
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`malformed hex color: ${hex}`);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.x relative luminance, 0–1. */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colors, 1–21. */
export function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** 'AAA' (≥7) | 'AA' (≥4.5) | 'AA-large' (≥3) | 'fail'. */
export function contrastGrade(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

export function meetsAAA(a, b) {
  return contrastRatio(a, b) >= 7;
}

/**
 * Pick '#ffffff' or '#000000' for text on a background, preferring the one
 * that reaches AAA and otherwise the higher ratio.
 */
export function bestTextOn(bg) {
  const white = contrastRatio(bg, '#ffffff');
  const black = contrastRatio(bg, '#000000');
  if (white >= 7 && white >= black) return '#ffffff';
  if (black >= 7 && black > white) return '#000000';
  return white >= black ? '#ffffff' : '#000000';
}

/* ---------------------------------------------------------------------------
 * Accent presets + auto-contrast guard (50675)
 * ------------------------------------------------------------------------- */

export const ACCENT_PRESETS = [
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
];

export function isValidHexColor(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

/**
 * Auto-contrast guard: given any accent hex (preset or color-wheel), return
 * the accent plus the readable text color to pair with it. Never trusts the
 * raw hex — validates first and falls back to the theme default accent.
 */
export function accentPairing(rawHex, themeId = 'dark') {
  const fallback = (themeById(themeId) || THEMES.dark).accent;
  const hex = isValidHexColor(rawHex) ? rawHex.trim() : fallback;
  const onAccent = bestTextOn(hex);
  return {
    accent: hex,
    onAccent,
    ratio: contrastRatio(hex, onAccent),
    grade: contrastGrade(contrastRatio(hex, onAccent)),
  };
}

/* ---------------------------------------------------------------------------
 * OS preference (50661)
 * ------------------------------------------------------------------------- */

export const OS_DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * 'dark' | 'light' from the OS, or null when there is no DOM / no
 * matchMedia (Node, SSR). Manual override always wins in the provider.
 */
export function resolveOsTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(OS_DARK_QUERY).matches ? 'dark' : 'light';
  } catch {
    return null;
  }
}

/**
 * Effective theme: manual choice wins; otherwise the OS preference when
 * osFollow is on; otherwise the stored/default theme.
 */
export function resolveEffectiveTheme({ manual, osFollow, storedDefault = 'dark' }) {
  if (isThemeId(manual)) return manual;
  if (osFollow) {
    const os = resolveOsTheme();
    if (os) return os;
  }
  return isThemeId(storedDefault) ? storedDefault : 'dark';
}

/* ---------------------------------------------------------------------------
 * Sunset auto-switch (50662) — approximate solar math, no geolocation API
 * needed beyond the lat/lng the user enters in SunsetScheduler.
 * ------------------------------------------------------------------------- */

const DEG = Math.PI / 180;

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

/**
 * Approximate sunrise/sunset for a lat/lng and date.
 * `tzOffsetMin` shifts the result into the viewer's timezone; it defaults
 * to the device's own offset, so the user's own timezone applies without
 * any geolocation lookup. Pass an explicit offset in tests.
 * Returns { sunriseMin, sunsetMin, solarNoonMin } as minutes since local
 * midnight, or { polarDay: true } / { polarNight: true } above the circles.
 */
export function sunTimes({ lat, lng, date = new Date(), tzOffsetMin = -date.getTimezoneOffset() }) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error('lat must be -90..90 and lng -180..180');
  }
  const tz = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const N = dayOfYear(date);
  const decl = -23.44 * Math.cos((2 * Math.PI * (N + 10)) / 365); // degrees
  const B = ((2 * Math.PI) / 364) * (N - 81);
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
  const cosH = -Math.tan(lat * DEG) * Math.tan(decl * DEG);
  const shift = m => ((Math.round(m + tz) % 1440) + 1440) % 1440;
  if (cosH < -1)
    return {
      polarDay: true,
      sunriseMin: shift(0),
      sunsetMin: shift(1440),
      solarNoonMin: shift(720),
    };
  if (cosH > 1)
    return {
      polarNight: true,
      sunriseMin: shift(0),
      sunsetMin: shift(0),
      solarNoonMin: shift(720),
    };
  const ha = Math.acos(Math.min(1, Math.max(-1, cosH))) / DEG; // degrees
  const solarNoonUtcMin = 720 - 4 * lng - eot;
  return {
    sunriseMin: shift(solarNoonUtcMin - 4 * ha),
    sunsetMin: shift(solarNoonUtcMin + 4 * ha),
    solarNoonMin: shift(solarNoonUtcMin),
  };
}

/** True when `date` is after sunset or before sunrise at lat/lng. */
export function isDarkOutside({
  lat,
  lng,
  date = new Date(),
  tzOffsetMin = -date.getTimezoneOffset(),
}) {
  const t = sunTimes({ lat, lng, date, tzOffsetMin });
  if (t.polarDay) return false;
  if (t.polarNight) return true;
  const tz = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0;
  const nowMin = date.getUTCHours() * 60 + date.getUTCMinutes() + tz;
  const norm = ((nowMin % 1440) + 1440) % 1440;
  return norm < t.sunriseMin || norm >= t.sunsetMin;
}

/** Format minutes-since-midnight as 'HH:MM'. */
export function formatMinutes(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/* ---------------------------------------------------------------------------
 * Per-page theme memory (50663)
 * e.g. the report preview can stay light while the rest of the app is dark.
 * Storage is injected so the store is Node-testable; the provider passes
 * window.localStorage and falls back to memory.
 * ------------------------------------------------------------------------- */

export function makePageThemeStore(storage) {
  const mem = new Map();
  const backend = storage && typeof storage.getItem === 'function' ? storage : null;
  const KEY = 'infinity.pageThemes.v1';

  function readAll() {
    if (backend) {
      try {
        const raw = backend.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch {
        /* corrupted storage → treat as empty */
      }
    } else {
      const obj = {};
      for (const [k, v] of mem) obj[k] = v;
      return obj;
    }
    return {};
  }

  function writeAll(obj) {
    if (backend) {
      try {
        backend.setItem(KEY, JSON.stringify(obj));
      } catch {
        /* storage full/blocked */
      }
    } else {
      mem.clear();
      for (const [k, v] of Object.entries(obj)) mem.set(k, v);
    }
  }

  return {
    /** Theme override for a page, or null when the page follows global. */
    getPageTheme(page) {
      const v = readAll()[page];
      return isThemeId(v) ? v : null;
    },
    /** Set an override; pass null to clear back to the global theme. */
    setPageTheme(page, themeId) {
      const all = readAll();
      if (themeId == null) delete all[page];
      else {
        if (!isThemeId(themeId)) throw new Error(`unknown theme: ${themeId}`);
        all[page] = themeId;
      }
      writeAll(all);
    },
    clearPageTheme(page) {
      const all = readAll();
      delete all[page];
      writeAll(all);
    },
    /** Resolve: page override wins, else the global theme. */
    resolvePageTheme(page, globalTheme) {
      return this.getPageTheme(page) || (isThemeId(globalTheme) ? globalTheme : 'dark');
    },
    pages() {
      return Object.keys(readAll());
    },
  };
}

/* ---------------------------------------------------------------------------
 * Theme JSON export/import (settings portability)
 * ------------------------------------------------------------------------- */

export const THEME_EXPORT_VERSION = 1;

/** Serialize theme settings to a JSON string. */
export function exportThemeJson(state) {
  return JSON.stringify(
    {
      version: THEME_EXPORT_VERSION,
      app: 'infinity-ai-dark-matter',
      theme: state.theme,
      accent: state.accent,
      osFollow: !!state.osFollow,
      sunsetAuto: !!state.sunsetAuto,
      sunsetLat: state.sunsetLat,
      sunsetLng: state.sunsetLng,
      printTheme: state.printTheme === 'follow' ? 'follow' : 'light',
      oledBlack: !!state.oledBlack,
      pageThemes: state.pageThemes || {},
    },
    null,
    2
  );
}

/**
 * Validate a theme JSON string and return the parsed settings.
 * { ok: true, state } on success; { ok: false, error } with a human
 * message on any schema violation — never throws on user input.
 */
export function importThemeJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Theme file must be a JSON object.' };
  }
  if (parsed.version !== THEME_EXPORT_VERSION) {
    return { ok: false, error: `Unsupported version (expected ${THEME_EXPORT_VERSION}).` };
  }
  if (!isThemeId(parsed.theme)) return { ok: false, error: `Unknown theme "${parsed.theme}".` };
  if (!isValidHexColor(parsed.accent))
    return { ok: false, error: `Invalid accent color "${parsed.accent}".` };
  const pageThemes = parsed.pageThemes || {};
  if (typeof pageThemes !== 'object' || Array.isArray(pageThemes)) {
    return { ok: false, error: 'pageThemes must be an object.' };
  }
  for (const [page, tid] of Object.entries(pageThemes)) {
    if (!isThemeId(tid)) return { ok: false, error: `Unknown theme "${tid}" for page "${page}".` };
  }
  if (parsed.printTheme !== 'light' && parsed.printTheme !== 'follow') {
    return { ok: false, error: 'printTheme must be "light" or "follow".' };
  }
  return {
    ok: true,
    state: {
      theme: parsed.theme,
      accent: parsed.accent.trim(),
      osFollow: !!parsed.osFollow,
      sunsetAuto: !!parsed.sunsetAuto,
      sunsetLat: Number.isFinite(parsed.sunsetLat) ? parsed.sunsetLat : 28.6139,
      sunsetLng: Number.isFinite(parsed.sunsetLng) ? parsed.sunsetLng : 77.209,
      printTheme: parsed.printTheme,
      oledBlack: !!parsed.oledBlack,
      pageThemes,
    },
  };
}

/* ---------------------------------------------------------------------------
 * Themed email templates (50673) — HTML string generators honoring the
 * recipient's theme preference. Inline styles only (email-client safe).
 * ------------------------------------------------------------------------- */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a hunt-summary email as a self-contained HTML string in the
 * recipient's theme. rows: [{ label, value, tone }] where tone is a
 * severity key ('critical'|'high'|'medium'|'low') or null.
 */
export function themedEmailHtml({
  themeId = 'dark',
  title = 'Hunt summary',
  preheader = '',
  rows = [],
  cta = null,
} = {}) {
  const t = themeById(themeId) || THEMES.dark;
  const rowHtml = rows
    .map(r => {
      const tone = t.severity[r.tone];
      const dot = tone
        ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${tone};margin-right:8px;"></span>`
        : '';
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid ${t.surface.border};color:${t.text.secondary};font-size:13px;">${escapeHtml(r.label)}</td>
        <td style="padding:10px 0 10px 16px;border-bottom:1px solid ${t.surface.border};color:${t.text.primary};font-size:13px;text-align:right;">${dot}${escapeHtml(r.value)}</td>
      </tr>`;
    })
    .join('');
  const ctaHtml =
    cta && cta.url
      ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${t.accent};color:${bestTextOn(t.accent)};padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(cta.label || 'Open hunt')}</a></p>`
      : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="${t.kind === 'light' ? 'light' : 'dark'}"></head>
<body style="margin:0;padding:24px;background:${t.surface.base};color:${t.text.primary};font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
<div style="max-width:560px;margin:0 auto;background:${t.surface.raised};border:1px solid ${t.surface.border};border-radius:12px;padding:28px;">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:${t.text.muted};">INFINITY AI · DARK-MATTER</p>
<h1 style="margin:0 0 16px;font-size:22px;color:${t.text.primary};">${escapeHtml(title)}</h1>
<table style="width:100%;border-collapse:collapse;">${rowHtml}</table>${ctaHtml}
</div></body></html>`;
}

/* ---------------------------------------------------------------------------
 * WAVE17_IDEAS registry — ideas 50641–50680, exactly once each.
 * status: 'shipped' (component exists in module) | 'skip' (honest reason).
 * ------------------------------------------------------------------------- */

export const WAVE17_IDEAS = [
  // -- Responsive round 2 (50641–50659) → ResponsiveRound2.jsx ----------------
  {
    id: 50641,
    title: 'Long-press quick menu',
    status: 'shipped',
    note: '500ms press-and-hold opens a review-action menu; cancels on move/lift; keyboard context-menu key supported.',
    component: 'LongPressMenu',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50642,
    title: 'Responsive thumbnails',
    status: 'shipped',
    note: 'srcset + sizes + lazy loading; distinct from 50607 which was the entrance-cascade animation.',
    component: 'ResponsiveThumbnail',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50643,
    title: 'Print layout override',
    status: 'shipped',
    note: 'App-wide @media print: hides chrome, page-break rules, forced light; 50142 only flattened finding cards.',
    component: 'PrintLayoutOverride',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50644,
    title: 'Orientation-safe scroll',
    status: 'shipped',
    note: 'Captures scrollY + open-card ids on orientation change and restores after rotate.',
    component: 'OrientationSafeScroller',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50645,
    title: 'Notch safe areas',
    status: 'shipped',
    note: 'Generic env(safe-area-inset-*) utility classes; wave 16 used them piecemeal (50611/50620), this generalizes header/footer/bars.',
    component: 'NotchSafeBars',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50646,
    title: 'Hybrid tablet UI',
    status: 'shipped',
    note: 'Hover tooltips on (hover:hover) plus 48px touch targets on coarse pointers — both at once on hybrid tablets.',
    component: 'HybridTabletCard',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50647,
    title: 'Collapsed mobile sections',
    status: 'shipped',
    note: 'Sections default collapsed under 720px and expanded on desktop; real accordion, not the 50613 timeline.',
    component: 'CollapsibleMobileSection',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50648,
    title: 'OS text-size respect',
    status: 'shipped',
    note: 'All type in rem; demo changes the root font size so OS text-size scaling visibly applies. 50633 was fluid 14→16px, this is OS-driven.',
    component: 'OsTextSizeDemo',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50649,
    title: 'Save-Data degradation',
    status: 'shipped',
    note: 'Reads navigator.connection Save-Data/effectiveType; tiers full→reduced→minimal disable heavy animation and blur.',
    component: 'SaveDataBadge',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50650,
    title: 'Short mobile empty states',
    status: 'shipped',
    note: 'Compact one-line variants for narrow screens; EmptyStates.jsx (50309–50311) ships the full-length ones.',
    component: 'ShortMobileEmptyState',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50651,
    title: 'Swipeable phase carousel',
    status: 'shipped',
    note: 'Touch-swipe + buttons + keyboard between hunt phases with dots; distinct from the 50628 landscape stepper.',
    component: 'SwipeablePhaseCarousel',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50652,
    title: 'Mobile tab badge',
    status: 'shipped',
    note: 'Live findings count badge on the mobile tab bar, updates as counts change.',
    component: 'MobileTabBadge',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50653,
    title: 'Bottom-sheet modals',
    status: 'shipped',
    note: 'Generic modal becomes a drag-to-dismiss bottom sheet under 640px; 50614 was the filter panel only.',
    component: 'BottomSheetModal',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50654,
    title: 'Large touch sliders',
    status: 'shipped',
    note: 'Oversized-thumb range slider with step snapping, live readout, full keyboard support.',
    component: 'LargeTouchSlider',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50655,
    title: 'Full-bleed tablet graph',
    status: 'shipped',
    note: 'Full-bleed SVG severity graph on tablet landscape with a floating legend overlay.',
    component: 'FullBleedTabletGraph',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50656,
    title: 'Desktop-site toggle',
    status: 'shipped',
    note: 'Mobile menu option forces the desktop layout via a persisted body class; reversible.',
    component: 'DesktopSiteToggle',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50657,
    title: 'Responsive focus order',
    status: 'shipped',
    note: 'Tab order chips reorder per breakpoint (stacked vs grid); 50519/50466 covered correctness, this is per-layout order.',
    component: 'ResponsiveFocusOrder',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50658,
    title: 'Container-query widgets',
    status: 'shipped',
    note: 'Real @container queries resize widgets by their container, not the viewport; 50636 was viewport auto-fit grid.',
    component: 'ContainerQueryWidget',
    module: 'ResponsiveRound2.jsx',
  },
  {
    id: 50659,
    title: 'Tested-width note',
    status: 'shipped',
    note: '"Optimized for 360px → 2560px" banner with a real link to the repo issues page for width bugs.',
    component: 'TestedWidthNote',
    module: 'ResponsiveRound2.jsx',
  },
  // -- Theming suite (50660–50680) → ThemeSuite.jsx ---------------------------
  {
    id: 50660,
    title: 'Three core themes',
    status: 'shipped',
    note: 'Dark (default), light, high-contrast as first-class themes; full palettes in themeCore THEMES. Extends the basic dark/light data-theme toggle in App.jsx.',
    component: 'ThemePicker',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50661,
    title: 'OS preference + manual override',
    status: 'shipped',
    note: 'Follows prefers-color-scheme until the user picks manually; manual choice persists and wins.',
    component: 'ThemeProvider',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50662,
    title: 'Sunset auto-switch',
    status: 'shipped',
    note: 'Approximate sunrise/sunset from lat/lng switches to dark after sunset; user timezone via their own clock.',
    component: 'SunsetScheduler',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50663,
    title: 'Per-page theme memory',
    status: 'shipped',
    note: 'Report preview can stay light while the app is dark; override stored per page key.',
    component: 'PerPageThemeMemory',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50664,
    title: 'Per-theme severity mapping',
    status: 'shipped',
    note: 'severityForTheme() remaps critical/high/medium/low hues per theme; readout shows chips + ratios.',
    component: 'ContrastReadout',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50665,
    title: 'Theme preview thumbnails',
    status: 'shipped',
    note: 'Live mini hunt-UI previews in settings that recolor with the active theme.',
    component: 'ThemePreviewThumbnail',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50666,
    title: 'High-contrast surfaces',
    status: 'shipped',
    note: 'Pure black/white surfaces, ≥7:1 body text, thick focus rings, zero transparency — enforced in CSS.',
    component: 'ThemePicker',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50667,
    title: 'Dim intermediate theme',
    status: 'shipped',
    note: 'Dim sits between dark and light; OLED true-black toggle additionally flattens dark to pure black.',
    component: 'DimThemeToggle',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50668,
    title: 'Matched syntax themes',
    status: 'shipped',
    note: 'Per-theme token colors for code blocks via syntaxColorsForTheme().',
    component: 'ThemedCodeBlock',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50669,
    title: 'Theme-aware chart palette',
    status: 'shipped',
    note: 'chartPaletteForTheme() keeps chart hues readable per theme; demo bar chart recolors live.',
    component: 'ThemedChart',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50670,
    title: 'Flash-free 250ms cross-fade',
    status: 'shipped',
    note: 'ThemeProvider applies a th-fading class for a 250ms color cross-fade; disabled under prefers-reduced-motion.',
    component: 'ThemeProvider',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50671,
    title: 'Themed favicon + theme-color meta',
    status: 'shipped',
    note: 'ThemeProvider updates <meta name="theme-color"> and swaps a per-theme SVG favicon on change.',
    component: 'ThemeProvider',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50672,
    title: 'Light print default',
    status: 'shipped',
    note: '@media print forces the light palette; configurable to follow-screen via printTheme setting.',
    component: 'ThemeProvider',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50673,
    title: 'Themed email templates',
    status: 'shipped',
    note: 'themedEmailHtml() generates recipient-theme HTML emails with inline styles; live preview included.',
    component: 'ThemedEmailPreview',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50674,
    title: 'Forced link underlines + card borders',
    status: 'shipped',
    note: 'High-contrast forces link underlines and 2px card borders in CSS.',
    component: 'ThemeProvider',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50675,
    title: 'Accent-color picker',
    status: 'shipped',
    note: 'Six presets plus a color wheel; accentPairing() auto-adjusts the on-accent text color for contrast.',
    component: 'AccentPicker',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50676,
    title: 'Themed logo variants',
    status: 'shipped',
    note: 'SVG logo mark recolors per theme via currentColor and theme variables.',
    component: 'ThemedLogo',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50677,
    title: 'Auto reduced transparency',
    status: 'shipped',
    note: 'High-contrast zeroes blur/alpha overlays via CSS; handled by ThemeProvider theme application.',
    component: 'ThemeProvider',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50678,
    title: 'Code line-number 4.5:1 contrast',
    status: 'shipped',
    note: 'Line numbers use the theme lineNumber color, each verified ≥4.5:1 against the code bg in tests.',
    component: 'ThemedCodeBlock',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50679,
    title: 'Themed skeleton shimmer',
    status: 'shipped',
    note: 'Skeleton shimmer keyframes use per-theme base/shimmer colors.',
    component: 'ThemedSkeleton',
    module: 'ThemeSuite.jsx',
  },
  {
    id: 50680,
    title: 'Adaptive focus-ring color',
    status: 'shipped',
    note: 'Focus ring var per theme: cyan on dark, deep blue on light, yellow on high-contrast.',
    component: 'ThemeProvider',
    module: 'ThemeSuite.jsx',
  },
];

/** True when every idea 50641–50680 appears exactly once with a valid status. */
export function wave17RegistryComplete() {
  if (WAVE17_IDEAS.length !== 40) return false;
  const ids = WAVE17_IDEAS.map(i => i.id);
  for (let id = 50641; id <= 50680; id += 1) {
    if (ids.filter(x => x === id).length !== 1) return false;
  }
  return WAVE17_IDEAS.every(
    i =>
      (i.status === 'shipped' || i.status === 'skip') &&
      typeof i.title === 'string' &&
      i.title.length > 0 &&
      typeof i.note === 'string' &&
      i.note.length > 10 &&
      (i.status === 'skip'
        ? i.component == null
        : typeof i.component === 'string' && i.component.length > 0)
  );
}
