import { useEffect, useRef } from 'react';

// Shared modal accessibility behaviour (FIX #452): modals used to
// close ONLY via backdrop click — no Escape, no focus trap, no
// focus return — so keyboard users could tab out of the dialog
// into the page behind it and never find their way back.
//
// useFocusTrap(active, onEscape) returns a ref for the dialog
// element. While active it:
//   - moves focus into the dialog (first focusable element),
//   - traps Tab / Shift+Tab inside it,
//   - closes on Escape via onEscape,
//   - restores focus to whatever had it when the dialog opened.
// Call it unconditionally (before any early return) so hook order
// stays stable; pass the modal's open flag as `active`.
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function focusableIn(node) {
  return Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.disabled && el.offsetParent !== null,
  );
}

export function useFocusTrap(active, onEscape) {
  const ref = useRef(null);
  // onEscape identity changes every render (inline arrows from
  // parents) — keep the latest in a ref so the subscribed handler
  // never calls a stale closure.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = focusableIn(node)[0];
    if (first) first.focus();
    else {
      node.setAttribute('tabindex', '-1');
      node.focus();
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (onEscapeRef.current) onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusableIn(node);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
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
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [active]);

  return ref;
}
