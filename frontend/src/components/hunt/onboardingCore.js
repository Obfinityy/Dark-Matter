/**
 * onboardingCore.js — wave 21 (ideas 50801–50840): onboarding / guided tours /
 * contextual hints pure logic.
 *
 * Pure, framework-free logic for the first-run experience: a resumable
 * coach-mark tour state machine, contextual "first time" hint triggers,
 * onboarding checklist progress, welcome-back detection, role-based paths,
 * tip-of-the-day rotation, drip-email schedule, dismiss/sync state merges,
 * weak-target detection, confidence explanations, and PoC markdown export.
 *
 * No skips — all 40 ideas are new in this wave.
 */

export const WAVE21_IDEAS = [
  [50801, 'Coach-mark tour', 'new'],
  [50802, 'First-finding hint', 'new'],
  [50803, 'First-operator hint', 'new'],
  [50804, 'First-pause hint', 'new'],
  [50805, 'Sidebar progress bar', 'new'],
  [50806, 'One-click sample hunt', 'new'],
  [50807, 'Dismissible hint cards', 'new'],
  [50808, 'First-export walkthrough', 'new'],
  [50809, 'Shortcut nudge', 'new'],
  [50810, 'First-filter hint', 'new'],
  [50811, 'Welcome-back tour', 'new'],
  [50812, 'Role-based onboarding', 'new'],
  [50813, 'Models-page hint', 'new'],
  [50814, 'First-chat hint', 'new'],
  [50815, 'Widget tour', 'new'],
  [50816, 'Weak-target hint', 'new'],
  [50817, 'First-share hint', 'new'],
  [50818, 'Opt-in drip emails', 'new'],
  [50819, 'Checklist celebration', 'new'],
  [50820, 'First-chain hint', 'new'],
  [50821, 'First-FP hint', 'new'],
  [50822, 'Embedded video snippets', 'new'],
  [50823, 'Tip-of-the-day card', 'new'],
  [50824, 'Schedule hint', 'new'],
  [50825, 'Low-confidence hint', 'new'],
  [50826, 'Onboarding sandbox', 'new'],
  [50827, 'Team-invite hint', 'new'],
  [50828, 'Voice-command hint', 'new'],
  [50829, 'Zero-results hint', 'new'],
  [50830, 'Accessibility onboarding', 'new'],
  [50831, 'First-print hint', 'new'],
  [50832, 'Timeline-click hint', 'new'],
  [50833, 'Rotating help-panel tips', 'new'],
  [50834, 'Integration hint', 'new'],
  [50835, 'Synced hint state', 'new'],
  [50836, 'Paywall-explainer hint', 'new'],
  [50837, 'Post-hunt rating hint', 'new'],
  [50838, 'Dark-mode hint', 'new'],
  [50839, 'Onboarding graduation', 'new'],
  [50840, 'Copy-PoC button', 'new'],
].map(([id, title, status, skipReason]) => ({ id, title, status, skipReason: skipReason || null }));

/* ------------------------------------------------------------------ */
/* 50801 — Coach-mark tour state machine                                */
/* ------------------------------------------------------------------ */

export const COACH_MARK_STEPS = [
  { id: 'target', title: 'Pick a target', body: 'Paste any URL above to start a hunt. We only touch what you authorize.' },
  { id: 'launch', title: 'Launch the hunt', body: 'One click starts the agent loop — recon, probing, and analysis.' },
  { id: 'timeline', title: 'Watch the timeline', body: 'Every agent action streams here in real time. Click any step to inspect it.' },
  { id: 'findings', title: 'Review findings', body: 'Findings land here with severity, confidence, and evidence attached.' },
  { id: 'chat', title: 'Ask the agent', body: 'Mid-hunt, ask anything — "why is this critical?" works great.' },
  { id: 'report', title: 'Export the report', body: 'One click exports PDF or Markdown with every PoC included.' },
];

/** Fresh tour state. `stepIndex` is 0-based; -1 means not started. */
export function createTourState() {
  return { stepIndex: -1, status: 'idle', startedAt: null, completedAt: null };
  // status: idle | active | skipped | done
}

