/**
 * steeringCore.js — wave 29 (ideas 51121–51160): mid-hunt steering /
 * live redirection suite — pure logic.
 *
 * Ideas 51121–51140 (steering control layer): mid-hunt scope addition,
 * scope removal, target-profile switch, custom wordlist injection, live
 * request-rate cap, scan-intensity dial, endpoint redirect, module-level
 * pause, phase reordering, time-budget extension, wrap-up command,
 * natural-language steering, drag-and-drop priorities, steering presets,
 * undo steering, steering preview, impact estimate, steering history log,
 * co-steering, saved steering templates.
 *
 * Ideas 51141–51160 (steering advanced layer): conditional steering rules,
 * time-boxed focus, steer-from-finding, steer-from-log, spoken redirection,
 * touch priority board, steering API, steer while paused, big-change
 * approval, agent pushback, agent steering suggestions, bandwidth steering,
 * stealth steering, depth limiter, retest-on-change, steering dry-run,
 * priority inheritance, steering cooldown, module enable/disable live,
 * focus window.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic (no Math.random, no Date.now inside).
 */

export const WAVE29_START = 51121;
export const WAVE29_END = 51160;

/** Registry of all 40 ideas in this wave — completeness is testable. */
export const WAVE29_IDEAS = [
  [
    51121,
    'mid-hunt scope addition',
    'Add a subdomain or path to scope with instant agent acknowledgement',
  ],
  [
    51122,
    'mid-hunt scope removal',
    'Pull a target out of scope and halt its in-flight tests gracefully',
  ],
  [
    51123,
    'target-profile switch',
    'Change the assumed target profile (SPA vs API) and retune the plan live',
  ],
  [
    51124,
    'custom wordlist injection',
    'Upload a wordlist mid-hunt that the agent starts using immediately',
  ],
  [
    51125,
    'live request-rate cap',
    'Set a max requests-per-second that throttles the agent on the spot',
  ],
  [
    51126,
    'scan-intensity dial',
    'Move between light, normal, and aggressive testing without restarting',
  ],
  [
    51127,
    'endpoint redirect',
    'Point the agent at a newly discovered endpoint to investigate next',
  ],
  [51128, 'module-level pause', 'Pause one module while the rest of the hunt keeps running'],
  [51129, 'phase reordering', 'Drag phases into a new order and the agent adopts the sequence'],
  [
    51130,
    'time-budget extension',
    'Grant the hunt extra hours and watch the plan expand to use them',
  ],
  [
    51131,
    'wrap-up command',
    'Tell the agent to finish within N minutes and get a condensed final sweep',
  ],
  [
    51132,
    'natural-language steering',
    'Plain sentences like "spend more time on the API" that the agent executes',
  ],
  [51133, 'drag-and-drop priorities', 'Reorder a visual priority list to reshape the hunt plan'],
  [
    51134,
    'steering presets',
    'One-tap modes like "go wide", "go deep", or "be quiet" that reconfigure the hunt',
  ],
  [51135, 'undo steering', 'Revert your last steering command and restore the previous plan'],
  [51136, 'steering preview', 'See the planned changes before confirming a major redirection'],
  [
    51137,
    'impact estimate',
    'The agent tells you a steering change adds roughly N minutes or M requests',
  ],
  [51138, 'steering history log', 'Every redirection recorded with who issued it and what changed'],
  [51139, 'co-steering', 'Teammates propose steering changes that take effect after your approval'],
  [
    51140,
    'saved steering templates',
    'Store redirection patterns per target type and apply them in one click',
  ],
  [
    51141,
    'conditional steering rules',
    '"If you find an admin panel, go deep on it" style if-then instructions',
  ],
  [51142, 'time-boxed focus', '"Focus the API for the next 30 minutes, then resume the plan"'],
  [
    51143,
    'steer-from-finding',
    'On a finding card, choose "investigate similar areas" to redirect the agent',
  ],
  [51144, 'steer-from-log', 'Click any log line and choose "do more of this" or "stop doing this"'],
  [51145, 'spoken redirection', 'Speak redirection commands hands-free during a live hunt'],
  [
    51146,
    'touch priority board',
    'A tablet-friendly board for reprioritizing hunt areas by drag and drop',
  ],
  [51147, 'steering API', 'Programmatic endpoints so external tools can redirect a running hunt'],
  [
    51148,
    'steer while paused',
    'Rearrange the plan during a pause so it resumes with the new strategy',
  ],
  [
    51149,
    'big-change approval',
    'Major redirections require explicit confirmation before the agent acts',
  ],
  [
    51150,
    'agent pushback',
    'The agent warns you when a steering command risks missing better leads',
  ],
  [
    51151,
    'agent steering suggestions',
    'The agent proposes redirections based on what it is seeing, for you to approve',
  ],
  [51152, 'bandwidth steering', 'Cap total requests or bandwidth for the remainder of the hunt'],
  [51153, 'stealth steering', 'Switch the hunt to low-noise mode mid-run without losing progress'],
  [51154, 'depth limiter', 'Set how many levels deep crawling or chaining may go from now on'],
  [
    51155,
    'retest-on-change',
    'When the target changes mid-hunt, the agent re-tests affected areas automatically',
  ],
  [
    51156,
    'steering dry-run',
    'Simulate a redirection to preview its effect on the plan before applying it',
  ],
  [
    51157,
    'priority inheritance (mid-hunt)',
    'Boosted priorities automatically apply to newly discovered in-scope assets',
  ],
  [
    51158,
    'steering cooldown',
    'Optional lockout preventing conflicting redirections within a short window',
  ],
  [
    51159,
    'module enable/disable live',
    'Toggle individual testing modules on or off without restarting the hunt',
  ],
  [
    51160,
    'focus window',
    'Define a URL pattern; the agent spends a fixed share of effort inside it',
  ],
];

