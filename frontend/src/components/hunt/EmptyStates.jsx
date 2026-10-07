/**
 * EmptyStates.jsx — Forge wave 8, ideas 50290–50320.
 *
 * Every product surface gets a purposeful empty state instead of a blank
 * panel: a shared <EmptyState> shell plus 31 named states, one per idea.
 * Each state carries a real CTA that wires into the parent via callbacks —
 * no dead buttons.
 *
 * Idea map: 50290 first-run hero · 50291 hunt in-progress reassurance ·
 * 50292 clean-target celebration · 50293 filtered-to-zero · 50294 empty hunt
 * history · 50295 empty chat prompts · 50296 empty report list ·
 * 50297 empty saved searches · 50298 all-caught-up notifications ·
 * 50299 empty integrations · 50300 empty shared hunts · 50301 empty insights
 * feed · 50302 empty evidence explainer · 50303 empty chain view ·
 * 50304 empty compare view · 50305 empty audit log · 50306 empty scheduled
 * hunts · 50307 empty tags hint · 50308 empty comments prompt ·
 * 50309 empty watchlist · 50310 empty export history · 50311 empty shortcut
 * customization · 50312 empty dashboard · 50313 empty search history ·
 * 50314 empty trash · 50315 inbox-zero review queue · 50316 empty retest
 * queue · 50317 empty model library · 50318 empty scope state ·
 * 50319 queued-hunt timeline · 50320 empty invoices.
 *
 * Wave 9 (50321–50340) added 20 more: 50321 empty ideas list · 50322 empty
 * playbook library · 50323 empty webhook deliveries · 50324 empty profile
 * activity · 50325 empty shared-with-me · 50326 empty report templates ·
 * 50327 empty payload lists · 50328 empty paused hunts ·
 * 50329 empty mention results · 50330 empty compliance checklist ·
 * 50331 positive no-breach state · 50332 empty agent memory ·
 * 50333 empty attachments hint · 50334 empty voice history ·
 * 50335 empty avatar customization · 50336 empty scheduled reports ·
 * 50337 empty target notes · 50338 empty macro list ·
 * 50339 friendly hunt 404 · 50340 target-unreachable card.
 */

import { useState } from 'react';
import './EmptyStates.css';
import './EmptyStates.polish.css';

/* Small inline SVG marks — crisp at every size, no emoji dependency. ---- */

function PlugIcon() {
  return (
    <svg className="es-svg-art" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3v5M15 3v5" />
      <path d="M7 8h10v3.5a5 5 0 0 1-10 0V8z" />
      <path d="M12 16.5V21" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg className="es-svg-art" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.8 19.5c.7-3.2 3-5 6.2-5s5.5 1.8 6.2 5" />
      <circle cx="17" cy="9" r="2.7" />
      <path d="M15.6 14.9c2.9.3 4.9 1.9 5.6 4.6" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg className="es-svg-art" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4.6c-1.9 0-3.3.8-4.2 2C6.1 7 4.9 8.4 4.9 10c0 1 .5 1.9 1.2 2.5A3.6 3.6 0 0 0 5.6 15c0 1.5 1 2.7 2.4 3.1.4 1.4 1.6 2.4 3.1 2.4.4 0 .7 0 1-.1" />
      <path d="M12 4.6c1.9 0 3.3.8 4.2 2 1.7.4 2.9 1.8 2.9 3.4 0 1-.5 1.9-1.2 2.5.3.8.5 1.6.5 2.5 0 1.5-1 2.7-2.4 3.1-.4 1.4-1.6 2.4-3.1 2.4-.4 0-.7 0-1-.1" />
      <path d="M12 4.6v15.8" />
    </svg>
  );
}

/* Shared shell ---------------------------------------------------- */

