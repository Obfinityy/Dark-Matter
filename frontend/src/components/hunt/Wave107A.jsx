import React, { useMemo, useState } from 'react';
import {
  WAVE107_A_IDEAS,
  createBaseline,
  compareToBaseline,
  scheduleRebaseline,
  addIgnoreRule,
  isChangeIgnored,
  routeForApproval,
  queueHuntOnChange,
  addAnnotation,
  compareScreenshots,
  buildWebhookPayload,
  applyRetentionPolicy,
  bulkReview,
} from './wave107ACore.js';

/**
 * Wave 107A — Change lifecycle management demo panel.
 * Infinity AI branding only. Demonstrates ideas 54241–54250.
 */

const SAMPLE_CHANGES = [
  { id: 'chg-1', targetId: 'acme-web', key: 'new-endpoint', severity: 'high', before: null, after: '/api/v2/orders', status: 'open' },
  { id: 'chg-2', targetId: 'acme-web', key: 'csrf-token', severity: 'low', before: 'tok_a1', after: 'tok_b2', status: 'open' },
  { id: 'chg-3', targetId: 'acme-api', key: 'title', severity: 'medium', before: 'Old Title', after: 'New Title', status: 'open' },
  { id: 'chg-4', targetId: 'acme-api', key: 'tech-change', severity: 'critical', before: 'nginx/1.20', after: 'nginx/1.25', status: 'open' },
];

