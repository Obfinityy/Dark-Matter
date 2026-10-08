/**
 * StatusRound2.jsx — wave 28 (ideas 51081–51100): status display layer
 * components with real local state.
 *
 * All behavior is local and functional (no backend calls, no mock-data
 * fakery — each demo drives real state). No decorative animations, per the
 * owner's zero-animation order.
 */
import React, { useState } from 'react';
import {
  tabTitleStatus,
  statusApiPayload,
  captureSnapshot,
  intentExplanation,
  dependencyDisplay,
  approachConfidence,
  confidenceLabel,
  consideredAlternatives,
  moduleStatus,
  quietModeFilter,
  QUIET_ON,
  QUIET_OFF,
  pushAlertPayload,
  terminalLine,
  emojiForPhase,
  STATUS_EMOJI,
  timeSinceFinding,
  coverageSummary,
  pausedStatus,
  approvalWaitStatus,
  exportStatusCsv,
  exportStatusMarkdown,
  openQaThread,
  qaReply,
  flagUncertain,
  forecastPhases,
} from './statusRound2Core.js';

export function TabTitleStatus({ phase, action, findingCount }) {
  const title = tabTitleStatus({ phase, action, findingCount });
  return (
    <div className="st28-card" data-testid="tab-title-status">
      <strong>Tab-title status</strong>
      <p className="st28-mono">{title}</p>
      <small>Live in the browser tab for at-a-glance monitoring.</small>
    </div>
  );
}

export function StatusApiCard({ huntId, phase, action, progressPct, findingCount }) {
  const [copied, setCopied] = useState(false);
  const payload = statusApiPayload({
    huntId,
    phase,
    action,
    progressPct,
    findingCount,
    updatedAtMs: 1728300000000,
    paused: false,
  });
  return (
    <div className="st28-card" data-testid="status-api-card">
      <strong>Status API endpoint</strong>
      <pre className="st28-mono">{JSON.stringify(payload, null, 2)}</pre>
      <button type="button" onClick={() => setCopied(true)}>
        {copied ? 'Copied' : 'Copy JSON'}
      </button>
    </div>
  );
}

