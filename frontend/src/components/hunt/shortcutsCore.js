/**
 * shortcutsCore.js — Forge wave 12, ideas 50441–50480.
 *
 * Pure, DOM-free logic for the keyboard-shortcut / accessibility / onboarding
 * suite: binding registry, key-event normalization, g-prefix sequence
 * tracking, rotating-tips rotation, cheat-sheet search, PoC markdown export,
 * verified-checkmark and share-link copy.
 *
 * Imported by ShortcutsManager.jsx. Node-testable (no DOM at import time).
 */

/* Idea registry: all 40 ideas 50441–50480 mapped exactly once --------------- */
/* 'in' names the real implementation; the 3 SKIP entries name the wave-6    */
/* component that already shipped the idea (no re-implementation).           */

export const WAVE12_IDEAS = [
  {
    idea: 50441,
    name: 'Rotating tips bar',
    in: 'ShortcutsManager.jsx:RotatingTipsBar + shortcutsCore.TIPS',
  },
  {
    idea: 50442,
    name: 'Verified-checkmark tooltip',
    in: 'ShortcutsManager.jsx:VerifiedCheckmark + shortcutsCore.verifiedCheckmarkText',
  },
  {
    idea: 50443,
    name: 'Share-link explainer',
    in: 'ShortcutsManager.jsx:ShareLinkExplainer + shortcutsCore.shareLinkExplainer',
  },
  {
    idea: 50444,
    name: 'Simulate-toggle clarification',
    in: 'ShortcutsManager.jsx:SimulateToggleTip + shortcutsCore.simulateToggleCopy',
  },
  {
    idea: 50445,
    name: 'Shortcut cheat sheet (hunt-ux)',
    in: 'ShortcutsManager.jsx:ShortcutCheatSheet (searchable + printable)',
  },
  {
    idea: 50446,
    name: 'J/K list navigation',
    in: 'ShortcutsManager.jsx:ShortcutsProvider moveCardFocus',
  },
  {
    idea: 50447,
    name: 'Enter/Esc card toggle',
    in: 'ShortcutsManager.jsx:ShortcutsProvider card-toggle/card-collapse',
  },
  {
    idea: 50448,
    name: 'Single-key triage',
    in: 'ShortcutsManager.jsx:ShortcutsProvider triage-reviewed/triage-false-positive/triage-star',
  },
  {
    idea: 50449,
    name: 'Slash-focus search',
    in: 'SKIP: already live — wave 6 FindingCards5.useGlobalShortcuts ("/" focuses [data-fc5-search-input])',
  },
  {
    idea: 50450,
    name: 'G-prefix page jumps',
    in: 'ShortcutsManager.jsx:ShortcutsProvider + shortcutsCore.SequenceTracker',
  },
  {
    idea: 50451,
    name: 'Space pause/resume',
    in: 'ShortcutsManager.jsx:ShortcutsProvider toggle-pause (data-hunt-paused + event)',
  },
  {
    idea: 50452,
    name: 'Number-key severity filters',
    in: 'ShortcutsManager.jsx:ShortcutsProvider filter-severity + shortcutsCore.SEVERITY_KEYS',
  },
  {
    idea: 50453,
    name: 'N/P phase navigation',
    in: 'ShortcutsManager.jsx:ShortcutsProvider phase-next/phase-prev',
  },
  {
    idea: 50454,
    name: 'Bracket timeline scrub',
    in: 'ShortcutsManager.jsx:TimelineKeyNav ([ ] scrub)',
  },
  {
    idea: 50455,
    name: 'C copies PoC',
    in: 'ShortcutsManager.jsx:ShortcutsProvider copy-poc + shortcutsCore.markdownPoC',
  },
  {
    idea: 50456,
    name: 'E exports view',
    in: 'ShortcutsManager.jsx:ExportViewPicker + ShortcutsProvider export-view',
  },
  {
    idea: 50457,
    name: 'T focuses chat',
    in: 'ShortcutsManager.jsx:ShortcutsProvider focus-chat + chat-send (Ctrl+Enter)',
  },
  {
    idea: 50458,
    name: 'A opens ask-agent',
    in: 'ShortcutsManager.jsx:ShortcutsProvider open-ask-agent',
  },
  {
    idea: 50459,
    name: 'D toggles density',
    in: 'ShortcutsManager.jsx:ShortcutsProvider toggle-density (data-density + localStorage)',
  },
  {
    idea: 50460,
    name: 'V toggles view',
    in: 'ShortcutsManager.jsx:ShortcutsProvider toggle-view (data-view + localStorage)',
  },
  {
    idea: 50461,
    name: 'O opens full page',
    in: 'ShortcutsManager.jsx:ShortcutsProvider open-finding',
  },
  {
    idea: 50462,
    name: 'B toggles sidebar',
    in: 'ShortcutsManager.jsx:ShortcutsProvider toggle-sidebar (data-sidebar + localStorage)',
  },
  {
    idea: 50463,
    name: 'M mutes sounds',
    in: 'ShortcutsManager.jsx:ShortcutsProvider toggle-mute (dm-muted + toast)',
  },
  {
    idea: 50464,
    name: 'Question-mark help',
    in: 'SKIP: already live — wave 6 FindingCards5.ShortcutsHelpOverlay ("?" toggles help)',
  },
  {
    idea: 50465,
    name: 'Arrow-key timeline walk',
    in: 'ShortcutsManager.jsx:TimelineKeyNav (roving tabindex + focus ring)',
  },
  {
    idea: 50466,
    name: 'Logical tab order',
    in: 'ShortcutsManager.jsx:ensureLogicalTabOrder + SkipLinks landmarks',
  },
  { idea: 50467, name: 'Skip links', in: 'ShortcutsManager.jsx:SkipLinks' },
  { idea: 50468, name: 'Modal focus trap', in: 'ShortcutsManager.jsx:FocusTrap' },
  {
    idea: 50469,
    name: 'Command palette (Ctrl+K variant)',
    in: 'SKIP: already live — wave 6 FindingCards5.CommandPalette (Ctrl/Cmd+K, hunts/actions/settings/docs targets)',
  },
  {
    idea: 50470,
    name: 'Ctrl+Shift+F global search',
    in: 'ShortcutsManager.jsx:ShortcutsProvider global-search (pre-scoped)',
  },
  {
    idea: 50471,
    name: 'Alt+number widget focus',
    in: 'ShortcutsManager.jsx:ShortcutsProvider focus-widget ([data-widget-index])',
  },
  {
    idea: 50472,
    name: 'X bulk selection',
    in: 'ShortcutsManager.jsx:ShortcutsProvider bulk-select/bulk-range (aria-selected)',
  },
  {
    idea: 50473,
    name: 'U undo status change',
    in: 'ShortcutsManager.jsx:ShortcutsProvider undo-status + recordStatusChange + shortcutsCore.undoToastText',
  },
  {
    idea: 50474,
    name: 'Ctrl+D duplicate hunt',
    in: 'ShortcutsManager.jsx:ShortcutsProvider duplicate-hunt',
  },
  {
    idea: 50475,
    name: 'Period quick menu',
    in: 'ShortcutsManager.jsx:QuickActionMenu + ShortcutsProvider quick-menu',
  },
  {
    idea: 50476,
    name: 'Shift+R request retest',
    in: 'ShortcutsManager.jsx:ShortcutsProvider request-retest',
  },
  {
    idea: 50477,
    name: 'L toggles terminal',
    in: 'ShortcutsManager.jsx:ShortcutsProvider toggle-terminal/terminal-popout',
  },
  {
    idea: 50478,
    name: 'W watch toggle',
    in: 'ShortcutsManager.jsx:ShortcutsProvider toggle-watch',
  },
  {
    idea: 50479,
    name: 'Z zen mode',
    in: 'ShortcutsManager.jsx:ShortcutsProvider toggle-zen (data-zen, Esc exits)',
  },
  {
    idea: 50480,
    name: 'Expand/collapse all',
    in: 'ShortcutsManager.jsx:ShortcutsProvider expand-all/collapse-all (Shift+E / Shift+C)',
  },
];

