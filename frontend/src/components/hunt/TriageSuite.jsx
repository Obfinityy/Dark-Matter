/**
 * TriageSuite.jsx — Infinity AI · Dark-Matter · Wave 51
 * 36 working React components for post-hunt triage ideas 52005–52040.
 * Export-only module: components are not mounted anywhere.
 */
import React, { useState } from 'react';
import * as C from './triageCore.js';

const TRIAGE_SAMPLE = [
  { id: 'f1', title: 'Stored XSS in comment field', severity: 'high', vulnClass: 'xss', asset: 'web-app', exploitability: 0.8, confidence: 92, authRequired: false },
  { id: 'f2', title: 'IDOR on /api/orders/{id}', severity: 'critical', vulnClass: 'idor', asset: 'api', exploitability: 0.9, confidence: 85, authRequired: true },
  { id: 'f3', title: 'Open redirect on /login', severity: 'medium', vulnClass: 'open-redirect', asset: 'web-app', exploitability: 0.4, confidence: 70, authRequired: false },
  { id: 'f4', title: 'Verbose error disclosure', severity: 'low', vulnClass: 'info-disclosure', asset: 'api', exploitability: 0.2, confidence: 60, authRequired: false },
];

/* 52005 — Keyboard-driven triage queue. */
export function KeyboardTriageQueue() {
  const [st, setSt] = useState({ items: TRIAGE_SAMPLE.slice(0, 3), index: 0 });
  const [last, setLast] = useState('no key pressed yet');
  const press = (key) => {
    const r = C.applyKeyAction(st, key);
    setSt({ items: r.items, index: r.index });
    setLast(r.applied ? `key "${key}" → ${r.action}` : `key "${key}" ignored`);
  };
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52005 · Keyboard triage queue</h3>
      <ul className="tr51-list">
        {st.items.map((f, i) => (
          <li key={f.id} className="tr51-item">
            {i === st.index ? '> ' : '· '}{f.title}{f.triage ? ` — ${f.triage}` : ''}{f.read ? ' (read)' : ''}
          </li>
        ))}
      </ul>
      <div>
        {['j', 'k', 'a', 'd', 'e', 'r'].map((k) => (
          <button key={k} className="tr51-btn" onClick={() => press(k)}>{k}</button>
        ))}
      </div>
      <p className="tr51-result">last: {last}</p>
      <p className="tr51-note">j/k move · a accept · d dismiss · e escalate · r mark read</p>
    </div>
  );
}

/* 52006 — Severity-ranked triage inbox. */
export function SeverityRankedInbox() {
  const ranked = C.rankInbox(TRIAGE_SAMPLE);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52006 · Severity-ranked inbox</h3>
      <ul className="tr51-list">
        {ranked.map((f) => (
          <li key={f.id} className="tr51-item">{f.title} — score {f.triageScore} ({f.severity})</li>
        ))}
      </ul>
    </div>
  );
}

/* 52007 — Progressive-disclosure reading cards. */
export function ProgressiveReadingCards() {
  const [stage, setStage] = useState('collapsed');
  const card = C.expandCard(C.buildReadingCard({
    id: 'f1', title: 'Stored XSS in comment field',
    summary: 'User input in the comment field is rendered without escaping.',
    evidence: 'Payload <img src=x onerror=alert(1)> reflected in /comments.',
    poc: 'curl -X POST /comments -d "body=<img src=x onerror=alert(1)>"',
    remediation: 'Encode output with a context-aware encoder; add CSP.',
  }), stage);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52007 · Progressive reading card</h3>
      <div>
        {card.stages.map((s) => (
          <button key={s} className="tr51-btn" onClick={() => setStage(s)}>{s}</button>
        ))}
      </div>
      {card.stage !== 'collapsed' && <p className="tr51-result">{card.summary}</p>}
      {['evidence', 'poc', 'remediation'].includes(card.stage) && card[card.stage] && (
        <p className="tr51-result"><strong>{card.stage}:</strong> {card[card.stage]}</p>
      )}
    </div>
  );
}

