/**
 * Kinetic.jsx — small kinetic-type React helpers.
 *
 * - usePrefersReducedMotion(): hook honoring the OS motion preference.
 * - Reveal: scroll-triggered reveal via IntersectionObserver (once).
 * - KineticHeading: headline with staggered word-by-word reveal.
 * - Marquee: pure-CSS scrolling accent strip (aria-safe duplicates).
 *
 * Original code written for the Dark Matter redesign (2026).
 */
import React from 'react';

/**
 * Returns true when the user prefers reduced motion.
 * Re-renders if the OS setting changes mid-session.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = e => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Reveal — wraps children and adds `ktx-visible` the first time the
 * element enters the viewport. Falls back to "visible" when
 * IntersectionObserver is unavailable.
 */
export function Reveal({ children, className = '', as = 'div', delay = 0, threshold = 0.15 }) {
  const ref = React.useRef(null);
  const [visible, setVisible] = React.useState(false);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduced, threshold]);

  const Tag = as;
  return (
    <Tag
      ref={ref}
      className={`ktx-reveal${visible ? ' ktx-visible' : ''}${className ? ` ${className}` : ''}`}
      style={delay ? { '--ktx-delay': `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * KineticHeading — headline that reveals word-by-word with a staggered
 * mask animation. `lines` is an array of { text, accent? } or plain
 * strings. When reduced motion is preferred, words render statically.
 */
export function KineticHeading({
  lines,
  as = 'h1',
  className = '',
  accentClass = 'ktx-accent',
  delayBase = 100,
  ...rest
}) {
  const [play, setPlay] = React.useState(false);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    if (reduced) {
      setPlay(true);
      return;
    }
    // start on the next frame so the animation class lands after paint
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPlay(true)));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const Tag = as;
  let wordIndex = 0;

  const renderLine = (line, lineIndex) => {
    const text = typeof line === 'string' ? line.text ?? line : line.text;
    const accent = typeof line === 'object' && line !== null ? !!line.accent : false;
    const words = String(text).split(/\s+/).filter(Boolean);
    const spans = [];
    words.forEach((word, wi) => {
      const idx = wordIndex++;
      spans.push(
        <span className="ktx-word" key={`${lineIndex}-${wi}`}>
          <span style={{ '--ktx-i': idx }} className={accent ? accentClass : undefined}>
            {word}
          </span>
        </span>,
      );
      if (wi < words.length - 1) {
        spans.push(<span className="ktx-word-sep" key={`sep-${lineIndex}-${wi}`} aria-hidden="true" />);
      }
    });
    return (
      <React.Fragment key={lineIndex}>
        {spans}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    );
  };

  return (
    <Tag
      className={`ktx-heading${play ? ' ktx-play' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--ktx-delay-base': `${delayBase}ms` }}
      {...rest}
    >
      {reduced
        ? lines.map((line, i) => (
            <React.Fragment key={i}>
              {typeof line === 'string' ? line : line.text}
              {i < lines.length - 1 && <br />}
            </React.Fragment>
          ))
        : lines.map(renderLine)}
    </Tag>
  );
}

/**
 * Marquee — horizontally scrolling accent strip. The item group is
 * rendered twice so the CSS loop is seamless; the visual copy is
 * aria-hidden and a screen-reader-only sentence carries the message.
 */
export function Marquee({ items, speed = 36, label, className = '' }) {
  const Group = ({ hidden }) => (
    <div className="ktx-marquee-group" aria-hidden={hidden ? 'true' : undefined}>
      {items.map((item, i) => (
        <span className="ktx-marquee-item" key={i}>
          <span className="ktx-dot" aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={`ktx-marquee${className ? ` ${className}` : ''}`}
      role="marquee"
      aria-label={label || items.join(' · ')}
    >
      {label && <span className="ktx-sr-only">{label}</span>}
      <div className="ktx-marquee-track" style={{ '--ktx-marquee-speed': `${speed}s` }}>
        <Group hidden />
        <Group hidden />
      </div>
    </div>
  );
}

export default KineticHeading;