/** Begin (or resume) the tour at a given step. Pure — returns new state. */
export function startTour(state, stepIndex = 0) {
  const clamped = Math.max(0, Math.min(COACH_MARK_STEPS.length - 1, stepIndex | 0));
  return {
    ...state,
    stepIndex: clamped,
    status: 'active',
    startedAt: state.startedAt || Date.now(),
    completedAt: null,
  };
}

export function nextTourStep(state) {
  if (state.status !== 'active') return state;
  if (state.stepIndex >= COACH_MARK_STEPS.length - 1) {
    return { ...state, status: 'done', completedAt: Date.now() };
  }
  return { ...state, stepIndex: state.stepIndex + 1 };
}

export function prevTourStep(state) {
  if (state.status !== 'active') return state;
  return { ...state, stepIndex: Math.max(0, state.stepIndex - 1) };
}

export function skipTour(state) {
  if (state.status !== 'active') return state;
  return { ...state, status: 'skipped' };
}

/** Resume from a persisted step index (50801: "resumable anytime"). */
export function resumeTour(savedStepIndex) {
  const idx = Number.isFinite(savedStepIndex) ? savedStepIndex | 0 : 0;
  return startTour(createTourState(), idx);
}

export function tourProgress(state) {
  if (state.status !== 'active') return state.status === 'done' ? 1 : 0;
  return (state.stepIndex + 1) / COACH_MARK_STEPS.length;
}

/* ------------------------------------------------------------------ */
/* 50802–50804, 50810, 50814, 50817, 50820, 50821, 50825, 50829,      */
/* 50831, 50832 — first-time hint triggers                              */
/* ------------------------------------------------------------------ */

/**
 * Generic first-time gate: show a hint only if its flag was never seen and
 * global tips are enabled. `seen` is a Set-like of dismissed hint ids.
 */
export function shouldShowHint(hintId, seenIds, tipsEnabled = true) {
  if (!tipsEnabled) return false;
  if (!hintId || typeof hintId !== 'string') return false;
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
  return !seen.has(hintId);
}

/** 50803 — suggest the first search operator for an empty query. */
export function suggestFirstOperator(query) {
  if (query && String(query).trim().length > 0) return null;
  return { operator: 'sev:critical', label: 'Try sev:critical', hint: 'Operators filter findings fast — sev:, status:, tool: and more.' };
}

/** 50810 — teach combining severity + status. */
export function filterComboTip() {
  return {
    title: 'Combine filters to triage faster',
    body: 'Try sev:critical status:open — severity plus status narrows a noisy list to what matters.',
    example: 'sev:critical status:open',
  };
}

/** 50814 — three example questions for the mid-hunt chat. */
export function chatExampleQuestions() {
  return [
    'Why is this finding rated critical?',
    'What should I fix first?',
    'Show me the evidence for the top finding.',
  ];
}

/** 50817 — how deep links work from a finding card menu. */
export function deepLinkHowTo() {
  return {
    title: 'Share any finding with a deep link',
    body: 'Open a finding card menu → Copy link. Anyone with access lands on that exact finding, already expanded.',
  };
}

/** 50820 — explain automatic finding chaining on first sight. */
export function chainExplainer() {
  return {
    title: 'These two were linked automatically',
    body: 'The chain engine noticed shared evidence between these findings and grouped them — review the chain, not each card alone.',
  };
}

/** 50821 — teach the false-positive dismissal flow and its learning effect. */
export function fpDismissalGuide() {
  return {
    title: 'Dismissing as false positive',
    body: 'Mark it FP and tell us why — the agent learns from the reason and tunes similar findings next hunt.',
    steps: ['Open the finding', 'Choose "Dismiss as FP"', 'Add a one-line reason'],
  };
}

/** 50825 — explain what a low confidence score means. */
export function explainConfidence(score) {
  const s = Math.max(0, Math.min(1, Number(score) || 0));
  const band = s >= 0.8 ? 'high' : s >= 0.5 ? 'medium' : 'low';
  const advice = {
    high: 'High confidence — the evidence strongly supports this finding.',
    medium: 'Medium confidence — worth a look; evidence is partial.',
    low: 'Low confidence — treat as a lead, not a verdict. Verify the evidence before acting.',
  };
  return { score: s, band, advice: advice[band] };
}