/* 52008 — Vuln-class grouped inbox view. */
export function VulnClassGroups() {
  const groups = C.groupByVulnClass([
    ...TRIAGE_SAMPLE,
    { id: 'f5', title: 'Reflected XSS on /search', severity: 'high', vulnClass: 'xss', asset: 'web-app' },
  ]);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52008 · Vuln-class grouped view</h3>
      <ul className="tr51-list">
        {groups.map((g) => (
          <li key={g.vulnClass} className="tr51-item">
            {g.vulnClass} ({g.count})
            <ul className="tr51-list">
              {g.findings.map((f) => <li key={f.id} className="tr51-item">{f.title}</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52009 — Affected-asset grouped triage. */
export function AssetGroupedTriage() {
  const groups = C.groupByAsset(TRIAGE_SAMPLE);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52009 · Asset-grouped triage</h3>
      <ul className="tr51-list">
        {groups.map((g) => (
          <li key={g.asset} className="tr51-item">
            {g.asset} ({g.count})
            <ul className="tr51-list">
              {g.findings.map((f) => <li key={f.id} className="tr51-item">{f.title} ({f.severity})</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52010 — Inline evidence preview pane. */
export function EvidencePreviewPane() {
  const p = C.buildEvidencePreview({
    id: 'f1',
    httpExchanges: [
      { request: 'POST /comments HTTP/1.1', response: 'HTTP/1.1 200 OK ... <img src=x onerror=alert(1)>' },
      { request: 'GET /comments/42 HTTP/1.1', response: 'HTTP/1.1 200 OK ... stored payload rendered' },
    ],
    screenshots: ['shot-xss-comments.png'],
    payloads: ['<img src=x onerror=alert(1)>'],
  });
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52010 · Inline evidence preview</h3>
      <p className="tr51-result">{p.counts.http} HTTP exchanges · {p.counts.screenshots} screenshots · {p.counts.payloads} payloads</p>
      {p.http.map((x, i) => (
        <p key={i} className="tr51-result">{x.request} → {x.response.slice(0, 60)}…</p>
      ))}
    </div>
  );
}

/* 52011 — AI-generated finding TL;DR. */
export function FindingTldr() {
  const t = C.buildExtractiveTldr({
    id: 'f2',
    description: 'The /api/orders/{id} endpoint returns order records for any authenticated user. It does not verify that the order belongs to the requesting user. An attacker can enumerate order IDs and read other customers\u2019 orders. Fix by adding an ownership check before returning the record.',
  });
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52011 · Finding TL;DR</h3>
      <p className="tr51-result">{t.tldr}</p>
      <p className="tr51-note">{t.sentences} sentences extracted</p>
    </div>
  );
}

/* 52012 — Read/unread tracking per finding. */
export function ReadTracking() {
  const total = TRIAGE_SAMPLE.length;
  const [st, setSt] = useState(C.markRead([], null, total));
  const read = (id) => setSt(C.markRead(st.read, id, total));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52012 · Read/unread tracking</h3>
      <p className="tr51-result">{st.label} ({st.reviewed}%)</p>
      <ul className="tr51-list">
        {TRIAGE_SAMPLE.map((f) => (
          <li key={f.id} className="tr51-item">
            {st.read.includes(f.id) ? '✓ ' : '○ '}{f.title}
            {!st.read.includes(f.id) && <button className="tr51-btn" onClick={() => read(f.id)}>Mark read</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52013 — Saved triage filters. */
export function SavedFilters() {
  const [filters, setFilters] = useState([]);
  const [applied, setApplied] = useState(null);
  const save = () => setFilters(C.saveFilter(filters, 'Critical + unauthenticated', { severity: 'critical', authRequired: false }));
  const apply = (f) => setApplied({ name: f.name, matched: C.applySavedFilter(TRIAGE_SAMPLE, f) });
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52013 · Saved triage filters</h3>
      <button className="tr51-btn" onClick={save}>Save "Critical + unauthenticated"</button>
      <ul className="tr51-list">
        {filters.map((f) => (
          <li key={f.name} className="tr51-item">
            {f.name} <button className="tr51-btn" onClick={() => apply(f)}>Apply</button>
          </li>
        ))}
      </ul>
      {applied && <p className="tr51-result">{applied.name}: {applied.matched.length} findings matched</p>}
    </div>
  );
}

/* 52014 — Triage checklist per finding. */
export function TriageChecklist() {
  const [checklist, setChecklist] = useState(C.buildChecklist());
  const ready = C.canMarkReviewed(checklist);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52014 · Triage checklist</h3>
      {checklist.map((it) => (
        <label key={it.label} className="tr51-check">
          <input type="checkbox" checked={it.checked} onChange={() => setChecklist(C.toggleChecklistItem(checklist, it.label))} />
          {' '}{it.label}
        </label>
      ))}
      <p className="tr51-result">{ready ? '✓ ready to mark reviewed' : 'complete all items to mark reviewed'}</p>
    </div>
  );
}

/* 52015 — Confidence badges on findings. */
export function ConfidenceBadges() {
  const rows = [
    { id: 'f1', confidence: 92, confidenceReasons: ['response diff matched', 'payload executed'] },
    { id: 'f3', confidence: 64, confidenceReasons: ['redirect observed'] },
    { id: 'f4', confidence: 31, confidenceReasons: [] },
  ].map((f) => ({ ...f, badge: C.confidenceBadge(f) }));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52015 · Confidence badges</h3>
      <ul className="tr51-list">
        {rows.map((r) => (
          <li key={r.id} className="tr51-item">
            <span className="tr51-badge">{r.badge.band} {r.badge.confidence}%</span>
            {' '}{r.badge.reasons.join('; ') || 'no reasons recorded'}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52016 — "Needs more evidence" flag. */
export function EvidenceFlag() {
  const now = Date.now();
  const [f, setF] = useState({ id: 'f4', title: 'Verbose error disclosure', severity: 'low' });
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52016 · Needs-more-evidence flag</h3>
      <p className="tr51-result">status: {f.evidenceStatus || 'untriaged'}</p>
      {f.evidenceFlag && <p className="tr51-note">reason: {f.evidenceFlag.reason} · resolved: {String(f.evidenceFlag.resolved)}</p>}
      <button className="tr51-btn" onClick={() => setF(C.flagForEvidence(f, 'stack trace does not name the sink', now))}>Flag</button>
      <button className="tr51-btn" onClick={() => setF(C.resolveEvidenceFlag(f, now))}>Resolve</button>
    </div>
  );
}

/* 52017 — Similar-findings sidebar. */
export function SimilarFindings() {
  const r = C.findSimilar(
    { id: 'f1', title: 'Stored XSS in comment field', vulnClass: 'xss', asset: 'web-app', severity: 'high' },
    [
      { id: 'p1', title: 'XSS in search box', vulnClass: 'xss', asset: 'web-app', severity: 'high' },
      { id: 'p2', title: 'SQLi in login', vulnClass: 'sqli', asset: 'web-app', severity: 'critical' },
      { id: 'p3', title: 'XSS in profile bio', vulnClass: 'xss', asset: 'api', severity: 'medium' },
    ]
  );
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52017 · Similar findings</h3>
      <ul className="tr51-list">
        {r.similar.map((s) => <li key={s.finding.id} className="tr51-item">{s.finding.title} (score {s.score})</li>)}
      </ul>
      <p className="tr51-note">{r.count} similar findings</p>
    </div>
  );
}

/* 52018 — Triage timer with analytics. */
export function TriageTimer() {
  let sessions = [];
  sessions = C.recordDwell(sessions, 'f1', 95, 'aria');
  sessions = C.recordDwell(sessions, 'f1', 130, 'kai');
  sessions = C.recordDwell(sessions, 'f2', 240, 'aria');
  const agg = C.teamAverages(sessions);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52018 · Triage timer</h3>
      <p className="tr51-result">overall avg {agg.overallAvgSeconds}s across {agg.samples} samples</p>
      <ul className="tr51-list">
        {Object.entries(agg.perReviewer).map(([r, s]) => <li key={r} className="tr51-item">{r}: {s}s avg</li>)}
        {Object.entries(agg.perFinding).map(([f, s]) => <li key={f} className="tr51-item">{f}: {s}s avg</li>)}
      </ul>
    </div>
  );
}

/* 52019 — Quick-action hover bar. */
export function QuickActionHoverBar() {
  const actions = C.hoverActions({ id: 'f2' });
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52019 · Quick-action hover bar</h3>
      <p className="tr51-note">hovering finding f2 reveals:</p>
      <div>
        {actions.map((a) => <button key={a.id} className="tr51-btn" title={a.label}>{a.label}</button>)}
      </div>
    </div>
  );
}

/* 52020 — Review delegation (post-hunt). */
export function ReviewDelegation() {
  const d = C.delegateFindings(
    [{ id: 'f3' }, { id: 'f4' }], 'aria', 'Please double-check the redirect chain on f3.', Date.now()
  );
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52020 · Review delegation</h3>
      <p className="tr51-result">{d.findingIds.length} findings → {d.assignee}</p>
      <p className="tr51-result">note: {d.note}</p>
      <p className="tr51-note">{d.audit.length} audit entries · delegated at {d.delegatedAt}</p>
    </div>
  );
}

/* 52021 — Exploitability-first sorting. */
export function ExploitabilitySort() {
  const sorted = C.sortByExploitability(TRIAGE_SAMPLE);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52021 · Exploitability-first sorting</h3>
      <ul className="tr51-list">
        {sorted.map((f) => <li key={f.id} className="tr51-item">{f.title} — {f.exploitability}</li>)}
      </ul>
    </div>
  );
}

/* 52022 — EPSS percentile badges. */
export function EpssBadges() {
  const rows = [95, 60, 20].map((p) => C.epssBadge(p));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52022 · EPSS badges</h3>
      <ul className="tr51-list">
        {rows.map((r) => <li key={r.label} className="tr51-item"><span className="tr51-badge">{r.label}</span></li>)}
      </ul>
    </div>
  );
}

/* 52023 — Data-sensitivity badges. */
export function SensitivityBadges() {
  const rows = [
    { id: 'f2', title: 'IDOR exposes order records with card numbers', description: 'Order API leaks card data' },
    { id: 'f1', title: 'XSS leaks session email', description: 'Script reads user email addresses' },
    { id: 'f4', title: 'Verbose error disclosure', description: 'Stack traces only' },
  ].map((f) => ({ ...f, badge: C.sensitivityBadge(f) }));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52023 · Data-sensitivity badges</h3>
      <ul className="tr51-list">
        {rows.map((r) => (
          <li key={r.id} className="tr51-item">
            {r.badge.badges.map((b) => <span key={b} className="tr51-badge">{b}</span>)}
            {' '}level: {r.badge.level}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52024 — Regulatory mapping tags. */
export function RegulatoryTags() {
  const rows = TRIAGE_SAMPLE.map((f) => ({ ...f, reg: C.regulatoryTags({
    ...f, description: f.id === 'f2' ? 'Order records include card numbers' : f.title,
  }) }));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52024 · Regulatory tags</h3>
      <ul className="tr51-list">
        {rows.map((r) => (
          <li key={r.id} className="tr51-item">{r.title}: {r.reg.tags.join(', ') || 'none'}</li>
        ))}
      </ul>
    </div>
  );
}

/* 52025 — Reading-time estimates. */
export function ReadingTimeEstimates() {
  const rows = [
    { id: 'f2', title: 'IDOR on /api/orders/{id}', description: 'The endpoint returns order records for any authenticated user without an ownership check. An attacker can enumerate order IDs.', remediation: 'Add an ownership check before returning the record.' },
    { id: 'f4', title: 'Verbose error disclosure', description: 'Stack traces leak paths.' },
  ].map((f) => ({ ...f, rt: C.estimateReadingTime(f) }));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52025 · Reading-time estimates</h3>
      <ul className="tr51-list">
        {rows.map((r) => <li key={r.id} className="tr51-item">{r.title} — {r.rt.label} ({r.rt.words} words)</li>)}
      </ul>
    </div>
  );
}

/* 52026 — Distraction-free reading mode. */
export function FocusMode() {
  const spec = C.buildFocusSpec({ id: 'f2', title: 'IDOR on /api/orders/{id}' });
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52026 · Distraction-free mode</h3>
      <p className="tr51-result">chrome: {spec.chrome} · font: {spec.fontSize}</p>
      <p className="tr51-result">visible: {spec.visible.join(', ')}</p>
      <p className="tr51-note">hidden: {spec.hidden.join(', ')}</p>
    </div>
  );
}

/* 52027 — Swipe-to-triage on mobile. */
export function SwipeToTriage() {
  const [st, setSt] = useState({ queue: TRIAGE_SAMPLE.slice(0, 3), remaining: 3 });
  const swipe = (findingId, gesture) => {
    const r = C.reduceSwipe(st.queue, { findingId, swipe: gesture });
    if (r.applied) setSt({ queue: r.queue, remaining: r.remaining });
  };
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52027 · Swipe-to-triage</h3>
      <ul className="tr51-list">
        {st.queue.map((f) => (
          <li key={f.id} className="tr51-item">
            {f.title}{f.triage ? ` — ${f.triage}` : ''}
            {!f.triage && (
              <span>
                <button className="tr51-btn" onClick={() => swipe(f.id, 'swipe-right')}>→</button>
                <button className="tr51-btn" onClick={() => swipe(f.id, 'swipe-left')}>←</button>
                <button className="tr51-btn" onClick={() => swipe(f.id, 'swipe-up')}>↑</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="tr51-result">{st.remaining} remaining</p>
    </div>
  );
}

/* 52028 — Voice notes on findings. */
export function VoiceNotes() {
  const now = Date.now();
  const [f, setF] = useState({ id: 'f1', title: 'Stored XSS in comment field' });
  const [text, setText] = useState('');
  const attach = () => {
    if (!text.trim()) return;
    setF(C.attachVoiceNote(f, text, 14, now));
    setText('');
  };
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52028 · Voice notes</h3>
      <input className="tr51-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="transcript of spoken note" />
      <button className="tr51-btn" onClick={attach}>Attach note</button>
      <ul className="tr51-list">
        {(f.voiceNotes || []).map((n) => (
          <li key={n.id} className="tr51-item">{n.transcript} ({n.durationSeconds}s)</li>
        ))}
      </ul>
      <p className="tr51-note">{f.voiceNoteCount || 0} voice notes</p>
    </div>
  );
}

/* 52029 — Inline collaborator comments. */
export function InlineComments() {
  const now = Date.now();
  const [f, setF] = useState({ id: 'f2', title: 'IDOR on /api/orders/{id}' });
  const [body, setBody] = useState('');
  const add = () => {
    if (!body.trim()) return;
    setF(C.addComment(f, { author: 'aria', body, lineRef: 'response:14', mentions: ['kai'] }, now));
    setBody('');
  };
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52029 · Inline comments</h3>
      <input className="tr51-input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="comment on the evidence" />
      <button className="tr51-btn" onClick={add}>Add comment</button>
      <ul className="tr51-list">
        {(f.comments || []).map((c) => (
          <li key={c.id} className="tr51-item">
            {c.author}@{c.lineRef}: {c.body} {c.mentions.map((m) => `@${m}`).join(' ')}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52030 — Triage SLA countdown. */
export function SlaCountdown() {
  const now = Date.now();
  const rows = [
    { id: 'f2', severity: 'critical', openedAt: now - 3600000 },
    { id: 'f4', severity: 'low', openedAt: now - 200 * 3600000 },
  ].map((f) => ({ ...f, sla: C.slaCountdown(f, null, now) }));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52030 · SLA countdown</h3>
      <ul className="tr51-list">
        {rows.map((r) => (
          <li key={r.id} className="tr51-item">
            {r.id} ({r.severity}, SLA {r.sla.slaHours}h): {r.sla.display}{r.sla.breached ? ' — BREACHED' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52031 — Auto-prioritization rules. */
export function PriorityRules() {
  const rules = [
    { id: 'rule-auth-bypass', priority: 'P0', when: { vulnClass: 'idor', authRequired: true } },
    { id: 'rule-xss', priority: 'P2', when: { vulnClass: 'xss' } },
  ];
  const routed = C.applyPriorityRules(TRIAGE_SAMPLE, rules);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52031 · Auto-prioritization rules</h3>
      <ul className="tr51-list">
        {routed.map((f) => (
          <li key={f.id} className="tr51-item">{f.title} → {f.autoPriority || 'no rule'} ({f.matchedRules.join(', ') || 'none'})</li>
        ))}
      </ul>
    </div>
  );
}

/* 52032 — Custom triage columns. */
export function CustomColumns() {
  const [spec, setSpec] = useState(C.buildColumnSpec([
    { id: 'owner', label: 'Owner', width: 120 },
    { id: 'sla', label: 'SLA', width: 100 },
    { id: 'asset', label: 'Asset', width: 140 },
  ]));
  const move = (i, dir) => setSpec(C.reorderColumns(spec, i, i + dir));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52032 · Custom columns</h3>
      <ul className="tr51-list">
        {spec.columns.map((c, i) => (
          <li key={c.id} className="tr51-item">
            {c.order + 1}. {c.label} ({c.width}px)
            <button className="tr51-btn" onClick={() => move(i, -1)}>←</button>
            <button className="tr51-btn" onClick={() => move(i, 1)}>→</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52033 — Pinned findings. */
export function PinnedFindings() {
  const [pinned, setPinned] = useState(['f3']);
  const ordered = C.pinnedFirst(TRIAGE_SAMPLE, pinned);
  const toggle = (id) => setPinned(pinned.includes(id) ? C.unpinFinding(pinned, id) : C.pinFinding(pinned, id));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52033 · Pinned findings</h3>
      <ul className="tr51-list">
        {ordered.map((f) => (
          <li key={f.id} className="tr51-item">
            {pinned.includes(f.id) ? '📌 ' : ''}{f.title}
            <button className="tr51-btn" onClick={() => toggle(f.id)}>{pinned.includes(f.id) ? 'Unpin' : 'Pin'}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 52034 — Starred findings for follow-up. */
export function StarredFindings() {
  const [starred, setStarred] = useState([]);
  const toggle = (id) => setStarred(C.starFinding(starred, id).starred);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52034 · Starred findings</h3>
      <ul className="tr51-list">
        {TRIAGE_SAMPLE.map((f) => (
          <li key={f.id} className="tr51-item">
            {starred.includes(f.id) ? '★ ' : '☆ '}{f.title}
            <button className="tr51-btn" onClick={() => toggle(f.id)}>Star</button>
          </li>
        ))}
      </ul>
      <p className="tr51-note">{starred.length} starred for follow-up</p>
    </div>
  );
}

/* 52035 — Handoff notes between reviewers. */
export function HandoffNotes() {
  const h = C.buildHandoff({
    from: 'aria', to: 'kai',
    findings: [{ id: 'f1', triage: 'accepted' }, { id: 'f2' }, { id: 'f3', triage: 'dismissed' }],
    summary: 'Half-triaged: f2 still needs an ownership-check verdict.',
    openQuestions: ['Is /api/orders/{id} rate-limited?', 'Does the WAF strip the XSS payload?'],
  }, Date.now());
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52035 · Handoff notes</h3>
      <p className="tr51-result">{h.from} → {h.to} · {h.progress.triaged}/{h.progress.total} triaged</p>
      <p className="tr51-result">{h.summary}</p>
      <ul className="tr51-list">
        {h.openQuestions.map((q) => <li key={q} className="tr51-item">{q}</li>)}
      </ul>
    </div>
  );
}

/* 52036 — Severity override with audit log. */
export function SeverityOverride() {
  const now = Date.now();
  const [f, setF] = useState({ id: 'f3', title: 'Open redirect on /login', severity: 'medium' });
  const [sev, setSev] = useState('high');
  const [reason, setReason] = useState('');
  const apply = () => setF(C.overrideSeverity(f, sev, reason, 'aria', now));
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52036 · Severity override</h3>
      <p className="tr51-result">current: {f.severity}</p>
      <input className="tr51-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason (required)" />
      <button className="tr51-btn" onClick={() => setSev('high')}>high</button>
      <button className="tr51-btn" onClick={() => setSev('critical')}>critical</button>
      <button className="tr51-btn" onClick={apply}>Apply override → {sev}</button>
      {f.overrideError && <p className="tr51-note">{f.overrideError}</p>}
      <ul className="tr51-list">
        {(f.severityAudit || []).map((a, i) => (
          <li key={i} className="tr51-item">{a.from} → {a.to} by {a.reviewer}: {a.reason}</li>
        ))}
      </ul>
    </div>
  );
}

/* 52037 — Inline CVSS calculator. */
const CVSS_OPTIONS = {
  av: ['N', 'A', 'L', 'P'], ac: ['L', 'H'], pr: ['N', 'L', 'H'], ui: ['N', 'R'],
  scope: ['U', 'C'], c: ['N', 'L', 'H'], i: ['N', 'L', 'H'], a: ['N', 'L', 'H'],
};
export function CvssCalculator() {
  const [m, setM] = useState({ av: 'N', ac: 'L', pr: 'N', ui: 'N', scope: 'U', c: 'H', i: 'H', a: 'H' });
  const r = C.cvss31Score(m);
  const set = (k, v) => setM({ ...m, [k]: v });
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52037 · CVSS 3.1 calculator</h3>
      {Object.keys(CVSS_OPTIONS).map((k) => (
        <label key={k} className="tr51-check">
          {k.toUpperCase()}:{' '}
          <select value={m[k]} onChange={(e) => set(k, e.target.value)}>
            {CVSS_OPTIONS[k].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      ))}
      <p className="tr51-result">score {r.score} · {r.severity}</p>
      <p className="tr51-note">{r.vector}</p>
    </div>
  );
}

/* 52038 — Impact estimator widget. */
export function ImpactEstimator() {
  const [answers, setAnswers] = useState({ dataExposed: true, authRequired: false, userInteraction: false });
  const r = C.estimateImpact(answers);
  const flip = (k) => setAnswers({ ...answers, [k]: !answers[k] });
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52038 · Impact estimator</h3>
      {Object.keys(answers).map((k) => (
        <label key={k} className="tr51-check">
          <input type="checkbox" checked={answers[k]} onChange={() => flip(k)} /> {k}
        </label>
      ))}
      <p className="tr51-result">{r.level}: {r.statement}</p>
    </div>
  );
}

/* 52039 — Affected-user count estimate. */
export function AffectedUsers() {
  const r = C.estimateAffectedUsers({
    id: 'f2', authRequired: true,
    traffic: { dailyUsers: 20000, exposedRatio: 0.5 },
  });
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52039 · Affected-user estimate</h3>
      <p className="tr51-result">{r.label}</p>
      <p className="tr51-note">band: {r.band} · {r.dailyUsers} daily users × {r.exposedRatio} exposed</p>
    </div>
  );
}

/* 52040 — Triage session autosave. */
export function SessionAutosave() {
  const [session, setSession] = useState({ filters: { severity: 'high' }, scrollPosition: 420, openCards: ['f1'], readIds: ['f4'], queueIndex: 2 });
  const [saved, setSaved] = useState(null);
  const [restored, setRestored] = useState(null);
  return (
    <div className="tr51-card">
      <h3 className="tr51-title">52040 · Session autosave</h3>
      <button className="tr51-btn" onClick={() => setSaved(C.autosaveSession(session, Date.now()))}>Autosave</button>
      <button className="tr51-btn" onClick={() => setRestored(saved ? C.restoreSession(saved) : null)}>Restore</button>
      {saved && <p className="tr51-result">saved at {saved.savedAt} · scroll {saved.scrollPosition}px · {saved.openCards.length} open cards</p>}
      {restored && <p className="tr51-result">restored: {String(restored.restored)} · queue index {restored.queueIndex}</p>}
      <p className="tr51-note">filters: {JSON.stringify(session.filters)}</p>
    </div>
  );
}

export function TriageSuiteGallery() {
  return (
    <div className="tr51-gallery">
      <KeyboardTriageQueue /><SeverityRankedInbox /><ProgressiveReadingCards /><VulnClassGroups />
      <AssetGroupedTriage /><EvidencePreviewPane /><FindingTldr /><ReadTracking />
      <SavedFilters /><TriageChecklist /><ConfidenceBadges /><EvidenceFlag />
      <SimilarFindings /><TriageTimer /><QuickActionHoverBar /><ReviewDelegation />
      <ExploitabilitySort /><EpssBadges /><SensitivityBadges /><RegulatoryTags />
      <ReadingTimeEstimates /><FocusMode /><SwipeToTriage /><VoiceNotes />
      <InlineComments /><SlaCountdown /><PriorityRules /><CustomColumns />
      <PinnedFindings /><StarredFindings /><HandoffNotes /><SeverityOverride />
      <CvssCalculator /><ImpactEstimator /><AffectedUsers /><SessionAutosave />
    </div>
  );
}
