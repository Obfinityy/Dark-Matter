/**
 * themeRound3Core.js — pure, testable logic for wave 18 (ideas 50681–50720),
 * theming round 3: builds on wave 17's themeCore (THEMES, WCAG math, auto-contrast
 * guard, JSON export, OLED true-black, announcements) WITHOUT duplicating them.
 *
 * Covered (new in this wave):
 * 50681 themed scrollbars · 50682 themed selection · 50683 synced theme preference ·
 * 50685 sepia reading theme · 50686 balanced severity tints · 50687 high-contrast tables ·
 * 50690 themed embedded reports · 50691 themed progress accents · 50692 distinguishable
 * error colors · 50694 theme-gated gradients · 50695 themed empty illustrations ·
 * 50697 forced-colors support · 50698 instant themed cards · 50699 IDE-theme sync ·
 * 50700 high-contrast focus spec · 50701 DND-aware scheduling · 50702 per-hunt theme
 * override · 50704 first-run theme picker
 *
 * Honest SKIPs (already live, never re-implemented):
 * 50684 OLED true-black (wave 17: oledBlack + th-oled) ·
 * 50688 auto-contrast guard (wave 17: accentPairing) ·
 * 50689 Ctrl+. cycle (wave 12: ShortcutsManager, documented by wave 17) ·
 * 50693 announced theme changes (wave 17: ThemeProvider aria-live) ·
 * 50696 contrast-ratio readout (wave 17: ContrastReadout) ·
 * 50703 theme JSON export/import (wave 17: ThemeJSONExportImport)
 */
import { contrastRatio, bestTextOn, hexToRgb } from './themeCore.js';

/* ------------------------------------------------------------------ */
/* 50685 — Sepia reading theme (5th first-class theme)                 */
/* ------------------------------------------------------------------ */

/**
 * Sepia palette shaped like themeCore's THEME entries (enough for the
 * ThemeRound3 providers to merge with base variables).
 */
export const SEPIA_THEME = {
  id: 'sepia',
  label: 'Sepia',
  description: 'Warm paper tones for long report-reading sessions.',
  themeColor: '#f4ead5',
  darkFamily: false,
  vars: {
    '--bg': '#f4ead5',
    '--bg-soft': '#eee0c6',
    '--bg-card': '#faf3e3',
    '--text': '#4a3f2f',
    '--text-dim': '#7a6c55',
    '--accent': '#a06a1f',
    '--border': '#d9c8a3',
    '--severity-critical': '#b3392f',
    '--severity-high': '#b05e1e',
    '--severity-medium': '#8a6d1a',
    '--severity-low': '#4f7a3a',
  },
};

export function isSepia(themeId) {
  return themeId === 'sepia';
}

/* ------------------------------------------------------------------ */
/* 50686 — Balanced severity tints (4% dark / 8% light opacity)        */
/* ------------------------------------------------------------------ */

const SEVERITY_BASE = {
  critical: '#ff4d4d',
  high: '#ff9f43',
  medium: '#facc15',
  low: '#22c55e',
};

/**
 * Return an rgba() severity tint with balanced opacity: 4% on dark-family
 * themes, 8% on light-family themes, so the wash is equally visible.
 */