export function EmptyState({
  illustration,
  title,
  description,
  primary,
  secondary,
  hint,
  tone = 'neutral',
  compact = false,
  children,
}) {
  return (
    <section
      className={`es ${compact ? 'es-compact' : ''} es-tone-${tone}`}
      role="status"
      aria-label={title}
    >
      {illustration && (
        <div className="es-illustration" aria-hidden="true">{illustration}</div>
      )}
      <h3 className="es-title">{title}</h3>
      {description && <p className="es-desc">{description}</p>}
      {(primary || secondary) && (
        <div className="es-actions">
          {primary && (
            <button type="button" className="es-btn es-primary" onClick={primary.onClick}>
              {primary.label}
            </button>
          )}
          {secondary && (
            <button type="button" className="es-btn es-secondary" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          )}
        </div>
      )}
      {hint && <p className="es-hint">{hint}</p>}
      {children}
    </section>
  );
}

/* 50290 — first-run hero ------------------------------------------- */

export function FirstRunHero({ onPasteLink, onWatchDemo }) {
  return (
    <EmptyState
      tone="hero"
      illustration={<span className="es-hero-art">◈</span>}
      title="Hunt your first target"
      description="Paste any website link below. Infinity AI will recon it, find bugs, prove them with PoCs, and write the report — all autonomous."
      primary={onPasteLink && { label: 'Paste your first link', onClick: onPasteLink }}
      secondary={onWatchDemo && { label: 'Watch a 30-sec explainer', onClick: onWatchDemo }}
      hint="Your first hunt is free — no card required."
    />
  );
}

/* 50291 — no-findings-yet reassurance during active hunts ----------- */

export function HuntInProgressEmpty({ checksDone = 0, phase = 'recon' }) {
  return (
    <EmptyState
      compact
      illustration={<span className="es-pulse" />}
      title="Still testing…"
      description={`The hunt is in the ${phase} phase. No findings yet — that's normal.`}
      hint={checksDone > 0 ? `${checksDone} checks completed so far.` : 'Warming up the engines.'}
    />
  );
}

/* 50292 — clean-target celebration ---------------------------------- */

export function CleanTargetCelebration({ target, scopeSummary, onViewReport, onRetest }) {
  return (
    <EmptyState
      tone="success"
      illustration={<span className="es-hero-art es-clean">✓</span>}
      title="Clean target"
      description={`${target ?? 'This target'} passed the full hunt with zero confirmed findings.`}
      primary={onViewReport && { label: 'View report', onClick: onViewReport }}
      secondary={onRetest && { label: 'Schedule a retest', onClick: onRetest }}
      hint={scopeSummary ?? 'Scope: full attack surface, all phases.'}
    />
  );
}

/* 50293 — filtered-to-zero guidance -------------------------------- */

export function FilteredToZero({ activeFilters = [], onClearFilters }) {
  return (
    <EmptyState
      compact
      title="No findings match these filters"
      description={
        activeFilters.length
          ? `Active: ${activeFilters.join(', ')}. Loosen a filter to see more.`
          : 'Nothing matches the current filters.'
      }
      primary={onClearFilters && { label: 'Clear all filters', onClick: onClearFilters }}
    />
  );
}

/* 50294 — empty hunt history ---------------------------------------- */

export function EmptyHuntHistory({ onStartHunt, onLoadDemoHunt }) {
  return (
    <EmptyState
      illustration={<span className="es-hero-art">◎</span>}
      title="No hunts yet"
      description="Your hunt history will live here. Start one now — or explore a sample demo hunt to see what a finished report looks like."
      primary={onStartHunt && { label: 'Start your first hunt', onClick: onStartHunt }}
      secondary={onLoadDemoHunt && { label: 'Load a demo hunt', onClick: onLoadDemoHunt }}
    />
  );
}

/* 50295 — empty chat prompts ---------------------------------------- */

export function EmptyChatPrompts({ suggestions = [], onAsk }) {
  const defaults = [
    'What are you checking right now?',
    'How many checks are done?',
    'Any critical findings so far?',
  ];
  return (
    <EmptyState
      compact
      title="Ask the agent anything"
      description="The hunt is running — tap a question to ask mid-hunt."
      hint="Custom questions welcome too."
    >
      <div className="es-chips">
        {(suggestions.length ? suggestions : defaults).map((q) => (
          <button key={q} type="button" className="es-chip" onClick={() => onAsk && onAsk(q)}>
            {q}
          </button>
        ))}
      </div>
    </EmptyState>
  );
}

