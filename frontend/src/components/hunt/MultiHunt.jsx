/**
 * MultiHunt.jsx — wave 47 (ideas 51841–51860): multi-hunt command center.
 *
 * 20 working components covering every idea, each driving the pure logic in
 * multiHuntCore.js with real local state. Export-only gallery (not mounted in
 * the app). Only mh47-* classes are used here.
 */
import React, { useMemo, useState } from 'react';
import {
  switchHunt, huntTabs, commandCenterMetrics, compareHunts,
  globalPause, globalResume, crossHuntChatAnswer, rankHunts,
  allocateResources, attentionSort, groupHunts, bulkSteer, bulkApprove,
  cloneHuntConfig, applyTemplate, mergeFindingsFeeds, dedupeFindings,
  healthScore, stalledAlerts, sharePool, enforceCaps, scheduleQueue,
  resolveDependencies,
} from './multiHuntCore.js';

const MIN = 60000;
const NOW = 1728307200000;

const F = (id, title, severity, signature, atMin) => ({ id, title, severity, signature, atMs: NOW - atMin * MIN });

const HUNTS = [
  {
    id: 'H-101', name: 'oct-sweep', target: 'api.example.com', phase: 'scanning', status: 'running',
    progress: 62, owner: 'bhavesh', campaignId: 'C-1', clientId: 'acme', tags: ['api', 'external'],
    startedAtMs: NOW - 180 * MIN, lastActivityMs: NOW - 2 * MIN, etaMs: 70 * MIN, priority: 1,
    budgetUsedUsd: 6.20, requestsUsed: 41000, needsAttention: false, dependencies: [],
    findings: [
      F('F-101', 'SQL injection in login', 'critical', 'sqli-login', 60),
      F('F-102', 'Reflected XSS in search', 'high', 'xss-search', 30),
      F('F-103', 'Verbose error pages', 'low', 'verbose-errors', 12),
    ],
  },
  {
    id: 'H-102', name: 'vendor-api', target: 'vendor.example.com', phase: 'recon', status: 'running',
    progress: 18, owner: 'shubham', campaignId: 'C-1', clientId: 'acme', tags: ['api', 'third-party'],
    startedAtMs: NOW - 90 * MIN, lastActivityMs: NOW - 45 * MIN, etaMs: 200 * MIN, priority: 2,
    budgetUsedUsd: 9.80, requestsUsed: 120000, needsAttention: true, blockedReason: null,
    dependencies: [{ huntId: 'H-101', gate: 'done' }],
    findings: [],
  },
  {
    id: 'H-103', name: 'shop-front', target: 'shop.example.com', phase: 'exploitation', status: 'paused',
    progress: 44, owner: 'arvind', campaignId: 'C-2', clientId: 'globex', tags: ['web'],
    startedAtMs: NOW - 240 * MIN, lastActivityMs: NOW - 300 * MIN, etaMs: 90 * MIN, priority: 3,
    budgetUsedUsd: 3.10, requestsUsed: 22000, needsAttention: false,
    dependencies: [],
    findings: [F('F-104', 'Stored XSS in reviews', 'high', 'xss-reviews', 190)],
  },
  {
    id: 'H-104', name: 'edge-cache', target: 'cdn.example.com', phase: 'recon', status: 'queued',
    progress: 0, owner: 'sukrit', campaignId: 'C-2', clientId: 'globex', tags: ['infra'],
    startedAtMs: null, lastActivityMs: null, etaMs: 150 * MIN, priority: 4,
    budgetUsedUsd: 0, requestsUsed: 0, needsAttention: false,
    dependencies: [{ huntId: 'H-103', gate: 'reporting' }],
    findings: [],
  },
];

const badgeClass = (kind) => `mh47-pill mh47-badge-${kind}`;

/* 51841 · Hunt switcher bar */
function HuntSwitcherBarCard() {
  const [activeId, setActiveId] = useState('H-101');
  const [prevId, setPrevId] = useState(null);
  const sw = useMemo(() => switchHunt(HUNTS, activeId, prevId), [activeId, prevId]);
  return (
    <div className="mh47-card">
      <h4>51841 · Hunt switcher bar</h4>
      <div className="mh47-bar">
        {HUNTS.map((h) => (
          <button key={h.id} className={`mh47-btn${h.id === activeId ? ' mh47-btn-active' : ''}`}
            onClick={() => { setPrevId(activeId); setActiveId(h.id); }}>
            {h.name}
          </button>
        ))}
      </div>
      {sw.active && <div className="mh47-note">{sw.text} Target: {sw.active.target} · Owner: {sw.active.owner}</div>}
    </div>
  );
}

