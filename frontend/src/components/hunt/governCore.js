/**
 * governCore.js — wave 30 (ideas 51161–51200): steering round 2 +
 * approval/governance suite — pure logic.
 *
 * Ideas 51161–51172 (steering round 2): de-emphasize a findings class and
 * watch the agent adapt, steer via the findings feed ("find more like
 * these"), live hunt-persona switch, plan checkpoints that force a
 * check-in, steering analytics (which redirections led to findings),
 * one-command emergency re-scope, user-defined steering command aliases,
 * scheduled steering (queue a redirection for later), a merge view that
 * reconciles conflicting teammate steering, an autonomy slider (how much
 * the agent may self-redirect), a notification feed of every plan change,
 * and a one-line post-steering summary of the new plan.
 *
 * Ideas 51173–51200 (approval/governance): inline approve/deny cards with
 * full context, clear risk labels (safe / cautious / destructive), an
 * expandable detail drawer (exact requests, targets, expected side
 * effects), one-tap approve/deny, a bulk approval queue, approval
 * timeouts (auto-deny or auto-pause), approve-with-limits (cap scope,
 * rate, duration), always-allow and always-deny rules, mid-hunt approval
 * delegation to a teammate, step-up authentication for destructive
 * approvals, an immutable approval audit trail, per-request countdowns,
 * graceful agent waiting (useful safe work while blocked), approval
 * templates (paranoid / balanced / permissive), sandbox previews of
 * destructive actions, reversible-action badges, mobile approvals with
 * full context, voice approvals with verification, per-instance approval
 * expiry, request-more-info, approval analytics, emergency deny-all,
 * approval chat threads, side-effect estimators, attached rollback plans,
 * push/email/SMS approval notifications, and quiet batching of
 * non-urgent requests into a digest.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic (no Math.random, no Date.now inside).
 */

export const WAVE30_START = 51161;
export const WAVE30_END = 51200;

