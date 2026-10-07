/**
 * a11yRound3Core.js — Forge wave 14, ideas 50521–50560.
 *
 * Pure, DOM-free logic for accessibility round 3: hunt SR summaries,
 * aria-hidden decorators, throttled status/progress announcements, sortable
 * table semantics, reduced-transparency/reduced-data preference readers,
 * code-block focus contrast, screenshot alt text, avatar captions, speakable
 * action names, terminal Esc exit, heading/link validators, autocomplete map,
 * progress + timestamp formatters, disabled-button explanations, severity
 * tint contrast across themes, filter/slider announcements, chart
 * descriptions, underline policy, destructive-action copy, graph→list
 * fallback, typing announcements, keyboard drag equivalents, form error
 * summaries, timeout copy, keyboard date entry, readability + dyslexia
 * settings, acronym expansion, scroll-margin helpers, bulk announcements,
 * new-card motion spec, low-vision spacing, and the accessibility statement.
 *
 * Imported by AccessibilityRound3.jsx. Node-testable (no DOM at import time).
 */

import { contrastRatio, meetsWCAG, severityTriple } from './a11yCore.js';

/* Idea registry: ideas 50521–50560 mapped exactly once ---------------------- */

export const WAVE14_IDEAS = [
  { idea: 50521, name: 'Hunt screen-reader summary', in: 'AccessibilityRound3.jsx:HuntSummaryLiveRegion + a11yRound3Core.huntSummaryText' },
  { idea: 50522, name: 'Hidden decorative animation', in: 'a11yRound3Core.ariaHiddenProps (aria-hidden="true" decorator)' },
  { idea: 50523, name: 'Status-change announcements', in: 'AccessibilityRound3.jsx:StatusAnnouncer + a11yRound3Core.statusAnnouncement' },
  { idea: 50524, name: 'Sortable table semantics', in: 'AccessibilityRound3.jsx:SortableFindingsTableHead + a11yRound3Core.sortableHeaderProps/sortableAnnouncement' },
  { idea: 50525, name: 'Reduced transparency', in: 'a11yRound3Core.readMediaPreference + transparencyClass + AccessibilityRound3.css .a11y3-reduced-transparency' },
  { idea: 50526, name: 'Code-block focus contrast', in: 'a11yRound3Core.checkCodeBlockFocus + AccessibilityRound3.css .a11y3-codeblock:focus-visible' },
  { idea: 50527, name: 'Screenshot alt text', in: 'a11yRound3Core.screenshotAltText' },
  { idea: 50528, name: 'Avatar speech captions', in: 'AccessibilityRound3.jsx:AvatarCaptionTrack + a11yRound3Core.avatarCaptionText' },
  { idea: 50529, name: 'Speakable action names', in: 'a11yRound3Core.SPEAKABLE_ACTIONS + speakableActionName' },
  { idea: 50530, name: 'Terminal Esc exit', in: 'a11yRound3Core.shouldExitTerminal + terminalEscHandler' },
  { idea: 50531, name: 'Throttled progress announcements', in: 'AccessibilityRound3.jsx:ProgressAnnouncer + a11yRound3Core.makeProgressAnnouncer (10% steps)' },
  { idea: 50532, name: 'Page landmarks', in: 'AccessibilityRound3.jsx:PageLandmarks + a11yRound3Core.LANDMARKS' },
  { idea: 50533, name: 'Unskipped heading levels', in: 'a11yRound3Core.headingLevelIssues' },
  { idea: 50534, name: 'Descriptive link text', in: 'a11yRound3Core.checkLinkText' },
  { idea: 50535, name: 'Autocomplete attributes', in: 'a11yRound3Core.AUTOCOMPLETE_MAP + autocompleteFor' },
  { idea: 50536, name: 'Text alongside animation', in: 'a11yRound3Core.formatProgress (always text + any animation)' },
  { idea: 50537, name: 'Dual timestamps', in: 'a11yRound3Core.dualTimestamp (relative text + absolute title)' },
  { idea: 50538, name: 'Explained disabled buttons', in: 'a11yRound3Core.disabledButtonProps (aria-disabled + reason)' },
  { idea: 50539, name: 'Theme-tested severity tints', in: 'a11yRound3Core.testSeverityTints (dark + light, 3:1 UI minimum)' },
  { idea: 50540, name: 'Roving tabindex list', in: 'AccessibilityRound3.jsx:RovingTabindexList + a11yRound3Core.rovingTabIndexes' },
  { idea: 50541, name: 'Announced filter changes', in: 'a11yRound3Core.filterAnnouncement' },
  { idea: 50542, name: 'Keyboard severity slider', in: 'AccessibilityRound3.jsx:SeveritySlider + a11yRound3Core.sliderStep/sliderSpokenValue' },
  { idea: 50543, name: 'Describe-this-chart button', in: 'AccessibilityRound3.jsx:DescribeChartButton + a11yRound3Core.describeChart' },
  { idea: 50544, name: 'Low-vision spacing rhythm', in: 'a11yRound3Core.LOW_VISION_SPACING + spacing (8px rhythm)' },
  { idea: 50545, name: 'Underlined links', in: 'a11yRound3Core.LINK_UNDERLINE_POLICY + AccessibilityRound3.css .a11y3-finding-link' },
  { idea: 50546, name: 'Non-haptic confirmations', in: 'a11yRound3Core.destructiveConfirmCopy (visual + text confirmation)' },
  { idea: 50547, name: 'Nested-list graph fallback', in: 'a11yRound3Core.graphToNestedList' },
  { idea: 50548, name: 'Announced agent typing', in: 'a11yRound3Core.typingAnnouncementText' },
  { idea: 50549, name: 'Reduced-data mode', in: 'a11yRound3Core.readMediaPreference + reducedDataClass + AccessibilityRound3.css .a11y3-reduced-data' },
  { idea: 50550, name: 'Keyboard drag equivalents', in: 'AccessibilityRound3.jsx:KeyboardDragHandle + a11yRound3Core.KEYBOARD_DRAG_EQUIVALENTS' },
  { idea: 50551, name: 'Form error summary', in: 'AccessibilityRound3.jsx:FormErrorSummary + a11yRound3Core.formErrorSummary (anchors)' },
  { idea: 50552, name: 'Timeout announcements', in: 'AccessibilityRound3.jsx:TimeoutAnnouncer + a11yRound3Core.timeoutAnnouncementCopy' },
  { idea: 50553, name: 'Keyboard date entry', in: 'AccessibilityRound3.jsx:KeyboardDateInput + a11yRound3Core.keyboardDateProps/parseDateInput' },
  { idea: 50554, name: 'Readability settings', in: 'AccessibilityRound3.jsx:ReadabilitySettingsPanel + a11yRound3Core.READABILITY_DEFAULTS/readabilityStyle' },
  { idea: 50555, name: 'Dyslexia-friendly font', in: 'AccessibilityRound3.jsx:DyslexiaToggle + a11yRound3Core.DYSLEXIA_FONT_STACK/dyslexiaClass' },
  { idea: 50556, name: 'Acronym expansion', in: 'AccessibilityRound3.jsx:AcronymExpander + a11yRound3Core.expandAcronyms/ACRONYM_MAP' },
  { idea: 50557, name: 'Scroll-margin focus', in: 'AccessibilityRound3.jsx:FocusScrollMargin + a11yRound3Core.scrollMarginFor + AccessibilityRound3.css' },
  { idea: 50558, name: 'Announced bulk results', in: 'AccessibilityRound3.jsx:BulkActionAnnouncer + a11yRound3Core.bulkResultAnnouncement' },
  { idea: 50559, name: 'Accessibility statement', in: 'AccessibilityRound3.jsx:AccessibilityStatement + a11yRound3Core.A11Y_STATEMENT' },
  { idea: 50560, name: 'New-card slide-in', in: 'AccessibilityRound3.jsx:NewFindingCard + a11yRound3Core.NEW_CARD_SLIDE_SPEC + AccessibilityRound3.css keyframes' },
];

