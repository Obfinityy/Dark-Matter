/**
 * StatusSuite.jsx — wave 27 (ideas 51061–51080): live hunt-status
 * transparency suite components with real local state.
 *
 * All behavior is local and functional (no backend calls, no mock-data
 * fakery — each demo drives real state). No decorative animations, per the
 * owner's zero-animation order.
 */
import React, { useMemo, useState } from 'react';
import {
  WAVE27_IDEAS,
  instantStatus,
  narrateAction,
  phaseBreadcrumb,
  activeToolBadge,
  phaseProgress,
  subStepChecklist,
  tickSubStep,
  timeInPhase,
  lastActionStamp,
  nextActionPreview,
  STATUS_LANGS,
  statusInLanguage,
  statusCard,
  appendStatus,
  digestSchedule,
  explainAction,
  reportBlocker,
  BLOCKER_NONE,
  BLOCKER_STUCK,
  waitingOnYou,
  planVsReality,
  shareStatusLink,
  spokenStatus,
  dashboardWidget,
} from './sessionCore.js';

const DEMO_PLAN = [
  { id: 'recon', label: 'Recon' },
  { id: 'scan', label: 'Vuln scan' },
  { id: 'exploit', label: 'Exploitation' },
  { id: 'report', label: 'Report' },
];

export function InstantStatusDemo() {
  const [answer, setAnswer] = useState('');
  return (
    <div className="sess27-card" data-testid="instant-status">
      <strong>Instant status command</strong>
      <button
        type="button"
        onClick={() =>
          setAnswer(
            instantStatus({ phase: 'Vuln scan', action: 'fuzzing /api params', progressPct: 64 })
          )
        }
      >
        “What are you doing right now?”
      </button>
      {answer && (
        <p>
          <code>{answer}</code>
        </p>
      )}
    </div>
  );
}

export function NarrationDemo() {
  const [action, setAction] = useState('subdomain enumeration');
  return (
    <div className="sess27-card" data-testid="narration">
      <strong>Plain-language narration</strong>
      <input
        value={action}
        onChange={e => setAction(e.target.value)}
        aria-label="Action to narrate"
      />
      <p>{narrateAction(action)}</p>
    </div>
  );
}

export function PhaseBreadcrumbDemo() {
  const crumbs = phaseBreadcrumb(DEMO_PLAN, 'scan');
  return (
    <div className="sess27-card" data-testid="breadcrumb">
      <strong>Phase breadcrumb trail</strong>
      <nav aria-label="Hunt phases">
        {crumbs.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ' › '}
            <span className={`sess27-crumb sess27-crumb-${c.state}`}>{c.label}</span>
          </span>
        ))}
      </nav>
    </div>
  );
}

export function ActiveToolDemo() {
  const [tool, setTool] = useState('jsEndpointMiner');
  const badge = activeToolBadge(tool);
  return (
    <div className="sess27-card" data-testid="active-tool">
      <strong>Active-tool indicator</strong>
      <input value={tool} onChange={e => setTool(e.target.value)} aria-label="Active tool" />
      <p>
        <span className="sess27-live-badge">
          {badge.live ? '●' : '○'} {badge.label}
        </span>
      </p>
    </div>
  );
}

export function PhaseProgressDemo() {
  const [done, setDone] = useState(6);
  const total = 10;
  const p = phaseProgress(done, total);
  return (
    <div className="sess27-card" data-testid="phase-progress">
      <strong>In-phase progress</strong>
      <div
        className="sess27-progress"
        role="progressbar"
        aria-valuenow={p.pct}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div className="sess27-progress-fill" style={{ width: `${p.pct}%` }} />
      </div>
      <p>
        {p.pct}% — {p.remaining} of {p.total} sub-steps remaining
      </p>
      <button type="button" onClick={() => setDone(Math.min(total, done + 1))}>
        Complete a step
      </button>
    </div>
  );
}