/** Registry of all 40 ideas in this wave — completeness is testable. */
export const WAVE30_IDEAS = [
  [51161, 'de-emphasize findings class', 'Tell the agent a finding category is out of interest and watch it adapt'],
  [51162, 'steering via findings feed', 'Bulk-select findings and choose "find more like these"'],
  [51163, 'hunt persona switch', 'Change the agent testing persona live (cautious auditor vs aggressive hunter)'],
  [51164, 'checkpoint steering', 'Set plan checkpoints where the agent must check in before continuing'],
  [51165, 'steering analytics', 'See which of your redirections led to findings, improving future steering'],
  [51166, 'emergency re-scope', 'One command narrows the hunt to a single critical asset instantly'],
  [51167, 'steering command aliases', 'Define shorthand commands mapped to complex redirections'],
  [51168, 'scheduled steering', 'Queue a redirection to apply at a future time or phase boundary'],
  [51169, 'steering conflict resolver', 'A merge view reconciles conflicting teammate steering commands'],
  [51170, 'agent autonomy slider', 'Dial how much the agent may self-redirect versus awaiting your steering'],
  [51171, 'steering notification feed', 'A dedicated feed showing every plan change and its trigger'],
  [51172, 'post-steering summary', 'After each redirection, a one-line summary of the new plan'],
  [51173, 'inline approval cards', 'Sensitive actions arrive as approve/deny cards with full context attached'],
  [51174, 'action risk labels', 'Every approval shows a clear risk level: safe, cautious, or destructive'],
  [51175, 'approval detail drawer', 'Expand any request to see exact requests, targets, and expected side effects'],
  [51176, 'one-tap approve/deny', 'Big unambiguous buttons designed for fast decisions under time pressure'],
  [51177, 'bulk approval queue', 'Review and decide on multiple pending actions in one focused screen'],
  [51178, 'approval timeouts', 'Pending actions auto-deny or auto-pause after a configurable wait'],
  [51179, 'approve-with-limits', 'Approve an action but cap its scope, rate, or duration'],
  [51180, 'always-allow rules', 'Pre-approve categories of safe actions so they never interrupt the hunt'],
  [51181, 'always-deny rules', 'Permanently forbid action categories for this hunt or all hunts'],
  [51182, 'approval delegation (mid-hunt)', 'Route specific approval types to a teammate automatically'],
  [51183, 'step-up authentication (mid-hunt)', 'Destructive approvals require a second confirmation factor'],
  [51184, 'approval audit trail (mid-hunt)', 'Who approved what, when, and with what context, immutably logged'],
  [51185, 'pending-action countdown', 'See how long each request has waited and what the agent is doing meanwhile'],
  [51186, 'agent waits gracefully', 'While awaiting approval, the agent works on unrelated safe tasks'],
  [51187, 'approval templates (mid-hunt)', 'Prebuilt policies like paranoid, balanced, permissive applied per hunt'],
  [51188, 'destructive-action sandbox preview', 'See a simulated outcome before approving a risky action'],
  [51189, 'reversible-action badges', 'Approvals mark which actions can be rolled back afterwards'],
  [51190, 'approval on mobile', 'Approve or deny from your phone with the same context as desktop'],
  [51191, 'voice approvals', 'Speak "approved" with voice verification for hands-free decisions'],
  [51192, 'approval expiry (mid-hunt)', 'Approvals apply only to the specific instance requested, never blanket future ones'],
  [51193, 'request-more-info button', 'Ask the agent to justify a request before you decide'],
  [51194, 'approval analytics (mid-hunt)', 'Track your approval patterns to auto-suggest smarter defaults'],
  [51195, 'emergency deny-all', 'One button that denies every pending request and pauses the hunt'],
  [51196, 'approval chat thread', 'Discuss a pending action with the agent before deciding'],
  [51197, 'side-effect estimator', 'The agent lists likely side effects of the action it is requesting'],
  [51198, 'rollback plan attached', 'Destructive requests include the agent plan to undo changes if needed'],
  [51199, 'approval notifications', 'Push, email, or SMS alerts the moment an approval is needed'],
  [51200, 'quiet approval batching', 'Non-urgent requests grouped into a digest instead of interrupting you'],
];

export const HUNT_PERSONAS = ['cautious-auditor', 'balanced', 'aggressive-hunter'];
export const RISK_LEVELS = ['safe', 'cautious', 'destructive'];
export const APPROVAL_TEMPLATES = ['paranoid', 'balanced', 'permissive'];

// ---------------------------------------------------------------------------
// 51161 — de-emphasize findings class
// ---------------------------------------------------------------------------
/**
 * Mark a finding category as out of interest; returns the updated
 * de-emphasis map plus the plan adaptation the agent applies.
 */
export function deemphasizeFindingsClass(deemphasized, category) {
  const cat = String(category || '').trim().toLowerCase();
  if (!cat) return { deemphasized, adaptation: null };
  if (deemphasized.includes(cat)) return { deemphasized, adaptation: null };
  const next = [...deemphasized, cat];
  return {
    deemphasized: next,
    adaptation: {
      action: 'reduce-effort',
      category: cat,
      effortShare: 0.05,
      note: `Effort on "${cat}" reduced to 5%; freed capacity redistributed to remaining classes`,
    },
  };
}

// ---------------------------------------------------------------------------
// 51162 — steering via findings feed
// ---------------------------------------------------------------------------
/**
 * From bulk-selected findings, build a "find more like these" steering
 * directive keyed on shared attributes (category + severity band).
 */
export function steerFromFindings(findings) {
  const list = (findings || []).filter(Boolean);
  if (!list.length) return null;
  const cats = {};
  const sevs = {};
  for (const f of list) {
    cats[f.category || 'unknown'] = (cats[f.category || 'unknown'] || 0) + 1;
    sevs[f.severity || 'unknown'] = (sevs[f.severity || 'unknown'] || 0) + 1;
  }
  const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
  const topSev = Object.entries(sevs).sort((a, b) => b[1] - a[1])[0][0];
  return {
    directive: 'find-more-like-these',
    basedOn: list.length,
    targetCategory: topCat,
    targetSeverity: topSev,
    instruction: `Prioritize ${topSev}-severity ${topCat} findings across in-scope assets`,
  };
}

