/**
 * LiveFindingsFeed.jsx — wave 38 (ideas 51509–51520): live findings feed
 * round 1.
 * Real working components driving local state — no canned-only controls.
 * All logic comes from liveFindingsCore.js.
 * The LiveFindingsFeedGallery is exported for review only; it is not
 * mounted in app UI.
 */
import React, { useState } from 'react';
import {
  SEVERITIES,
  insertFinding,
  pushToast,
  dismissToast,
  soundCueFor,
  tickerSlice,
  liveCardPayload,
  openDrawer,
  closeDrawer,
  mergeSeverity,
  sparklinePoints,
  acknowledgeSpotlight,
  isSpotlit,
  matchFilters,
  searchFeed,
  groupFindings,
} from './liveFindingsCore.js';

function Card({ n, title, children }) {
  return (
    <div className="lf38-card" data-idea={n}>
      <div className="lf38-card-head">
        <span className="lf38-num">{n}</span>
        <h4>{title}</h4>
      </div>
      <div className="lf38-card-body">{children}</div>
    </div>
  );
}

const SAMPLE_FINDINGS = [
  {
    id: 'F-101',
    title: 'SQL injection in login',
    type: 'sql-injection',
    severity: 'critical',
    confidence: 87,
    asset: '/api/login',
    technique: 'sqli',
    evidence: ['Quote in username returned 12 rows', 'MySQL syntax error leaked in response body'],
    seq: 6,
  },
  {
    id: 'F-102',
    title: 'Reflected XSS in profile name',
    type: 'xss',
    severity: 'high',
    confidence: 72,
    asset: '/profile',
    technique: 'xss',
    evidence: ['Script tag reflected without encoding', 'Content-Security-Policy header missing'],
    seq: 5,
  },
  {
    id: 'F-103',
    title: 'SSRF in avatar fetch',
    type: 'ssrf',
    severity: 'medium',
    confidence: 64,
    asset: '/api/fetch',
    technique: 'ssrf',
    evidence: [
      'Server connected to a controlled URL',
      'Response contained an internal service banner',
    ],
    seq: 4,
  },
  {
    id: 'F-104',
    title: 'IDOR on user records',
    type: 'idor',
    severity: 'medium',
    confidence: 58,
    asset: '/api/users',
    technique: 'idor',
    evidence: ['User id 3 returned another account’s data', 'No ownership check observed'],
    seq: 3,
  },
  {
    id: 'F-105',
    title: 'Missing security headers',
    type: 'headers',
    severity: 'low',
    confidence: 91,
    asset: '/',
    technique: 'headers',
    evidence: ['No Content-Security-Policy header', 'No X-Frame-Options header'],
    seq: 2,
  },
  {
    id: 'F-106',
    title: 'Permissive CORS policy',
    type: 'cors',
    severity: 'low',
    confidence: 77,
    asset: '/api',
    technique: 'cors',
    evidence: ['Access-Control-Allow-Origin: * returned', 'Credentials accepted from any origin'],
    seq: 1,
  },
];

