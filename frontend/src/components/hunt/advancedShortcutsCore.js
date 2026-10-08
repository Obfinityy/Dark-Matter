/**
 * advancedShortcutsCore.js — Forge wave 13, ideas 50481–50499.
 *
 * Pure, DOM-free logic for keyboard-shortcuts round 2: Esc-hierarchy
 * resolution, shortcut remap conflict detection, adaptive-hint mouse-use
 * tracking, phase-pipeline arrow navigation, numbered suggestion picking,
 * deep-link building, single-finding PDF payloads, F6 region cycling, and
 * the wave-13 idea registry.
 *
 * Reuses normalizeKeyEvent / isTypingTarget from shortcutsCore.js so the
 * new bindings speak the same combo language as wave 12. Node-testable
 * (no DOM at import time).
 */

import { SHORTCUTS as WAVE12_SHORTCUTS, normalizeKeyEvent } from './shortcutsCore.js';

/* Idea registry: ideas 50481–50499 mapped exactly once ---------------------- */
/* 'in' names the real implementation; SKIP entries name the existing        */
/* binding/implementation they honestly reuse (no reinvention).              */

export const WAVE13_SHORTCUTS_IDEAS = [
  {
    idea: 50481,
    name: 'Home/End list jumps',
    in: 'AdvancedShortcuts.jsx:AdvancedShortcutsProvider (first/last finding focus)',
  },
  {
    idea: 50482,
    name: 'PageUp/PageDown scroll',
    in: 'AdvancedShortcuts.jsx:AdvancedShortcutsProvider (scroll findings list by viewport)',
  },
  {
    idea: 50483,
    name: 'Ctrl+, settings / Ctrl+. theme',
    in: 'SKIP: already live — wave 12 ShortcutsManager.jsx:ShortcutsProvider (settings-open / theme-cycle bindings)',
  },
  {
    idea: 50484,
    name: 'Printable shortcut card',
    in: 'AdvancedShortcuts.jsx:PrintableShortcutCard (print stylesheet, reset to defaults)',
  },
  {
    idea: 50485,
    name: 'Remappable shortcuts',
    in: 'AdvancedShortcuts.jsx:RemapDialog + advancedShortcutsCore.findRemapConflicts',
  },
  {
    idea: 50486,
    name: 'Adaptive shortcut hints',
    in: 'AdvancedShortcuts.jsx:AdaptiveHint + advancedShortcutsCore.recordMouseUse/shouldShowHint',
  },
  {
    idea: 50487,
    name: 'Typing-mode guard',
    in: 'AdvancedShortcuts.jsx:TypingGuardIndicator + AdvancedShortcutsProvider typing guard',
  },
  {
    idea: 50488,
    name: 'F6 region cycling',
    in: 'AdvancedShortcuts.jsx:F6RegionCycler + advancedShortcutsCore.F6_REGIONS',
  },
  {
    idea: 50489,
    name: 'Ctrl+Shift+E finding PDF',
    in: 'AdvancedShortcuts.jsx:AdvancedShortcutsProvider + advancedShortcutsCore.findingPdfPayload',
  },
  {
    idea: 50490,
    name: 'Alt+arrows hunt history',
    in: 'AdvancedShortcuts.jsx:AdvancedShortcutsProvider (alt+arrowleft/arrowright)',
  },
  {
    idea: 50491,
    name: 'New-shortcut highlights',
    in: 'AdvancedShortcuts.jsx:NewShortcutHighlights + advancedShortcutsCore.NEW_WAVE13_SHORTCUTS',
  },
  {
    idea: 50492,
    name: 'Numbered chat suggestions',
    in: 'AdvancedShortcuts.jsx:NumberedSuggestions + advancedShortcutsCore.pickSuggestion',
  },
  {
    idea: 50493,
    name: 'Ctrl+Enter starts hunt',
    in: 'AdvancedShortcuts.jsx:AdvancedShortcutsProvider ([data-hunt-target] input)',
  },
  {
    idea: 50494,
    name: 'Esc hierarchy',
    in: 'AdvancedShortcuts.jsx:useEscHierarchy + advancedShortcutsCore.resolveEscAction',
  },
  {
    idea: 50495,
    name: 'Phase-pipeline arrows',
    in: 'AdvancedShortcuts.jsx:PhasePipelineArrows + advancedShortcutsCore.movePhaseIndex',
  },
  {
    idea: 50496,
    name: 'Keyboard-operable tour',
    in: 'AdvancedShortcuts.jsx:KeyboardTour (roving focus, all steps keyboard-driven)',
  },
  {
    idea: 50497,
    name: 'Shift+N newest finding',
    in: 'AdvancedShortcuts.jsx:AdvancedShortcutsProvider (focus newest [data-finding-card])',
  },
  {
    idea: 50498,
    name: 'Ctrl+Shift+C deep link',
    in: 'AdvancedShortcuts.jsx:AdvancedShortcutsProvider + advancedShortcutsCore.buildDeepLink',
  },
  {
    idea: 50499,
    name: 'Keyboard-first onboarding',
    in: 'AdvancedShortcuts.jsx:ShortcutOnboarding + advancedShortcutsCore.ONBOARDING_STEPS',
  },
];

