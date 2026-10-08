/**
 * HuntOps.jsx — wave 47 (ideas 51861–51880): hunt operations across the fleet.
 *
 * 20 working components covering every idea, each driving the pure logic in
 * huntOpsCore.js with real local state. Export-only gallery (not mounted in
 * the app). Only ho47-* classes are used here.
 */
import React, { useMemo, useState } from 'react';
import {
  dependencyGates,
  campaignRollup,
  clientRollup,
  searchHunts,
  filterHunts,
  archiveHunt,
  reopenHunt,
  favoriteHunt,
  unfavoriteHunt,
  notificationsHub,
  routeNotifications,
  assignOwner,
  transferOwnership,
  inviteCollaborator,
  activityFeed,
  timelineCompare,
  addHuntNote,
  tagHunt,
  applySavedView,
  bulkExport,
  issueApiToken,
  webhookPayload,
  ssoScope,
  escapeHtml,
} from './huntOpsCore.js';

const MIN = 60000;
const NOW = 1728307200000;

const F = (id, title, severity, signature, atMin) => ({
  id,
  title,
  severity,
  signature,
  atMs: NOW - atMin * MIN,
});

const HUNTS = [
  {
    id: 'H-101',
    name: 'oct-sweep',
    target: 'api.example.com',
    phase: 'scanning',
    status: 'running',
    progress: 62,
    owner: 'bhavesh',
    campaignId: 'C-1',
    clientId: 'acme',
    tags: ['api', 'external'],
    durationMs: 180 * MIN,
    budgetUsedUsd: 6.2,
    archived: false,
    favorite: true,
    dependencies: [],
    notes: [{ author: 'bhavesh', body: 'Login flow looks promising.', atMs: NOW - 50 * MIN }],
    collaborators: [{ user: 'shubham', role: 'analyst', invitedAtMs: NOW - 100 * MIN }],
    findings: [
      F('F-101', 'SQL injection in login', 'critical', 'sqli-login', 60),
      F('F-102', 'Reflected XSS in search', 'high', 'xss-search', 30),
    ],
  },
  {
    id: 'H-102',
    name: 'vendor-api',
    target: 'vendor.example.com',
    phase: 'recon',
    status: 'running',
    progress: 18,
    owner: 'shubham',
    campaignId: 'C-1',
    clientId: 'acme',
    tags: ['api'],
    durationMs: 90 * MIN,
    budgetUsedUsd: 9.8,
    archived: false,
    favorite: false,
    dependencies: [{ huntId: 'H-101', gate: 'done' }],
    notes: [],
    collaborators: [],
    findings: [],
  },
  {
    id: 'H-103',
    name: 'shop-front',
    target: 'shop.example.com',
    phase: 'reporting',
    status: 'done',
    progress: 100,
    owner: 'arvind',
    campaignId: 'C-2',
    clientId: 'globex',
    tags: ['web'],
    durationMs: 300 * MIN,
    budgetUsedUsd: 11.4,
    archived: false,
    favorite: false,
    dependencies: [],
    notes: [],
    collaborators: [],
    findings: [F('F-103', 'Stored XSS in reviews', 'high', 'xss-reviews', 250)],
  },
];

const NOTIFICATIONS = [
  {
    id: 'N-1',
    huntId: 'H-101',
    severity: 'critical',
    type: 'finding',
    title: 'Critical finding in oct-sweep',
    atMs: NOW - 30 * MIN,
    read: false,
  },
  {
    id: 'N-2',
    huntId: 'H-102',
    severity: 'warning',
    type: 'stalled',
    title: 'vendor-api went quiet',
    atMs: NOW - 45 * MIN,
    read: false,
  },
  {
    id: 'N-3',
    huntId: 'H-103',
    severity: 'info',
    type: 'done',
    title: 'shop-front finished reporting',
    atMs: NOW - 120 * MIN,
    read: true,
  },
];

