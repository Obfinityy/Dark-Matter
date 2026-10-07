/**
 * OptimisticSuite.jsx — wave 24 (ideas 50930–50960): optimistic / performance
 * UI suite.
 *
 * One working React component per idea. Pure logic lives in optimisticCore.js;
 * this file renders it. All optimistic updates render instantly and confirm
 * asynchronously, with rollback paths where the core supports them.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import './OptimisticSuite.css';
import {
  ACK_BUDGET_MS,
  ackWithinBudget,
  applyOptimistic,
  optimisticStatusChange,
  instantHuntRow,
  optimisticCommentDraft,
  markCommentSent,
  instantCachedFilter,
  loaderKind,
  SKELETON_THRESHOLD_MS,
  shouldPrefetch,
  SEARCH_DEBOUNCE_MS,
  debounce,
  virtualWindow,
  evidenceImageSrc,
  progressivePreview,
  toggleBookmark,
  routeChunkName,
  createSnapshotStore,
  swrWidgetState,
  reorderList,
  THEME_SWITCH_DELAY_MS,
  shouldPrefetchPdf,
  optimisticBulkReview,
  clientSort,
  dedupeBatch,
  flipPauseResume,
  priorityOrder,
  canIdlePreload,
  dismissNotification,
  buildSearchIndex,
  appendStepLog,
  dismissFindingAsFp,
  DEFERRED_MODULES,
  coreInteractiveReady,
  OPT_SKELETON_CLASS,
  OPT_SHIMMER_CLASS,
  OPT_PENDING_CLASS,
  OPT_UNDO_CLASS,
} from './optimisticCore.js';

/* Shared static data ------------------------------------------------------ */

const SEV_FINDINGS = [
  { id: 'F-1', title: 'SQL injection in /search', severity: 'Critical' },
  { id: 'F-2', title: 'Stored XSS in comments', severity: 'Critical' },
  { id: 'F-3', title: 'IDOR on /orders', severity: 'High' },
  { id: 'F-4', title: 'Open redirect on /go', severity: 'Medium' },
  { id: 'F-5', title: 'Verbose error on /login', severity: 'Medium' },
  { id: 'F-6', title: 'Missing CSP header', severity: 'Low' },
];

const SEARCH_ITEMS = [
  'Cross-site scripting', 'SQL injection', 'Insecure direct object reference',
  'Server-side request forgery', 'Command injection', 'Open redirect',
  'Path traversal', 'XML external entity',
];

const VIRT_ROWS = Array.from({ length: 5000 }, (_, i) => ({
  id: `F-${i + 1}`,
  sev: ['Critical', 'High', 'Medium', 'Low'][i % 4],
}));

const VIRT_EVENTS = Array.from({ length: 2000 }, (_, i) => ({
  id: `evt-${i + 1}`,
  label: `Step ${i + 1} — ${['recon', 'scan', 'score', 'report'][i % 4]}`,
}));

const EVIDENCE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#1c2430"/><text x="16" y="96" fill="#8fa3bf" font-size="14">Evidence preview loads on scroll…</text></svg>'
  );

const REPORT_PAGES = [
  'Executive summary',
  'Scope & methodology',
  'Findings detail',
  'Risk ratings',
  'Remediation appendix',
];

const BOOKMARK_ITEMS = [
  { id: 'F-1', title: 'SQLi in /search' },
  { id: 'F-2', title: 'Stored XSS in comments' },
  { id: 'F-3', title: 'IDOR on /orders' },
];

const ROUTES = ['/', '/dashboard', '/hunts', '/hunts/:id', '/models', '/reports'];

const WIDGETS = ['Findings feed', 'Risk chart', 'Recent hunts', 'Top severities'];

const BULK_ITEMS = [
  { id: 'F-21', title: 'Open redirect on /go', status: 'open' },
  { id: 'F-22', title: 'Verbose error on /login', status: 'open' },
  { id: 'F-23', title: 'Missing CSP header', status: 'open' },
];

const NOTIFS = [
  { id: 'n1', text: 'Hunt #482 finished — 14 findings' },
  { id: 'n2', text: 'Critical: SQLi confirmed on /search' },
  { id: 'n3', text: 'Report PDF ready for download' },
];

const TABLE_ROWS = [
  { id: 'F-1', title: 'Stored XSS', severity: 'High', score: 8.2 },
  { id: 'F-2', title: 'SQLi', severity: 'Critical', score: 9.4 },
  { id: 'F-3', title: 'Open redirect', severity: 'Low', score: 3.1 },
  { id: 'F-4', title: 'IDOR', severity: 'Medium', score: 6.0 },
];

const DOCS = [
  { title: 'Cross-site scripting in search', tag: 'xss' },
  { title: 'SQL injection in login form', tag: 'sqli' },
  { title: 'Insecure direct object reference on orders', tag: 'idor' },
  { title: 'Server-side request forgery in webhook', tag: 'ssrf' },
  { title: 'Stored cross-site scripting in comments', tag: 'xss' },
];

