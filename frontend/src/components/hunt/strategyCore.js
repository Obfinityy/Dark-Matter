/**
 * strategyCore.js — wave 34, part 2 (ideas 51341–51360): live strategy
 * suite — pure logic.
 *
 * Breadth↔depth switching, named strategy presets, side-by-side strategy
 * comparison, impact forecasting, a custom strategy builder, strategy
 * versioning + rollback, A/B strategy testing, live strategy suggestions,
 * scheduled strategy shifts, per-asset strategies, strategy effort heatmaps,
 * rationale logging, industry-tuned templates, import/export, dry-runs,
 * strategy confidence scoring, auto-strategy mode with bounds, guardrails,
 * and strategy change alerts.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic: time always arrives as an explicit `now`
 * argument (ms epoch), never Date.now(); no Math.random.
 */

export const WAVE34B_START = 51341;
export const WAVE34B_END = 51360;

/** Registry of the 20 live-strategy ideas — completeness is testable. */
export const WAVE34B_IDEAS = [
  [
    51341,
    'breadth-to-depth switch',
    'One control that shifts the agent from wide coverage to deep dives',
  ],
  [
    51342,
    'depth-to-breadth switch',
    'The reverse: pull back from deep testing to cover more surface',
  ],
  [51343, 'strategy presets', 'Named strategies like "API-first" or "auth-focused" applied live'],
  [51344, 'strategy comparison', 'See the current strategy side by side with the proposed one'],
  [51345, 'strategy impact forecast', 'Estimated time and coverage change before you commit'],
  [
    51346,
    'custom strategy builder',
    'Compose phase mixes with sliders and save as your own preset',
  ],
  [51347, 'strategy versioning', 'Every strategy change versioned so you can roll back'],
  [51348, 'A/B strategy testing', 'Run two strategies on mirrored scope and compare finding yield'],
  [51349, 'strategy suggestions', 'The agent recommends strategy shifts based on live results'],
  [51350, 'scheduled strategy shifts', '"Go deep on auth after recon completes" queued in advance'],
  [
    51351,
    'strategy per asset',
    'Different strategies for different in-scope assets simultaneously',
  ],
  [51352, 'strategy heatmap', 'Visual map of where effort is going under the current strategy'],
  [51353, 'strategy rationale log', "Why each strategy change was made, in the agent's own words"],
  [
    51354,
    'strategy templates by industry',
    'Prebuilt strategies tuned for fintech, health, SaaS, and more',
  ],
  [51355, 'strategy import/export', 'Share strategies with teammates or the community as files'],
  [51356, 'strategy dry-run', 'Preview a strategy change against remaining scope before applying'],
  [
    51357,
    'strategy confidence',
    'The agent rates how well the current strategy fits what it is discovering',
  ],
  [51358, 'auto-strategy mode', 'Let the agent shift strategies on its own within bounds you set'],
  [51359, 'strategy guardrails', 'Limits on what auto-strategy may change without asking'],
  [
    51360,
    'strategy change alerts',
    'Notified whenever the strategy shifts, manually or automatically',
  ],
];

/**
 * Strategy shape: { name, allocation: { <phaseId>: 0-100 weight }, focus }
 * Weights are expected to sum to 100; normalizeStrategy enforces that.
 */
export function normalizeStrategy(strategy) {
  const alloc = { ...(strategy.allocation || {}) };
  const total = Object.values(alloc).reduce((s, v) => s + v, 0);
  if (total <= 0) return { ...strategy, allocation: alloc };
  const out = {};
  for (const [k, v] of Object.entries(alloc)) out[k] = Math.round((v / total) * 100);
  // Fix rounding drift so the weights sum to exactly 100.
  const drift = 100 - Object.values(out).reduce((s, v) => s + v, 0);
  const firstKey = Object.keys(out)[0];
  if (firstKey && drift !== 0) out[firstKey] += drift;
  return { ...strategy, allocation: out };
}

// --- 51341 / 51342 breadth ↔ depth switches --------------------------------

/** Phases considered "breadth" (coverage) vs "depth" (deep dives). */
export const BREADTH_PHASES = ['recon', 'surface-map', 'tech-fingerprint'];
export const DEPTH_PHASES = ['auth-deep', 'business-logic', 'exploit-chain'];

function reweight(allocation, breadthScale, depthScale) {
  const out = { ...(allocation || {}) };
  for (const p of BREADTH_PHASES)
    if (out[p] != null) out[p] = Math.max(0, Math.round(out[p] * breadthScale));
  for (const p of DEPTH_PHASES)
    if (out[p] != null) out[p] = Math.max(0, Math.round(out[p] * depthScale));
  return out;
}

