/**
 * OnboardingTour.jsx — wave 21 (ideas 50801–50840): guided tour components.
 *
 * Real, working first-run experience components: a six-step resumable
 * coach-mark tour, welcome-back tour, dashboard widget tour, the onboarding
 * checklist with sidebar progress, checklist celebration, graduation into
 * the tips archive, sample-hunt launcher, sandbox banner, role-based path
 * picker, and drip-email preference card.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  COACH_MARK_STEPS, ONBOARDING_STEPS, createTourState, startTour,
  nextTourStep, prevTourStep, skipTour, tourProgress, checklistProgress,
  completeChecklistStep, celebrationState, graduateChecklist,
  sampleHuntSpec, sandboxConfig, roleOnboardingPath, dripEmailSchedule,
  daysBetween, shouldShowWelcomeBack, welcomeBackCopy, widgetTourSteps,
  shouldShowHint, dismissHint, setTipsEnabled,
} from './onboardingCore.js';
import './Onboarding.css';

/* ------------------------------------------------------------------ */
/* localStorage helpers (components own persistence; core stays pure)   */
/* ------------------------------------------------------------------ */

const LS_TOUR = 'infinite.onboarding.tour.v1';
const LS_CHECKLIST = 'infinite.onboarding.checklist.v1';
const LS_TIPS = 'infinite.onboarding.tips.v1';
const LS_SEEN = 'infinite.onboarding.seen.v1';
const LS_PREFS = 'infinite.onboarding.prefs.v1';

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

/* ------------------------------------------------------------------ */
/* 50801 — Coach-mark tour                                              */
/* ------------------------------------------------------------------ */