/* 50521 — Hunt screen-reader summary ----------------------------------------- */

/**
 * Announcement when a hunt loads: "Hunt on example.com, phase Testing, 12 findings".
 */
export function huntSummaryText({ target = '', phase = '', findings = 0 } = {}) {
  const where = target ? `Hunt on ${target}` : 'Hunt';
  const ph = phase ? `, phase ${phase}` : '';
  const n = Number(findings) || 0;
  return `${where}${ph}, ${n} finding${n === 1 ? '' : 's'}.`;
}

/* 50522 — Hidden decorative animation ---------------------------------------- */

/** Decorative visuals must be invisible to assistive tech. */
export function ariaHiddenProps(decorative = true) {
  return decorative ? { 'aria-hidden': 'true' } : {};
}

/* 50523 — Status-change announcements ---------------------------------------- */

const STATUS_COPY = {
  paused: 'Hunt paused. No new findings will be recorded until you resume.',
  resumed: 'Hunt resumed.',
  completed: 'Hunt completed. The findings report is ready.',
  failed: 'Hunt failed. Check the error summary for details.',
};

/** Live-region copy for hunt status changes (pause / resume / completion). */
export function statusAnnouncement(status) {
  return STATUS_COPY[String(status || '').toLowerCase()] || `Hunt status: ${status}.`;
}