export const INTENSITY_LEVELS = ['light', 'normal', 'aggressive'];
export const STEERING_PRESETS = ['go-wide', 'go-deep', 'be-quiet'];
export const TARGET_PROFILES = ['spa', 'api', 'wordpress', 'ecommerce', 'generic'];

// ---------------------------------------------------------------------------
// 51121 — mid-hunt scope addition
// ---------------------------------------------------------------------------
/**
 * Add a subdomain or path to the hunt scope.
 * Returns { scope, acknowledgement } — acknowledgement is the instant
 * agent confirmation record.
 */
export function addScopeTarget(scope, target) {
  const clean = String(target || '').trim();
  if (!clean) return { scope: [...scope], acknowledgement: null };
  if (scope.includes(clean)) {
    return {
      scope: [...scope],
      acknowledgement: { target: clean, status: 'already-in-scope', added: false },
    };
  }
  return {
    scope: [...scope, clean],
    acknowledgement: { target: clean, status: 'acknowledged', added: true },
  };
}

// ---------------------------------------------------------------------------
// 51122 — mid-hunt scope removal (graceful in-flight halt)
// ---------------------------------------------------------------------------
/**
 * Remove a target from scope. In-flight tests touching that target are
 * listed for graceful halt instead of being killed mid-request.
 */
export function removeScopeTarget(scope, inFlight, target) {
  const clean = String(target || '').trim();
  const nextScope = scope.filter(t => t !== clean);
  const halting = (inFlight || []).filter(
    job => job && typeof job.target === 'string' && job.target.includes(clean)
  );
  const remaining = (inFlight || []).filter(
    job => !(job && typeof job.target === 'string' && job.target.includes(clean))
  );
  return {
    scope: nextScope,
    halting: halting.map(j => ({ ...j, halt: 'graceful' })),
    remaining,
    removed: scope.length !== nextScope.length,
  };
}