// ---------------------------------------------------------------------------
// 51163 — hunt persona switch
// ---------------------------------------------------------------------------
/** Switch the agent's testing persona live; returns the retuned profile. */
export function switchPersona(current, persona) {
  if (!HUNT_PERSONAS.includes(persona)) return { persona: current, changed: false };
  const profiles = {
    'cautious-auditor': { rps: 2, depth: 2, noise: 'low', verify: 'strict' },
    balanced: { rps: 8, depth: 4, noise: 'medium', verify: 'standard' },
    'aggressive-hunter': { rps: 25, depth: 7, noise: 'high', verify: 'fast' },
  };
  return { persona, changed: persona !== current, profile: profiles[persona] };
}

// ---------------------------------------------------------------------------
// 51164 — checkpoint steering
// ---------------------------------------------------------------------------
/** Add a plan checkpoint; the agent must check in when it reaches it. */
export function addCheckpoint(checkpoints, phase, note) {
  const cp = {
    id: `cp-${checkpoints.length + 1}`,
    phase,
    note: String(note || ''),
    status: 'pending',
  };
  return [...checkpoints, cp];
}

/** Mark the checkpoint for a phase as reached (awaiting check-in). */
export function reachCheckpoint(checkpoints, phase) {
  return checkpoints.map((c) =>
    c.phase === phase && c.status === 'pending' ? { ...c, status: 'awaiting-checkin' } : c,
  );
}

// ---------------------------------------------------------------------------
// 51165 — steering analytics
// ---------------------------------------------------------------------------
/**
 * Correlate steering commands with findings discovered after each
 * command; returns per-command attribution stats.
 */
export function steeringAnalytics(commands, findings) {
  return (commands || []).map((cmd) => {
    const after = (findings || []).filter((f) => f.foundAfter === cmd.id);
    return {
      commandId: cmd.id,
      label: cmd.label,
      findingsAttributed: after.length,
      topSeverity: after.map((f) => f.severity).sort()[0] || null,
    };
  });
}

// ---------------------------------------------------------------------------
// 51166 — emergency re-scope
// ---------------------------------------------------------------------------
/** Narrow the whole hunt to a single critical asset in one command. */
export function emergencyRescope(plan, asset) {
  if (!asset) return plan;
  return {
    ...plan,
    scope: [asset],
    mode: 'emergency-focus',
    pausedModules: (plan.modules || []).filter((m) => m !== 'critical-path'),
    note: `Emergency re-scope: all effort on ${asset}`,
  };
}

// ---------------------------------------------------------------------------
// 51167 — steering command aliases
// ---------------------------------------------------------------------------
/** Define a shorthand alias mapped to a full steering command. */
export function defineAlias(aliases, shorthand, command) {
  const key = String(shorthand || '').trim();
  if (!key || !command) return aliases;
  return { ...aliases, [key]: command };
}

/** Expand an alias; returns the full command or the raw text if none. */
export function expandAlias(aliases, text) {
  const key = String(text || '').trim();
  return aliases[key] || text;
}

// ---------------------------------------------------------------------------
// 51168 — scheduled steering
// ---------------------------------------------------------------------------
/** Queue a steering command to apply at a future time or phase boundary. */
export function scheduleSteering(queue, command, at) {
  return [...queue, { id: `sched-${queue.length + 1}`, command, at, status: 'scheduled' }];
}

/** Return the commands whose trigger time/phase has arrived. */
export function dueSteering(queue, nowOrPhase) {
  return queue.filter((q) => q.status === 'scheduled' && q.at <= nowOrPhase);
}