/* 50531 — Throttled progress announcements ----------------------------------- */

/**
 * Announce long-operation progress at fixed percentage steps (default 10%),
 * never per frame. Returns { update(pct, label) } → announcement string or null.
 */
export function makeProgressAnnouncer(stepPct = 10) {
  let lastAnnounced = -1;
  return {
    update(pct, label = '') {
      const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
      const step = Math.floor(p / stepPct) * stepPct;
      if (step <= lastAnnounced) return null;
      lastAnnounced = step;
      return formatProgress(p, label);
    },
    reset() { lastAnnounced = -1; },
  };
}

/* 50536 — Text alongside animation -------------------------------------------- */

/** Progress always renders as text too, never animation-only. */
export function formatProgress(pct, label = '') {
  const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  const what = label ? ` — ${label}` : '';
  return `${p}%${what}`;
}

/* 50524 — Sortable table semantics ------------------------------------------- */

/**
 * Props for a sortable <th>: proper scope + aria-sort + a speakable label.
 */
export function sortableHeaderProps(column = {}, sort = {}) {
  const sorted = sort.id === column.id;
  return {
    scope: 'col',
    'aria-sort': sorted ? (sort.direction === 'desc' ? 'descending' : 'ascending') : (column.sortable ? 'none' : undefined),
    'aria-label': column.sortable ? `Sort by ${column.label}` : column.label,
  };
}

/** Announcement when a sortable column changes direction. */
export function sortableAnnouncement(column = {}, direction = 'asc') {
  return `Findings sorted by ${column.label || column.id}, ${direction === 'desc' ? 'descending' : 'ascending'}.`;
}

/* 50525 / 50549 — Reduced transparency / reduced data ------------------------ */

export const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';
export const REDUCED_DATA_QUERY = '(prefers-reduced-data: reduce)';
export const TRANSPARENCY_CLASS = 'a11y3-reduced-transparency';
export const REDUCED_DATA_CLASS = 'a11y3-reduced-data';

/**
 * DOM-free media-preference reader. Pass window.matchMedia in the browser;
 * returns false when no matcher is supplied (safe for SSR / tests).
 */
export function readMediaPreference(query, matchMediaFn = null) {
  if (typeof matchMediaFn !== 'function') return false;
  try {
    return !!matchMediaFn(query).matches;
  } catch {
    return false;
  }
}

/** CSS-class resolver for the reduce-transparency preference. */
export function transparencyClass(prefersReduced) {
  return prefersReduced ? TRANSPARENCY_CLASS : '';
}

/** CSS-class resolver for the reduce-data preference. */
export function reducedDataClass(prefersReduced) {
  return prefersReduced ? REDUCED_DATA_CLASS : '';
}

/* 50526 — Code-block focus contrast ------------------------------------------ */