/* 50296 — empty report list ----------------------------------------- */

export function EmptyReportList({ onGenerateFromLatest, latestHuntName }) {
  return (
    <EmptyState
      illustration={<span className="es-hero-art">▤</span>}
      title="No reports yet"
      description="Reports appear here after a hunt completes — markdown, PDF, and bounty-ready formats."
      primary={onGenerateFromLatest && {
        label: latestHuntName ? `Generate from ${latestHuntName}` : 'Generate from latest hunt',
        onClick: onGenerateFromLatest,
      }}
    />
  );
}

/* 50297 — empty saved searches -------------------------------------- */

export function EmptySavedSearches({ onHowToSave }) {
  return (
    <EmptyState
      compact
      title="No saved searches yet"
      description="Run any search, then press the bookmark icon to save it here with optional pinned widgets and digest alerts."
      primary={onHowToSave && { label: 'How saving works', onClick: onHowToSave }}
    />
  );
}

/* 50298 — all-caught-up notifications ------------------------------- */

export function AllCaughtUpNotifications() {
  return (
    <EmptyState
      compact
      tone="success"
      illustration={<span className="es-hero-art es-clean">✓</span>}
      title="You're all caught up"
      description="No new notifications. New findings, mentions, and hunt completions will appear here."
    />
  );
}

/* 50299 — empty integrations list ----------------------------------- */

export function EmptyIntegrations({ providers = [], onConnect }) {
  return (
    <EmptyState
      illustration={<span className="es-hero-art"><PlugIcon /></span>}
      title="No integrations connected"
      description="Connect API keys to unlock webhooks, SIEM export, Slack alerts, and Jira sync."
      hint="Keys are stored encrypted and never leave your vault."
    >
      <div className="es-chips">
        {(providers.length ? providers : ['Slack', 'Jira', 'Webhook', 'SIEM']).map((p) => (
          <button key={p} type="button" className="es-chip" onClick={() => onConnect && onConnect(p)}>
            Connect {p}
          </button>
        ))}
      </div>
    </EmptyState>
  );
}

/* 50300 — empty shared hunts ---------------------------------------- */

export function EmptySharedHunts({ inviteLink, onCopyInvite, onInvite }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (inviteLink && navigator.clipboard) {
      try { await navigator.clipboard.writeText(inviteLink); setCopied(true); } catch { /* clipboard blocked */ }
    }
    onCopyInvite && onCopyInvite();
  };
  return (
    <EmptyState
      illustration={<span className="es-hero-art"><TeamIcon /></span>}
      title="No shared hunts"
      description="Invite your team to review findings, triage, and comment together."
      primary={onInvite && { label: 'Invite a teammate', onClick: onInvite }}
      secondary={inviteLink && { label: copied ? 'Copied!' : 'Copy invite link', onClick: copy }}
      hint={inviteLink}
    />
  );
}

/* 50301 — empty insights feed --------------------------------------- */

export function EmptyInsightsFeed({ huntsCompleted = 0, huntsNeeded = 3 }) {
  return (
    <EmptyState
      compact
      title="Insights appear after a few hunts"
      description="The learning engine distills patterns from your hunts — common misconfigs, repeat vulns, fix-rate trends."
      hint={huntsCompleted >= huntsNeeded
        ? 'Run one more hunt to refresh insights.'
        : `${huntsCompleted} of ${huntsNeeded} hunts done — insights unlock at ${huntsNeeded}.`}
    />
  );
}

/* 50302 — empty evidence explainer ----------------------------------- */

export function EmptyEvidenceExplainer() {
  return (
    <EmptyState
      compact
      title="No screenshots for this finding"
      description="The agent captured request/response evidence only — some findings (headers, logic flaws) don't produce visual proof."
      hint="Request raw traffic from the evidence tab."
    />
  );
}

