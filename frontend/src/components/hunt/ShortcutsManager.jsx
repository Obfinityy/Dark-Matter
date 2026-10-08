/**
 * ShortcutsManager.jsx — Forge wave 12, ideas 50441–50480 (keyboard shortcuts,
 * accessibility, onboarding; 37 new ideas; 50449/50464/50469 skipped — already
 * live in wave-6 FindingCards5).
 *
 * ShortcutsProvider: app-wide keyboard layer. Dispatches every action through
 * the `actions` prop callbacks AND a `darkmatter:shortcut` CustomEvent, so the
 * host app wires real behavior without prop drilling. Self-contained actions
 * (density, view, mute, sidebar, zen, terminal toggles) work out of the box
 * via data-attributes on <html> + localStorage.
 *
 * Cards the host renders should carry `data-finding-card` and
 * `data-finding-id` attributes for focus/triage/copy/watch actions to work;
 * everything degrades gracefully (toast) when nothing is focusable.
 */
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import {
  SHORTCUTS,
  SEVERITY_KEYS,
  WAVE12_IDEAS,
  TIPS,
  normalizeKeyEvent,
  matchBinding,
  isTypingTarget,
  SequenceTracker,
  pickTip,
  getTipState,
  setTipState,
  verifiedCheckmarkText,
  shareLinkExplainer,
  simulateToggleCopy,
  filterShortcuts,
  keyDisplay,
  markdownPoC,
  undoToastText,
  PREF_KEYS,
} from './shortcutsCore.js';
import './ShortcutsManager.css';

const ShortcutsContext = createContext(null);
export function useShortcuts() {
  return useContext(ShortcutsContext);
}

const storage = () => (typeof window !== 'undefined' ? window.localStorage : null);

function emitShortcut(action, payload = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('darkmatter:shortcut', { detail: { action, ...payload } }));
}

function readPref(key, fallback) {
  try {
    return storage()?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    storage()?.setItem(key, value);
  } catch {
    /* unavailable */
  }
}

const TABBABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * 50466 — logical tab order: removes positive tabindexes and ensures the main
 * landmarks expose a predictable focus sequence (header → filters → list →
 * detail). Safe to run on mount; never touches tabindex="-1".
 */
export function ensureLogicalTabOrder(root) {
  if (!root || !root.querySelectorAll) return 0;
  let fixed = 0;
  root.querySelectorAll('[tabindex]').forEach(el => {
    const t = Number(el.getAttribute('tabindex'));
    if (t > 0) {
      el.setAttribute('tabindex', '0');
      fixed += 1;
    }
  });
  return fixed;
}

/* ------------------------------------------------------------------ */
/* ShortcutsProvider — 50446/47/48/50/51/52/53/56/57/58/59/60/61/62/63 */
/* 50470/71/72/73/74/75/76/77/78/79/80                                */
/* ------------------------------------------------------------------ */

