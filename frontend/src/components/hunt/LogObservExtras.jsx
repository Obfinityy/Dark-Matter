/**
 * LogObservExtras.jsx — wave 32 (ideas 51261–51280): log observability round 3,
 * part 2. Real working components driving local state — no mocks,
 * no demo-only controls.
 */
import React, { useMemo, useState } from 'react';
import {
  detectStalls,
  shareLink,
  watermark,
  offlineCache,
  summarizeRange,
  diffToolOutputs,
  shortcutMap,
  navigateLog,
  saveView,
  applyView,
  promoteToFinding,
  executionGraph,
  logSentiment,
  replaySandbox,
  fnv1a,
  integrityHash,
  verifyIntegrity,
  mergeStreams,
  densityFilter,
  densityLevels,
  foldRepeats,
  voiceNarration,
  exportSchedule,
  crossHuntCompare,
  answerFromLogs,
} from './logObservCore.js';

const DEMO_LINES = [
  {
    id: 'l1',
    ts: 1728220000000,
    level: 'info',
    module: 'recon',
    text: 'Starting subdomain enumeration for target.example.com',
  },
  {
    id: 'l2',
    ts: 1728220005000,
    level: 'info',
    module: 'recon',
    text: 'Found 12 subdomains via certificate transparency',
  },
  {
    id: 'l3',
    ts: 1728220010000,
    level: 'error',
    module: 'scanner',
    text: 'Connection refused on port 8443',
    tool: 'portscan',
    durationMs: 120,
  },
  {
    id: 'l4',
    ts: 1728220015000,
    level: 'error',
    module: 'scanner',
    text: 'Connection refused on port 8443',
    tool: 'portscan',
    durationMs: 110,
  },
  {
    id: 'l5',
    ts: 1728220500000,
    level: 'error',
    module: 'scanner',
    text: 'Connection refused on port 8443',
    tool: 'portscan',
    durationMs: 115,
  },
  {
    id: 'l6',
    ts: 1728220505000,
    level: 'finding',
    module: 'detector',
    text: 'XSS candidate on /search?q= — reflected without encoding',
    findingId: 'F-101',
    tool: 'vulnDetector',
    durationMs: 840,
  },
];

/* 51261 — Stall detection */
export function StallDetection({ lines }) {
  const [threshold, setThreshold] = useState(60000);
  const stalls = useMemo(() => detectStalls(lines, threshold), [lines, threshold]);
  return (
    <div className="lo32-card">
      <h4>Stall detection</h4>
      <div className="lo32-row">
        <input
          type="range"
          min={10000}
          max={300000}
          step={10000}
          value={threshold}
          onChange={e => setThreshold(Number(e.target.value))}
          aria-label="Stall threshold"
        />
        <span className="lo32-dim">gap &gt; {Math.round(threshold / 1000)}s</span>
      </div>
      <ul className="lo32-list">
        {stalls.map((s, i) => (
          <li key={i}>
            <span className="lo32-badge">stall</span> {Math.round(s.gapMs / 1000)}s between{' '}
            {s.afterLineId} → {s.beforeLineId}
          </li>
        ))}
      </ul>
      {stalls.length === 0 && <p className="lo32-dim">No stalls detected.</p>}
    </div>
  );
}

/* 51262 — Log sharing links */
export function LogSharing({ huntId }) {
  const [link, setLink] = useState(null);
  return (
    <div className="lo32-card">
      <h4>Log sharing links</h4>
      <button className="lo32-btn" onClick={() => setLink(shareLink(huntId))}>
        Create read-only link
      </button>
      {link && <p className="lo32-dim">{link.url} (read-only)</p>}
    </div>
  );
}

/* 51263 — Log watermarking */
export function LogWatermark({ viewer }) {
  const w = watermark(viewer);
  return (
    <div className="lo32-card">
      <h4>Log watermarking</h4>
      <p className="lo32-dim">{w.watermarkText}</p>
    </div>
  );
}

/* 51264 — Offline log cache */
export function OfflineCache({ lines }) {
  const [cache, setCache] = useState(null);
  return (
    <div className="lo32-card">
      <h4>Offline log cache</h4>
      <button className="lo32-btn" onClick={() => setCache(offlineCache(lines))}>
        Cache for offline
      </button>
      {cache && <p className="lo32-dim">{cache.count} lines cached — browsable offline</p>}
    </div>
  );
}