/* 50303 — empty chain view ------------------------------------------- */

export function EmptyChainView({ onViewChains }) {
  return (
    <EmptyState
      compact
      title="No chained findings yet"
      description="Chains appear when findings link up — e.g. XSS + stolen session → account takeover."
      primary={onViewChains && { label: 'How chaining works', onClick: onViewChains }}
    />
  );
}

/* 50304 — empty compare view ----------------------------------------- */

export function EmptyCompareView({ hunts = [], onCompare }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  return (
    <EmptyState
      title="Compare two hunts"
      description="Pick two hunts to diff findings, coverage, and risk over time."
      hint="Deltas highlight new, fixed, and regressed findings."
    >
      <div className="es-compare">
        <select aria-label="First hunt" value={a} onChange={(e) => setA(e.target.value)}>
          <option value="">Select hunt A…</option>
          {hunts.map((h) => <option key={h.id} value={h.id}>{h.name ?? h.id}</option>)}
        </select>
        <select aria-label="Second hunt" value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">Select hunt B…</option>
          {hunts.map((h) => <option key={h.id} value={h.id}>{h.name ?? h.id}</option>)}
        </select>
        <button
          type="button"
          className="es-btn es-primary"
          disabled={!a || !b || a === b}
          onClick={() => onCompare && onCompare(a, b)}
        >
          Compare
        </button>
      </div>
    </EmptyState>
  );
}

/* 50305 — empty audit log -------------------------------------------- */

export function EmptyAuditLog({ retentionDays = 90 }) {
  return (
    <EmptyState
      compact
      title="No audit events yet"
      description={`Every sensitive action — logins, exports, config changes — is recorded here and kept for ${retentionDays} days.`}
      hint="Retention policy: security events are immutable."
    />
  );
}

/* 50306 — empty scheduled hunts -------------------------------------- */

export function EmptyScheduledHunts({ onSchedule }) {
  return (
    <EmptyState
      illustration={<span className="es-hero-art">◷</span>}
      title="No scheduled hunts"
      description="Set a target on autopilot: nightly, weekly, or after every deploy."
      primary={onSchedule && { label: 'Schedule a recurring hunt', onClick: onSchedule }}
    />
  );
}

/* 50307 — empty tags hint -------------------------------------------- */

export function EmptyTagsHint({ onBrowseFindings }) {
  return (
    <EmptyState
      compact
      title="No tags yet"
      description="Tags help you organize findings — add one from any finding card to start building your taxonomy."
      primary={onBrowseFindings && { label: 'Browse findings', onClick: onBrowseFindings }}
    />
  );
}

/* 50308 — empty comments prompt -------------------------------------- */

export function EmptyCommentsPrompt({ onComment }) {
  return (
    <EmptyState
      compact
      title="No comments yet"
      description="Start the discussion — triage notes, fix verification, or questions for the team."
      primary={onComment && { label: 'Add the first comment', onClick: onComment }}
    />
  );
}

/* 50309 — empty watchlist --------------------------------------------- */

export function EmptyWatchlist({ onBrowseTargets }) {
  return (
    <EmptyState
      compact
      title="Your watchlist is empty"
      description="Watch targets to get notified the moment new findings appear on them."
      primary={onBrowseTargets && { label: 'Browse targets', onClick: onBrowseTargets }}
    />
  );
}

/* 50310 — empty export history ---------------------------------------- */

export function EmptyExportHistory({ formats = ['PDF', 'Markdown', 'CSV', 'SARIF'] }) {
  return (
    <EmptyState
      compact
      title="No exports yet"
      description={`Past exports are listed here with their format and download links. Available formats: ${formats.join(', ')}.`}
    />
  );
}

/* 50311 — empty shortcut customization -------------------------------- */

export function EmptyShortcutCustomization({ onEdit }) {
  return (
    <EmptyState
      compact
      title="Using default shortcuts"
      description="You're on the defaults ( / search, ? help, Esc close). Customize any binding."
      primary={onEdit && { label: 'Customize shortcuts', onClick: onEdit }}
    />
  );
}