// ---------------------------------------------------------------------------
// 51169 — steering conflict resolver
// ---------------------------------------------------------------------------
/**
 * Reconcile two teammates' conflicting steering commands into a merge
 * proposal: shared fields kept, conflicts flagged for a human pick.
 */
export function resolveSteeringConflict(a, b) {
  const keys = new Set([...Object.keys(a.command || {}), ...Object.keys(b.command || {})]);
  const merged = {};
  const conflicts = [];
  for (const k of keys) {
    const va = (a.command || {})[k];
    const vb = (b.command || {})[k];
    if (JSON.stringify(va) === JSON.stringify(vb)) merged[k] = va;
    else conflicts.push({ field: k, fromA: va, fromB: vb, authors: [a.author, b.author] });
  }
  return { merged, conflicts, needsHuman: conflicts.length > 0 };
}

// ---------------------------------------------------------------------------
// 51170 — agent autonomy slider
// ---------------------------------------------------------------------------
/** Set autonomy 0–100; returns the behavior envelope for that level. */
export function setAutonomy(level) {
  const l = Math.max(0, Math.min(100, Number(level) || 0));
  return {
    level: l,
    maySelfRedirect: l >= 70,
    mayReorderPhases: l >= 40,
    mustAskBeforeDestructive: l < 90,
    label: l < 30 ? 'supervised' : l < 70 ? 'collaborative' : 'autonomous',
  };
}

// ---------------------------------------------------------------------------
// 51171 — steering notification feed
// ---------------------------------------------------------------------------
/** Append a plan-change event to the steering notification feed. */
export function pushSteeringEvent(feed, event) {
  return [{ id: `ev-${feed.length + 1}`, ...event }, ...feed].slice(0, 50);
}

// ---------------------------------------------------------------------------
// 51172 — post-steering summary
// ---------------------------------------------------------------------------
/** Build a one-line summary of the new plan after a redirection. */
export function postSteeringSummary(change) {
  const parts = [];
  if (change.scope) parts.push(`scope → ${change.scope.length} target(s)`);
  if (change.phases) parts.push(`${change.phases.length} phases reordered`);
  if (change.mode) parts.push(`mode: ${change.mode}`);
  if (change.added) parts.push(`+${change.added}`);
  if (!parts.length) return 'Plan updated.';
  return `New plan: ${parts.join('; ')}.`;
}

// ---------------------------------------------------------------------------
// 51173 — inline approval cards
// ---------------------------------------------------------------------------
/** Shape a raw action request into an inline approval card. */
export function toApprovalCard(request) {
  return {
    id: request.id,
    title: request.title,
    risk: RISK_LEVELS.includes(request.risk) ? request.risk : 'cautious',
    context: request.context || '',
    status: 'pending',
    requestedAt: request.requestedAt || 0,
  };
}

// ---------------------------------------------------------------------------
// 51174 — action risk labels
// ---------------------------------------------------------------------------
/** Normalize a risk label; unknown values fall back to cautious. */
export function riskLabel(risk) {
  return RISK_LEVELS.includes(risk) ? risk : 'cautious';
}

/** Destructive actions always need explicit approval. */
export function requiresExplicitApproval(risk) {
  return riskLabel(risk) !== 'safe';
}

// ---------------------------------------------------------------------------
// 51175 — approval detail drawer
// ---------------------------------------------------------------------------
/** Expand a card into full detail: exact requests, targets, side effects. */
export function approvalDetail(card) {
  return {
    id: card.id,
    title: card.title,
    risk: card.risk,
    exactRequests: card.requests || [],
    targets: card.targets || [],
    expectedSideEffects: card.sideEffects || [],
    reversible: !!card.reversible,
  };
}

// ---------------------------------------------------------------------------
// 51176 — one-tap approve/deny
// ---------------------------------------------------------------------------
/** Resolve a pending card with a single tap decision. */
export function decideApproval(card, decision, actor) {
  if (!['approved', 'denied'].includes(decision)) return card;
  return { ...card, status: decision, decidedBy: actor || 'you', decidedAt: 'now' };
}

