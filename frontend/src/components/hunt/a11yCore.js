/**
 * a11yCore.js — Forge wave 13, ideas 50500–50520.
 *
 * Pure, DOM-free logic for accessibility round 2: WCAG contrast math,
 * severity triples (never color-alone), live-region announcement builders,
 * assertive-error copy, color-blind-safe palette data, chart→table rows,
 * chain-graph arrow traversal, focus-order checking, and the wave-13
 * accessibility idea registry.
 *
 * Imported by AccessibilitySuite.jsx. Node-testable (no DOM at import time).
 */

/* Idea registry: ideas 50500–50520 mapped exactly once ---------------------- */

export const WAVE13_A11Y_IDEAS = [
  { idea: 50500, name: 'Screen-reader hunt narration', in: 'AccessibilitySuite.jsx:PhaseNarrator + a11yCore.phaseNarrationText' },
  { idea: 50501, name: 'Never color-alone severity', in: 'AccessibilitySuite.jsx:SeverityBadge + a11yCore.severityTriple' },
  { idea: 50502, name: 'High-contrast focus outlines', in: 'AccessibilitySuite.css:.a11y-focusable:focus-visible (3px) + HighContrastFocusDemo' },
  { idea: 50503, name: 'Reduced-motion mode', in: 'AccessibilitySuite.css @media (prefers-reduced-motion) + ReducedMotionToggle' },
  { idea: 50504, name: 'Contrast minimums', in: 'AccessibilitySuite.jsx:ContrastBadge + a11yCore.contrastRatio/meetsWCAG' },
  { idea: 50505, name: 'Listbox findings', in: 'AccessibilitySuite.jsx:ListboxFindings + a11yCore.listboxAriaProps' },
  { idea: 50506, name: 'New-finding announcements', in: 'AccessibilitySuite.jsx:NewFindingAnnouncer + a11yCore.newFindingAnnouncement' },
  { idea: 50507, name: 'Ordered timeline list', in: 'AccessibilitySuite.jsx:OrderedTimelineList + a11yCore.timelineStepStatusText' },
  { idea: 50508, name: 'Skip-navigation links', in: 'SKIP: already live — wave 12 ShortcutsManager.jsx:SkipLinks (top of every page)' },
  { idea: 50509, name: 'Named icon buttons', in: 'AccessibilitySuite.jsx:NamedIconButton (aria-label required)' },
  { idea: 50510, name: 'Visible input labels', in: 'AccessibilitySuite.jsx:VisibleLabelField (label element, no placeholder-only)' },
  { idea: 50511, name: 'Assertive error announcements', in: 'AccessibilitySuite.jsx:AssertiveError + a11yCore.assertiveErrorText' },
  { idea: 50512, name: 'Modal focus management', in: 'AccessibilitySuite.jsx:FocusModal (trap + return focus to trigger)' },
  { idea: 50513, name: 'Toast live region', in: 'AccessibilitySuite.jsx:ToastLiveRegion + a11yCore.toastLiveProps' },
  { idea: 50514, name: 'Color-blind-safe palette', in: 'AccessibilitySuite.jsx:ColorBlindPalette + a11yCore.SEVERITY_PALETTE_CVD' },
  { idea: 50515, name: 'Chart data tables', in: 'AccessibilitySuite.jsx:ChartDataTable + a11yCore.chartDataTableRows' },
  { idea: 50516, name: 'Keyboard chain graph', in: 'AccessibilitySuite.jsx:KeyboardChainGraph + a11yCore.graphArrowNav' },
  { idea: 50517, name: '200% text resizing', in: 'AccessibilitySuite.css (rem/clamp typography) + LargeTextNotice' },
  { idea: 50518, name: '44px touch targets', in: 'AccessibilitySuite.css:.a11y-touch (min 44px) + a11yCore.TOUCH_TARGET_MIN' },
  { idea: 50519, name: 'Visual-order focus', in: 'AccessibilitySuite.jsx:VisualOrderList + a11yCore.focusOrderMatchesVisual' },
  { idea: 50520, name: 'Prefers-contrast support', in: 'AccessibilitySuite.css @media (prefers-contrast: more) + PrefersContrastDemo + a11yCore.PREFERS_CONTRAST_QUERY' },
];

/* Hunt narration (50500) ----------------------------------------------------- */

/** Aria-live announcement when the hunt phase changes. */
export function phaseNarrationText(phase, { findings = 0, target = '' } = {}) {
  const where = target ? ` on ${target}` : '';
  return `Phase changed: ${phase}${where}. ${findings} findings so far.`;
}

/** Announcement when a new finding lands (50506). */
export function newFindingAnnouncement(finding = {}) {
  const sev = finding.severity || 'unknown';
  const title = finding.title || 'finding';
  const target = finding.target ? ` on ${finding.target}` : '';
  return `New ${sev} finding: ${title}${target}.`;
}

/* Never color-alone severity (50501) ---------------------------------------- */

export const SEVERITY_TRIPLES = {
  critical: { label: 'Critical', icon: '⬢', color: '#f85149' },
  high: { label: 'High', icon: '▲', color: '#f0883e' },
  medium: { label: 'Medium', icon: '●', color: '#d29922' },
  low: { label: 'Low', icon: '■', color: '#3fb950' },
  info: { label: 'Info', icon: 'ℹ', color: '#58a6ff' },
};