export function severityTintForTheme(severity, themeId) {
  const hex = SEVERITY_BASE[severity] || SEVERITY_BASE.low;
  const { r, g, b } = hexToRgb(hex);
  const darkFamily = themeId === 'dark' || themeId === 'dim' || themeId === 'high-contrast';
  const alpha = darkFamily ? 0.04 : 0.08;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function tintOpacityForTheme(themeId) {
  const darkFamily = themeId === 'dark' || themeId === 'dim' || themeId === 'high-contrast';
  return darkFamily ? 0.04 : 0.08;
}

/* ------------------------------------------------------------------ */
/* 50692 — Distinguishable error colors (icon + text pairing)          */
/* ------------------------------------------------------------------ */

/**
 * Error/success pairs that NEVER rely on color alone: each state ships with
 * a distinct icon glyph, a text label, and a hue pair chosen to stay
 * distinguishable for common color-vision deficiencies.
 */
export function errorColorPairs(themeId) {
  const darkFamily = themeId === 'dark' || themeId === 'dim' || themeId === 'sepia';
  return {
    error: {
      hue: darkFamily ? '#ff6b6b' : '#c0392b',
      icon: '✕',
      label: 'Error',
      // Blue-check vs red-cross: position + shape differ, not just hue.
      shape: 'cross',
    },
    success: {
      hue: darkFamily ? '#51cf66' : '#1e7e34',
      icon: '✓',
      label: 'Success',
      shape: 'check',
    },
    warning: {
      hue: darkFamily ? '#fcc419' : '#9a6b00',
      icon: '!',
      label: 'Warning',
      shape: 'triangle',
    },
    note: 'Always render the icon + label alongside the hue (50692).',
  };
}

/* ------------------------------------------------------------------ */
/* 50697 — Forced-colors support (Windows High Contrast)               */
/* ------------------------------------------------------------------ */

/**
 * Map our CSS custom properties onto forced-colors system colors so the UI
 * stays usable under Windows High Contrast / forced-colors mode.
 */
export const FORCED_COLORS_MAP = {
  '--bg': 'Canvas',
  '--bg-card': 'Canvas',
  '--text': 'CanvasText',
  '--text-dim': 'GrayText',
  '--accent': 'Highlight',
  '--border': 'ButtonBorder',
  '--severity-critical': 'MarkText',
  '--severity-high': 'Mark',
};

export function forcedColorsCssVars() {
  return Object.entries(FORCED_COLORS_MAP)
    .map(([prop, sys]) => `${prop}: ${sys};`)
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* 50699 — IDE-theme sync option (code-block syntax themes)            */
/* ------------------------------------------------------------------ */

export const IDE_THEMES = {
  'vscode-dark': { label: 'VS Code Dark+', bg: '#1e1e1e', fg: '#d4d4d4', kw: '#569cd6', str: '#ce9178', cmt: '#6a9955' },
  'dracula': { label: 'Dracula', bg: '#282a36', fg: '#f8f8f2', kw: '#ff79c6', str: '#f1fa8c', cmt: '#6272a4' },
  'github-light': { label: 'GitHub Light', bg: '#ffffff', fg: '#24292f', kw: '#cf222e', str: '#0a3069', cmt: '#6e7781' },
  'one-dark-pro': { label: 'One Dark Pro', bg: '#282c34', fg: '#abb2bf', kw: '#c678dd', str: '#98c379', cmt: '#5c6370' },
  'follow-app': { label: 'Follow app theme', bg: null, fg: null, kw: null, str: null, cmt: null },
};

export function ideThemePalette(ideId) {
  return IDE_THEMES[ideId] || IDE_THEMES['follow-app'];
}

export function ideThemeIds() {
  return Object.keys(IDE_THEMES);
}

/* ------------------------------------------------------------------ */
/* 50701 — DND-aware scheduling (sunset auto-switch skips DND hours)    */
/* ------------------------------------------------------------------ */

/**
 * Decide whether `now` falls inside a do-not-disturb window. Window may wrap
 * midnight (e.g. start 22, end 7). Hours are local 0–23.
 */
export function isDndNow({ startHour, endHour, now = new Date() } = {}) {
  if (startHour == null || endHour == null) return false;
  const h = now.getHours() + now.getMinutes() / 60;
  if (startHour <= endHour) return h >= startHour && h < endHour;
  return h >= startHour || h < endHour;
}

/** Should the scheduler run a theme transition right now? */
export function shouldRunThemeTransition({ dnd = {}, date = new Date() } = {}) {
  return !isDndNow({ ...dnd, now: date });
}

export function dndWindowLabel({ startHour, endHour } = {}) {
  if (startHour == null || endHour == null) return 'Off';
  const fmt = (h) => `${String(Math.floor(h)).padStart(2, '0')}:00`;
  return `${fmt(startHour)} – ${fmt(endHour)} local`;
}

/* ------------------------------------------------------------------ */
/* 50702 — Per-hunt theme override (pin high-contrast per hunt)        */
/* ------------------------------------------------------------------ */

export function makeHuntThemeStore(storage) {
  const KEY = 'dm_hunt_theme_overrides_v1';
  const read = () => {
    try {
      return JSON.parse(storage?.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  };
  const write = (obj) => {
    try {
      storage?.setItem(KEY, JSON.stringify(obj));
    } catch { /* storage blocked — session-only */ }
  };
  return {
    /** Get the pinned theme for a hunt, or null for "follow global". */
    get(huntId) {
      return read()[huntId] || null;
    },
    /** Pin a theme for a hunt; pass null to clear the override. */
    set(huntId, themeId) {
      const all = read();
      if (themeId == null) delete all[huntId];
      else all[huntId] = themeId;
      write(all);
    },
    /** Effective theme for a hunt = override, else global theme. */
    effective(huntId, globalTheme) {
      return read()[huntId] || globalTheme;
    },
    all() {
      return read();
    },
  };
}

/* ------------------------------------------------------------------ */
/* 50683 — Synced theme preference (per-device persist + account sync) */
/* ------------------------------------------------------------------ */

/**
 * Merge a local device theme record with an account-level preference record.
 * Rule: the record with the later updatedAt wins; ties break toward the
 * device that changed it (so an explicit user action never loses).
 */
export function syncThemePreference({ deviceId, local, account }) {
  const l = local || {};
  const a = account || {};
  if ((l.updatedAt || 0) > (a.updatedAt || 0)) {
    return { ...l, deviceId, source: 'local', synced: true };
  }
  if ((a.updatedAt || 0) > (l.updatedAt || 0)) {
    return { ...a, deviceId, source: 'account', synced: true };
  }
  // Tie: prefer the record whose deviceId matches (explicit local action).
  const winner = a.deviceId === deviceId ? a : l;
  return { ...winner, deviceId, source: winner === a ? 'account' : 'local', synced: true };
}

export function themePreferenceRecord({ deviceId, theme, accent, updatedAt = Date.now() }) {
  return { deviceId, theme, accent, updatedAt };
}

/* ------------------------------------------------------------------ */
/* 50690 — Themed embedded reports (postMessage theme inheritance)     */
/* ------------------------------------------------------------------ */

export const EMBED_THEME_MESSAGE = 'dm:embed-theme';

export function embeddedThemePayload({ themeId, vars }) {
  return { type: EMBED_THEME_MESSAGE, themeId, vars: vars || {} };
}

/** Validate an incoming postMessage theme payload; null = ignore. */
export function parseEmbeddedThemeMessage(data) {
  if (!data || data.type !== EMBED_THEME_MESSAGE) return null;
  if (typeof data.themeId !== 'string' || data.themeId.length > 32) return null;
  return { themeId: data.themeId, vars: data.vars && typeof data.vars === 'object' ? data.vars : {} };
}

/* ------------------------------------------------------------------ */
/* 50691 — Themed progress accents (spinners/bars use theme accent)    */
/* ------------------------------------------------------------------ */

export function progressAccentForTheme(themeId, accent = '#6e8efb') {
  // High-contrast must use a solid, non-translucent accent so spinners
  // stay visible at forced contrast; others may use a softer ring.
  if (themeId === 'high-contrast') return { track: 'transparent', fill: '#ffffff' };
  if (themeId === 'sepia') return { track: 'rgba(160,106,31,.18)', fill: '#a06a1f' };
  if (themeId === 'light') return { track: 'rgba(0,0,0,.10)', fill: accent };
  return { track: 'rgba(255,255,255,.14)', fill: accent };
}

/* ------------------------------------------------------------------ */
/* 50681 / 50682 / 50687 / 50700 / 50698 — class + spec helpers        */
/* ------------------------------------------------------------------ */

export function scrollbarClass(themeId) {
  return `th-scrollbars th-scrollbars-${themeId || 'dark'}`;
}

export function selectionClass(themeId) {
  return `th-selection th-selection-${themeId || 'dark'}`;
}

export function tableModeClass(mode) {
  // 50687: 'standard' | 'high-contrast' — zebra rows + strong cell borders.
  return mode === 'high-contrast' ? 'th-table-hc' : 'th-table';
}

/** 50700 — high-contrast focus: 3px solid outline, 2px offset, every control. */
export const HIGH_CONTRAST_FOCUS_SPEC = {
  outlineWidth: '3px',
  outlineStyle: 'solid',
  outlineOffset: '2px',
};

/** 50698 — instant themed cards: apply data-theme with transitions disabled
 *  for exactly one paint, so newly opened cards never flash unstyled. */
export function instantThemeAttrs(themeId) {
  return { 'data-theme': themeId, 'data-th-instant': 'true' };
}

/* ------------------------------------------------------------------ */
/* 50704 — First-run theme picker options                              */
/* ------------------------------------------------------------------ */

export function firstRunThemes() {
  return [
    { id: 'dark', label: 'Dark', tagline: 'Easy on the eyes for night hunts.' },
    { id: 'light', label: 'Light', tagline: 'Crisp daylight review mode.' },
    { id: 'sepia', label: 'Sepia', tagline: 'Warm paper for long report reads.' },
  ];
}

/* ------------------------------------------------------------------ */
/* 50694 — Theme-gated gradients (wallpaper only in dark/dim)          */
/* ------------------------------------------------------------------ */

export function gradientsAllowed(themeId) {
  return themeId === 'dark' || themeId === 'dim';
}

/* ------------------------------------------------------------------ */
/* 50695 — Themed empty illustrations (dark/light asset variants)      */
/* ------------------------------------------------------------------ */

export function emptyIllustrationVariant(themeId) {
  return themeId === 'light' || themeId === 'sepia' ? 'light' : 'dark';
}

/** Pick the best readable text color for a sepia surface (sanity check). */
export function sepiaTextPair() {
  const bg = SEPIA_THEME.vars['--bg'];
  const fg = SEPIA_THEME.vars['--text'];
  return { ratio: contrastRatio(bg, fg), best: bestTextOn(bg) };
}

/* ------------------------------------------------------------------ */
/* WAVE18_IDEAS registry — 40/40 completeness (incl. honest SKIPs)      */
/* ------------------------------------------------------------------ */

export const WAVE18_IDEAS = [
  { id: 50681, title: 'Themed scrollbars', status: 'shipped', module: 'ThemeRound3.jsx', note: 'scrollbarClass() + .th-scrollbars-* thin theme-matched styling.' },
  { id: 50682, title: 'Themed selection color', status: 'shipped', module: 'ThemeRound3.jsx', note: 'selectionClass() + ::selection pairing per theme, contrast-checked.' },
  { id: 50683, title: 'Synced theme preference', status: 'shipped', module: 'ThemeRound3.jsx', note: 'syncThemePreference(): per-device persist + last-writer-wins account merge.' },
  { id: 50684, title: 'OLED true-black toggle', status: 'skipped', module: 'ThemeSuite.jsx', note: 'SKIP — already live in wave 17 (oledBlack + th-oled class).' },
  { id: 50685, title: 'Sepia reading theme', status: 'shipped', module: 'ThemeRound3.jsx', note: 'SEPIA_THEME: warm paper palette for long report sessions.' },
  { id: 50686, title: 'Balanced severity tints', status: 'shipped', module: 'ThemeRound3.jsx', note: 'severityTintForTheme(): 4% opacity dark-family / 8% light-family.' },
  { id: 50687, title: 'High-contrast tables', status: 'shipped', module: 'ThemeRound3.jsx', note: 'tableModeClass(): zebra rows + strong cell borders mode.' },
  { id: 50688, title: 'Auto-contrast guard', status: 'skipped', module: 'themeCore.js', note: 'SKIP — already live in wave 17 (accentPairing guard).' },
  { id: 50689, title: 'Theme-cycle shortcut', status: 'skipped', module: 'ShortcutsManager.jsx', note: 'SKIP — Ctrl+. already live (wave 12), documented by wave 17 ThemeCycleHint.' },
  { id: 50690, title: 'Themed embedded reports', status: 'shipped', module: 'ThemeRound3.jsx', note: 'EmbeddedReportBridge: postMessage theme inheritance + payload validation.' },
  { id: 50691, title: 'Themed progress accents', status: 'shipped', module: 'ThemeRound3.jsx', note: 'progressAccentForTheme(): theme-aware spinner/bar colors.' },
  { id: 50692, title: 'Distinguishable error colors', status: 'shipped', module: 'ThemeRound3.jsx', note: 'errorColorPairs(): hue + icon + text label, never color-alone.' },
  { id: 50693, title: 'Announced theme changes', status: 'skipped', module: 'ThemeSuite.jsx', note: 'SKIP — already live in wave 17 (ThemeProvider aria-live announcements).' },
  { id: 50694, title: 'Theme-gated gradients', status: 'shipped', module: 'ThemeRound3.jsx', note: 'gradientsAllowed(): wallpaper gradients only in dark/dim; light stays flat.' },
  { id: 50695, title: 'Themed empty illustrations', status: 'shipped', module: 'ThemeRound3.jsx', note: 'emptyIllustrationVariant(): dark/light illustration variants per theme.' },
  { id: 50696, title: 'Contrast-ratio readout', status: 'skipped', module: 'ThemeSuite.jsx', note: 'SKIP — already live in wave 17 (ContrastReadout).' },
  { id: 50697, title: 'Forced-colors support', status: 'shipped', module: 'ThemeRound3.jsx', note: 'FORCED_COLORS_MAP + forcedColorsCssVars() for Windows High Contrast.' },
  { id: 50698, title: 'Instant themed cards', status: 'shipped', module: 'ThemeRound3.jsx', note: 'instantThemeAttrs(): data-th-instant disables transition for one paint — no per-card flash.' },
  { id: 50699, title: 'IDE-theme sync option', status: 'shipped', module: 'ThemeRound3.jsx', note: 'IDE_THEMES: code blocks sync to VS Code/Dracula/GitHub/One Dark Pro.' },
  { id: 50700, title: 'High-contrast focus spec', status: 'shipped', module: 'ThemeRound3.jsx', note: 'HIGH_CONTRAST_FOCUS_SPEC: 3px solid outline + 2px offset on every control.' },
  { id: 50701, title: 'DND-aware scheduling', status: 'shipped', module: 'ThemeRound3.jsx', note: 'isDndNow()/shouldRunThemeTransition(): theme scheduling skips DND hours.' },
  { id: 50702, title: 'Per-hunt theme override', status: 'shipped', module: 'ThemeRound3.jsx', note: 'makeHuntThemeStore(): pin high-contrast per hunt for focused reviews.' },
  { id: 50703, title: 'Theme JSON export', status: 'skipped', module: 'themeCore.js', note: 'SKIP — already live in wave 17 (ThemeJSONExportImport, schema v1).' },
  { id: 50704, title: 'First-run theme picker', status: 'shipped', module: 'ThemeRound3.jsx', note: 'FirstRunThemePicker: three large previews on onboarding.' },
  { id: 50705, title: 'Active-hunts widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'ActiveHuntsWidget: live phase + progress ring per running hunt.' },
  { id: 50706, title: 'Clickable severity donut', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'SeverityDonutWidget: segments click through to filtered findings.' },
  { id: 50707, title: 'Weekly-findings sparkline', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'WeeklyFindingsWidget: sparkline + week-over-week delta.' },
  { id: 50708, title: 'Throughput widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'ThroughputWidget: hunts/day for the last 30 days.' },
  { id: 50709, title: 'Needs-review widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'NeedsReviewWidget: top 5 unreviewed findings + quick-review actions.' },
  { id: 50710, title: 'Top-vulnerable-targets widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'TopVulnerableTargetsWidget: ranked by criticals with trend arrows.' },
  { id: 50711, title: 'Agent-activity heatmap', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'AgentActivityHeatmapWidget: 24x7 grid of agent activity.' },
  { id: 50712, title: 'Time-to-first-finding widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'TimeToFirstFindingWidget: average + trend arrow.' },
  { id: 50713, title: 'False-positive-rate widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'FalsePositiveRateWidget: per-engine FP rates + 30-day sparkline.' },
  { id: 50714, title: 'Report-ready widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'ReportReadyWidget: hunts awaiting report generation + one-click generate.' },
  { id: 50715, title: 'Scheduled-hunts widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'ScheduledHuntsWidget: next 5 scheduled runs with live countdowns.' },
  { id: 50716, title: 'Integration-health widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'IntegrationHealthWidget: green/amber/red health dots per provider.' },
  { id: 50717, title: 'Learning-applied widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'LearningAppliedWidget: rules learned this week with concrete examples.' },
  { id: 50718, title: 'Storage-usage widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'StorageUsageWidget: evidence + snapshot usage vs quota + cleanup CTA.' },
  { id: 50719, title: 'Team-leaderboard widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'TeamLeaderboardWidget: opt-in board ranking confirmed findings.' },
  { id: 50720, title: 'SLA-risk widget', status: 'shipped', module: 'DashboardWidgets.jsx', note: 'SlaRiskWidget: findings nearing SLA breach sorted by urgency + countdowns.' },
];

export function wave18Coverage() {
  const shipped = WAVE18_IDEAS.filter((i) => i.status === 'shipped').length;
  const skipped = WAVE18_IDEAS.filter((i) => i.status === 'skipped').length;
  return { total: WAVE18_IDEAS.length, shipped, skipped };
}