/**
 * Verify a focus indicator color meets the 3:1 non-text contrast minimum
 * against the code-block background.
 */
export function checkCodeBlockFocus(indicatorColor, codeBackground) {
  const ratio = contrastRatio(indicatorColor, codeBackground);
  return { ratio, required: 3.0, passes: ratio !== null && ratio >= 3.0 };
}

/* 50527 — Screenshot alt text ------------------------------------------------- */

/** Auto-generate alt text for an evidence screenshot from finding metadata. */
export function screenshotAltText(finding = {}) {
  const title = finding.title || 'finding';
  const target = finding.target || 'target';
  const sev = finding.severity || 'unknown severity';
  const kind = finding.evidenceKind || 'screenshot';
  return `${kind} of ${target} showing ${title} (${sev})`;
}

/* 50528 — Avatar speech captions ---------------------------------------------- */

/** Every spoken avatar response ships with caption text for the same content. */
export function avatarCaptionText(spoken) {
  const t = String(spoken || '').trim();
  return t ? `Infinity AI: ${t}` : 'Infinity AI: (no speech)';
}

/* 50529 — Speakable action names ---------------------------------------------- */

export const SPEAKABLE_ACTIONS = {
  'start-hunt': 'Start hunt',
  'pause-hunt': 'Pause hunt',
  'resume-hunt': 'Resume hunt',
  'export-pdf': 'Export findings as PDF',
  'export-csv': 'Export findings as CSV',
  'mark-reviewed': 'Mark finding as reviewed',
  'dismiss-finding': 'Dismiss finding',
  'open-evidence': 'Open evidence details',
  'copy-poc': 'Copy proof of concept',
  'describe-chart': 'Describe this chart',
  'extend-session': 'Extend session by 15 minutes',
  'apply-filters': 'Apply filters',
  'clear-filters': 'Clear all filters',
};

/** Voice-control users get a plain speakable name for every action. */
export function speakableActionName(actionId) {
  return SPEAKABLE_ACTIONS[actionId] || String(actionId || '').replace(/[-_]+/g, ' ').trim() || 'Unnamed action';
}

/* 50530 — Terminal Esc exit ----------------------------------------------------- */

/** The terminal panel never traps keyboards: Esc always exits its focus. */
export function shouldExitTerminal(key) {
  return key === 'Escape' || key === 'Esc';
}

/**
 * Keydown handler factory for the terminal panel: Esc moves focus back to
 * the element that opened the terminal (or blurs when none is known).
 */
export function terminalEscHandler(returnFocusTo = null) {
  return function onKeyDown(event) {
    if (!shouldExitTerminal(event.key)) return false;
    event.stopPropagation();
    if (returnFocusTo && typeof returnFocusTo.focus === 'function') {
      returnFocusTo.focus();
    } else if (event.currentTarget && typeof event.currentTarget.blur === 'function') {
      event.currentTarget.blur();
    }
    return true;
  };
}

/* 50532 — Page landmarks -------------------------------------------------------- */

export const LANDMARKS = {
  header: { tag: 'header', label: 'Site header' },
  nav: { tag: 'nav', label: 'Primary navigation' },
  main: { tag: 'main', label: 'Main content' },
  complementary: { tag: 'aside', label: 'Complementary information' },
  contentinfo: { tag: 'footer', label: 'Footer' },
};

/** Props for a landmark region: semantic tag + accessible name. */
export function landmarkProps(name) {
  const l = LANDMARKS[name];
  if (!l) return {};
  return { 'aria-label': l.label };
}

/* 50533 — Unskipped heading levels ---------------------------------------------- */

/**
 * Validate a heading sequence; report every level skip (WCAG 1.3.1).
 * headings: [{ level: 1..6, text }].
 */
export function headingLevelIssues(headings = []) {
  const issues = [];
  let prev = 0;
  headings.forEach((h, i) => {
    const level = Number(h.level) || 0;
    if (level < 1 || level > 6) {
      issues.push({ index: i, text: h.text, reason: `invalid heading level ${h.level}` });
      return;
    }
    if (prev === 0 && level !== 1) {
      issues.push({ index: i, text: h.text, reason: `first heading is h${level}, expected h1` });
    } else if (level > prev + 1) {
      issues.push({ index: i, text: h.text, reason: `heading level jumps from h${prev} to h${level}` });
    }
    prev = level;
  });
  return issues;
}