/* Shortcut binding registry ------------------------------------------------- */
/* `keys` holds canonical combos (see normalizeKeyEvent). `sequence: true`   */
/* marks a two-key g-prefix sequence. `existing: true` marks a binding owned */
/* by wave 6's FindingCards5 — listed here so the cheat sheet stays complete. */

export const SHORTCUTS = [
  {
    id: 'cheat-sheet',
    keys: ['shift+?'],
    idea: 50445,
    label: 'Open shortcut cheat sheet',
    group: 'Help',
  },
  {
    id: 'focus-next',
    keys: ['j'],
    idea: 50446,
    label: 'Next finding in list',
    group: 'Navigation',
  },
  {
    id: 'focus-prev',
    keys: ['k'],
    idea: 50446,
    label: 'Previous finding in list',
    group: 'Navigation',
  },
  {
    id: 'card-toggle',
    keys: ['enter'],
    idea: 50447,
    label: 'Expand / collapse focused card',
    group: 'Navigation',
  },
  {
    id: 'card-collapse',
    keys: ['esc'],
    idea: 50447,
    label: 'Collapse focused card / close overlay',
    group: 'Navigation',
  },
  {
    id: 'triage-reviewed',
    keys: ['r'],
    idea: 50448,
    label: 'Mark focused finding reviewed',
    group: 'Triage',
  },
  {
    id: 'triage-false-positive',
    keys: ['f'],
    idea: 50448,
    label: 'Flag focused finding as false positive',
    group: 'Triage',
  },
  { id: 'triage-star', keys: ['s'], idea: 50448, label: 'Star focused finding', group: 'Triage' },
  {
    id: 'slash-focus-search',
    keys: ['/'],
    idea: 50449,
    label: 'Focus findings search',
    group: 'Navigation',
    existing: true,
    existingIn: 'FindingCards5.useGlobalShortcuts',
  },
  {
    id: 'go-hunt',
    keys: ['g h'],
    idea: 50450,
    label: 'Go to Hunt (G then H)',
    group: 'Navigation',
    sequence: true,
  },
  {
    id: 'go-infinity',
    keys: ['g i'],
    idea: 50450,
    label: 'Go to Infinity AI (G then I)',
    group: 'Navigation',
    sequence: true,
  },
  {
    id: 'go-models',
    keys: ['g m'],
    idea: 50450,
    label: 'Go to Models (G then M)',
    group: 'Navigation',
    sequence: true,
  },
  {
    id: 'toggle-pause',
    keys: ['space'],
    idea: 50451,
    label: 'Pause / resume the active hunt',
    group: 'Hunt control',
  },
  {
    id: 'filter-severity-critical',
    keys: ['1'],
    idea: 50452,
    label: 'Filter: critical severity',
    group: 'Filters',
  },
  {
    id: 'filter-severity-high',
    keys: ['2'],
    idea: 50452,
    label: 'Filter: high severity',
    group: 'Filters',
  },
  {
    id: 'filter-severity-medium',
    keys: ['3'],
    idea: 50452,
    label: 'Filter: medium severity',
    group: 'Filters',
  },
  {
    id: 'filter-severity-low',
    keys: ['4'],
    idea: 50452,
    label: 'Filter: low severity',
    group: 'Filters',
  },
  {
    id: 'phase-next',
    keys: ['n'],
    idea: 50453,
    label: 'Next phase in timeline',
    group: 'Timeline',
  },
  {
    id: 'phase-prev',
    keys: ['p'],
    idea: 50453,
    label: 'Previous phase in timeline',
    group: 'Timeline',
  },
  {
    id: 'timeline-back',
    keys: ['['],
    idea: 50454,
    label: 'Scrub timeline one event back',
    group: 'Timeline',
  },
  {
    id: 'timeline-forward',
    keys: [']'],
    idea: 50454,
    label: 'Scrub timeline one event forward',
    group: 'Timeline',
  },
  {
    id: 'copy-poc',
    keys: ['c'],
    idea: 50455,
    label: 'Copy focused finding PoC as markdown',
    group: 'Triage',
  },
  {
    id: 'export-view',
    keys: ['e'],
    idea: 50456,
    label: 'Export current filtered view…',
    group: 'Actions',
  },
  {
    id: 'focus-chat',
    keys: ['t'],
    idea: 50457,
    label: 'Focus mid-hunt chat input',
    group: 'Hunt control',
  },
  {
    id: 'chat-send',
    keys: ['ctrl+enter'],
    idea: 50457,
    label: 'Send chat message (from chat input)',
    group: 'Hunt control',
    inInput: true,
  },
  {
    id: 'open-ask-agent',
    keys: ['a'],
    idea: 50458,
    label: 'Open ask-agent panel for this hunt',
    group: 'Actions',
  },
  {
    id: 'toggle-density',
    keys: ['d'],
    idea: 50459,
    label: 'Toggle card density comfortable / compact',
    group: 'View',
  },
  {
    id: 'toggle-view',
    keys: ['v'],
    idea: 50460,
    label: 'Toggle findings list / grid view',
    group: 'View',
  },
  {
    id: 'open-finding',
    keys: ['o'],
    idea: 50461,
    label: 'Open focused finding full-page',
    group: 'Navigation',
  },
  {
    id: 'toggle-sidebar',
    keys: ['b'],
    idea: 50462,
    label: 'Collapse / expand hunt-history sidebar',
    group: 'View',
  },
  {
    id: 'toggle-mute',
    keys: ['m'],
    idea: 50463,
    label: 'Mute / unmute notification sounds',
    group: 'View',
  },
  {
    id: 'question-help',
    keys: ['?'],
    idea: 50464,
    label: 'Open shortcuts help',
    group: 'Help',
    existing: true,
    existingIn: 'FindingCards5.ShortcutsHelpOverlay',
  },
  {
    id: 'global-search',
    keys: ['ctrl+shift+f'],
    idea: 50470,
    label: 'Global search, pre-scoped to current hunt',
    group: 'Navigation',
  },
  {
    id: 'focus-widget-1',
    keys: ['alt+1'],
    idea: 50471,
    label: 'Focus dashboard widget 1',
    group: 'Navigation',
  },
  {
    id: 'focus-widget-2',
    keys: ['alt+2'],
    idea: 50471,
    label: 'Focus dashboard widget 2',
    group: 'Navigation',
  },
  {
    id: 'focus-widget-3',
    keys: ['alt+3'],
    idea: 50471,
    label: 'Focus dashboard widget 3',
    group: 'Navigation',
  },
  {
    id: 'focus-widget-4',
    keys: ['alt+4'],
    idea: 50471,
    label: 'Focus dashboard widget 4',
    group: 'Navigation',
  },
  {
    id: 'focus-widget-5',
    keys: ['alt+5'],
    idea: 50471,
    label: 'Focus dashboard widget 5',
    group: 'Navigation',
  },
  {
    id: 'focus-widget-6',
    keys: ['alt+6'],
    idea: 50471,
    label: 'Focus dashboard widget 6',
    group: 'Navigation',
  },
  {
    id: 'focus-widget-7',
    keys: ['alt+7'],
    idea: 50471,
    label: 'Focus dashboard widget 7',
    group: 'Navigation',
  },
  {
    id: 'focus-widget-8',
    keys: ['alt+8'],
    idea: 50471,
    label: 'Focus dashboard widget 8',
    group: 'Navigation',
  },
  {
    id: 'focus-widget-9',
    keys: ['alt+9'],
    idea: 50471,
    label: 'Focus dashboard widget 9',
    group: 'Navigation',
  },
  {
    id: 'bulk-select',
    keys: ['x'],
    idea: 50472,
    label: 'Select focused card for bulk actions',
    group: 'Triage',
  },
  {
    id: 'bulk-range',
    keys: ['shift+x'],
    idea: 50472,
    label: 'Select contiguous range to focused card',
    group: 'Triage',
  },
  {
    id: 'undo-status',
    keys: ['u'],
    idea: 50473,
    label: 'Undo last finding-status change',
    group: 'Triage',
  },
  {
    id: 'duplicate-hunt',
    keys: ['ctrl+d'],
    idea: 50474,
    label: 'Duplicate current hunt as new draft',
    group: 'Actions',
  },
  {
    id: 'quick-menu',
    keys: ['.'],
    idea: 50475,
    label: 'Quick-action menu for focused finding',
    group: 'Actions',
  },
  {
    id: 'request-retest',
    keys: ['shift+r'],
    idea: 50476,
    label: 'Request retest on focused fixed finding',
    group: 'Actions',
  },
  {
    id: 'toggle-terminal',
    keys: ['l'],
    idea: 50477,
    label: 'Toggle live terminal panel',
    group: 'View',
  },
  {
    id: 'terminal-popout',
    keys: ['shift+l'],
    idea: 50477,
    label: 'Pop terminal into its own window',
    group: 'View',
  },
  {
    id: 'toggle-watch',
    keys: ['w'],
    idea: 50478,
    label: 'Watch / unwatch focused target or finding',
    group: 'Actions',
  },
  {
    id: 'toggle-zen',
    keys: ['z'],
    idea: 50479,
    label: 'Zen mode (hide all chrome but the hunt)',
    group: 'View',
  },
  {
    id: 'expand-all',
    keys: ['shift+e'],
    idea: 50480,
    label: 'Expand all findings',
    group: 'Navigation',
  },
  {
    id: 'collapse-all',
    keys: ['shift+c'],
    idea: 50480,
    label: 'Collapse all findings',
    group: 'Navigation',
  },
  {
    id: 'command-palette',
    keys: ['ctrl+k', 'cmd+k'],
    idea: 50469,
    label: 'Command palette (hunts, actions, settings, docs)',
    group: 'Navigation',
    existing: true,
    existingIn: 'FindingCards5.CommandPalette',
  },
  {
    id: 'settings-open',
    keys: ['ctrl+,'],
    idea: 50445,
    label: 'Open settings',
    group: 'Navigation',
  },
  { id: 'theme-cycle', keys: ['ctrl+.'], idea: 50445, label: 'Cycle theme menu', group: 'View' },
];

