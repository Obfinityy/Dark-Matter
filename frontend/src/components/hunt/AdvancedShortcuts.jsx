/**
 * AdvancedShortcuts.jsx — Forge wave 13, ideas 50481–50499 (keyboard
 * shortcuts round 2; 50483 skipped — already live in wave-12 bindings).
 *
 * AdvancedShortcutsProvider: companion keydown layer for the wave-13 combos
 * (Home/End, PgUp/PgDn, F6, Ctrl+Shift+E/C, Alt+arrows, Shift+N, Ctrl+Enter
 * in [data-hunt-target]). It never stops Esc propagation — overlays consume
 * it through the shared useEscHierarchy ladder. Actions dispatch through the
 * same `darkmatter:shortcut` CustomEvent as the wave-12 provider.
 *
 * Components: EscHierarchyHandler, RemapDialog (50485), PrintableShortcutCard
 * (50484), AdaptiveHint (50486), TypingGuardIndicator (50487), F6RegionCycler
 * (50488), NumberedSuggestions (50492), PhasePipelineArrows (50495),
 * KeyboardTour (50496), ShortcutOnboarding (50499), NewShortcutHighlights
 * (50491), StartHuntTargetInput (50493).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { normalizeKeyEvent, isTypingTarget } from './shortcutsCore.js';
import {
  WAVE13_SHORTCUTS_IDEAS,
  ADVANCED_SHORTCUTS,
  NEW_WAVE13_SHORTCUTS,
  F6_REGIONS,
  resolveEscAction,
  findRemapConflicts,
  recordMouseUse,
  shouldShowHint,
  movePhaseIndex,
  pickSuggestion,
  buildDeepLink,
  findingPdfPayload,
  ONBOARDING_STEPS,
} from './advancedShortcutsCore.js';
import './AdvancedShortcuts.css';

/* Event + storage helpers -------------------------------------------------- */

function dispatchAction(actionId, detail = {}) {
  window.dispatchEvent(new CustomEvent('darkmatter:shortcut', {
    detail: { actionId, ...detail, source: 'advanced-shortcuts' },
  }));
}

function useRemapStorage() {
  const [remaps, setRemaps] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dm-shortcut-remaps-v1') || '{}'); }
    catch { return {}; }
  });
  const save = useCallback((next) => {
    setRemaps(next);
    try { localStorage.setItem('dm-shortcut-remaps-v1', JSON.stringify(next)); } catch { /* ignore */ }
  }, []);
  return [remaps, save];
}

/* AdvancedShortcutsProvider ------------------------------------------------ */