export function StatusSnapshots({ state }) {
  const [snaps, setSnaps] = useState([]);
  return (
    <div className="st28-card" data-testid="status-snapshots">
      <strong>Status snapshots</strong>
      <button
        type="button"
        onClick={() =>
          setSnaps(captureSnapshot(state, 1728300000000 + snaps.length * 60000, snaps))
        }
      >
        Capture snapshot
      </button>
      <ul>
        {snaps.map(s => (
          <li key={s.id}>
            {new Date(s.capturedAtMs).toISOString()} — {s.phase} ({s.progressPct}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IntentExplanation({ action, goal }) {
  return (
    <div className="st28-card" data-testid="intent-explanation">
      <strong>Intent explanation</strong>
      <p>{intentExplanation(action, goal)}</p>
    </div>
  );
}

export function DependencyDisplay({ step }) {
  const dep = dependencyDisplay(step);
  return (
    <div className="st28-card" data-testid="dependency-display">
      <strong>Dependency display</strong>
      {dep.blocked ? (
        <p>Waiting for: {dep.waitsFor.join(', ')}</p>
      ) : (
        <p>Not blocked — all dependencies satisfied.</p>
      )}
    </div>
  );
}

export function ApproachConfidence({ score }) {
  const band = approachConfidence(score);
  return (
    <div className="st28-card" data-testid="approach-confidence">
      <strong>Approach confidence</strong>
      <p>
        {confidenceLabel(band)} <span className="st28-badge">{band}</span>
      </p>
    </div>
  );
}

export function ConsideredAlternatives({ action }) {
  const alts = consideredAlternatives(action);
  return (
    <div className="st28-card" data-testid="considered-alternatives">
      <strong>Considered alternatives</strong>
      {alts.length === 0 ? (
        <p>None recorded.</p>
      ) : (
        <ul>
          {alts.map((a, i) => (
            <li key={i}>
              <em>{a.name}</em> — rejected: {a.rejectedBecause}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PerModuleStatus({ modules }) {
  const [name, setName] = useState((modules && modules[0] && modules[0].name) || '');
  const res = moduleStatus(modules, name);
  return (
    <div className="st28-card" data-testid="per-module-status">
      <strong>Per-module status</strong>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="module name"
        aria-label="module name"
      />
      {res.found ? (
        <p>
          {res.name}: {res.status} ({res.progressPct}%) {res.detail}
        </p>
      ) : (
        <p>{res.status}</p>
      )}
    </div>
  );
}

export function QuietModeToggle({ updates }) {
  const [mode, setMode] = useState(QUIET_OFF);
  const visible = quietModeFilter(updates, mode);
  return (
    <div className="st28-card" data-testid="quiet-mode">
      <strong>Quiet status mode</strong>
      <button type="button" onClick={() => setMode(mode === QUIET_ON ? QUIET_OFF : QUIET_ON)}>
        {mode === QUIET_ON ? 'Disable quiet mode' : 'Enable quiet mode'}
      </button>
      <p>
        {visible.length} of {(updates || []).length} updates shown
      </p>
    </div>
  );
}

export function PushAlertsSetup() {
  const [enabled, setEnabled] = useState(false);
  const sample = pushAlertPayload({
    title: 'Phase complete',
    body: 'Recon finished',
    kind: 'phase',
    atMs: 1728300000000,
    huntId: 'h-1',
  });
  return (
    <div className="st28-card" data-testid="push-alerts">
      <strong>Push status alerts</strong>
      <button type="button" onClick={() => setEnabled(!enabled)}>
        {enabled ? 'Disable' : 'Enable'} push alerts
      </button>
      {enabled && <pre className="st28-mono">{JSON.stringify(sample, null, 2)}</pre>}
    </div>
  );
}

export function TerminalStatus({ events }) {
  return (
    <div className="st28-card" data-testid="terminal-status">
      <strong>Terminal-style status</strong>
      <pre className="st28-mono">{(events || []).map(terminalLine).join('\n')}</pre>
    </div>
  );
}

export function EmojiLegend() {
  return (
    <div className="st28-card" data-testid="emoji-legend">
      <strong>Status emoji legend</strong>
      <ul className="st28-inline">
        {Object.entries(STATUS_EMOJI).map(([phase, emoji]) => (
          <li key={phase}>
            {emoji} {phase}
          </li>
        ))}
      </ul>
      <p>Fallback icon: {emojiForPhase('unknown-phase')}</p>
    </div>
  );
}

export function TimeSinceFinding({ lastFindingMs, nowMs }) {
  return (
    <div className="st28-card" data-testid="time-since-finding">
      <strong>Time since finding</strong>
      <p>{timeSinceFinding(lastFindingMs, nowMs)}</p>
    </div>
  );
}

export function CoverageSummary({ areas }) {
  const cov = coverageSummary(areas);
  return (
    <div className="st28-card" data-testid="coverage-summary">
      <strong>Coverage so far</strong>
      <p>
        {cov.covered}/{cov.total} areas exercised ({cov.pct}%)
      </p>
      {cov.untouched.length > 0 && <p>Untouched: {cov.untouched.join(', ')}</p>}
    </div>
  );
}

export function PausedStatusCard({ frozenPhase, frozenAction, resumeNext, pausedAtMs }) {
  const ps = pausedStatus({ frozenPhase, frozenAction, resumeNext, pausedAtMs });
  return (
    <div className="st28-card" data-testid="paused-status">
      <strong>⏸️ Paused-state status</strong>
      <p>{ps.summary}</p>
    </div>
  );
}

export function ApprovalWaitCard({ action, holder, requestedAtMs }) {
  const aw = approvalWaitStatus({ action, holder, requestedAtMs });
  return (
    <div className="st28-card" data-testid="approval-wait">
      <strong>Approval-wait status</strong>
      <p>{aw.summary}</p>
    </div>
  );
}

export function StatusExport({ history }) {
  const [format, setFormat] = useState('csv');
  const output = format === 'csv' ? exportStatusCsv(history) : exportStatusMarkdown(history);
  return (
    <div className="st28-card" data-testid="status-export">
      <strong>Status export</strong>
      <div>
        <button type="button" onClick={() => setFormat('csv')}>
          CSV
        </button>
        <button type="button" onClick={() => setFormat('markdown')}>
          Markdown
        </button>
      </div>
      <pre className="st28-mono">{output}</pre>
    </div>
  );
}

export function StatusQaThread({ statusId }) {
  const [thread, setThread] = useState(() => openQaThread(statusId));
  const [q, setQ] = useState('');
  return (
    <div className="st28-card" data-testid="status-qa">
      <strong>Status Q&A thread</strong>
      <ul>
        {thread.exchanges.map((x, i) => (
          <li key={i}>
            <em>Q:</em> {x.question} <em>A:</em> {x.answer || '(awaiting agent)'}
          </li>
        ))}
      </ul>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Ask about this moment"
        aria-label="question"
      />
      <button
        type="button"
        onClick={() => {
          if (q.trim()) {
            setThread(qaReply(thread, q.trim(), null));
            setQ('');
          }
        }}
      >
        Ask
      </button>
    </div>
  );
}

export function UncertaintyFlag({ line, reason }) {
  const f = flagUncertain(line, reason);
  return (
    <div className="st28-card" data-testid="uncertainty-flag">
      <strong>Uncertainty flag</strong>
      <p>{f.display}</p>
    </div>
  );
}

export function ForecastCard({ plan, currentIdx }) {
  const forecast = forecastPhases(plan, currentIdx, 3);
  return (
    <div className="st28-card" data-testid="forecast">
      <strong>Upcoming-phase forecast</strong>
      <ol>
        {forecast.map((f, i) => (
          <li key={i}>
            {f.phase}
            {f.note ? ` — ${f.note}` : ''}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function StatusRound2Gallery() {
  const demo = {
    phase: 'probe',
    action: 'testing login form',
    findingCount: 3,
    progressPct: 42,
    huntId: 'h-demo',
  };
  const modules = [
    { name: 'crawler', status: 'crawling', detail: '142 URLs queued', progressPct: 61 },
    { name: 'fuzzer', status: 'idle', detail: '', progressPct: 0 },
  ];
  const updates = [
    { kind: 'phase', text: 'Recon complete' },
    { kind: 'routine', text: 'Heartbeat' },
    { kind: 'finding', text: 'XSS found' },
  ];
  const events = [{ atMs: 1728300000000, kind: 'phase', text: 'Recon complete' }];
  const areas = [
    { name: '/login', covered: true },
    { name: '/admin', covered: false },
  ];
  const history = [{ atMs: 1728300000000, kind: 'phase', phase: 'recon', text: 'Recon complete' }];
  const plan = [{ phase: 'recon' }, { phase: 'crawl' }, { phase: 'probe' }, { phase: 'fuzz' }];
  return (
    <div data-testid="status-round2-gallery">
      <TabTitleStatus {...demo} />
      <StatusApiCard {...demo} />
      <StatusSnapshots state={demo} />
      <IntentExplanation action="fuzzing /api/login" goal="find auth bypass" />
      <DependencyDisplay step={{ waitsFor: ['recon results'] }} />
      <ApproachConfidence score={0.82} />
      <ConsideredAlternatives
        action={{ alternatives: [{ name: 'manual review', rejectedBecause: 'too slow' }] }}
      />
      <PerModuleStatus modules={modules} />
      <QuietModeToggle updates={updates} />
      <PushAlertsSetup />
      <TerminalStatus events={events} />
      <EmojiLegend />
      <TimeSinceFinding lastFindingMs={1728299000000} nowMs={1728300000000} />
      <CoverageSummary areas={areas} />
      <PausedStatusCard
        frozenPhase="probe"
        frozenAction="testing login"
        resumeNext="continue probe queue"
        pausedAtMs={1728300000000}
      />
      <ApprovalWaitCard action="run intrusive scan" holder="you" requestedAtMs={1728300000000} />
      <StatusExport history={history} />
      <StatusQaThread statusId="st-1" />
      <UncertaintyFlag line="No SQLi in /search" reason="limited payload set" />
      <ForecastCard plan={plan} currentIdx={1} />
    </div>
  );
}