const EVENTS = [
  {
    atMs: NOW - 10 * MIN,
    actor: 'bhavesh',
    huntId: 'H-101',
    action: 'steer',
    detail: 'Focused on /login',
  },
  {
    atMs: NOW - 30 * MIN,
    actor: 'system',
    huntId: 'H-101',
    action: 'finding',
    detail: 'Critical: SQL injection in login',
  },
  {
    atMs: NOW - 45 * MIN,
    actor: 'system',
    huntId: 'H-102',
    action: 'stalled',
    detail: 'No activity for 20 minutes',
  },
  {
    atMs: NOW - 120 * MIN,
    actor: 'arvind',
    huntId: 'H-103',
    action: 'report',
    detail: 'Draft report ready',
  },
];

/* 51861 · Hunt dependencies */
function DependencyGatesCard() {
  const d = useMemo(() => dependencyGates(HUNTS), []);
  return (
    <div className="ho47-card">
      <h4>51861 · Hunt dependencies</h4>
      {d.rows.length === 0 && <div className="ho47-tiny">{d.text}</div>}
      {d.rows.map(r => (
        <div key={r.huntId} className="ho47-row">
          <span className="ho47-phase">{r.name}</span>
          {r.gates.map((g, i) => (
            <span
              key={i}
              className={g.satisfied ? 'ho47-pill ho47-lvl-ok' : 'ho47-pill ho47-badge-alert'}
            >
              {g.depId} · {g.gate} · {g.satisfied ? 'met' : 'waiting'}
            </span>
          ))}
          <span className={r.blocked ? 'ho47-pill ho47-badge-alert' : 'ho47-pill ho47-lvl-ok'}>
            {r.blocked ? 'blocked' : 'ready'}
          </span>
        </div>
      ))}
      <div className="ho47-tiny">{d.text}</div>
    </div>
  );
}

