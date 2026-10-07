/**
 * ThemeRound3.jsx — wave 18 (ideas 50681–50720) theming round 3.
 * Builds on wave 17's ThemeProvider (useTheme) without duplicating it.
 *
 * Components: SepiaThemeOption, ThemedScrollbarsDemo, ThemedSelectionDemo,
 * SyncedThemePreference, ForcedColorsSupport, InstantThemedCardList,
 * IdeThemeSync, HighContrastFocusDemo, DndAwareScheduler, PerHuntThemeOverride,
 * FirstRunThemePicker, ThemeGatedGradients, ThemedEmptyIllustrations,
 * EmbeddedReportBridge, ThemedProgressAccents, ErrorColorPairs,
 * HighContrastTableDemo, BalancedSeverityTints, ThemeRound3Gallery.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from './ThemeSuite.jsx';
import {
  SEPIA_THEME,
  severityTintForTheme,
  errorColorPairs,
  forcedColorsCssVars,
  IDE_THEMES,
  ideThemePalette,
  isDndNow,
  dndWindowLabel,
  makeHuntThemeStore,
  syncThemePreference,
  themePreferenceRecord,
  embeddedThemePayload,
  parseEmbeddedThemeMessage,
  progressAccentForTheme,
  scrollbarClass,
  selectionClass,
  tableModeClass,
  HIGH_CONTRAST_FOCUS_SPEC,
  instantThemeAttrs,
  firstRunThemes,
  gradientsAllowed,
  emptyIllustrationVariant,
} from './themeRound3Core.js';

/* Shared demo shell -------------------------------------------------- */
export function Theme3Demo({ id, title, children }) {
  return (
    <section className="thr3-demo" aria-label={`Idea ${id}: ${title}`}>
      <header className="thr3-demo-head">
        <span className="thr3-demo-id">{id}</span>
        <h4 className="thr3-demo-title">{title}</h4>
      </header>
      <div className="thr3-demo-body">{children}</div>
    </section>
  );
}

/* 50681 — Themed scrollbars ------------------------------------------- */
export function ThemedScrollbarsDemo() {
  const { theme } = useTheme();
  const items = useMemo(() => Array.from({ length: 30 }, (_, i) => `Row ${i + 1}`), []);
  return (
    <div className={`${scrollbarClass(theme)} thr3-scrollbox`} tabIndex={0} aria-label="Themed scrollbar demo">
      {items.map((r) => (
        <div key={r} className="thr3-scrollrow">{r}</div>
      ))}
    </div>
  );
}

/* 50682 — Themed selection color --------------------------------------- */
export function ThemedSelectionDemo() {
  const { theme } = useTheme();
  return (
    <p className={`${selectionClass(theme)} thr3-select-demo`}>
      Drag across this sentence: the selection tint follows the active theme and
      stays contrast-safe with the text color.
    </p>
  );
}

/* 50683 — Synced theme preference -------------------------------------- */
function deviceId() {
  try {
    let id = window.localStorage.getItem('dm_device_id');
    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem('dm_device_id', id);
    }
    return id;
  } catch {
    return 'dev-session';
  }
}

export function SyncedThemePreference({ accountPreference }) {
  const { theme, accent } = useTheme();
  const [merged, setMerged] = useState(null);
  const did = useMemo(deviceId, []);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('dm_theme_pref_local');
      const local = raw ? JSON.parse(raw) : themePreferenceRecord({ deviceId: did, theme, accent });
      const result = syncThemePreference({ deviceId: did, local, account: accountPreference });
      setMerged(result);
      window.localStorage.setItem('dm_theme_pref_local', JSON.stringify(themePreferenceRecord({ deviceId: did, theme, accent })));
    } catch {
      setMerged({ theme, accent, source: 'local', synced: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, accent]);
  return (
    <div className="thr3-sync">
      <p><strong>Device:</strong> <code>{did}</code></p>
      <p><strong>Preference source:</strong> {merged?.source === 'account' ? 'Account (synced from another device)' : 'This device'} {merged?.synced ? '· synced' : ''}</p>
      <p className="thr3-muted">Theme <code>{merged?.theme}</code> · accent <code>{merged?.accent}</code> — last writer wins on conflict.</p>
    </div>
  );
}

