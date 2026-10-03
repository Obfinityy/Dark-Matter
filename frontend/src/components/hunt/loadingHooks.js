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
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), intervalMs);
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
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
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