/* 50534 — Descriptive link text --------------------------------------------------- */

const VAGUE_LINK_TEXT = ['click here', 'here', 'read more', 'learn more', 'link', 'more', 'this page'];

/**
 * Links must read "Download PDF report", never "click here".
 * Returns { ok, reason }.
 */
export function checkLinkText(text) {
  const t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'link has no accessible text' };
  if (VAGUE_LINK_TEXT.includes(t.toLowerCase())) {
    return { ok: false, reason: `link text "${t}" is not descriptive` };
  }
  if (t.length < 4) return { ok: false, reason: 'link text is too short to be descriptive' };
  return { ok: true, reason: 'descriptive' };
}

/* 50535 — Autocomplete attributes --------------------------------------------------- */

export const AUTOCOMPLETE_MAP = {
  email: 'email',
  username: 'username',
  'new-password': 'new-password',
  'current-password': 'current-password',
  name: 'name',
  organization: 'organization',
  'phone': 'tel',
  url: 'url',
};

/** Proper autocomplete attribute for auth/profile fields. */
export function autocompleteFor(field) {
  return AUTOCOMPLETE_MAP[String(field || '').toLowerCase()] || 'off';
}

/* 50537 — Dual timestamps ----------------------------------------------------------- */

/** Relative text for sighted users + absolute time in title for everyone else. */
export function dualTimestamp(dateInput, nowMs = Date.now()) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return { relative: 'unknown time', title: '' };
  const diffMs = nowMs - d.getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(abs / 3600000);
  const days = Math.floor(abs / 86400000);
  let relative;
  if (mins < 1) relative = 'just now';
  else if (mins < 60) relative = `${mins} minute${mins === 1 ? '' : 's'} ago`;
  else if (hours < 24) relative = `${hours} hour${hours === 1 ? '' : 's'} ago`;
  else relative = `${days} day${days === 1 ? '' : 's'} ago`;
  return { relative, title: d.toLocaleString() };
}

/* 50538 — Explained disabled buttons -------------------------------------------------- */

/**
 * Disabled buttons use aria-disabled (stays focusable) plus a tooltip-grade
 * explanation of WHY, so the reason is perceivable.
 */
export function disabledButtonProps(reason) {
  const why = String(reason || 'This action is not available right now.');
  return {
    'aria-disabled': 'true',
    title: why,
    'data-disabled-reason': why,
  };
}

/* 50539 — Theme-tested severity tints -------------------------------------------------- */

const THEME_BACKGROUNDS = { dark: '#0d1117', light: '#ffffff' };

/**
 * Every severity tint must meet the 3:1 non-text/UI contrast minimum in BOTH
 * dark and light themes. Returns [{ severity, dark: {ratio, passes}, light: {...} }].
 */
export function testSeverityTints() {
  return Object.keys({ critical: 1, high: 1, medium: 1, low: 1, info: 1 }).map((sev) => {
    const { color } = severityTriple(sev);
    const entry = { severity: sev, color };
    for (const [theme, bg] of Object.entries(THEME_BACKGROUNDS)) {
      const { ratio, passes } = meetsWCAG(color, bg, 'ui-icon');
      entry[theme] = { ratio, required: 3.0, passes };
    }
    return entry;
  });
}

/* 50540 — Roving tabindex list ------------------------------------------------------------ */

/**
 * Roving-tabindex helper: exactly one item carries tabindex 0 (the focused
 * one), the rest -1 — so focus survives list re-renders.
 */
export function rovingTabIndexes(count, focusedIndex) {
  return Array.from({ length: count }, (_, i) => (i === focusedIndex ? 0 : -1));
}

/* 50541 — Announced filter changes ---------------------------------------------------------- */