/* 51862 · Campaign view */
function CampaignRollupCard() {
  const [cid, setCid] = useState('C-1');
  const c = useMemo(() => campaignRollup(HUNTS, cid), [cid]);
  return (
    <div className="ho47-card">
      <h4>51862 · Campaign view</h4>
      <label>
        Campaign{' '}
        <select value={cid} onChange={e => setCid(e.target.value)}>
          {['C-1', 'C-2'].map(x => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
      <div className="ho47-grid">
        <div>
          <div className="ho47-big">{c.hunts}</div>
          <div className="ho47-tiny">hunts</div>
        </div>
        <div>
          <div className="ho47-big">{c.findings}</div>
          <div className="ho47-tiny">findings</div>
        </div>
        <div>
          <div className="ho47-big">{c.avgProgress}%</div>
          <div className="ho47-tiny">avg progress</div>
        </div>
        <div>
          <div className="ho47-big">${c.totalCostUsd.toFixed(2)}</div>
          <div className="ho47-tiny">spent</div>
        </div>
      </div>
      <div className="ho47-tiny">{c.huntIds.join(', ')}</div>
      <div className="ho47-tiny">{c.text}</div>
    </div>
  );
}

/* 51863 · Client view */
function ClientRollupCard() {
  const [cid, setCid] = useState('acme');
  const c = useMemo(() => clientRollup(HUNTS, cid), [cid]);
  return (
    <div className="ho47-card">
      <h4>51863 · Client view</h4>
      <label>
        Client{' '}
        <select value={cid} onChange={e => setCid(e.target.value)}>
          {['acme', 'globex'].map(x => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
      <div className="ho47-grid">
        <div>
          <div className="ho47-big">{c.hunts}</div>
          <div className="ho47-tiny">hunts</div>
        </div>
        <div>
          <div className="ho47-big">{c.findings}</div>
          <div className="ho47-tiny">findings</div>
        </div>
        <div>
          <div className="ho47-big">{c.totalTimeHrs}h</div>
          <div className="ho47-tiny">hunt time</div>
        </div>
        <div>
          <div className="ho47-big">${c.totalCostUsd.toFixed(2)}</div>
          <div className="ho47-tiny">spent</div>
        </div>
      </div>
      <div className="ho47-tiny">
        severity:{' '}
        {Object.entries(c.bySeverity)
          .filter(([, n]) => n)
          .map(([k, n]) => `${k} ${n}`)
          .join(' · ') || 'none'}
      </div>
      <div className="ho47-tiny">{c.text}</div>
    </div>
  );
}

/* 51864 · Hunt search */
function HuntSearchCard() {
  const [q, setQ] = useState('api');
  const r = useMemo(() => searchHunts(HUNTS, q), [q]);
  return (
    <div className="ho47-card">
      <h4>51864 · Hunt search</h4>
      <input
        className="ho47-input"
        value={q}
        onChange={e => setQ(e.target.value)}
        aria-label="Search hunts"
      />
      {r.results.map(h => (
        <div key={h.id} className="ho47-row">
          <span className="ho47-phase">{h.name}</span>
          <span className="ho47-tiny">
            {h.target} · {h.phase} · {h.status}
          </span>
        </div>
      ))}
      <div className="ho47-tiny">{r.text}</div>
    </div>
  );
}

/* 51865 · Hunt filters */
function HuntFiltersCard() {
  const [phase, setPhase] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const r = useMemo(
    () =>
      filterHunts(HUNTS, {
        ...(phase ? { phase } : {}),
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
      }),
    [phase, status, severity]
  );
  return (
    <div className="ho47-card">
      <h4>51865 · Hunt filters</h4>
      <div className="ho47-bar">
        <label>
          Phase{' '}
          <select value={phase} onChange={e => setPhase(e.target.value)}>
            <option value="">any</option>
            {['recon', 'scanning', 'exploitation', 'reporting'].map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status{' '}
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">any</option>
            {['running', 'paused', 'queued', 'done'].map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Finding severity{' '}
          <select value={severity} onChange={e => setSeverity(e.target.value)}>
            <option value="">any</option>
            {['critical', 'high', 'medium', 'low'].map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {r.results.map(h => (
        <div key={h.id} className="ho47-row">
          <span className="ho47-phase">{h.name}</span>
          <span className="ho47-tiny">
            {h.phase} · {h.status} · {(h.findings || []).length} findings
          </span>
        </div>
      ))}
      <div className="ho47-tiny">{r.text}</div>
    </div>
  );
}

/* 51866 · Hunt archiving */
function ArchiveCard() {
  const [hunts, setHunts] = useState(HUNTS);
  const [last, setLast] = useState('Archived hunts stay instantly reopenable.');
  return (
    <div className="ho47-card">
      <h4>51866 · Hunt archiving</h4>
      {hunts.map(h => (
        <div key={h.id} className="ho47-row">
          <span className="ho47-phase">{h.name}</span>
          <span className={h.archived ? 'ho47-pill ho47-badge-paused' : 'ho47-pill ho47-lvl-ok'}>
            {h.archived ? 'archived' : 'active'}
          </span>
          {h.archived ? (
            <button
              className="ho47-btn"
              onClick={() => {
                const r = reopenHunt(hunts, h.id);
                setHunts(r.hunts);
                setLast(r.text);
              }}
            >
              Reopen
            </button>
          ) : (
            <button
              className="ho47-btn"
              onClick={() => {
                const r = archiveHunt(hunts, h.id);
                setHunts(r.hunts);
                setLast(r.text);
              }}
            >
              Archive
            </button>
          )}
        </div>
      ))}
      <div className="ho47-note">{last}</div>
    </div>
  );
}

/* 51867 · Hunt favorites */
function FavoritesCard() {
  const [hunts, setHunts] = useState(HUNTS);
  const favs = hunts.filter(h => h.favorite);
  return (
    <div className="ho47-card">
      <h4>51867 · Hunt favorites</h4>
      <div className="ho47-tiny">Pinned: {favs.map(h => h.name).join(', ') || 'none'}</div>
      {hunts.map(h => (
        <div key={h.id} className="ho47-row">
          <span className="ho47-phase">
            {h.favorite ? 'Pinned: ' : ''}
            {h.name}
          </span>
          {h.favorite ? (
            <button
              className="ho47-btn"
              onClick={() => setHunts(unfavoriteHunt(hunts, h.id).hunts)}
            >
              Unpin
            </button>
          ) : (
            <button className="ho47-btn" onClick={() => setHunts(favoriteHunt(hunts, h.id).hunts)}>
              Pin
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* 51868 · Hunt notifications hub */
function NotificationsHubCard() {
  const [notes, setNotes] = useState(NOTIFICATIONS);
  const hub = useMemo(() => notificationsHub(notes), [notes]);
  return (
    <div className="ho47-card">
      <h4>51868 · Hunt notifications hub</h4>
      <div className="ho47-tiny">{hub.text}</div>
      {hub.items.map(n => (
        <div key={n.id} className="ho47-row">
          <span className={`ho47-pill ho47-sev-${n.severity}`}>{n.severity}</span>
          <span className="ho47-phase">{n.title}</span>
          <span className="ho47-tiny">
            {n.huntId}
            {n.read ? '' : ' · unread'}
          </span>
          {!n.read && (
            <button
              className="ho47-btn"
              onClick={() =>
                setNotes(ns => ns.map(x => (x.id === n.id ? { ...x, read: true } : x)))
              }
            >
              Mark read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* 51869 · Notification routing */
function RoutingRulesCard() {
  const rules = useMemo(
    () => [
      {
        id: 'R-1',
        match: { severity: 'critical' },
        channels: ['slack', 'inapp'],
        recipients: ['oncall'],
      },
      { id: 'R-2', match: { huntId: 'H-102' }, channels: ['inapp'], recipients: ['shubham'] },
      { id: 'R-3', match: { type: 'done' }, channels: ['email'], recipients: ['team'] },
    ],
    []
  );
  const [nid, setNid] = useState('N-1');
  const routed = useMemo(
    () =>
      routeNotifications(
        rules,
        NOTIFICATIONS.find(n => n.id === nid)
      ),
    [rules, nid]
  );
  return (
    <div className="ho47-card">
      <h4>51869 · Notification routing</h4>
      <label>
        Alert{' '}
        <select value={nid} onChange={e => setNid(e.target.value)}>
          {NOTIFICATIONS.map(n => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      </label>
      {routed.routes.map(r => (
        <div key={r.ruleId} className="ho47-row">
          <span className="ho47-phase">{r.ruleId}</span>
          <span className="ho47-tiny">
            channels: {r.channels.join(', ')} → {r.recipients.join(', ')}
          </span>
        </div>
      ))}
      <div className="ho47-tiny">{routed.text}</div>
    </div>
  );
}

/* 51870 · Hunt ownership */
function OwnershipCard() {
  const [hunts, setHunts] = useState(HUNTS);
  const [id, setId] = useState('H-101');
  const [owner, setOwner] = useState('sukrit');
  const [last, setLast] = useState('Assign or transfer ownership cleanly.');
  return (
    <div className="ho47-card">
      <h4>51870 · Hunt ownership</h4>
      {hunts.map(h => (
        <div key={h.id} className="ho47-row">
          <span className="ho47-phase">{h.name}</span>
          <span className="ho47-tiny">owner: {h.owner || 'unassigned'}</span>
        </div>
      ))}
      <div className="ho47-bar">
        <label>
          Hunt{' '}
          <select value={id} onChange={e => setId(e.target.value)}>
            {hunts.map(h => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          New owner{' '}
          <input className="ho47-input" value={owner} onChange={e => setOwner(e.target.value)} />
        </label>
        <button
          className="ho47-btn"
          onClick={() => {
            const r = transferOwnership(hunts, id, owner, NOW);
            setHunts(r.hunts);
            setLast(r.text);
          }}
        >
          Transfer
        </button>
      </div>
      <div className="ho47-note">{last}</div>
    </div>
  );
}

/* 51871 · Hunt collaboration */
function CollaborationCard() {
  const [hunts, setHunts] = useState(HUNTS);
  const [id, setId] = useState('H-101');
  const [user, setUser] = useState('sukrit');
  const [role, setRole] = useState('analyst');
  const [last, setLast] = useState('Invite a teammate with a role.');
  const invite = () => {
    const hunt = hunts.find(h => h.id === id);
    const r = inviteCollaborator(hunt, user, role, NOW);
    if (!r.ok) {
      setLast(r.error);
      return;
    }
    setHunts(hunts.map(h => (h.id === id ? r.hunt : h)));
    setLast(r.text);
  };
  const hunt = hunts.find(h => h.id === id);
  return (
    <div className="ho47-card">
      <h4>51871 · Hunt collaboration</h4>
      <label>
        Hunt{' '}
        <select value={id} onChange={e => setId(e.target.value)}>
          {hunts.map(h => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </label>
      <div className="ho47-tiny">
        Team:{' '}
        {(hunt.collaborators || []).map(c => `${c.user} (${c.role})`).join(', ') || 'owner only'}
      </div>
      <div className="ho47-bar">
        <label>
          User <input className="ho47-input" value={user} onChange={e => setUser(e.target.value)} />
        </label>
        <label>
          Role{' '}
          <select value={role} onChange={e => setRole(e.target.value)}>
            <option value="viewer">viewer</option>
            <option value="analyst">analyst</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <button className="ho47-btn" onClick={invite}>
          Invite
        </button>
      </div>
      <div className="ho47-note">{last}</div>
    </div>
  );
}

/* 51872 · Hunt activity feed */
function ActivityFeedCard() {
  const feed = useMemo(() => activityFeed(EVENTS), []);
  return (
    <div className="ho47-card">
      <h4>51872 · Hunt activity feed</h4>
      {feed.items.map((e, i) => (
        <div key={i} className="ho47-row">
          <span className="ho47-phase">
            {e.actor} · {e.huntId}
          </span>
          <span className="ho47-tiny">
            {e.action} — {e.detail}
          </span>
        </div>
      ))}
      <div className="ho47-tiny">{feed.text}</div>
    </div>
  );
}

/* 51873 · Hunt timeline compare */
function TimelineCompareCard() {
  const a = useMemo(
    () => ({
      id: 'H-101',
      samples: [
        { atMs: 0, progress: 0 },
        { atMs: 60 * MIN, progress: 30 },
        { atMs: 120 * MIN, progress: 62 },
      ],
    }),
    []
  );
  const b = useMemo(
    () => ({
      id: 'H-103',
      samples: [
        { atMs: 0, progress: 0 },
        { atMs: 60 * MIN, progress: 45 },
        { atMs: 120 * MIN, progress: 70 },
      ],
    }),
    []
  );
  const t = useMemo(() => timelineCompare(a, b), [a, b]);
  return (
    <div className="ho47-card">
      <h4>51873 · Hunt timeline compare</h4>
      {t.rows.map((r, i) => (
        <div key={i} className="ho47-row">
          <span className="ho47-phase">+{Math.round(r.atMs / MIN)}m</span>
          <span className="ho47-track">
            <span className="ho47-barfill" style={{ width: `${r.aProgress}%` }} />
          </span>
          <span className="ho47-track">
            <span className="ho47-barfill ho47-alt" style={{ width: `${r.bProgress}%` }} />
          </span>
          <span className="ho47-tiny">
            A {r.aProgress}% / B {r.bProgress}%
          </span>
        </div>
      ))}
      <div className="ho47-note">{t.text}</div>
    </div>
  );
}

/* 51874 · Hunt notes */
function HuntNotesCard() {
  const [hunts, setHunts] = useState(HUNTS);
  const [body, setBody] = useState('Check the <login> endpoint next.');
  const [last, setLast] = useState('Notes are visible to the whole team.');
  const add = () => {
    const r = addHuntNote(hunts, 'H-101', { author: 'bhavesh', body, atMs: NOW });
    setHunts(r.hunts);
    setLast(r.text);
  };
  const hunt = hunts.find(h => h.id === 'H-101');
  return (
    <div className="ho47-card">
      <h4>51874 · Hunt notes</h4>
      {(hunt.notes || []).map((n, i) => (
        <div key={i} className="ho47-note">
          <b>{n.author}</b>: {n.body}
          <div className="ho47-tiny">escaped for HTML: {n.bodyHtml || escapeHtml(n.body)}</div>
        </div>
      ))}
      <div className="ho47-bar">
        <input
          className="ho47-input"
          value={body}
          onChange={e => setBody(e.target.value)}
          aria-label="Note body"
        />
        <button className="ho47-btn" onClick={add}>
          Add note
        </button>
      </div>
      <div className="ho47-tiny">{last}</div>
    </div>
  );
}

/* 51875 · Hunt tags */
function HuntTagsCard() {
  const [hunts, setHunts] = useState(HUNTS);
  const [tag, setTag] = useState('priority');
  const [last, setLast] = useState('Tag hunts to slice them any way you like.');
  return (
    <div className="ho47-card">
      <h4>51875 · Hunt tags</h4>
      {hunts.map(h => (
        <div key={h.id} className="ho47-row">
          <span className="ho47-phase">{h.name}</span>
          {(h.tags || []).map(t => (
            <span key={t} className="ho47-pill">
              {t}
            </span>
          ))}
        </div>
      ))}
      <div className="ho47-bar">
        <input
          className="ho47-input"
          value={tag}
          onChange={e => setTag(e.target.value)}
          aria-label="Tag name"
        />
        <button
          className="ho47-btn"
          onClick={() => {
            const r = tagHunt(hunts, 'H-102', tag);
            setHunts(r.hunts);
            setLast(r.text);
          }}
        >
          Tag H-102
        </button>
      </div>
      <div className="ho47-tiny">{last}</div>
    </div>
  );
}

/* 51876 · Hunt saved views */
function SavedViewsCard() {
  const views = useMemo(
    () => [
      {
        name: 'running hunts',
        filters: { status: 'running' },
        sortBy: 'progress',
        sortDir: 'desc',
      },
      {
        name: 'with criticals',
        filters: { severity: 'critical' },
        sortBy: 'findings',
        sortDir: 'desc',
      },
    ],
    []
  );
  const [vi, setVi] = useState(0);
  const v = useMemo(() => applySavedView(HUNTS, views[vi]), [views, vi]);
  return (
    <div className="ho47-card">
      <h4>51876 · Hunt saved views</h4>
      <div className="ho47-bar">
        {views.map((vw, i) => (
          <button
            key={vw.name}
            className={`ho47-btn${i === vi ? ' ho47-btn-active' : ''}`}
            onClick={() => setVi(i)}
          >
            {vw.name}
          </button>
        ))}
      </div>
      {v.hunts.map(h => (
        <div key={h.id} className="ho47-row">
          <span className="ho47-phase">{h.name}</span>
          <span className="ho47-tiny">
            {h.progress}% · {(h.findings || []).length} findings
          </span>
        </div>
      ))}
      <div className="ho47-tiny">{v.text}</div>
    </div>
  );
}

/* 51877 · Hunt export all */
function BulkExportCard() {
  const [format, setFormat] = useState('json');
  const [sel, setSel] = useState(['H-101', 'H-103']);
  const ex = useMemo(() => bulkExport(HUNTS, sel, format), [sel, format]);
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  return (
    <div className="ho47-card">
      <h4>51877 · Hunt export all</h4>
      <div className="ho47-bar">
        {HUNTS.map(h => (
          <label key={h.id} className="ho47-tiny">
            <input type="checkbox" checked={sel.includes(h.id)} onChange={() => toggle(h.id)} />{' '}
            {h.name}
          </label>
        ))}
        <select value={format} onChange={e => setFormat(e.target.value)}>
          <option value="json">json</option>
          <option value="csv">csv</option>
          <option value="markdown">markdown</option>
        </select>
      </div>
      <pre className="ho47-pre">
        {ex.content.slice(0, 600)}
        {ex.content.length > 600 ? '…' : ''}
      </pre>
      <div className="ho47-tiny">
        {ex.text} File: {ex.filename}
      </div>
    </div>
  );
}

/* 51878 · Hunt API tokens */
function ApiTokenCard() {
  const [id, setId] = useState('H-101');
  const t = useMemo(() => issueApiToken(id), [id]);
  return (
    <div className="ho47-card">
      <h4>51878 · Hunt API tokens</h4>
      <label>
        Hunt{' '}
        <select value={id} onChange={e => setId(e.target.value)}>
          {HUNTS.map(h => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </label>
      <div className="ho47-note ho47-lvl-warn">
        {t.label} — {t.note}
      </div>
      <div className="ho47-row">
        <span className="ho47-phase">prefix</span>
        <span className="ho47-tiny">{t.tokenPrefix}…</span>
      </div>
      <div className="ho47-row">
        <span className="ho47-phase">scopes</span>
        <span className="ho47-tiny">{t.scopes.join(', ')}</span>
      </div>
      <div className="ho47-tiny">{t.text}</div>
    </div>
  );
}

/* 51879 · Hunt webhooks */
function WebhookCard() {
  const [type, setType] = useState('hunt.finding');
  const p = useMemo(
    () =>
      webhookPayload({ type, huntId: 'H-101', data: { findingId: 'F-101', severity: 'critical' } }),
    [type]
  );
  return (
    <div className="ho47-card">
      <h4>51879 · Hunt webhooks</h4>
      <label>
        Event{' '}
        <select value={type} onChange={e => setType(e.target.value)}>
          {['hunt.finding', 'hunt.stalled', 'hunt.done', 'hunt.paused'].map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <pre className="ho47-pre">
        {JSON.stringify(
          { event: p.event, huntId: p.huntId, data: p.data, signature: p.signature },
          null,
          2
        )}
      </pre>
      <div className="ho47-tiny">{p.note}</div>
      <div className="ho47-tiny">{p.text}</div>
    </div>
  );
}

/* 51880 · Hunt SSO scoping */
function SsoScopeCard() {
  const [uid, setUid] = useState('shubham');
  const users = useMemo(
    () => ({
      bhavesh: { id: 'bhavesh', assignedHuntIds: 'all' },
      shubham: { id: 'shubham', assignedHuntIds: ['H-102'] },
      arvind: { id: 'arvind', assignedHuntIds: ['H-103'] },
    }),
    []
  );
  const s = useMemo(() => ssoScope(users[uid], HUNTS), [users, uid]);
  return (
    <div className="ho47-card">
      <h4>51880 · Hunt SSO scoping</h4>
      <label>
        User{' '}
        <select value={uid} onChange={e => setUid(e.target.value)}>
          {Object.keys(users).map(u => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>
      {s.hunts.map(h => (
        <div key={h.id} className="ho47-row">
          <span className="ho47-phase">{h.name}</span>
          <span className="ho47-pill ho47-lvl-ok">visible</span>
        </div>
      ))}
      <div className="ho47-tiny">
        {s.text} Hidden from this user: {s.hidden}.
      </div>
    </div>
  );
}

export const HuntOpsGallery = [
  { id: 51861, name: 'DependencyGatesCard', render: <DependencyGatesCard /> },
  { id: 51862, name: 'CampaignRollupCard', render: <CampaignRollupCard /> },
  { id: 51863, name: 'ClientRollupCard', render: <ClientRollupCard /> },
  { id: 51864, name: 'HuntSearchCard', render: <HuntSearchCard /> },
  { id: 51865, name: 'HuntFiltersCard', render: <HuntFiltersCard /> },
  { id: 51866, name: 'ArchiveCard', render: <ArchiveCard /> },
  { id: 51867, name: 'FavoritesCard', render: <FavoritesCard /> },
  { id: 51868, name: 'NotificationsHubCard', render: <NotificationsHubCard /> },
  { id: 51869, name: 'RoutingRulesCard', render: <RoutingRulesCard /> },
  { id: 51870, name: 'OwnershipCard', render: <OwnershipCard /> },
  { id: 51871, name: 'CollaborationCard', render: <CollaborationCard /> },
  { id: 51872, name: 'ActivityFeedCard', render: <ActivityFeedCard /> },
  { id: 51873, name: 'TimelineCompareCard', render: <TimelineCompareCard /> },
  { id: 51874, name: 'HuntNotesCard', render: <HuntNotesCard /> },
  { id: 51875, name: 'HuntTagsCard', render: <HuntTagsCard /> },
  { id: 51876, name: 'SavedViewsCard', render: <SavedViewsCard /> },
  { id: 51877, name: 'BulkExportCard', render: <BulkExportCard /> },
  { id: 51878, name: 'ApiTokenCard', render: <ApiTokenCard /> },
  { id: 51879, name: 'WebhookCard', render: <WebhookCard /> },
  { id: 51880, name: 'SsoScopeCard', render: <SsoScopeCard /> },
];

export default HuntOpsGallery;