/* 51265 — Log summarizer */
export function LogSummarizer({ lines }) {
  const [n, setN] = useState(3);
  const summary = useMemo(() => summarizeRange(lines, n), [lines, n]);
  return (
    <div className="lo32-card">
      <h4>Log summarizer</h4>
      <div className="lo32-row">
        <input
          type="range"
          min={1}
          max={Math.max(1, lines.length)}
          value={Math.min(n, lines.length)}
          onChange={e => setN(Number(e.target.value))}
          aria-label="Summary length"
        />
        <span className="lo32-dim">top {summary.length} lines</span>
      </div>
      <ul className="lo32-list">
        {summary.map(l => (
          <li key={l.id}>{l.text}</li>
        ))}
      </ul>
    </div>
  );
}

/* 51266 — Tool output diffing */
export function OutputDiff({ a, b }) {
  const d = useMemo(() => diffToolOutputs(a, b), [a, b]);
  return (
    <div className="lo32-card">
      <h4>Tool output diffing</h4>
      <p>
        <span className="lo32-badge">+{d.addedCount}</span>{' '}
        <span className="lo32-badge">−{d.removedCount}</span>
      </p>
      <div className="lo32-log">
        {d.added.map((l, i) => (
          <div key={`a${i}`} className="lo32-added">
            + {l.text}
          </div>
        ))}
        {d.removed.map((l, i) => (
          <div key={`r${i}`} className="lo32-removed">
            − {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 51267 — Log keyboard navigation */
export function LogKeyboardNav({ lines }) {
  const [pos, setPos] = useState(-1);
  const [kind, setKind] = useState('error');
  const map = shortcutMap();
  const jump = dir => {
    const id = navigateLog(lines, pos, kind, dir, []);
    if (id) setPos(lines.findIndex(l => l.id === id));
  };
  const current = pos >= 0 ? lines[pos] : null;
  return (
    <div className="lo32-card">
      <h4>Keyboard navigation</h4>
      <div className="lo32-row">
        {['error', 'finding', 'bookmark'].map(k => (
          <button
            key={k}
            className={`lo32-btn ${kind === k ? 'lo32-btn-active' : ''}`}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
        <button className="lo32-btn" onClick={() => jump(-1)}>
          ← prev
        </button>
        <button className="lo32-btn" onClick={() => jump(1)}>
          next →
        </button>
      </div>
      <p className="lo32-dim">
        shortcuts: {map.nextError} next error · {map.nextFinding} next finding · {map.nextBookmark}{' '}
        next bookmark · {map.followTail} follow tail
      </p>
      {current && (
        <p>
          <span className="lo32-badge">{current.id}</span> {current.text}
        </p>
      )}
    </div>
  );
}

/* 51268 — Custom log views */
export function CustomViews({ lines }) {
  const [views, setViews] = useState({});
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [active, setActive] = useState(null);
  const shown = active ? applyView(lines, views[active]) : lines;
  return (
    <div className="lo32-card">
      <h4>Custom log views</h4>
      <div className="lo32-row">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="view name…"
          aria-label="View name"
        />
        <select value={level} onChange={e => setLevel(e.target.value)} aria-label="Level filter">
          <option value="">any level</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
        </select>
        <button
          className="lo32-btn"
          onClick={() => name && setViews(v => saveView(v, name, { level: level || undefined }))}
        >
          Save view
        </button>
      </div>
      <div className="lo32-row">
        {Object.keys(views).map(v => (
          <button
            key={v}
            className={`lo32-btn ${active === v ? 'lo32-btn-active' : ''}`}
            onClick={() => setActive(active === v ? null : v)}
          >
            {v}
          </button>
        ))}
      </div>
      <p className="lo32-dim">
        {shown.length} of {lines.length} lines{active ? ` (view: ${active})` : ''}
      </p>
    </div>
  );
}

/* 51269 — Log-to-finding promotion */
export function PromoteToFinding({ lines }) {
  const [drafts, setDrafts] = useState([]);
  const [sel, setSel] = useState('');
  return (
    <div className="lo32-card">
      <h4>Log-to-finding promotion</h4>
      <div className="lo32-row">
        <select value={sel} onChange={e => setSel(e.target.value)} aria-label="Line to promote">
          <option value="">pick a line…</option>
          {lines.map(l => (
            <option key={l.id} value={l.id}>
              {l.id}
            </option>
          ))}
        </select>
        <button
          className="lo32-btn"
          onClick={() => {
            const l = lines.find(x => x.id === sel);
            if (l) setDrafts(d => [...d, promoteToFinding(l)]);
          }}
        >
          Promote to draft finding
        </button>
      </div>
      <ul className="lo32-list">
        {drafts.map((d, i) => (
          <li key={i}>
            <span className="lo32-badge">draft</span> {d.title}{' '}
            <span className="lo32-dim">({d.evidence.length} evidence)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51270 — Execution graph view */
export function ExecGraph({ lines }) {
  const g = useMemo(() => executionGraph(lines), [lines]);
  return (
    <div className="lo32-card">
      <h4>
        Execution graph ({g.nodes.length} nodes, {g.edges.length} edges)
      </h4>
      <div className="lo32-graph">
        {g.nodes.map(n => (
          <span
            key={n.id}
            className={`lo32-gnode lo32-gnode-${n.level}`}
            title={`${n.tool} — ${n.durationMs ?? '?'}ms`}
          >
            {n.tool}
          </span>
        ))}
      </div>
    </div>
  );
}

/* 51271 — Log sentiment */
export function LogSentiment({ lines }) {
  const s = logSentiment(lines);
  return (
    <div className="lo32-card">
      <h4>Log sentiment</h4>
      <p>
        Phase mood: <span className={`lo32-badge lo32-sentiment-${s}`}>{s}</span>
      </p>
    </div>
  );
}

/* 51272 — Request replay sandbox */
export function ReplaySandbox({ request }) {
  const [plan, setPlan] = useState(null);
  return (
    <div className="lo32-card">
      <h4>Request replay sandbox</h4>
      <button className="lo32-btn" onClick={() => setPlan(replaySandbox(request))}>
        Prepare sandbox replay
      </button>
      {plan && (
        <div>
          <pre className="lo32-pre">{plan.curl}</pre>
          <ul className="lo32-list">
            {plan.warnings.map((w, i) => (
              <li key={i} className="lo32-dim">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* 51273 — Log integrity hash */
export function IntegrityHash({ lines }) {
  const { head, chain } = useMemo(() => integrityHash(lines), [lines]);
  const [ok, setOk] = useState(null);
  return (
    <div className="lo32-card">
      <h4>Log integrity hash</h4>
      <p className="lo32-dim">
        head: <code>{head}</code> · {chain.length} chained lines
      </p>
      <button className="lo32-btn" onClick={() => setOk(verifyIntegrity(lines, chain))}>
        Verify chain
      </button>
      {ok != null && <p>{ok ? '✅ Chain intact' : '❌ Tampering detected'}</p>}
    </div>
  );
}

/* 51274 — Parallel stream merge */
export function StreamMerge({ streams }) {
  const merged = useMemo(() => mergeStreams(streams), [streams]);
  return (
    <div className="lo32-card">
      <h4>Parallel stream merge ({merged.length} lines)</h4>
      <div className="lo32-log">
        {merged.slice(0, 12).map((l, i) => (
          <div key={i}>
            <span className="lo32-agentdot" style={{ background: l.color }} />[{l.agentName}]{' '}
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 51275 — Log density control */
export function DensityControl({ lines }) {
  const levels = densityLevels();
  const [level, setLevel] = useState('standard');
  const shown = useMemo(() => densityFilter(lines, level), [lines, level]);
  return (
    <div className="lo32-card">
      <h4>Log density control</h4>
      <div className="lo32-row" role="radiogroup" aria-label="Density">
        {levels.map(lv => (
          <button
            key={lv}
            className={`lo32-btn ${level === lv ? 'lo32-btn-active' : ''}`}
            onClick={() => setLevel(lv)}
          >
            {lv}
          </button>
        ))}
      </div>
      <p className="lo32-dim">
        {shown.length} of {lines.length} lines at “{level}”
      </p>
    </div>
  );
}

/* 51276 — Smart log folding */
export function SmartFolding({ lines }) {
  const [expanded, setExpanded] = useState({});
  const folded = useMemo(() => foldRepeats(lines), [lines]);
  return (
    <div className="lo32-card">
      <h4>Smart log folding</h4>
      <div className="lo32-log">
        {folded.map((f, i) =>
          f.type === 'fold' ? (
            <div key={i}>
              <button
                className="lo32-link"
                onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))}
              >
                {expanded[i] ? '▾' : '▸'} repeated {f.count}× — {String(f.text).slice(0, 50)}
              </button>
              {expanded[i] &&
                f.ids.map(id => (
                  <div key={id} className="lo32-dim">
                    · {f.text}
                  </div>
                ))}
            </div>
          ) : (
            <div key={i}>{f.text}</div>
          )
        )}
      </div>
    </div>
  );
}

/* 51277 — Log voice narration */
export function VoiceNarration({ lines }) {
  const [speaking, setSpeaking] = useState(false);
  const script = useMemo(() => voiceNarration(lines), [lines]);
  return (
    <div className="lo32-card">
      <h4>Log voice narration</h4>
      <button className="lo32-btn" onClick={() => setSpeaking(s => !s)}>
        {speaking ? 'Stop' : 'Narrate key events'}
      </button>
      {speaking && (
        <ul className="lo32-list">
          {script.map((t, i) => (
            <li key={i}>🔊 {t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* 51278 — Log export scheduling */
export function ExportScheduling({ phases }) {
  const plan = useMemo(() => exportSchedule(phases), [phases]);
  return (
    <div className="lo32-card">
      <h4>Log export scheduling</h4>
      <ul className="lo32-list">
        {plan.map(p => (
          <li key={p.id}>
            {p.phase} → {p.format} @ {p.destination} <span className="lo32-dim">({p.trigger})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 51279 — Cross-hunt log compare */
export function CrossHuntCompare({ a, b }) {
  const c = useMemo(() => crossHuntCompare(a, b), [a, b]);
  return (
    <div className="lo32-card">
      <h4>Cross-hunt log compare</h4>
      <p>
        <span className="lo32-badge">{c.sharedLines} shared</span>{' '}
        <span className="lo32-badge">{c.onlyInA} only A</span>{' '}
        <span className="lo32-badge">{c.onlyInB} only B</span>
      </p>
    </div>
  );
}

/* 51280 — Log-based Q&A */
export function LogQA({ lines }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  return (
    <div className="lo32-card">
      <h4>Log-based Q&A</h4>
      <div className="lo32-row">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="why did the login test fail?"
          aria-label="Question"
        />
        <button className="lo32-btn" onClick={() => setRes(answerFromLogs(q, lines))}>
          Ask
        </button>
      </div>
      {res && (
        <div>
          <p>{res.answer}</p>
          <ul className="lo32-list">
            {res.evidence.map((e, i) => (
              <li key={i} className="lo32-dim">
                [{e.lineId}] {e.text}
              </li>
            ))}
          </ul>
          {!res.grounded && <p className="lo32-dim">Try different keywords.</p>}
        </div>
      )}
    </div>
  );
}

/* Gallery showcasing all part-2 components */
export function LogObservExtrasGallery() {
  const streams = [
    { agentId: 'a1', name: 'scout', lines: DEMO_LINES.slice(0, 3) },
    { agentId: 'a2', name: 'prober', lines: DEMO_LINES.slice(3, 6) },
  ];
  return (
    <div className="lo32-gallery">
      <h3>Log observability round 3 — gallery (51261–51280)</h3>
      <StallDetection lines={DEMO_LINES} />
      <LogSharing huntId="hunt-42" />
      <LogWatermark viewer={{ id: 'u7', name: 'Asha' }} />
      <OfflineCache lines={DEMO_LINES} />
      <LogSummarizer lines={DEMO_LINES} />
      <OutputDiff a={['200 OK', 'body: hello']} b={['200 OK', 'body: hello world']} />
      <LogKeyboardNav lines={DEMO_LINES} />
      <CustomViews lines={DEMO_LINES} />
      <PromoteToFinding lines={DEMO_LINES} />
      <ExecGraph lines={DEMO_LINES} />
      <LogSentiment lines={DEMO_LINES} />
      <ReplaySandbox
        request={{
          method: 'POST',
          url: 'https://target.example.com/api/login',
          headers: { 'Content-Type': 'application/json' },
          body: { user: 'test' },
        }}
      />
      <IntegrityHash lines={DEMO_LINES} />
      <StreamMerge streams={streams} />
      <DensityControl lines={DEMO_LINES} />
      <SmartFolding
        lines={[...DEMO_LINES.slice(0, 2), ...DEMO_LINES.slice(2, 5), ...DEMO_LINES.slice(2, 5)]}
      />
      <VoiceNarration lines={DEMO_LINES} />
      <ExportScheduling phases={[{ name: 'recon' }, { name: 'detection', format: 'text' }]} />
      <CrossHuntCompare a={DEMO_LINES.slice(0, 4)} b={DEMO_LINES.slice(2, 6)} />
      <LogQA lines={DEMO_LINES} />
    </div>
  );
}