/** 50829 — recovery path for empty filter results. */
export function zeroResultsRecovery() {
  return {
    title: 'No findings match',
    body: 'Your filters are hiding everything. Clear them to see the full list, then re-apply one at a time.',
    action: { label: 'Clear filters', kind: 'clear-filters' },
  };
}

/** 50831 — reports print cleanly. */
export function printHint() {
  return {
    title: 'Reports print cleanly',
    body: 'Open any report and press Ctrl+P (⌘P on Mac) — findings render as a paginated document.',
    shortcut: 'Ctrl+P',
  };
}

/** 50832 — timeline steps are clickable. */
export function timelineClickTip() {
  return {
    title: 'Click any timeline step',
    body: 'Every step expands to show exactly what the agent did — commands, output, and reasoning.',
  };
}

/* ------------------------------------------------------------------ */
/* 50805, 50819, 50839 — checklist progress / celebration / graduation */
/* ------------------------------------------------------------------ */

export const ONBOARDING_STEPS = [
  { id: 'target', label: 'Run your first hunt' },
  { id: 'finding', label: 'Open a finding' },
  { id: 'chat', label: 'Ask the agent a question' },
  { id: 'filter', label: 'Filter by severity' },
  { id: 'export', label: 'Export a report' },
  { id: 'shortcut', label: 'Try a keyboard shortcut' },
  { id: 'theme', label: 'Pick a theme' },
];

/** 50805 — "3 of 7 steps done" progress. */
export function checklistProgress(doneIds) {
  const done = new Set(doneIds || []);
  const total = ONBOARDING_STEPS.length;
  const doneCount = ONBOARDING_STEPS.filter((s) => done.has(s.id)).length;
  return {
    done: doneCount,
    total,
    percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
    label: `${doneCount} of ${total} steps done`,
    complete: doneCount === total,
  };
}

/** Mark one checklist step complete (pure — returns new id list). */
export function completeChecklistStep(doneIds, stepId) {
  const set = new Set(doneIds || []);
  if (ONBOARDING_STEPS.some((s) => s.id === stepId)) set.add(stepId);
  return [...set];
}

/** 50819 — celebration payload when the checklist completes. */
export function celebrationState(progress) {
  if (!progress || !progress.complete) return { celebrate: false };
  return {
    celebrate: true,
    title: "You're set!",
    body: 'Onboarding complete — the checklist is now archived under Tips.',
    animation: 'confetti-subtle',
  };
}

/** 50839 — graduate a finished checklist into the tips archive. */
export function graduateChecklist(doneIds, archivedTips) {
  const progress = checklistProgress(doneIds);
  if (!progress.complete) return { graduated: false, tips: archivedTips || [] };
  const entry = {
    id: `graduated-${Date.now()}`,
    title: 'Onboarding complete',
    body: `Finished ${progress.done}/${progress.total} onboarding steps.`,
    archivedAt: new Date().toISOString(),
  };
  return { graduated: true, tips: [...(archivedTips || []), entry] };
}

/* ------------------------------------------------------------------ */
/* 50806, 50826 — sample hunt + sandbox                                */
/* ------------------------------------------------------------------ */

/** 50806 — descriptor for a one-click realistic demo hunt (no quota spent). */
export function sampleHuntSpec() {
  return {
    id: 'sample-hunt',
    target: 'https://demo.infinite.ai/shop',
    label: 'Sample hunt (demo data)',
    status: 'complete',
    findings: 14,
    critical: 3,
    high: 5,
    durationSec: 187,
    quotaCost: 0,
    note: 'Pre-built demo — explore freely, nothing here spends quota.',
  };
}