/* New binding registry (wave-13 additions only; wave-12 combos unchanged) --- */

export const ADVANCED_SHORTCUTS = [
  { id: 'finding-first', keys: ['home'], label: 'Jump to first finding', group: 'List navigation' },
  { id: 'finding-last', keys: ['end'], label: 'Jump to last finding', group: 'List navigation' },
  {
    id: 'list-page-up',
    keys: ['pageup'],
    label: 'Scroll list up one viewport',
    group: 'List navigation',
  },
  {
    id: 'list-page-down',
    keys: ['pagedown'],
    label: 'Scroll list down one viewport',
    group: 'List navigation',
  },
  {
    id: 'finding-newest',
    keys: ['shift+n'],
    label: 'Focus the newest finding',
    group: 'List navigation',
  },
  {
    id: 'region-cycle',
    keys: ['f6'],
    label: 'Cycle focus: nav → main → sidebar → chat',
    group: 'Focus',
  },
  {
    id: 'finding-pdf',
    keys: ['ctrl+shift+e'],
    label: 'Export focused finding as PDF',
    group: 'Export',
  },
  {
    id: 'history-back',
    keys: ['alt+arrowleft'],
    label: 'Hunt history back (like browser)',
    group: 'History',
  },
  {
    id: 'history-forward',
    keys: ['alt+arrowright'],
    label: 'Hunt history forward',
    group: 'History',
  },
  {
    id: 'finding-deep-link',
    keys: ['ctrl+shift+c'],
    label: 'Copy deep link to focused finding',
    group: 'Share',
  },
  {
    id: 'hunt-start-target',
    keys: ['ctrl+enter'],
    label: 'Start hunt from target input',
    group: 'Hunt',
    inInput: '[data-hunt-target]',
  },
  {
    id: 'shortcut-remap',
    keys: [],
    label: 'Remap shortcuts (open remap dialog)',
    group: 'Shortcuts',
  },
  { id: 'shortcut-print', keys: [], label: 'Open printable shortcut card', group: 'Shortcuts' },
];

/** New-in-wave-13 highlight data (50491) — shown by NewShortcutHighlights. */
export const NEW_WAVE13_SHORTCUTS = ADVANCED_SHORTCUTS.filter(s => s.keys.length > 0).map(s => ({
  keys: s.keys,
  label: s.label,
  id: s.id,
}));

/** F6 focus regions in cycle order (50488). */
export const F6_REGIONS = [
  { id: 'nav', label: 'Navigation', selector: '[data-region="nav"]' },
  { id: 'main', label: 'Main content', selector: '[data-region="main"]' },
  { id: 'sidebar', label: 'Sidebar', selector: '[data-region="sidebar"]' },
  { id: 'chat', label: 'Chat', selector: '[data-region="chat"]' },
];

/* Esc hierarchy (50494) ---------------------------------------------------- */
/* Order: close menus → collapse cards → clear search → blur input. The       */
/* pure resolver picks the first applicable step so overlays can share one    */
/* predictable Esc ladder instead of each fighting over the key.              */

export const ESC_STEPS = ['close-menu', 'collapse-card', 'clear-search', 'blur-input'];

/**
 * Resolve which Esc step applies to the given UI state.
 * @param {{menuOpen:boolean, cardOpen:boolean, searchActive:boolean, inputFocused:boolean}} state
 * @returns {string|null} the step id, or null when nothing can consume Esc.
 */
export function resolveEscAction(state = {}) {
  if (state.menuOpen) return 'close-menu';
  if (state.cardOpen) return 'collapse-card';
  if (state.searchActive) return 'clear-search';
  if (state.inputFocused) return 'blur-input';
  return null;
}

/* Remap conflict detection (50485) ----------------------------------------- */

/**
 * Detect remap conflicts against the full binding set (wave-12 + wave-13).
 * @param {Record<string,string>} remaps — { actionId: combo } user remaps
 * @returns {Array<{actionId:string, combo:string, conflictsWith:string[]}>}
 */