const STEP_EVENTS = [
  'Resolving target', 'Fingerprinting tech stack', 'Mining parameters',
  'Scanning responses', 'Scoring risk', 'Filtering false positives', 'Writing report',
];

const FP_CARDS = [
  { id: 'F-31', title: 'Possible XSS in /about (unconfirmed)' },
  { id: 'F-32', title: 'Possible SQLi in /legacy (needs PoC)' },
];

/* 50930 — OptimisticStatusToggle ------------------------------------------ */

const STATUSES = ['open', 'triaged', 'resolved'];

/** Status pill flips instantly; a "syncing" badge shows until commit resolves. */
export function OptimisticStatusToggle({ onCommit }) {
  const [finding, setFinding] = useState({ id: 'F-101', title: 'SQLi in /search', status: 'open' });
  const commit = onCommit || (() => new Promise((res) => setTimeout(res, 400)));

  async function flip(next) {
    const { optimistic, rollback } = optimisticStatusChange(finding, next);
    setFinding(optimistic); // Instant: pill flips before the server answers.
    const result = await applyOptimistic({ current: rollback, next: optimistic, commit });
    setFinding({ ...result.state, _optimistic: false });
  }

  return (
    <div className="opt-demo" data-idea="50930">
      <span className="opt-pill">{finding.status}</span>
      {finding._optimistic ? <span className={`opt-badge ${OPT_PENDING_CLASS}`}>syncing</span> : null}
      <div className="opt-row">
        {STATUSES.filter((s) => s !== finding.status).map((s) => (
          <button key={s} type="button" className="opt-btn" onClick={() => flip(s)}>
            Mark {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* 50931 — InstantHuntCreator ---------------------------------------------- */

/** The hunt row appears in history before the create API responds. */
export function InstantHuntCreator() {
  const [name, setName] = useState('');
  const [hunts, setHunts] = useState([]);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function create() {
    if (!name.trim()) return;
    const row = instantHuntRow(name);
    setHunts((h) => [row, ...h]);
    setName('');
    timers.current.push(
      setTimeout(() => {
        setHunts((h) => h.map((x) => (x.id === row.id ? { ...x, status: 'live', _optimistic: false } : x)));
      }, 600)
    );
  }

  return (
    <div className="opt-demo" data-idea="50931">
      <div className="opt-row">
        <input
          className="opt-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Hunt name"
          aria-label="Hunt name"
        />
        <button type="button" className="opt-btn" onClick={create} disabled={!name.trim()}>
          Create
        </button>
      </div>
      <ul className="opt-list">
        {hunts.map((h) => (
          <li key={h.id}>
            <code>{h.id}</code> {h.name}
            <span className="opt-chip">{h.status === 'creating' ? 'creating…' : 'live'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 50932 — OptimisticCommentBox -------------------------------------------- */

/** Posted comment renders instantly with a "sending" tick, then "sent". */
export function OptimisticCommentBox() {
  const [body, setBody] = useState('');
  const [comments, setComments] = useState([]);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function post() {
    if (!body.trim()) return;
    const draft = optimisticCommentDraft(body);
    setComments((c) => [...c, draft]);
    setBody('');
    timers.current.push(
      setTimeout(() => {
        setComments((c) => c.map((x) => (x.id === draft.id ? markCommentSent(x) : x)));
      }, 500)
    );
  }

  return (
    <div className="opt-demo" data-idea="50932">
      <div className="opt-row">
        <input
          className="opt-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          aria-label="Comment text"
        />
        <button type="button" className="opt-btn" onClick={post} disabled={!body.trim()}>
          Post
        </button>
      </div>
      <ul className="opt-list">
        {comments.map((c) => (
          <li key={c.id}>
            {c.body}
            <span className="opt-chip">{c.delivery === 'sending' ? 'sending…' : 'sent'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 50933 — InstantCachedFilter --------------------------------------------- */

/** Severity filter applies to cached findings instantly — no round-trip. */
export function InstantCachedFilter() {
  const [sev, setSev] = useState('All');
  const shown = instantCachedFilter(SEV_FINDINGS, (f) => sev === 'All' || f.severity === sev);

  return (
    <div className="opt-demo" data-idea="50933">
      <div className="opt-row" role="group" aria-label="Severity filter">
        {['All', 'Critical', 'High', 'Medium', 'Low'].map((s) => (
          <button
            key={s}
            type="button"
            className={`opt-btn${sev === s ? ' opt-btn-active' : ''}`}
            onClick={() => setSev(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="opt-note">{shown.length} of {SEV_FINDINGS.length} findings (filtered locally, instantly)</p>
      <ul className="opt-list">
        {shown.map((f) => (
          <li key={f.id}>
            <code>{f.id}</code> {f.title} <span className="opt-chip">{f.severity}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 50934 — SkeletonFirstDemo ----------------------------------------------- */

/** Expected-slow loads render skeletons immediately instead of a spinner. */
export function SkeletonFirstDemo({ expectedMs = 1200 }) {
  const [phase, setPhase] = useState('idle'); // idle | loading | done
  const kind = loaderKind(expectedMs);

  function start() {
    setPhase('loading');
    setTimeout(() => setPhase('done'), expectedMs);
  }

  return (
    <div className="opt-demo" data-idea="50934">
      <button type="button" className="opt-btn" onClick={start} disabled={phase === 'loading'}>
        {phase === 'idle' ? `Start load (${expectedMs}ms)` : 'Reload'}
      </button>
      {phase === 'loading' && kind === 'skeleton' ? (
        <div aria-label="Loading content">
          <div className={OPT_SKELETON_CLASS} style={{ height: 16 }} />
          <div className={OPT_SKELETON_CLASS} style={{ height: 16, width: '72%' }} />
          <div className={OPT_SKELETON_CLASS} style={{ height: 16, width: '55%' }} />
        </div>
      ) : null}
      {phase === 'loading' && kind === 'spinner' ? <div className="opt-spinner" role="status" aria-label="Loading" /> : null}
      {phase === 'done' ? <div className="opt-loaded">Report summary loaded.</div> : null}
      <p className="opt-note">
        loaderKind({expectedMs}) → "{kind}" (skeleton threshold {SKELETON_THRESHOLD_MS}ms)
      </p>
    </div>
  );
}

/* 50935 — HoverPrefetchCard ----------------------------------------------- */

/** Hovering 300ms+ prefetches the finding's detail view in the background. */
export function HoverPrefetchCard() {
  const [hoverMs, setHoverMs] = useState(0);
  const [prefetched, setPrefetched] = useState(false);
  const timer = useRef(null);
  const start = useRef(0);

  useEffect(() => () => clearInterval(timer.current), []);

  function onEnter() {
    start.current = Date.now();
    setPrefetched(false);
    timer.current = setInterval(() => {
      const ms = Date.now() - start.current;
      setHoverMs(ms);
      if (shouldPrefetch(ms)) {
        setPrefetched(true);
        clearInterval(timer.current);
      }
    }, 50);
  }

  function onLeave() {
    clearInterval(timer.current);
    setHoverMs(0);
    setPrefetched(false);
  }

  return (
    <div className="opt-demo" data-idea="50935">
      <div
        className="opt-hovercard"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        tabIndex={0}
        onFocus={onEnter}
        onBlur={onLeave}
      >
        F-101 — SQLi in /search
        <span className="opt-sub">hover {Math.round(hoverMs)}ms</span>
      </div>
      {prefetched ? <span className="opt-badge">detail prefetched</span> : null}
    </div>
  );
}

/* 50936 — DebouncedLocalSearch -------------------------------------------- */

/** Typing filters a cached list through a trailing-edge debounce. */
export function DebouncedLocalSearch() {
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const debounced = useMemo(() => debounce(setApplied, SEARCH_DEBOUNCE_MS), []);

  function onChange(e) {
    setQuery(e.target.value);
    debounced(e.target.value);
  }

  const hits = SEARCH_ITEMS.filter((i) => i.toLowerCase().includes(applied.toLowerCase()));

  return (
    <div className="opt-demo" data-idea="50936">
      <input
        className="opt-input"
        value={query}
        onChange={onChange}
        placeholder="Search checks…"
        aria-label="Search checks"
      />
      <p className="opt-note">
        Debounced to {SEARCH_DEBOUNCE_MS}ms — "{applied}" ({hits.length} matches). No network while typing.
      </p>
      <ul className="opt-list">
        {hits.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
    </div>
  );
}

/* 50937 — VirtualizedFindingsList ----------------------------------------- */

/** 5000 findings stay smooth — only the visible window renders. */
export function VirtualizedFindingsList() {
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 28;
  const viewport = 240;
  const w = virtualWindow({ total: VIRT_ROWS.length, rowHeight, scrollTop, viewportHeight: viewport });
  const slice = VIRT_ROWS.slice(w.start, w.end);

  return (
    <div className="opt-demo" data-idea="50937">
      <div className="opt-virt" style={{ height: viewport }} onScroll={(e) => setScrollTop(e.target.scrollTop)}>
        <div style={{ height: w.topPad }} aria-hidden="true" />
        {slice.map((r) => (
          <div key={r.id} className="opt-virt-row" style={{ height: rowHeight }}>
            <code>{r.id}</code> <span className="opt-chip">{r.sev}</span>
          </div>
        ))}
        <div style={{ height: w.bottomPad }} aria-hidden="true" />
      </div>
      <p className="opt-note">
        Rendering {slice.length} of {VIRT_ROWS.length} rows (window {w.start}–{w.end})
      </p>
    </div>
  );
}

/* 50938 — VirtualizedTimeline --------------------------------------------- */

/** 2000 hunt timeline events, same windowing technique. */
export function VirtualizedTimeline() {
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 24;
  const viewport = 200;
  const w = virtualWindow({ total: VIRT_EVENTS.length, rowHeight, scrollTop, viewportHeight: viewport });
  const slice = VIRT_EVENTS.slice(w.start, w.end);

  return (
    <div className="opt-demo" data-idea="50938">
      <div className="opt-virt" style={{ height: viewport }} onScroll={(e) => setScrollTop(e.target.scrollTop)}>
        <div style={{ height: w.topPad }} aria-hidden="true" />
        {slice.map((r) => (
          <div key={r.id} className="opt-virt-row opt-timeline-row" style={{ height: rowHeight }}>
            <span className="opt-dot" aria-hidden="true" /> {r.label}
          </div>
        ))}
        <div style={{ height: w.bottomPad }} aria-hidden="true" />
      </div>
      <p className="opt-note">
        Rendering {slice.length} of {VIRT_EVENTS.length} events
      </p>
    </div>
  );
}

/* 50939 — LazyEvidenceImage ----------------------------------------------- */

/** Evidence thumbnail loads only once it scrolls into view. */
export function LazyEvidenceImage() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setInView(true), 300);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div className="opt-demo" data-idea="50939">
      <div ref={ref} className="opt-imgwrap">
        <img
          alt="Evidence screenshot"
          width="320"
          height="180"
          src={evidenceImageSrc({
            src: 'https://placehold.co/320x180/274/fff?text=Evidence',
            placeholder: EVIDENCE_PLACEHOLDER,
            inView,
          })}
        />
      </div>
      <p className="opt-note">{inView ? 'Thumbnail loaded after entering the viewport.' : 'Waiting for viewport…'}</p>
    </div>
  );
}

/* 50940 — ProgressiveReportPreview ---------------------------------------- */

/** First report page renders immediately; the rest stream in behind it. */
export function ProgressiveReportPreview() {
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const pv = progressivePreview(REPORT_PAGES);

  function generate() {
    setStarted(true);
    setReady(false);
    setTimeout(() => setReady(true), 1500);
  }

  return (
    <div className="opt-demo" data-idea="50940">
      <button type="button" className="opt-btn" onClick={generate} disabled={started && !ready}>
        Generate report preview
      </button>
      {started ? (
        <div className="opt-report">
          <div className="opt-page">
            <strong>Page 1:</strong> {pv.firstPage}
          </div>
          {ready ? (
            REPORT_PAGES.slice(1).map((p, i) => (
              <div key={p} className="opt-page">
                <strong>Page {i + 2}:</strong> {p}
              </div>
            ))
          ) : (
            <p className="opt-note">generating remaining {pv.remaining}…</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* 50941 — OptimisticBookmarkList ------------------------------------------- */

/** Star toggles respond instantly (immutable Set state). */
export function OptimisticBookmarkList() {
  const [bookmarked, setBookmarked] = useState(new Set(['F-1']));
  return (
    <div className="opt-demo" data-idea="50941">
      {SEV_FINDINGS.map((f) => (
        <div key={f.id} className="opt-rowline">
          <button
            type="button"
            className="opt-star"
            aria-pressed={bookmarked.has(f.id)}
            aria-label={`Bookmark ${f.title}`}
            onClick={() => setBookmarked(toggleBookmark(bookmarked, f.id))}
          >
            {bookmarked.has(f.id) ? '★' : '☆'}
          </button>
          {f.title}
        </div>
      ))}
    </div>
  );
}

/* 50942 — RouteSplitPanel -------------------------------------------------- */

/** Hunt-page JS loads separately from dashboard JS (route code splitting). */
export function RouteSplitPanel() {
  const routes = ['/', '/dashboard', '/hunts', '/hunts/:id', '/models', '/reports'];
  return (
    <div className="opt-demo" data-idea="50942">
      <table className="opt-table">
        <thead>
          <tr><th>Route</th><th>JS chunk</th></tr>
        </thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r}><td><code>{r}</code></td><td><code>{routeChunkName(r)}</code></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* 50943 — CachedHuntSnapshot ------------------------------------------------ */

/** Reopening a hunt shows its last state instantly, then live-syncs. */
const snapshotStore = createSnapshotStore();

export function CachedHuntSnapshot() {
  const [view, setView] = useState(null);
  const [stale, setStale] = useState(false);
  const open = () => {
    snapshotStore.save('h1', { name: 'acme-corp', findings: 42, phase: 'scanning' });
    setView({ ...snapshotStore.get('h1').data, live: false });
    setStale(false);
    setTimeout(() => {
      setView({ name: 'acme-corp', findings: 43, phase: 'scanning', live: true });
      setStale(snapshotStore.isStale('h1'));
    }, 600);
  };
  const reopen = () => {
    const s = snapshotStore.get('h1');
    if (s) {
      setView({ ...s.data, live: false });
      setStale(snapshotStore.isStale('h1'));
    }
  };
  return (
    <div className="opt-demo" data-idea="50943">
      <div className="opt-btnrow">
        <button type="button" className="opt-btn" onClick={open}>Open hunt</button>
        <button type="button" className="opt-btn" onClick={reopen}>Reopen (cached)</button>
      </div>
      {view && (
        <p className="opt-note">
          {view.name} · {view.findings} findings · {view.phase}
          {view.live ? ' · live-synced' : ' · from snapshot'}
          {stale ? ' · stale, refreshing' : ''}
        </p>
      )}
    </div>
  );
}

/* 50944 — SwrWidget ---------------------------------------------------------- */

/** Widget shows cached data while refreshing in the background. */
export function SwrWidget() {
  const [state, setState] = useState(swrWidgetState({ data: { open: 12, critical: 3 } }));
  const refresh = () => {
    setState(swrWidgetState({ data: state.data, isRevalidating: true }));
    setTimeout(() => {
      setState(swrWidgetState({ data: { open: 11, critical: 2 }, isRevalidating: false }));
    }, 800);
  };
  return (
    <div className="opt-demo" data-idea="50944">
      <div className={`opt-widget ${state.showShimmer ? OPT_SHIMMER_CLASS : ''}`}>
        <strong>Findings overview</strong>
        <p className="opt-note">open: {state.data.open} · critical: {state.data.critical}</p>
        {state.isRevalidating && <span className="opt-updating">updating…</span>}
      </div>
      <button type="button" className="opt-btn" onClick={refresh}>Refresh</button>
    </div>
  );
}

/* 50945 — OptimisticWidgetReorder ---------------------------------------------- */

/** Dragged widgets move instantly; layout persists on drop. */
export function OptimisticWidgetReorder() {
  const [widgets, setWidgets] = useState(['Severity chart', 'Timeline', 'Top targets', 'SLA badges']);
  const move = (i, dir) => setWidgets(reorderList(widgets, i, i + dir));
  return (
    <div className="opt-demo" data-idea="50945">
      {widgets.map((w, i) => (
        <div key={w} className="opt-rowline">
          <span>{w}</span>
          <span>
            <button type="button" className="opt-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${w} up`}>↑</button>
            <button type="button" className="opt-btn" disabled={i === widgets.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${w} down`}>↓</button>
          </span>
        </div>
      ))}
      <p className="opt-note">Order updates instantly; persists on drop.</p>
    </div>
  );
}

/* 50946 — InstantThemeSwitch ---------------------------------------------------- */

/** CSS variables swap themes with no reload and no flash (0ms JS delay). */
export function InstantThemeSwitch() {
  const [dark, setDark] = useState(true);
  return (
    <div className="opt-demo" data-idea="50946">
      <div
        className="opt-themebox"
        style={dark
          ? { background: '#0d1626', color: '#dbe7f7', borderColor: '#2a3d5c' }
          : { background: '#ffffff', color: '#1a2332', borderColor: '#c9d4e4' }}
      >
        Theme swaps via CSS variables in {THEME_SWITCH_DELAY_MS}ms — no reload, no flash.
      </div>
      <button type="button" className="opt-btn" onClick={() => setDark(!dark)}>
        Switch to {dark ? 'light' : 'dark'}
      </button>
    </div>
  );
}

/* 50947 — PdfPrefetchHint --------------------------------------------------------- */

/** Opening the report tab prefetches the PDF in the background. */
export function PdfPrefetchHint() {
  const [tabOpened, setTabOpened] = useState(false);
  const [cached, setCached] = useState(false);
  const prefetch = shouldPrefetchPdf({ reportTabOpened: tabOpened, pdfCached: cached });
  return (
    <div className="opt-demo" data-idea="50947">
      <label className="opt-check">
        <input type="checkbox" checked={tabOpened} onChange={(e) => setTabOpened(e.target.checked)} />
        Report tab opened
      </label>
      <label className="opt-check">
        <input type="checkbox" checked={cached} onChange={(e) => setCached(e.target.checked)} />
        PDF cached
      </label>
      <p className="opt-note">{prefetch ? '⏬ prefetching PDF in background…' : 'no prefetch needed'}</p>
    </div>
  );
}

/* 50948 — OptimisticBulkReview ------------------------------------------------------- */

/** "Mark all reviewed" updates instantly with per-item rollback on failure. */
export function OptimisticBulkReview() {
  const [items, setItems] = useState([
    { id: 'b1', title: 'XSS on /search', status: 'new' },
    { id: 'b2', title: 'IDOR on /api/user', status: 'triaged' },
  ]);
  const [injectFailure, setInjectFailure] = useState(false);
  const [rolledBack, setRolledBack] = useState(false);
  const markAll = async () => {
    const { updated, rollback } = optimisticBulkReview(items);
    setItems(updated);
    setRolledBack(false);
    await new Promise((res) => setTimeout(res, 500));
    if (injectFailure) {
      setItems(rollback());
      setRolledBack(true);
    } else {
      setItems(updated.map(({ _optimistic, ...r }) => r));
    }
  };
  return (
    <div className="opt-demo" data-idea="50948">
      <ul className="opt-list">
        {items.map((f) => (
          <li key={f.id} className={f._optimistic ? OPT_PENDING_CLASS : ''}>
            {f.title} · {f.status}
          </li>
        ))}
      </ul>
      <div className="opt-btnrow">
        <button type="button" className="opt-btn" onClick={markAll}>Mark all reviewed</button>
      </div>
      <label className="opt-check">
        <input type="checkbox" checked={injectFailure} onChange={(e) => setInjectFailure(e.target.checked)} />
        Demo control: fail the commit (tests rollback)
      </label>
      {rolledBack && <p className="opt-note">Commit failed — rolled back to previous statuses.</p>}
    </div>
  );
}

/* 50949 — ClientFilterSortDemo ---------------------------------------------------------- */

/** Filtering and sorting run locally when the dataset is already loaded. */
export function ClientFilterSortDemo() {
  const [dir, setDir] = useState('asc');
  const [key, setKey] = useState('severityRank');
  const rows = useMemo(() => clientSort(
    SEV_FINDINGS.map((f) => ({ ...f, severityRank: { Critical: 0, High: 1, Medium: 2 }[f.severity] ?? 3 })),
    key,
    dir
  ), [key, dir]);
  const sortBy = (k) => {
    if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setKey(k);
      setDir('asc');
    }
  };
  return (
    <div className="opt-demo" data-idea="50949">
      <table className="opt-table">
        <thead>
          <tr>
            <th><button type="button" className="opt-link" onClick={() => sortBy('title')}>Title {key === 'title' ? (dir === 'asc' ? '▲' : '▼') : ''}</button></th>
            <th><button type="button" className="opt-link" onClick={() => sortBy('severityRank')}>Severity {key === 'severityRank' ? (dir === 'asc' ? '▲' : '▼') : ''}</button></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{r.title}</td><td>{r.severity}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="opt-note">Sorted client-side — no server round-trip.</p>
    </div>
  );
}

/* 50950 — AckBudgetMeter ------------------------------------------------------------------ */

/** Every interaction acknowledges within the 100ms budget. */
export function AckBudgetMeter() {
  const [lastMs, setLastMs] = useState(null);
  const click = () => {
    const t0 = Date.now();
    requestAnimationFrame(() => {
      const ms = Date.now() - t0;
      setLastMs(ms);
    });
  };
  return (
    <div className="opt-demo" data-idea="50950">
      <button type="button" className="opt-btn" onClick={click}>Click me</button>
      <p className="opt-note">
        Budget: {ACK_BUDGET_MS}ms
        {lastMs !== null && (
          <> · last acknowledgment: {lastMs}ms — {ackWithinBudget(Date.now() - lastMs) ? '✓ within budget' : '⚠ over budget'}</>
        )}
      </p>
    </div>
  );
}

/* 50951 — BatchedFetchDemo --------------------------------------------------------------- */

/** Rapid card expands batch their detail requests into a single call. */
export function BatchedFetchDemo() {
  const [expanded, setExpanded] = useState(new Set());
  const [batch, setBatch] = useState([]);
  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const expand = (id) => {
    setExpanded((s) => new Set(s).add(id));
    queueRef.current.push(id);
    queueRef.current.push(id); // duplicates happen on rapid double-expand
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setBatch(dedupeBatch(queueRef.current));
      queueRef.current = [];
    }, 250);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  return (
    <div className="opt-demo" data-idea="50951">
      <div className="opt-btnrow">
        {['c1', 'c2', 'c3'].map((id) => (
          <button key={id} type="button" className="opt-btn" onClick={() => expand(id)}>
            {expanded.has(id) ? '✓' : '+'} Expand {id}
          </button>
        ))}
      </div>
      <p className="opt-note">
        {batch.length > 0
          ? `Single batched detail request: [${batch.join(', ')}]`
          : 'Expand cards rapidly — requests batch into one call.'}
      </p>
    </div>
  );
}

/* 50952 — OptimisticPauseResume ---------------------------------------------------------------- */

/** The button flips instantly while the backend confirms asynchronously. */
export function OptimisticPauseResume({ onCommit = () => new Promise((res) => setTimeout(res, 600)) }) {
  const [status, setStatus] = useState('running');
  const [confirming, setConfirming] = useState(false);
  const toggle = async () => {
    const next = flipPauseResume(status);
    setStatus(next);
    setConfirming(true);
    await onCommit();
    setConfirming(false);
  };
  return (
    <div className="opt-demo" data-idea="50952">
      <button type="button" className="opt-btn" onClick={toggle}>
        {status === 'running' ? '⏸ Pause hunt' : '▶ Resume hunt'}
      </button>
      <p className="opt-note">status: {status}{confirming ? ' · confirming…' : ''}</p>
    </div>
  );
}

/* 50953 — SkeletonOverSpinner --------------------------------------------------------------------- */

/** Any load expected beyond 300ms shows skeletons instead of spinners. */
export function SkeletonOverSpinner() {
  return (
    <div className="opt-demo" data-idea="50953">
      <div className="opt-compare">
        <div>
          <p className="opt-note">200ms load → {loaderKind(200)}</p>
          <div className="opt-spinner" role="status">Loading…</div>
        </div>
        <div>
          <p className="opt-note">900ms load → {loaderKind(900)}</p>
          <div aria-busy="true" aria-label="Loading">
            <div className={OPT_SKELETON_CLASS} style={{ height: 14 }} />
            <div className={OPT_SKELETON_CLASS} style={{ height: 14, width: '60%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* 50954 — PriorityContentLoader ------------------------------------------------------------------------ */

/** Finding titles and severity load before evidence thumbnails. */
export function PriorityContentLoader() {
  const blocks = priorityOrder(['thumbnail', 'evidence', 'title', 'severity']);
  return (
    <div className="opt-demo" data-idea="50954">
      <ol className="opt-list">
        {blocks.map((b) => (
          <li key={b}>{b} <span className="opt-note">(priority {['title', 'severity', 'summary', 'evidence', 'thumbnail'].indexOf(b)})</span></li>
        ))}
      </ol>
    </div>
  );
}

/* 50955 — IdlePreloadIndicator ------------------------------------------------------------------------------ */

/** The next hunt preloads when the browser goes idle. */
export function IdlePreloadIndicator() {
  const [idle, setIdle] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const ok = canIdlePreload({ idle, documentHidden: hidden, saveData });
  return (
    <div className="opt-demo" data-idea="50955">
      <label className="opt-check"><input type="checkbox" checked={idle} onChange={(e) => setIdle(e.target.checked)} /> browser idle</label>
      <label className="opt-check"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> tab hidden</label>
      <label className="opt-check"><input type="checkbox" checked={saveData} onChange={(e) => setSaveData(e.target.checked)} /> metered connection</label>
      <p className="opt-note">{ok ? '⏬ preloading next hunt in history…' : 'preload paused'}</p>
    </div>
  );
}

/* 50956 — OptimisticDismissToast ------------------------------------------------------------------------------------ */

/** Notification badges decrement the instant a toast is dismissed. */
export function OptimisticDismissToast() {
  const [notes, setNotes] = useState([
    { id: 'n1', text: 'Hunt finished: acme-corp' },
    { id: 'n2', text: 'New critical finding' },
  ]);
  const [lastDismissed, setLastDismissed] = useState(null);
  const dismiss = (id) => {
    const { list, dismissed } = dismissNotification(notes, id);
    setNotes(list);
    setLastDismissed(dismissed);
  };
  const undo = () => {
    if (lastDismissed) {
      setNotes((n) => [...n, lastDismissed]);
      setLastDismissed(null);
    }
  };
  return (
    <div className="opt-demo" data-idea="50956">
      <p className="opt-note">🔔 {notes.length} notification{notes.length === 1 ? '' : 's'}</p>
      <ul className="opt-list">
        {notes.map((n) => (
          <li key={n.id} className="opt-rowline">
            {n.text}
            <button type="button" className="opt-btn" onClick={() => dismiss(n.id)}>Dismiss</button>
          </li>
        ))}
      </ul>
      {lastDismissed && (
        <div className={OPT_UNDO_CLASS}>
          Dismissed “{lastDismissed.text}”
          <button type="button" className="opt-btn" onClick={undo}>Undo</button>
        </div>
      )}
    </div>
  );
}

/* 50957 — WorkerSearchDemo -------------------------------------------------------------------------------------------- */

/** A cached index in a worker thread powers instant fuzzy search on large hunts. */
const SEARCH_DOCS = [
  { id: 'd1', title: 'Cross-site scripting in search reflections' },
  { id: 'd2', title: 'SQL injection via order-by parameter' },
  { id: 'd3', title: 'Insecure direct object reference on invoices' },
  { id: 'd4', title: 'Server-side request forgery in webhook URL' },
];

export function WorkerSearchDemo() {
  const idx = useMemo(() => buildSearchIndex(SEARCH_DOCS, (d) => d.title), []);
  const [q, setQ] = useState('');
  const hits = q ? idx.search(q, 5) : [];
  return (
    <div className="opt-demo" data-idea="50957">
      <input
        aria-label="Worker search"
        placeholder="Search findings (worker index)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="opt-list">
        {hits.map((d) => (
          <li key={d.id}>{d.title}</li>
        ))}
      </ul>
      <p className="opt-note">Index of {idx.size} docs · same scorer runs in the Web Worker.</p>
    </div>
  );
}

/* 50958 — StreamingStepLog -------------------------------------------------------------------------------------------------- */

/** Step events append incrementally instead of waiting for batches. */
const STEP_PHASES = ['recon', 'fingerprint', 'scan', 'verify', 'report'];

export function StreamingStepLog() {
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const run = () => {
    setLog([]);
    setRunning(true);
    let i = 0;
    const t = setInterval(() => {
      if (i >= STEP_PHASES.length) {
        clearInterval(t);
        setRunning(false);
        return;
      }
      const phase = STEP_PHASES[i];
      i += 1;
      setLog((l) => appendStepLog(l, { phase, detail: `${phase} complete` }));
    }, 450);
  };
  return (
    <div className="opt-demo" data-idea="50958">
      <button type="button" className="opt-btn" onClick={run} disabled={running}>
        {running ? 'Streaming…' : 'Run hunt steps'}
      </button>
      <ol className="opt-list">
        {log.map((e) => (
          <li key={e.seq}>#{e.seq} {e.phase} — {e.detail}</li>
        ))}
      </ol>
    </div>
  );
}

/* 50959 — OptimisticFpDismiss ------------------------------------------------------------------------------------------------------- */

/** Dismissed cards collapse instantly with an undo toast for recovery. */
export function OptimisticFpDismiss() {
  const [card, setCard] = useState({ id: 'fp1', title: 'Verbose error on /login' });
  const [undo, setUndo] = useState(null);
  const dismiss = () => {
    const { collapsed, undo: u } = dismissFindingAsFp(card);
    setCard(collapsed);
    setUndo(u);
    setTimeout(() => setUndo(null), u.expiresInMs);
  };
  if (card.collapsed) {
    return (
      <div className="opt-demo" data-idea="50959">
        <p className="opt-note">Card collapsed.</p>
        {undo && (
          <div className={OPT_UNDO_CLASS}>
            Dismissed as false positive
            <button type="button" className="opt-btn" onClick={() => { setCard({ id: 'fp1', title: 'Verbose error on /login' }); setUndo(null); }}>
              {undo.label}
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="opt-demo" data-idea="50959">
      <div className="opt-rowline">
        <span>{card.title}</span>
        <button type="button" className="opt-btn" onClick={dismiss}>Dismiss as FP</button>
      </div>
    </div>
  );
}

/* 50960 — DeferredJsNote ---------------------------------------------------------------------------------------------------------------- */

/** Analytics and tips load after the interactive core is ready. */
export function DeferredJsNote() {
  const [coreReady, setCoreReady] = useState(false);
  const ready = coreInteractiveReady({ firstPaintMs: coreReady ? 180 : 0, handlersBound: coreReady });
  return (
    <div className="opt-demo" data-idea="50960">
      <label className="opt-check">
        <input type="checkbox" checked={coreReady} onChange={(e) => setCoreReady(e.target.checked)} />
        Interactive core ready (first paint + handlers)
      </label>
      <p className="opt-note">
        Deferred modules: {DEFERRED_MODULES.join(', ')} —{' '}
        {ready ? 'loading now' : 'waiting for core'}
      </p>
    </div>
  );
}

/* Gallery ------------------------------------------------------------------------------------------------------------------------------- */

const GALLERY = [
  [50930, 'Optimistic status changes', OptimisticStatusToggle],
  [50931, 'Instant hunt creation', InstantHuntCreator],
  [50932, 'Optimistic comments', OptimisticCommentBox],
  [50933, 'Instant cached filtering', InstantCachedFilter],
  [50934, 'Skeleton-first rendering', SkeletonFirstDemo],
  [50935, 'Hover prefetch', HoverPrefetchCard],
  [50936, 'Debounced local search', DebouncedLocalSearch],
  [50937, 'Virtualized findings list', VirtualizedFindingsList],
  [50938, 'Virtualized timeline', VirtualizedTimeline],
  [50939, 'Lazy evidence images', LazyEvidenceImage],
  [50940, 'Progressive report preview', ProgressiveReportPreview],
  [50941, 'Optimistic bookmarks', OptimisticBookmarkList],
  [50942, 'Route code splitting', RouteSplitPanel],
  [50943, 'Cached hunt snapshots', CachedHuntSnapshot],
  [50944, 'Stale-while-revalidate widgets', SwrWidget],
  [50945, 'Optimistic widget reorder', OptimisticWidgetReorder],
  [50946, 'Instant theme switching', InstantThemeSwitch],
  [50947, 'Background PDF prefetch', PdfPrefetchHint],
  [50948, 'Optimistic bulk review', OptimisticBulkReview],
  [50949, 'Client-side filter/sort', ClientFilterSortDemo],
  [50950, '100ms acknowledgment budget', AckBudgetMeter],
  [50951, 'Batched detail fetches', BatchedFetchDemo],
  [50952, 'Optimistic pause/resume', OptimisticPauseResume],
  [50953, 'Skeletons over spinners', SkeletonOverSpinner],
  [50954, 'Priority content loading', PriorityContentLoader],
  [50955, 'Idle-time preloading', IdlePreloadIndicator],
  [50956, 'Optimistic dismissal', OptimisticDismissToast],
  [50957, 'Worker-thread search index', WorkerSearchDemo],
  [50958, 'Streaming step log', StreamingStepLog],
  [50959, 'Optimistic FP dismissal', OptimisticFpDismiss],
  [50960, 'Deferred non-critical JS', DeferredJsNote],
];

export function OptimisticSuiteGallery() {
  return (
    <div className="opt-gallery">
      <h2>Optimistic / performance suite — 50930–50960</h2>
      {GALLERY.map(([id, name, C]) => (
        <section key={id} className="opt-section">
          <h3>{id} · {name}</h3>
          <C />
        </section>
      ))}
    </div>
  );
}