// ---------------------------------------------------------------------------
// 51123 — target-profile switch
// ---------------------------------------------------------------------------
/** Retune the plan when the assumed target profile changes. */
export function switchTargetProfile(plan, profile) {
  if (!TARGET_PROFILES.includes(profile)) return { ...plan };
  const weights = {
    spa: { crawler: 3, apiFuzz: 1, jsAnalysis: 3, sqli: 1 },
    api: { crawler: 1, apiFuzz: 3, jsAnalysis: 1, sqli: 2 },
    wordpress: { crawler: 2, apiFuzz: 1, jsAnalysis: 1, sqli: 2 },
    ecommerce: { crawler: 2, apiFuzz: 2, jsAnalysis: 2, sqli: 2 },
    generic: { crawler: 2, apiFuzz: 2, jsAnalysis: 2, sqli: 2 },
  }[profile];
  return { ...plan, profile, moduleWeights: weights, retuned: true };
}

// ---------------------------------------------------------------------------
// 51124 — custom wordlist injection
// ---------------------------------------------------------------------------
/** Register an uploaded wordlist so the agent starts using it immediately. */
export function injectWordlist(state, wordlist) {
  const words = Array.isArray(wordlist.words) ? wordlist.words.filter(Boolean) : [];
  const entry = {
    name: String(wordlist.name || 'custom.txt'),
    count: words.length,
    active: words.length > 0,
  };
  return {
    ...state,
    wordlists: [...(state.wordlists || []), entry],
    wordlistWords: words,
  };
}

// ---------------------------------------------------------------------------
// 51125 — live request-rate cap
// ---------------------------------------------------------------------------
/** Throttle the agent on the spot with a max requests-per-second cap. */
export function setRateCap(state, rps) {
  const cap = Math.max(1, Math.min(1000, Math.floor(Number(rps) || 10)));
  return { ...state, rateCapRps: cap, throttled: cap < 50 };
}

// ---------------------------------------------------------------------------
// 51126 — scan-intensity dial
// ---------------------------------------------------------------------------
/** Move between light / normal / aggressive without restarting. */
export function setIntensity(state, level) {
  if (!INTENSITY_LEVELS.includes(level)) return { ...state };
  const payloads = { light: 1, normal: 3, aggressive: 8 }[level];
  return { ...state, intensity: level, payloadsPerCheck: payloads };
}

// ---------------------------------------------------------------------------
// 51127 — endpoint redirect
// ---------------------------------------------------------------------------
/** Point the agent at a newly discovered endpoint to investigate next. */
export function redirectEndpoint(queue, endpoint) {
  const clean = String(endpoint || '').trim();
  if (!clean) return [...queue];
  return [{ endpoint: clean, priority: 'next', queued: true }, ...queue];
}

// ---------------------------------------------------------------------------
// 51128 — module-level pause
// ---------------------------------------------------------------------------
/** Pause one module while the rest of the hunt keeps running. */
export function pauseModule(modules, name) {
  return (modules || []).map(m => (m.name === name ? { ...m, paused: true } : m));
}
/** Resume a paused module. */
export function resumeModule(modules, name) {
  return (modules || []).map(m => (m.name === name ? { ...m, paused: false } : m));
}

// ---------------------------------------------------------------------------
// 51129 — phase reordering
// ---------------------------------------------------------------------------
/** Move a phase from one index to another (drag-and-drop order). */
export function reorderPhases(phases, fromIdx, toIdx) {
  const list = [...(phases || [])];
  if (fromIdx < 0 || fromIdx >= list.length || toIdx < 0 || toIdx >= list.length) return list;
  const [moved] = list.splice(fromIdx, 1);
  list.splice(toIdx, 0, moved);
  return list;
}