/* 50312 — empty dashboard --------------------------------------------- */

export function EmptyDashboard({ onOpenGallery }) {
  return (
    <EmptyState
      illustration={<span className="es-hero-art">▦</span>}
      title="Your dashboard is blank"
      description="You removed every widget. Add some back from the gallery — risk overview, hunt activity, fix-rate trends."
      primary={onOpenGallery && { label: 'Open widget gallery', onClick: onOpenGallery }}
    />
  );
}

/* 50313 — empty search history ---------------------------------------- */

export function EmptySearchHistory({ onOpenSearch }) {
  return (
    <EmptyState
      compact
      title="No recent searches"
      description="Your recent searches will appear here for one-click reruns."
      primary={onOpenSearch && { label: 'Run a search', onClick: onOpenSearch }}
    />
  );
}

/* 50314 — empty trash -------------------------------------------------- */

export function EmptyTrash({ retentionDays = 30 }) {
  return (
    <EmptyState
      compact
      title="Trash is empty"
      description={`Deleted items stay here for ${retentionDays} days with a one-click restore before they're gone for good.`}
    />
  );
}

/* 50315 — inbox-zero review queue -------------------------------------- */

export function InboxZeroReviewQueue({ onViewAll }) {
  return (
    <EmptyState
      compact
      tone="success"
      illustration={<span className="es-hero-art es-clean">✓</span>}
      title="Inbox zero — nothing needs review"
      description="Every finding has been triaged. New untriaged findings will land here automatically."
      primary={onViewAll && { label: 'View all findings', onClick: onViewAll }}
    />
  );
}

/* 50316 — empty retest queue -------------------------------------------- */

export function EmptyRetestQueue({ onViewFixed }) {
  return (
    <EmptyState
      compact
      title="Nothing queued for retest"
      description="Findings marked fixed will queue here for the agent to verify the patch actually worked."
      primary={onViewFixed && { label: 'View fixed findings', onClick: onViewFixed }}
    />
  );
}

/* 50317 — empty model library ------------------------------------------- */

export function EmptyModelLibrary({ slots = [], onDownload }) {
  const list = slots.length ? slots : ['Hacking brain', 'Vision brain', 'Grounding brain'];
  return (
    <EmptyState
      illustration={<span className="es-hero-art"><BrainIcon /></span>}
      title="No brains downloaded"
      description="Download a local model for each slot — the agent thinks with these when offline."
    >
      <div className="es-chips">
        {list.map((s) => (
          <button key={s} type="button" className="es-chip" onClick={() => onDownload && onDownload(s)}>
            Download {s}
          </button>
        ))}
      </div>
    </EmptyState>
  );
}

/* 50318 — empty scope state ---------------------------------------------- */

export function EmptyScopeState({ phase = 'recon' }) {
  return (
    <EmptyState
      compact
      illustration={<span className="es-pulse" />}
      title="Mapping in progress"
      description={`The hunt is still in the ${phase} phase — the asset tree fills in as subdomains, endpoints, and tech are discovered.`}
    />
  );
}

/* 50319 — queued-hunt empty timeline -------------------------------------- */

export function QueuedHuntTimeline({ position = 1, etaMinutes = 2 }) {
  return (
    <EmptyState
      compact
      illustration={<span className="es-pulse" />}
      title="Hunt queued"
      description={`Your hunt starts in ~${etaMinutes} min. You're #${position} in the queue.`}
      hint="The timeline will populate with events as the hunt runs."
    />
  );
}

/* 50320 — empty invoices --------------------------------------------------- */

export function EmptyInvoices({ tier = 'Free', onUpgrade }) {
  return (
    <EmptyState
      compact
      title="No invoices yet"
      description={`You're on the ${tier} tier. Billing history and receipts will appear here when you upgrade.`}
      primary={onUpgrade && { label: 'See plans', onClick: onUpgrade }}
      hint="Free tier includes monthly hunts — no card required."
    />
  );
}