/** 51341: shift effort from wide coverage into deep dives. */
export function shiftBreadthToDepth(strategy) {
  return normalizeStrategy({
    ...strategy,
    name: `${strategy.name} → depth`,
    focus: 'depth',
    allocation: reweight(strategy.allocation, 0.5, 1.8),
  });
}

/** 51342: shift effort from deep dives back into wide coverage. */
export function shiftDepthToBreadth(strategy) {
  return normalizeStrategy({
    ...strategy,
    name: `${strategy.name} → breadth`,
    focus: 'breadth',
    allocation: reweight(strategy.allocation, 1.8, 0.5),
  });
}

// --- 51343 strategy presets --------------------------------------------------

export const STRATEGY_PRESETS = [
  {
    name: 'Balanced',
    focus: 'balanced',
    allocation: {
      recon: 20,
      'surface-map': 15,
      'tech-fingerprint': 10,
      'auth-deep': 20,
      'business-logic': 20,
      'exploit-chain': 15,
    },
  },
  {
    name: 'API-first',
    focus: 'depth',
    allocation: {
      recon: 10,
      'surface-map': 10,
      'tech-fingerprint': 15,
      'auth-deep': 25,
      'business-logic': 25,
      'exploit-chain': 15,
    },
  },
  {
    name: 'Auth-focused',
    focus: 'depth',
    allocation: {
      recon: 10,
      'surface-map': 5,
      'tech-fingerprint': 10,
      'auth-deep': 40,
      'business-logic': 25,
      'exploit-chain': 10,
    },
  },
  {
    name: 'Recon-wide',
    focus: 'breadth',
    allocation: {
      recon: 35,
      'surface-map': 30,
      'tech-fingerprint': 20,
      'auth-deep': 5,
      'business-logic': 5,
      'exploit-chain': 5,
    },
  },
  {
    name: 'Logic-heavy',
    focus: 'depth',
    allocation: {
      recon: 10,
      'surface-map': 10,
      'tech-fingerprint': 10,
      'auth-deep': 15,
      'business-logic': 40,
      'exploit-chain': 15,
    },
  },
];

/** Apply a named preset live; returns the normalized strategy. */
export function applyPreset(presetName) {
  const p = STRATEGY_PRESETS.find(s => s.name === presetName);
  if (!p) return null;
  return normalizeStrategy({ name: p.name, focus: p.focus, allocation: { ...p.allocation } });
}

// --- 51344 strategy comparison -------------------------------------------------

/**
 * Side-by-side diff of two strategies: per-phase weight changes plus
 * focus/name changes. Rows: { phase, current, proposed, delta }.
 */
export function compareStrategies(current, proposed) {
  const c = (current && current.allocation) || {};
  const p = (proposed && proposed.allocation) || {};
  const phases = [...new Set([...Object.keys(c), ...Object.keys(p)])].sort();
  const rows = phases.map(phase => ({
    phase,
    current: c[phase] || 0,
    proposed: p[phase] || 0,
    delta: (p[phase] || 0) - (c[phase] || 0),
  }));
  return {
    rows,
    focusChanged: (current && current.focus) !== (proposed && proposed.focus),
    nameChanged: (current && current.name) !== (proposed && proposed.name),
    biggestShift: rows.reduce((m, r) => (Math.abs(r.delta) > Math.abs(m.delta) ? r : m), {
      delta: 0,
      phase: null,
    }),
  };
}

// --- 51345 strategy impact forecast ----------------------------------------------

/**
 * Forecast the impact of switching strategies against remaining scope:
 * estimated hours and coverage change. Coverage model: breadth phases
 * contribute coverage per hour, depth phases contribute finding yield.
 */
export function forecastImpact(current, proposed, remainingScope) {
  const scope = remainingScope || {};
  const estHours = alloc => {
    const breadth = BREADTH_PHASES.reduce((s, p) => s + (alloc[p] || 0), 0) / 100;
    const depth = DEPTH_PHASES.reduce((s, p) => s + (alloc[p] || 0), 0) / 100;
    return (scope.endpoints || 0) * breadth * 0.05 + (scope.endpoints || 0) * depth * 0.12;
  };
  const coverageOf = alloc => {
    const breadth = BREADTH_PHASES.reduce((s, p) => s + (alloc[p] || 0), 0);
    return Math.min(100, Math.round(breadth * 1.2));
  };
  const from = estHours((current && current.allocation) || {});
  const to = estHours((proposed && proposed.allocation) || {});
  return {
    hoursCurrent: Math.round(from * 10) / 10,
    hoursProposed: Math.round(to * 10) / 10,
    hoursDelta: Math.round((to - from) * 10) / 10,
    coverageCurrent: coverageOf((current && current.allocation) || {}),
    coverageProposed: coverageOf((proposed && proposed.allocation) || {}),
  };
}