// ---------------------------------------------------------------------------
// 51177 — bulk approval queue
// ---------------------------------------------------------------------------
/** Decide on many pending cards at once; returns updated list + counts. */
export function bulkDecide(cards, decisions) {
  let approved = 0;
  let denied = 0;
  const next = cards.map((c) => {
    const d = decisions[c.id];
    if (c.status !== 'pending' || !['approved', 'denied'].includes(d)) return c;
    if (d === 'approved') approved++;
    else denied++;
    return { ...c, status: d };
  });
  return { cards: next, approved, denied, remaining: next.filter((c) => c.status === 'pending').length };
}

// ---------------------------------------------------------------------------
// 51178 — approval timeouts
// ---------------------------------------------------------------------------
/**
 * Apply timeout policy to stale pending cards: auto-deny or auto-pause
 * once waitedMs exceeds the configured limit.
 */
export function applyApprovalTimeouts(cards, nowMs, limitMs, onTimeout) {
  const action = onTimeout === 'auto-pause' ? 'paused' : 'denied';
  return cards.map((c) => {
    if (c.status !== 'pending') return c;
    const waited = nowMs - (c.requestedAt || 0);
    return waited > limitMs ? { ...c, status: action, timeoutMs: waited } : c;
  });
}

// ---------------------------------------------------------------------------
// 51179 — approve-with-limits
// ---------------------------------------------------------------------------
/** Approve but cap scope, rate, and/or duration. */
export function approveWithLimits(card, limits) {
  return {
    ...decideApproval(card, 'approved'),
    limits: {
      scope: limits.scope || null,
      maxRps: limits.maxRps || null,
      durationMinutes: limits.durationMinutes || null,
    },
  };
}

// ---------------------------------------------------------------------------
// 51180 / 51181 — always-allow / always-deny rules
// ---------------------------------------------------------------------------
/** Add a standing rule; returns updated rule set. */
export function addStandingRule(rules, kind, category, scope) {
  if (!['allow', 'deny'].includes(kind)) return rules;
  const cat = String(category || '').trim().toLowerCase();
  if (!cat) return rules;
  return [...rules.filter((r) => !(r.kind === kind && r.category === cat)), { kind, category: cat, scope: scope || 'hunt' }];
}

/** Check a request against standing rules; returns allow/deny/null. */
export function checkStandingRules(rules, category) {
  const cat = String(category || '').trim().toLowerCase();
  const deny = rules.find((r) => r.kind === 'deny' && r.category === cat);
  if (deny) return 'deny';
  const allow = rules.find((r) => r.kind === 'allow' && r.category === cat);
  if (allow) return 'allow';
  return null;
}

// ---------------------------------------------------------------------------
// 51182 — approval delegation
// ---------------------------------------------------------------------------
/** Route approval types to a teammate automatically. */
export function delegateApprovals(delegations, approvalType, teammate) {
  if (!approvalType || !teammate) return delegations;
  return { ...delegations, [approvalType]: teammate };
}

// ---------------------------------------------------------------------------
// 51183 — step-up authentication
// ---------------------------------------------------------------------------
/**
 * Destructive approvals need a second factor; returns whether the
 * request is fully authorized given the factors presented.
 */
export function stepUpAuthorized(card, factors) {
  if (card.risk !== 'destructive') return true;
  return Array.isArray(factors) && factors.length >= 2;
}

// ---------------------------------------------------------------------------
// 51184 — approval audit trail
// ---------------------------------------------------------------------------
/** Append an immutable audit entry (entries are never mutated). */
export function auditApproval(trail, entry) {
  const record = Object.freeze({
    seq: trail.length + 1,
    who: entry.who,
    decision: entry.decision,
    cardId: entry.cardId,
    context: entry.context || '',
  });
  return [...trail, record];
}