export default function Wave107A() {
  const [baseline, setBaseline] = useState(null);
  const [diff, setDiff] = useState(null);
  const [rebaselineInfo, setRebaselineInfo] = useState(null);
  const [ignoreRules, setIgnoreRules] = useState([]);
  const [ignorePattern, setIgnorePattern] = useState('csrf-token');
  const [ticket, setTicket] = useState(null);
  const [queuedHunt, setQueuedHunt] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [note, setNote] = useState('Planned deploy v2.4');
  const [shotPair, setShotPair] = useState(null);
  const [webhook, setWebhook] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [changes, setChanges] = useState(SAMPLE_CHANGES);
  const [selected, setSelected] = useState(new Set(['chg-1', 'chg-2']));

  const filtered = useMemo(
    () => changes.filter((c) => !isChangeIgnored(ignoreRules, c)),
    [changes, ignoreRules]
  );

  return (
    <div className="wave107 wave107-a">
      <header className="wave107-head">
        <h2 className="wave107-title">Change Lifecycle — Infinity AI</h2>
        <p className="wave107-sub">Wave 107A · ideas 54241–54250 · change detection lifecycle management</p>
      </header>

      {/* 54241 Baseline snapshot management */}
      <section className="wave107-card" id="wave107-baseline">
        <h3>{WAVE107_A_IDEAS[0].title}</h3>
        <button
          className="wave107-btn"
          onClick={() => {
            const b = createBaseline({ targetId: 'acme-web', label: 'v2.3-release', state: { title: 'Old Title', endpoint: '/api/v1' } });
            setBaseline(b);
            setDiff(compareToBaseline(b, { title: 'New Title', endpoint: '/api/v1' }));
          }}
        >
          Set baseline &amp; compare
        </button>
        {baseline && <p className="wave107-muted">Baseline <b>{baseline.label}</b> · id <code>{baseline.id}</code></p>}
        {diff && (
          <ul className="wave107-list">
            {diff.changed.map((d) => (
              <li key={d.key}><code>{d.key}</code>: <code>{String(d.before)}</code> → <code>{String(d.after)}</code></li>
            ))}
            {diff.changedCount === 0 && <li>No differences vs baseline.</li>}
          </ul>
        )}
      </section>

      {/* 54242 Scheduled re-baselining */}
      <section className="wave107-card">
        <h3>{WAVE107_A_IDEAS[1].title}</h3>
        <button className="wave107-btn" onClick={() => setRebaselineInfo(scheduleRebaseline({ baseline, quietDays: 8, thresholdDays: 7 }))}>
          Check auto re-baseline (8 quiet days)
        </button>
        {rebaselineInfo && (
          <p className="wave107-muted">
            Quiet days: {rebaselineInfo.quietDays} · threshold: {rebaselineInfo.thresholdDays} ·{' '}
            {rebaselineInfo.shouldRebaseline ? <b>eligible for re-baselining</b> : `next eligible ${rebaselineInfo.nextEligibleAt}`}
          </p>
        )}
      </section>

      {/* 54243 Ignore list for noisy changes */}
      <section className="wave107-card">
        <h3>{WAVE107_A_IDEAS[2].title}</h3>
        <input className="wave107-input" value={ignorePattern} onChange={(e) => setIgnorePattern(e.target.value)} placeholder="pattern" />
        <button className="wave107-btn" onClick={() => setIgnoreRules((r) => addIgnoreRule(r, { pattern: ignorePattern, reason: 'rotating-token', targetId: 'acme-web' }))}>
          Add ignore rule
        </button>
        <ul className="wave107-list">
          {ignoreRules.map((r) => <li key={r.id}><code>{r.source}</code> — {r.reason}</li>)}
        </ul>
      </section>

      {/* 54244 Change approval workflow */}
      <section className="wave107-card">
        <h3>{WAVE107_A_IDEAS[3].title}</h3>
        <button className="wave107-btn" onClick={() => setTicket(routeForApproval(changes[0], { 'acme-web': 'sec-owner@obfinity' }))}>
          Route high-severity change
        </button>
        {ticket && (
          <p className="wave107-muted">
            Routed: {String(ticket.routed)} · owner: {ticket.owner || '—'} · action: {ticket.action}
            {ticket.ticket && ` · options: ${ticket.ticket.options.join(' / ')}`}
          </p>
        )}
      </section>

      {/* 54245 Change-triggered hunts */}
      <section className="wave107-card">
        <h3>{WAVE107_A_IDEAS[4].title}</h3>
        <button className="wave107-btn" onClick={() => setQueuedHunt(queueHuntOnChange(changes[0], { id: 'acme-web' }))}>
          Evaluate hunt trigger
        </button>
        {queuedHunt && (
          <p className="wave107-muted">Queued hunt <code>{queuedHunt.huntId}</code> · priority {queuedHunt.priority} · focus {queuedHunt.focus}</p>
        )}
      </section>

      {/* 54246 Change annotations */}
      <section className="wave107-card">
        <h3>{WAVE107_A_IDEAS[5].title}</h3>
        <input className="wave107-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="annotation note" />
        <button className="wave107-btn" onClick={() => setAnnotations((a) => addAnnotation(a, { changeId: 'chg-1', author: 'analyst@obfinity', note }))}>
          Add annotation
        </button>
        <ul className="wave107-list">
          {annotations.map((a) => <li key={a.id}><b>{a.author}</b>: {a.note}</li>)}
        </ul>
      </section>

      {/* 54247 Change comparison screenshots */}
      <section className="wave107-card">
        <h3>{WAVE107_A_IDEAS[6].title}</h3>
        <button
          className="wave107-btn"
          onClick={() => setShotPair(compareScreenshots({ changeId: 'chg-3', beforeUrl: 'shots/before.png', afterUrl: 'shots/after.png' }))}
        >
          Build side-by-side pair
        </button>
        {shotPair && (
          <div className="wave107-shots">
            <figure><img src={shotPair.before.url} alt={shotPair.before.label} /><figcaption>{shotPair.before.label}</figcaption></figure>
            <figure><img src={shotPair.after.url} alt={shotPair.after.label} /><figcaption>{shotPair.after.label}</figcaption></figure>
          </div>
        )}
      </section>

      {/* 54248 Change webhooks and API */}
      <section className="wave107-card">
        <h3>{WAVE107_A_IDEAS[7].title}</h3>
        <button className="wave107-btn" onClick={() => setWebhook(buildWebhookPayload(changes[0], { id: 'acme-web', name: 'Acme Web' }))}>
          Build webhook payload
        </button>
        {webhook && <pre className="wave107-pre">{JSON.stringify(webhook, null, 2)}</pre>}
      </section>

      {/* 54249 Change retention policy */}
      <section className="wave107-card">
        <h3>{WAVE107_A_IDEAS[8].title}</h3>
        <button className="wave107-btn" onClick={() => setPolicy(applyRetentionPolicy({ clientId: 'acme', program: 'main', amount: 2, unit: 'weeks' }))}>
          Apply policy (2 weeks)
        </button>
        {policy && <p className="wave107-muted">Retention <code>{policy.id}</code> · {policy.days} days</p>}
      </section>

      {/* 54250 Bulk change review */}
      <section className="wave107-card">
        <h3>{WAVE107_A_IDEAS[9].title}</h3>
        <div className="wave107-review">
          <label className="wave107-muted"><input type="checkbox" checked={selected.has('chg-1')} onChange={() => setSelected(toggle(selected, 'chg-1'))} /> chg-1</label>
          <label className="wave107-muted"><input type="checkbox" checked={selected.has('chg-2')} onChange={() => setSelected(toggle(selected, 'chg-2'))} /> chg-2</label>
          <label className="wave107-muted"><input type="checkbox" checked={selected.has('chg-3')} onChange={() => setSelected(toggle(selected, 'chg-3'))} /> chg-3</label>
          <label className="wave107-muted"><input type="checkbox" checked={selected.has('chg-4')} onChange={() => setSelected(toggle(selected, 'chg-4'))} /> chg-4</label>
        </div>
        <div className="wave107-actions">
          <button className="wave107-btn" onClick={() => { const r = bulkReview(changes, [...selected], 'acknowledge'); setChanges(r.results.concat(changes.filter((c) => !r.results.find((x) => x.id === c.id)))); }}>
            Acknowledge selected
          </button>
          <button className="wave107-btn wave107-btn-ghost" onClick={() => { const r = bulkReview(changes, [...selected], 'snooze', { snoozedUntil: '2026-10-17T00:00:00.000Z' }); setChanges(r.results.concat(changes.filter((c) => !r.results.find((x) => x.id === c.id)))); }}>
            Snooze selected
          </button>
        </div>
        <p className="wave107-muted">Showing {filtered.length} of {changes.length} changes after ignore rules.</p>
      </section>
    </div>
  );
}

function toggle(set, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