// --- 51346 custom strategy builder -------------------------------------------------

/**
 * Build a custom strategy from phase-mix sliders. Weights must sum to 100
 * (±1 tolerance); returns { ok, strategy, errors }.
 */
export function buildStrategy(name, phaseMix) {
  const errors = [];
  if (!name || !String(name).trim()) errors.push('name is required');
  const mix = { ...(phaseMix || {}) };
  const phases = Object.keys(mix);
  if (phases.length === 0) errors.push('at least one phase is required');
  const total = phases.reduce((s, p) => s + (Number(mix[p]) || 0), 0);
  if (Math.abs(total - 100) > 1) errors.push(`weights must sum to 100 (got ${total})`);
  for (const p of phases) {
    if (Number(mix[p]) < 0 || Number(mix[p]) > 100) errors.push(`weight for ${p} out of range`);
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    strategy: normalizeStrategy({ name: String(name).trim(), focus: 'custom', allocation: mix }),
  };
}

// --- 51347 strategy versioning -------------------------------------------------------

/**
 * Versioned strategy history. `history` is an array of { version, at,
 * strategy, note }; commitStrategy appends v+1. rollbackStrategy returns the
 * strategy stored at `version` (or null).
 */
export function commitStrategy(history, strategy, note, now) {
  const h = [...(history || [])];
  const version = h.length ? h[h.length - 1].version + 1 : 1;
  h.push({ version, at: now, strategy: JSON.parse(JSON.stringify(strategy)), note: note || '' });
  return h;
}

export function rollbackStrategy(history, version) {
  const entry = (history || []).find(e => e.version === version);
  return entry ? JSON.parse(JSON.stringify(entry.strategy)) : null;
}

export function strategyHistoryList(history) {
  return (history || []).map(e => ({
    version: e.version,
    at: e.at,
    name: e.strategy.name,
    note: e.note,
  }));
}

// --- 51348 A/B strategy testing ---------------------------------------------------------

/**
 * Plan an A/B test: split mirrored scope (two halves with matched endpoint
 * counts) between strategy A and B. `abResult` compares finding yield.
 */
export function abTestPlan(strategyA, strategyB, scope) {
  const endpoints = (scope && scope.endpoints) || 0;
  const half = Math.floor(endpoints / 2);
  return {
    armA: { strategy: strategyA.name, endpoints: half },
    armB: { strategy: strategyB.name, endpoints: endpoints - half },
  };
}

export function abResult(yieldA, yieldB) {
  const a = Number(yieldA) || 0;
  const b = Number(yieldB) || 0;
  const winner = a === b ? 'tie' : a > b ? 'A' : 'B';
  return { yieldA: a, yieldB: b, winner, delta: Math.abs(a - b) };
}

// --- 51349 strategy suggestions -----------------------------------------------------------

/**
 * Recommend a strategy shift from live hunt stats:
 * { findingsPerHour, coveragePct, authFindings, breadthHours, depthHours }.
 * Returns { suggestion, preset, rationale } or { suggestion: 'hold' }.
 */
export function suggestStrategyShift(stats) {
  const s = stats || {};
  if ((s.coveragePct || 0) < 40 && (s.breadthHours || 0) < (s.depthHours || 0)) {
    return {
      suggestion: 'shift',
      preset: 'Recon-wide',
      rationale: 'Coverage below 40% while depth dominates — widen first.',
    };
  }
  if ((s.findingsPerHour || 0) < 0.5 && (s.coveragePct || 0) >= 60) {
    return {
      suggestion: 'shift',
      preset: 'Auth-focused',
      rationale: 'Surface covered but yield is thin — go deep on auth.',
    };
  }
  if ((s.authFindings || 0) >= 3 && (s.findingsPerHour || 0) >= 1) {
    return {
      suggestion: 'shift',
      preset: 'Logic-heavy',
      rationale: 'Auth is fruitful and yield is strong — double down on business logic.',
    };
  }
  return {
    suggestion: 'hold',
    preset: null,
    rationale: 'Current strategy matches live results — no shift recommended.',
  };
}

// --- 51350 scheduled strategy shifts -----------------------------------------------------------

/**
 * Queue strategy shifts for later: { id, when: 'phase-complete:<phaseId>' |
 * 'at:<epochMs>', apply: strategyName }. `shiftsDue` returns due shifts
 * given the current hunt state { completedPhases, now }.
 */