// ---------------------------------------------------------------------------
// 51185 — pending-action countdown
// ---------------------------------------------------------------------------
/** For each pending card: how long it waited + what the agent did meanwhile. */
export function pendingCountdowns(cards, nowMs, agentActivity) {
  return cards
    .filter((c) => c.status === 'pending')
    .map((c) => ({
      id: c.id,
      waitedMs: Math.max(0, nowMs - (c.requestedAt || 0)),
      agentMeanwhile: (agentActivity || {})[c.id] || 'idle',
    }));
}

// ---------------------------------------------------------------------------
// 51186 — agent waits gracefully
// ---------------------------------------------------------------------------
/** Pick safe background tasks the agent can do while blocked on approval. */
export function gracefulWaitTasks(tasks) {
  return (tasks || []).filter((t) => t.safe && !t.needsApproval);
}

// ---------------------------------------------------------------------------
// 51187 — approval templates
// ---------------------------------------------------------------------------
const TEMPLATE_POLICIES = {
  paranoid: { autoAllow: [], autoDeny: ['destructive'], timeoutMs: 60000, timeoutAction: 'auto-deny' },
  balanced: { autoAllow: ['safe'], autoDeny: [], timeoutMs: 300000, timeoutAction: 'auto-pause' },
  permissive: { autoAllow: ['safe', 'cautious'], autoDeny: [], timeoutMs: 900000, timeoutAction: 'auto-pause' },
};

/** Apply a named policy template to the hunt. */
export function applyApprovalTemplate(name) {
  if (!APPROVAL_TEMPLATES.includes(name)) return null;
  return { name, ...TEMPLATE_POLICIES[name] };
}

// ---------------------------------------------------------------------------
// 51188 — destructive-action sandbox preview
// ---------------------------------------------------------------------------
/**
 * Simulate the outcome of a destructive action without executing it.
 * Pure estimation from the declared parameters.
 */
export function sandboxPreview(action) {
  const targets = (action.targets || []).length;
  return {
    actionId: action.id,
    simulated: true,
    estimatedRequests: (action.estimatedRps || 0) * (action.estimatedSeconds || 0),
    targetsAffected: targets,
    reversible: !!action.reversible,
    warning: action.risk === 'destructive' ? 'Destructive: review targets before approving' : null,
  };
}

// ---------------------------------------------------------------------------
// 51189 — reversible-action badges
// ---------------------------------------------------------------------------
/** Badge text for a card based on reversibility. */
export function reversibleBadge(card) {
  return card.reversible ? { text: 'reversible', tone: 'good' } : { text: 'irreversible', tone: 'warn' };
}

// ---------------------------------------------------------------------------
// 51190 — approval on mobile
// ---------------------------------------------------------------------------
/** The mobile payload carries the same context as desktop (no truncation). */
export function mobileApprovalPayload(card) {
  const detail = approvalDetail(card);
  return { ...detail, channel: 'mobile', fullContext: true };
}

// ---------------------------------------------------------------------------
// 51191 — voice approvals
// ---------------------------------------------------------------------------
/**
 * Parse a spoken approval; requires a verified voice factor to count.
 * Returns the decision or null when verification is missing.
 */
export function parseVoiceApproval(transcript, voiceVerified) {
  const t = String(transcript || '').trim().toLowerCase();
  if (!voiceVerified) return null;
  if (t === 'approved' || t === 'approve') return 'approved';
  if (t === 'denied' || t === 'deny') return 'denied';
  return null;
}

// ---------------------------------------------------------------------------
// 51192 — approval expiry
// ---------------------------------------------------------------------------
/** Approvals bind to the exact instance requested, never future ones. */
export function approvalScopeNote(card) {
  return `Approval ${card.id} applies only to this instance (${card.title}); it does not pre-approve future requests.`;
}

// ---------------------------------------------------------------------------
// 51193 — request-more-info
// ---------------------------------------------------------------------------
/** Flag a card as needing justification before a decision. */
export function requestMoreInfo(card, question) {
  return { ...card, status: 'needs-info', infoQuestion: String(question || 'Please justify this request.') };
}