/** Filter changes announce "Showing 7 of 42 findings" in a live region. */
export function filterAnnouncement(shown, total) {
  const s = Number(shown) || 0;
  const t = Number(total) || 0;
  return `Showing ${s} of ${t} finding${t === 1 ? '' : 's'}`;
}

/* 50542 — Keyboard severity slider -------------------------------------------------------------- */

/** Arrow-key stepping for the severity/confidence slider, clamped to bounds. */
export function sliderStep(current, direction, { min = 0, max = 100, step = 5 } = {}) {
  const delta = direction === 'down' ? -step : direction === 'up' ? step : 0;
  return Math.max(min, Math.min(max, (Number(current) || 0) + delta));
}

/** Spoken value for the slider's aria-valuetext. */
export function sliderSpokenValue(value, label = 'Confidence') {
  return `${label} ${Math.round(Number(value) || 0)} percent`;
}

/* 50543 — Describe-this-chart button ---------------------------------------------------------------- */

/**
 * Generate a textual summary of any visualization on demand.
 * chart: { type, title, series: [{ label, value }] }.
 */
export function describeChart(chart = {}) {
  const series = Array.isArray(chart.series) ? chart.series : [];
  if (series.length === 0) return `${chart.title || 'Chart'}: no data.`;
  const total = series.reduce((a, s) => a + (Number(s.value) || 0), 0);
  const top = [...series].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))[0];
  const parts = series.map((s) => `${s.label}: ${s.value}`).join(', ');
  const type = chart.type ? `${chart.type} chart` : 'chart';
  return `${chart.title || 'Chart'} (${type}): ${parts}. Total ${total}. Highest: ${top.label} with ${top.value}.`;
}

/* 50544 — Low-vision spacing rhythm --------------------------------------------------------------------- */

export const LOW_VISION_SPACING = 8; // px base unit

/** Consistent 8px spacing rhythm aids low-vision scanning. */
export function spacing(n) {
  return `${LOW_VISION_SPACING * (Number(n) || 0)}px`;
}

/* 50545 — Underlined links -------------------------------------------------------------------------------- */

export const LINK_UNDERLINE_POLICY =
  'Links inside finding descriptions are always underlined; color is never the only indicator.';

/* 50546 — Non-haptic confirmations --------------------------------------------------------------------------- */

/**
 * Destructive actions confirm with visual + text feedback (not haptics,
 * which assistive tech users may not perceive).
 */
export function destructiveConfirmCopy(actionLabel) {
  const action = actionLabel || 'this action';
  return {
    title: `Confirm: ${action}`,
    body: `This cannot be undone. Type or press confirm to proceed with "${action}".`,
    confirmLabel: `Yes, ${action.toLowerCase()}`,
    cancelLabel: 'Cancel',
    announced: `Confirmation required: ${action}. This cannot be undone.`,
  };
}

/* 50547 — Nested-list graph fallback ---------------------------------------------------------------------------- */

/**
 * Convert the chain graph into a nested list of node relationships for
 * screen readers. graph: { nodes: [{id, label}], edges: [{from, to}] }.
 * Returns [{ id, label, children: [...] }] rooted at nodes with no incoming edges.
 */
export function graphToNestedList(graph = {}) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const childrenOf = new Map();
  const hasIncoming = new Set();
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    if (!childrenOf.has(e.from)) childrenOf.set(e.from, []);
    childrenOf.get(e.from).push(e.to);
    hasIncoming.add(e.to);
  }
  const build = (id, seen) => {
    if (seen.has(id)) return { id, label: byId.get(id).label || id, children: [], cyclic: true };
    const next = new Set(seen);
    next.add(id);
    return {
      id,
      label: byId.get(id).label || id,
      children: (childrenOf.get(id) || []).map((c) => build(c, next)),
    };
  };
  const roots = nodes.filter((n) => !hasIncoming.has(n.id));
  const start = roots.length > 0 ? roots : nodes.slice(0, 1);
  return start.map((n) => build(n.id, new Set()));
}

/* 50548 — Announced agent typing ---------------------------------------------------------------------------------- */

/** The agent's "typing" state in mid-hunt chat is announced to screen readers. */
export function typingAnnouncementText(agentName = 'Infinity AI') {
  return `${agentName} is typing.`;
}