export function scheduleShift(shifts, shift) {
  const s = [...(shifts || [])];
  s.push({ ...shift, id: shift.id || `shift-${s.length + 1}`, status: 'scheduled' });
  return s;
}

export function shiftsDue(shifts, huntState) {
  const state = huntState || {};
  return (shifts || []).filter(s => {
    if (s.status !== 'scheduled') return false;
    if (String(s.when).startsWith('phase-complete:')) {
      const phase = String(s.when).slice('phase-complete:'.length);
      return (state.completedPhases || []).includes(phase);
    }
    if (String(s.when).startsWith('at:')) {
      return (state.now || 0) >= Number(String(s.when).slice(3));
    }
    return false;
  });
}

// --- 51351 strategy per asset ---------------------------------------------------------------------

/**
 * Different strategies for different in-scope assets simultaneously.
 * assignments: [{ asset, strategyName }]; unknown assets fall back to the
 * default strategy.
 */
export function perAssetStrategy(assets, assignments, defaultStrategy) {
  const map = {};
  for (const a of assignments || []) map[a.asset] = a.strategyName;
  return (assets || []).map(asset => ({
    asset,
    strategy: map[asset] || (defaultStrategy && defaultStrategy.name) || 'Balanced',
  }));
}

// --- 51352 strategy heatmap ----------------------------------------------------------------------------

/**
 * Effort heatmap rows for display: [{ phase, weight, intensity }] where
 * intensity is one of 'none' | 'low' | 'medium' | 'high'.
 */
export function strategyHeatmap(strategy) {
  const alloc = (strategy && strategy.allocation) || {};
  return Object.keys(alloc)
    .sort()
    .map(phase => {
      const w = alloc[phase];
      const intensity = w <= 0 ? 'none' : w < 15 ? 'low' : w < 30 ? 'medium' : 'high';
      return { phase, weight: w, intensity };
    });
}

// --- 51353 strategy rationale log ------------------------------------------------------------------------------

/** Append a rationale entry: why the strategy changed, in the agent's words. */
export function logRationale(log, change, rationale, now) {
  const l = [...(log || [])];
  l.push({ at: now, change, rationale: String(rationale || '').slice(0, 1000) });
  return l;
}

// --- 51354 strategy templates by industry ---------------------------------------------------------------------------

export const INDUSTRY_TEMPLATES = {
  fintech: {
    name: 'Fintech',
    focus: 'depth',
    note: 'Auth + business-logic heavy: money movement, RBAC, rate limits',
    strategy: 'Auth-focused',
  },
  health: {
    name: 'Health',
    focus: 'depth',
    note: 'PHI exposure, access controls, audit trails',
    strategy: 'Auth-focused',
  },
  saas: {
    name: 'SaaS',
    focus: 'balanced',
    note: 'Multi-tenant isolation, API abuse, subscription logic',
    strategy: 'Balanced',
  },
  retail: {
    name: 'Retail',
    focus: 'balanced',
    note: 'Checkout flows, promos, inventory APIs',
    strategy: 'API-first',
  },
  gov: {
    name: 'Government',
    focus: 'breadth',
    note: 'Wide surface coverage, legacy endpoints',
    strategy: 'Recon-wide',
  },
};

/** Resolve an industry template to a concrete preset strategy. */
export function industryTemplate(industry) {
  const t = INDUSTRY_TEMPLATES[String(industry || '').toLowerCase()];
  if (!t) return null;
  const strategy = applyPreset(t.strategy);
  return { ...t, strategy };
}

// --- 51355 strategy import/export -------------------------------------------------------------------------------------

export function exportStrategy(strategy) {
  return JSON.stringify({ format: 'dark-matter-strategy', version: 1, strategy }, null, 2);
}

/**
 * Import a strategy file: validates format + allocation, returns
 * { ok, strategy, errors }.
 */
export function importStrategy(jsonText) {
  const errors = [];
  let parsed = null;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    errors.push('not valid JSON');
    return { ok: false, errors };
  }
  if (!parsed || parsed.format !== 'dark-matter-strategy')
    errors.push('not a dark-matter strategy file');
  const s = parsed && parsed.strategy;
  if (!s || typeof s.name !== 'string' || typeof s.allocation !== 'object')
    errors.push('strategy missing name/allocation');
  else {
    const total = Object.values(s.allocation).reduce((sum, v) => sum + (Number(v) || 0), 0);
    if (Math.abs(total - 100) > 2)
      errors.push(`allocation must sum to ~100 (got ${Math.round(total)})`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, strategy: normalizeStrategy(s) };
}

// --- 51356 strategy dry-run ------------------------------------------------------------------------------------------------