export function SubStepChecklistDemo() {
  const [steps, setSteps] = useState(
    subStepChecklist([
      { id: 's1', label: 'Enumerate subdomains' },
      { id: 's2', label: 'Fingerprint tech stack' },
      { id: 's3', label: 'Mine JS endpoints' },
    ])
  );
  return (
    <div className="sess27-card" data-testid="substep-checklist">
      <strong>Sub-step checklist</strong>
      <ul>
        {steps.map(s => (
          <li key={s.id}>
            <label>
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => setSteps(tickSubStep(steps, s.id))}
              />{' '}
              {s.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TimeInPhaseDemo() {
  const [now, setNow] = useState(45 * 60000);
  const t = timeInPhase(0, 60, now);
  return (
    <div className="sess27-card" data-testid="time-in-phase">
      <strong>Time-in-phase readout</strong>
      <p>
        {t.elapsedMin}m of {t.budgetMin}m budget ({t.pctOfBudget}%)
        {t.overBudget ? ' — over budget ⚠️' : ''}
      </p>
      <button type="button" onClick={() => setNow(now + 10 * 60000)}>
        +10 min
      </button>
    </div>
  );
}

export function LastActionDemo() {
  const [now, setNow] = useState(30000);
  const s = lastActionStamp(0, now);
  return (
    <div className="sess27-card" data-testid="last-action">
      <strong>Last-action timestamp</strong>
      <p>
        Last action: {s.label}
        {s.stalled ? ' — stalled? ⚠️' : ' — active ✅'}
      </p>
      <button type="button" onClick={() => setNow(now + 60000)}>
        +1 min
      </button>
    </div>
  );
}

export function NextActionDemo() {
  const preview = nextActionPreview(['fuzz /api/users', 'verify SSRF candidate', 'write report']);
  return (
    <div className="sess27-card" data-testid="next-action">
      <strong>Next-action preview</strong>
      <p>
        Next: <code>{preview.action || 'queue empty'}</code> ({preview.remaining} more queued)
      </p>
    </div>
  );
}

export function StatusLanguageDemo() {
  const [lang, setLang] = useState('en');
  return (
    <div className="sess27-card" data-testid="status-lang">
      <strong>Status in your language</strong>
      <div role="radiogroup" aria-label="Status language">
        {STATUS_LANGS.map(l => (
          <label key={l}>
            <input
              type="radio"
              name="statuslang"
              checked={lang === l}
              onChange={() => setLang(l)}
            />{' '}
            {l}
          </label>
        ))}
      </div>
      <p>{statusInLanguage('fuzzing /api params, 64% done', lang)}</p>
    </div>
  );
}

export function StatusCardDemo() {
  const card = statusCard({
    phase: 'Vuln scan',
    action: 'fuzzing /api params',
    progressPct: 64,
    etaMin: 22,
  });
  return (
    <div className="sess27-card sess27-status-card" data-testid="status-card">
      <strong>Visual status card</strong>
      <dl>
        <div>
          <dt>Phase</dt>
          <dd>{card.phase}</dd>
        </div>
        <div>
          <dt>Action</dt>
          <dd>{card.action}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>{card.progressPct}%</dd>
        </div>
        <div>
          <dt>ETA</dt>
          <dd>{card.eta}</dd>
        </div>
      </dl>
    </div>
  );
}

export function StatusTimelineDemo() {
  const [history, setHistory] = useState([
    { id: 'st-1', text: 'Recon started', ts: 0 },
    { id: 'st-2', text: '42 subdomains found', ts: 60000 },
  ]);
  return (
    <div className="sess27-card" data-testid="status-timeline">
      <strong>Status history timeline</strong>
      <ol>
        {history.map(h => (
          <li key={h.id}>{h.text}</li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() =>
          setHistory(
            appendStatus(history, {
              text: `Checkpoint ${history.length + 1}`,
              ts: history.length * 60000,
            })
          )
        }
      >
        Add status
      </button>
    </div>
  );
}

export function DigestSchedulerDemo() {
  const [intervalMin, setIntervalMin] = useState(30);
  const [now, setNow] = useState(40 * 60000);
  const { due } = digestSchedule(0, intervalMin, now);
  return (
    <div className="sess27-card" data-testid="digest-scheduler">
      <strong>Scheduled status digests</strong>
      <label>
        Every{' '}
        <select
          value={intervalMin}
          onChange={e => setIntervalMin(Number(e.target.value))}
          aria-label="Digest interval"
        >
          {[15, 30, 60].map(m => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </label>
      <p>{due ? 'Digest due — posting now ✅' : 'Next digest on schedule.'}</p>
      <button type="button" onClick={() => setNow(now + 15 * 60000)}>
        +15 min
      </button>
    </div>
  );
}

export function AskAboutActionDemo() {
  const [action] = useState('fuzzing /api params');
  const [open, setOpen] = useState(false);
  const info = explainAction(action);
  return (
    <div className="sess27-card" data-testid="ask-action">
      <strong>Ask-about-this-action</strong>
      <p>
        Running: <code>{action}</code>{' '}
        <button type="button" onClick={() => setOpen(!open)}>
          Why?
        </button>
      </p>
      {open && (
        <p>
          {info.why} Expected: {info.expects}
        </p>
      )}
    </div>
  );
}

export function BlockerAlertDemo() {
  const [blocker, setBlocker] = useState(reportBlocker(BLOCKER_NONE));
  return (
    <div className="sess27-card" data-testid="blocker-alert">
      <strong>Self-reported blockers</strong>
      {!blocker.selfReported && (
        <button
          type="button"
          onClick={() => setBlocker(reportBlocker(BLOCKER_STUCK, 'WAF blocking /admin fuzzing'))}
        >
          Simulate blocker
        </button>
      )}
      {blocker.selfReported && (
        <p role="alert">
          Stuck: {blocker.detail}{' '}
          <button type="button" onClick={() => setBlocker(reportBlocker(BLOCKER_NONE))}>
            Clear
          </button>
        </p>
      )}
    </div>
  );
}

export function WaitingOnYouDemo() {
  const [state, setState] = useState(waitingOnYou(''));
  return (
    <div className="sess27-card" data-testid="waiting-flag">
      <strong>Waiting-on-you flag</strong>
      <button
        type="button"
        onClick={() => setState(waitingOnYou('Approve PoC for CVE-2026-1234?'))}
      >
        Simulate approval needed
      </button>
      <button type="button" onClick={() => setState(waitingOnYou(''))}>
        Clear
      </button>
      <p>{state.waiting ? `⏸️ Waiting on you: ${state.reason}` : 'Running normally ✅'}</p>
    </div>
  );
}

export function PlanVsRealityDemo() {
  const rows = planVsReality(DEMO_PLAN, [{ id: 'recon' }, { id: 'scan' }, { id: 'fuzz-extra' }]);
  return (
    <div className="sess27-card" data-testid="plan-reality">
      <strong>Plan-vs-reality view</strong>
      <ul>
        {rows.map(r => (
          <li key={r.planned}>
            {r.planned} → {r.actual || '—'} <code>{r.deviation}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShareStatusLinkDemo() {
  const [link, setLink] = useState('');
  return (
    <div className="sess27-card" data-testid="share-status">
      <strong>Shareable status link</strong>
      <button type="button" onClick={() => setLink(shareStatusLink('hunt-42', 'tok-abc123'))}>
        Generate read-only link
      </button>
      {link && (
        <p>
          <code>{link}</code>
        </p>
      )}
    </div>
  );
}

export function SpokenStatusDemo() {
  const text = spokenStatus({ phase: 'Vuln scan', action: 'fuzzing /api params', progressPct: 64 });
  return (
    <div className="sess27-card" data-testid="spoken-status">
      <strong>Spoken status readout</strong>
      <p>{text}</p>
      <button
        type="button"
        onClick={() => {
          if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(u);
          }
        }}
      >
        Read aloud
      </button>
    </div>
  );
}

export function DashboardWidgetDemo() {
  const w = dashboardWidget({
    huntId: 'hunt-42',
    phase: 'Vuln scan',
    progressPct: 64,
    criticals: 3,
    waiting: false,
  });
  return (
    <div className="sess27-card sess27-widget" data-testid="dashboard-widget">
      <strong>Dashboard status widget</strong>
      <p>
        {w.huntId} · {w.phase} · {w.progressPct}%{w.attention ? ' · ⚠️ needs attention' : ''}
      </p>
    </div>
  );
}

/* Gallery                                                              */

export function StatusSuiteGallery() {
  return (
    <div className="sess27-gallery" data-testid="status-gallery">
      <h3>Status layer gallery (51061–51080)</h3>
      <InstantStatusDemo />
      <NarrationDemo />
      <PhaseBreadcrumbDemo />
      <ActiveToolDemo />
      <PhaseProgressDemo />
      <SubStepChecklistDemo />
      <TimeInPhaseDemo />
      <LastActionDemo />
      <NextActionDemo />
      <StatusLanguageDemo />
      <StatusCardDemo />
      <StatusTimelineDemo />
      <DigestSchedulerDemo />
      <AskAboutActionDemo />
      <BlockerAlertDemo />
      <WaitingOnYouDemo />
      <PlanVsRealityDemo />
      <ShareStatusLinkDemo />
      <SpokenStatusDemo />
      <DashboardWidgetDemo />
    </div>
  );
}

export const WAVE27_STATUS_COMPONENTS = [
  'InstantStatusDemo',
  'NarrationDemo',
  'PhaseBreadcrumbDemo',
  'ActiveToolDemo',
  'PhaseProgressDemo',
  'SubStepChecklistDemo',
  'TimeInPhaseDemo',
  'LastActionDemo',
  'NextActionDemo',
  'StatusLanguageDemo',
  'StatusCardDemo',
  'StatusTimelineDemo',
  'DigestSchedulerDemo',
  'AskAboutActionDemo',
  'BlockerAlertDemo',
  'WaitingOnYouDemo',
  'PlanVsRealityDemo',
  'ShareStatusLinkDemo',
  'SpokenStatusDemo',
  'DashboardWidgetDemo',
];

export default StatusSuiteGallery;