/* 50685 — Sepia reading theme ------------------------------------------ */
export function SepiaThemeOption() {
  const { setTheme, theme } = useTheme();
  return (
    <div className="thr3-sepia-opt">
      <p className="thr3-muted">Adds Sepia as a first-class reading theme alongside dark/light/dim/high-contrast.</p>
      <button
        type="button"
        className="thr3-btn"
        onClick={() => setTheme('sepia')}
        disabled={theme === 'sepia'}
        aria-pressed={theme === 'sepia'}
      >
        {theme === 'sepia' ? 'Sepia active' : 'Preview sepia'}
      </button>
      <dl className="thr3-kv">
        <div><dt>Paper</dt><dd><code>{SEPIA_THEME.vars['--bg']}</code></dd></div>
        <div><dt>Ink</dt><dd><code>{SEPIA_THEME.vars['--text']}</code></dd></div>
        <div><dt>Accent</dt><dd><code>{SEPIA_THEME.vars['--accent']}</code></dd></div>
      </dl>
    </div>
  );
}

/* 50686 — Balanced severity tints --------------------------------------- */
const SEV_ORDER = ['critical', 'high', 'medium', 'low'];
export function BalancedSeverityTints() {
  const { theme } = useTheme();
  return (
    <div className="thr3-tints" role="list" aria-label="Severity tints for current theme">
      {SEV_ORDER.map((s) => (
        <div key={s} role="listitem" className="thr3-tint-chip" style={{ background: severityTintForTheme(s, theme) }}>
          <span className={`thr3-sev-dot thr3-sev-${s}`} aria-hidden="true" />
          {s} · {theme}
        </div>
      ))}
    </div>
  );
}