/* 50550 — Keyboard drag equivalents ---------------------------------------------------------------------------------- */

export const KEYBOARD_DRAG_EQUIVALENTS = {
  'reorder-finding': { keys: 'Ctrl+ArrowUp / Ctrl+ArrowDown', description: 'Move the focused finding up or down in the list' },
  'move-card-column': { keys: 'Ctrl+ArrowLeft / Ctrl+ArrowRight', description: 'Move the focused card to the previous or next column' },
  'resize-panel': { keys: 'Alt+Arrow keys', description: 'Resize the focused panel in 8px steps' },
  'reorder-filter-pill': { keys: 'Ctrl+ArrowLeft / Ctrl+ArrowRight', description: 'Reorder the focused filter pill' },
};

/** Every drag handle shows visible focus and ships a keyboard equivalent. */
export function dragKeyboardEquivalent(dragAction) {
  return KEYBOARD_DRAG_EQUIVALENTS[dragAction] || null;
}

/* 50551 — Form error summary ---------------------------------------------------------------------------------------------- */

/**
 * Forms list all errors at the top with anchor links to each field.
 * errors: [{ fieldId, label, message }].
 */
export function formErrorSummary(errors = []) {
  const items = errors.map((e) => ({
    fieldId: e.fieldId,
    label: e.label || e.fieldId,
    message: e.message || 'Invalid value',
    anchor: `#field-${e.fieldId}`,
  }));
  return {
    count: items.length,
    heading: items.length === 0
      ? 'No errors'
      : `${items.length} error${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} your attention`,
    items,
  };
}

/* 50552 — Timeout announcements -------------------------------------------------------------------------------------------------- */

export const SESSION_EXTEND_COPY = {
  extendLabel: 'Extend session',
  extended: 'Session extended by 15 minutes.',
  expired: 'Your session has expired. Please sign in again.',
};

/** Session timeouts announce with an extend option. */
export function timeoutAnnouncementCopy(minutesLeft) {
  const m = Math.max(0, Math.round(Number(minutesLeft) || 0));
  return {
    announcement: m === 0
      ? SESSION_EXTEND_COPY.expired
      : `Your session expires in ${m} minute${m === 1 ? '' : 's'}.`,
    extendLabel: SESSION_EXTEND_COPY.extendLabel,
  };
}

/* 50553 — Keyboard date entry -------------------------------------------------------------------------------------------------------- */

/** Date pickers always offer a keyboard-entry fallback text input. */
export function keyboardDateProps() {
  return {
    type: 'text',
    inputMode: 'numeric',
    placeholder: 'YYYY-MM-DD',
    pattern: '\\d{4}-\\d{2}-\\d{2}',
    'aria-describedby': 'date-format-hint',
  };
}

/** Validate the keyboard-entered date string (YYYY-MM-DD, real calendar date). */
export function parseDateInput(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim());
  if (!m) return { ok: false, reason: 'Use the YYYY-MM-DD format' };
  const [, y, mo, d] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  const ok = date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
  return ok
    ? { ok: true, iso: date.toISOString().slice(0, 10) }
    : { ok: false, reason: 'That date does not exist on the calendar' };
}

/* 50554 — Readability settings ------------------------------------------------------------------------------------------------------------ */

export const READABILITY_DEFAULTS = {
  lineHeight: 1.5,
  letterSpacing: '0.02em',
  wordSpacing: '0.06em',
  fontSize: '100%',
};

/** Convert readability settings into a style object for the settings scope. */
export function readabilityStyle(settings = {}) {
  const s = { ...READABILITY_DEFAULTS, ...settings };
  return {
    lineHeight: Number(s.lineHeight) || READABILITY_DEFAULTS.lineHeight,
    letterSpacing: s.letterSpacing,
    wordSpacing: s.wordSpacing,
    fontSize: s.fontSize,
  };
}

/* 50555 — Dyslexia-friendly font ---------------------------------------------------------------------------------------------------------------- */