/**
 * Preview a strategy change against remaining scope before applying:
 * reuses the forecast math and adds a plain-language verdict.
 */
export function dryRun(current, proposed, remainingScope) {
  const f = forecastImpact(current, proposed, remainingScope);
  const coverageDelta = f.coverageProposed - f.coverageCurrent;
  const verdict =
    coverageDelta > 0 && f.hoursDelta <= 2
      ? 'worth it'
      : coverageDelta > 0
        ? 'more coverage, more time'
        : f.hoursDelta < 0
          ? 'faster, less coverage'
          : 'roughly equivalent';
  return { ...f, coverageDelta, verdict };
}

// --- 51357 strategy confidence ----------------------------------------------------------------------------------------------------

/**
 * How well the current strategy fits what the hunt is discovering (0–100):
 * rewards finding yield under depth focus and coverage progress under
 * breadth focus; penalizes mismatch.
 */
export function strategyConfidence(strategy, discoveries) {
  const d = discoveries || {};
  const alloc = (strategy && strategy.allocation) || {};
  const breadthW = BREADTH_PHASES.reduce((s, p) => s + (alloc[p] || 0), 0) / 100;
  const depthW = DEPTH_PHASES.reduce((s, p) => s + (alloc[p] || 0), 0) / 100;
  const coverage = Math.min(1, (d.coveragePct || 0) / 100);
  const yieldRate = Math.min(1, (d.findingsPerHour || 0) / 3);
  let score = 50;
  score += breadthW * coverage * 40;
  score += depthW * yieldRate * 40;
  score -= breadthW * (1 - coverage) * 10 + depthW * (1 - yieldRate) * 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// --- 51358 auto-strategy mode -----------------------------------------------------------------------------------------------------------------

/**
 * Auto-strategy bounds: which axes the agent may shift on its own.
 * { allowBreadthDepth: bool, allowPresetChange: bool, maxShiftPct }
 */
export function autoStrategyBounds(overrides) {
  return {
    allowBreadthDepth: true,
    allowPresetChange: false,
    maxShiftPct: 30,
    ...(overrides || {}),
  };
}

/**
 * Is an automatic shift allowed? change: { kind: 'breadth-depth' |
 * 'preset', shiftPct }.
 */
export function autoShiftAllowed(bounds, change) {
  const b = bounds || autoStrategyBounds();
  if (change.kind === 'preset' && !b.allowPresetChange)
    return { allowed: false, reason: 'preset changes need approval' };
  if (change.kind === 'breadth-depth' && !b.allowBreadthDepth)
    return { allowed: false, reason: 'breadth/depth shifts disabled' };
  if ((change.shiftPct || 0) > b.maxShiftPct)
    return { allowed: false, reason: `shift ${change.shiftPct}% exceeds max ${b.maxShiftPct}%` };
  return { allowed: true, reason: 'within auto bounds' };
}

// --- 51359 strategy guardrails ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Guardrails: hard limits auto-strategy may not cross without asking.
 * Each rail: { id, check(change, current) → violation string | null } is
 * expressed as data: { id, kind, limit }.
 */
export function checkGuardrails(change, guardrails) {
  const violations = [];
  for (const g of guardrails || []) {
    if (g.kind === 'min-breadth' && change.kind === 'breadth-depth') {
      const newBreadth = change.newBreadthPct || 0;
      if (newBreadth < g.limit)
        violations.push(`${g.id}: breadth would drop to ${newBreadth}% (min ${g.limit}%)`);
    }
    if (g.kind === 'forbid-phase' && change.removedPhases) {
      const hit = (change.removedPhases || []).filter(p => (g.phases || []).includes(p));
      if (hit.length) violations.push(`${g.id}: auto may not drop ${hit.join(', ')}`);
    }
    if (g.kind === 'max-shift' && (change.shiftPct || 0) > g.limit) {
      violations.push(`${g.id}: shift ${change.shiftPct}% exceeds ${g.limit}%`);
    }
  }
  return violations;
}

// --- 51360 strategy change alerts -----------------------------------------------------------------------------------------------------------------------------------------------

/**
 * Build alert payloads for watchers when the strategy shifts.
 * Returns [{ to, channel, subject, body }].
 */
export function strategyAlert(change, watchers, now) {
  const ws = watchers || [];
  const summary = `${change.from || '?'} → ${change.to || '?'}`;
  return ws.map(w => ({
    to: w.id,
    channel: w.channel || 'board',
    subject: `Strategy changed: ${summary}`,
    body: `${summary}${change.reason ? ` — ${change.reason}` : ''} (at ${now})`,
    at: now,
  }));
}
