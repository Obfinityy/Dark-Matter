/**
 * loadingHooks.js — Forge wave 1, ideas 50005–50040 (hunt-UX loading behaviors).
 */
import { useEffect, useRef, useState } from 'react';

/**
 * 50026 — Delayed loading threshold: only report `true` if loading lasts
 * longer than `delay` ms, preventing flicker on fast loads.
 */
export function useDelayedLoading(isLoading, delay = 300) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShow(false);
      return undefined;
    }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [isLoading, delay]);
  return show;
}

/**
 * 50025 — Rotating loading copy: cycles through phase-tied messages like
 * "Fingerprinting server…" while `active` is true.
 */
export function useRotatingCopy(messages = [], intervalMs = 2200, active = true) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active || messages.length === 0) return undefined;
    setIndex(0);
    const t = setInterval(() => setIndex(i => (i + 1) % messages.length), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, messages.length]);
  return messages.length === 0 ? '' : messages[index % messages.length];
}

/**
 * 50013 — Reduced-motion flag: skeletons render as static gray blocks when
 * the user prefers reduced motion.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = e => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * 50017 — Favicon progress ring: draws the hunt completion percentage as a
 * tiny ring on the browser tab favicon. Pass null to restore the original.
 */
export function useFaviconProgress(percent) {
  const originalHref = useRef(null);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    if (originalHref.current === null) originalHref.current = link.href;
    if (percent === null || percent === undefined) {
      link.href = originalHref.current;
      return undefined;
    }
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const p = Math.max(0, Math.min(100, percent)) / 100;
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#232c42';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 8, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
    link.href = canvas.toDataURL('image/png');
    return undefined;
  }, [percent]);
}

/* ---- Wave 2 addition (idea 50059) ---- */

/**
 * 50059 — Skeleton timeout fallback: after `timeoutMs` of continuous loading,
 * report `timedOut = true` so the UI can replace endless spinners with a
 * "still loading — check connection" hint.
 */
export function useSkeletonTimeout(isLoading, timeoutMs = 15000) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return undefined;
    }
    const t = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [isLoading, timeoutMs]);
  return timedOut;
}

/* ---- Wave 2 addition (idea 50078) ---- */

/**
 * 50078 — Reload-persistent progress: snapshots progress state to localStorage
 * so reopening the page restores the exact last progress state instantly.
 * Returns [state, update(patch), clear()].
 */
export function usePersistentProgress(key, initial = {}) {
  const [state, setState] = useState(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch {
      return initial;
    }
  });
  const update = patch => {
    setState(prev => {
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in-memory state only */
      }
      return next;
    });
  };
  const clear = () => {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setState(initial);
  };
  return [state, update, clear];
}
