/**
 * ResponsiveRound2.jsx — Infinity AI · Forge wave 17 (ideas 50641–50659).
 *
 * Second responsive round: long-press menus, responsive thumbnails, print
 * overrides, orientation-safe scroll, notch safe areas, hybrid tablet UI,
 * collapsed mobile sections, OS text-size respect, Save-Data degradation,
 * short mobile empty states, swipeable phase carousel, mobile tab badge,
 * bottom-sheet modals, large touch sliders, full-bleed tablet graph,
 * desktop-site toggle, responsive focus order, container-query widgets,
 * tested-width note, plus the ResponsiveRound2Gallery showcase.
 *
 * Wave 16 (ResponsiveSuite.jsx) shipped the first mobile/touch round; these
 * components are the genuinely new remainder — each registry note calls out
 * the exact relationship so nothing is duplicated.
 *
 * Pure math lives in responsiveRound2Core.js; styling in ResponsiveRound2.css.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  isMobileWidth,
  isTabletWidth,
  viewportKind,
  orientationOf,
  LONG_PRESS_MS,
  longPressReady,
  longPressMoved,
  hasCoarsePointer,
  hasFineHover,
  hybridUiMode,
  saveDataEnabled,
  effectiveConnectionType,
  degradeTier,
  degradeClassForTier,
  carouselPageCount,
  clampCarouselIndex,
  carouselOffsetPct,
  carouselIndexAfterSwipe,
  scrollGeometryKey,
  makeScrollPreserver,
  makeDesktopSiteStore,
  FORCE_DESKTOP_CLASS,
  shouldForceDesktop,
  sliderValueAt,
  sliderRatioFor,
  LARGE_SLIDER_THUMB_PX,
  containerQueriesSupported,
  widgetColumnsFallback,
  focusOrderForViewport,
  clampRootFontSize,
  ROOT_FONT_DEFAULT_PX,
  ROOT_FONT_MIN_PX,
  ROOT_FONT_MAX_PX,
  testedWidthLabel,
} from './responsiveRound2Core.js';
import './ResponsiveRound2.css';

function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

/* ------------------------------------------------------------------ */
/* LongPressMenu (50641)                                               */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  { id: 'review', label: 'Mark reviewed' },
  { id: 'snooze', label: 'Snooze 24h' },
  { id: 'copy', label: 'Copy finding ID' },
];

