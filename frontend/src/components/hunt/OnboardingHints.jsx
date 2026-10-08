/**
 * OnboardingHints.jsx — wave 21 (ideas 50801–50840): contextual hint cards.
 *
 * Real, working first-time hint components: dismissible hint cards with a
 * global tips toggle, first-finding pulse, operator/filter/pause/export
 * walkthroughs, shortcut + schedule + team-invite nudges, models/chat/
 * share/chain/FP/confidence hints, tip-of-the-day, rotating help tips,
 * integration/paywall/rating/theme hints, video snippets, synced-state
 * badge, and the one-click Copy-PoC button.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  shouldShowHint,
  dismissHint,
  setTipsEnabled,
  suggestFirstOperator,
  filterComboTip,
  chatExampleQuestions,
  deepLinkHowTo,
  chainExplainer,
  fpDismissalGuide,
  explainConfidence,
  zeroResultsRecovery,
  printHint,
  timelineClickTip,
  tipOfTheDay,
  rotatingHelpTip,
  slackIntegrationHint,
  paywallExplainer,
  postHuntRatingPrompt,
  darkModeHint,
  voiceCommandHint,
  a11yShortcutHint,
  modelsPageHint,
  weakTargetCheck,
  exportWalkthroughSteps,
  shortcutNudgeCopy,
  shouldNudgeShortcut,
  shouldSuggestSchedule,
  shouldSuggestInvite,
  videoSnippetSpec,
  mergeHintState,
  pocMarkdown,
  POWER_TIPS,
} from './onboardingCore.js';
import './Onboarding.css';

const LS_SEEN = 'infinite.onboarding.seen.v1';
const LS_PREFS = 'infinite.onboarding.prefs.v1';

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

/** Shared hook: seen-ids + tips toggle, synced across tabs via storage event. */
export function useHintState() {
  const [seenIds, setSeenIds] = useState(() => loadJson(LS_SEEN, []));
  const [prefs, setPrefs] = useState(() => loadJson(LS_PREFS, { tipsEnabled: true }));

  useEffect(() => {
    const onStorage = e => {
      if (e.key === LS_SEEN || e.key === LS_PREFS) {
        // 50835 — merge so a dismissal on one device sticks everywhere
        const merged = mergeHintState(
          {
            seenIds: loadJson(LS_SEEN, []),
            tipsEnabled: loadJson(LS_PREFS, { tipsEnabled: true }).tipsEnabled,
          },
          { seenIds: [], tipsEnabled: true }
        );
        setSeenIds(merged.seenIds);
        setPrefs(p => ({ ...p, tipsEnabled: merged.tipsEnabled }));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const dismiss = hintId => {
    const next = dismissHint(seenIds, hintId);
    setSeenIds(next);
    saveJson(LS_SEEN, next);
  };

  const setEnabled = enabled => {
    const next = setTipsEnabled(prefs, enabled);
    setPrefs(next);
    saveJson(LS_PREFS, next);
  };

  return {
    seenIds: new Set(seenIds),
    dismiss,
    tipsEnabled: prefs.tipsEnabled !== false,
    setEnabled,
  };
}

/* ------------------------------------------------------------------ */
/* Base hint card (50807 — individually dismissible)                    */
/* ------------------------------------------------------------------ */

export function HintCard({ hintId, title, children, hintState, tone = 'info', action }) {
  const hs = hintState || {};
  if (!shouldShowHint(hintId, hs.seenIds, hs.tipsEnabled)) return null;
  return (
    <div className={`ob-hint-card ob-hint-${tone}`} role="note" aria-label={title}>
      <button
        type="button"
        className="ob-hint-dismiss"
        aria-label={`Dismiss: ${title}`}
        onClick={() => hs.dismiss && hs.dismiss(hintId)}
      >
        ×
      </button>
      <div className="ob-hint-title">{title}</div>
      <div className="ob-hint-body">{children}</div>
      {action && (
        <div className="ob-hint-actions">
          <button type="button" className="ob-btn ob-btn-ghost" onClick={action.onClick}>
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}

/** 50807 — global toggle that hides every tip at once. */
export function GlobalTipsToggle({ hintState }) {
  const hs = hintState;
  if (!hs) return null;
  return (
    <label className="ob-tips-toggle">
      <input
        type="checkbox"
        checked={hs.tipsEnabled}
        onChange={e => hs.setEnabled && hs.setEnabled(e.target.checked)}
      />
      Show onboarding tips
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* First-time hints                                                     */
/* ------------------------------------------------------------------ */

/** 50802 — the first finding pulses with an explainer. */
export function FirstFindingHint({ hintState }) {
  return (
    <HintCard
      hintId="first-finding"
      title="This is a finding card"
      hintState={hintState}
      tone="highlight"
    >
      <span className="ob-pulse-demo">Expand it</span> — every card carries severity, confidence,
      evidence, and a one-click PoC.
    </HintCard>
  );
}

/** 50803 — empty search suggests the first operator. */
export function FirstOperatorHint({ query, hintState, onApply }) {
  const suggestion = suggestFirstOperator(query);
  if (!suggestion) return null;
  return (
    <HintCard hintId="first-operator" title="Search like a pro" hintState={hintState}>
      {suggestion.hint}{' '}
      <button
        type="button"
        className="ob-link-btn"
        onClick={() => onApply && onApply(suggestion.operator)}
      >
        {suggestion.label}
      </button>
    </HintCard>
  );
}

/** 50804 — the first pause explains auto-save. */
export function FirstPauseHint({ hintState }) {
  return (
    <HintCard hintId="first-pause" title="Hunts can pause anytime" hintState={hintState}>
      State saves automatically — resume exactly where you left off, even days later.
    </HintCard>
  );
}

/** 50808 — first export walks through PDF vs Markdown. */
export function FirstExportWalkthrough({ hintState }) {
  const steps = useMemo(() => exportWalkthroughSteps(), []);
  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  if (!shouldShowHint('first-export', hintState?.seenIds, hintState?.tipsEnabled)) return null;
  return (
    <div className="ob-hint-card" role="dialog" aria-label="Export walkthrough">
      <button
        type="button"
        className="ob-hint-dismiss"
        aria-label="Dismiss export walkthrough"
        onClick={() => hintState?.dismiss && hintState.dismiss('first-export')}
      >
        ×
      </button>
      <div className="ob-hint-title">
        {step.title} ({idx + 1}/{steps.length})
      </div>
      <p className="ob-hint-body">{step.body}</p>
      <div className="ob-hint-actions">
        {idx > 0 && (
          <button type="button" className="ob-btn ob-btn-ghost" onClick={() => setIdx(idx - 1)}>
            Back
          </button>
        )}
        {idx < steps.length - 1 ? (
          <button type="button" className="ob-btn ob-btn-primary" onClick={() => setIdx(idx + 1)}>
            Next
          </button>
        ) : (
          <button
            type="button"
            className="ob-btn ob-btn-primary"
            onClick={() => hintState?.dismiss && hintState.dismiss('first-export')}
          >
            Got it
          </button>
        )}
      </div>
    </div>
  );
}

/** 50809 — shortcut nudge after 5 mouse-driven reviews. */
export function ShortcutNudge({ mouseReviewCount, hintState }) {
  if (!shouldNudgeShortcut(mouseReviewCount, hintState?.seenIds)) return null;
  const copy = shortcutNudgeCopy();
  return (
    <HintCard hintId="shortcut-nudge" title={copy.title} hintState={hintState}>
      {copy.body} <kbd className="ob-kbd">{copy.shortcut}</kbd>
    </HintCard>
  );
}

/** 50810 — teach combining severity + status. */
export function FirstFilterHint({ hintState, onApply }) {
  const tip = useMemo(() => filterComboTip(), []);
  return (
    <HintCard hintId="first-filter" title={tip.title} hintState={hintState}>
      {tip.body}{' '}
      <button type="button" className="ob-link-btn" onClick={() => onApply && onApply(tip.example)}>
        {tip.example}
      </button>
    </HintCard>
  );
}

/** 50813 — brain slots need models. */
export function ModelsPageHint({ hintState, onOpenModels }) {
  const hint = useMemo(() => modelsPageHint(), []);
  return (
    <HintCard hintId="models-page" title={hint.title} hintState={hintState}>
      {hint.body}
      <div className="ob-hint-actions">
        <button
          type="button"
          className="ob-btn ob-btn-ghost"
          onClick={() => onOpenModels && onOpenModels()}
        >
          {hint.action.label}
        </button>
      </div>
    </HintCard>
  );
}

/** 50814 — three example questions for the mid-hunt chat. */
export function FirstChatHint({ hintState, onAsk }) {
  const questions = useMemo(() => chatExampleQuestions(), []);
  return (
    <HintCard hintId="first-chat" title="Ask the agent anything" hintState={hintState}>
      <ul className="ob-example-list">
        {questions.map(q => (
          <li key={q}>
            <button type="button" className="ob-link-btn" onClick={() => onAsk && onAsk(q)}>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </HintCard>
  );
}

/** 50816 — weak target pasted: suggest stronger alternatives. */
export function WeakTargetHint({ url, hintState }) {
  const check = weakTargetCheck(url);
  if (!check.weak) return null;
  return (
    <HintCard hintId="weak-target" title="Weak target?" hintState={hintState} tone="warn">
      That looks like a {check.reason}. {check.suggestion}
    </HintCard>
  );
}

/** 50817 — deep links from any finding card menu. */
export function FirstShareHint({ hintState }) {
  const how = useMemo(() => deepLinkHowTo(), []);
  return (
    <HintCard hintId="first-share" title={how.title} hintState={hintState}>
      {how.body}
    </HintCard>
  );
}

/** 50820 — auto-chained findings explained. */
export function FirstChainHint({ hintState }) {
  const explainer = useMemo(() => chainExplainer(), []);
  return (
    <HintCard hintId="first-chain" title={explainer.title} hintState={hintState} tone="highlight">
      {explainer.body}
    </HintCard>
  );
}

/** 50821 — FP dismissal flow + learning effect. */
export function FirstFPHint({ hintState }) {
  const guide = useMemo(() => fpDismissalGuide(), []);
  return (
    <HintCard hintId="first-fp" title={guide.title} hintState={hintState}>
      {guide.body}
      <ol className="ob-mini-steps">
        {guide.steps.map(s => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </HintCard>
  );
}

/** 50824 — schedule hint after the third manual run. */
export function ScheduleHint({ manualRunCount, hintState, onSchedule }) {
  if (!shouldSuggestSchedule(manualRunCount, hintState?.seenIds)) return null;
  return (
    <HintCard hintId="schedule-hint" title="Automate this hunt" hintState={hintState}>
      You've run this manually {manualRunCount} times — schedule it weekly and let the agent do the
      repetition.
      <div className="ob-hint-actions">
        <button
          type="button"
          className="ob-btn ob-btn-ghost"
          onClick={() => onSchedule && onSchedule()}
        >
          Set up schedule
        </button>
      </div>
    </HintCard>
  );
}

/** 50825 — low-confidence finding explainer. */
export function LowConfidenceHint({ score, hintState }) {
  const explained = explainConfidence(score);
  if (explained.band !== 'low') return null;
  return (
    <HintCard hintId="low-confidence" title="What “low confidence” means" hintState={hintState}>
      {explained.advice}
    </HintCard>
  );
}

/** 50827 — team-invite hint after the second hunt. */
export function TeamInviteHint({ huntCount, hintState, onInvite }) {
  if (!shouldSuggestInvite(huntCount, hintState?.seenIds)) return null;
  return (
    <HintCard hintId="team-invite-hint" title="Hunting alone?" hintState={hintState}>
      Invite reviewers to collaborate — findings, comments, and triage stay in sync.
      <div className="ob-hint-actions">
        <button
          type="button"
          className="ob-btn ob-btn-ghost"
          onClick={() => onInvite && onInvite()}
        >
          Invite team
        </button>
      </div>
    </HintCard>
  );
}

/** 50828 — mobile voice-command hint. */
export function VoiceCommandHint({ isMobile, hintState }) {
  const hint = voiceCommandHint(isMobile);
  if (!hint) return null;
  return (
    <HintCard hintId="voice-command" title={hint.title} hintState={hintState}>
      {hint.body}
    </HintCard>
  );
}

/** 50829 — zero-results recovery. */
export function ZeroResultsHint({ hintState, onClear }) {
  const recovery = useMemo(() => zeroResultsRecovery(), []);
  return (
    <HintCard hintId="zero-results" title={recovery.title} hintState={hintState} tone="warn">
      {recovery.body}
      <div className="ob-hint-actions">
        <button type="button" className="ob-btn ob-btn-ghost" onClick={() => onClear && onClear()}>
          {recovery.action.label}
        </button>
      </div>
    </HintCard>
  );
}

/** 50830 — accessibility onboarding. */
export function A11yShortcutHint({ hintState }) {
  const hint = useMemo(() => a11yShortcutHint(), []);
  return (
    <HintCard hintId="a11y-shortcuts" title={hint.title} hintState={hintState}>
      {hint.body} <kbd className="ob-kbd">{hint.shortcut}</kbd>
    </HintCard>
  );
}

/** 50831 — print hint. */
export function FirstPrintHint({ hintState }) {
  const hint = useMemo(() => printHint(), []);
  return (
    <HintCard hintId="first-print" title={hint.title} hintState={hintState}>
      {hint.body} <kbd className="ob-kbd">{hint.shortcut}</kbd>
    </HintCard>
  );
}

/** 50832 — timeline click hint. */
export function TimelineClickHint({ hintState }) {
  const tip = useMemo(() => timelineClickTip(), []);
  return (
    <HintCard hintId="timeline-click" title={tip.title} hintState={hintState}>
      {tip.body}
    </HintCard>
  );
}

/** 50833 — rotating "did you know" per help-panel visit. */
export function RotatingHelpTip({ visitCount, hintState }) {
  const tip = rotatingHelpTip(visitCount);
  if (!tip || !hintState?.tipsEnabled) return null;
  return (
    <div className="ob-did-you-know" role="note">
      <strong>Did you know?</strong> {tip.tip}
    </div>
  );
}

/** 50834 — Slack integration hint after first export. */
export function IntegrationHint({ hintState, onConnect }) {
  const hint = useMemo(() => slackIntegrationHint(), []);
  return (
    <HintCard hintId="integration-slack" title={hint.title} hintState={hintState}>
      {hint.body}
      <div className="ob-hint-actions">
        <button
          type="button"
          className="ob-btn ob-btn-ghost"
          onClick={() => onConnect && onConnect()}
        >
          {hint.action.label}
        </button>
      </div>
    </HintCard>
  );
}

/** 50835 — synced-state badge (dismissals follow the user). */
export function SyncedHintBadge() {
  return (
    <span className="ob-synced-badge" title="Dismissed hints stay dismissed on all your devices">
      Synced across devices
    </span>
  );
}

/** 50836 — paywall explainer with trial CTA. */
export function PaywallExplainerHint({ tierName, hintState, onTrial }) {
  const copy = paywallExplainer(tierName || 'Pro');
  return (
    <HintCard hintId="paywall-explainer" title={copy.title} hintState={hintState} tone="highlight">
      {copy.body}
      <div className="ob-hint-actions">
        <button
          type="button"
          className="ob-btn ob-btn-primary"
          onClick={() => onTrial && onTrial()}
        >
          {copy.cta.label}
        </button>
      </div>
    </HintCard>
  );
}

/** 50837 — post-hunt rating invite. */
export function PostHuntRatingHint({ huntLabel, hintState, onRate }) {
  const prompt = postHuntRatingPrompt(huntLabel || 'this hunt');
  const [rating, setRating] = useState(0);
  if (!shouldShowHint('post-hunt-rating', hintState?.seenIds, hintState?.tipsEnabled)) return null;
  return (
    <div className="ob-hint-card" role="dialog" aria-label="Rate this hunt">
      <div className="ob-hint-title">{prompt.title}</div>
      <p className="ob-hint-body">{prompt.body}</p>
      <div className="ob-rating-stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            className={`ob-star ${rating >= n ? 'ob-star-on' : ''}`}
            onClick={() => {
              setRating(n);
              onRate && onRate(n);
              hintState?.dismiss && hintState.dismiss('post-hunt-rating');
            }}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

/** 50838 — dark-mode hint. */
export function DarkModeHint({ hintState }) {
  const hint = useMemo(() => darkModeHint(), []);
  return (
    <HintCard hintId="dark-mode" title={hint.title} hintState={hintState}>
      {hint.body} <kbd className="ob-kbd">{hint.shortcut}</kbd>
    </HintCard>
  );
}

/* ------------------------------------------------------------------ */
/* 50822 — embedded video snippet                                       */
/* ------------------------------------------------------------------ */

export function VideoSnippet({ flowId }) {
  const spec = videoSnippetSpec(flowId);
  return (
    <figure className="ob-video-snippet">
      <video
        className="ob-video-player"
        controls
        preload="metadata"
        src={spec.src}
        aria-label={spec.caption}
      />
      <figcaption>{spec.caption}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* 50823 — tip of the day                                               */
/* ------------------------------------------------------------------ */

export function TipOfTheDayCard({ dateStr, hintState }) {
  const tip = tipOfTheDay(dateStr || new Date().toISOString().slice(0, 10));
  const hintId = `tip-of-day-${tip.date}`;
  if (!shouldShowHint(hintId, hintState?.seenIds, hintState?.tipsEnabled)) return null;
  return (
    <div className="ob-tip-of-day" role="note">
      <button
        type="button"
        className="ob-hint-dismiss"
        aria-label="Dismiss today's tip"
        onClick={() => hintState?.dismiss && hintState.dismiss(hintId)}
      >
        ×
      </button>
      <div className="ob-hint-title">Tip of the day</div>
      <p className="ob-hint-body">{tip.tip}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50840 — one-click Copy-PoC button                                    */
/* ------------------------------------------------------------------ */

export function CopyPoCButton({ finding, onCopied }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const text = pocMarkdown(finding);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 50840 fallback: selectable modal when clipboard is blocked
      const w = window.open('', '_blank', 'width=640,height=480');
      if (w) {
        w.document.write(`<pre>${text.replace(/</g, '&lt;')}</pre>`);
        w.document.close();
      }
      return;
    }
    setCopied(true);
    onCopied && onCopied(text);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      className={`ob-btn ${copied ? 'ob-btn-success' : 'ob-btn-ghost'} ob-copy-poc`}
      onClick={copy}
      aria-label="Copy PoC as markdown"
      title="Copy PoC as markdown"
    >
      {copied ? '✓ Copied' : 'Copy PoC'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery — reference showcase of every hint component                 */
/* ------------------------------------------------------------------ */

export function OnboardingHintsGallery() {
  const noop = () => {};
  const hs = { seenIds: new Set(), tipsEnabled: true, dismiss: noop, setEnabled: noop };
  return (
    <div className="ob-gallery">
      <h3>Onboarding hint components</h3>
      <GlobalTipsToggle hintState={hs} />
      <FirstFindingHint hintState={hs} />
      <FirstOperatorHint query="" hintState={hs} onApply={noop} />
      <FirstPauseHint hintState={hs} />
      <FirstFilterHint hintState={hs} onApply={noop} />
      <ModelsPageHint hintState={hs} onOpenModels={noop} />
      <FirstChatHint hintState={hs} onAsk={noop} />
      <WeakTargetHint url="https://example.com" hintState={hs} />
      <FirstShareHint hintState={hs} />
      <FirstChainHint hintState={hs} />
      <FirstFPHint hintState={hs} />
      <ScheduleHint manualRunCount={4} hintState={hs} onSchedule={noop} />
      <LowConfidenceHint score={0.32} hintState={hs} />
      <TeamInviteHint huntCount={2} hintState={hs} onInvite={noop} />
      <VoiceCommandHint isMobile hintState={hs} />
      <ZeroResultsHint hintState={hs} onClear={noop} />
      <A11yShortcutHint hintState={hs} />
      <FirstPrintHint hintState={hs} />
      <TimelineClickHint hintState={hs} />
      <RotatingHelpTip visitCount={2} hintState={hs} />
      <IntegrationHint hintState={hs} onConnect={noop} />
      <SyncedHintBadge />
      <PaywallExplainerHint tierName="Pro" hintState={hs} onTrial={noop} />
      <PostHuntRatingHint huntLabel="demo hunt" hintState={hs} onRate={noop} />
      <DarkModeHint hintState={hs} />
      <VideoSnippet flowId="triage" />
      <TipOfTheDayCard dateStr="2026-10-07" hintState={hs} />
      <CopyPoCButton
        finding={{
          title: 'SQLi',
          severity: 'critical',
          confidence: 0.91,
          target: 'https://demo/shop/login',
          huntId: 'h1',
          poc: "' OR 1=1--",
          remediation: 'Use parameterized queries.',
        }}
        onCopied={noop}
      />
    </div>
  );
}