export const DYSLEXIA_FONT_STACK =
  '"OpenDyslexic", "Atkinson Hyperlegible", Verdana, "Segoe UI", sans-serif';

export const DYSLEXIA_CLASS = 'a11y3-dyslexia';

/** Toggle class for the dyslexia-friendly typeface. */
export function dyslexiaClass(enabled) {
  return enabled ? DYSLEXIA_CLASS : '';
}

/* 50556 — Acronym expansion ------------------------------------------------------------------------------------------------------------------------ */

export const ACRONYM_MAP = {
  SSRF: 'server-side request forgery',
  XSS: 'cross-site scripting',
  SQLi: 'SQL injection',
  CSRF: 'cross-site request forgery',
  IDOR: 'insecure direct object reference',
  CVSS: 'common vulnerability scoring system',
  CWE: 'common weakness enumeration',
  ATO: 'account takeover',
  RCE: 'remote code execution',
  LFI: 'local file inclusion',
  SSTI: 'server-side template injection',
};

/**
 * Expand acronyms on first use for screen-reader pronunciation:
 * "SSRF" → "SSRF (server-side request forgery)".
 * Returns { text, expanded: [acronyms expanded] }.
 */
export function expandAcronyms(text) {
  let out = String(text || '');
  const expanded = [];
  for (const [acro, full] of Object.entries(ACRONYM_MAP)) {
    const re = new RegExp(`\\b${acro}\\b`);
    if (re.test(out) && !out.includes(`${acro} (${full})`)) {
      out = out.replace(re, `${acro} (${full})`);
      expanded.push(acro);
    }
  }
  return { text: out, expanded };
}

/* 50557 — Scroll-margin focus ---------------------------------------------------------------------------------------------------------------------------- */

/** Sticky headers never obscure focused elements: scroll-margin = header height + gap. */
export function scrollMarginFor(stickyHeaderHeightPx = 64, gapPx = 8) {
  const h = Math.max(0, Number(stickyHeaderHeightPx) || 0);
  const g = Math.max(0, Number(gapPx) || 0);
  return `${h + g}px`;
}

/* 50558 — Announced bulk results -------------------------------------------------------------------------------------------------------------------------------- */

/** Bulk actions announce results like "24 findings marked reviewed". */
export function bulkResultAnnouncement(actionLabel, count) {
  const c = Number(count) || 0;
  return `${c} finding${c === 1 ? '' : 's'} ${actionLabel || 'updated'}`;
}

/* 50559 — Accessibility statement ------------------------------------------------------------------------------------------------------------------------------------- */

export const A11Y_STATEMENT = {
  title: 'Accessibility statement',
  conformance: 'WCAG 2.2 AA',
  updated: '2026-10-07',
  summary:
    'Infinity AI is committed to making Dark-Matter usable by everyone, including people who use screen readers, keyboard-only navigation, voice control, and other assistive technologies. Our target conformance level is WCAG 2.2 AA.',
  commitments: [
    'Every hunt view is fully operable with a keyboard alone.',
    'Severity is never conveyed by color alone — every severity ships with a label and icon.',
    'Status changes, new findings, progress, and errors are announced through live regions.',
    'Text meets a 4.5:1 contrast minimum; UI components and focus indicators meet 3:1.',
    'Reduced-motion, reduced-transparency, reduced-data, and high-contrast preferences are respected.',
    'Touch targets are at least 44 by 44 pixels.',
  ],
  limitations:
    'Some canvas-based visualizations (the chain graph) rely on a nested-list text fallback for assistive technology until a fully keyboard-navigable canvas is available.',
  feedbackChannel: {
    label: 'Report an accessibility issue on GitHub',
    href: 'https://github.com/Obfinityy/Dark-Matter/issues',
  },
};

/* 50560 — New-card slide-in ------------------------------------------------------------------------------------------------------------------------------------------------ */

export const NEW_CARD_SLIDE_SPEC = {
  durationMs: 300,
  easing: 'ease-out',
  translateFrom: 'translateY(12px)',
  severityFlash: true,
  flashFadeMs: 1200,
  disabledUnderReducedMotion: true,
};