export function LongPressMenu({ findingId = 'DM-4821', title = 'Reflected XSS in search param' }) {
  const [menu, setMenu] = useState(null); // { x, y } in card-local coords
  const [lastAction, setLastAction] = useState('');
  const timer = useRef(null);
  const start = useRef(null);
  const cardRef = useRef(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  const openAt = (clientX, clientY) => {
    const rect = cardRef.current ? cardRef.current.getBoundingClientRect() : { left: 0, top: 0 };
    setMenu({ x: clientX - rect.left, y: clientY - rect.top });
  };

  const onPointerDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    timer.current = setTimeout(() => {
      if (!start.current) return;
      if (longPressReady(Date.now() - start.current.t)) openAt(start.current.x, start.current.y);
      start.current = null;
    }, LONG_PRESS_MS);
  };

  const onPointerMove = e => {
    if (!start.current) return;
    if (longPressMoved(e.clientX - start.current.x, e.clientY - start.current.y)) cancel();
  };

  const onContextMenu = e => {
    e.preventDefault(); // keyboard (Shift+F10 / menu key) and right-click both land here
    cancel();
    openAt(e.clientX || 40, e.clientY || 40);
  };

  const choose = action => {
    setLastAction(action.id === 'copy' ? `Copied ${findingId}` : `${action.label} — ${findingId}`);
    setMenu(null);
    if (cardRef.current) cardRef.current.focus();
  };

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') setMenu(null);
    };
    const onDown = e => {
      if (cardRef.current && !cardRef.current.contains(e.target)) setMenu(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [menu]);

  return (
    <div
      ref={cardRef}
      className="r2-longpress-card"
      tabIndex={0}
      role="button"
      aria-haspopup="menu"
      aria-label={`${title}. Press and hold for quick actions.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onContextMenu={onContextMenu}
    >
      <div className="r2-longpress-top">
        <span className="r2-sev">high</span>
        <span className="r2-fid">{findingId}</span>
      </div>
      <p className="r2-longpress-title">{title}</p>
      <p className="r2-hint">Press and hold ({LONG_PRESS_MS}ms) for the quick menu</p>
      {menu && (
        <div
          className="r2-quickmenu"
          role="menu"
          style={{ left: Math.min(menu.x, 120), top: menu.y + 8 }}
        >
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.id}
              type="button"
              role="menuitem"
              className="r2-quickmenu-item"
              onClick={() => choose(a)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      {lastAction && (
        <p className="r2-note" role="status">
          {lastAction}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ResponsiveThumbnail (50642)                                         */
/* ------------------------------------------------------------------ */

export function ResponsiveThumbnail({ sources, alt, aspect = '16 / 9' }) {
  const srcSet = sources.map(s => `${s.src} ${s.w}w`).join(', ');
  const fallback = sources.length ? sources[Math.min(1, sources.length - 1)].src : '';
  return (
    <img
      className="r2-thumb"
      style={{ aspectRatio: aspect }}
      src={fallback}
      srcSet={srcSet}
      sizes="(max-width: 640px) 100vw, 480px"
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );
}

function svgThumb(w, h, bg, label) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="${bg}"/>` +
    `<text x="${w / 2}" y="${h / 2}" font-size="${Math.round(h / 5)}" text-anchor="middle" fill="#ffffff" font-family="sans-serif">${label} ${w}w</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function ResponsiveThumbnailDemo() {
  const sources = useMemo(
    () => [
      { src: svgThumb(320, 180, '#6d28d9', 'Evidence'), w: 320 },
      { src: svgThumb(640, 360, '#7c3aed', 'Evidence'), w: 640 },
      { src: svgThumb(960, 540, '#8b5cf6', 'Evidence'), w: 960 },
    ],
    []
  );
  return (
    <div className="r2-thumb-demo">
      <ResponsiveThumbnail sources={sources} alt="Evidence screenshot, responsive thumbnail" />
      <p className="r2-note">
        One <code>img</code> with <code>srcset</code>/<code>sizes</code> +{' '}
        <code>loading="lazy"</code> — the browser picks 320/640/960w. Resize the window and watch
        the network panel.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PrintLayoutOverride (50643)                                         */
/* ------------------------------------------------------------------ */

export function PrintLayoutOverride() {
  const print = () => {
    if (typeof window !== 'undefined') window.print();
  };
  return (
    <div className="r2-print-wrap">
      <div className="r2-no-print r2-print-toolbar">
        <p className="r2-note r2-note-tight">
          Screen view — chrome, actions and shadows. Hit print to see the override.
        </p>
        <button type="button" className="r2-btn" onClick={print}>
          Print report
        </button>
      </div>
      <article className="r2-print-report">
        <header className="r2-print-head">
          <p className="r2-print-kicker">Dark Matter · Obfinity</p>
          <h4>Hunt #4821 — Executive report</h4>
          <p className="r2-print-meta">
            target.test · 3 findings · printed {new Date().toLocaleDateString()}
          </p>
        </header>
        <section className="r2-print-finding">
          <h5>
            DM-4821 — Reflected XSS in search param <span className="r2-sev">high</span>
          </h5>
          <p>
            Unescaped reflection of the <code>q</code> parameter in <code>/search</code>. Fix:
            context-aware output encoding.
          </p>
        </section>
        <section className="r2-print-finding">
          <h5>
            DM-4819 — Open redirect on login <span className="r2-sev">medium</span>
          </h5>
          <p>
            <code>next</code> parameter accepts arbitrary hosts. Fix: allow-list redirect targets.
          </p>
        </section>
        <footer className="r2-print-foot">
          Page <span className="r2-page-num" /> — generated by Dark Matter
        </footer>
      </article>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OrientationSafeScroller (50644)                                     */
/* ------------------------------------------------------------------ */

const SCROLL_CARDS = [
  { id: 'a', title: 'Recon sweep', body: '42 subdomains enumerated, 11 live hosts fingerprinted.' },
  {
    id: 'b',
    title: 'Vuln scan',
    body: '3 findings: 1 high, 1 medium, 1 low. PoCs generated for all.',
  },
  {
    id: 'c',
    title: 'Report draft',
    body: 'Executive summary + remediation table ready for review.',
  },
];

export function OrientationSafeScroller() {
  const preserver = useRef(null);
  if (!preserver.current) preserver.current = makeScrollPreserver();
  const [open, setOpen] = useState(['a']);
  const [events, setEvents] = useState([]);
  const openRef = useRef(open);
  openRef.current = open;
  const geomRef = useRef(
    typeof window !== 'undefined' ? scrollGeometryKey(window.innerWidth, window.innerHeight) : ''
  );

  useEffect(() => {
    const onResize = () => {
      const key = scrollGeometryKey(window.innerWidth, window.innerHeight);
      if (key.split(':')[1] !== geomRef.current.split(':')[1]) {
        // Orientation actually changed — capture scroll + open cards, restore after layout settles.
        const snap = preserver.current.capture(openRef.current);
        setEvents(e =>
          [
            `Captured scrollY=${Math.round(snap.y)} + open cards [${snap.openCardIds.join(', ')}]`,
            ...e,
          ].slice(0, 4)
        );
        setTimeout(() => {
          const restored = preserver.current.restore();
          if (restored) {
            setOpen(restored.openCardIds);
            setEvents(e =>
              [
                `Restored scrollY=${Math.round(restored.y)} + reopened [${restored.openCardIds.join(', ')}]`,
                ...e,
              ].slice(0, 4)
            );
          }
        }, 350);
      }
      geomRef.current = key;
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const toggle = id => setOpen(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]));

  return (
    <div className="r2-orient">
      <p className="r2-note">
        Rotate the device (or resize across the portrait/landscape boundary) — scroll position and
        open cards survive.
      </p>
      {SCROLL_CARDS.map(c => (
        <div key={c.id} className="r2-orient-card">
          <button
            type="button"
            className="r2-orient-head"
            onClick={() => toggle(c.id)}
            aria-expanded={open.includes(c.id)}
          >
            {c.title}
            <span aria-hidden="true">{open.includes(c.id) ? '▾' : '▸'}</span>
          </button>
          {open.includes(c.id) && <p className="r2-orient-body">{c.body}</p>}
        </div>
      ))}
      {events.length > 0 && (
        <ul className="r2-event-log" aria-live="polite">
          {events.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* NotchSafeBars (50645)                                               */
/* ------------------------------------------------------------------ */

export function NotchSafeBars() {
  return (
    <div className="r2-notch-demo">
      <div className="r2-notch-header">
        Hunt #4821 <span className="r2-notch-tag">safe-area top</span>
      </div>
      <div className="r2-notch-body">
        <p className="r2-note">
          Header and bottom bar pad with <code>env(safe-area-inset-*)</code> so notches, punch-holes
          and home indicators never cover controls. Wave 16 used these piecemeal — these utility
          classes generalize them.
        </p>
      </div>
      <div className="r2-notch-bottombar">
        <button type="button" className="r2-btn">
          Pause
        </button>
        <button type="button" className="r2-btn r2-btn-primary">
          New hunt
        </button>
        <span className="r2-notch-tag">safe-area bottom</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HybridTabletCard (50646)                                            */
/* ------------------------------------------------------------------ */

export function HybridTabletCard() {
  const width = useViewportWidth();
  const [mode, setMode] = useState('mouse');
  useEffect(() => {
    setMode(hybridUiMode({ width, coarse: hasCoarsePointer(), hover: hasFineHover() }));
  }, [width]);
  return (
    <div className="r2-hybrid">
      <p className="r2-note">
        Detected input mode: <strong>{mode}</strong> (coarse pointer: {String(hasCoarsePointer())},
        hover: {String(hasFineHover())}). Hybrid devices get hover tooltips <em>and</em> 48px touch
        targets at once.
      </p>
      <div className="r2-hybrid-card">
        <div className="r2-hybrid-main">
          <h4>DM-4821 — Reflected XSS</h4>
          <p>Severity high · confidence 0.92</p>
        </div>
        <span
          className="r2-tooltip-wrap"
          tabIndex={0}
          aria-label="More info: CVSS 7.5, reflected via the q parameter"
        >
          <button type="button" className="r2-touch-btn" aria-label="Finding details">
            i
          </button>
          <span className="r2-tooltip" role="tooltip">
            CVSS 7.5 · reflected via the <code>q</code> parameter · PoC ready
          </span>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CollapsibleMobileSection (50647)                                    */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  {
    id: 's1',
    title: 'Findings (3)',
    body: 'DM-4821 high · DM-4819 medium · DM-4817 low. All have PoCs.',
  },
  { id: 's2', title: 'Timeline', body: 'Recon 4m → Scan 8m → PoC 2m. Finished 11:02 IST.' },
  { id: 's3', title: 'Exports', body: 'PDF, Markdown and JSON exports are ready.' },
];

export function CollapsibleMobileSection() {
  const width = useViewportWidth();
  const mobile = isMobileWidth(width);
  const [explicit, setExplicit] = useState(null); // null = follow breakpoint default
  const isOpen = id => (explicit ? explicit.includes(id) : !mobile);
  const toggle = id =>
    setExplicit(prev => {
      const base = prev || (mobile ? [] : SECTIONS.map(s => s.id));
      return base.includes(id) ? base.filter(x => x !== id) : [...base, id];
    });
  return (
    <div className="r2-collapse">
      <p className="r2-note">
        {mobile
          ? 'Mobile layout — sections start collapsed.'
          : 'Desktop layout — sections start expanded.'}{' '}
        (current: {width}px)
      </p>
      {SECTIONS.map(s => (
        <div key={s.id} className="r2-collapse-sec">
          <button
            type="button"
            className="r2-collapse-head"
            onClick={() => toggle(s.id)}
            aria-expanded={isOpen(s.id)}
          >
            {s.title}
            <span aria-hidden="true">{isOpen(s.id) ? '▾' : '▸'}</span>
          </button>
          {isOpen(s.id) && <p className="r2-collapse-body">{s.body}</p>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OsTextSizeDemo (50648)                                              */
/* ------------------------------------------------------------------ */

export function OsTextSizeDemo() {
  const [rootPx, setRootPx] = useState(ROOT_FONT_DEFAULT_PX);
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = `${rootPx}px`;
    }
    return () => {
      if (typeof document !== 'undefined') document.documentElement.style.fontSize = '';
    };
  }, [rootPx]);
  const step = d => setRootPx(p => clampRootFontSize(p + d));
  return (
    <div className="r2-textsize">
      <p className="r2-note">
        All type in this suite is <code>rem</code>-based, so the OS text-size setting (which changes
        the root font size) scales everything. Simulate it:
      </p>
      <div className="r2-textsize-controls">
        <button
          type="button"
          className="r2-btn"
          onClick={() => step(-2)}
          aria-label="Decrease text size"
        >
          A−
        </button>
        <span className="r2-textsize-value" aria-live="polite">
          {rootPx}px root
        </span>
        <button
          type="button"
          className="r2-btn"
          onClick={() => step(2)}
          aria-label="Increase text size"
        >
          A+
        </button>
        <button type="button" className="r2-btn" onClick={() => setRootPx(ROOT_FONT_DEFAULT_PX)}>
          Reset
        </button>
      </div>
      <p className="r2-textsize-sample">
        The quick brown fox — body copy at 1rem scales with the root.
      </p>
      <p className="r2-textsize-sample r2-small">
        Small print at 0.8125rem still scales proportionally.
      </p>
      <p className="r2-note r2-faint">
        Range clamped to {ROOT_FONT_MIN_PX}–{ROOT_FONT_MAX_PX}px.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SaveDataBadge (50649)                                               */
/* ------------------------------------------------------------------ */

export function SaveDataBadge() {
  const [forced, setForced] = useState('auto');
  const detected = useMemo(
    () => degradeTier({ saveData: saveDataEnabled(), effectiveType: effectiveConnectionType() }),
    []
  );
  const tier = forced === 'auto' ? detected : forced;
  return (
    <div className="r2-savedata">
      <div className={`r2-savedata-badge r2-tier-${tier}`} role="status">
        <span className="r2-savedata-dot" aria-hidden="true" />
        {tier === 'full' && 'Full experience'}
        {tier === 'reduced' && 'Reduced motion — Save-Data / 3G'}
        {tier === 'minimal' && 'Minimal — 2G / Save-Data'}
      </div>
      <p className="r2-note">
        Detected: Save-Data {String(saveDataEnabled())} · connection {effectiveConnectionType()}.
        Heavy animation, blur and big shadows degrade by tier.
      </p>
      <label className="r2-row-label">
        Simulate
        <select
          value={forced}
          onChange={e => setForced(e.target.value)}
          aria-label="Simulate network tier"
        >
          <option value="auto">Auto (detected)</option>
          <option value="full">Full</option>
          <option value="reduced">Reduced</option>
          <option value="minimal">Minimal</option>
        </select>
      </label>
      <div className={`r2-savedata-demo ${degradeClassForTier(tier)}`}>
        <div className="r2-heavy-anim" aria-hidden="true" />
        <p>Decorative motion lives here — it freezes under reduced/minimal tiers.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ShortMobileEmptyState (50650)                                       */
/* ------------------------------------------------------------------ */

export function ShortMobileEmptyState({
  icon = '◌',
  line = 'No findings yet.',
  actionLabel = 'Start hunt',
  onAction,
}) {
  return (
    <div className="r2-short-empty" role="status">
      <span className="r2-short-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <p>{line}</p>
      {actionLabel && (
        <button type="button" className="r2-btn r2-btn-small" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
/* ------------------------------------------------------------------ */
/* SwipeablePhaseCarousel (50651)                                      */
/* ------------------------------------------------------------------ */

const PHASES = [
  { id: 'recon', title: 'Recon', detail: '42 subdomains · 11 live hosts' },
  { id: 'scan', title: 'Scan', detail: '1,204 requests · 3 findings' },
  { id: 'poc', title: 'PoC', detail: '3 proof-of-concepts generated' },
  { id: 'report', title: 'Report', detail: 'Executive summary ready' },
];

export function SwipeablePhaseCarousel() {
  const pages = carouselPageCount(PHASES.length, 1);
  const [index, setIndex] = useState(0);
  const touchX = useRef(null);

  const go = i => setIndex(clampCarouselIndex(i, pages));

  const onTouchStart = e => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = e => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    go(carouselIndexAfterSwipe(index, dx, pages));
    touchX.current = null;
  };
  const onKeyDown = e => {
    if (e.key === 'ArrowLeft') go(index - 1);
    if (e.key === 'ArrowRight') go(index + 1);
  };

  return (
    <div
      className="r2-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hunt phases"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="r2-carousel-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="r2-carousel-track"
          style={{ transform: `translateX(${carouselOffsetPct(index)}%)` }}
        >
          {PHASES.map((p, i) => (
            <div
              key={p.id}
              className="r2-carousel-page"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${pages}: ${p.title}`}
            >
              <h4>{p.title}</h4>
              <p>{p.detail}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="r2-carousel-nav">
        <button
          type="button"
          className="r2-btn r2-btn-small"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous phase"
        >
          ←
        </button>
        <div className="r2-carousel-dots" role="tablist" aria-label="Phases">
          {PHASES.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={p.title}
              className={`r2-carousel-dot${i === index ? ' r2-active' : ''}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="r2-btn r2-btn-small"
          onClick={() => go(index + 1)}
          disabled={index === pages - 1}
          aria-label="Next phase"
        >
          →
        </button>
      </div>
      <p className="r2-note">
        Swipe, arrow keys, dots or buttons — {index + 1} of {pages}.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MobileTabBadge (50652)                                              */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'hunt', label: 'Hunt AI' },
  { id: 'findings', label: 'Findings', badge: true },
  { id: 'chat', label: 'Chat' },
  { id: 'more', label: 'More' },
];

export function MobileTabBadge({ startCount = 3 }) {
  const [active, setActive] = useState('hunt');
  const [count, setCount] = useState(startCount);
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => setCount(c => (c >= 9 ? 3 : c + 1)), 4000);
    return () => clearInterval(id);
  }, [live]);

  return (
    <div className="r2-tabbar-demo">
      <nav className="r2-tabbar" aria-label="Mobile tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`r2-tab${active === t.id ? ' r2-active' : ''}`}
            aria-current={active === t.id ? 'page' : undefined}
            onClick={() => setActive(t.id)}
          >
            {t.label}
            {t.badge && count > 0 && (
              <span className="r2-tab-badge" aria-label={`${count} findings`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </nav>
      <p className="r2-note">
        Live findings count on the tab badge.
        <button
          type="button"
          className="r2-btn r2-btn-small r2-note-btn"
          onClick={() => setLive(v => !v)}
        >
          {live ? 'Pause live' : 'Resume live'}
        </button>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BottomSheetModal (50653)                                             */
/* ------------------------------------------------------------------ */

export function BottomSheetModal({ title = 'Filter findings', children }) {
  const [open, setOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [sheet, setSheet] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : true
  );
  const dragStart = useRef(null);
  const closeRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    const onResize = () => setSheet(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (closeRef.current) closeRef.current.focus();
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      if (openerRef.current) openerRef.current.focus();
    };
  }, [open]);

  const onTouchStart = e => {
    if (!sheet) return;
    dragStart.current = e.touches[0].clientY;
  };
  const onTouchMove = e => {
    if (!sheet || dragStart.current == null) return;
    const dy = e.touches[0].clientY - dragStart.current;
    setDragY(Math.max(0, dy));
  };
  const onTouchEnd = () => {
    if (!sheet || dragStart.current == null) return;
    if (dragY > 90) setOpen(false);
    setDragY(0);
    dragStart.current = null;
  };

  return (
    <div className="r2-sheet-demo">
      <button ref={openerRef} type="button" className="r2-btn" onClick={() => setOpen(true)}>
        Open {title.toLowerCase()}
      </button>
      {open && (
        <div className="r2-modal-overlay" onClick={() => setOpen(false)}>
          <div
            className={`r2-modal${sheet ? ' r2-as-sheet' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={e => e.stopPropagation()}
            style={sheet && dragY ? { transform: `translateY(${dragY}px)` } : undefined}
          >
            {sheet && (
              <div
                className="r2-sheet-handle"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                aria-hidden="true"
              >
                <span />
              </div>
            )}
            <div className="r2-modal-head">
              <h4>{title}</h4>
              <button
                ref={closeRef}
                type="button"
                className="r2-btn r2-btn-small"
                onClick={() => setOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <div className="r2-modal-body">
              {children || (
                <>
                  <label className="r2-check">
                    <input type="checkbox" defaultChecked /> Critical
                  </label>
                  <label className="r2-check">
                    <input type="checkbox" defaultChecked /> High
                  </label>
                  <label className="r2-check">
                    <input type="checkbox" /> Medium
                  </label>
                  <label className="r2-check">
                    <input type="checkbox" /> Low
                  </label>
                  <p className="r2-note">
                    {sheet ? 'Drag the handle down to dismiss.' : 'Centered modal on wide screens.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LargeTouchSlider (50654)                                            */
/* ------------------------------------------------------------------ */

export function LargeTouchSlider({ min = 0, max = 10, step = 0.5, label = 'Minimum CVSS score' }) {
  const [value, setValue] = useState(7);
  const trackRef = useRef(null);

  const setFromClientX = clientX => {
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    setValue(sliderValueAt({ min, max, step, ratio }));
  };

  const onPointerDown = e => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
    const move = ev => setFromClientX(ev.clientX);
    const up = () => {
      e.currentTarget.removeEventListener('pointermove', move);
      e.currentTarget.removeEventListener('pointerup', up);
    };
    e.currentTarget.addEventListener('pointermove', move);
    e.currentTarget.addEventListener('pointerup', up);
  };

  const onKeyDown = e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')
      setValue(v =>
        sliderValueAt({ min, max, step, ratio: sliderRatioFor({ min, max, value: v + step }) })
      );
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
      setValue(v =>
        sliderValueAt({ min, max, step, ratio: sliderRatioFor({ min, max, value: v - step }) })
      );
    if (e.key === 'Home') setValue(min);
    if (e.key === 'End') setValue(max);
  };

  const ratio = sliderRatioFor({ min, max, value });
  return (
    <div className="r2-slider">
      <div className="r2-slider-head">
        <span id="r2-slider-label">{label}</span>
        <output htmlFor="r2-slider-track" aria-live="polite">
          {value.toFixed(1)}
        </output>
      </div>
      <div
        id="r2-slider-track"
        ref={trackRef}
        className="r2-slider-track"
        role="slider"
        tabIndex={0}
        aria-labelledby="r2-slider-label"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(1)} of ${max}`}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      >
        <div className="r2-slider-fill" style={{ width: `${ratio * 100}%` }} />
        <div
          className="r2-slider-thumb"
          style={{ left: `calc(${(ratio * 100).toFixed(2)}% - ${LARGE_SLIDER_THUMB_PX / 2}px)` }}
          aria-hidden="true"
        />
      </div>
      <div className="r2-slider-scale" aria-hidden="true">
        <span>{min}</span>
        <span>{((min + max) / 2).toFixed(1)}</span>
        <span>{max}</span>
      </div>
      <p className="r2-note r2-faint">44px thumb, step {step}, full keyboard support.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FullBleedTabletGraph (50655)                                        */
/* ------------------------------------------------------------------ */

const GRAPH_BARS = [
  { label: 'Mon', v: 4 },
  { label: 'Tue', v: 7 },
  { label: 'Wed', v: 3 },
  { label: 'Thu', v: 9 },
  { label: 'Fri', v: 6 },
  { label: 'Sat', v: 2 },
  { label: 'Sun', v: 5 },
];

export function FullBleedTabletGraph() {
  const width = useViewportWidth();
  const tabletLandscape =
    isTabletWidth(width) &&
    orientationOf(width, typeof window !== 'undefined' ? window.innerHeight : 800) === 'landscape';
  const max = Math.max(...GRAPH_BARS.map(b => b.v));
  return (
    <div className="r2-graph-wrap">
      <p className="r2-note">
        {tabletLandscape
          ? 'Tablet landscape — the graph bleeds full-width with a floating legend.'
          : 'Full-bleed + floating legend apply on tablet landscape (720–1023px, landscape).'}
      </p>
      <div className="r2-graph-bleed">
        <svg
          viewBox="0 0 700 220"
          className="r2-graph-svg"
          role="img"
          aria-label="Findings per day bar chart"
        >
          {GRAPH_BARS.map((b, i) => {
            const h = (b.v / max) * 150;
            const x = 40 + i * 90;
            return (
              <g key={b.label}>
                <rect x={x} y={180 - h} width={52} height={h} rx={6} className="r2-graph-bar" />
                <text x={x + 26} y={202} textAnchor="middle" className="r2-graph-label">
                  {b.label}
                </text>
                <text x={x + 26} y={170 - h} textAnchor="middle" className="r2-graph-value">
                  {b.v}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="r2-graph-legend">
          <span>
            <i className="r2-legend-dot" /> Findings / day
          </span>
          <span>
            <i className="r2-legend-dot r2-peak" /> Peak: Thu (9)
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DesktopSiteToggle (50656)                                           */
/* ------------------------------------------------------------------ */

export function DesktopSiteToggle() {
  const store = useMemo(
    () => makeDesktopSiteStore(typeof window !== 'undefined' ? window.localStorage : null),
    []
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [forced, setForced] = useState(() => store.enabled());
  const width = useViewportWidth();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle(FORCE_DESKTOP_CLASS, forced);
    }
    store.setEnabled(forced);
    return () => {
      if (typeof document !== 'undefined') document.body.classList.remove(FORCE_DESKTOP_CLASS);
    };
  }, [forced, store]);

  const effective = shouldForceDesktop({ stored: forced, width });

  return (
    <div className="r2-desktop-toggle">
      <div className="r2-mobile-menu">
        <button
          type="button"
          className="r2-btn"
          onClick={() => setMenuOpen(o => !o)}
          aria-expanded={menuOpen}
          aria-label="Mobile menu"
        >
          ☰ Menu
        </button>
        {menuOpen && (
          <div className="r2-menu-pop" role="menu">
            <button type="button" role="menuitem" className="r2-menu-item">
              Hunts
            </button>
            <button type="button" role="menuitem" className="r2-menu-item">
              Reports
            </button>
            <label className="r2-menu-item r2-check">
              <input type="checkbox" checked={forced} onChange={e => setForced(e.target.checked)} />
              Desktop site
            </label>
          </div>
        )}
      </div>
      <div className={`r2-viewport-demo${effective ? ' r2-forced' : ''}`}>
        <div className="r2-viewport-col">Nav rail</div>
        <div className="r2-viewport-col r2-main">Main column</div>
        <div className="r2-viewport-col">Side rail</div>
      </div>
      <p className="r2-note">
        {effective
          ? 'Desktop layout forced (3 columns) — toggle is persisted.'
          : 'Responsive layout — enable “Desktop site” in the menu to force 3 columns.'}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ResponsiveFocusOrder (50657)                                        */
/* ------------------------------------------------------------------ */

export function ResponsiveFocusOrder() {
  const width = useViewportWidth();
  const order = focusOrderForViewport(width);
  return (
    <div className="r2-focusorder">
      <p className="r2-note">
        Tab order follows the visual layout: <strong>{viewportKind(width)}</strong> ({width}px). The
        chips below are the real tab sequence for this width.
      </p>
      <ol className="r2-focusorder-list">
        {order.map((region, i) => (
          <li key={region} className="r2-focusorder-chip">
            <span className="r2-focusorder-num">{i + 1}</span> {region}
          </li>
        ))}
      </ol>
      <p className="r2-note r2-faint">
        Correctness is proven by 50519/50466 — this is the per-layout order they validate.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ContainerQueryWidget (50658)                                        */
/* ------------------------------------------------------------------ */

const CQ_WIDGETS = [
  { id: 'w1', title: 'Findings', body: '3 open' },
  { id: 'w2', title: 'Coverage', body: '87%' },
  { id: 'w3', title: 'PoCs', body: '3 ready' },
  { id: 'w4', title: 'Runtime', body: '14m 22s' },
  { id: 'w5', title: 'Targets', body: '11 live' },
  { id: 'w6', title: 'Exports', body: 'PDF · MD' },
];

export function ContainerQueryWidget() {
  const [wrapPx, setWrapPx] = useState(640);
  const supported = containerQueriesSupported();
  const fallbackCols = widgetColumnsFallback(wrapPx);
  return (
    <div className="r2-cq">
      <p className="r2-note">
        Widgets resize by their <em>container</em>, not the viewport — drag the width slider. Real{' '}
        <code>@container</code> queries{supported ? '' : ' (unsupported here — JS fallback active)'}
        .
      </p>
      <label className="r2-row-label">
        Container width
        <input
          type="range"
          min={280}
          max={900}
          step={10}
          value={wrapPx}
          onChange={e => setWrapPx(Number(e.target.value))}
          aria-label="Container width in pixels"
        />
        <span>{wrapPx}px</span>
      </label>
      <div className="r2-cq-wrap" style={{ maxWidth: wrapPx }}>
        <div
          className="r2-cq-grid"
          style={supported ? undefined : { gridTemplateColumns: `repeat(${fallbackCols}, 1fr)` }}
        >
          {CQ_WIDGETS.map(w => (
            <div key={w.id} className="r2-cq-widget">
              <strong>{w.title}</strong>
              <span>{w.body}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="r2-note r2-faint">
        {supported
          ? 'Native @container queries in use.'
          : `Fallback: ${fallbackCols} column(s) at ${wrapPx}px.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TestedWidthNote (50659)                                             */
/* ------------------------------------------------------------------ */

export function TestedWidthNote() {
  return (
    <div className="r2-tested" role="note">
      <span className="r2-tested-badge" aria-hidden="true">
        ✓
      </span>
      <p>
        <strong>{testedWidthLabel()}.</strong> Found a layout break outside that range?{' '}
        <a href="https://github.com/Obfinityy/Dark-Matter/issues" target="_blank" rel="noreferrer">
          Report a width bug
        </a>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

function Demo({ id, title, children }) {
  return (
    <section className="r2-demo" aria-label={`${id}: ${title}`}>
      <h3>
        <span className="r2-demo-id">{id}</span> {title}
      </h3>
      {children}
    </section>
  );
}

export function ResponsiveRound2Gallery() {
  const [emptyCount, setEmptyCount] = useState(0);
  return (
    <div className="r2-gallery">
      <div className="r2-gallery-head">
        <h2>Responsive round 2 (50641–50659)</h2>
        <p className="r2-note">
          The second responsive pass — everything wave 16 left out. Present only as Infinity AI.
        </p>
      </div>
      <Demo id="50641" title="Long-press quick menu">
        <LongPressMenu />
      </Demo>
      <Demo id="50642" title="Responsive thumbnails">
        <ResponsiveThumbnailDemo />
      </Demo>
      <Demo id="50643" title="Print layout override">
        <PrintLayoutOverride />
      </Demo>
      <Demo id="50644" title="Orientation-safe scroll">
        <OrientationSafeScroller />
      </Demo>
      <Demo id="50645" title="Notch safe areas">
        <NotchSafeBars />
      </Demo>
      <Demo id="50646" title="Hybrid tablet UI">
        <HybridTabletCard />
      </Demo>
      <Demo id="50647" title="Collapsed mobile sections">
        <CollapsibleMobileSection />
      </Demo>
      <Demo id="50648" title="OS text-size respect">
        <OsTextSizeDemo />
      </Demo>
      <Demo id="50649" title="Save-Data degradation">
        <SaveDataBadge />
      </Demo>
      <Demo id="50650" title="Short mobile empty states">
        <div className="r2-empty-row">
          <ShortMobileEmptyState
            icon="◎"
            line="No findings yet — run a hunt to populate this list."
            onAction={() => setEmptyCount(c => c + 1)}
          />
          <ShortMobileEmptyState
            icon="▭"
            line="No exports yet."
            actionLabel="Export report"
            onAction={() => setEmptyCount(c => c + 1)}
          />
        </div>
        {emptyCount > 0 && (
          <p className="r2-note" role="status">
            Action pressed {emptyCount} time(s).
          </p>
        )}
      </Demo>
      <Demo id="50651" title="Swipeable phase carousel">
        <SwipeablePhaseCarousel />
      </Demo>
      <Demo id="50652" title="Mobile tab badge">
        <MobileTabBadge />
      </Demo>
      <Demo id="50653" title="Bottom-sheet modals">
        <BottomSheetModal />
      </Demo>
      <Demo id="50654" title="Large touch sliders">
        <LargeTouchSlider />
      </Demo>
      <Demo id="50655" title="Full-bleed tablet graph">
        <FullBleedTabletGraph />
      </Demo>
      <Demo id="50656" title="Desktop-site toggle">
        <DesktopSiteToggle />
      </Demo>
      <Demo id="50657" title="Responsive focus order">
        <ResponsiveFocusOrder />
      </Demo>
      <Demo id="50658" title="Container-query widgets">
        <ContainerQueryWidget />
      </Demo>
      <Demo id="50659" title="Tested-width note">
        <TestedWidthNote />
      </Demo>
    </div>
  );
}

export default ResponsiveRound2Gallery;