/** 50826 — sandbox playground config: safe, quota-free. */
export function sandboxConfig() {
  return {
    enabled: true,
    quotaCost: 0,
    target: 'https://sandbox.infinite.ai',
    label: 'Onboarding sandbox',
    body: 'A safe playground hunt. Experiment freely — nothing here spends quota or touches real targets.',
    tools: ['nmap-lite', 'headers', 'robots', 'sitemap'],
  };
}

/* ------------------------------------------------------------------ */
/* 50807, 50835 — dismissible hints + synced state                     */
/* ------------------------------------------------------------------ */

/** 50807 — dismiss one hint; returns the new seen-id list. */
export function dismissHint(seenIds, hintId) {
  const set = new Set(seenIds || []);
  if (hintId) set.add(hintId);
  return [...set];
}

/** 50807 — global tips toggle. */
export function setTipsEnabled(prefs, enabled) {
  return { ...(prefs || {}), tipsEnabled: !!enabled };
}

/**
 * 50835 — merge local + remote hint state: a dismissed hint stays dismissed
 * everywhere (union wins), tipsEnabled resolves to false if either side
 * disabled it (explicit opt-out wins).
 */
export function mergeHintState(local, remote) {
  const seen = new Set([...(local?.seenIds || []), ...(remote?.seenIds || [])]);
  const tipsEnabled = (local?.tipsEnabled !== false) && (remote?.tipsEnabled !== false);
  const updatedAt = Math.max(local?.updatedAt || 0, remote?.updatedAt || 0);
  return { seenIds: [...seen], tipsEnabled, updatedAt };
}

/* ------------------------------------------------------------------ */
/* 50808 — first-export walkthrough                                    */
/* ------------------------------------------------------------------ */

/** 50808 — PDF vs Markdown choice walkthrough steps. */
export function exportWalkthroughSteps() {
  return [
    { id: 'choose', title: 'Pick a format', body: 'PDF is for sharing with stakeholders; Markdown is for tickets and docs.' },
    { id: 'pdf', title: 'PDF', body: 'Paginated, branded, print-ready — best for reports you send out.' },
    { id: 'md', title: 'Markdown', body: 'Plain text with PoC blocks — pastes cleanly into Jira, GitHub, Notion.' },
  ];
}

/* ------------------------------------------------------------------ */
/* 50809, 50824, 50827 — behavior-triggered nudges                     */
/* ------------------------------------------------------------------ */

/** 50809 — after 5 mouse-driven reviews, suggest the R shortcut. */
export function shouldNudgeShortcut(mouseReviewCount, seenIds) {
  if (!shouldShowHint('shortcut-nudge', seenIds)) return false;
  return (mouseReviewCount | 0) >= 5;
}

export function shortcutNudgeCopy() {
  return { title: 'Faster reviews', body: "You've reviewed 5 findings with the mouse — press R to review the next one from the keyboard.", shortcut: 'R' };
}

/** 50824 — after the 3rd manual run, suggest scheduling. */
export function shouldSuggestSchedule(manualRunCount, seenIds) {
  if (!shouldShowHint('schedule-hint', seenIds)) return false;
  return (manualRunCount | 0) >= 3;
}

/** 50827 — after the 2nd hunt, suggest inviting reviewers. */
export function shouldSuggestInvite(huntCount, seenIds) {
  if (!shouldShowHint('team-invite-hint', seenIds)) return false;
  return (huntCount | 0) >= 2;
}

/* ------------------------------------------------------------------ */
/* 50811 — welcome-back tour                                            */
/* ------------------------------------------------------------------ */

/** Whole days between two timestamps. */
export function daysBetween(earlierMs, laterMs) {
  const ms = (laterMs || Date.now()) - (earlierMs || 0);
  return Math.floor(ms / 86400000);
}

/** 50811 — show the "what's new" tour after 14 idle days. */
export function shouldShowWelcomeBack(lastSeenMs, nowMs) {
  if (!lastSeenMs) return false;
  return daysBetween(lastSeenMs, nowMs) >= 14;
}

export function welcomeBackCopy(idleDays, changeCount) {
  return {
    title: "Here's what's new",
    body: `You were away ${idleDays} days — ${changeCount} ${changeCount === 1 ? 'change' : 'changes'} since your last visit. Quick tour?`,
  };
}