/* 51509 */ export function FeedCard() {
  const [feed, setFeed] = useState(SAMPLE_FINDINGS.slice());
  const [next, setNext] = useState(7);
  const add = () => {
    const f = {
      id: `F-10${next}`,
      title: 'Stored XSS in comment feed',
      type: 'xss',
      severity: 'high',
      confidence: 68,
      asset: '/comments',
      technique: 'xss',
      evidence: ['Payload persisted and executed on page reload'],
      seq: 6 + next,
    };
    setFeed(insertFinding(feed, f));
    setNext(next + 1);
  };
  return (
    <Card n="51509" title="Live findings feed">
      <div className="lf38-row">
        <button className="lf38-btn lf38-btn-primary" onClick={add}>
          Add finding
        </button>
      </div>
      <ul className="lf38-list">
        {feed.map(f => (
          <li key={f.id}>
            <span className={`lf38-badge lf38-sev-${f.severity}`}>{f.severity}</span> {f.title}
            <span className="lf38-note">
              {' '}
              seq {f.seq} · confidence {f.confidence}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51510 */ export function ToastCard() {
  const [toasts, setToasts] = useState([]);
  const [idx, setIdx] = useState(0);
  const fire = () => {
    const f = SAMPLE_FINDINGS[idx % SAMPLE_FINDINGS.length];
    setToasts(pushToast(toasts, f));
    setIdx(idx + 1);
  };
  return (
    <Card n="51510" title="Finding toast alerts">
      <div className="lf38-row">
        <button className="lf38-btn lf38-btn-primary" onClick={fire}>
          New finding
        </button>
      </div>
      <div className="lf38-toast-stack">
        {toasts.map(t => (
          <div key={t.id} className="lf38-toast" style={{ borderLeftColor: t.color }}>
            <span>
              <strong>{t.severity}</strong>: finding {t.findingId}
            </span>
            <button className="lf38-btn" onClick={() => setToasts(dismissToast(toasts, t.id))}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* 51511 */ export function SoundCard() {
  const [enabled, setEnabled] = useState({ critical: true, high: true, medium: true, low: false });
  return (
    <Card n="51511" title="Severity sound cues">
      <ul className="lf38-list">
        {SEVERITIES.map(s => {
          const cue = soundCueFor(s);
          return (
            <li key={s}>
              <label>
                <input
                  type="checkbox"
                  checked={enabled[s]}
                  onChange={e => setEnabled({ ...enabled, [s]: e.target.checked })}
                />{' '}
                {s}
              </label>
              <p className="lf38-note">
                {cue.label} · tone: {cue.tone} · cue {enabled[s] ? 'on' : 'off'}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="lf38-note">
        Descriptors only — actual audio playback is owned by the UI layer.
      </p>
    </Card>
  );
}

/* 51512 */ export function TickerCard() {
  const [feed] = useState(SAMPLE_FINDINGS.slice());
  const slice = tickerSlice(feed, 5);
  return (
    <Card n="51512" title="Findings ticker">
      <div className="lf38-ticker">{slice.map(s => s.text).join(' · ')}</div>
      <p className="lf38-note">Latest {slice.length} findings across all hunts.</p>
    </Card>
  );
}

/* 51513 */ export function LiveCardCard() {
  const [id, setId] = useState('F-101');
  const [expanded, setExpanded] = useState(false);
  const p = liveCardPayload(SAMPLE_FINDINGS.find(f => f.id === id));
  return (
    <Card n="51513" title="Live finding cards">
      <select value={id} onChange={e => setId(e.target.value)}>
        {SAMPLE_FINDINGS.map(f => (
          <option key={f.id} value={f.id}>
            {f.title}
          </option>
        ))}
      </select>
      <p>
        <strong>{p.title}</strong>
      </p>
      <div className="lf38-kv">
        <span>Severity</span>
        <span className={`lf38-badge lf38-sev-${p.severity}`}>{p.severity}</span>
      </div>
      <div className="lf38-kv">
        <span>Confidence</span>
        <span>{p.confidence}</span>
      </div>
      <div className="lf38-kv">
        <span>Evidence items</span>
        <span>{p.evidenceCount}</span>
      </div>
      <div className="lf38-row">
        <button className="lf38-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Collapse' : 'Expand'} evidence
        </button>
      </div>
      {expanded && (
        <ul className="lf38-list">
          {p.evidencePreview.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* 51514 */ export function DrawerCard() {
  const [drawer, setDrawer] = useState(closeDrawer());
  const current = SAMPLE_FINDINGS.find(f => f.id === drawer.findingId);
  return (
    <Card n="51514" title="Finding detail drawer">
      <div className="lf38-row">
        {SAMPLE_FINDINGS.slice(0, 3).map(f => (
          <button key={f.id} className="lf38-btn" onClick={() => setDrawer(openDrawer(f.id))}>
            Open {f.id}
          </button>
        ))}
      </div>
      {drawer.open && current && (
        <div className="lf38-drawer">
          <h4>{current.title}</h4>
          <div className="lf38-kv">
            <span>Severity</span>
            <span>{current.severity}</span>
          </div>
          <div className="lf38-kv">
            <span>Asset</span>
            <span>{current.asset}</span>
          </div>
          <div className="lf38-kv">
            <span>Technique</span>
            <span>{current.technique}</span>
          </div>
          <div className="lf38-kv">
            <span>Confidence</span>
            <span>{current.confidence}</span>
          </div>
          <ul className="lf38-list">
            {current.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <div className="lf38-row">
            <button className="lf38-btn lf38-btn-primary" onClick={() => setDrawer(closeDrawer())}>
              Close
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* 51515 */ export function SeverityCard() {
  const [finding, setFinding] = useState(SAMPLE_FINDINGS[1]);
  return (
    <Card n="51515" title="Real-time severity badges">
      <p>
        <strong>{finding.title}</strong>{' '}
        <span className={`lf38-badge lf38-sev-${finding.severity}`}>{finding.severity}</span>
      </p>
      <div className="lf38-row">
        {['low', 'medium', 'high', 'critical'].map(s => (
          <button
            key={s}
            className={`lf38-btn${finding.severity === s ? ' lf38-btn-primary' : ''}`}
            onClick={() => setFinding(mergeSeverity(finding, s))}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="lf38-note">Severity history: {(finding.severityHistory || []).join(' → ')}</p>
    </Card>
  );
}

/* 51516 */ export function SparkCard() {
  const [history, setHistory] = useState([45, 58, 66, 72]);
  const [value, setValue] = useState(80);
  const sp = sparklinePoints(history, 120, 40);
  return (
    <Card n="51516" title="Finding confidence sparkline">
      <svg className="lf38-spark" width={120} height={40}>
        <polyline points={sp.points} strokeWidth="2" />
      </svg>
      <div className="lf38-row">
        <input
          className="lf38-input"
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={e => setValue(Number(e.target.value))}
          aria-label="confidence value"
        />
        <button
          className="lf38-btn"
          onClick={() => setHistory([...history, Math.max(0, Math.min(100, value))])}
        >
          Add value
        </button>
      </div>
      <p className="lf38-note">History: {history.join(', ')}</p>
    </Card>
  );
}

/* 51517 */ export function SpotlightCard() {
  const [acknowledged, setAcknowledged] = useState([]);
  const newest = SAMPLE_FINDINGS[0];
  const spotlit = isSpotlit(acknowledged, newest.id);
  return (
    <Card n="51517" title="New-finding spotlight">
      {spotlit ? (
        <div className="lf38-spotlight">
          <p>
            <strong>New finding:</strong> {newest.title}
          </p>
          <p className="lf38-note">
            {newest.asset} · confidence {newest.confidence}
          </p>
          <div className="lf38-row">
            <button
              className="lf38-btn lf38-btn-primary"
              onClick={() => setAcknowledged(acknowledgeSpotlight(acknowledged, newest.id))}
            >
              Acknowledge
            </button>
          </div>
        </div>
      ) : (
        <p className="lf38-empty">Spotlight acknowledged — the feed continues below.</p>
      )}
    </Card>
  );
}

/* 51518 */ export function FilterCard() {
  const [filters, setFilters] = useState({
    severities: [],
    minConfidence: 0,
    asset: '',
    technique: '',
  });
  const toggleSev = s =>
    setFilters({
      ...filters,
      severities: filters.severities.includes(s)
        ? filters.severities.filter(x => x !== s)
        : [...filters.severities, s],
    });
  const results = SAMPLE_FINDINGS.filter(f => matchFilters(f, filters));
  const assets = [...new Set(SAMPLE_FINDINGS.map(f => f.asset))];
  const techniques = [...new Set(SAMPLE_FINDINGS.map(f => f.technique))];
  return (
    <Card n="51518" title="Finding feed filters">
      <div className="lf38-row">
        {SEVERITIES.map(s => (
          <label key={s}>
            <input
              type="checkbox"
              checked={filters.severities.includes(s)}
              onChange={() => toggleSev(s)}
            />{' '}
            {s}
          </label>
        ))}
      </div>
      <label>
        Min confidence: {filters.minConfidence}
        <input
          type="range"
          min={0}
          max={100}
          value={filters.minConfidence}
          onChange={e => setFilters({ ...filters, minConfidence: Number(e.target.value) })}
        />
      </label>
      <div className="lf38-row">
        <select
          value={filters.asset}
          onChange={e => setFilters({ ...filters, asset: e.target.value })}
        >
          <option value="">Any asset</option>
          {assets.map(a => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={filters.technique}
          onChange={e => setFilters({ ...filters, technique: e.target.value })}
        >
          <option value="">Any technique</option>
          {techniques.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <p className="lf38-note">
        {results.length} of {SAMPLE_FINDINGS.length} match.
      </p>
      <ul className="lf38-list">
        {results.map(f => (
          <li key={f.id}>
            {f.title}{' '}
            <span className="lf38-note">
              · {f.severity} · conf {f.confidence}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51519 */ export function SearchCard() {
  const [query, setQuery] = useState('login');
  const results = searchFeed(SAMPLE_FINDINGS, query);
  return (
    <Card n="51519" title="Finding feed search">
      <input
        className="lf38-input"
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="search findings"
      />
      <p className="lf38-note">
        {results.length} result{results.length === 1 ? '' : 's'} for “{query}”.
      </p>
      <ul className="lf38-list">
        {results.map(f => (
          <li key={f.id}>
            {f.title}{' '}
            <span className="lf38-note">
              · {f.asset} · {f.technique}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* 51520 */ export function GroupCard() {
  const [feed] = useState(SAMPLE_FINDINGS.slice());
  const [collapsed, setCollapsed] = useState({});
  const groups = groupFindings(feed);
  return (
    <Card n="51520" title="Finding grouping">
      {groups.map(g => (
        <div key={g.key} className="lf38-group">
          <div
            className="lf38-group-head"
            onClick={() => setCollapsed({ ...collapsed, [g.key]: !collapsed[g.key] })}
          >
            <span>
              {g.asset} · {g.type}
            </span>
            <span className="lf38-tag">{g.count}</span>
          </div>
          {!collapsed[g.key] && (
            <div className="lf38-group-body">
              <ul className="lf38-list">
                {g.findings.map(f => (
                  <li key={f.id}>
                    {f.title} <span className="lf38-note">· {f.severity}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}

// --- gallery (export only — not mounted in app UI) -------------------------------
export function LiveFindingsFeedGallery() {
  return (
    <div className="lf38-gallery">
      <h3>Wave 38 · Live findings feed (12 ideas)</h3>
      <FeedCard />
      <ToastCard />
      <SoundCard />
      <TickerCard />
      <LiveCardCard />
      <DrawerCard />
      <SeverityCard />
      <SparkCard />
      <SpotlightCard />
      <FilterCard />
      <SearchCard />
      <GroupCard />
    </div>
  );
}
