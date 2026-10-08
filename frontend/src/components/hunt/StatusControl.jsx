/**
 * StatusControl.jsx — wave 28 (ideas 51101–51120): status control layer
 * components with real local state.
 *
 * All behavior is local and functional (no backend calls, no mock-data
 * fakery — each demo drives real state). No decorative animations, per the
 * owner's zero-animation order.
 */
import React, { useState } from 'react';
import {
  GRANULARITIES,
  GRAN_SUMMARY,
  GRAN_STANDARD,
  GRAN_VERBOSE,
  applyGranularity,
  componentStatus,
  scrubTimeline,
  addBookmark,
  removeBookmark,
  workloadMeter,
  modelSwitchNotice,
  bilingualStatus,
  redactPayload,
  linkFindings,
  idleNudges,
  activityHeatmap,
  avatarNarration,
  managerStatus,
  lastVisitDiff,
  currentTaskEta,
  confidenceTrend,
  parseFocusCommand,
  parseSkipCommand,
  priorityBoost,
  demoteNoisy,
} from './statusRound2Core.js';

export function GranularityDial({ updates }) {
  const [level, setLevel] = useState(GRAN_STANDARD);
  const visible = applyGranularity(updates, level);
  return (
    <div className="st28-card" data-testid="granularity-dial">
      <strong>Status granularity dial</strong>
      <div role="radiogroup" aria-label="granularity">
        {GRANULARITIES.map(g => (
          <button key={g} type="button" aria-pressed={level === g} onClick={() => setLevel(g)}>
            {g}
          </button>
        ))}
      </div>
      <p>
        {visible.length} of {(updates || []).length} shown at "{level}" depth
      </p>
    </div>
  );
}

export function ComponentStatusQuery({ components }) {
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState(null);
  return (
    <div className="st28-card" data-testid="component-status">
      <strong>Component-specific status</strong>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder='e.g. "crawler"'
        aria-label="component query"
      />
      <button type="button" onClick={() => setAsked(componentStatus(components, q))}>
        Ask
      </button>
      {asked && <p>{asked.answer}</p>}
    </div>
  );
}

export function TimelineScrubber({ events, maxMinute }) {
  const [minute, setMinute] = useState(0);
  const res = scrubTimeline(events, minute);
  return (
    <div className="st28-card" data-testid="timeline-scrubber">
      <strong>Timeline scrubber (mid-hunt)</strong>
      <input
        type="range"
        min={0}
        max={maxMinute || 60}
        value={minute}
        onChange={e => setMinute(Number(e.target.value))}
        aria-label="minute"
      />
      <p>{res.summary}</p>
    </div>
  );
}