// ---------------------------------------------------------------------------
// 51130 — time-budget extension
// ---------------------------------------------------------------------------
/** Grant extra minutes; the plan expands proportionally. */
export function extendTimeBudget(plan, extraMinutes) {
  const extra = Math.max(0, Math.floor(Number(extraMinutes) || 0));
  const budget = (plan.timeBudgetMin || 60) + extra;
  const scale = budget / (plan.timeBudgetMin || 60);
  return {
    ...plan,
    timeBudgetMin: budget,
    expanded: extra > 0,
    perPhaseMin: Object.fromEntries(
      Object.entries(plan.perPhaseMin || {}).map(([k, v]) => [k, Math.round(v * scale)])
    ),
  };
}

// ---------------------------------------------------------------------------
// 51131 — wrap-up command
// ---------------------------------------------------------------------------
/** Condense the remaining plan into a final sweep of N minutes. */
export function wrapUp(plan, minutes) {
  const n = Math.max(1, Math.floor(Number(minutes) || 10));
  const phases = ['verify-findings', 'quick-rescan', 'report-draft'];
  return { ...plan, mode: 'wrap-up', wrapUpMinutes: n, phases, condensed: true };
}

// ---------------------------------------------------------------------------
// 51132 — natural-language steering parser
// ---------------------------------------------------------------------------
const NL_PATTERNS = [
  [/spend more time on (?:the )?(.+)/i, m => ({ type: 'boost-area', area: m[1].trim() })],
  [
    /focus (?:on )?(?:the )?(.+?) for (?:the next )?(\d+)\s*(?:min|minute)/i,
    m => ({ type: 'time-boxed-focus', area: m[1].trim(), minutes: Number(m[2]) }),
  ],
  [/go (wide|deep|quiet)/i, m => ({ type: 'preset', preset: `go-${m[1].toLowerCase()}` })],
  [/be quiet/i, () => ({ type: 'preset', preset: 'be-quiet' })],
  [/pause (?:the )?(.+)/i, m => ({ type: 'pause-module', module: m[1].trim() })],
  [/stop (?:testing )?(?:the )?(.+)/i, m => ({ type: 'remove-scope', target: m[1].trim() })],
  [/add (.+?) to scope/i, m => ({ type: 'add-scope', target: m[1].trim() })],
  [/slow down/i, () => ({ type: 'set-intensity', level: 'light' })],
  [/speed up/i, () => ({ type: 'set-intensity', level: 'aggressive' })],
  [
    /finish (?:in|within) (\d+)\s*(?:min|minute)/i,
    m => ({ type: 'wrap-up', minutes: Number(m[1]) }),
  ],
];
/** Parse a plain-sentence steering command into a structured command. */
export function parseSteeringCommand(text) {
  const input = String(text || '').trim();
  if (!input) return { type: 'unknown', raw: '' };
  for (const [re, build] of NL_PATTERNS) {
    const m = input.match(re);
    if (m) return { ...build(m), raw: input };
  }
  return { type: 'unknown', raw: input };
}

// ---------------------------------------------------------------------------
// 51133 — drag-and-drop priorities
// ---------------------------------------------------------------------------
/** Reorder a visual priority list (same math as phase reorder). */
export function reorderPriorities(priorities, fromIdx, toIdx) {
  return reorderPhases(priorities, fromIdx, toIdx);
}

// ---------------------------------------------------------------------------
// 51134 — steering presets
// ---------------------------------------------------------------------------
/** One-tap hunt reconfiguration modes. */
export function applyPreset(state, preset) {
  if (!STEERING_PRESETS.includes(preset)) return { ...state };
  const changes = {
    'go-wide': { intensity: 'light', depthLimit: 2, rateCapRps: 20, focus: 'breadth' },
    'go-deep': { intensity: 'aggressive', depthLimit: 6, rateCapRps: 60, focus: 'depth' },
    'be-quiet': {
      intensity: 'light',
      depthLimit: 2,
      rateCapRps: 5,
      stealth: true,
      focus: 'stealth',
    },
  }[preset];
  return { ...state, ...changes, activePreset: preset };
}