export function findRemapConflicts(remaps = {}) {
  const all = [
    ...WAVE12_SHORTCUTS.filter(s => s.keys?.length).map(s => ({ id: s.id, keys: s.keys })),
    ...ADVANCED_SHORTCUTS.filter(s => s.keys?.length).map(s => ({ id: s.id, keys: s.keys })),
  ];
  const conflicts = [];
  for (const [actionId, combo] of Object.entries(remaps)) {
    const hit = all.filter(s => s.id !== actionId && s.keys.some(k => k === combo));
    if (hit.length) conflicts.push({ actionId, combo, conflictsWith: hit.map(s => s.id) });
  }
  return conflicts;
}

/* Adaptive shortcut hints (50486) ------------------------------------------ */
/* After N mouse-driven uses of an action, the UI should surface its keyboard */
/* shortcut instead of hiding it in a tooltip. Threshold: 3.                 */

export const ADAPTIVE_HINT_THRESHOLD = 3;
const HINT_KEY = 'dm-adv-mouse-uses-v1';

function hintStore(storage) {
  const mem = { [HINT_KEY]: '{}' };
  const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : mem);
  return {
    get() {
      try {
        return JSON.parse(s.getItem(HINT_KEY) || '{}');
      } catch {
        return {};
      }
    },
    set(v) {
      try {
        s.setItem(HINT_KEY, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
  };
}

/** Record one mouse-driven use of an action. Returns the new count. */
export function recordMouseUse(storage, actionId) {
  const st = hintStore(storage);
  const counts = st.get();
  counts[actionId] = (counts[actionId] || 0) + 1;
  st.set(counts);
  return counts[actionId];
}

/** True once the user has mouse-used an action ≥ 3 times (show the hint). */
export function shouldShowHint(storage, actionId) {
  return (hintStore(storage).get()[actionId] || 0) >= ADAPTIVE_HINT_THRESHOLD;
}

/* Phase-pipeline arrows (50495) -------------------------------------------- */

/**
 * Move a phase index by one step, clamped to the pipeline bounds.
 * @param {number} idx current phase index
 * @param {number} dir -1 (left/up) or +1 (right/down)
 * @param {number} total number of phases
 */
export function movePhaseIndex(idx, dir, total) {
  if (!Number.isFinite(idx) || !Number.isFinite(total) || total <= 0) return 0;
  const next = idx + (dir > 0 ? 1 : -1);
  return Math.min(total - 1, Math.max(0, next));
}

/* Numbered chat suggestions (50492) ---------------------------------------- */

/**
 * Pick suggestion by number-badge (1–5). Returns the suggestion or null.
 */
export function pickSuggestion(suggestions = [], num) {
  const i = Number(num) - 1;
  if (!Array.isArray(suggestions) || !Number.isInteger(i) || i < 0 || i >= 5) return null;
  return suggestions[i] ?? null;
}

/* Deep link + single-finding PDF payload ----------------------------------- */

/** Build a shareable deep link to one finding (50498). */
export function buildDeepLink(findingId, base = '') {
  if (!findingId) return null;
  const b = String(base || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /[#/?]+$/,
    ''
  );
  return `${b}/#/findings/${encodeURIComponent(findingId)}`;
}

/** Payload the PDF exporter consumes for one finding (50489). */
export function findingPdfPayload(finding = {}) {
  return {
    title: finding.title || 'Finding',
    severity: finding.severity || 'unknown',
    target: finding.target || '',
    evidence: finding.evidence || finding.poc || '',
    cwe: finding.cwe || '',
    exportedAt: new Date().toISOString(),
  };
}

/* Keyboard-first onboarding (50499) ---------------------------------------- */
/* Five interactive steps teaching the five core shortcuts. The component     */
/* listens for the real keypress of each step — no simulation, the user      */
/* performs the actual shortcut.                                             */

export const ONBOARDING_STEPS = [
  {
    n: 1,
    combo: 'j',
    action: 'finding-next',
    label: 'Navigate',
    hint: 'Press J to move to the next finding',
  },
  { n: 2, combo: '/', action: 'focus-search', label: 'Search', hint: 'Press / to jump to search' },
  {
    n: 3,
    combo: 'enter',
    action: 'finding-open',
    label: 'Open',
    hint: 'Press Enter to open the focused finding',
  },
  {
    n: 4,
    combo: 'escape',
    action: 'esc-hierarchy',
    label: 'Dismiss',
    hint: 'Press Esc to close it back down',
  },
  {
    n: 5,
    combo: '?',
    action: 'cheat-sheet',
    label: 'Help',
    hint: 'Press Shift+? to open the shortcut cheat sheet',
  },
];

/* Re-export so consumers can bind tests against one module ----------------- */
export { normalizeKeyEvent };