/* ------------------------------------------------------------------ */
/* 50812 — role-based onboarding                                        */
/* ------------------------------------------------------------------ */

/** 50812 — researcher vs executive first tasks. */
export function roleOnboardingPath(role) {
  const paths = {
    researcher: {
      role: 'researcher',
      headline: 'Built for deep dives',
      firstTasks: ['Run a hunt on a staging target', 'Triage with sev:critical', 'Export PoCs as Markdown'],
    },
    executive: {
      role: 'executive',
      headline: 'Built for the big picture',
      firstTasks: ['Open the dashboard', 'Review the risk summary', 'Schedule a weekly hunt'],
    },
  };
  return paths[role] || paths.researcher;
}

/* ------------------------------------------------------------------ */
/* 50813 — models-page hint                                             */
/* ------------------------------------------------------------------ */

/** 50813 — brain slots need models before AI hunts fully work. */
export function modelsPageHint() {
  return {
    title: 'Plug in a model to unlock full AI',
    body: 'Each brain slot needs a model before hunts use AI fully — add one on the Models page.',
    action: { label: 'Open Models', kind: 'open-models' },
  };
}

/* ------------------------------------------------------------------ */
/* 50815 — widget tour                                                  */
/* ------------------------------------------------------------------ */

/** 50815 — dashboard widget tour steps. */
export function widgetTourSteps() {
  return [
    { id: 'drag', title: 'Drag to rearrange', body: 'Grab any widget header to move it around the grid.' },
    { id: 'expand', title: 'Click to expand', body: 'Click a widget to open its full view.' },
    { id: 'gallery', title: 'Add more', body: 'The gallery has 20+ widgets — charts, queues, tickers.' },
  ];
}

/* ------------------------------------------------------------------ */
/* 50816 — weak-target hint                                             */
/* ------------------------------------------------------------------ */

const WEAK_TARGET_PATTERNS = [
  { re: /^https?:\/\/[^/]+\/?$/, label: 'bare domain', suggestion: 'Try a path with real surface, e.g. /login, /api, /search.' },
  { re: /example\.com|test\.com|localhost/i, label: 'placeholder host', suggestion: 'That looks like a placeholder — paste the real target.' },
];

/** 50816 — pasting a low-surface URL suggests stronger alternatives. */
export function weakTargetCheck(url) {
  const u = String(url || '').trim();
  if (!u) return { weak: false };
  for (const p of WEAK_TARGET_PATTERNS) {
    if (p.re.test(u)) return { weak: true, reason: p.label, suggestion: p.suggestion };
  }
  return { weak: false };
}

/* ------------------------------------------------------------------ */
/* 50818 — opt-in drip emails                                           */
/* ------------------------------------------------------------------ */

/** 50818 — three onboarding emails over the first week (opt-in only). */
export function dripEmailSchedule(optedIn, signupMs) {
  if (!optedIn) return [];
  const day = 86400000;
  const base = signupMs || Date.now();
  return [
    { day: 0, sendAt: base, subject: 'Welcome — run your first hunt in 2 minutes' },
    { day: 3, sendAt: base + 3 * day, subject: '3 triage tricks power users love' },
    { day: 7, sendAt: base + 7 * day, subject: 'Your first week: schedule hunts on autopilot' },
  ];
}

/* ------------------------------------------------------------------ */
/* 50822 — embedded video snippets                                      */
/* ------------------------------------------------------------------ */

/** 50822 — 30-second video snippet descriptor for complex flows. */
export function videoSnippetSpec(flowId) {
  const library = {
    'chain-review': { src: '/videos/chain-review-30s.mp4', caption: 'Reviewing chained findings (0:30)' },
    'export': { src: '/videos/export-30s.mp4', caption: 'Exporting reports (0:30)' },
    'triage': { src: '/videos/triage-30s.mp4', caption: 'Triage with filters (0:30)' },
  };
  return library[flowId] || { src: `/videos/${flowId}-30s.mp4`, caption: `${flowId} walkthrough (0:30)` };
}