/* ---- Wave 9 (50321–50340) — empty-states round 2 -------------------------- */

/* 50321 — empty ideas list ------------------------------------------------- */

export function EmptyIdeasList({ onSuggest }) {
  return (
    <EmptyState
      compact
      title="No feature ideas yet"
      description="Nobody has submitted a feature idea. The roadmap grows from your suggestions."
      primary={onSuggest && { label: 'Suggest a feature', onClick: onSuggest }}
    />
  );
}

/* 50322 — empty playbook library ------------------------------------------- */

export function EmptyPlaybooks({ onBrowseStarters }) {
  return (
    <EmptyState
      compact
      title="No playbooks yet"
      description="Clone a starter template to run your first reusable hunt workflow — no setup required."
      primary={onBrowseStarters && { label: 'Browse starter templates', onClick: onBrowseStarters }}
      hint="Starters cover recon, API auth, and injection workflows."
    />
  );
}

/* 50323 — empty webhook deliveries ----------------------------------------- */

export function EmptyWebhookDeliveries({ onSendTest }) {
  return (
    <EmptyState
      compact
      title="No webhook deliveries yet"
      description="Send a test event to verify your endpoint receives and acknowledges payloads."
      primary={onSendTest && { label: 'Send a test event', onClick: onSendTest }}
    />
  );
}

/* 50324 — empty profile activity ------------------------------------------- */

export function EmptyProfileActivity() {
  return (
    <EmptyState
      compact
      title="Your hunt stats will appear here"
      description="Run your first hunt and this profile fills with hunts, findings, and severity breakdowns."
      hint="Stats update automatically after each completed hunt."
    />
  );
}

/* 50325 — empty shared-with-me --------------------------------------------- */

export function EmptySharedWithMe() {
  return (
    <EmptyState
      compact
      title="Nothing shared with you yet"
      description="When a teammate shares a hunt, it appears here with the same findings, timeline, and reports they see."
      hint="Sharing never copies data — it grants view access to the original hunt."
    />
  );
}

/* 50326 — empty report templates ------------------------------------------- */

export function EmptyReportTemplates({ onUseDefault }) {
  return (
    <EmptyState
      compact
      title="No custom templates"
      description="You haven't saved any report templates. The default Infinity AI template produces a full professional report."
      primary={onUseDefault && { label: 'Use the default template', onClick: onUseDefault }}
    />
  );
}

/* 50327 — empty payload lists ---------------------------------------------- */

export function EmptyPayloadLists({ onImportFile, onBrowseBuiltins }) {
  return (
    <EmptyState
      compact
      title="No custom payload lists"
      description="Import a payload list from a file (one payload per line) or start from the built-in sets."
      primary={onImportFile && { label: 'Import from file', onClick: onImportFile }}
      secondary={onBrowseBuiltins && { label: 'Browse built-ins', onClick: onBrowseBuiltins }}
    />
  );
}

/* 50328 — empty paused hunts ----------------------------------------------- */

export function EmptyPausedHunts({ onViewRunning }) {
  return (
    <EmptyState
      compact
      title="No paused hunts"
      description="Paused hunts wait here with their checkpoints intact — resume exactly where you left off."
      secondary={onViewRunning && { label: 'View running hunts', onClick: onViewRunning }}
    />
  );
}

/* 50329 — empty mention results -------------------------------------------- */

export function EmptyMentionResults({ target }) {
  return (
    <EmptyState
      compact
      tone="success"
      title="No mentions found"
      description={target
        ? `No dark-web mentions of ${target} right now — we'll keep watching.`
        : 'No dark-web mentions right now — we\'ll keep watching.'}
      hint="Monitoring runs continuously; new mentions surface as notifications."
    />
  );
}

/* 50330 — empty compliance checklist --------------------------------------- */

export function EmptyComplianceChecklist({ onRunScan }) {
  return (
    <EmptyState
      compact
      title="Checklist is empty"
      description="Run a compliance scan to populate the checklist with framework requirements and pass/fail evidence."
      primary={onRunScan && { label: 'Run a compliance scan', onClick: onRunScan }}
    />
  );
}

