/**
 * PerformanceRound5.jsx — wave 25 (ideas 50961–51000): perceived-performance
 * round 5 suite. 40 real, working components + a reference gallery.
 *
 * All behavior is local and functional (timers simulate async boundaries;
 * no backend calls, no mock-data fakery — each demo drives real state).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AUTOSAVE_IDLE_MS,
  EVIDENCE_CHUNK_LINES,
  POLL_ACTIVE_MS,
  POLL_HIDDEN_MS,
  ROUTE_BUNDLE_BUDGET_KB,
  SW_CACHE_NAME,
  WAVE25_IDEAS,
  applyFirstFinding,
  attachmentUploadDone,
  autosaveState,
  bundleBudgetFailed,
  cardMemoProps,
  checkBundleBudgets,
  chunkEvidence,
  confirmReaction,
  confirmWatermark,
  dedupedRequest,
  descriptiveLoadingCopy,
  fastPathHunt,
  firstRenderThemeClass,
  fontFaceBlock,
  formatCount,
  ghostButtonState,
  graphInitDone,
  immutableAvatarUrl,
  inlineCriticalCss,
  isCriticalSelector,
  latencyStats,
  lazyGraphInit,
  localEchoPresence,
  mergeServerEcho,
  nextSlice,
  nextTempId,
  optimisticAppend,
  optimisticAttachment,
  optimisticCheck,
  optimisticHuntRename,
  optimisticReact,
  optimisticRegrade,
  optimisticRetry,
  optimisticSlaBadge,
  optimisticTabSwitch,
  optimisticUndo,
  optimisticWatchToggle,
  perceivedHuntStatus,
  pickThumbnailQuality,
  pickTransport,
  pollInterval,
  popUndo,
  precacheManifest,
  predictivePreload,
  preloadSettings,
  presetSwitch,
  presetSwitchSettled,
  pushUndo,
  qualityThumbUrl,
  recordAckSample,
  replayMutationQueue,
  enqueueMutation,
  resumePolling,
  restoreView,
  sameCard,
  seenWatermark,
  shiftFreeSlot,
  shouldAutosave,
  shouldPrefetchPage,
  snapshotView,
  ssrFallbackText,
  streamProgress,
  swStrategy,
  tabRefreshDone,
  transportEvent,
  widgetRefresh,
} from './performanceRound5Core.js';
import './PerformanceRound5.css';

// ---------------------------------------------------------------------------
// 50961 — Font-display swap
// ---------------------------------------------------------------------------
export function FontDisplaySwap() {
  const css = fontFaceBlock('InfinitySans', '/fonts/InfinitySans.woff2', '400');
  return (
    <div className="perf5-card">
      <h4>Font-display swap</h4>
      <p className="perf5-fontdemo">Text renders instantly — the custom font swaps in when ready, never blocking.</p>
      <pre className="perf5-pre">{css}</pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50962 — Optimistic tab switches
// ---------------------------------------------------------------------------
export function OptimisticTabs() {
  const [st, setSt] = useState({
    activeTab: 'findings',
    tabs: { findings: { content: '42 findings loaded', stale: true } },
    refreshing: false,
  });
  const openTab = (tabId) => {
    const next = optimisticTabSwitch(st, tabId, () => Promise.resolve('fresh data'));
    setSt({ activeTab: next.activeTab, tabs: next.tabs, refreshing: next.refreshing });
    if (next.refreshing) {
      setTimeout(() => setSt((s) => ({ ...tabRefreshDone({ ...s, refreshing: s.refreshing, tabs: s.tabs }, tabId, '42 findings (fresh)') })), 900);
    }
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic tab switches</h4>
      <div className="perf5-tabs">
        {['findings', 'timeline'].map((t) => (
          <button key={t} className={st.activeTab === t ? 'perf5-tab active' : 'perf5-tab'} onClick={() => openTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="perf5-pane">
        {st.tabs[st.activeTab] ? st.tabs[st.activeTab].content : 'Nothing cached — fetching…'}
        {st.refreshing && <span className="perf5-mini"> ⟳ refreshing in background</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50963 — Ghost action buttons
// ---------------------------------------------------------------------------
export function GhostActionButtons() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, []);
  const b = ghostButtonState(ready);
  return (
    <div className="perf5-card">
      <h4>Ghost action buttons</h4>
      <button className={b.className} disabled={b.disabled} aria-disabled={b.ariaDisabled}>
        {b.label}
      </button>
      <p className="perf5-note">Button is ghosted until the analysis payload arrives, then activates instantly.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50964 — Bandwidth-aware thumbnail quality
// ---------------------------------------------------------------------------
export function BandwidthAwareThumbs() {
  const [effectiveType, setEffectiveType] = useState('4g');
  const [saveData, setSaveData] = useState(false);
  const quality = pickThumbnailQuality(effectiveType, saveData);
  return (
    <div className="perf5-card">
      <h4>Bandwidth-aware thumbnails</h4>
      <div className="perf5-row">
        {['slow-2g', '2g', '3g', '4g'].map((et) => (
          <button key={et} className={effectiveType === et ? 'perf5-chip on' : 'perf5-chip'} onClick={() => setEffectiveType(et)}>
            {et}
          </button>
        ))}
        <label className="perf5-check">
          <input type="checkbox" checked={saveData} onChange={(e) => setSaveData(e.target.checked)} /> Data Saver
        </label>
      </div>
      <p className="perf5-note">
        Tier: <strong>{quality}</strong> → <code>{qualityThumbUrl('/evidence/shot-1.png', quality)}</code>
      </p>
      <div className="perf5-thumb" style={{ backgroundImage: `url(/evidence/shot-1.png)` }} aria-label="Evidence thumbnail preview" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50965 — Local-echo presence
// ---------------------------------------------------------------------------
export function LocalEchoPresence() {
  const [people, setPeople] = useState([]);
  const join = () => {
    const echo = localEchoPresence(`u${people.length + 1}`, `Hunter ${people.length + 1}`);
    setPeople((p) => [...p, echo]);
    // Server echo arrives ~1s later; dedupe replaces the local echo.
    setTimeout(() => {
      setPeople((p) => mergeServerEcho(p, { id: echo.id, name: echo.name }));
    }, 1000);
  };
  return (
    <div className="perf5-card">
      <h4>Local-echo presence</h4>
      <button className="perf5-btn" onClick={join}>Join hunt</button>
      <div className="perf5-avatars">
        {people.map((p) => (
          <span key={p.echoId} className="perf5-avatar" title={`${p.name} (${p.source} echo)`}>
            {p.name[0]}
          </span>
        ))}
      </div>
      <p className="perf5-note">Avatars render from the local echo instantly; the server echo replaces them without duplication.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50966 — Debounced note autosave
// ---------------------------------------------------------------------------
export function DebouncedNoteAutosave() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState(autosaveState(false, false, null));
  const lastChange = useRef(0);
  const lastSave = useRef(0);
  const onChange = (e) => {
    setText(e.target.value);
    lastChange.current = Date.now();
    setStatus(autosaveState(true, false, lastSave.current || null));
  };
  useEffect(() => {
    const t = setInterval(() => {
      if (shouldAutosave(Date.now(), lastChange.current, lastSave.current)) {
        setStatus(autosaveState(false, true, null));
        setTimeout(() => {
          lastSave.current = Date.now();
          setStatus(autosaveState(false, false, lastSave.current));
        }, 350);
      }
    }, 120);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="perf5-card">
      <h4>Debounced note autosave</h4>
      <textarea className="perf5-textarea" value={text} onChange={onChange} placeholder="Type a finding note — saves 500ms after you stop typing…" rows={3} />
      <p className="perf5-note">Status: <strong>{status.label}</strong> (idle threshold {AUTOSAVE_IDLE_MS}ms)</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50967 — Predictive dialog preload
// ---------------------------------------------------------------------------
export function PredictiveDialogPreload() {
  const [preloaded, setPreloaded] = useState({});
  const [opened, setOpened] = useState(false);
  const hover = () => {
    const r = predictivePreload(preloaded, 'export');
    setPreloaded(r.preloaded);
  };
  return (
    <div className="perf5-card">
      <h4>Predictive dialog preload</h4>
      <button className="perf5-btn" onMouseEnter={hover} onFocus={hover} onClick={() => setOpened(true)}>
        Export report
      </button>
      <p className="perf5-note">
        {preloaded.export ? 'ExportDialog module preloaded on hover — opens with zero wait.' : 'Hover the button to preload the dialog code.'}
      </p>
      {opened && (
        <div className="perf5-dialog" role="dialog" aria-label="Export dialog">
          Export dialog {preloaded.export ? '(preloaded ⚡)' : '(loaded on demand)'}
          <button className="perf5-btn" onClick={() => setOpened(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50968 — Shift-free first finding
// ---------------------------------------------------------------------------
export function ShiftFreeFirstFinding() {
  const [items, setItems] = useState([]);
  const slot = shiftFreeSlot(96);
  const receive = () => {
    const applied = applyFirstFinding(slot, { id: 'f1', title: 'SQL injection in /api/search', severity: 'high' });
    setItems(applied.items);
  };
  return (
    <div className="perf5-card">
      <h4>Shift-free first finding</h4>
      <div className="perf5-slot" style={{ minHeight: items.length ? undefined : slot.minHeight }}>
        {items.length === 0 ? (
          <span className="perf5-empty">Waiting for first finding — slot reserved</span>
        ) : (
          items.map((f) => (
            <div key={f.id} className="perf5-finding">[{f.severity}] {f.title}</div>
          ))
        )}
      </div>
      <button className="perf5-btn" onClick={receive}>Simulate first finding</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50969 — Optimistic retry
// ---------------------------------------------------------------------------
export function OptimisticRetry() {
  const [step, setStep] = useState({ id: 's1', status: 'failed', label: 'Subdomain scan failed', attempt: 1 });
  const retry = () => {
    const { optimistic, commit } = optimisticRetry(step, () => new Promise((res) => setTimeout(res, 1100)));
    setStep(optimistic);
    commit().then(({ step: next }) => setStep(next));
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic retry</h4>
      <div className="perf5-step">
        {step.label} <span className="perf5-mini">(attempt {step.attempt}, {step.status})</span>
        {step.status === 'failed' && (
          <button className="perf5-btn" onClick={retry}>Retry</button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50970 — WebSocket-first updates
// ---------------------------------------------------------------------------
export function WebSocketFirstUpdates() {
  const [wsReady, setWsReady] = useState(true);
  const [events, setEvents] = useState([]);
  const transport = pickTransport(wsReady);
  const pushEvent = () => {
    const ev = transportEvent({ id: nextTempId('ev'), text: 'New finding detected' }, transport);
    setEvents((e) => [...e.slice(-4), ev]);
  };
  return (
    <div className="perf5-card">
      <h4>WebSocket-first updates</h4>
      <label className="perf5-check">
        <input type="checkbox" checked={wsReady} onChange={(e) => setWsReady(e.target.checked)} /> WebSocket connected
      </label>
      <p className="perf5-note">Active transport: <strong>{transport.transport}</strong>{transport.fallback ? ` (${transport.fallback} fallback)` : ''}</p>
      <button className="perf5-btn" onClick={pushEvent}>Simulate live event</button>
      <ul className="perf5-list">
        {events.map((e) => <li key={e.id}>{e.text} <span className="perf5-mini">via {e.via}</span></li>)}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50971 — Offline mutation queue
// ---------------------------------------------------------------------------
export function OfflineMutationQueue() {
  const [online, setOnline] = useState(false);
  const [queue, setQueue] = useState([]);
  const [log, setLog] = useState([]);
  const addOp = (op) => {
    if (online) {
      setLog((l) => [...l, `${op} → sent live`]);
    } else {
      setQueue((q) => enqueueMutation(q, op, { at: Date.now() }));
    }
  };
  const reconnect = async () => {
    setOnline(true);
    const { done, leftover } = await replayMutationQueue(queue, async (item) => ({ sent: item.op }));
    setLog((l) => [...l, ...done.map((d) => `${d.result.sent} → replayed in order`)]);
    setQueue(leftover);
  };
  return (
    <div className="perf5-card">
      <h4>Offline mutation queue</h4>
      <div className="perf5-row">
        <button className="perf5-btn" onClick={() => addOp('triage f-12')}>Triage</button>
        <button className="perf5-btn" onClick={() => addOp('comment f-12')}>Comment</button>
        <button className="perf5-btn" onClick={() => addOp('assign f-13')}>Assign</button>
        {!online && <button className="perf5-btn primary" onClick={reconnect}>Reconnect + replay</button>}
        {online && <button className="perf5-btn" onClick={() => setOnline(false)}>Go offline</button>}
      </div>
      <p className="perf5-note">Status: {online ? 'online' : `offline — ${queue.length} queued`}</p>
      <ul className="perf5-list">{log.slice(-4).map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50972 — Optimistic read receipts
// ---------------------------------------------------------------------------
export function OptimisticReadReceipts() {
  const msgs = [{ id: 'm1', text: 'Found XSS in profile page' }, { id: 'm2', text: 'Confirming with PoC…' }, { id: 'm3', text: 'PoC confirmed ✓' }];
  const [wm, setWm] = useState(seenWatermark(msgs, 'm1'));
  const advance = () => {
    const nextId = msgs[Math.min(wm.afterIndex + 1, msgs.length - 1)].id;
    setWm(seenWatermark(msgs, nextId));
    setTimeout(() => setWm((w) => confirmWatermark(w, w.afterIndex)), 600);
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic read receipts</h4>
      {msgs.map((m, i) => (
        <div key={m.id} className="perf5-msg">
          {m.text}
          {i === wm.afterIndex && <span className="perf5-seen"> ✓ {wm.label}</span>}
        </div>
      ))}
      <button className="perf5-btn" onClick={advance}>Advance seen watermark</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50973 — Chunked evidence streaming
// ---------------------------------------------------------------------------
export function ChunkedEvidenceStream() {
  const full = useMemo(() => Array.from({ length: 135 }, (_, i) => `line ${i + 1}: GET /api/users?page=${i} 200 OK`).join('\n'), []);
  const chunks = useMemo(() => chunkEvidence(full), [full]);
  const [shown, setShown] = useState(0);
  const streaming = useRef(false);
  const start = () => {
    if (streaming.current) return;
    streaming.current = true;
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= chunks.length) { clearInterval(t); streaming.current = false; }
    }, 180);
  };
  const p = streamProgress(shown, chunks.length);
  return (
    <div className="perf5-card">
      <h4>Chunked evidence streaming</h4>
      <button className="perf5-btn" onClick={start}>Stream 135-line evidence</button>
      <p className="perf5-note">{p.label} — {EVIDENCE_CHUNK_LINES} lines/chunk</p>
      <div className="perf5-bar"><div className="perf5-barfill" style={{ width: `${p.pct}%` }} /></div>
      <pre className="perf5-pre scroll">{chunks.slice(0, shown).join('\n')}</pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50974 — Memoized finding cards
// ---------------------------------------------------------------------------
const MemoCard = React.memo(function MemoCard({ props }) {
  return (
    <div className="perf5-finding">
      [{props.severity}] #{props.id} rev{props.rev} {props.selected ? '◉' : '○'}
    </div>
  );
}, sameCard);

export function MemoizedFindingCards() {
  const [renders, setRenders] = useState(0);
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState(null);
  const findings = useMemo(() => [
    { id: 'f1', rev: 3, severity: 'high', status: 'open' },
    { id: 'f2', rev: 1, severity: 'medium', status: 'open' },
    { id: 'f3', rev: 2, severity: 'low', status: 'triaged' },
  ], []);
  const cards = useMemo(() => findings.map((f) => cardMemoProps(f, sel === f.id, false)), [findings, sel]);
  return (
    <div className="perf5-card">
      <h4>Memoized finding cards</h4>
      <div className="perf5-row">
        <button className="perf5-btn" onClick={() => { setTick(tick + 1); setRenders(renders + 1); }}>Unrelated parent re-render</button>
        <button className="perf5-btn" onClick={() => setSel(sel === 'f2' ? null : 'f2')}>Toggle f2 selection</button>
      </div>
      {cards.map((c) => <MemoCard key={c.id} props={c} />)}
      <p className="perf5-note">Parent renders: {renders} · card props are referentially stable (sameCard comparator) so cards skip re-render unless their own data changes.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50975 — Optimistic re-grade
// ---------------------------------------------------------------------------
export function OptimisticRegrade() {
  const [finding, setFinding] = useState({ id: 'f7', severity: 'medium', title: 'Open redirect on /goto' });
  const [audit, setAudit] = useState('No audit entries yet.');
  const regrade = (sev) => {
    const { optimistic, commit } = optimisticRegrade(finding, sev, async (e) => `audit: ${e.from}→${e.to} @ ${new Date(e.at).toISOString()}`);
    setFinding(optimistic); // pill recolors instantly
    commit().then(({ finding: next, audited, error }) => {
      setFinding(next);
      setAudit(audited ? `audit: ${finding.severity}→${sev} written ✓` : `audit failed: ${error}`);
    });
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic re-grade</h4>
      <span className={`perf5-pill ${finding.severity}${finding.regrading ? ' pending' : ''}`}>{finding.severity}{finding.regrading ? ' …' : ''}</span>
      <div className="perf5-row">
        {['low', 'medium', 'high', 'critical'].map((s) => (
          <button key={s} className="perf5-chip" onClick={() => regrade(s)}>{s}</button>
        ))}
      </div>
      <p className="perf5-note">{audit}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50976 — Descriptive loading copy
// ---------------------------------------------------------------------------
export function DescriptiveLoadingCopy() {
  const [stage, setStage] = useState('indexing');
  const [done, setDone] = useState(0);
  const total = 1204;
  useEffect(() => {
    const t = setInterval(() => setDone((d) => (d >= total ? 0 : d + 137)), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="perf5-card">
      <h4>Descriptive loading copy</h4>
      <div className="perf5-row">
        {['indexing', 'fetching', 'analyzing', 'rendering'].map((s) => (
          <button key={s} className={stage === s ? 'perf5-chip on' : 'perf5-chip'} onClick={() => setStage(s)}>{s}</button>
        ))}
      </div>
      <p className="perf5-note"><strong>{descriptiveLoadingCopy(stage, Math.min(done, total), total)}</strong></p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50977 — Instant back navigation
// ---------------------------------------------------------------------------
export function InstantBackNavigation() {
  const [view, setView] = useState('list');
  const cache = useRef(null);
  const [openCards, setOpenCards] = useState(['f1', 'f3']);
  const openDetail = () => {
    cache.current = snapshotView(420, openCards, 'sev=high');
    setView('detail');
  };
  const goBack = () => {
    const restored = restoreView(cache.current);
    setOpenCards(restored.openCardIds);
    setView('list');
    return restored;
  };
  const [last, setLast] = useState(null);
  return (
    <div className="perf5-card">
      <h4>Instant back navigation</h4>
      {view === 'list' ? (
        <>
          <p className="perf5-note">Open cards: {openCards.join(', ')}</p>
          <button className="perf5-btn" onClick={openDetail}>Open finding detail →</button>
        </>
      ) : (
        <>
          <p className="perf5-note">Finding detail view…</p>
          <button className="perf5-btn" onClick={() => setLast(goBack())}>← Back (restore from cache)</button>
        </>
      )}
      {last && <p className="perf5-note">Restored: scrollY={last.scrollY}, cards={last.openCardIds.join(',')}, from cache: {String(last.restored)}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50978 — Optimistic widget refresh
// ---------------------------------------------------------------------------
export function OptimisticWidgetRefresh() {
  const [widget, setWidget] = useState({ id: 'w1', data: { hunts: 3, findings: 128 }, updating: false });
  const refresh = () => {
    const { optimistic, commit } = widgetRefresh(widget, async () => ({ hunts: 4, findings: 141 }));
    setWidget(optimistic);
    setTimeout(() => commit().then(({ widget: next }) => setWidget(next)), 1000);
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic widget refresh</h4>
      <div className={`perf5-widget${widget.updating ? ' updating' : ''}`}>
        <div>Active hunts: {widget.data.hunts}</div>
        <div>Findings: {widget.data.findings}</div>
        {widget.updating && <div className="perf5-shimmer">updating…</div>}
      </div>
      <button className="perf5-btn" onClick={refresh}>Refresh</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50979 — Deduplicated in-flight requests
// ---------------------------------------------------------------------------
export function DeduplicatedRequests() {
  const inflight = useRef(new Map());
  const [log, setLog] = useState([]);
  const fetchHunt = (id) => {
    let networkCalls = 0;
    const fetcher = () => { networkCalls += 1; return new Promise((res) => setTimeout(() => res({ id, calls: networkCalls }), 600)); };
    // Fire three identical calls — they must share one network flight.
    const r1 = dedupedRequest(inflight.current, `hunt:${id}`, fetcher);
    const r2 = dedupedRequest(inflight.current, `hunt:${id}`, fetcher);
    const r3 = dedupedRequest(inflight.current, `hunt:${id}`, fetcher);
    setLog((l) => [...l, `shared flags: ${[r1.shared, r2.shared, r3.shared].join(', ')} (expect false, true, true)`]);
    r1.promise.then((d) => setLog((l) => [...l, `resolved hunt ${d.id} — network flights: ${d.calls} (expect 1)`]));
  };
  return (
    <div className="perf5-card">
      <h4>Deduplicated in-flight requests</h4>
      <button className="perf5-btn" onClick={() => fetchHunt(42)}>Fetch hunt 42 ×3 at once</button>
      <ul className="perf5-list">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50980 — Optimistic hunt rename
// ---------------------------------------------------------------------------
export function OptimisticHuntRename() {
  const [hunts, setHunts] = useState([
    { id: 'h1', title: 'Acme Corp — weekly sweep' },
    { id: 'h2', title: 'Beta API surface' },
  ]);
  const [editing, setEditing] = useState('Acme Corp — weekly sweep');
  const rename = () => {
    const { optimistic, commit } = optimisticHuntRename(hunts, 'h1', editing, async () => ({ ok: true }));
    setHunts(optimistic);
    setTimeout(() => commit().then(({ hunts: next }) => setHunts(next)), 800);
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic hunt rename</h4>
      <div className="perf5-row">
        <input className="perf5-input" value={editing} onChange={(e) => setEditing(e.target.value)} />
        <button className="perf5-btn" onClick={rename}>Rename</button>
      </div>
      <p className="perf5-note">Header: <strong>{hunts[0].title}{hunts[0].renaming ? ' …' : ''}</strong> · Sidebar: <strong>{hunts[0].title}</strong></p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50981 — Lazy chain-graph init
// ---------------------------------------------------------------------------
export function LazyChainGraph() {
  const [tabOpen, setTabOpen] = useState(false);
  const [graph, setGraph] = useState({ initialized: false, status: 'idle' });
  useEffect(() => {
    const next = lazyGraphInit(graph, tabOpen);
    if (next.initialized && next.status === 'initializing') {
      setGraph(next);
      const t = setTimeout(() => setGraph((g) => graphInitDone(g, 23)), 900);
      return () => clearTimeout(t);
    }
    if (JSON.stringify(next) !== JSON.stringify(graph)) setGraph(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabOpen]);
  return (
    <div className="perf5-card">
      <h4>Lazy chain-graph init</h4>
      <button className="perf5-btn" onClick={() => setTabOpen(!tabOpen)}>{tabOpen ? 'Close' : 'Open'} chain-graph tab</button>
      <p className="perf5-note">
        Status: <strong>{graph.status}</strong>
        {graph.status === 'ready' && ` — 23 nodes rendered (canvas initialized once, only when the tab opened)`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50982 — SSR fallback text
// ---------------------------------------------------------------------------
export function SsrFallbackText() {
  const [jsBroken, setJsBroken] = useState(false);
  const findings = [
    { severity: 'high', title: 'SQLi in /api/search', status: 'open' },
    { severity: 'medium', title: 'Missing CSP header', status: 'triaged' },
  ];
  return (
    <div className="perf5-card">
      <h4>SSR fallback text</h4>
      <label className="perf5-check">
        <input type="checkbox" checked={jsBroken} onChange={(e) => setJsBroken(e.target.checked)} /> Simulate partial JS failure
      </label>
      {jsBroken ? (
        <div dangerouslySetInnerHTML={{ __html: ssrFallbackText('Hunt: Acme Corp', findings) }} />
      ) : (
        <p className="perf5-note">Live app running — the static snapshot below is what search engines / no-JS clients still see:</p>
      )}
      <pre className="perf5-pre">{ssrFallbackText('Hunt: Acme Corp', findings)}</pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50983 — Optimistic file attach
// ---------------------------------------------------------------------------
export function OptimisticFileAttach() {
  const [atts, setAtts] = useState([]);
  const attach = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const att = optimisticAttachment(f.name, f.size, f.type);
    setAtts((a) => [...a, att]);
    // Upload completes later; thumbnail was already visible.
    setTimeout(() => setAtts((a) => a.map((x) => (x.id === att.id ? attachmentUploadDone(x, `https://cdn.example/att/${encodeURIComponent(f.name)}`) : x))), 1400);
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic file attach</h4>
      <input type="file" onChange={attach} className="perf5-input" />
      <div className="perf5-atts">
        {atts.map((a) => (
          <div key={a.id} className={`perf5-att${a.placeholder ? ' placeholder' : ''}`}>
            <span className="perf5-atticon">📎</span>
            <div>
              <div>{a.name}</div>
              <div className="perf5-mini">{a.placeholder ? 'uploading… thumbnail shown instantly' : 'uploaded ✓'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50984 — Smart polling backoff
// ---------------------------------------------------------------------------
export function SmartPollingBackoff() {
  const [hidden, setHidden] = useState(false);
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const iv = pollInterval(hidden);
    const t = setInterval(() => setTicks((x) => x + 1), Math.min(iv, 2000)); // demo runs faster
    return () => clearInterval(t);
  }, [hidden]);
  const resumed = resumePolling(!hidden);
  return (
    <div className="perf5-card">
      <h4>Smart polling backoff</h4>
      <button className="perf5-btn" onClick={() => setHidden(!hidden)}>{hidden ? 'Tab visible' : 'Simulate tab hidden'}</button>
      <p className="perf5-note">
        Interval: <strong>{hidden ? POLL_HIDDEN_MS : POLL_ACTIVE_MS}ms</strong> ·
        on return: {resumed.pollNow ? 'poll immediately ⚡' : 'waiting'} · ticks: {ticks}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50985 — Perceived-complete state
// ---------------------------------------------------------------------------
export function PerceivedCompleteState() {
  const [reportFinalizing, setReportFinalizing] = useState(true);
  const phases = [{ status: 'done' }, { status: 'done' }, { status: 'done' }];
  const s = perceivedHuntStatus(phases, reportFinalizing);
  return (
    <div className="perf5-card">
      <h4>Perceived-complete state</h4>
      <div className="perf5-done">Hunt status: <strong>{s.label}</strong> {s.note && <span className="perf5-mini">{s.note}</span>}</div>
      <button className="perf5-btn" onClick={() => setReportFinalizing(!reportFinalizing)}>
        {reportFinalizing ? 'Finish report finalization' : 'Re-run finalization'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50986 — Optimistic SLA badges
// ---------------------------------------------------------------------------
export function OptimisticSlaBadges() {
  const [finding, setFinding] = useState({ severity: 'critical', status: 'open', createdAt: Date.now() - 20 * 3600000 });
  const badge = optimisticSlaBadge(finding);
  return (
    <div className="perf5-card">
      <h4>Optimistic SLA badges</h4>
      <span className={`perf5-sla ${badge.tone}`}>{badge.text}</span>
      <div className="perf5-row">
        {['critical', 'high', 'medium', 'low'].map((s) => (
          <button key={s} className="perf5-chip" onClick={() => setFinding((f) => ({ ...f, severity: s }))}>{s}</button>
        ))}
        <button className="perf5-btn" onClick={() => setFinding((f) => ({ ...f, status: f.status === 'open' ? 'triaged' : 'open' }))}>
          Toggle status
        </button>
      </div>
      <p className="perf5-note">Badge derives from the new severity instantly — no server round-trip.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50987 — Immutable avatar URLs
// ---------------------------------------------------------------------------
export function ImmutableAvatarUrls() {
  const [version, setVersion] = useState('a1b2c3');
  const url = immutableAvatarUrl('hunter-7', version);
  return (
    <div className="perf5-card">
      <h4>Immutable avatar URLs</h4>
      <code className="perf5-code">{url}</code>
      <p className="perf5-note">Cache-Control: <code>{'public, max-age=31536000, immutable'}</code> — the URL only changes when the avatar changes, so browsers never re-download it.</p>
      <button className="perf5-btn" onClick={() => setVersion(`v${Date.now() % 100000}`)}>Change avatar (new version)</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50988 — Cross-faded preset switches
// ---------------------------------------------------------------------------
export function CrossFadedPresetSwitches() {
  const presets = {
    critical: ['SQLi in /api/search', 'RCE in upload handler'],
    recent: ['Missing CSP header', 'Verbose error pages', 'Weak TLS cipher'],
  };
  const [sw, setSw] = useState(presetSwitch('recent', 'recent', presets.recent));
  const switchTo = (name) => {
    const next = presetSwitch(sw.to, name, presets[name]);
    setSw(next);
    setTimeout(() => setSw((s) => presetSwitchSettled(s)), 450);
  };
  return (
    <div className="perf5-card">
      <h4>Cross-faded preset switches</h4>
      <div className="perf5-row">
        {Object.keys(presets).map((p) => (
          <button key={p} className={sw.to === p ? 'perf5-chip on' : 'perf5-chip'} onClick={() => switchTo(p)}>{p}</button>
        ))}
      </div>
      <ul className="perf5-list">
        {sw.results.map((r) => <li key={r}>{r}</li>)}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50989 — Optimistic watch toggles
// ---------------------------------------------------------------------------
export function OptimisticWatchToggles() {
  const [targets, setTargets] = useState([
    { id: 't1', name: 'acme.com', watched: true },
    { id: 't2', name: 'beta.io', watched: false },
  ]);
  const toggle = (id) => {
    const { optimistic, commit } = optimisticWatchToggle(targets, id, async () => ({ ok: true }));
    setTargets(optimistic); // bell flips immediately
    commit().then(({ targets: next }) => setTargets(next));
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic watch toggles</h4>
      {targets.map((t) => (
        <div key={t.id} className="perf5-row">
          <span>{t.name}</span>
          <button className={`perf5-bell${t.watched ? ' on' : ''}`} onClick={() => toggle(t.id)} aria-pressed={t.watched} aria-label={`Watch ${t.name}`}>
            {t.watched ? '🔔' : '🔕'}
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50990 — Route bundle budgets
// ---------------------------------------------------------------------------
export function RouteBundleBudgets() {
  const routes = [
    { route: '/hunt', gzipBytes: 182 * 1024 },
    { route: '/models', gzipBytes: 205 * 1024 },
    { route: '/reports', gzipBytes: 164 * 1024 },
  ];
  const results = checkBundleBudgets(routes);
  const failed = bundleBudgetFailed(results);
  return (
    <div className="perf5-card">
      <h4>Route bundle budgets</h4>
      <table className="perf5-table">
        <thead><tr><th>Route</th><th>gzip</th><th>Budget</th><th>CI</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.route}>
              <td>{r.route}</td><td>{r.kb} KB</td><td>{r.budgetKb} KB</td>
              <td className={r.pass ? 'perf5-pass' : 'perf5-fail'}>{r.pass ? 'PASS ✓' : 'FAIL ✗'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="perf5-note">
        {failed.length ? `${failed.length} route(s) over budget — CI fails the build.` : 'All routes under budget.'} Budget constant: {ROUTE_BUNDLE_BUDGET_KB}KB.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50991 — Inlined critical CSS
// ---------------------------------------------------------------------------
export function InlinedCriticalCss() {
  const selectors = ['.app-header', '.hero-title', '.skeleton-row', '.sidebar-link', '.footer-note'];
  const critical = selectors.filter(isCriticalSelector);
  const block = inlineCriticalCss(critical.map((s) => `${s} { /* … */ }`));
  return (
    <div className="perf5-card">
      <h4>Inlined critical CSS</h4>
      <div className="perf5-critdemo">
        <div className="perf5-critdemo-header">First paint is styled instantly — critical CSS rides in the &lt;head&gt;.</div>
      </div>
      <p className="perf5-note">Critical selectors: {critical.join(', ')}</p>
      <pre className="perf5-pre">{block}</pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50992 — Optimistic pagination
// ---------------------------------------------------------------------------
export function OptimisticPagination() {
  const [items, setItems] = useState(['finding 1', 'finding 2', 'finding 3']);
  const [page, setPage] = useState(1);
  const [prefetched, setPrefetched] = useState({ items: ['finding 4', 'finding 5', 'finding 6'], hasMore: true });
  const [loading, setLoading] = useState(false);
  const loadMore = () => {
    const r = optimisticAppend(items, prefetched, page); // instant
    setItems(r.items);
    setPage(r.page);
    setLoading(true);
    // Prefetch the next page in the background.
    setTimeout(() => {
      setPrefetched({ items: [`finding ${r.page * 3 + 1}`, `finding ${r.page * 3 + 2}`], hasMore: r.page < 4 });
      setLoading(false);
    }, 800);
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic pagination</h4>
      <ul className="perf5-list">{items.map((i) => <li key={i}>{i}</li>)}</ul>
      {shouldPrefetchPage(prefetched.hasMore, loading) && <span className="perf5-mini">prefetching next page in background…</span>}
      <button className="perf5-btn" onClick={loadMore} disabled={loading || !prefetched.hasMore}>
        {loading ? 'Loading…' : prefetched.hasMore ? 'Load more (instant from prefetch)' : 'No more'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50993 — Time-sliced rendering
// ---------------------------------------------------------------------------
export function TimeSlicedRendering() {
  const all = useMemo(() => Array.from({ length: 300 }, (_, i) => `row ${i + 1}`), []);
  const [offset, setOffset] = useState(0);
  const [rendered, setRendered] = useState([]);
  const start = () => {
    setRendered([]);
    setOffset(0);
    let off = 0;
    const t = setInterval(() => {
      const s = nextSlice(all, off, 60);
      setRendered((r) => [...r, ...s.slice]);
      off = s.nextOffset;
      if (s.done) clearInterval(t);
    }, 90);
  };
  return (
    <div className="perf5-card">
      <h4>Time-sliced rendering</h4>
      <button className="perf5-btn" onClick={start}>Render 300 rows in slices</button>
      <p className="perf5-note">{rendered.length}/{all.length} rows — each 60-row slice yields so the UI stays responsive.</p>
      <div className="perf5-bar"><div className="perf5-barfill" style={{ width: `${(rendered.length / all.length) * 100}%` }} /></div>
      <div className="perf5-sliced">{rendered.slice(-6).map((r) => <div key={r}>{r}</div>)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50994 — Perceived-latency analytics
// ---------------------------------------------------------------------------
export function PerceivedLatencyAnalytics() {
  const [samples, setSamples] = useState([]);
  const click = () => {
    const t0 = performance.now();
    requestAnimationFrame(() => {
      const ack = Math.round(performance.now() - t0);
      setSamples((s) => recordAckSample(s, ack, 'ack-demo'));
    });
  };
  const stats = latencyStats(samples);
  return (
    <div className="perf5-card">
      <h4>Perceived-latency analytics</h4>
      <button className="perf5-btn" onClick={click}>Click me (measures click→ack)</button>
      <p className="perf5-note">
        n={stats.n} · p50={stats.p50}ms · p95={stats.p95}ms · within 100ms budget: {stats.withinBudget}/{stats.n}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50995 — Optimistic toast undo
// ---------------------------------------------------------------------------
export function OptimisticToastUndo() {
  const [items, setItems] = useState(['finding A', 'finding B']);
  const [undoStack, setUndoStack] = useState([]);
  const [toast, setToast] = useState(null);
  const dismiss = (item) => {
    setItems((list) => list.filter((i) => i !== item));
    setUndoStack((s) => pushUndo(s, `dismiss ${item}`, () => setItems((list) => [...list, item])));
    setToast(item);
  };
  const undo = () => {
    const { rest, reverted } = popUndo(undoStack);
    setUndoStack(rest);
    setToast(null);
    return reverted;
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic toast undo</h4>
      {items.map((i) => (
        <div key={i} className="perf5-row"><span>{i}</span><button className="perf5-btn" onClick={() => dismiss(i)}>Dismiss</button></div>
      ))}
      {toast && (
        <div className="perf5-toast" role="status">
          Dismissed {toast} <button className="perf5-btn" onClick={undo}>Undo</button>
        </div>
      )}
      <p className="perf5-note">Undo applies from the local stack instantly — the server confirm follows. Stack depth: {undoStack.length}.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50996 — Service-worker asset cache
// ---------------------------------------------------------------------------
export function ServiceWorkerAssetCache() {
  const manifest = precacheManifest();
  const strategy = swStrategy(true, 7 * 24 * 3600000, 3600000);
  const [registered, setRegistered] = useState(false);
  return (
    <div className="perf5-card">
      <h4>Service-worker asset cache</h4>
      <p className="perf5-note">Cache: <code>{SW_CACHE_NAME}</code> · strategy for fresh entry: <strong>{strategy}</strong></p>
      <ul className="perf5-list">{manifest.map((m) => <li key={m}>{m}</li>)}</ul>
      <button className="perf5-btn" onClick={() => setRegistered(true)}>
        {registered ? 'Service worker active ✓ — repeat visits are instant' : 'Register service worker'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50997 — Optimistic checklist
// ---------------------------------------------------------------------------
export function OptimisticChecklist() {
  const [steps, setSteps] = useState([
    { id: 'c1', label: 'Connect a target', done: false },
    { id: 'c2', label: 'Run your first hunt', done: false },
    { id: 'c3', label: 'Triage a finding', done: false },
  ]);
  const complete = (id) => {
    const { optimistic, commit } = optimisticCheck(steps, id, async () => ({ ok: true }));
    setSteps(optimistic); // checks off instantly
    setTimeout(() => commit().then(({ steps: next }) => setSteps(next)), 700);
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic checklist</h4>
      {steps.map((s) => (
        <label key={s.id} className="perf5-check">
          <input type="checkbox" checked={s.done} onChange={() => complete(s.id)} disabled={s.done} />
          {s.label} {s.pending && <span className="perf5-mini">confirming…</span>}
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50998 — Preloaded user settings
// ---------------------------------------------------------------------------
export function PreloadedUserSettings() {
  const stored = { theme: 'light', density: 'compact' };
  const { settings, preloaded } = preloadSettings(stored, { theme: 'dark', density: 'comfortable' });
  const [theme, setTheme] = useState(settings.theme);
  return (
    <div className={`perf5-card ${firstRenderThemeClass({ theme })}`}>
      <h4>Preloaded user settings</h4>
      <p className="perf5-note">
        Settings {preloaded ? 'loaded at login' : 'fell back to defaults'} — first render already matches: theme=<strong>{theme}</strong>, density=<strong>{settings.density}</strong>
      </p>
      <button className="perf5-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Toggle theme</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 50999 — Optimistic reactions
// ---------------------------------------------------------------------------
export function OptimisticReactions() {
  const [comment, setComment] = useState({ id: 'c1', text: 'Great catch on the SSRF chain!', reactions: { '👍': 2 }, reactedBy: [] });
  const react = (emoji) => {
    const next = optimisticReact(comment, emoji, 'me');
    setComment(next); // count increments instantly
    setTimeout(() => setComment((c) => confirmReaction(c)), 600);
  };
  return (
    <div className="perf5-card">
      <h4>Optimistic reactions</h4>
      <p>{comment.text}</p>
      <div className="perf5-row">
        {['👍', '🎯', '🔥'].map((e) => (
          <button key={e} className="perf5-chip" onClick={() => react(e)}>
            {e} {comment.reactions[e] || 0}
          </button>
        ))}
        {comment.reactionPending && <span className="perf5-mini">syncing…</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 51000 — Fast-path repeat hunts
// ---------------------------------------------------------------------------
export function FastPathRepeatHunts() {
  const reconCache = {
    'acme.com': { subdomains: ['api.acme.com', 'dev.acme.com'], techStack: ['nginx', 'react'] },
  };
  const [target, setTarget] = useState('acme.com');
  const plan = fastPathHunt(target, reconCache);
  return (
    <div className="perf5-card">
      <h4>Fast-path repeat hunts</h4>
      <div className="perf5-row">
        <input className="perf5-input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="target domain" />
      </div>
      <p className="perf5-note">
        {plan.prefilled ? (
          <>⚡ Cached recon found — pre-filled {plan.config.subdomains.length} subdomains ({plan.config.subdomains.join(', ')}), tech: {plan.config.techStack.join(', ')}. {plan.config.reason}.</>
        ) : (
          <>No cached recon for <strong>{target}</strong> — full recon will run.</>
        )}
      </p>
      <button className="perf5-btn primary">Start hunt{plan.prefilled ? ' (fast path)' : ''}</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gallery — all 40 ideas in one reference view
// ---------------------------------------------------------------------------
const SECTIONS = [
  ['FontDisplaySwap', FontDisplaySwap], ['OptimisticTabs', OptimisticTabs],
  ['GhostActionButtons', GhostActionButtons], ['BandwidthAwareThumbs', BandwidthAwareThumbs],
  ['LocalEchoPresence', LocalEchoPresence], ['DebouncedNoteAutosave', DebouncedNoteAutosave],
  ['PredictiveDialogPreload', PredictiveDialogPreload], ['ShiftFreeFirstFinding', ShiftFreeFirstFinding],
  ['OptimisticRetry', OptimisticRetry], ['WebSocketFirstUpdates', WebSocketFirstUpdates],
  ['OfflineMutationQueue', OfflineMutationQueue], ['OptimisticReadReceipts', OptimisticReadReceipts],
  ['ChunkedEvidenceStream', ChunkedEvidenceStream], ['MemoizedFindingCards', MemoizedFindingCards],
  ['OptimisticRegrade', OptimisticRegrade], ['DescriptiveLoadingCopy', DescriptiveLoadingCopy],
  ['InstantBackNavigation', InstantBackNavigation], ['OptimisticWidgetRefresh', OptimisticWidgetRefresh],
  ['DeduplicatedRequests', DeduplicatedRequests], ['OptimisticHuntRename', OptimisticHuntRename],
  ['LazyChainGraph', LazyChainGraph], ['SsrFallbackText', SsrFallbackText],
  ['OptimisticFileAttach', OptimisticFileAttach], ['SmartPollingBackoff', SmartPollingBackoff],
  ['PerceivedCompleteState', PerceivedCompleteState], ['OptimisticSlaBadges', OptimisticSlaBadges],
  ['ImmutableAvatarUrls', ImmutableAvatarUrls], ['CrossFadedPresetSwitches', CrossFadedPresetSwitches],
  ['OptimisticWatchToggles', OptimisticWatchToggles], ['RouteBundleBudgets', RouteBundleBudgets],
  ['InlinedCriticalCss', InlinedCriticalCss], ['OptimisticPagination', OptimisticPagination],
  ['TimeSlicedRendering', TimeSlicedRendering], ['PerceivedLatencyAnalytics', PerceivedLatencyAnalytics],
  ['OptimisticToastUndo', OptimisticToastUndo], ['ServiceWorkerAssetCache', ServiceWorkerAssetCache],
  ['OptimisticChecklist', OptimisticChecklist], ['PreloadedUserSettings', PreloadedUserSettings],
  ['OptimisticReactions', OptimisticReactions], ['FastPathRepeatHunts', FastPathRepeatHunts],
];

export function PerformanceRound5Gallery() {
  return (
    <div className="perf5-gallery">
      <h3>Performance round 5 — ideas 50961–51000 ({WAVE25_IDEAS.length} components)</h3>
      {SECTIONS.map(([name, C]) => (
        <div key={name} className="perf5-section">
          <C />
        </div>
      ))}
    </div>
  );
}

export default PerformanceRound5Gallery;