/* ------------------------------------------------------------------ */
/* 50823, 50833 — tip of the day + rotating help tips                  */
/* ------------------------------------------------------------------ */

export const POWER_TIPS = [
  'Press R to review the next finding without touching the mouse.',
  'sev:critical status:open is the fastest triage query we know.',
  'Shift+? opens the full keyboard shortcut cheat sheet.',
  'Every finding card menu has a deep link — share the exact finding.',
  'Ctrl+. cycles themes — Dim is great for late-night triage.',
  'Click any timeline step to see exactly what the agent did.',
];

/** Simple deterministic string hash (FNV-1a). */
export function hashString(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 50823 — one deterministic power-user tip per calendar day. */
export function tipOfTheDay(dateStr, tips = POWER_TIPS) {
  if (!tips.length) return null;
  const idx = hashString(`tip-${dateStr}`) % tips.length;
  return { tip: tips[idx], date: dateStr, index: idx };
}

/** 50833 — one "did you know" per help-panel visit, rotating. */
export function rotatingHelpTip(visitCount, tips = POWER_TIPS) {
  if (!tips.length) return null;
  const idx = (Math.max(0, visitCount | 0)) % tips.length;
  return { tip: tips[idx], visit: visitCount | 0 };
}

/* ------------------------------------------------------------------ */
/* 50828, 50830, 50834, 50836, 50837, 50838 — misc hint copy           */
/* ------------------------------------------------------------------ */

/** 50828 — mobile voice-command hint (only meaningful on mobile). */
export function voiceCommandHint(isMobile) {
  if (!isMobile) return null;
  return { title: 'Try voice', body: "Tap the mic and say 'start a hunt' — hands-free recon." };
}

/** 50830 — keyboard shortcut onboarding. */
export function a11yShortcutHint() {
  return { title: 'Keyboard first', body: 'Press Shift+? anytime for the full keyboard shortcut list.', shortcut: 'Shift+?' };
}

/** 50834 — after first export, suggest Slack automation. */
export function slackIntegrationHint() {
  return {
    title: 'Send reports to Slack automatically',
    body: 'Connect Slack once — every exported report can post to your channel without the manual download.',
    action: { label: 'Connect Slack', kind: 'open-integrations' },
  };
}

/** 50836 — first paywall explains the tier with a trial CTA. */
export function paywallExplainer(tierName) {
  return {
    title: `What ${tierName} unlocks`,
    body: `${tierName} adds unlimited hunts, all AI brains, and team workspaces. Start a 14-day trial — no card required.`,
    cta: { label: 'Start free trial', kind: 'start-trial' },
  };
}

/** 50837 — post-hunt rating invite. */
export function postHuntRatingPrompt(huntLabel) {
  return {
    title: 'How was this hunt?',
    body: `Rate "${huntLabel}" — your rating improves the agent for everyone.`,
    scale: 5,
  };
}

/** 50838 — dark-mode hint. */
export function darkModeHint() {
  return {
    title: 'Easier on the eyes',
    body: 'Switch themes with Ctrl+. — Dim and Dark are made for late-night triage.',
    shortcut: 'Ctrl+.',
  };
}

/* ------------------------------------------------------------------ */
/* 50840 — Copy-PoC button                                               */
/* ------------------------------------------------------------------ */

/** 50840 — formatted markdown PoC block for one-click copy. */
export function pocMarkdown(finding) {
  const f = finding || {};
  const lines = [
    `## ${f.title || 'Untitled finding'} — ${String(f.severity || 'unknown').toUpperCase()}`,
    '',
    `- **Target:** ${f.target || 'n/a'}`,
    `- **Severity:** ${f.severity || 'n/a'} (confidence ${Math.round((Number(f.confidence) || 0) * 100)}%)`,
    `- **Hunt:** ${f.huntId || 'n/a'}`,
    '',
    '### PoC',
    '```',
    String(f.poc || f.evidence || 'No PoC captured.'),
    '```',
    '',
    '### Remediation',
    String(f.remediation || 'See report for remediation guidance.'),
  ];
  return lines.join('\n');
}