/* 50331 — positive no-breach state ----------------------------------------- */

export function PositiveNoBreachState({ policyName }) {
  return (
    <EmptyState
      compact
      tone="success"
      title="No SLA breaches"
      description={policyName
        ? `All targets are within the "${policyName}" policy. Nothing is overdue or at risk.`
        : 'All targets are within policy. Nothing is overdue or at risk.'}
      hint="The breach list fills automatically the moment a deadline slips."
    />
  );
}

/* 50332 — empty agent memory ----------------------------------------------- */

export function EmptyAgentMemory() {
  return (
    <EmptyState
      compact
      title="Memory builds as hunts run"
      description="The agent remembers what worked: tech fingerprints, effective checks, and verified findings."
      hint="Sample: example.com → tech: nginx+react → 3 findings confirmed by retest."
    />
  );
}

/* 50333 — empty attachments hint ------------------------------------------- */

export function EmptyAttachmentsHint({ onAttach }) {
  return (
    <EmptyState
      compact
      title="No files attached"
      description="Drag files here, or attach them — screenshots, HAR files, and notes all help the agent hunt smarter."
      primary={onAttach && { label: 'Attach files', onClick: onAttach }}
    />
  );
}

/* 50334 — empty voice history ---------------------------------------------- */

export function EmptyVoiceHistory() {
  return (
    <EmptyState
      compact
      title="Your voice commands will appear here"
      description="Every command you speak to Infinity AI lands here as a transcript you can replay or rerun."
    />
  );
}

/* 50335 — empty avatar customization ---------------------------------------- */

export function EmptyAvatarCustomization({ onCustomize }) {
  return (
    <EmptyState
      compact
      title="Meet your default avatar"
      description="This is the standard Infinity AI avatar. Make it yours — pick a voice, style, and personality."
      primary={onCustomize && { label: 'Make it yours', onClick: onCustomize }}
    />
  );
}

/* 50336 — empty scheduled reports ------------------------------------------ */

export function EmptyScheduledReports({ onPickPreset, presets = ['Weekly', 'Monthly'] }) {
  return (
    <EmptyState
      compact
      title="No scheduled reports"
      description="Pick a cadence and Infinity AI emails you a findings digest on schedule — set it once, forget it."
      primary={onPickPreset && { label: `Schedule ${presets[0]} reports`, onClick: () => onPickPreset(presets[0]) }}
      secondary={presets[1] && onPickPreset && { label: `Schedule ${presets[1]} reports`, onClick: () => onPickPreset(presets[1]) }}
    />
  );
}

/* 50337 — empty target notes ----------------------------------------------- */

export function EmptyTargetNotes({ onAddNote }) {
  return (
    <EmptyState
      compact
      title="No notes for this target"
      description="Jot context the agent should know — credentials format, known quirks, out-of-scope paths. It reads these before hunting."
      primary={onAddNote && { label: 'Add a note', onClick: onAddNote }}
    />
  );
}

/* 50338 — empty macro list -------------------------------------------------- */

export function EmptyMacros({ onRecord }) {
  return (
    <EmptyState
      compact
      title="No keyboard macros"
      description="Record a macro to replay a sequence of actions with one keystroke — triage flows, filter presets, anything."
      primary={onRecord && { label: 'Record your first macro', onClick: onRecord }}
    />
  );
}

/* 50339 — friendly hunt 404 ------------------------------------------------- */

export function FriendlyHunt404({ huntId, onGoHome, onStartHunt }) {
  return (
    <EmptyState
      compact
      title="This hunt doesn't exist"
      description={huntId
        ? `Hunt "${huntId}" doesn't exist — or it was deleted. Check the ID, or start fresh.`
        : "This hunt doesn't exist — or it was deleted."}
      primary={onGoHome && { label: 'Back to hunts', onClick: onGoHome }}
      secondary={onStartHunt && { label: 'Start a new hunt', onClick: onStartHunt }}
    />
  );
}