// ---------------------------------------------------------------------------
// 51135 — undo steering
// ---------------------------------------------------------------------------
/**
 * Revert the last steering command. History entries are
 * { command, before } snapshots; returns { state, restored }.
 */
export function undoSteering(history) {
  const log = [...(history || [])];
  const last = log.pop();
  if (!last) return { state: null, restored: false };
  return { state: { ...last.before }, restored: true, undone: last.command, history: log };
}

// ---------------------------------------------------------------------------
// 51136 — steering preview
// ---------------------------------------------------------------------------
/** Describe planned changes before a major redirection is confirmed. */
export function previewSteering(state, command) {
  const changes = [];
  if (!command || command.type === 'unknown') return { changes, empty: true };
  switch (command.type) {
    case 'set-intensity':
      changes.push(`intensity: ${state.intensity || 'normal'} → ${command.level}`);
      break;
    case 'add-scope':
      changes.push(`scope += ${command.target}`);
      break;
    case 'remove-scope':
      changes.push(`scope −= ${command.target} (in-flight tests halt gracefully)`);
      break;
    case 'preset':
      changes.push(`apply preset "${command.preset}" (intensity, depth, rate, stealth)`);
      break;
    case 'wrap-up':
      changes.push(`condense remaining plan into a ${command.minutes}-minute final sweep`);
      break;
    case 'pause-module':
      changes.push(`pause module "${command.module}" (rest of hunt continues)`);
      break;
    case 'boost-area':
      changes.push(`boost priority of area "${command.area}"`);
      break;
    case 'time-boxed-focus':
      changes.push(`focus "${command.area}" for ${command.minutes} min, then resume plan`);
      break;
    default:
      changes.push(`apply ${command.type}`);
  }
  return { changes, empty: changes.length === 0, command };
}

// ---------------------------------------------------------------------------
// 51137 — impact estimate
// ---------------------------------------------------------------------------
/** Rough +minutes / +requests estimate for a steering change. */
export function estimateImpact(state, command) {
  const base = { minutes: 0, requests: 0 };
  if (!command || command.type === 'unknown') return base;
  const perReq = { light: 1, normal: 3, aggressive: 8 }[state.intensity || 'normal'];
  switch (command.type) {
    case 'wrap-up':
      return {
        minutes: command.minutes,
        requests: command.minutes * 60 * (state.rateCapRps || 10),
      };
    case 'add-scope':
      return { minutes: 15, requests: 15 * 60 * perReq };
    case 'preset':
      return command.preset === 'go-deep'
        ? { minutes: 30, requests: 30 * 60 * 8 }
        : { minutes: 10, requests: 10 * 60 * 2 };
    case 'time-boxed-focus':
      return { minutes: command.minutes, requests: command.minutes * 60 * perReq };
    default:
      return { minutes: 5, requests: 5 * 60 * perReq };
  }
}

// ---------------------------------------------------------------------------
// 51138 — steering history log
// ---------------------------------------------------------------------------
/** Append a redirection record: who issued it and what changed. */
export function logSteering(history, entry) {
  return [
    ...(history || []),
    {
      seq: (history || []).length + 1,
      by: entry.by || 'owner',
      command: entry.command,
      summary: entry.summary || '',
    },
  ];
}

// ---------------------------------------------------------------------------
// 51139 — co-steering
// ---------------------------------------------------------------------------
/** A teammate proposes a steering change; it waits for owner approval. */
export function proposeCoSteering(proposals, proposal) {
  return [
    ...(proposals || []),
    {
      id: `cs-${(proposals || []).length + 1}`,
      by: proposal.by,
      command: proposal.command,
      status: 'pending',
    },
  ];
}
/** Approve (or deny) a pending co-steering proposal. */
export function resolveCoSteering(proposals, id, approve) {
  let applied = null;
  const next = (proposals || []).map(p => {
    if (p.id !== id || p.status !== 'pending') return p;
    applied = approve ? p.command : null;
    return { ...p, status: approve ? 'approved' : 'denied' };
  });
  return { proposals: next, applied };
}