/** Spotlight overlay + step card. Controlled via tour state machine. */
export function CoachMarkTour({ onDone }) {
  const [tour, setTour] = useState(() => {
    const saved = loadJson(LS_TOUR, null);
    if (saved && saved.status === 'active') return startTour(createTourState(), saved.stepIndex || 0);
    return createTourState();
  });

  useEffect(() => {
    saveJson(LS_TOUR, { stepIndex: tour.stepIndex, status: tour.status });
  }, [tour]);

  const step = tour.status === 'active' ? COACH_MARK_STEPS[tour.stepIndex] : null;
  const progress = tourProgress(tour);

  const finish = useCallback((next) => {
    setTour(next);
    if ((next.status === 'done' || next.status === 'skipped') && onDone) onDone(next.status);
  }, [onDone]);

  if (tour.status !== 'active' || !step) return null;

  return (
    <div className="ob-tour-overlay" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="ob-tour-spotlight" aria-hidden="true" />
      <div className="ob-tour-card">
        <div className="ob-tour-stepcount">Step {tour.stepIndex + 1} of {COACH_MARK_STEPS.length}</div>
        <h3 className="ob-tour-title">{step.title}</h3>
        <p className="ob-tour-body">{step.body}</p>
        <div className="ob-tour-progress" aria-hidden="true">
          <div className="ob-tour-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="ob-tour-actions">
          <button type="button" className="ob-btn ob-btn-ghost" onClick={() => finish(skipTour(tour))}>
            Skip tour
          </button>
          <span className="ob-tour-nav">
            <button
              type="button" className="ob-btn ob-btn-ghost"
              disabled={tour.stepIndex === 0}
              onClick={() => setTour(prevTourStep(tour))}
            >
              Back
            </button>
            <button type="button" className="ob-btn ob-btn-primary" onClick={() => finish(nextTourStep(tour))}>
              {tour.stepIndex === COACH_MARK_STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </span>
        </div>
        <p className="ob-tour-resume-note">You can resume this tour anytime from Help → Product tour.</p>
      </div>
    </div>
  );
}

/** Small launcher used from the Help panel (50801: "resumable anytime"). */
export function TourLauncher() {
  const [key, setKey] = useState(0);
  return (
    <>
      <button type="button" className="ob-btn ob-btn-ghost" onClick={() => setKey((k) => k + 1)}>
        Restart product tour
      </button>
      <CoachMarkTour key={key} onDone={() => setKey((k) => k + 1)} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 50811 — Welcome-back tour                                            */
/* ------------------------------------------------------------------ */

export function WelcomeBackTour({ lastSeenMs, changeCount = 3, onStart, onDismiss }) {
  const [visible, setVisible] = useState(() => shouldShowWelcomeBack(lastSeenMs));
  if (!visible) return null;
  const idleDays = daysBetween(lastSeenMs);
  const copy = welcomeBackCopy(idleDays, changeCount);
  return (
    <div className="ob-hint-card ob-hint-highlight" role="status">
      <div className="ob-hint-title">{copy.title}</div>
      <p className="ob-hint-body">{copy.body}</p>
      <div className="ob-hint-actions">
        <button type="button" className="ob-btn ob-btn-primary" onClick={() => { setVisible(false); onStart && onStart(); }}>
          Take the tour
        </button>
        <button type="button" className="ob-btn ob-btn-ghost" onClick={() => { setVisible(false); onDismiss && onDismiss(); }}>
          Not now
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50815 — Widget tour                                                  */
/* ------------------------------------------------------------------ */

export function WidgetTour({ onDone }) {
  const steps = useMemo(() => widgetTourSteps(), []);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const step = steps[idx];
  const last = idx === steps.length - 1;
  return (
    <div className="ob-hint-card" role="dialog" aria-label="Dashboard widget tour">
      <div className="ob-hint-title">{step.title} <span className="ob-hint-stepcount">({idx + 1}/{steps.length})</span></div>
      <p className="ob-hint-body">{step.body}</p>
      <div className="ob-hint-actions">
        <button type="button" className="ob-btn ob-btn-ghost" onClick={() => { setOpen(false); onDone && onDone('skipped'); }}>
          Skip
        </button>
        <button
          type="button" className="ob-btn ob-btn-primary"
          onClick={() => { if (last) { setOpen(false); onDone && onDone('done'); } else setIdx(idx + 1); }}
        >
          {last ? 'Got it' : 'Next'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50805 / 50819 / 50839 — checklist, celebration, graduation           */
/* ------------------------------------------------------------------ */

/** Sidebar progress bar: "3 of 7 steps done". */
export function SidebarProgressBar({ doneIds }) {
  const p = checklistProgress(doneIds);
  return (
    <div className="ob-progress-wrap" role="progressbar" aria-valuenow={p.percent} aria-valuemin="0" aria-valuemax="100" aria-label="Onboarding progress">
      <div className="ob-progress-label">{p.label}</div>
      <div className="ob-progress-track">
        <div className="ob-progress-fill" style={{ width: `${p.percent}%` }} />
      </div>
    </div>
  );
}

/** Full checklist card with per-step toggles. */
export function OnboardingChecklist({ doneIds, onChange, onGraduate }) {
  const [done, setDone] = useState(() => doneIds || []);
  const [archived, setArchived] = useState(() => loadJson(LS_TIPS, []));
  const progress = checklistProgress(done);
  const party = celebrationState(progress);

  const toggle = (id) => {
    const next = completeChecklistStep(done, id);
    // allow unchecking too
    const finalIds = done.includes(id) ? done.filter((d) => d !== id) : next;
    setDone(finalIds);
    saveJson(LS_CHECKLIST, finalIds);
    onChange && onChange(finalIds);
  };

  const graduate = () => {
    const res = graduateChecklist(done, archived);
    if (res.graduated) {
      setArchived(res.tips);
      saveJson(LS_TIPS, res.tips);
      setDone([]);
      saveJson(LS_CHECKLIST, []);
      onGraduate && onGraduate(res.tips);
    }
  };

  return (
    <div className="ob-checklist">
      <div className="ob-checklist-head">
        <h3 className="ob-checklist-title">Get started</h3>
        <SidebarProgressBar doneIds={done} />
      </div>
      <ul className="ob-checklist-items">
        {ONBOARDING_STEPS.map((s) => (
          <li key={s.id} className="ob-checklist-item">
            <label>
              <input
                type="checkbox"
                checked={done.includes(s.id)}
                onChange={() => toggle(s.id)}
              />
              <span className={done.includes(s.id) ? 'ob-done' : ''}>{s.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {party.celebrate && (
        <div className="ob-celebration" role="status">
          <div className="ob-celebration-title">{party.title} 🎉</div>
          <p className="ob-celebration-body">{party.body}</p>
          <button type="button" className="ob-btn ob-btn-primary" onClick={graduate}>
            Archive to Tips
          </button>
        </div>
      )}
    </div>
  );
}

/** Archived tips section (50839: graduation target). */
export function TipsArchive() {
  const [tips] = useState(() => loadJson(LS_TIPS, []));
  if (!tips.length) return null;
  return (
    <div className="ob-tips-archive">
      <h4 className="ob-tips-archive-title">Tips</h4>
      <ul>
        {tips.map((t) => (
          <li key={t.id}>
            <strong>{t.title}</strong> — {t.body}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50806 — one-click sample hunt                                        */
/* ------------------------------------------------------------------ */

export function SampleHuntLauncher({ onLaunch }) {
  const spec = useMemo(() => sampleHuntSpec(), []);
  return (
    <div className="ob-hint-card">
      <div className="ob-hint-title">Try a sample hunt</div>
      <p className="ob-hint-body">
        {spec.note} {spec.findings} findings ({spec.critical} critical) in about {Math.round(spec.durationSec / 60)} min.
      </p>
      <div className="ob-hint-actions">
        <button type="button" className="ob-btn ob-btn-primary" onClick={() => onLaunch && onLaunch(spec)}>
          Load sample hunt
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50826 — onboarding sandbox banner                                    */
/* ------------------------------------------------------------------ */

export function SandboxBanner({ onEnter }) {
  const cfg = useMemo(() => sandboxConfig(), []);
  return (
    <div className="ob-sandbox-banner" role="note">
      <div>
        <div className="ob-hint-title">{cfg.label} — $0 quota</div>
        <p className="ob-hint-body">{cfg.body}</p>
      </div>
      <button type="button" className="ob-btn ob-btn-primary" onClick={() => onEnter && onEnter(cfg)}>
        Enter sandbox
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50812 — role-based onboarding                                        */
/* ------------------------------------------------------------------ */

export function RolePathPicker({ onPick }) {
  const [role, setRole] = useState(null);
  const path = role ? roleOnboardingPath(role) : null;
  return (
    <div className="ob-hint-card">
      <div className="ob-hint-title">How will you use Dark Matter?</div>
      <div className="ob-hint-actions">
        {['researcher', 'executive'].map((r) => (
          <button
            key={r}
            type="button"
            className={`ob-btn ${role === r ? 'ob-btn-primary' : 'ob-btn-ghost'}`}
            onClick={() => { setRole(r); onPick && onPick(roleOnboardingPath(r)); }}
          >
            {r === 'researcher' ? 'Security researcher' : 'Executive'}
          </button>
        ))}
      </div>
      {path && (
        <div className="ob-role-tasks">
          <div className="ob-role-headline">{path.headline}</div>
          <ol>
            {path.firstTasks.map((t) => <li key={t}>{t}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50818 — drip email preferences                                       */
/* ------------------------------------------------------------------ */

export function DripEmailCard() {
  const [optedIn, setOptedIn] = useState(() => loadJson('infinite.onboarding.drip.v1', false));
  const schedule = useMemo(() => dripEmailSchedule(optedIn, Date.now()), [optedIn]);
  return (
    <div className="ob-hint-card">
      <div className="ob-hint-title">Onboarding emails</div>
      <p className="ob-hint-body">
        {optedIn
          ? `You're in — ${schedule.length} emails over your first week, starting today.`
          : 'Get 3 short emails over your first week: first hunt, triage tricks, autopilot setup.'}
      </p>
      <div className="ob-hint-actions">
        <button
          type="button"
          className={`ob-btn ${optedIn ? 'ob-btn-ghost' : 'ob-btn-primary'}`}
          onClick={() => { const next = !optedIn; setOptedIn(next); saveJson('infinite.onboarding.drip.v1', next); }}
        >
          {optedIn ? 'Opt out' : 'Opt in'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery — reference showcase of every tour component                 */
/* ------------------------------------------------------------------ */

export function OnboardingTourGallery() {
  const noop = () => {};
  return (
    <div className="ob-gallery">
      <h3>Onboarding tour components</h3>
      <TourLauncher />
      <WelcomeBackTour lastSeenMs={Date.now() - 15 * 86400000} changeCount={4} onStart={noop} onDismiss={noop} />
      <WidgetTour onDone={noop} />
      <OnboardingChecklist doneIds={['target', 'finding', 'chat']} onChange={noop} onGraduate={noop} />
      <SampleHuntLauncher onLaunch={noop} />
      <SandboxBanner onEnter={noop} />
      <RolePathPicker onPick={noop} />
      <DripEmailCard />
      <TipsArchive />
    </div>
  );
}