/** Triple every severity with {label, icon, color} — never color alone. */
export function severityTriple(severity) {
  return SEVERITY_TRIPLES[String(severity || '').toLowerCase()] || { label: String(severity || 'Unknown'), icon: '?', color: '#8b949e' };
}

/* WCAG contrast math (50504) ------------------------------------------------ */

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); // eslint-disable-line no-restricted-properties
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG relative-luminance contrast ratio of two hex colors. */
export function contrastRatio(fg, bg) {
  const a = hexToRgb(fg), b = hexToRgb(bg);
  if (!a || !b) return null;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Check WCAG text-contrast minimums: 4.5:1 body, 3:1 large text/UI icons.
 * @param {string} fg foreground hex, {string} bg background hex
 * @param {'normal'|'large'|'ui-icon'} kind
 * @returns {{ratio:number|null, required:number, passes:boolean}}
 */
export function meetsWCAG(fg, bg, kind = 'normal') {
  const ratio = contrastRatio(fg, bg);
  const required = kind === 'normal' ? 4.5 : 3.0;
  return { ratio, required, passes: ratio !== null && ratio >= required };
}

/* Listbox findings (50505) --------------------------------------------------- */

export function listboxAriaProps({ activeDescendant = null, expanded = false, multi = false } = {}) {
  return {
    role: 'listbox',
    'aria-expanded': String(expanded),
    ...(multi ? { 'aria-multiselectable': 'true' } : {}),
    ...(activeDescendant ? { 'aria-activedescendant': activeDescendant } : {}),
  };
}

export function findingOptionProps(finding = {}, { active = false, selected = false } = {}) {
  return {
    role: 'option',
    id: `finding-option-${finding.id || 'x'}`,
    'aria-selected': String(selected),
    ...(active ? { 'data-active': 'true' } : {}),
    'aria-label': `${finding.severity || 'unknown'}: ${finding.title || 'finding'}`,
  };
}

/* Ordered timeline (50507) --------------------------------------------------- */

export function timelineStepStatusText(step = {}) {
  const status = step.status || 'pending';
  const when = step.at ? ` at ${step.at}` : '';
  return `Step ${step.n ?? '?'}: ${step.label || 'unnamed'} — ${status}${when}.`;
}

/* Assertive errors (50511) --------------------------------------------------- */

export function assertiveErrorText(fieldLabel, message) {
  return `Error in ${fieldLabel}: ${message}`;
}

/* Toast live region (50513) -------------------------------------------------- */

export function toastLiveProps() {
  return { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' };
}

/* Color-blind-safe palette (50514) ------------------------------------------- */
/* Okabe-Ito inspired: distinguishable under deuteranopia & protanopia.       */

export const SEVERITY_PALETTE_CVD = [
  { severity: 'critical', color: '#d55e00', note: 'vermillion — readable under deuteranopia' },
  { severity: 'high', color: '#cc79a7', note: 'reddish purple — readable under protanopia' },
  { severity: 'medium', color: '#e69f00', note: 'orange — distinct from vermillion by label + icon' },
  { severity: 'low', color: '#0072b2', note: 'blue — never confused with severity reds' },
  { severity: 'info', color: '#56b4e9', note: 'sky blue — distinct from low blue by label' },
];

/* Chart data tables (50515) -------------------------------------------------- */

export function chartDataTableRows(series = []) {
  return series.map((s, i) => ({ n: i + 1, label: s.label ?? `Row ${i + 1}`, value: s.value ?? '' }));
}

/* Keyboard chain graph (50516) ----------------------------------------------- */

/**
 * Traverse a graph edge with an arrow key: { nodes: [{id}], edges: [{from,to}] }.
 * Returns the next node id, or the current id when no edge matches.
 */
export function graphArrowNav(graph, currentId, arrowKey) {
  const idx = graph.nodes.findIndex((n) => n.id === currentId);
  if (idx < 0) return null;
  if (arrowKey === 'arrowright' || arrowKey === 'arrowdown') {
    const edge = graph.edges.find((e) => e.from === currentId);
    return edge ? edge.to : currentId;
  }
  if (arrowKey === 'arrowleft' || arrowKey === 'arrowup') {
    const edge = graph.edges.find((e) => e.to === currentId);
    return edge ? edge.from : currentId;
  }
  return currentId;
}

/* Visual-order focus (50519) ------------------------------------------------- */

/** True when the DOM focus order equals the visual order (both id arrays). */
export function focusOrderMatchesVisual(domOrder, visualOrder) {
  if (!Array.isArray(domOrder) || !Array.isArray(visualOrder)) return false;
  if (domOrder.length !== visualOrder.length) return false;
  return domOrder.every((id, i) => id === visualOrder[i]);
}

/* Touch targets (50518) / prefers-contrast (50520) --------------------------- */

export const TOUCH_TARGET_MIN = 44;
export const PREFERS_CONTRAST_QUERY = '(prefers-contrast: more)';

/* Visible labels (50510) ----------------------------------------------------- */

export function visibleLabelProps(id, label) {
  return { htmlFor: id, label };
}

/* Combined wave-13 registry (for docs/tests) --------------------------------- */
export const WAVE13_A11Y_COUNT = WAVE13_A11Y_IDEAS.length; // 21 entries