export function StatusBookmarks() {
  const [marks, setMarks] = useState([]);
  const sample = { atMs: 1728300000000, text: 'First critical found', phase: 'probe' };
  return (
    <div className="st28-card" data-testid="status-bookmarks">
      <strong>Status bookmarks</strong>
      <button type="button" onClick={() => setMarks(addBookmark(marks, sample, 'critical #1'))}>
        Bookmark moment
      </button>
      <ul>
        {marks.map(b => (
          <li key={b.id}>
            {b.label} — {b.phase}{' '}
            <button type="button" onClick={() => setMarks(removeBookmark(marks, b.id))}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WorkloadMeter({ activeTasks, capacity }) {
  const w = workloadMeter(activeTasks, capacity);
  return (
    <div className="st28-card" data-testid="workload-meter">
      <strong>Agent workload meter</strong>
      <p>
        {w.activeTasks}/{w.capacity} tasks — {w.label} ({Math.round(w.load * 100)}%)
      </p>
      <div className="st28-gauge" aria-hidden="true">
        <div className="st28-gauge-fill" style={{ width: `${w.load * 100}%` }} />
      </div>
    </div>
  );
}

export function ModelSwitchCard({ from, to, reason, atMs }) {
  const n = modelSwitchNotice(from, to, reason, atMs);
  return (
    <div className="st28-card" data-testid="model-switch">
      <strong>Model-switch status</strong>
      <p>{n.summary}</p>
    </div>
  );
}

export function BilingualStatus({ primary, secondary }) {
  const b = bilingualStatus(primary, secondary);
  return (
    <div className="st28-card" data-testid="bilingual-status">
      <strong>Bilingual status view</strong>
      <div className="st28-cols">
        <div>
          <small>EN</small>
          <p>{b.primary.text}</p>
        </div>
        <div>
          <small>HI</small>
          <p>{b.secondary.text}</p>
        </div>
      </div>
    </div>
  );
}

export function RedactedStatus({ line }) {
  const [revealed, setRevealed] = useState(false);
  const r = redactPayload(line);
  return (
    <div className="st28-card" data-testid="redacted-status">
      <strong>Payload-redacted status</strong>
      <p className="st28-mono">{revealed || !r.wasRedacted ? r.original : r.redacted}</p>
      {r.wasRedacted && (
        <button type="button" onClick={() => setRevealed(!revealed)}>
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      )}
    </div>
  );
}

export function FindingLinkedStatus({ status, findings }) {
  const linked = linkFindings(status, findings);
  return (
    <div className="st28-card" data-testid="finding-linked">
      <strong>Finding-linked status</strong>
      <p>
        {status.text} — {linked.findingCount} finding(s) linked
      </p>
      <ul>
        {linked.findingLinks.map(f => (
          <li key={f.id}>{f.title}</li>
        ))}
      </ul>
    </div>
  );
}

export function IdleNudges({ idleMs, context }) {
  const [approved, setApproved] = useState([]);
  const nudges = idleNudges(idleMs, context);
  return (
    <div className="st28-card" data-testid="idle-nudges">
      <strong>Idle-nudge suggestions</strong>
      {nudges.length === 0 ? (
        <p>Agent is active — no nudges.</p>
      ) : (
        <ul>
          {nudges.map(n => (
            <li key={n.id}>
              {n.text}{' '}
              <button
                type="button"
                disabled={approved.includes(n.id)}
                onClick={() => setApproved([...approved, n.id])}
              >
                {approved.includes(n.id) ? 'Approved' : 'Approve'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ActivityHeatmap({ events }) {
  const cells = activityHeatmap(events, 5);
  const max = Math.max(1, ...cells.map(c => c.count));
  return (
    <div className="st28-card" data-testid="activity-heatmap">
      <strong>Activity heatmap</strong>
      <div className="st28-heat">
        {cells.map(c => (
          <div
            key={c.startMinute}
            className="st28-heat-cell"
            title={`${c.startMinute}–${c.endMinute}m: ${c.count} events`}
            style={{ opacity: 0.25 + (0.75 * c.count) / max }}
          >
            {c.count}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AvatarNarration({ status }) {
  return (
    <div className="st28-card" data-testid="avatar-narration">
      <strong>Avatar status narration</strong>
      <p>
        <em>"{avatarNarration(status)}"</em>
      </p>
    </div>
  );
}

export function ManagerStatus({ status }) {
  return (
    <div className="st28-card" data-testid="manager-status">
      <strong>Manager-friendly status</strong>
      <p>{managerStatus(status)}</p>
    </div>
  );
}

export function LastVisitDiff({ events, lastVisitMs }) {
  const d = lastVisitDiff(events, lastVisitMs);
  return (
    <div className="st28-card" data-testid="last-visit-diff">
      <strong>Since your last visit</strong>
      <p>{d.summary}</p>
    </div>
  );
}

export function CurrentTaskEta({ startedMs, estDurationMs, nowMs }) {
  const eta = currentTaskEta(startedMs, estDurationMs, nowMs);
  return (
    <div className="st28-card" data-testid="current-task-eta">
      <strong>Current-task ETA</strong>
      <p>{eta.label}</p>
    </div>
  );
}

export function ConfidenceTrend({ scores }) {
  const t = confidenceTrend(scores);
  return (
    <div className="st28-card" data-testid="confidence-trend">
      <strong>Status confidence trend</strong>
      <p>Direction: {t.direction}</p>
      <div className="st28-spark" aria-hidden="true">
        {t.points.map(p => (
          <div
            key={p.x}
            className="st28-spark-bar"
            style={{ height: `${Math.round(p.y * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function FocusUrlCommand() {
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  return (
    <div className="st28-card" data-testid="focus-url">
      <strong>Focus-this-URL command</strong>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="focus https://target/login"
        aria-label="focus command"
      />
      <button type="button" onClick={() => setRes(parseFocusCommand(text))}>
        Send
      </button>
      {res ? <p>Reprioritizing: {res.url}</p> : text && <p>Not a focus command.</p>}
    </div>
  );
}

export function SkipAreaCommand() {
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  return (
    <div className="st28-card" data-testid="skip-area">
      <strong>Skip-this-area command</strong>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="skip /static"
        aria-label="skip command"
      />
      <button type="button" onClick={() => setRes(parseSkipCommand(text))}>
        Send
      </button>
      {res ? <p>Rerouting around: {res.area}</p> : text && <p>Not a skip command.</p>}
    </div>
  );
}

export function PriorityBoost({ types }) {
  const [order, setOrder] = useState(types || []);
  const [cls, setCls] = useState('');
  return (
    <div className="st28-card" data-testid="priority-boost">
      <strong>Finding-type priority boost</strong>
      <input
        value={cls}
        onChange={e => setCls(e.target.value)}
        placeholder="e.g. XSS"
        aria-label="vuln class"
      />
      <button type="button" onClick={() => setOrder(priorityBoost(order, cls))}>
        Boost
      </button>
      <ol>
        {order.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </div>
  );
}

export function NoisyDemotion({ checks }) {
  const [noisy, setNoisy] = useState([]);
  const [id, setId] = useState('');
  const order = demoteNoisy(checks, noisy);
  return (
    <div className="st28-card" data-testid="noisy-demotion">
      <strong>Noisy-check demotion</strong>
      <input
        value={id}
        onChange={e => setId(e.target.value)}
        placeholder="check id"
        aria-label="check id"
      />
      <button
        type="button"
        onClick={() => {
          if (id.trim() && !noisy.includes(id.trim())) setNoisy([...noisy, id.trim()]);
          setId('');
        }}
      >
        Demote
      </button>
      <ol>
        {order.map((c, i) => (
          <li key={i}>
            {c.id || c}
            {noisy.includes(c.id || c) ? ' (demoted)' : ''}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StatusControlGallery() {
  const updates = [
    { depth: 'summary', text: 'Phase done' },
    { depth: 'standard', text: 'Probing /login' },
    { depth: 'verbose', text: 'Payload #412 sent' },
  ];
  const components = [{ name: 'crawler', status: 'crawling', detail: '142 queued' }];
  const events = [
    { minute: 2, phase: 'recon', action: 'subdomain enum' },
    { minute: 9, phase: 'crawl', action: 'spidering' },
  ];
  return (
    <div data-testid="status-control-gallery">
      <GranularityDial updates={updates} />
      <ComponentStatusQuery components={components} />
      <TimelineScrubber events={events} maxMinute={15} />
      <StatusBookmarks />
      <WorkloadMeter activeTasks={5} capacity={8} />
      <ModelSwitchCard
        from="qwen-7b"
        to="qwen-14b"
        reason="deeper reasoning needed"
        atMs={1728300000000}
      />
      <BilingualStatus primary="Probing login form" secondary="लॉगिन फॉर्म की जाँच हो रही है" />
      <RedactedStatus line="POST /login password=secret123" />
      <FindingLinkedStatus
        status={{ text: 'Probe window complete' }}
        findings={[{ id: 'f1', title: 'XSS in search' }]}
      />
      <IdleNudges idleMs={120000} context={{ unreviewedFindings: 2, uncoveredAreas: 1 }} />
      <ActivityHeatmap events={events} />
      <AvatarNarration status={{ phase: 'probe', action: 'testing login form', findingCount: 3 }} />
      <ManagerStatus status={{ phase: 'fuzzing', action: 'testing login for issues' }} />
      <LastVisitDiff
        events={[{ atMs: 1728300000000, kind: 'finding', phase: 'probe' }]}
        lastVisitMs={1728299000000}
      />
      <CurrentTaskEta startedMs={1728299900000} estDurationMs={300000} nowMs={1728300000000} />
      <ConfidenceTrend scores={[0.4, 0.55, 0.7, 0.82]} />
      <FocusUrlCommand />
      <SkipAreaCommand />
      <PriorityBoost types={['SQLi', 'XSS', 'IDOR']} />
      <NoisyDemotion checks={[{ id: 'dir-list' }, { id: 'xss-probe' }]} />
    </div>
  );
}