/* 51842 · Hunt tabs with live badges */
function HuntTabsCard() {
  const t = useMemo(() => huntTabs(HUNTS, NOW), []);
  return (
    <div className="mh47-card">
      <h4>51842 · Hunt tabs</h4>
      <div className="mh47-bar">
        {t.tabs.map((tab) => (
          <div key={tab.id} className="mh47-tab">
            <span className="mh47-phase">{tab.name}</span>
            <span className={badgeClass(tab.badge.kind)}>{tab.badge.label}</span>
            <span className="mh47-tiny">{tab.progress}% · {tab.findings} findings</span>
          </div>
        ))}
      </div>
      <div className="mh47-tiny">{t.text}</div>
    </div>
  );
}

/* 51843 · Unified command center */
function CommandCenterCard() {
  const m = useMemo(() => commandCenterMetrics(HUNTS), []);
  return (
    <div className="mh47-card">
      <h4>51843 · Unified command center</h4>
      <div className="mh47-grid">
        <div><div className="mh47-big">{m.activeHunts}/{m.totalHunts}</div><div className="mh47-tiny">hunts running</div></div>
        <div><div className="mh47-big">{m.totalFindings}</div><div className="mh47-tiny">findings</div></div>
        <div><div className="mh47-big">{m.avgProgress}%</div><div className="mh47-tiny">avg progress</div></div>
        <div><div className="mh47-big">{m.totalEta}</div><div className="mh47-tiny">combined ETA</div></div>
      </div>
      <div className="mh47-tiny">severity: {Object.entries(m.severityBreakdown).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ') || 'none'}</div>
      <div className="mh47-tiny">{m.text}</div>
    </div>
  );
}

/* 51844 · Hunt comparison view */
function HuntCompareCard() {
  const [aId, setAId] = useState('H-101');
  const [bId, setBId] = useState('H-103');
  const c = useMemo(() => compareHunts(HUNTS.find((h) => h.id === aId), HUNTS.find((h) => h.id === bId)), [aId, bId]);
  return (
    <div className="mh47-card">
      <h4>51844 · Hunt comparison view</h4>
      <div className="mh47-bar">
        <label>A <select value={aId} onChange={(e) => setAId(e.target.value)}>{HUNTS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
        <label>B <select value={bId} onChange={(e) => setBId(e.target.value)}>{HUNTS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
      </div>
      {c.rows.map((r) => (
        <div key={r.metric} className="mh47-row"><span className="mh47-phase">{r.metric}</span>
          <span className="mh47-tiny">{r.a}</span><span className="mh47-tiny">vs</span><span className="mh47-tiny">{r.b}</span></div>
      ))}
      <div className="mh47-note">{c.text}</div>
    </div>
  );
}

/* 51845 · Global pause/resume */
function GlobalPauseCard() {
  const [hunts, setHunts] = useState(HUNTS);
  const [last, setLast] = useState('No bulk action taken yet.');
  const running = hunts.filter((h) => h.status === 'running').length;
  const paused = hunts.filter((h) => h.status === 'paused').length;
  return (
    <div className="mh47-card">
      <h4>51845 · Global pause/resume</h4>
      <div className="mh47-bar">
        <button className="mh47-btn" onClick={() => { const r = globalPause(hunts); setHunts(r.hunts); setLast(r.text); }}>Pause all running</button>
        <button className="mh47-btn" onClick={() => { const r = globalResume(hunts); setHunts(r.hunts); setLast(r.text); }}>Resume all paused</button>
        <button className="mh47-btn" onClick={() => { const r = globalPause(hunts, ['H-101']); setHunts(r.hunts); setLast(r.text); }}>Pause H-101 only</button>
      </div>
      <div className="mh47-tiny">running: {running} · paused: {paused}</div>
      {hunts.map((h) => <div key={h.id} className="mh47-row"><span className="mh47-phase">{h.name}</span><span className={badgeClass(h.status === 'running' ? 'live' : h.status)}>{h.status}</span></div>)}
      <div className="mh47-note">{last}</div>
    </div>
  );
}

/* 51846 · Cross-hunt chat */
function CrossHuntChatCard() {
  const [q, setQ] = useState('which hunts are stalled?');
  const [asked, setAsked] = useState('which hunts are stalled?');
  const answer = useMemo(() => crossHuntChatAnswer(asked, HUNTS, NOW), [asked]);
  return (
    <div className="mh47-card">
      <h4>51846 · Cross-hunt chat</h4>
      <div className="mh47-bar">
        <input className="mh47-input" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask about all hunts" />
        <button className="mh47-btn" onClick={() => setAsked(q)}>Ask</button>
      </div>
      <div className="mh47-bar">
        {['how is our progress?', 'any critical findings?', 'fleet health?'].map((s) => (
          <button key={s} className="mh47-btn" onClick={() => { setQ(s); setAsked(s); }}>{s}</button>
        ))}
      </div>
      <div className="mh47-note">{answer}</div>
    </div>
  );
}

/* 51847 · Hunt priority ranking + resource allocation */
function PriorityRankingCard() {
  const [order, setOrder] = useState(['H-101', 'H-102', 'H-103', 'H-104']);
  const [poolReq, setPoolReq] = useState(10000);
  const ranked = useMemo(() => rankHunts(HUNTS, order), [order]);
  const alloc = useMemo(() => allocateResources(ranked.hunts, { requests: poolReq, budgetUsd: 50 }), [ranked, poolReq]);
  const move = (id, dir) => {
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  return (
    <div className="mh47-card">
      <h4>51847 · Hunt priority ranking</h4>
      {ranked.hunts.map((h) => (
        <div key={h.id} className="mh47-row"><span className="mh47-phase">#{h.priority} {h.name}</span>
          <button className="mh47-btn" onClick={() => move(h.id, -1)}>Up</button>
          <button className="mh47-btn" onClick={() => move(h.id, 1)}>Down</button></div>
      ))}
      <label>Shared request pool <input type="range" min="1000" max="50000" step="1000" value={poolReq} onChange={(e) => setPoolReq(+e.target.value)} /> {poolReq.toLocaleString('en-US')}</label>
      {alloc.allocations.map((a) => (
        <div key={a.huntId} className="mh47-row"><span className="mh47-phase">{a.huntId}</span>
          <span className="mh47-track"><span className="mh47-barfill" style={{ width: `${Math.round((a.requests / Math.max(1, poolReq)) * 100)}%` }} /></span>
          <span className="mh47-tiny">{a.requests.toLocaleString('en-US')} req · ${a.budgetUsd.toFixed(2)}</span></div>
      ))}
      <div className="mh47-tiny">{alloc.text}</div>
    </div>
  );
}

/* 51848 · Attention-needed sorting */
function AttentionSortCard() {
  const s = useMemo(() => attentionSort(HUNTS, NOW), []);
  return (
    <div className="mh47-card">
      <h4>51848 · Attention-needed sorting</h4>
      {s.hunts.map((h, i) => (
        <div key={h.id} className="mh47-row"><span className="mh47-phase">#{i + 1} {h.name}</span>
          <span className={badgeClass(h.needsAttention ? 'alert' : h.status === 'running' ? 'live' : h.status)}>{h.needsAttention ? 'needs attention' : h.status}</span></div>
      ))}
      <div className="mh47-tiny">{s.text}</div>
    </div>
  );
}

/* 51849 · Hunt grouping */
function HuntGroupingCard() {
  const [key, setKey] = useState('campaign');
  const g = useMemo(() => groupHunts(HUNTS, key), [key]);
  return (
    <div className="mh47-card">
      <h4>51849 · Hunt grouping</h4>
      <label>Group by <select value={key} onChange={(e) => setKey(e.target.value)}>
        {['campaign', 'client', 'status', 'phase', 'owner'].map((k) => <option key={k} value={k}>{k}</option>)}
      </select></label>
      {g.groups.map((gr) => (
        <div key={gr.key} className="mh47-row"><span className="mh47-phase">{gr.key}</span>
          <span className="mh47-tiny">{gr.hunts} hunts · {gr.findings} findings</span>
          <span className="mh47-tiny">{gr.huntIds.join(', ')}</span></div>
      ))}
      <div className="mh47-tiny">{g.text}</div>
    </div>
  );
}

/* 51850 · Bulk steering */
function BulkSteerCard() {
  const [hunts, setHunts] = useState(HUNTS);
  const [sel, setSel] = useState(['H-101', 'H-102']);
  const [cmd, setCmd] = useState('pause');
  const [param, setParam] = useState('deep-dive');
  const [last, setLast] = useState('Select hunts and a command, then steer.');
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const apply = () => {
    const command = cmd === 'setPhase' ? { type: cmd, phase: param } : cmd === 'addTag' ? { type: cmd, tag: param } : { type: cmd };
    const r = bulkSteer(hunts, sel, command);
    setHunts(r.hunts);
    setLast(r.text);
  };
  return (
    <div className="mh47-card">
      <h4>51850 · Bulk steering</h4>
      <div className="mh47-bar">
        {hunts.map((h) => (
          <label key={h.id} className="mh47-tiny"><input type="checkbox" checked={sel.includes(h.id)} onChange={() => toggle(h.id)} /> {h.name} ({h.status})</label>
        ))}
      </div>
      <div className="mh47-bar">
        <select value={cmd} onChange={(e) => setCmd(e.target.value)}>
          {['pause', 'resume', 'setPhase', 'addTag', 'setPriority'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(cmd === 'setPhase' || cmd === 'addTag') && <input className="mh47-input" value={param} onChange={(e) => setParam(e.target.value)} aria-label="Command parameter" />}
        <button className="mh47-btn" onClick={apply}>Steer selected</button>
      </div>
      <div className="mh47-note">{last}</div>
    </div>
  );
}

/* 51851 · Bulk approvals */
function BulkApprovalsCard() {
  const [queue, setQueue] = useState([
    { id: 'A-1', huntId: 'H-101', kind: 'intrusive-test', summary: 'Active SQLi probes on /login' },
    { id: 'A-2', huntId: 'H-102', kind: 'intrusive-test', summary: 'Active SQLi probes on /api/search' },
    { id: 'A-3', huntId: 'H-103', kind: 'rate-limit', summary: 'Raise request rate to 50/s' },
  ]);
  const [last, setLast] = useState('Queue awaiting a bulk decision.');
  const decide = (decision) => {
    const r = bulkApprove(queue, decision, NOW);
    setLast(r.text);
    setQueue([]);
  };
  return (
    <div className="mh47-card">
      <h4>51851 · Bulk approvals</h4>
      {queue.map((q) => <div key={q.id} className="mh47-row"><span className="mh47-phase">{q.id} · {q.huntId}</span><span className="mh47-tiny">{q.kind} — {q.summary}</span></div>)}
      <div className="mh47-bar">
        <button className="mh47-btn" onClick={() => decide('approved')}>Approve all</button>
        <button className="mh47-btn" onClick={() => decide('rejected')}>Reject all</button>
      </div>
      <div className="mh47-note">{last}</div>
    </div>
  );
}

/* 51852 · Hunt cloning */
function HuntCloneCard() {
  const [id, setId] = useState('H-101');
  const c = useMemo(() => cloneHuntConfig(HUNTS.find((h) => h.id === id)), [id]);
  return (
    <div className="mh47-card">
      <h4>51852 · Hunt cloning</h4>
      <label>Clone <select value={id} onChange={(e) => setId(e.target.value)}>{HUNTS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
      <div className="mh47-note">{c.text}</div>
      <div className="mh47-tiny">sibling id: {c.hunt.id} · status: {c.hunt.status} · findings: {c.hunt.findings.length} · progress: {c.hunt.progress}%</div>
    </div>
  );
}

/* 51853 · Hunt templates */
function HuntTemplateCard() {
  const [name, setName] = useState('API Sweep');
  const [target, setTarget] = useState('api.example.com');
  const [strategy, setStrategy] = useState('balanced');
  const t = useMemo(() => applyTemplate({
    name, target, strategy, scope: 'api/*', budgetCapUsd: 25,
    tags: ['api'], phases: ['recon', 'scanning', 'exploitation', 'reporting'],
  }), [name, target, strategy]);
  return (
    <div className="mh47-card">
      <h4>51853 · Hunt templates</h4>
      <div className="mh47-bar">
        <label>Template <input className="mh47-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Target <input className="mh47-input" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
        <label>Strategy <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
          <option value="balanced">balanced</option><option value="depth">depth</option><option value="breadth">breadth</option>
        </select></label>
      </div>
      <div className="mh47-note">{t.text}</div>
      <div className="mh47-tiny">new hunt id: {t.hunt.id} · phases: {t.hunt.phases.join(' → ')}</div>
    </div>
  );
}

/* 51854 · Cross-hunt findings feed */
function FindingsFeedCard() {
  const [sev, setSev] = useState('all');
  const feed = useMemo(() => mergeFindingsFeeds(HUNTS), []);
  const rows = feed.feed.filter((f) => sev === 'all' || f.severity === sev);
  return (
    <div className="mh47-card">
      <h4>51854 · Cross-hunt findings feed</h4>
      <label>Severity <select value={sev} onChange={(e) => setSev(e.target.value)}>
        {['all', 'critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s}</option>)}
      </select></label>
      {rows.map((f) => (
        <div key={`${f.huntId}-${f.id}`} className="mh47-row"><span className="mh47-phase">{f.huntName}</span>
          <span className={`mh47-pill mh47-sev-${f.severity}`}>{f.severity}</span>
          <span className="mh47-tiny">{f.title}</span></div>
      ))}
      <div className="mh47-tiny">{feed.text}</div>
    </div>
  );
}

/* 51855 · Cross-hunt deduplication */
function DedupCard() {
  const d = useMemo(() => dedupeFindings(mergeFindingsFeeds(HUNTS).feed), []);
  return (
    <div className="mh47-card">
      <h4>51855 · Cross-hunt deduplication</h4>
      <div className="mh47-tiny">{d.text}</div>
      {d.groups.map((g) => (
        <div key={g.signature} className="mh47-row"><span className="mh47-phase">{g.signature}</span>
          <span className="mh47-tiny">{g.findingIds.length} occurrence{g.findingIds.length === 1 ? '' : 's'}</span>
          {g.hunts.length > 1 && <span className="mh47-pill mh47-badge-alert">cross-hunt: {g.hunts.join(', ')}</span>}</div>
      ))}
    </div>
  );
}

/* 51856 · Hunt health scores */
function HealthScoreCard() {
  const rows = useMemo(() => HUNTS.map((h) => ({ h, s: healthScore(h, NOW) })), []);
  return (
    <div className="mh47-card">
      <h4>51856 · Hunt health scores</h4>
      {rows.map(({ h, s }) => (
        <div key={h.id} className="mh47-row"><span className="mh47-phase">{h.name}</span>
          <span className="mh47-track"><span className={`mh47-barfill mh47-health-${s.label}`} style={{ width: `${s.score}%` }} /></span>
          <span className={`mh47-pill mh47-health-${s.label}`}>{s.score} · {s.label}</span></div>
      ))}
      {rows.map(({ h, s }) => s.reasons.length > 0 && (
        <div key={`${h.id}-r`} className="mh47-tiny">{h.name}: {s.reasons.join('; ')}</div>
      ))}
    </div>
  );
}

/* 51857 · Stalled-hunt alerts */
function StalledAlertsCard() {
  const a = useMemo(() => stalledAlerts(HUNTS, NOW), []);
  return (
    <div className="mh47-card">
      <h4>51857 · Stalled-hunt alerts</h4>
      {a.alerts.length === 0 && <div className="mh47-tiny">{a.text}</div>}
      {a.alerts.map((al) => (
        <div key={al.huntId} className={`mh47-note mh47-lvl-${al.severity === 'critical' ? 'crit' : 'warn'}`}>
          {al.name} went quiet {al.quietFor} ago — severity {al.severity}.
        </div>
      ))}
      <div className="mh47-tiny">{a.text}</div>
    </div>
  );
}

/* 51858 · Hunt resource sharing */
function ResourcePoolCard() {
  const [totalReq, setTotalReq] = useState(200000);
  const alloc = useMemo(() => allocateResources(HUNTS, { requests: 10000, budgetUsd: 50 }), []);
  const pool = useMemo(() => sharePool({ id: 'P-1', name: 'core fleet', totalRequests: totalReq, totalBudgetUsd: 60 }, alloc.allocations), [totalReq, alloc]);
  return (
    <div className="mh47-card">
      <h4>51858 · Hunt resource sharing</h4>
      <label>Pool size <input type="range" min="20000" max="400000" step="10000" value={totalReq} onChange={(e) => setTotalReq(+e.target.value)} /> {totalReq.toLocaleString('en-US')} requests</label>
      {pool.rows.map((r) => <div key={r.huntId} className="mh47-row"><span className="mh47-phase">{r.huntId}</span><span className="mh47-tiny">{r.requests.toLocaleString('en-US')} req · ${r.budgetUsd.toFixed(2)}</span></div>)}
      <div className={`mh47-note${pool.over ? ' mh47-lvl-crit' : ''}`}>{pool.text}</div>
    </div>
  );
}

/* 51859 · Per-hunt resource caps */
function ResourceCapsCard() {
  const [capUsd, setCapUsd] = useState(8);
  const r = useMemo(() => enforceCaps(HUNTS, { 'H-102': { maxBudgetUsd: capUsd, maxRequests: 100000 } }), [capUsd]);
  return (
    <div className="mh47-card">
      <h4>51859 · Per-hunt resource caps</h4>
      <label>H-102 budget cap <input type="range" min="1" max="15" step="0.5" value={capUsd} onChange={(e) => setCapUsd(+e.target.value)} /> ${capUsd.toFixed(2)}</label>
      {r.violations.length === 0 && <div className="mh47-tiny">{r.text}</div>}
      {r.violations.map((v, i) => (
        <div key={i} className="mh47-note mh47-lvl-warn">{v.huntId}: {v.metric} used {v.used} exceeds cap {v.cap} — clamped, flagged for attention.</div>
      ))}
      <div className="mh47-tiny">{r.text}</div>
    </div>
  );
}

/* 51860 · Hunt scheduling + dependency resolution */
function ScheduleQueueCard() {
  const queue = useMemo(() => [
    { huntId: 'H-101', position: 0 },
    { huntId: 'H-104', position: 1, after: ['H-103'] },
    { huntId: 'H-102', position: 2, after: ['H-101'] },
  ], []);
  const s = useMemo(() => scheduleQueue(queue), [queue]);
  const d = useMemo(() => resolveDependencies(HUNTS), []);
  return (
    <div className="mh47-card">
      <h4>51860 · Hunt scheduling</h4>
      <div className="mh47-tiny">Queue order: {s.order.join(' → ')}</div>
      {s.waiting.map((w) => <div key={w.huntId} className="mh47-tiny">{w.huntId} waits on {w.after.join(', ')}</div>)}
      <div className="mh47-tiny">Dependency start order: {d.order.join(' → ')}</div>
      {d.gates.map((g, i) => (
        <div key={i} className="mh47-row"><span className="mh47-phase">{g.huntId} → {g.depId} ({g.gate})</span>
          <span className={g.satisfied ? 'mh47-pill mh47-lvl-ok' : 'mh47-pill mh47-badge-alert'}>{g.satisfied ? 'gate met' : 'waiting'}</span></div>
      ))}
      <div className="mh47-tiny">{d.text}</div>
    </div>
  );
}

export const MultiHuntGallery = [
  { id: 51841, name: 'HuntSwitcherBarCard', render: <HuntSwitcherBarCard /> },
  { id: 51842, name: 'HuntTabsCard', render: <HuntTabsCard /> },
  { id: 51843, name: 'CommandCenterCard', render: <CommandCenterCard /> },
  { id: 51844, name: 'HuntCompareCard', render: <HuntCompareCard /> },
  { id: 51845, name: 'GlobalPauseCard', render: <GlobalPauseCard /> },
  { id: 51846, name: 'CrossHuntChatCard', render: <CrossHuntChatCard /> },
  { id: 51847, name: 'PriorityRankingCard', render: <PriorityRankingCard /> },
  { id: 51848, name: 'AttentionSortCard', render: <AttentionSortCard /> },
  { id: 51849, name: 'HuntGroupingCard', render: <HuntGroupingCard /> },
  { id: 51850, name: 'BulkSteerCard', render: <BulkSteerCard /> },
  { id: 51851, name: 'BulkApprovalsCard', render: <BulkApprovalsCard /> },
  { id: 51852, name: 'HuntCloneCard', render: <HuntCloneCard /> },
  { id: 51853, name: 'HuntTemplateCard', render: <HuntTemplateCard /> },
  { id: 51854, name: 'FindingsFeedCard', render: <FindingsFeedCard /> },
  { id: 51855, name: 'DedupCard', render: <DedupCard /> },
  { id: 51856, name: 'HealthScoreCard', render: <HealthScoreCard /> },
  { id: 51857, name: 'StalledAlertsCard', render: <StalledAlertsCard /> },
  { id: 51858, name: 'ResourcePoolCard', render: <ResourcePoolCard /> },
  { id: 51859, name: 'ResourceCapsCard', render: <ResourceCapsCard /> },
  { id: 51860, name: 'ScheduleQueueCard', render: <ScheduleQueueCard /> },
];

export default MultiHuntGallery;