// ---------------------------------------------------------------------------
// 51140 — saved steering templates
// ---------------------------------------------------------------------------
/** Store a redirection pattern per target type. */
export function saveTemplate(templates, name, pattern) {
  const clean = String(name || '').trim() || 'untitled';
  return { ...(templates || {}), [clean]: { ...pattern, saved: true } };
}
/** Apply a saved template to the current state. */
export function applyTemplate(state, templates, name) {
  const t = (templates || {})[name];
  if (!t) return { ...state };
  const { saved, ...rest } = t;
  return { ...state, ...rest, activeTemplate: name };
}

// ---------------------------------------------------------------------------
// 51141 — conditional steering rules
// ---------------------------------------------------------------------------
/** Add an if-then rule, e.g. "if admin panel found → go deep on it". */
export function addConditionalRule(rules, rule) {
  return [...(rules || []), { id: `rule-${(rules || []).length + 1}`, ...rule, enabled: true }];
}
/** Evaluate rules against the current hunt context; returns triggered actions. */
export function evaluateRules(rules, context) {
  return (rules || [])
    .filter(r => r.enabled)
    .filter(r => {
      if (r.when === 'finding-type' && context.findingType === r.value) return true;
      if (r.when === 'phase' && context.phase === r.value) return true;
      if (r.when === 'finding-count>=' && (context.findingCount || 0) >= Number(r.value))
        return true;
      return false;
    })
    .map(r => ({ ruleId: r.id, action: r.then }));
}

// ---------------------------------------------------------------------------
// 51142 — time-boxed focus
// ---------------------------------------------------------------------------
/** Focus an area for N minutes, then resume the plan. */
export function setTimeBoxedFocus(state, area, minutes) {
  const n = Math.max(1, Math.floor(Number(minutes) || 30));
  return {
    ...state,
    focusArea: String(area || '').trim(),
    focusMinutes: n,
    focusActive: true,
    resumeAfter: true,
  };
}

// ---------------------------------------------------------------------------
// 51143 — steer-from-finding
// ---------------------------------------------------------------------------
/** Build a redirection command from a finding card ("investigate similar"). */
export function steerFromFinding(finding) {
  if (!finding) return { type: 'unknown', raw: '' };
  return {
    type: 'boost-area',
    area: finding.area || finding.type || 'similar areas',
    fromFinding: finding.id || null,
    raw: `investigate similar areas to finding ${finding.id || ''}`.trim(),
  };
}

// ---------------------------------------------------------------------------
// 51144 — steer-from-log
// ---------------------------------------------------------------------------
/** Turn a log line into "do more of this" / "stop doing this". */
export function steerFromLog(logLine, action) {
  const line = String(logLine || '');
  const module = (line.match(/\[(\w+)\]/) || [])[1] || 'unknown';
  if (action === 'more') return { type: 'boost-area', area: module, raw: `do more of ${module}` };
  if (action === 'stop') return { type: 'pause-module', module, raw: `stop doing ${module}` };
  return { type: 'unknown', raw: line };
}

// ---------------------------------------------------------------------------
// 51145 — spoken redirection
// ---------------------------------------------------------------------------
/** Hands-free spoken commands reuse the NL parser (transcript in, command out). */
export function parseSpokenCommand(transcript) {
  const cmd = parseSteeringCommand(transcript);
  return { ...cmd, via: 'voice' };
}

// ---------------------------------------------------------------------------
// 51146 — touch priority board
// ---------------------------------------------------------------------------
/** Apply a tablet board arrangement as the new priority order. */
export function applyPriorityBoard(priorities, boardOrder) {
  const names = new Set((boardOrder || []).map(String));
  const ordered = (boardOrder || []).map(String);
  for (const p of priorities || []) {
    if (!names.has(String(p))) ordered.push(p);
  }
  return ordered;
}