export function AdvancedShortcutsProvider({ actions = {}, onPdf, children }) {
  const [remaps] = useRemapStorage();
  const [typingGuard, setTypingGuard] = useState(false);
  const regionIdx = useRef(0);

  const comboFor = useCallback((id) => remaps[id] || null, [remaps]);

  useEffect(() => {
    const onKey = (e) => {
      const combo = normalizeKeyEvent(e);
      const typing = isTypingTarget(e.target);

      /* 50493 — Ctrl+Enter in the hunt target input starts the hunt. */
      if (typing) {
        setTypingGuard(true);
        if (combo === 'ctrl+enter' && e.target.closest?.('[data-hunt-target]')) {
          e.preventDefault();
          if (actions['hunt-start-target']) actions['hunt-start-target']({ target: e.target.value });
          else dispatchAction('hunt-start-target', { target: e.target.value });
        }
        return;
      }
      setTypingGuard(false);

      /* Esc is owned by the wave-12 ladder — never intercept here (50494). */
      if (combo === 'esc') return;

      const focusCards = () => [...document.querySelectorAll('[data-finding-card]')];
      const focused = () => document.activeElement?.closest?.('[data-finding-card]');

      const remapFor = (id, combos) => {
        const r = comboFor(id);
        return r ? combo === r : combos.includes(combo);
      };

      const handle = (id, fn) => { e.preventDefault(); e.stopPropagation(); fn(); return true; };

      /* 50481 — Home/End jump to first/last finding. */
      if (remapFor('finding-first', ['home'])) return handle('finding-first', () => {
        const cards = focusCards();
        if (cards.length) { cards[0].focus(); dispatchAction('finding-first', { count: cards.length }); }
      });
      if (remapFor('finding-last', ['end'])) return handle('finding-last', () => {
        const cards = focusCards();
        if (cards.length) { cards[cards.length - 1].focus(); dispatchAction('finding-last', { count: cards.length }); }
      });

      /* 50482 — PageUp/PageDown scroll the findings list by one viewport. */
      if (remapFor('list-page-up', ['pageup'])) return handle('list-page-up', () => {
        const list = document.querySelector('[data-findings-list]') || document.querySelector('[data-region="main"]');
        if (list) list.scrollBy({ top: -list.clientHeight, behavior: 'smooth' });
        dispatchAction('list-page-up');
      });
      if (remapFor('list-page-down', ['pagedown'])) return handle('list-page-down', () => {
        const list = document.querySelector('[data-findings-list]') || document.querySelector('[data-region="main"]');
        if (list) list.scrollBy({ top: list.clientHeight, behavior: 'smooth' });
        dispatchAction('list-page-down');
      });

      /* 50497 — Shift+N focuses the newest finding (first in reverse-chron). */
      if (remapFor('finding-newest', ['shift+n'])) return handle('finding-newest', () => {
        const cards = focusCards();
        const newest = cards[cards.length - 1];
        if (newest) { newest.focus(); dispatchAction('finding-newest', { id: newest.getAttribute('data-finding-id') }); }
      });

      /* 50488 — F6 cycles nav → main → sidebar → chat. */
      if (remapFor('region-cycle', ['f6'])) return handle('region-cycle', () => {
        for (let i = 0; i < F6_REGIONS.length; i += 1) {
          regionIdx.current = (regionIdx.current + 1) % F6_REGIONS.length;
          const el = document.querySelector(F6_REGIONS[regionIdx.current].selector);
          if (el) { (el.matches('[tabindex]') ? el : el.querySelector('[tabindex],a,button') || el).focus?.(); break; }
        }
        dispatchAction('region-cycle', { region: F6_REGIONS[regionIdx.current].id });
      });

      /* 50490 — Alt+arrows walk hunt history like browser back/forward. */
      if (remapFor('history-back', ['alt+arrowleft'])) return handle('history-back', () => {
        if (actions['history-back']) actions['history-back']();
        else window.history.back();
        dispatchAction('history-back');
      });
      if (remapFor('history-forward', ['alt+arrowright'])) return handle('history-forward', () => {
        if (actions['history-forward']) actions['history-forward']();
        else window.history.forward();
        dispatchAction('history-forward');
      });

      /* 50489 — Ctrl+Shift+E exports the focused finding as a PDF payload. */
      if (remapFor('finding-pdf', ['ctrl+shift+e'])) return handle('finding-pdf', () => {
        const card = focused();
        const id = card?.getAttribute('data-finding-id');
        const payload = findingPdfPayload({
          id, title: card?.getAttribute('data-finding-title') || id || 'Finding',
          severity: card?.getAttribute('data-finding-severity'),
        });
        if (onPdf) onPdf(payload); else dispatchAction('finding-pdf', { payload });
      });

      /* 50498 — Ctrl+Shift+C copies a deep link to the focused finding. */
      if (remapFor('finding-deep-link', ['ctrl+shift+c'])) return handle('finding-deep-link', () => {
        const card = focused();
        const id = card?.getAttribute('data-finding-id');
        if (!id) return;
        const link = buildDeepLink(id);
        if (link) {
          try { navigator.clipboard.writeText(link); dispatchAction('finding-deep-link', { id, link }); }
          catch { dispatchAction('finding-deep-link', { id, link }); }
        }
      });
      return undefined;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [actions, onPdf, comboFor]);

  return (
    <>
      <TypingGuardIndicator active={typingGuard} />
      {children}
    </>
  );
}

/* useEscHierarchy — 50494 -------------------------------------------------- */
/* A shared Esc ladder: menus → cards → search → blur. Overlays register     */
/* their layer; the hook resolves the highest-priority live layer.           */

export function useEscHierarchy({ onCloseMenu, onCollapseCard, onClearSearch, onBlurInput } = {}) {
  useEffect(() => {
    const onKey = (e) => {
      if (normalizeKeyEvent(e) !== 'esc') return;
      const state = {
        menuOpen: !!document.querySelector('[data-esc-layer="menu"]:not([hidden])'),
        cardOpen: !!document.querySelector('[data-finding-card][aria-expanded="true"]'),
        searchActive: !!document.querySelector('[data-global-search]:not([value=""]), [data-global-search][data-has-value]'),
        inputFocused: !!document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName),
      };
      const step = resolveEscAction(state);
      if (!step) return;
      if (step === 'close-menu') onCloseMenu?.();
      else if (step === 'collapse-card') onCollapseCard?.() ?? document.activeElement?.closest?.('[data-finding-card]')?.setAttribute('aria-expanded', 'false');
      else if (step === 'clear-search') onClearSearch?.();
      else if (step === 'blur-input') { onBlurInput?.(); document.activeElement?.blur?.(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCloseMenu, onCollapseCard, onClearSearch, onBlurInput]);
}

/** Tiny component that installs the Esc ladder for the subtree. */
export function EscHierarchyHandler(props) {
  useEscHierarchy(props);
  return null;
}

/* TypingGuardIndicator — 50487 ---------------------------------------------- */
/* Visible indicator that single-key shortcuts are paused while typing.       */

export function TypingGuardIndicator({ active }) {
  if (!active) return null;
  return (
    <div className="adv-typing-guard" role="status" aria-live="polite">
      <span aria-hidden="true">⌨️</span> Single-key shortcuts paused while typing — Ctrl/Alt combos still work.
    </div>
  );
}

/* F6RegionCycler — 50488 ---------------------------------------------------- */

export function F6RegionCycler() {
  const [region, setRegion] = useState('nav');
  const cycle = useCallback(() => {
    const i = F6_REGIONS.findIndex((r) => r.id === region);
    const next = F6_REGIONS[(i + 1) % F6_REGIONS.length];
    setRegion(next.id);
    const el = document.querySelector(next.selector);
    (el?.matches?.('[tabindex]') ? el : el?.querySelector?.('[tabindex],a,button') || el)?.focus?.();
  }, [region]);
  return (
    <button type="button" className="adv-f6" onClick={cycle} aria-label="Cycle focus region (F6)">
      Region: <strong>{F6_REGIONS.find((r) => r.id === region)?.label}</strong>
      <kbd>F6</kbd>
    </button>
  );
}

/* AdaptiveHint — 50486 ------------------------------------------------------- */

export function AdaptiveHint({ actionId, combo, children }) {
  const [count, setCount] = useState(0);
  const shown = useMemo(() => shouldShowHint(null, actionId), [count]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span
      className="adv-adaptive-hint"
      onClick={() => setCount(recordMouseUse(null, actionId))}
      title={shown ? `Tip: press ${combo} instead` : undefined}
    >
      {children}
      {shown && <kbd className="adv-adaptive-kbd">{combo}</kbd>}
    </span>
  );
}

/* RemapDialog — 50485 -------------------------------------------------------- */

export function RemapDialog({ open, onClose }) {
  const [remaps, saveRemaps] = useRemapStorage();
  const [capturing, setCapturing] = useState(null);
  const conflicts = useMemo(() => findRemapConflicts(remaps), [remaps]);

  useEscHierarchy({ onCloseMenu: onClose });

  useEffect(() => {
    if (!capturing || !open) return undefined;
    const onKey = (e) => {
      e.preventDefault(); e.stopPropagation();
      saveRemaps({ ...remaps, [capturing]: normalizeKeyEvent(e) });
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, open, remaps, saveRemaps]);

  if (!open) return null;
  const reset = () => saveRemaps({});
  return (
    <div className="adv-remap-backdrop" role="dialog" aria-modal="true" aria-label="Remap shortcuts" data-esc-layer="menu">
      <div className="adv-remap">
        <h2>Remap shortcuts</h2>
        {conflicts.length > 0 && (
          <div className="adv-remap-conflicts" role="alert">
            {conflicts.map((c) => (
              <p key={c.actionId}><span aria-hidden="true">⚠️</span> <code>{c.combo}</code> is already used by {c.conflictsWith.join(', ')}.</p>
            ))}
          </div>
        )}
        <ul className="adv-remap-list">
          {ADVANCED_SHORTCUTS.map((s) => (
            <li key={s.id}>
              <span>{s.label}</span>
              <button
                type="button"
                className="adv-remap-key"
                onClick={() => setCapturing(s.id)}
                aria-label={`Remap ${s.label}`}
              >
                {capturing === s.id ? 'Press keys…' : (remaps[s.id] || s.keys.join(' / ') || '—')}
              </button>
            </li>
          ))}
        </ul>
        <div className="adv-remap-foot">
          <button type="button" onClick={reset}>Reset to defaults</button>
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* PrintableShortcutCard — 50484 ---------------------------------------------- */

export function PrintableShortcutCard({ onResetDefaults }) {
  return (
    <div className="adv-print-card">
      <div className="adv-print-head">
        <h2>Keyboard shortcuts — Dark Matter</h2>
        <div className="adv-print-actions">
          <button type="button" onClick={() => window.print()}>Print</button>
          <button type="button" onClick={() => { try { localStorage.removeItem('dm-shortcut-remaps-v1'); } catch { /* ignore */ } onResetDefaults?.(); }}>Reset to defaults</button>
        </div>
      </div>
      <div className="adv-print-scroll">
        <table>
          <thead><tr><th scope="col">Action</th><th scope="col">Keys</th><th scope="col">Group</th></tr></thead>
          <tbody>
            {ADVANCED_SHORTCUTS.map((s) => (
              <tr key={s.id}><td>{s.label}</td><td><kbd>{s.keys.join(' + ') || '—'}</kbd></td><td>{s.group}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* NewShortcutHighlights — 50491 ---------------------------------------------- */
/* "What's new" panel listing the wave-13 additions. Pairs with the wave-12   */
/* Shift+? cheat sheet — render it inside the cheat-sheet overlay.             */

export function NewShortcutHighlights() {
  return (
    <section className="adv-new-highlights" aria-label="New shortcuts in this update">
      <h3><span aria-hidden="true">✨</span> New in this update</h3>
      <ul>
        {NEW_WAVE13_SHORTCUTS.map((s) => (
          <li key={s.id}><kbd>{s.keys.join(' + ')}</kbd> {s.label}</li>
        ))}
      </ul>
    </section>
  );
}

/* NumberedSuggestions — 50492 ------------------------------------------------ */

export function NumberedSuggestions({ suggestions = [], onPick }) {
  const [items] = useState(suggestions);
  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e.target)) return;
      const picked = pickSuggestion(items, e.key);
      if (picked) { e.preventDefault(); onPick?.(picked); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [items, onPick]);
  if (!items.length) return null;
  return (
    <div className="adv-numbered" role="listbox" aria-label="Chat suggestions">
      {items.slice(0, 5).map((s, i) => (
        <button key={i} type="button" role="option" aria-selected="false" onClick={() => onPick?.(s)}>
          <span className="adv-numbered-badge" aria-hidden="true">{i + 1}</span> {s}
        </button>
      ))}
    </div>
  );
}

/* StartHuntTargetInput — 50493 ------------------------------------------------ */

export function StartHuntTargetInput({ onStart }) {
  const [target, setTarget] = useState('');
  return (
    <form
      className="adv-hunt-target"
      onSubmit={(e) => { e.preventDefault(); if (target.trim()) onStart?.(target.trim()); }}
    >
      <label htmlFor="adv-hunt-target">Target</label>
      <input
        id="adv-hunt-target"
        data-hunt-target
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="example.com"
        autoComplete="off"
      />
      <button type="submit">Start hunt</button>
      <span className="adv-hint">or press <kbd>Ctrl+Enter</kbd> while typing</span>
    </form>
  );
}

/* PhasePipelineArrows — 50495 ------------------------------------------------- */

export function PhasePipelineArrows({ phases = [], index = 0, onSelect }) {
  const onKey = (e) => {
    const combo = normalizeKeyEvent(e);
    if (combo !== 'arrowleft' && combo !== 'arrowright' && combo !== 'enter') return;
    e.preventDefault();
    if (combo === 'enter') { onSelect?.(phases[index]); return; }
    onSelect?.(phases[movePhaseIndex(index, combo === 'arrowright' ? 1 : -1, phases.length)]);
  };
  return (
    <div
      className="adv-phases"
      role="listbox"
      aria-label="Hunt phases"
      tabIndex={0}
      onKeyDown={onKey}
    >
      {phases.map((p, i) => (
        <button
          key={p}
          type="button"
          role="option"
          aria-selected={i === index}
          tabIndex={i === index ? 0 : -1}
          className={i === index ? 'adv-phase-active' : ''}
          onClick={() => onSelect?.(phases[i])}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

/* KeyboardTour — 50496 -------------------------------------------------------- */

const TOUR_STEPS = [
  { title: 'Findings list', body: 'Every finding is a focusable card. Use Tab to enter the list.' },
  { title: 'Filters', body: 'Alt+number keys jump between filter widgets.' },
  { title: 'Timeline', body: 'Bracket keys scrub the hunt timeline; arrows walk it step by step.' },
  { title: 'Chat', body: 'Press T to focus chat, type, then Ctrl+Enter to send.' },
  { title: 'Cheat sheet', body: 'Press Shift+? any time to see every shortcut.' },
];

export function KeyboardTour({ onDone }) {
  const [step, setStep] = useState(0);
  const total = TOUR_STEPS.length;
  const go = useCallback((dir) => {
    const next = step + dir;
    if (next < 0) return;
    if (next >= total) { onDone?.(); return; }
    setStep(next);
  }, [step, total, onDone]);
  return (
    <div className="adv-tour" role="dialog" aria-modal="true" aria-label="Keyboard tour" data-esc-layer="menu">
      <p className="adv-tour-count" aria-live="polite">Step {step + 1} of {total}</p>
      <h2>{TOUR_STEPS[step].title}</h2>
      <p>{TOUR_STEPS[step].body}</p>
      <div className="adv-tour-foot">
        <button type="button" onClick={() => go(-1)} disabled={step === 0}>← Back</button>
        <button type="button" autoFocus onClick={() => go(1)}>{step === total - 1 ? 'Finish' : 'Next →'}</button>
      </div>
    </div>
  );
}

/* ShortcutOnboarding — 50499 -------------------------------------------------- */
/* Interactive trainer: listens for the REAL keypress of each step — the user */
/* performs the actual shortcut, nothing is simulated.                        */

export function ShortcutOnboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState([]);
  const current = ONBOARDING_STEPS[step];

  useEffect(() => {
    if (!current) return undefined;
    const onKey = (e) => {
      const want = current.combo;
      const got = normalizeKeyEvent(e);
      if (want === 'escape' ? got === 'esc' : got === want) {
        setDone((d) => [...d, current.n]);
        const next = step + 1;
        if (next >= ONBOARDING_STEPS.length) onComplete?.(done.concat(current.n));
        else setStep(next);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [current, step, onComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;
  return (
    <div className="adv-onboarding" role="dialog" aria-label="Keyboard onboarding" data-esc-layer="menu">
      <ol className="adv-onboarding-progress">
        {ONBOARDING_STEPS.map((s) => (
          <li key={s.n} className={done.includes(s.n) ? 'done' : s.n === current.n ? 'current' : ''} aria-label={`${s.label}: ${done.includes(s.n) ? 'done' : s.n === current.n ? 'current' : 'pending'}`} />
        ))}
      </ol>
      <h2>Learn the keyboard — step {current.n} of {ONBOARDING_STEPS.length}</h2>
      <p className="adv-onboarding-hint">{current.hint}</p>
      <p>Press <kbd>{current.combo === 'escape' ? 'Esc' : current.combo}</kbd> now — for real, no clicking.</p>
      <button type="button" onClick={() => { setStep(0); setDone([]); }}>Restart</button>
    </div>
  );
}

/* Registry export (for tests / docs) ---------------------------------------- */
export { WAVE13_SHORTCUTS_IDEAS };