// ---------------------------------------------------------------------------
// 51194 — approval analytics
// ---------------------------------------------------------------------------
/**
 * From past decisions, suggest smarter defaults (e.g. categories you
 * always approve become always-allow candidates).
 */
export function approvalAnalytics(decisions) {
  const byCat = {};
  for (const d of decisions || []) {
    const c = d.category || 'unknown';
    byCat[c] = byCat[c] || { approved: 0, denied: 0 };
    byCat[c][d.decision === 'approved' ? 'approved' : 'denied']++;
  }
  return Object.entries(byCat).map(([category, s]) => {
    const total = s.approved + s.denied;
    const rate = total ? s.approved / total : 0;
    return {
      category,
      ...s,
      approvalRate: Number(rate.toFixed(2)),
      suggestion: rate === 1 && total >= 3 ? 'always-allow candidate' : rate === 0 && total >= 3 ? 'always-deny candidate' : 'no change',
    };
  });
}

// ---------------------------------------------------------------------------
// 51195 — emergency deny-all
// ---------------------------------------------------------------------------
/** Deny every pending request and pause the hunt in one action. */
export function emergencyDenyAll(cards) {
  return {
    cards: cards.map((c) => (c.status === 'pending' ? { ...c, status: 'denied', reason: 'emergency-deny-all' } : c)),
    huntPaused: true,
  };
}

// ---------------------------------------------------------------------------
// 51196 — approval chat thread
// ---------------------------------------------------------------------------
/** Append a message to the discussion thread on a pending card. */
export function approvalChatThread(thread, author, message) {
  if (!String(message || '').trim()) return thread;
  return [...thread, { author, message: String(message).trim(), at: thread.length + 1 }];
}

// ---------------------------------------------------------------------------
// 51197 — side-effect estimator
// ---------------------------------------------------------------------------
/** List the agent's estimated side effects for a requested action. */
export function estimateSideEffects(action) {
  const effects = [];
  if ((action.targets || []).length) effects.push(`${action.targets.length} target(s) will receive requests`);
  if (action.writesData) effects.push('writes data to the target');
  if (action.estimatedRps > 10) effects.push('high request rate — may trigger rate limiting');
  if (action.risk === 'destructive') effects.push('destructive: changes may not be fully reversible');
  if (!effects.length) effects.push('no significant side effects expected');
  return effects;
}

// ---------------------------------------------------------------------------
// 51198 — rollback plan attached
// ---------------------------------------------------------------------------
/** Build the rollback plan attached to a destructive request. */
export function rollbackPlan(action) {
  return {
    actionId: action.id,
    steps: (action.targets || []).map((t) => `restore ${t} from pre-action snapshot`),
    verified: !!action.reversible,
    note: action.reversible ? 'Rollback verified possible' : 'Rollback not guaranteed — approve with care',
  };
}

// ---------------------------------------------------------------------------
// 51199 — approval notifications
// ---------------------------------------------------------------------------
const NOTIFY_CHANNELS = ['push', 'email', 'sms'];

/** Build notification payloads for the enabled channels. */
export function approvalNotifications(card, channels) {
  const use = (channels || []).filter((c) => NOTIFY_CHANNELS.includes(c));
  return use.map((channel) => ({
    channel,
    cardId: card.id,
    title: `Approval needed: ${card.title}`,
    risk: card.risk,
  }));
}

// ---------------------------------------------------------------------------
// 51200 — quiet approval batching
// ---------------------------------------------------------------------------
/**
 * Split pending cards: urgent interrupt now, non-urgent grouped into a
 * digest delivered later.
 */
export function batchApprovals(cards) {
  const urgent = cards.filter((c) => c.status === 'pending' && c.risk === 'destructive');
  const digest = cards.filter((c) => c.status === 'pending' && c.risk !== 'destructive');
  return { interruptNow: urgent, digest };
}