export function ShortcutsProvider({ actions = {}, children }) {
  const [toasts, setToasts] = useState([]);
  const [cheatOpen, setCheatOpen] = useState(false);
  const [quickMenu, setQuickMenu] = useState(null); // {findingId, x, y}
  const [exportOpen, setExportOpen] = useState(false);
  const [muted, setMuted] = useState(() => readPref(PREF_KEYS.muted, '0') === '1');
  const [zen, setZen] = useState(false);
  const undoStack = useRef([]); // 50473 — {id, from, to}
  const selection = useRef(new Set()); // 50472 — bulk selection ids
  const lastSelected = useRef(null);
  const tracker = useRef(new SequenceTracker());
  const overlayOpen = useRef(false); // cheat sheet / quick menu / export picker

  useEffect(() => {
    overlayOpen.current = cheatOpen || !!quickMenu || exportOpen;
  }, [cheatOpen, quickMenu, exportOpen]);
  useEffect(() => () => tracker.current.dispose(), []);

  const toast = useCallback((message, kind = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(t => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  /** 50473 — host apps record every status change so U can undo it. */
  const recordStatusChange = useCallback(({ id, from, to }) => {
    undoStack.current.push({ id, from, to });
    if (undoStack.current.length > 25) undoStack.current.shift();
  }, []);

  const dispatch = useCallback(
    (action, payload = {}) => {
      try {
        actions[action]?.(payload);
      } catch (err) {
        console.error(`[shortcuts] action "${action}" failed:`, err);
      }
      emitShortcut(action, payload);
    },
    [actions]
  );

  const focusedCard = useCallback(() => {
    const el = document.activeElement;
    return el && el.closest ? el.closest('[data-finding-card]') : null;
  }, []);
  const focusedFindingId = useCallback(
    () => focusedCard()?.getAttribute('data-finding-id') || null,
    [focusedCard]
  );

  const moveCardFocus = useCallback(
    dir => {
      const cards = [...document.querySelectorAll('[data-finding-card]')];
      if (!cards.length) {
        toast('No finding cards on this page');
        return;
      }
      const idx = cards.indexOf(document.activeElement?.closest?.('[data-finding-card]'));
      const next = cards[(idx + dir + cards.length) % cards.length];
      const target = next.matches('[tabindex]') ? next : next.querySelector(TABBABLE) || next;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: false });
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    [toast]
  );

  const copyPoC = useCallback(async () => {
    const id = focusedFindingId();
    if (!id) {
      toast('Focus a finding card first (J/K), then press C');
      return;
    }
    let finding = {
      id,
      title: focusedCard()?.getAttribute('data-finding-title') || `Finding ${id}`,
    };
    try {
      const detail = await actions['resolve-finding']?.({ id });
      if (detail) finding = { ...finding, ...detail };
    } catch {
      /* fall back to card metadata */
    }
    try {
      await navigator.clipboard.writeText(markdownPoC(finding));
      toast('PoC copied as markdown');
    } catch {
      toast('Clipboard blocked by the browser', 'error');
    }
    dispatch('copy-poc', { id });
  }, [focusedFindingId, focusedCard, actions, dispatch, toast]);

  const doAction = useCallback(
    (actionId, payload = {}) => {
      const id = focusedFindingId();
      switch (actionId) {
        case 'cheat-sheet':
          setCheatOpen(true);
          break;
        case 'focus-next':
          moveCardFocus(1);
          break;
        case 'focus-prev':
          moveCardFocus(-1);
          break;
        case 'card-toggle': {
          const card = focusedCard();
          if (card)
            card.setAttribute(
              'aria-expanded',
              card.getAttribute('aria-expanded') !== 'true' ? 'true' : 'false'
            );
          dispatch('card-toggle', { id });
          break;
        }
        case 'card-collapse': {
          const card = focusedCard();
          if (card) card.setAttribute('aria-expanded', 'false');
          dispatch('card-collapse', { id });
          break;
        }
        case 'triage-reviewed':
        case 'triage-false-positive':
        case 'triage-star':
          if (!id) {
            toast('Focus a finding card first (J/K)');
            break;
          }
          dispatch(actionId, { id });
          toast(
            `${actionId === 'triage-star' ? 'Starred' : actionId === 'triage-reviewed' ? 'Marked reviewed' : 'Flagged false positive'}: ${id}`
          );
          break;
        case 'toggle-pause': {
          const root = document.documentElement;
          const paused = root.getAttribute('data-hunt-paused') !== 'true';
          root.setAttribute('data-hunt-paused', String(paused));
          dispatch('toggle-pause', { paused });
          toast(paused ? 'Hunt paused' : 'Hunt resumed');
          break;
        }
        case 'filter-severity-critical':
        case 'filter-severity-high':
        case 'filter-severity-medium':
        case 'filter-severity-low': {
          const sev = actionId.replace('filter-severity-', '');
          dispatch('filter-severity', { severity: sev });
          toast(`Filtering: ${sev} severity`);
          break;
        }
        case 'phase-next':
        case 'phase-prev':
          dispatch(actionId, payload);
          break;
        case 'timeline-back':
        case 'timeline-forward':
          dispatch(actionId, payload);
          break;
        case 'copy-poc':
          copyPoC();
          break;
        case 'export-view':
          setExportOpen(true);
          break;
        case 'focus-chat': {
          const el = document.querySelector('[data-chat-input]');
          if (el) {
            el.focus();
          } else {
            toast('No chat input on this page');
          }
          dispatch('focus-chat', payload);
          break;
        }
        case 'chat-send':
          dispatch('chat-send', payload);
          break;
        case 'open-ask-agent': {
          const el = document.querySelector('[data-ask-agent]');
          if (el) {
            el.focus();
            el.click?.();
          } else dispatch('open-ask-agent', payload);
          break;
        }
        case 'toggle-density': {
          const next =
            readPref(PREF_KEYS.density, 'comfortable') === 'comfortable'
              ? 'compact'
              : 'comfortable';
          writePref(PREF_KEYS.density, next);
          document.documentElement.setAttribute('data-density', next);
          dispatch('toggle-density', { density: next });
          toast(`Density: ${next}`);
          break;
        }
        case 'toggle-view': {
          const next = readPref(PREF_KEYS.view, 'list') === 'list' ? 'grid' : 'list';
          writePref(PREF_KEYS.view, next);
          document.documentElement.setAttribute('data-view', next);
          dispatch('toggle-view', { view: next });
          toast(`View: ${next}`);
          break;
        }
        case 'open-finding':
          if (!id) {
            toast('Focus a finding card first (J/K)');
            break;
          }
          dispatch('open-finding', { id });
          if (!actions['open-finding'])
            window.location.hash = `#/findings/${encodeURIComponent(id)}`;
          break;
        case 'toggle-sidebar': {
          const next = readPref(PREF_KEYS.sidebar, 'open') === 'open' ? 'collapsed' : 'open';
          writePref(PREF_KEYS.sidebar, next);
          document.documentElement.setAttribute('data-sidebar', next);
          dispatch('toggle-sidebar', { sidebar: next });
          break;
        }
        case 'toggle-mute': {
          const next = !muted;
          setMuted(next);
          writePref(PREF_KEYS.muted, next ? '1' : '0');
          dispatch('toggle-mute', { muted: next });
          toast(next ? 'Notification sounds muted' : 'Notification sounds on');
          break;
        }
        case 'global-search': {
          const el = document.querySelector('[data-global-search]');
          if (el) {
            el.focus();
            if (payload.scope) el.setAttribute('data-search-scope', payload.scope);
          } else toast('No global search on this page');
          dispatch('global-search', payload);
          break;
        }
        case 'focus-widget-1':
        case 'focus-widget-2':
        case 'focus-widget-3':
        case 'focus-widget-4':
        case 'focus-widget-5':
        case 'focus-widget-6':
        case 'focus-widget-7':
        case 'focus-widget-8':
        case 'focus-widget-9': {
          const n = actionId.replace('focus-widget-', '');
          const el = document.querySelector(`[data-widget-index="${n}"]`);
          if (el) {
            el.focus();
          } else toast(`Widget ${n} not on this dashboard`);
          dispatch(actionId, { n });
          break;
        }
        case 'bulk-select':
        case 'bulk-range': {
          if (!id) {
            toast('Focus a finding card first (J/K)');
            break;
          }
          if (actionId === 'bulk-range' && lastSelected.current) {
            const cards = [...document.querySelectorAll('[data-finding-card]')];
            const a = cards.findIndex(
              c => c.getAttribute('data-finding-id') === lastSelected.current
            );
            const b = cards.findIndex(c => c.getAttribute('data-finding-id') === id);
            const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
            for (let i = lo; i <= hi; i += 1) {
              const fid = cards[i].getAttribute('data-finding-id');
              selection.current.add(fid);
              cards[i].setAttribute('aria-selected', 'true');
            }
            toast(`Selected ${hi - lo + 1} findings`);
          } else {
            if (selection.current.has(id)) {
              selection.current.delete(id);
              focusedCard()?.setAttribute('aria-selected', 'false');
            } else {
              selection.current.add(id);
              focusedCard()?.setAttribute('aria-selected', 'true');
            }
            toast(selection.current.has(id) ? `Selected ${id}` : `Deselected ${id}`);
          }
          lastSelected.current = id;
          dispatch(actionId, { id, selected: [...selection.current] });
          break;
        }
        case 'undo-status': {
          const last = undoStack.current.pop();
          if (!last) {
            toast('Nothing to undo');
            break;
          }
          dispatch('undo-status', { id: last.id, revertTo: last.from });
          toast(undoToastText(last));
          break;
        }
        case 'duplicate-hunt':
          dispatch('duplicate-hunt', payload);
          toast('Duplicating hunt as a new draft…');
          break;
        case 'quick-menu':
          if (!id) {
            toast('Focus a finding card first (J/K)');
            break;
          }
          setQuickMenu({ findingId: id });
          dispatch('quick-menu', { id });
          break;
        case 'request-retest':
          if (!id) {
            toast('Focus a finding card first (J/K)');
            break;
          }
          dispatch('request-retest', { id });
          toast(`Retest requested for ${id}`);
          break;
        case 'toggle-terminal': {
          const root = document.documentElement;
          const open = root.getAttribute('data-terminal') !== 'open';
          root.setAttribute('data-terminal', open ? 'open' : 'closed');
          dispatch('toggle-terminal', { open });
          break;
        }
        case 'terminal-popout':
          dispatch('terminal-popout', payload);
          toast('Terminal popped out');
          break;
        case 'toggle-watch':
          if (!id) {
            toast('Focus a finding card first (J/K)');
            break;
          }
          dispatch('toggle-watch', { id });
          toast(`Watch toggled for ${id}`);
          break;
        case 'toggle-zen': {
          const next = !zen;
          setZen(next);
          document.documentElement.setAttribute('data-zen', next ? '1' : '0');
          dispatch('toggle-zen', { zen: next });
          toast(next ? 'Zen mode on — Esc exits' : 'Zen mode off');
          break;
        }
        case 'expand-all':
        case 'collapse-all': {
          document
            .querySelectorAll('[data-finding-card]')
            .forEach(c =>
              c.setAttribute('aria-expanded', actionId === 'expand-all' ? 'true' : 'false')
            );
          dispatch(actionId, payload);
          toast(actionId === 'expand-all' ? 'All findings expanded' : 'All findings collapsed');
          break;
        }
        case 'settings-open':
          if (!actions['settings-open']) window.location.hash = '#/settings';
          dispatch('settings-open', payload);
          break;
        case 'theme-cycle':
          dispatch('theme-cycle', payload);
          toast('Theme menu cycled');
          break;
        default:
          dispatch(actionId, payload);
      }
    },
    [actions, dispatch, toast, muted, zen, focusedCard, focusedFindingId, moveCardFocus, copyPoC]
  );

  /* Global keydown listener (capture phase) -------------------------------- */
  /* Capture runs before wave-6 FindingCards5's bubble-phase listeners, so    */
  /* claimed keys (e.g. Shift+?) stopPropagation and never double-fire. Esc   */
  /* is never stopped — other overlays still get to close themselves.         */
  useEffect(() => {
    const foreignDialogOpen = () =>
      [...document.querySelectorAll('[role="dialog"]')].some(
        d => !d.closest('.sc-focus-trap') && d.getClientRects().length > 0
      );

    const onKey = e => {
      const combo = normalizeKeyEvent(e);
      const typing = isTypingTarget(e.target);

      if (typing) {
        // Ctrl+Enter sends chat even while typing (50457)
        if (combo === 'ctrl+enter' && e.target.closest?.('[data-chat-input]')) {
          e.preventDefault();
          doAction('chat-send');
        }
        return;
      }
      // Esc: close my overlays first, else collapse card (50447). Never
      // stopped — FC5 and other overlays still receive it.
      if (combo === 'esc') {
        if (cheatOpen) {
          setCheatOpen(false);
          return;
        }
        if (quickMenu) {
          setQuickMenu(null);
          return;
        }
        if (exportOpen) {
          setExportOpen(false);
          return;
        }
        if (zen) {
          doAction('toggle-zen');
          return;
        }
        doAction('card-collapse');
        return;
      }
      if (overlayOpen.current || foreignDialogOpen()) return;

      // G-prefix sequences (50450)
      if (combo === 'g' || tracker.current.prefix) {
        const res = tracker.current.feed(combo);
        if (res.pending) {
          e.preventDefault();
          e.stopPropagation();
          toast('G… press H, I or M');
          return;
        }
        if (res.id) {
          e.preventDefault();
          e.stopPropagation();
          doAction(res.id);
          return;
        }
        // fall through: a non-matching second key is treated as a normal key
      }

      const binding = SHORTCUTS.find(
        s => !s.existing && !s.sequence && !s.inInput && matchBinding(s, e)
      );
      if (!binding) return;
      // Single-key shortcuts must not hijack modified combos they don't own.
      if ((e.ctrlKey || e.metaKey || e.altKey) && !/^(ctrl|alt)\+/.test(combo)) return;
      // Ctrl+D would bookmark the page — claim it (50474)
      if (['ctrl+d', 'ctrl+shift+f', 'ctrl+,', 'ctrl+.'].includes(combo)) e.preventDefault();
      if (combo === 'space') e.preventDefault(); // stop page scroll (50451)
      e.stopPropagation(); // capture phase: wave-6's bubble handlers won't double-fire
      doAction(binding.id);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [doAction, cheatOpen, quickMenu, exportOpen, zen, toast]);

  /* Apply persisted prefs on mount */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-density', readPref(PREF_KEYS.density, 'comfortable'));
    root.setAttribute('data-view', readPref(PREF_KEYS.view, 'list'));
    root.setAttribute('data-sidebar', readPref(PREF_KEYS.sidebar, 'open'));
    ensureLogicalTabOrder(document.body); // 50466
  }, []);

  const ctx = {
    dispatch: doAction,
    toast,
    recordStatusChange,
    openCheatSheet: () => setCheatOpen(true),
    muted,
    zen,
    selection: selection.current,
  };

  return (
    <ShortcutsContext.Provider value={ctx}>
      {children}
      <ShortcutCheatSheet open={cheatOpen} onClose={() => setCheatOpen(false)} />
      {quickMenu && (
        <QuickActionMenu
          findingId={quickMenu.findingId}
          onAction={a => {
            setQuickMenu(null);
            doAction(a);
          }}
          onClose={() => setQuickMenu(null)}
        />
      )}
      {exportOpen && (
        <ExportViewPicker
          onExport={format => {
            setExportOpen(false);
            dispatch('export-view-confirmed', { format });
            toast(`Exporting view as ${format.toUpperCase()}…`);
          }}
          onClose={() => setExportOpen(false)}
        />
      )}
      <ToastStack items={toasts} />
    </ShortcutsContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* RotatingTipsBar — 50441                                             */
/* ------------------------------------------------------------------ */

export function RotatingTipsBar() {
  const [state, setState] = useState(() => getTipState(storage()));
  useEffect(() => {
    if (state.neverShow) return;
    const next = { ...state, visits: state.visits + 1 };
    setTipState(storage(), next);
    setState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (state.neverShow || state.dismissed) return null;
  const tip = pickTip(state.visits);
  const dismiss = never => {
    const next = { ...state, dismissed: true, neverShow: never || state.neverShow };
    setTipState(storage(), next);
    setState(next);
  };
  const nextTip = () => {
    const next = { ...state, visits: state.visits + 1, dismissed: false };
    setTipState(storage(), next);
    setState(next);
  };
  return (
    <div className="sc-tips" role="note" aria-label="Power-user tip">
      <span className="sc-tips-bulb" aria-hidden="true">
        💡
      </span>
      <p className="sc-tips-text">
        <strong>Tip:</strong> {tip}
      </p>
      <button type="button" className="sc-tips-cheat" onClick={nextTip}>
        Next tip
      </button>
      <button
        type="button"
        className="sc-tips-dismiss"
        onClick={() => dismiss(false)}
        aria-label="Dismiss tip"
      >
        ✕
      </button>
      <button type="button" className="sc-tips-never" onClick={() => dismiss(true)}>
        Don't show tips
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VerifiedCheckmark — 50442 · ShareLinkExplainer — 50443              */
/* SimulateToggleTip — 50444                                          */
/* ------------------------------------------------------------------ */

export function VerifiedCheckmark({ by, at, size = 16 }) {
  const text = verifiedCheckmarkText(by, at);
  return (
    <span
      className="sc-verified"
      title={text}
      aria-label={text}
      role="img"
      style={{ fontSize: size }}
    >
      {by ? '✅' : '⬜'}
    </span>
  );
}

export function ShareLinkExplainer() {
  const copy = shareLinkExplainer();
  return (
    <details className="sc-share-explainer">
      <summary>How do share links work?</summary>
      <dl>
        <div>
          <dt>Expiry</dt>
          <dd>{copy.expiry}</dd>
        </div>
        <div>
          <dt>Permissions</dt>
          <dd>{copy.permissions}</dd>
        </div>
        <div>
          <dt>Revoke</dt>
          <dd>{copy.revoke}</dd>
        </div>
      </dl>
    </details>
  );
}

export function SimulateToggleTip({ simulate }) {
  const copy = simulateToggleCopy();
  const text = simulate ? copy.mock : copy.real;
  return (
    <span className="sc-sim-tip" title={text} aria-label={text} role="note">
      ⓘ{' '}
      <span className="sc-sim-tip-mode">
        {simulate ? 'Simulate ON — recorded traffic only' : 'Live run — standard scope rules'}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ShortcutCheatSheet — 50445 (Shift+?, searchable, printable)         */
/* ------------------------------------------------------------------ */

export function ShortcutCheatSheet({ open, onClose }) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);
  if (!open) return null;
  const results = filterShortcuts(query);
  const groups = {};
  results.forEach(s => {
    (groups[s.group] = groups[s.group] || []).push(s);
  });
  return (
    <FocusTrap onClose={onClose} label="Keyboard shortcut cheat sheet">
      <div
        className="sc-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcut cheat sheet"
      >
        <div className="sc-sheet-head">
          <h2>Keyboard shortcuts</h2>
          <div className="sc-sheet-tools">
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search shortcuts…"
              aria-label="Search shortcuts"
              autoFocus
            />
            <button type="button" onClick={() => window.print()}>
              🖨 Print
            </button>
            <button type="button" onClick={onClose} aria-label="Close cheat sheet">
              ✕
            </button>
          </div>
        </div>
        <div className="sc-sheet-body">
          {Object.entries(groups).map(([group, items]) => (
            <section key={group} className="sc-sheet-group">
              <h3>{group}</h3>
              <dl>
                {items.map(s => (
                  <div key={s.id} className="sc-sheet-row">
                    <dt>
                      {s.keys.map(k => (
                        <kbd key={k}>{keyDisplay(k)}</kbd>
                      ))}
                      {s.existing && (
                        <span
                          className="sc-sheet-existing"
                          title={`Implemented in ${s.existingIn}`}
                        >
                          in app
                        </span>
                      )}
                    </dt>
                    <dd>{s.label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {results.length === 0 && <p className="sc-sheet-empty">No shortcuts match “{query}”.</p>}
        </div>
        <p className="sc-sheet-foot">
          G-prefix sequences: press G, then the second key within a second. Esc closes any overlay.
        </p>
      </div>
    </FocusTrap>
  );
}

/* ------------------------------------------------------------------ */
/* FocusTrap — 50468                                                   */
/* ------------------------------------------------------------------ */

export function FocusTrap({ children, onClose, label = 'Dialog' }) {
  const ref = useRef(null);
  const prevFocus = useRef(null);
  useEffect(() => {
    prevFocus.current = document.activeElement;
    const node = ref.current;
    const first = node?.querySelector(TABBABLE);
    (first || node)?.focus?.();
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(TABBABLE)].filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prevFocus.current?.focus?.(); // return focus to the trigger (50468)
    };
  }, [onClose]);
  return (
    <div ref={ref} className="sc-focus-trap" aria-label={label} tabIndex={-1}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SkipLinks — 50467                                                   */
/* ------------------------------------------------------------------ */

export function SkipLinks({ links }) {
  const items = links?.length
    ? links
    : [
        { href: '#findings', label: 'Skip to findings' },
        { href: '#timeline', label: 'Skip to timeline' },
        { href: '#chat', label: 'Skip to chat' },
      ];
  return (
    <nav className="sc-skip-links" aria-label="Skip links">
      {items.map(l => (
        <a key={l.href} href={l.href} className="sc-skip-link">
          {l.label}
        </a>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* TimelineKeyNav — 50465 arrow-key walk + 50454 [ ] scrub              */
/* ------------------------------------------------------------------ */

export function TimelineKeyNav({
  events = [],
  activeIndex = 0,
  onActivate,
  label = 'Hunt timeline',
}) {
  const listRef = useRef(null);
  const onKey = e => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
      next = Math.min(activeIndex + 1, events.length - 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(activeIndex - 1, 0);
    else if (e.key === ']')
      next = Math.min(activeIndex + 1, events.length - 1); // 50454
    else if (e.key === '[')
      next = Math.max(activeIndex - 1, 0); // 50454
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = events.length - 1;
    if (next !== null && next !== activeIndex) {
      e.preventDefault();
      onActivate?.(next, events[next]);
      listRef.current?.querySelectorAll('[data-timeline-event]')?.[next]?.focus();
    }
  };
  return (
    <div
      className="sc-timeline-nav"
      role="listbox"
      aria-label={label}
      aria-activedescendant={events[activeIndex]?.id}
      tabIndex={0}
      onKeyDown={onKey}
      ref={listRef}
      data-timeline
    >
      {events.map((ev, i) => (
        <button
          key={ev.id || i}
          id={ev.id}
          data-timeline-event
          role="option"
          aria-selected={i === activeIndex}
          tabIndex={i === activeIndex ? 0 : -1}
          className={`sc-timeline-event${i === activeIndex ? ' is-active' : ''}`}
          onClick={() => onActivate?.(i, ev)}
        >
          <span className="sc-timeline-dot" aria-hidden="true" />
          <span className="sc-timeline-label">{ev.label || `Event ${i + 1}`}</span>
          {ev.time && <time className="sc-timeline-time">{ev.time}</time>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* QuickActionMenu — 50475 ("." quick menu)                            */
/* ------------------------------------------------------------------ */

export function QuickActionMenu({ findingId, onAction, onClose }) {
  const items = [
    { id: 'triage-reviewed', label: 'Mark reviewed', key: 'R' },
    { id: 'triage-false-positive', label: 'Flag false positive', key: 'F' },
    { id: 'triage-star', label: 'Star finding', key: 'S' },
    { id: 'copy-poc', label: 'Copy PoC as markdown', key: 'C' },
    { id: 'request-retest', label: 'Request retest', key: '⇧R' },
    { id: 'toggle-watch', label: 'Watch / unwatch', key: 'W' },
    { id: 'open-finding', label: 'Open full page', key: 'O' },
  ];
  return (
    <FocusTrap onClose={onClose} label={`Quick actions for ${findingId}`}>
      <div
        className="sc-quickmenu"
        role="menu"
        aria-label={`Quick actions for finding ${findingId}`}
      >
        {items.map(it => (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            className="sc-quickmenu-item"
            onClick={() => onAction?.(it.id)}
          >
            <span>{it.label}</span>
            <kbd>{it.key}</kbd>
          </button>
        ))}
      </div>
    </FocusTrap>
  );
}

/* ------------------------------------------------------------------ */
/* ExportViewPicker — 50456 (E exports view with format picker)        */
/* ------------------------------------------------------------------ */

export function ExportViewPicker({ onExport, onClose }) {
  const [format, setFormat] = useState('json');
  return (
    <FocusTrap onClose={onClose} label="Export current view">
      <div className="sc-export" role="dialog" aria-modal="true" aria-label="Export current view">
        <h2>Export current view</h2>
        <p>Exports the findings currently visible with your active filters.</p>
        <div className="sc-export-formats" role="radiogroup" aria-label="Export format">
          {['json', 'csv', 'markdown'].map(f => (
            <label key={f} className={`sc-export-opt${format === f ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="export-format"
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
              />
              {f.toUpperCase()}
            </label>
          ))}
        </div>
        <div className="sc-export-actions">
          <button type="button" className="sc-btn-primary" onClick={() => onExport?.(format)}>
            Export
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </FocusTrap>
  );
}

/* ------------------------------------------------------------------ */
/* ToastStack — 50473 undo confirmation                                */
/* ------------------------------------------------------------------ */

export function ToastStack({ items = [] }) {
  return (
    <div className="sc-toasts" aria-live="polite" aria-atomic="false">
      {items.map(t => (
        <div key={t.id} className={`sc-toast sc-toast-${t.kind}`} role="status">
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* Re-export core helpers the host app may need directly */
export {
  SHORTCUTS,
  SEVERITY_KEYS,
  WAVE12_IDEAS,
  TIPS,
  normalizeKeyEvent,
  matchBinding,
  isTypingTarget,
  SequenceTracker,
  pickTip,
  getTipState,
  setTipState,
  verifiedCheckmarkText,
  shareLinkExplainer,
  simulateToggleCopy,
  filterShortcuts,
  keyDisplay,
  markdownPoC,
  undoToastText,
  PREF_KEYS,
};