/* 50340 — target-unreachable card ------------------------------------------- */

export function TargetUnreachableCard({ target, diagnosis, onRetry, onEditTarget }) {
  return (
    <EmptyState
      compact
      tone="hero"
      title={`${target || 'Target'} is unreachable`}
      description={diagnosis || 'DNS resolution and the TCP connection both failed. The host may be down, the domain may be wrong, or a firewall is blocking us.'}
      primary={onRetry && { label: 'Retry', onClick: onRetry }}
      secondary={onEditTarget && { label: 'Edit target', onClick: onEditTarget }}
    />
  );
}

/* Registry for honesty checks ----------------------------------------- */

export const EMPTY_STATE_IDEAS = [
  { idea: 50290, name: 'FirstRunHero' },
  { idea: 50291, name: 'HuntInProgressEmpty' },
  { idea: 50292, name: 'CleanTargetCelebration' },
  { idea: 50293, name: 'FilteredToZero' },
  { idea: 50294, name: 'EmptyHuntHistory' },
  { idea: 50295, name: 'EmptyChatPrompts' },
  { idea: 50296, name: 'EmptyReportList' },
  { idea: 50297, name: 'EmptySavedSearches' },
  { idea: 50298, name: 'AllCaughtUpNotifications' },
  { idea: 50299, name: 'EmptyIntegrations' },
  { idea: 50300, name: 'EmptySharedHunts' },
  { idea: 50301, name: 'EmptyInsightsFeed' },
  { idea: 50302, name: 'EmptyEvidenceExplainer' },
  { idea: 50303, name: 'EmptyChainView' },
  { idea: 50304, name: 'EmptyCompareView' },
  { idea: 50305, name: 'EmptyAuditLog' },
  { idea: 50306, name: 'EmptyScheduledHunts' },
  { idea: 50307, name: 'EmptyTagsHint' },
  { idea: 50308, name: 'EmptyCommentsPrompt' },
  { idea: 50309, name: 'EmptyWatchlist' },
  { idea: 50310, name: 'EmptyExportHistory' },
  { idea: 50311, name: 'EmptyShortcutCustomization' },
  { idea: 50312, name: 'EmptyDashboard' },
  { idea: 50313, name: 'EmptySearchHistory' },
  { idea: 50314, name: 'EmptyTrash' },
  { idea: 50315, name: 'InboxZeroReviewQueue' },
  { idea: 50316, name: 'EmptyRetestQueue' },
  { idea: 50317, name: 'EmptyModelLibrary' },
  { idea: 50318, name: 'EmptyScopeState' },
  { idea: 50319, name: 'QueuedHuntTimeline' },
  { idea: 50320, name: 'EmptyInvoices' },
  { idea: 50321, name: 'EmptyIdeasList' },
  { idea: 50322, name: 'EmptyPlaybooks' },
  { idea: 50323, name: 'EmptyWebhookDeliveries' },
  { idea: 50324, name: 'EmptyProfileActivity' },
  { idea: 50325, name: 'EmptySharedWithMe' },
  { idea: 50326, name: 'EmptyReportTemplates' },
  { idea: 50327, name: 'EmptyPayloadLists' },
  { idea: 50328, name: 'EmptyPausedHunts' },
  { idea: 50329, name: 'EmptyMentionResults' },
  { idea: 50330, name: 'EmptyComplianceChecklist' },
  { idea: 50331, name: 'PositiveNoBreachState' },
  { idea: 50332, name: 'EmptyAgentMemory' },
  { idea: 50333, name: 'EmptyAttachmentsHint' },
  { idea: 50334, name: 'EmptyVoiceHistory' },
  { idea: 50335, name: 'EmptyAvatarCustomization' },
  { idea: 50336, name: 'EmptyScheduledReports' },
  { idea: 50337, name: 'EmptyTargetNotes' },
  { idea: 50338, name: 'EmptyMacros' },
  { idea: 50339, name: 'FriendlyHunt404' },
  { idea: 50340, name: 'TargetUnreachableCard' },
];

export default EmptyState;