// ---------------------------------------------------------------------------
// 51147 — steering API
// ---------------------------------------------------------------------------
/** Build the programmatic payload external tools POST to redirect a hunt. */
export function buildSteeringApiPayload(command, huntId) {
  return {
    huntId: String(huntId || ''),
    op: 'steer',
    command,
    version: 1,
  };
}
/** Validate an inbound steering API payload. */
export function validateSteeringApiPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'not-an-object' };
  if (payload.op !== 'steer') return { ok: false, error: 'bad-op' };
  if (!payload.huntId) return { ok: false, error: 'missing-huntId' };
  if (!payload.command || payload.command.type === 'unknown')
    return { ok: false, error: 'bad-command' };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 51148 — steer while paused
// ---------------------------------------------------------------------------
/** Rearrange the plan during a pause; it resumes with the new strategy. */
export function applyWhilePaused(plan, changes) {
  return { ...plan, ...changes, paused: true, resumeWithNewStrategy: true };
}

// ---------------------------------------------------------------------------
// 51149 — big-change approval
// ---------------------------------------------------------------------------
const BIG_CHANGE_TYPES = new Set(['remove-scope', 'wrap-up', 'preset']);
/** Major redirections require explicit confirmation before the agent acts. */
export function needsApproval(command) {
  if (!command) return false;
  if (BIG_CHANGE_TYPES.has(command.type)) return true;
  if (command.type === 'set-intensity' && command.level === 'aggressive') return true;
  return false;
}

// ---------------------------------------------------------------------------
// 51150 — agent pushback
// ---------------------------------------------------------------------------
/**
 * The agent warns when a steering command risks missing better leads.
 * Returns a warning string or null.
 */