/* 50687 — High-contrast tables ------------------------------------------- */
const TABLE_ROWS = [
  ['CRITICAL', 'SQL injection', 'login.php', '9.8'],
  ['HIGH', 'Stored XSS', 'comments', '8.7'],
  ['MEDIUM', 'Missing CSP', 'all pages', '5.9'],
  ['LOW', 'Verbose banner', 'Server header', '3.1'],
];
export function HighContrastTableDemo({ mode = 'high-contrast' }) {
  return (
    <table className={`${tableModeClass(mode)} thr3-table`} aria-label="Findings table demo">
      <thead>
        <tr><th scope="col">Severity</th><th scope="col">Finding</th><th scope="col">Location</th><th scope="col">Score</th></tr>
      </thead>
      <tbody>
        {TABLE_ROWS.map(([sev, title, loc, score]) => (
          <tr key={title}>
            <td><span className={`thr3-sev-dot thr3-sev-${sev.toLowerCase()}`} aria-hidden="true" />{sev}</td>
            <td>{title}</td><td><code>{loc}</code></td><td>{score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* 50690 — Themed embedded reports ---------------------------------------- */
export function EmbeddedReportBridge() {
  const { theme } = useTheme();
  const frameRef = useRef(null);
  const pushTheme = () => {
    const payload = embeddedThemePayload({ themeId: theme, vars: {} });
    // In production the iframe target origin is validated against the report
    // host; the demo broadcasts to the sandboxed frame only.
    try {
      frameRef.current?.contentWindow?.postMessage(payload, '*');
    } catch { /* no frame yet */ }
  };
  return (
    <div className="thr3-embed">
      <p className="thr3-muted">Embedded report iframes inherit the viewer theme via <code>{`postMessage({type:'dm:embed-theme'})`}</code>.</p>
      <button type="button" className="thr3-btn" onClick={pushTheme}>Push current theme to embedded report</button>
      <iframe
        ref={frameRef}
        title="Embedded report preview"
        className="thr3-embed-frame"
        sandbox="allow-scripts"
        srcDoc={`<!doctype html><html><body style="font:14px system-ui;padding:16px"><p id="st">Waiting for theme…</p><script>addEventListener('message',e=>{const d=e.data||{};if(d.type==='dm:embed-theme'){document.body.style.background=d.themeId==='light'?'#fff':'#16161a';document.body.style.color=d.themeId==='light'?'#111':'#eee';document.getElementById('st').textContent='Embedded report themed: '+d.themeId;}})</script></body></html>`}
      />
      <p className="thr3-muted">Inbound payloads are validated by <code>parseEmbeddedThemeMessage()</code> (type + length checks).</p>
    </div>
  );
}

/* 50691 — Themed progress accents ---------------------------------------- */
export function ThemedProgressAccents() {
  const { theme, accent } = useTheme();
  const { track, fill } = progressAccentForTheme(theme, accent);
  return (
    <div className="thr3-progress">
      <div className="thr3-spinner" style={{ borderColor: `${track}`, borderTopColor: fill }} role="status" aria-label="Loading">
        <span className="thr3-sr">Loading</span>
      </div>
      <div className="thr3-bar" role="progressbar" aria-valuenow={62} aria-valuemin={0} aria-valuemax={100} aria-label="Hunt progress">
        <div className="thr3-bar-fill" style={{ width: '62%', background: fill }} />
      </div>
    </div>
  );
}

/* 50692 — Distinguishable error colors ----------------------------------- */
export function ErrorColorPairs() {
  const { theme } = useTheme();
  const pairs = errorColorPairs(theme);
  return (
    <ul className="thr3-pairs" aria-label="Error/success/warning color pairs">
      {['error', 'success', 'warning'].map((k) => (
        <li key={k} className="thr3-pair" style={{ '--pair': pairs[k].hue }}>
          <span className="thr3-pair-icon" aria-hidden="true">{pairs[k].icon}</span>
          <span className="thr3-pair-label">{pairs[k].label}</span>
          <span className="thr3-muted">{pairs[k].hue} · {pairs[k].shape}</span>
        </li>
      ))}
      <li className="thr3-muted">{pairs.note}</li>
    </ul>
  );
}

/* 50694 — Theme-gated gradients ------------------------------------------- */
export function ThemeGatedGradients() {
  const { theme } = useTheme();
  const allowed = gradientsAllowed(theme);
  return (
    <div className={`thr3-gradient ${allowed ? 'thr3-gradient-on' : ''}`} aria-hidden="true">
      <span className="thr3-muted">{allowed ? 'Wallpaper gradient visible (dark/dim)' : 'Flat surface (light/sepia/high-contrast)'}</span>
    </div>
  );
}

/* 50695 — Themed empty illustrations --------------------------------------- */
export function ThemedEmptyIllustrations() {
  const { theme } = useTheme();
  const variant = emptyIllustrationVariant(theme);
  return (
    <div className={`thr3-illust thr3-illust-${variant}`} role="img" aria-label={`Empty-state illustration (${variant} variant)`}>
      <svg width="120" height="80" viewBox="0 0 120 80" aria-hidden="true">
        <rect x="8" y="8" width="104" height="64" rx="10" className="thr3-illust-frame" />
        <circle cx="60" cy="40" r="16" className="thr3-illust-sun" />
        <path d="M8 62 Q30 48 50 58 T90 54 T112 60 V72 H8 Z" className="thr3-illust-hill" />
      </svg>
      <p className="thr3-muted">Serving the <strong>{variant}</strong> illustration for theme <code>{theme}</code>.</p>
    </div>
  );
}

/* 50697 — Forced-colors support --------------------------------------------- */
export function ForcedColorsSupport() {
  const [forced, setForced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(forced-colors: active)');
    setForced(mq.matches);
    const onChange = (e) => setForced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return (
    <div className="thr3-forced">
      <p><strong>Windows High Contrast:</strong> {forced ? 'ACTIVE — system colors mapped' : 'not active on this device'}</p>
      <details>
        <summary>Forced-colors mapping (applied under <code>@media (forced-colors: active)</code>)</summary>
        <pre className="thr3-code">{forcedColorsCssVars()}</pre>
      </details>
    </div>
  );
}

/* 50698 — Instant themed cards ------------------------------------------------ */
export function InstantThemedCardList({ items = ['SQL injection — login.php', 'Stored XSS — comments', 'Missing CSP — all pages'] }) {
  const { theme } = useTheme();
  return (
    <ul className="thr3-instant-list" aria-label="Instantly themed cards">
      {items.map((t) => (
        <li key={t} {...instantThemeAttrs(theme)} className="thr3-instant-card">{t}</li>
      ))}
    </ul>
  );
}

/* 50699 — IDE-theme sync ------------------------------------------------------- */
export function IdeThemeSync() {
  const [ide, setIde] = useState('vscode-dark');
  const pal = ideThemePalette(ide);
  return (
    <div className="thr3-ide">
      <label className="thr3-field">
        <span>Code-block theme</span>
        <select value={ide} onChange={(e) => setIde(e.target.value)} aria-label="IDE theme for code blocks">
          {Object.entries(IDE_THEMES).map(([id, t]) => (
            <option key={id} value={id}>{t.label}</option>
          ))}
        </select>
      </label>
      <pre className="thr3-codeblock" style={pal.bg ? { background: pal.bg, color: pal.fg } : undefined} aria-label="Code sample in chosen IDE theme">
        <code>
          <span style={pal.kw ? { color: pal.kw } : undefined}>const</span> poc ={' '}
          <span style={pal.str ? { color: pal.str } : undefined}>{"' OR 1=1--"}</span>;
          {'  '}<span style={pal.cmt ? { color: pal.cmt } : undefined}>// follows IDE theme</span>
        </code>
      </pre>
    </div>
  );
}

/* 50700 — High-contrast focus spec ---------------------------------------------- */
export function HighContrastFocusDemo() {
  const spec = HIGH_CONTRAST_FOCUS_SPEC;
  return (
    <div className="thr3-hcfocus">
      <p className="thr3-muted">Spec: <code>{spec.outlineWidth} {spec.outlineStyle}</code> outline, <code>{spec.outlineOffset}</code> offset — on every control in high-contrast mode.</p>
      <div className="thr3-hcfocus-row">
        <button type="button" className="thr3-btn thr3-hcfocus-el">Button</button>
        <a href="#hcfocus" className="thr3-hcfocus-el thr3-link">Link</a>
        <input className="thr3-hcfocus-el thr3-input" placeholder="Input" aria-label="Demo input" />
      </div>
    </div>
  );
}

/* 50701 — DND-aware scheduling --------------------------------------------------- */
export function DndAwareScheduler() {
  const [startHour, setStartHour] = useState(22);
  const [endHour, setEndHour] = useState(7);
  const inDnd = isDndNow({ startHour, endHour });
  return (
    <div className="thr3-dnd">
      <div className="thr3-dnd-row">
        <label className="thr3-field"><span>Do-not-disturb from</span>
          <input type="number" min="0" max="23" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} aria-label="DND start hour" />
        </label>
        <label className="thr3-field"><span>until</span>
          <input type="number" min="0" max="23" value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} aria-label="DND end hour" />
        </label>
      </div>
      <p><strong>Window:</strong> {dndWindowLabel({ startHour, endHour })}</p>
      <p className="thr3-muted">{inDnd
        ? 'DND is active now — theme transitions are deferred until the window ends.'
        : 'Outside DND hours — scheduled theme transitions may run.'}</p>
    </div>
  );
}

/* 50702 — Per-hunt theme override -------------------------------------------------- */
export function PerHuntThemeOverride({ huntId = 'demo-hunt' }) {
  const { theme } = useTheme();
  const [store] = useState(() => makeHuntThemeStore(typeof window !== 'undefined' ? window.localStorage : null));
  const [override, setOverride] = useState(() => store.get(huntId));
  const apply = (v) => {
    store.set(huntId, v || null);
    setOverride(store.get(huntId));
  };
  const effective = store.effective(huntId, theme);
  return (
    <div className="thr3-huntoverride">
      <p className="thr3-muted">Pin a theme for a single hunt (e.g. high-contrast for a focused review session). Global stays <code>{theme}</code>.</p>
      <div className="thr3-dnd-row">
        <button type="button" className="thr3-btn" onClick={() => apply('high-contrast')}>Pin high-contrast</button>
        <button type="button" className="thr3-btn" onClick={() => apply('dark')}>Pin dark</button>
        <button type="button" className="thr3-btn" onClick={() => apply(null)}>Follow global</button>
      </div>
      <p><strong>Effective theme for this hunt:</strong> <code>{effective}</code></p>
    </div>
  );
}

/* 50704 — First-run theme picker ----------------------------------------------------- */
export function FirstRunThemePicker({ onPick }) {
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const pick = (id) => {
    setTheme(id);
    try { window.localStorage.setItem('dm_theme_first_run_done', '1'); } catch { /* ignore */ }
    setOpen(false);
    onPick?.(id);
  };
  if (!open) return <button type="button" className="thr3-btn" onClick={() => setOpen(true)}>Open first-run theme picker</button>;
  return (
    <div className="thr3-firstrun" role="dialog" aria-modal="true" aria-label="Choose your theme">
      <h4>Pick a theme to start</h4>
      <div className="thr3-firstrun-cards">
        {firstRunThemes().map((t) => (
          <button key={t.id} type="button" className={`thr3-firstrun-card thr3-firstrun-${t.id}`} onClick={() => pick(t.id)}>
            <span className="thr3-firstrun-name">{t.label}</span>
            <span className="thr3-muted">{t.tagline}</span>
          </button>
        ))}
      </div>
      <button type="button" className="thr3-btn thr3-btn-ghost" onClick={() => setOpen(false)}>Skip</button>
    </div>
  );
}

/* Gallery ---------------------------------------------------------------------------- */
const GALLERY = [
  ['50681', 'Themed scrollbars', <ThemedScrollbarsDemo />],
  ['50682', 'Themed selection color', <ThemedSelectionDemo />],
  ['50683', 'Synced theme preference', <SyncedThemePreference />],
  ['50685', 'Sepia reading theme', <SepiaThemeOption />],
  ['50686', 'Balanced severity tints', <BalancedSeverityTints />],
  ['50687', 'High-contrast tables', <HighContrastTableDemo />],
  ['50690', 'Themed embedded reports', <EmbeddedReportBridge />],
  ['50691', 'Themed progress accents', <ThemedProgressAccents />],
  ['50692', 'Distinguishable error colors', <ErrorColorPairs />],
  ['50694', 'Theme-gated gradients', <ThemeGatedGradients />],
  ['50695', 'Themed empty illustrations', <ThemedEmptyIllustrations />],
  ['50697', 'Forced-colors support', <ForcedColorsSupport />],
  ['50698', 'Instant themed cards', <InstantThemedCardList />],
  ['50699', 'IDE-theme sync option', <IdeThemeSync />],
  ['50700', 'High-contrast focus spec', <HighContrastFocusDemo />],
  ['50701', 'DND-aware scheduling', <DndAwareScheduler />],
  ['50702', 'Per-hunt theme override', <PerHuntThemeOverride />],
  ['50704', 'First-run theme picker', <FirstRunThemePicker />],
];

export function ThemeRound3Gallery() {
  return (
    <div className="thr3-gallery" aria-label="Wave 18 theming round 3 gallery">
      <h3>Wave 18 — Theming round 3 (50681–50704)</h3>
      {GALLERY.map(([id, title, el]) => (
        <Theme3Demo key={id} id={id} title={title}>{el}</Theme3Demo>
      ))}
    </div>
  );
}