export const SEVERITY_KEYS = { 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' };

/* Key-event normalization --------------------------------------------------- */
/* Takes a plain {key, ctrlKey, metaKey, shiftKey, altKey} (no DOM needed) and */
/* returns a canonical combo string like "ctrl+shift+f", "shift+?", "g".     */

const SPECIAL_KEYS = {
  ' ': 'space',
  Spacebar: 'space',
  Escape: 'esc',
  Enter: 'enter',
  Tab: 'tab',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Backspace: 'backspace',
  Delete: 'delete',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  ',': ',',
  '.': '.',
  '/': '/',
  '[': '[',
  ']': ']',
  '?': '?',
  ';': ';',
  "'": "'",
  '-': '-',
  '=': '=',
};

export function normalizeKeyEvent(e) {
  const ctrl = !!(e.ctrlKey || e.metaKey); // Cmd counts as Ctrl on macOS
  const alt = !!e.altKey;
  let shift = !!e.shiftKey;
  let base;
  if (e.key && e.key.length === 1) {
    // Single chars: special names first (' ' → 'space'), then lowercase for
    // matching; keep shift as reported — Shift+R ('shift+r') and Shift+?
    // ('shift+?') are distinct bindings.
    base = SPECIAL_KEYS[e.key] || e.key.toLowerCase();
  } else {
    base = SPECIAL_KEYS[e.key] || String(e.key || '').toLowerCase();
  }
  const parts = [];
  if (ctrl) parts.push('ctrl');
  if (alt) parts.push('alt');
  if (shift) parts.push('shift');
  parts.push(base);
  return parts.join('+');
}

export function matchBinding(binding, keyEvent) {
  const combo = normalizeKeyEvent(keyEvent);
  if (combo === 'ctrl+k' && binding.keys.includes('cmd+k')) return true;
  return binding.keys.includes(combo);
}

/** True when the event target is a text-editing surface (skip single keys). */
export function isTypingTarget(el) {
  if (!el) return false;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;
  return !!el.isContentEditable;
}

/* G-prefix sequence tracker ------------------------------------------------- */

export class SequenceTracker {
  constructor(timeoutMs = 800) {
    this.timeoutMs = timeoutMs;
    this.prefix = null; // e.g. 'g'
    this.timer = null;
    this.sequences = SHORTCUTS.filter(s => s.sequence).map(s => ({
      id: s.id,
      parts: s.keys[0].split(' '), // ['g','h']
    }));
  }

  /** Feed a normalized combo; returns the matched shortcut id or null. */
  feed(combo) {
    this._clearTimer();
    if (!this.prefix) {
      if (combo === 'g') {
        this.prefix = 'g';
        this.timer = setTimeout(() => {
          this.prefix = null;
        }, this.timeoutMs);
        return { pending: true, id: null };
      }
      return { pending: false, id: null };
    }
    const full = `${this.prefix} ${combo}`;
    this.prefix = null;
    const hit = this.sequences.find(s => s.parts.join(' ') === full);
    return { pending: false, id: hit ? hit.id : null };
  }

  _clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  dispose() {
    this._clearTimer();
    this.prefix = null;
  }
}

/* Rotating tips bar (50441) ------------------------------------------------- */

export const TIPS = [
  'Press J / K to move through findings without touching the mouse.',
  'Shift+? opens a searchable cheat sheet of every shortcut.',
  'R marks a finding reviewed, F flags it false positive, S stars it.',
  'G then H jumps to Hunt, G then I to Infinity AI, G then M to Models.',
  'Space pauses or resumes the active hunt from anywhere.',
  'C copies the focused finding’s PoC as formatted markdown.',
  'U undoes your last finding-status change — no confirm dialogs.',
  'X selects a card for bulk actions; Shift+X selects a range.',
  'Ctrl+Shift+F focuses global search, pre-scoped to the current hunt.',
  'Z hides all chrome for a distraction-free hunt; Esc exits zen.',
  'Alt+1…9 jumps dashboard widget focus; Enter opens the widget.',
  'W watches a target so you’re notified when it changes.',
  'Ctrl+D duplicates the current hunt configuration as a new draft.',
  '. opens the quick-action menu for whatever finding is focused.',
];

/** Deterministic rotation: visit N shows tip N (modulo tip count). */
export function pickTip(visitCount) {
  return TIPS[((visitCount % TIPS.length) + TIPS.length) % TIPS.length];
}

const TIP_STATE_KEY = 'dm-tips';

export function getTipState(storage) {
  try {
    const raw = storage.getItem(TIP_STATE_KEY);
    if (!raw) return { visits: 0, dismissed: false, neverShow: false };
    const s = JSON.parse(raw);
    return { visits: Number(s.visits) || 0, dismissed: !!s.dismissed, neverShow: !!s.neverShow };
  } catch {
    return { visits: 0, dismissed: false, neverShow: false };
  }
}

export function setTipState(storage, state) {
  try {
    storage.setItem(TIP_STATE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

/* Verified-checkmark copy (50442) ------------------------------------------- */

export function verifiedCheckmarkText(by, at) {
  if (!by) return 'Not yet verified — open the finding to request a review.';
  let when = '';
  if (at) {
    const d = new Date(at);
    when = Number.isNaN(d.getTime())
      ? String(at)
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return `Verified by ${by}${when ? ` · ${when}` : ''}`;
}

/* Share-link explainer copy (50443) ----------------------------------------- */

export function shareLinkExplainer() {
  return {
    expiry:
      'Share links expire after 7 days by default. You can shorten or extend this when creating the link; expired links stop working immediately.',
    permissions:
      'Viewers get read-only access to this hunt’s findings. They can’t re-run scans, change scope, or see your API keys.',
    revoke:
      'Revoke a link any time from the share panel — access stops instantly, even before expiry.',
  };
}

/* Simulate-toggle clarification copy (50444) -------------------------------- */

export function simulateToggleCopy() {
  return {
    mock: 'Simulate ON: the hunt replays recorded traffic only — no packets leave this machine. Safe to demo.',
    real: 'Simulate OFF: the hunt runs live against the target. Standard scope rules apply.',
  };
}

/* Cheat-sheet search (50445) ------------------------------------------------- */

export function filterShortcuts(query) {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) return SHORTCUTS;
  return SHORTCUTS.filter(
    s =>
      s.label.toLowerCase().includes(q) ||
      s.keys.join(' ').toLowerCase().includes(q) ||
      s.group.toLowerCase().includes(q) ||
      keyDisplay(s.keys[0]).toLowerCase().includes(q)
  );
}

/** Human display for a canonical combo, e.g. "ctrl+shift+f" → "Ctrl+Shift+F". */
export function keyDisplay(combo, platform = 'pc') {
  const mod = platform === 'mac' ? '⌘' : 'Ctrl';
  const pretty = {
    space: 'Space',
    esc: 'Esc',
    enter: 'Enter',
    tab: 'Tab',
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    backspace: '⌫',
    delete: 'Del',
    home: 'Home',
    end: 'End',
    pageup: 'PgUp',
    pagedown: 'PgDn',
  };
  return combo
    .split('+')
    .map(p => {
      if (p === 'ctrl' || p === 'cmd') return mod;
      if (p === 'shift') return 'Shift';
      if (p === 'alt') return platform === 'mac' ? '⌥' : 'Alt';
      return pretty[p] || p.toUpperCase();
    })
    .join('+');
}

/* PoC markdown export (50455) ----------------------------------------------- */

export function markdownPoC(finding = {}) {
  const title = finding.title || 'Untitled finding';
  const sev = finding.severity ? `Severity: ${finding.severity}` : '';
  const conf = finding.confidence != null ? `Confidence: ${finding.confidence}%` : '';
  const host = finding.host ? `Host: ${finding.host}` : '';
  const meta = [sev, conf, host].filter(Boolean).join(' · ');
  const poc = finding.poc || finding.proofOfConcept || '_No PoC recorded for this finding._';
  return [`## ${title}`, '', meta, '', '### Proof of concept', '', poc, ''].join('\n');
}

/* Undo toast copy (50473) ---------------------------------------------------- */

export function undoToastText({ id, from, to }) {
  const short = String(id || 'finding').slice(0, 12);
  return `Undid status change on ${short}: ${from} → ${to}`;
}

/* Settings for the preference store ------------------------------------------ */

export const PREF_KEYS = {
  density: 'dm-density', // 'comfortable' | 'compact'
  view: 'dm-view', // 'list' | 'grid'
  muted: 'dm-muted', // '1' | '0'
  sidebar: 'dm-sidebar', // 'open' | 'collapsed'
};