export function agentPushback(state, command) {
  if (!command || command.type === 'unknown') return null;
  if (command.type === 'remove-scope' && (state.findingCount || 0) > 0) {
    return `Heads up: ${command.target} produced ${state.findingCount} finding(s) — removing it may miss follow-ups.`;
  }
  if (command.type === 'set-intensity' && command.level === 'light' && state.phase === 'fuzzing') {
    return 'Heads up: dropping to light intensity during fuzzing usually finds less.';
  }
  if (command.type === 'wrap-up' && (state.coveragePct || 0) < 50) {
    return `Heads up: coverage is only ${state.coveragePct || 0}% — wrapping up now leaves half the target untested.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 51151 — agent steering suggestions
// ---------------------------------------------------------------------------
/** The agent proposes redirections based on what it is seeing. */
export function suggestSteering(state) {
  const out = [];
  if ((state.findingCount || 0) >= 3 && state.intensity !== 'aggressive') {
    out.push({
      type: 'set-intensity',
      level: 'aggressive',
      reason: 'multiple findings — dig deeper',
      raw: 'agent suggestion: go aggressive',
    });
  }
  if ((state.noiseComplaints || 0) >= 2) {
    out.push({
      type: 'preset',
      preset: 'be-quiet',
      reason: 'noise complaints — go quiet',
      raw: 'agent suggestion: be quiet',
    });
  }
  if (state.idleMinutes >= 20) {
    out.push({
      type: 'boost-area',
      area: 'unscanned areas',
      reason: 'hunt gone cold — widen coverage',
      raw: 'agent suggestion: go wide',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 51152 — bandwidth steering
// ---------------------------------------------------------------------------
/** Cap total requests (or bandwidth) for the remainder of the hunt. */
export function setBandwidthCap(state, maxRequests) {
  const cap = Math.max(100, Math.floor(Number(maxRequests) || 10000));
  return { ...state, bandwidthCap: cap, requestsUsed: state.requestsUsed || 0 };
}
/** Remaining request budget under the cap. */
export function bandwidthRemaining(state) {
  if (!state.bandwidthCap) return null;
  return Math.max(0, state.bandwidthCap - (state.requestsUsed || 0));
}

// ---------------------------------------------------------------------------
// 51153 — stealth steering
// ---------------------------------------------------------------------------
/** Switch to low-noise mode mid-run without losing progress. */
export function setStealthMode(state, on) {
  if (!on) return { ...state, stealth: false };
  return {
    ...state,
    stealth: true,
    intensity: 'light',
    rateCapRps: Math.min(state.rateCapRps || 10, 5),
  };
}

// ---------------------------------------------------------------------------
// 51154 — depth limiter
// ---------------------------------------------------------------------------
/** Set how many levels deep crawling/chaining may go from now on. */
export function setDepthLimit(state, levels) {
  const n = Math.max(0, Math.min(10, Math.floor(Number(levels) || 3)));
  return { ...state, depthLimit: n };
}

// ---------------------------------------------------------------------------
// 51155 — retest-on-change
// ---------------------------------------------------------------------------
/** When the target changes mid-hunt, list affected areas for re-testing. */
export function retestOnChange(state, changedPaths) {
  const changed = (changedPaths || []).map(String);
  const affected = (state.testedPaths || []).filter(p =>
    changed.some(c => String(p).startsWith(c) || c.startsWith(String(p)))
  );
  return { retest: [...new Set(affected)], changed };
}

// ---------------------------------------------------------------------------
// 51156 — steering dry-run
// ---------------------------------------------------------------------------
/** Simulate a redirection to preview its effect before applying. */
export function dryRun(state, command) {
  const preview = previewSteering(state, command);
  const impact = estimateImpact(state, command);
  const pushback = agentPushback(state, command);
  return {
    command,
    wouldChange: preview.changes,
    estimatedImpact: impact,
    pushback,
    approvalRequired: needsApproval(command),
    simulated: true,
  };
}

// ---------------------------------------------------------------------------
// 51157 — priority inheritance (mid-hunt)
// ---------------------------------------------------------------------------
/** Boosted priorities automatically apply to newly discovered in-scope assets. */
export function inheritPriority(state, newAsset) {
  const boosts = state.boostedAreas || [];
  const asset = String(newAsset || '');
  const inherited = boosts.some(b => asset.includes(String(b)) || String(b).includes(asset));
  return { asset, boosted: inherited, priority: inherited ? 'high' : 'normal' };
}

// ---------------------------------------------------------------------------
// 51158 — steering cooldown
// ---------------------------------------------------------------------------
/** Optional lockout preventing conflicting redirections within a window. */
export function setCooldown(state, seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return { ...state, cooldownSec: s, cooldownUntil: s > 0 ? (state.now || 0) + s * 1000 : 0 };
}
/** Is steering currently locked by the cooldown? */
export function cooldownActive(state, nowMs) {
  if (!state.cooldownUntil) return false;
  return Number(nowMs) < state.cooldownUntil;
}

// ---------------------------------------------------------------------------
// 51159 — module enable/disable live
// ---------------------------------------------------------------------------
/** Toggle individual testing modules on/off without restarting. */
export function toggleModule(modules, name, on) {
  return (modules || []).map(m => (m.name === name ? { ...m, enabled: on !== false } : m));
}

// ---------------------------------------------------------------------------
// 51160 — focus window
// ---------------------------------------------------------------------------
/** Define a URL pattern; the agent spends a fixed share of effort inside it. */
export function setFocusWindow(state, pattern, sharePct) {
  const share = Math.max(5, Math.min(95, Math.floor(Number(sharePct) || 50)));
  return {
    ...state,
    focusWindow: { pattern: String(pattern || ''), sharePct: share, active: true },
  };
}
/** Split effort between inside/outside the focus window. */
export function focusSplit(state) {
  const w = state.focusWindow;
  if (!w || !w.active) return { inside: 100, outside: 0, unfocused: true };
  return { inside: w.sharePct, outside: 100 - w.sharePct, pattern: w.pattern };
}
