/**
 * ThemeSuite.jsx — Infinity AI · Forge wave 17 (ideas 50660–50680).
 *
 * First-class theming suite: ThemeProvider (context, data-theme application,
 * persistence, 250ms cross-fade, aria-live announcements, themed favicon +
 * theme-color meta, light print default), ThemePicker, ThemePreviewThumbnail,
 * AccentPicker, ContrastReadout, SunsetScheduler, ThemeJSONExportImport,
 * ThemedLogo, PerPageThemeMemory, DimThemeToggle, ThemeCycleHint,
 * ThemedSkeleton, ThemedCodeBlock, ThemedChart, ThemedEmailPreview, plus the
 * ThemeSuiteGallery reference gallery.
 *
 * Honest notes:
 * - App.jsx already ships a basic dark/light data-theme toggle. This suite
 *   extends it to four first-class themes with full palettes; the provider
 *   is designed to supersede that toggle on integration.
 * - The Ctrl+. cycle binding is owned by wave 12 (ShortcutsManager.jsx).
 *   ThemeCycleHint only documents it — no second binding is registered here.
 *
 * State math and palettes live in themeCore.js; styling in ThemeSuite.css.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  THEMES,
  THEME_IDS,
  THEME_ORDER,
  ACCENT_PRESETS,
  isThemeId,
  themeById,
  cycleTheme,
  severityForTheme,
  chartPaletteForTheme,
  syntaxColorsForTheme,
  contrastRatio,
  contrastGrade,
  bestTextOn,
  accentPairing,
  resolveOsTheme,
  resolveEffectiveTheme,
  sunTimes,
  isDarkOutside,
  formatMinutes,
  makePageThemeStore,
  exportThemeJson,
  importThemeJson,
  themedEmailHtml,
  OS_DARK_QUERY,
} from './themeCore.js';
import './ThemeSuite.css';

const STORAGE_KEY = 'infinity.theme.v1';
const TRANSITION_MS = 250;

function readStoredSettings() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function accentFor(settingsAccent, themeId) {
  if (settingsAccent && /^#[0-9a-fA-F]{6}$/.test(settingsAccent)) return settingsAccent;
  return (themeById(themeId) || THEMES.dark).accent;
}

/** Per-theme SVG favicon (data URI) — Infinity mark on the theme surface. */
function faviconForTheme(themeId) {
  const t = themeById(themeId) || THEMES.dark;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">`
    + `<rect width="32" height="32" rx="7" fill="${t.surface.base}"/>`
    + `<text x="16" y="23" font-size="19" text-anchor="middle" fill="${t.accent}" font-family="Georgia,serif">∞</text>`
    + `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* ThemeProvider (50661, 50670, 50671, 50672, 50674, 50677, 50680)      */
/* ------------------------------------------------------------------ */

export function ThemeProvider({ children, initialTheme = null }) {
  const stored = useMemo(readStoredSettings, []);
  const [theme, setThemeState] = useState(() =>
    isThemeId(initialTheme) ? initialTheme : isThemeId(stored?.theme) ? stored.theme : 'dark'
  );
  const [accent, setAccent] = useState(() => accentFor(stored?.accent, isThemeId(stored?.theme) ? stored.theme : 'dark'));
  const [osFollow, setOsFollow] = useState(() => stored?.osFollow !== false);
  const [sunsetAuto, setSunsetAuto] = useState(() => stored?.sunsetAuto === true);
  const [sunsetLat, setSunsetLat] = useState(() => (Number.isFinite(stored?.sunsetLat) ? stored.sunsetLat : 28.6139));
  const [sunsetLng, setSunsetLng] = useState(() => (Number.isFinite(stored?.sunsetLng) ? stored.sunsetLng : 77.209));
  const [printTheme, setPrintTheme] = useState(() => (stored?.printTheme === 'follow' ? 'follow' : 'light'));
  const [oledBlack, setOledBlack] = useState(() => stored?.oledBlack === true);
  const [pageThemes, setPageThemes] = useState(() => (stored?.pageThemes && typeof stored.pageThemes === 'object' ? stored.pageThemes : {}));
  const [announcement, setAnnouncement] = useState('');
  const fadeTimer = useRef(null);

  const pageStore = useMemo(
    () => makePageThemeStore(typeof window !== 'undefined' ? window.localStorage : null),
    []
  );

  // OS preference listener: only applies while osFollow is on and the user
  // has not picked a manual theme this session.
  const [manualPick, setManualPick] = useState(() => isThemeId(stored?.theme));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(OS_DARK_QUERY);
    const onChange = () => {
      if (!manualPick) {
        setThemeState(mq.matches ? 'dark' : 'light');
        setAnnouncement(`Theme changed to ${mq.matches ? 'dark' : 'light'} (system preference)`);
      }
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    return () => {
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange);
    };
  }, [manualPick]);

  // Sunset auto-switch: check every 5 minutes and on mount.
  useEffect(() => {
    if (!sunsetAuto) return undefined;
    const apply = () => {
      try {
        const dark = isDarkOutside({ lat: sunsetLat, lng: sunsetLng, date: new Date() });
        const target = dark ? 'dark' : 'light';
        setThemeState((prev) => (prev === 'high-contrast' || prev === 'dim' ? prev : target));
      } catch { /* bad lat/lng — leave the theme alone */ }
    };
    apply();
    const id = setInterval(apply, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [sunsetAuto, sunsetLat, sunsetLng]);

  const applyThemeToDocument = useCallback(
    (nextTheme) => {
      if (typeof document === 'undefined') return;
      const root = document.documentElement;
      const reduce =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const prev = root.getAttribute('data-theme');
      root.setAttribute('data-theme', nextTheme);
      root.setAttribute('data-th-print', printTheme);
      root.classList.toggle('th-oled', oledBlack && nextTheme === 'dark');
      if (!reduce && prev !== nextTheme) {
        root.classList.add('th-fading');
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => root.classList.remove('th-fading'), TRANSITION_MS + 20);
      }
      // Themed theme-color meta (50671).
      const t = themeById(nextTheme) || THEMES.dark;
      let meta = document.querySelector('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', oledBlack && nextTheme === 'dark' ? '#000000' : t.themeColor);
      // Themed favicon (50671).
      let icon = document.querySelector('link[rel="icon"]');
      if (!icon) {
        icon = document.createElement('link');
        icon.setAttribute('rel', 'icon');
        document.head.appendChild(icon);
      }
      icon.setAttribute('href', faviconForTheme(nextTheme));
    },
    [printTheme, oledBlack]
  );

  // Apply + persist on every relevant change.
  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ theme, accent, osFollow, sunsetAuto, sunsetLat, sunsetLng, printTheme, oledBlack, pageThemes })
        );
      }
    } catch { /* storage blocked — theme still applies for the session */ }
  }, [theme, accent, osFollow, sunsetAuto, sunsetLat, sunsetLng, printTheme, oledBlack, pageThemes, applyThemeToDocument]);

  const setTheme = useCallback(
    (id) => {
      if (!isThemeId(id)) return;
      setManualPick(true);
      setOsFollow(false);
      setThemeState(id);
      setAnnouncement(`Theme changed to ${(themeById(id) || {}).label || id}`);
    },
    []
  );

  const followOs = useCallback(() => {
    setManualPick(false);
    setOsFollow(true);
    const os = resolveOsTheme();
    setThemeState(os === 'light' ? 'light' : 'dark');
    setAnnouncement(`Following system theme (${os || 'dark'})`);
  }, []);

  const cycle = useCallback(() => {
    setTheme(cycleTheme(theme));
  }, [theme, setTheme]);

  const pairing = useMemo(() => accentPairing(accent, theme), [accent, theme]);

  const value = useMemo(
    () => ({
      theme,
      themeDef: themeById(theme) || THEMES.dark,
      setTheme,
      followOs,
      cycleTheme: cycle,
      osFollow,
      setOsFollow,
      accent,
      setAccent,
      accentPairing: pairing,
      sunsetAuto,
      setSunsetAuto,
      sunsetLat,
      setSunsetLat,
      sunsetLng,
      setSunsetLng,
      printTheme,
      setPrintTheme,
      oledBlack,
      setOledBlack,
      pageThemes,
      setPageTheme: (page, tid) => {
        pageStore.setPageTheme(page, tid);
        setPageThemes({ ...pageStore.pages().reduce((o, p) => ({ ...o, [p]: pageStore.getPageTheme(p) }), {}) });
      },
      themeForPage: (page) => pageStore.resolvePageTheme(page, theme),
      exportJson: () =>
        exportThemeJson({ theme, accent, osFollow, sunsetAuto, sunsetLat, sunsetLng, printTheme, oledBlack, pageThemes }),
      importJson: (text) => {
        const res = importThemeJson(text);
        if (res.ok) {
          const s = res.state;
          setThemeState(s.theme);
          setAccent(s.accent);
          setOsFollow(s.osFollow);
          setSunsetAuto(s.sunsetAuto);
          setSunsetLat(s.sunsetLat);
          setSunsetLng(s.sunsetLng);
          setPrintTheme(s.printTheme);
          setOledBlack(s.oledBlack);
          setPageThemes(s.pageThemes || {});
          setManualPick(true);
          setAnnouncement(`Theme settings imported (${s.theme})`);
        }
        return res;
      },
    }),
    [theme, accent, osFollow, sunsetAuto, sunsetLat, sunsetLng, printTheme, oledBlack, pageThemes, setTheme, followOs, cycle, pairing, pageStore]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className="th-scope" style={{ '--th-accent': pairing.accent, '--th-on-accent': pairing.onAccent }}>
        {children}
        <div className="th-live-region" role="status" aria-live="polite">
          {announcement}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* ThemePicker (50660, 50666)                                          */
/* ------------------------------------------------------------------ */

export function ThemePicker() {
  const { theme, setTheme, followOs, osFollow } = useTheme();
  return (
    <div className="th-picker" role="radiogroup" aria-label="Theme">
      {THEME_IDS.map((id) => {
        const t = THEMES[id];
        const selected = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`th-theme-card${selected ? ' th-selected' : ''}`}
            data-theme={id}
            onClick={() => setTheme(id)}
          >
            <span className="th-theme-swatch" aria-hidden="true">
              <span className="th-theme-dot" style={{ background: t.accent }} />
            </span>
            <span className="th-theme-label">{t.label}</span>
            <span className="th-theme-kind">{t.kind === 'hc' ? 'AAA' : t.kind}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={`th-theme-card th-os${osFollow ? ' th-selected' : ''}`}
        onClick={followOs}
        aria-pressed={osFollow}
        title="Follow the operating system preference until you pick manually"
      >
        <span className="th-theme-label">System</span>
        <span className="th-theme-kind">auto</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ThemePreviewThumbnail (50665)                                       */
/* ------------------------------------------------------------------ */

/** Live mini hunt-UI preview; recolors with whatever data-theme it sits in. */
export function ThemePreviewThumbnail({ themeId = null, label = null }) {
  const sev = severityForTheme(themeId || 'dark');
  const t = themeById(themeId) || THEMES.dark;
  return (
    <figure className="th-preview" data-theme={themeId || undefined} aria-label={label || `Preview of the ${t.label} theme`}>
      <div className="th-preview-bar">
        <span className="th-preview-dot" />
        <span className="th-preview-dot" />
        <span className="th-preview-title">Hunt #4821</span>
      </div>
      <div className="th-preview-chips">
        {Object.entries(sev).map(([k, color]) => (
          <span key={k} className="th-preview-chip" style={{ borderColor: color, color }}>
            {k}
          </span>
        ))}
      </div>
      <div className="th-preview-line" />
      <div className="th-preview-line th-short" />
      <div className="th-preview-row">
        <span className="th-preview-btn">Run hunt</span>
        <span className="th-preview-link">View report</span>
      </div>
      <figcaption className="th-preview-caption">{label || t.label}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* AccentPicker (50675)                                                */
/* ------------------------------------------------------------------ */

export function AccentPicker() {
  const { accent, setAccent, accentPairing: pairing } = useTheme();
  return (
    <div className="th-accent">
      <div className="th-accent-row" role="radiogroup" aria-label="Accent color presets">
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={accent.toLowerCase() === p.hex}
            title={p.label}
            className={`th-accent-preset${accent.toLowerCase() === p.hex ? ' th-selected' : ''}`}
            style={{ background: p.hex }}
            onClick={() => setAccent(p.hex)}
          />
        ))}
        <label className="th-color-wheel" title="Custom accent color">
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            aria-label="Custom accent color"
          />
          <span aria-hidden="true">🎨</span>
        </label>
      </div>
      <p className="th-note">
        Pairing <code>{pairing.accent}</code> on <code>{pairing.onAccent}</code> — ratio{' '}
        {pairing.ratio.toFixed(2)}:1 ({pairing.grade})
        {pairing.grade === 'fail' || pairing.grade === 'AA-large' ? ' — auto-guard keeps text readable' : ' — passes'}.
      </p>
      <div className="th-accent-sample" style={{ background: pairing.accent, color: pairing.onAccent }}>
        Sample button text on the accent
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ContrastReadout (50664)                                             */
/* ------------------------------------------------------------------ */

export function ContrastReadout() {
  return (
    <div className="th-readout">
      {THEME_IDS.map((id) => {
        const t = THEMES[id];
        const pairs = [
          ['Body text', t.text.primary, t.surface.base],
          ['Secondary', t.text.secondary, t.surface.base],
          ['Muted', t.text.muted, t.surface.base],
          ['Accent', t.accent, t.surface.base],
        ];
        return (
          <div key={id} className="th-readout-theme" data-theme={id}>
            <h4>{t.label}</h4>
            <table>
              <tbody>
                {pairs.map(([label, fg, bg]) => {
                  const ratio = contrastRatio(fg, bg);
                  const grade = contrastGrade(ratio);
                  return (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>
                        <span className="th-swatch" style={{ background: fg }} aria-hidden="true" /> {fg}
                      </td>
                      <td>{ratio.toFixed(2)}:1</td>
                      <td>
                        <span className={`th-grade th-grade-${grade.toLowerCase().replace('-', '')}`}>{grade}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="th-sev-row" aria-label={`${t.label} severity hues`}>
              {Object.entries(t.severity).map(([k, color]) => (
                <span key={k} className="th-sev-chip" style={{ borderColor: color, color }} title={`${k}: ${contrastRatio(color, t.surface.base).toFixed(2)}:1`}>
                  {k} {contrastRatio(color, t.surface.base).toFixed(1)}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SunsetScheduler (50662)                                             */
/* ------------------------------------------------------------------ */

export function SunsetScheduler() {
  const { sunsetAuto, setSunsetAuto, sunsetLat, setSunsetLat, sunsetLng, setSunsetLng, setTheme } = useTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  let times = null;
  let err = '';
  try {
    times = sunTimes({ lat: sunsetLat, lng: sunsetLng, date: now });
  } catch (e) {
    err = e.message;
  }
  let darkNow = null;
  try {
    darkNow = isDarkOutside({ lat: sunsetLat, lng: sunsetLng, date: now });
  } catch { /* shown via err */ }
  return (
    <div className="th-sunset">
      <label className="th-switch">
        <input type="checkbox" checked={sunsetAuto} onChange={(e) => setSunsetAuto(e.target.checked)} />
        <span>Auto-switch to dark after sunset</span>
      </label>
      <div className="th-sunset-coords">
        <label>
          Latitude
          <input
            type="number" step="0.0001" min="-90" max="90" value={sunsetLat}
            onChange={(e) => setSunsetLat(parseFloat(e.target.value))}
            aria-label="Latitude"
          />
        </label>
        <label>
          Longitude
          <input
            type="number" step="0.0001" min="-180" max="180" value={sunsetLng}
            onChange={(e) => setSunsetLng(parseFloat(e.target.value))}
            aria-label="Longitude"
          />
        </label>
        <button type="button" className="th-btn" onClick={() => { setSunsetLat(28.6139); setSunsetLng(77.209); }}>
          New Delhi
        </button>
      </div>
      {err ? (
        <p className="th-error">{err}</p>
      ) : times ? (
        <p className="th-note">
          Today: sunrise <strong>{times.polarDay ? '—' : formatMinutes(times.sunriseMin)}</strong> · sunset{' '}
          <strong>{times.polarNight ? '—' : formatMinutes(times.sunsetMin)}</strong>
          {times.polarDay && ' (polar day)'}
          {times.polarNight && ' (polar night)'}
          {!times.polarDay && !times.polarNight && (
            <>
              {' '}· it is currently <strong>{darkNow ? 'dark' : 'light'}</strong> outside
            </>
          )}
          . Times use your device clock, so your own timezone applies.
        </p>
      ) : null}
      <p className="th-note">
        Manual pick: <button type="button" className="th-btn th-btn-small" onClick={() => setTheme('dark')}>Dark now</button>{' '}
        <button type="button" className="th-btn th-btn-small" onClick={() => setTheme('light')}>Light now</button>
      </p>
    </div>
  );
}
/* ------------------------------------------------------------------ */
/* ThemeJSONExportImport                                               */
/* ------------------------------------------------------------------ */

export function ThemeJSONExportImport() {
  const { exportJson, importJson } = useTheme();
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const download = () => {
    try {
      const blob = new Blob([exportJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'infinity-theme.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setResult({ ok: true, message: 'Exported infinity-theme.json' });
    } catch {
      setResult({ ok: false, message: 'Export failed in this browser.' });
    }
  };

  const applyDraft = () => {
    const res = importJson(draft);
    setResult(res.ok ? { ok: true, message: `Imported — theme is now ${res.state.theme}.` } : { ok: false, message: res.error });
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setDraft(String(reader.result || ''));
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div className="th-json">
      <div className="th-json-actions">
        <button type="button" className="th-btn" onClick={download}>Export JSON</button>
        <button type="button" className="th-btn" onClick={() => fileRef.current && fileRef.current.click()}>
          Load file…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden aria-label="Load theme JSON file" />
        <button type="button" className="th-btn th-btn-primary" onClick={applyDraft}>Validate & apply</button>
      </div>
      <textarea
        className="th-json-area"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder='Paste a theme JSON export here, then "Validate & apply".'
        rows={8}
        spellCheck={false}
        aria-label="Theme JSON"
      />
      {result && <p className={result.ok ? 'th-ok' : 'th-error'}>{result.ok ? result.message || 'Applied.' : result.message}</p>}
      <details className="th-note">
        <summary>Schema</summary>
        <code>{'{ version: 1, theme, accent, osFollow, sunsetAuto, sunsetLat, sunsetLng, printTheme, oledBlack, pageThemes }'}</code>
      </details>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ThemedLogo (50676)                                                  */
/* ------------------------------------------------------------------ */

export function ThemedLogo({ size = 40 }) {
  return (
    <div className="th-logo-row" aria-label="Logo variants per theme">
      {THEME_IDS.map((id) => {
        const t = THEMES[id];
        return (
          <div key={id} className="th-logo-cell" data-theme={id} title={`${t.label} variant`}>
            <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`Infinity AI logo, ${t.label} variant`}>
              <rect x="2" y="2" width="44" height="44" rx="11" fill={t.surface.raised} stroke={t.surface.border} strokeWidth="2" />
              <text x="24" y="33" fontSize="24" textAnchor="middle" fill={t.accent} fontFamily="Georgia,serif">∞</text>
            </svg>
            <span>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PerPageThemeMemory (50663)                                          */
/* ------------------------------------------------------------------ */

const DEMO_PAGES = [
  { id: 'hunt', label: 'Hunt view' },
  { id: 'report-preview', label: 'Report preview' },
  { id: 'settings', label: 'Settings' },
];

export function PerPageThemeMemory() {
  const { theme, themeForPage, setPageTheme, pageThemes } = useTheme();
  const [page, setPage] = useState('report-preview');
  const reportTheme = themeForPage('report-preview');
  return (
    <div className="th-page-memory">
      <div className="th-page-row">
        <label>
          Page
          <select value={page} onChange={(e) => setPage(e.target.value)} aria-label="Page">
            {DEMO_PAGES.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label>
          Theme override
          <select
            value={pageThemes[page] || ''}
            onChange={(e) => setPageTheme(page, e.target.value || null)}
            aria-label="Theme override"
          >
            <option value="">Follow global ({theme})</option>
            {THEME_IDS.map((id) => (
              <option key={id} value={id}>{THEMES[id].label}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="th-note">
        Global theme is <strong>{theme}</strong>. The report preview below keeps its own memory — set it to
        Light and the rest of the app can stay Dark.
      </p>
      <div className="th-report-demo" data-theme={reportTheme}>
        <div className="th-report-head">
          <span>Report preview</span>
          <span className="th-report-theme-tag">{THEMES[reportTheme].label}</span>
        </div>
        <div className="th-report-body">
          <div className="th-preview-line" />
          <div className="th-preview-line th-short" />
          <div className="th-preview-chips">
            <span className="th-preview-chip" style={{ borderColor: severityForTheme(reportTheme).critical, color: severityForTheme(reportTheme).critical }}>critical</span>
            <span className="th-preview-chip" style={{ borderColor: severityForTheme(reportTheme).low, color: severityForTheme(reportTheme).low }}>low</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DimThemeToggle (50667)                                              */
/* ------------------------------------------------------------------ */

export function DimThemeToggle() {
  const { theme, setTheme, oledBlack, setOledBlack } = useTheme();
  return (
    <div className="th-dim">
      <p className="th-note">
        <strong>Dim</strong> is the intermediate theme between Dark and Light — softer than full dark,
        easier than light at night.
      </p>
      <div className="th-dim-row">
        <button
          type="button"
          className={`th-btn${theme === 'dim' ? ' th-btn-primary' : ''}`}
          onClick={() => setTheme('dim')}
          aria-pressed={theme === 'dim'}
        >
          Use Dim theme
        </button>
        <label className="th-switch" title="Flatten the dark theme to pure black for OLED screens">
          <input type="checkbox" checked={oledBlack} onChange={(e) => setOledBlack(e.target.checked)} />
          <span>OLED true black (applies to Dark)</span>
        </label>
      </div>
      <div className="th-dim-compare" aria-label="Dark, dim and light compared">
        {['dark', 'dim', 'light'].map((id) => (
          <div key={id} className="th-dim-cell" data-theme={id}>
            <span className="th-dim-swatch" />
            <span>{THEMES[id].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ThemeCycleHint — documents the existing Ctrl+. binding (no re-bind) */
/* ------------------------------------------------------------------ */

export function ThemeCycleHint() {
  const { cycleTheme: cycle } = useTheme();
  return (
    <div className="th-cycle-hint">
      <p className="th-note" style={{ margin: 0 }}>
        Press <kbd>Ctrl</kbd> + <kbd>.</kbd> to cycle themes
        <span className="th-cycle-order" aria-label="Cycle order">
          {THEME_ORDER.map((id, i) => (
            <React.Fragment key={id}>
              {i > 0 && <span aria-hidden="true"> → </span>}
              <span className="th-cycle-chip" data-theme={id}>{THEMES[id].label}</span>
            </React.Fragment>
          ))}
        </span>
        <button type="button" className="th-btn th-btn-small" onClick={cycle}>Cycle now</button>
      </p>
      <p className="th-note th-faint">
        The keyboard binding itself is owned by wave 12 (ShortcutsManager) — this hint never registers a second one.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ThemedSkeleton (50679)                                              */
/* ------------------------------------------------------------------ */

export function ThemedSkeleton({ lines = 3 }) {
  return (
    <div className="th-skeleton" aria-hidden="true">
      <div className="th-skeleton-avatar" />
      <div className="th-skeleton-lines">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={`th-skeleton-line${i === lines - 1 ? ' th-short' : ''}`} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ThemedCodeBlock (50668, 50678)                                       */
/* ------------------------------------------------------------------ */

const SAMPLE_TOKENS = [
  [{ t: 'keyword', s: 'function' }, { t: 'text', s: ' ' }, { t: 'func', s: 'scanTarget' }, { t: 'text', s: '(' }, { t: 'text', s: 'url' }, { t: 'text', s: ') {' }],
  [{ t: 'text', s: '  ' }, { t: 'keyword', s: 'const' }, { t: 'text', s: ' findings = ' }, { t: 'keyword', s: 'await' }, { t: 'text', s: ' hunt(' }, { t: 'string', s: "'https://target.test'" }, { t: 'text', s: ');' }],
  [{ t: 'text', s: '  ' }, { t: 'comment', s: '// severity is remapped per theme' }],
  [{ t: 'text', s: '  ' }, { t: 'keyword', s: 'return' }, { t: 'text', s: ' findings.filter(f => f.score >= ' }, { t: 'number', s: '7.0' }, { t: 'text', s: ');' }],
  [{ t: 'text', s: '}' }],
];

export function ThemedCodeBlock() {
  const { theme } = useTheme();
  const syn = syntaxColorsForTheme(theme);
  return (
    <div className="th-codeblock" role="figure" aria-label="Code block with per-theme syntax colors">
      <div className="th-codeblock-head">
        <span>scan.js</span>
        <span className="th-codeblock-theme">{THEMES[theme].label} syntax</span>
      </div>
      <pre style={{ background: syn.bg, color: syn.text }}>
        <code>
          {SAMPLE_TOKENS.map((line, i) => (
            <span key={i} className="th-code-line">
              <span className="th-lineno" style={{ color: syn.lineNumber }} aria-hidden="true">{i + 1}</span>
              {line.map((tok, j) => (
                <span key={j} style={{ color: syn[tok.t] || syn.text }}>{tok.s}</span>
              ))}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ThemedChart (50669)                                                 */
/* ------------------------------------------------------------------ */

const CHART_DATA = [
  { label: 'Recon', value: 82 },
  { label: 'Scan', value: 64 },
  { label: 'PoC', value: 45 },
  { label: 'Report', value: 28 },
];

export function ThemedChart() {
  const { theme } = useTheme();
  const palette = chartPaletteForTheme(theme);
  const max = Math.max(...CHART_DATA.map((d) => d.value));
  return (
    <div className="th-chart" role="img" aria-label="Hunt phase coverage bar chart">
      {CHART_DATA.map((d, i) => (
        <div key={d.label} className="th-chart-row">
          <span className="th-chart-label">{d.label}</span>
          <div className="th-chart-track">
            <div
              className="th-chart-bar"
              style={{ width: `${(d.value / max) * 100}%`, background: palette[i % palette.length] }}
            />
          </div>
          <span className="th-chart-value">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ThemedEmailPreview (50673)                                          */
/* ------------------------------------------------------------------ */

export function ThemedEmailPreview() {
  const [themeId, setThemeId] = useState('dark');
  const html = useMemo(
    () =>
      themedEmailHtml({
        themeId,
        title: 'Hunt #4821 finished — 3 findings need review',
        preheader: '2 critical, 1 high. PoCs attached in the full report.',
        rows: [
          { label: 'Target', value: 'target.test' },
          { label: 'Critical', value: '2', tone: 'critical' },
          { label: 'High', value: '1', tone: 'high' },
          { label: 'Duration', value: '14m 22s' },
        ],
        cta: { label: 'Open hunt', url: 'https://example.invalid/hunts/4821' },
      }),
    [themeId]
  );
  return (
    <div className="th-email">
      <div className="th-email-row">
        <label>
          Recipient theme
          <select value={themeId} onChange={(e) => setThemeId(e.target.value)} aria-label="Recipient theme">
            {THEME_IDS.map((id) => (
              <option key={id} value={id}>{THEMES[id].label}</option>
            ))}
          </select>
        </label>
        <span className="th-note">Generated by <code>themedEmailHtml()</code> — inline styles only, email-client safe.</span>
      </div>
      <iframe title="Themed email preview" srcDoc={html} className="th-email-frame" sandbox="" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                             */
/* ------------------------------------------------------------------ */

function Demo({ id, title, children }) {
  return (
    <section className="th-demo" aria-label={`${id}: ${title}`}>
      <h3>
        <span className="th-demo-id">{id}</span> {title}
      </h3>
      {children}
    </section>
  );
}

export function ThemeSuiteGallery() {
  return (
    <ThemeProvider>
      <div className="th-gallery">
        <div className="th-gallery-head">
          <h2>Theming suite (50660–50680)</h2>
          <p className="th-note">
            Four first-class themes with full palettes. Everything below recolors live — pick a theme
            above and watch the whole page follow. Present only as Infinity AI.
          </p>
        </div>
        <Demo id="50660/50666" title="Three core themes + high contrast"><ThemePicker /></Demo>
        <Demo id="50661" title="OS preference + manual override">
          <p className="th-note">The “System” card follows <code>prefers-color-scheme</code>; any manual pick persists and wins.</p>
        </Demo>
        <Demo id="50675" title="Accent-color picker"><AccentPicker /></Demo>
        <Demo id="50665" title="Theme preview thumbnails">
          <div className="th-preview-grid">
            {THEME_IDS.map((id) => (
              <ThemePreviewThumbnail key={id} themeId={id} />
            ))}
          </div>
        </Demo>
        <Demo id="50664" title="Per-theme severity mapping + contrast readout"><ContrastReadout /></Demo>
        <Demo id="50667" title="Dim intermediate theme"><DimThemeToggle /></Demo>
        <Demo id="50668/50678" title="Matched syntax themes + 4.5:1 line numbers"><ThemedCodeBlock /></Demo>
        <Demo id="50669" title="Theme-aware chart palette"><ThemedChart /></Demo>
        <Demo id="50679" title="Themed skeleton shimmer"><ThemedSkeleton lines={4} /></Demo>
        <Demo id="50676" title="Themed logo variants"><ThemedLogo /></Demo>
        <Demo id="50662" title="Sunset auto-switch"><SunsetScheduler /></Demo>
        <Demo id="50663" title="Per-page theme memory"><PerPageThemeMemory /></Demo>
        <Demo id="50673" title="Themed email templates"><ThemedEmailPreview /></Demo>
        <Demo id="50670/50680" title="Flash-free cross-fade + adaptive focus ring">
          <p className="th-note">
            Switching themes cross-fades over 250ms (disabled under <code>prefers-reduced-motion</code>).
            Focus ring: <span className="th-focus-word">cyan on dark</span>, deep blue on light, yellow on high-contrast —
            tab to the button to see it. <button type="button" className="th-btn">Focusable</button>
          </p>
        </Demo>
        <Demo id="50671" title="Themed favicon + theme-color meta">
          <p className="th-note">Watch the browser tab: the favicon and <code>theme-color</code> meta update with each theme.</p>
        </Demo>
        <Demo id="50672" title="Light print default">
          <PrintThemeSetting />
        </Demo>
        <Demo id="50674/50677" title="High-contrast forced styles">
          <p className="th-note">
            Pick <strong>High contrast</strong> above: links underline, cards get 2px borders, transparency
            drops to zero, focus rings go thick yellow.
          </p>
        </Demo>
        <Demo id="cycle" title="Theme cycle hint"><ThemeCycleHint /></Demo>
        <Demo id="export" title="Theme JSON export / import"><ThemeJSONExportImport /></Demo>
      </div>
    </ThemeProvider>
  );
}

function PrintThemeSetting() {
  const { printTheme, setPrintTheme } = useTheme();
  return (
    <label className="th-switch">
      <input
        type="checkbox"
        checked={printTheme === 'light'}
        onChange={(e) => setPrintTheme(e.target.checked ? 'light' : 'follow')}
      />
      <span>Print always uses the light palette {printTheme === 'light' ? '(on)' : '(following screen theme)'}</span>
    </label>
  );
}

export default ThemeSuiteGallery;
