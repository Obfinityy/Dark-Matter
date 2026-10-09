/**
 * Wave 108A — Risk-score presentation, tuning and prediction (ideas 54281-54290).
 *
 * Pure JS core logic for score badges, sortable score columns, score jump
 * alerts, score history, what-if simulation, scoring-model versioning, custom
 * factor weights, per-client scoring profiles and bounty-likelihood prediction
 * in Dark Matter / Hunt AI.
 *
 * No JSX and no side effects outside the two small module-level registries
 * (scoring model versions, client scoring profiles) — every other export is a
 * deterministic pure function testable with plain objects.
 * Branding: Infinity AI / Dark Matter / Obfinity.
 */

export const WAVE108_A_IDEAS = [
  { id: 54281, title: 'Score jump alerts', summary: 'Notifies owners when a target score moves more than a set delta in either direction.' },
  { id: 54282, title: 'Score in list columns', summary: 'Adds sortable risk-score columns to table views and dashboard cards.' },
  { id: 54283, title: 'Score badges', summary: 'Renders color-coded Critical/High/Medium/Low badges from score bands.' },
  { id: 54284, title: 'Score history log', summary: 'Keeps an auditable record of every score recomputation with an inputs snapshot.' },
  { id: 54285, title: 'What-if score simulator', summary: 'Previews how adding scope, fixing headers, or archiving subdomains would move the score.' },
  { id: 54286, title: 'Scoring model versioning', summary: 'Versions the scoring formula so historical scores stay comparable after updates.' },
  { id: 54287, title: 'Scoring changelog', summary: 'Documents what changed in each model version in plain language.' },
  { id: 54288, title: 'Custom scoring weights', summary: 'Lets teams tune factor weights per group or client to match their threat model.' },
  { id: 54289, title: 'Per-client scoring profiles', summary: 'Saves named weight presets for different clients\' risk appetites.' },
  { id: 54290, title: 'Bounty likelihood predictor', summary: 'Estimates probability of a valid finding per target from portfolio patterns.' },
];

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/** Clamps a numeric score into the 0-100 range. */
export function clampScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/** Deep-copies a JSON-compatible value so snapshots cannot be mutated later. */
export function snapshotValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/* ------------------------------------------------------------------ */
/* 54283 — Score badges (band definitions + CSS class mapping)          */
/* ------------------------------------------------------------------ */

export const SCORE_BANDS = [
  { band: 'critical', min: 90, max: 100, label: 'Critical' },
  { band: 'high', min: 70, max: 89, label: 'High' },
  { band: 'medium', min: 40, max: 69, label: 'Medium' },
  { band: 'low', min: 0, max: 39, label: 'Low' },
];

/**
 * Maps a 0-100 risk score to its band.
 * Boundaries: critical >= 90, high >= 70, medium >= 40, else low.
 * Scores are clamped first; non-numeric input maps to 'low'.
 */
export function scoreBand(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 'low';
  const s = clampScore(n);
  if (s >= 90) return 'critical';
  if (s >= 70) return 'high';
  if (s >= 40) return 'medium';
  return 'low';
}

const SCORE_BADGE_CLASSES = {
  critical: 'wave108-badge wave108-badge-critical',
  high: 'wave108-badge wave108-badge-high',
  medium: 'wave108-badge wave108-badge-medium',
  low: 'wave108-badge wave108-badge-low',
};

/** Returns the full CSS class string for a badge band (with safe fallback). */
export function badgeClass(band) {
  return SCORE_BADGE_CLASSES[band] || 'wave108-badge wave108-badge-unknown';
}

/** Human label for a band, e.g. scoreBandLabel('high') -> 'High'. */
export function scoreBandLabel(band) {
  const found = SCORE_BANDS.find((b) => b.band === band);
  return found ? found.label : 'Unknown';
}

/* ------------------------------------------------------------------ */
/* 54282 — Score in list columns (sortable risk-score columns)         */
/* ------------------------------------------------------------------ */

/**
 * Returns a NEW array sorted by the numeric score key. Never mutates input.
 * Stable: equal scores keep their original relative order.
 * Missing or non-numeric values sort as 0.
 * @param {Array} list
 * @param {string} key score field name, default 'score'
 * @param {'asc'|'desc'} dir default 'desc'
 */
export function sortTargetsByScore(list, key = 'score', dir = 'desc') {
  if (dir !== 'asc' && dir !== 'desc') throw new Error(`invalid direction: ${dir}`);
  const indexed = (Array.isArray(list) ? list : []).map((item, index) => ({ item, index }));
  indexed.sort((a, b) => {
    const av = Number(a.item && a.item[key]);
    const bv = Number(b.item && b.item[key]);
    const an = Number.isFinite(av) ? av : 0;
    const bn = Number.isFinite(bv) ? bv : 0;
    const diff = dir === 'asc' ? an - bn : bn - an;
    if (diff !== 0) return diff;
    return a.index - b.index;
  });
  return indexed.map((entry) => entry.item);
}

/* ------------------------------------------------------------------ */
/* 54281 — Score jump alerts                                           */
/* ------------------------------------------------------------------ */

/**
 * Detects whether a score moved more than the threshold between two readings.
 * Returns a jump alert object, or null when the move is within the threshold.
 * "More than" is strict: a move exactly equal to the threshold is not a jump.
 *
 * @param {number} prevScore
 * @param {number} nextScore
 * @param {number} deltaThreshold minimum absolute move that counts as a jump
 * @param {string} [now] ISO timestamp override for tests
 */
export function detectScoreJump(prevScore, nextScore, deltaThreshold = 10, now = new Date().toISOString()) {
  const prev = Number(prevScore);
  const next = Number(nextScore);
  const threshold = Number(deltaThreshold);
  if (!Number.isFinite(prev) || !Number.isFinite(next)) {
    throw new Error('prevScore and nextScore must be numbers');
  }
  if (!Number.isFinite(threshold) || threshold < 0) throw new Error('deltaThreshold must be a non-negative number');
  const signedDelta = next - prev;
  const magnitude = Math.abs(signedDelta);
  if (magnitude <= threshold) return null;
  return {
    jumped: true,
    previous: prev,
    current: next,
    signedDelta: Math.round(signedDelta * 100) / 100,
    magnitude: Math.round(magnitude * 100) / 100,
    direction: signedDelta > 0 ? 'up' : 'down',
    threshold,
    bandShift: scoreBand(prev) !== scoreBand(next),
    previousBand: scoreBand(prev),
    currentBand: scoreBand(next),
    detectedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* 54284 — Score history log                                           */
/* ------------------------------------------------------------------ */

/**
 * Appends a score-recomputation record to the history log and returns it.
 * Inputs are deep-snapshotted so later mutation cannot rewrite the audit trail.
 *
 * @param {Array} log mutable history array
 * @param {{targetId:string, score:number, version?:string|null, inputs?:object, reason?:string|null, now?:string}} entry
 */
export function appendScoreHistory(log, { targetId, score, version = null, inputs = {}, reason = null, now = new Date().toISOString() }) {
  if (!targetId || typeof targetId !== 'string') throw new Error('targetId is required');
  const n = Number(score);
  if (!Number.isFinite(n)) throw new Error('score must be a number');
  const record = {
    id: `scorehist:${targetId}:${log.length + 1}`,
    targetId,
    score: clampScore(n),
    band: scoreBand(n),
    version,
    inputsSnapshot: snapshotValue(inputs || {}),
    reason,
    recordedAt: now,
  };
  log.push(record);
  return record;
}

/* ------------------------------------------------------------------ */
/* 54285 — What-if score simulator                                     */
/* ------------------------------------------------------------------ */

/** Named change presets with their score delta in risk points (negative = safer). */
export const WHAT_IF_PRESETS = {
  'add-scope': { label: 'Add scope (more attack surface)', delta: 6 },
  'fix-headers': { label: 'Fix missing security headers', delta: -4 },
  'archive-subdomains': { label: 'Archive stale subdomains', delta: -5 },
  'enable-waf': { label: 'Enable WAF rule set', delta: -7 },
  'patch-critical': { label: 'Patch critical CVE', delta: -10 },
  'expose-admin': { label: 'Expose admin panel publicly', delta: 12 },
  'open-registration': { label: 'Open self-registration', delta: 5 },
  'remove-debug': { label: 'Remove debug endpoints', delta: -6 },
};

function normalizeWhatIfChange(change) {
  if (typeof change === 'string') {
    const preset = WHAT_IF_PRESETS[change];
    if (!preset) throw new Error(`unknown what-if preset: ${change}`);
    return { id: change, label: preset.label, delta: preset.delta };
  }
  if (!change || typeof change !== 'object') throw new Error('change must be a preset id or {label, delta}');
  if (!change.label || typeof change.label !== 'string') throw new Error('change.label is required');
  const delta = Number(change.delta);
  if (!Number.isFinite(delta)) throw new Error('change.delta must be a number');
  return { id: change.id || null, label: change.label, delta };
}

/**
 * Simulates how a set of changes would move a target's risk score.
 * Accepts preset ids ('fix-headers') or explicit {label, delta} objects.
 * @returns {{base:number, applied:Array, totalDelta:number, projected:number, clamped:boolean}}
 */
export function simulateWhatIf(baseScore, changes) {
  const base = clampScore(Number(baseScore));
  if (!Number.isFinite(base)) throw new Error('baseScore must be a number');
  const applied = (Array.isArray(changes) ? changes : []).map(normalizeWhatIfChange);
  const rawTotal = applied.reduce((sum, c) => sum + c.delta, 0);
  const totalDelta = Math.round(rawTotal * 100) / 100;
  const rawProjected = base + totalDelta;
  const projected = clampScore(rawProjected);
  return {
    base,
    applied,
    totalDelta,
    projected,
    clamped: projected !== rawProjected,
  };
}

/* ------------------------------------------------------------------ */
/* 54286 — Scoring model versioning                                    */
/* ------------------------------------------------------------------ */

const MODEL_VERSIONS = new Map();

function compareSemver(a, b) {
  const pa = String(a).split('.').map((p) => Number(p));
  const pb = String(b).split('.').map((p) => Number(p));
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = Number.isFinite(pa[i]) ? pa[i] : 0;
    const y = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (x !== y) return x - y;
  }
  return 0;
}

/**
 * Registers a scoring-model version. Re-registering an existing version throws
 * so historical scores can never be silently redefined.
 * @param {string} version e.g. '2.0.0'
 * @param {{description:string, details?:object}} formula
 * @param {string[]} changelog plain-language list of what changed
 */
export function registerModelVersion(version, formula, changelog) {
  if (!version || typeof version !== 'string') throw new Error('version is required');
  if (MODEL_VERSIONS.has(version)) throw new Error(`model version already registered: ${version}`);
  if (!formula || typeof formula.description !== 'string' || !formula.description) {
    throw new Error('formula.description is required');
  }
  const changes = Array.isArray(changelog) ? changelog : [];
  for (const line of changes) {
    if (typeof line !== 'string' || !line) throw new Error('changelog entries must be non-empty strings');
  }
  const record = {
    version,
    formula: { description: formula.description, details: snapshotValue(formula.details || {}) },
    changelog: [...changes],
    registeredAt: new Date().toISOString(),
  };
  MODEL_VERSIONS.set(version, record);
  return record;
}

/** Returns the registered model version record, or null when unknown. */
export function getModelVersion(version) {
  return MODEL_VERSIONS.get(version) || null;
}

/** All registered versions, oldest first (ascending semver). */
export function listModelVersions() {
  return [...MODEL_VERSIONS.values()].sort((a, b) => compareSemver(a.version, b.version));
}

// Seed history: the model did not appear fully formed — three shipped versions.
registerModelVersion(
  '1.0.0',
  {
    description: 'Initial CVSS-style blend: equal-weight average of exposure, vulnerability and hygiene factors, 0-100.',
    details: { factors: ['exposure', 'vulnerability', 'hygiene'], weights: { exposure: 1, vulnerability: 1, hygiene: 1 } },
  },
  [
    'Initial scoring model shipped with three factors blended equally.',
    'Score bands set at 90/70/40 for Critical/High/Medium/Low.',
  ]
);
registerModelVersion(
  '1.1.0',
  {
    description: 'Added the reachability factor (is the target actually routable from the internet) and reweighted vulnerability from 1.0x to 1.4x.',
    details: { factors: ['exposure', 'vulnerability', 'hygiene', 'reachability'], weights: { exposure: 1, vulnerability: 1.4, hygiene: 1, reachability: 0.8 } },
  },
  [
    'New factor: reachability — internet-facing assets score higher than internal ones.',
    'Vulnerability weight raised 1.0x to 1.4x after portfolio review showed findings clustered on vuln-heavy targets.',
  ]
);
registerModelVersion(
  '2.0.0',
  {
    description: 'Business-logic assumption penalty introduced; formula restructured to weighted average over five factors with per-factor 0-100 normalization.',
    details: { factors: ['exposure', 'vulnerability', 'hygiene', 'businessLogic', 'reachability'], weights: { exposure: 25, vulnerability: 35, hygiene: 15, businessLogic: 15, reachability: 10 } },
  },
  [
    'Major version: formula changed from simple average to weighted average, so scores are NOT directly comparable with 1.x without the migration note.',
    'New factor: businessLogic — targets with broken payment or identity assumptions score higher.',
    'Vulnerability remains the heaviest factor at 35 of 100 weight points.',
  ]
);

/* ------------------------------------------------------------------ */
/* 54287 — Scoring changelog                                           */
/* ------------------------------------------------------------------ */

/**
 * Full plain-language changelog across every registered model version,
 * oldest version first.
 * @returns {Array<{version:string, changes:string[]}>}
 */
export function listModelChangelog() {
  return listModelVersions().map((v) => ({ version: v.version, changes: [...v.changelog] }));
}

/* ------------------------------------------------------------------ */
/* 54288 — Custom scoring weights                                       */
/* ------------------------------------------------------------------ */

export const SCORE_FACTORS = ['exposure', 'vulnerability', 'hygiene', 'businessLogic', 'reachability'];

export const DEFAULT_FACTOR_WEIGHTS = {
  exposure: 25,
  vulnerability: 35,
  hygiene: 15,
  businessLogic: 15,
  reachability: 10,
};

function validateWeights(weights) {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    throw new Error('weights must be an object');
  }
  const cleaned = {};
  for (const [factor, weight] of Object.entries(weights)) {
    if (!SCORE_FACTORS.includes(factor)) throw new Error(`unknown factor: ${factor}`);
    const w = Number(weight);
    if (!Number.isFinite(w) || w < 0) throw new Error(`weight for ${factor} must be a non-negative number`);
    cleaned[factor] = w;
  }
  if (Object.keys(cleaned).length === 0) throw new Error('at least one factor weight is required');
  const sum = Object.values(cleaned).reduce((a, b) => a + b, 0);
  if (sum <= 0) throw new Error('weights must sum to more than zero');
  return cleaned;
}

/**
 * Computes a weighted-average risk score from per-factor 0-100 inputs.
 * Weights are normalized by their sum, so any scale works.
 * @param {object} factors e.g. {exposure: 82, vulnerability: 64, ...}
 * @param {object} weights factor -> weight, default DEFAULT_FACTOR_WEIGHTS
 * @returns {{score:number, contributions:Array<{factor, factorScore, weight, weightedPoints}>, weightSum:number}}
 */
export function applyWeights(factors, weights = DEFAULT_FACTOR_WEIGHTS) {
  const cleanedWeights = validateWeights(weights);
  const f = factors || {};
  const sum = Object.values(cleanedWeights).reduce((a, b) => a + b, 0);
  const contributions = SCORE_FACTORS
    .filter((factor) => factor in cleanedWeights)
    .map((factor) => {
      const factorScore = clampScore(Number(f[factor]));
      const weight = cleanedWeights[factor];
      const weightedPoints = Math.round(((Number.isFinite(factorScore) ? factorScore : 0) * weight) / sum * 100) / 100;
      return { factor, factorScore: Number.isFinite(factorScore) ? factorScore : 0, weight, weightedPoints };
    });
  const score = Math.round(contributions.reduce((a, c) => a + c.weightedPoints, 0) * 100) / 100;
  return { score, contributions, weightSum: sum };
}

/* ------------------------------------------------------------------ */
/* 54289 — Per-client scoring profiles                                 */
/* ------------------------------------------------------------------ */

const CLIENT_PROFILES = new Map();

/**
 * Saves a named weight preset for a client or group. Names are unique —
 * re-creating a name throws so presets are never silently overwritten.
 */
export function createClientProfile(name, weights) {
  if (!name || typeof name !== 'string') throw new Error('name is required');
  if (CLIENT_PROFILES.has(name)) throw new Error(`client profile already exists: ${name}`);
  const cleaned = validateWeights(weights);
  const profile = {
    name,
    weights: { ...cleaned },
    createdAt: new Date().toISOString(),
  };
  CLIENT_PROFILES.set(name, profile);
  return profile;
}

/** Returns the named profile, or null when unknown. */
export function getClientProfile(name) {
  return CLIENT_PROFILES.get(name) || null;
}

/** All saved profiles, sorted by name for a stable listing. */
export function listClientProfiles() {
  return [...CLIENT_PROFILES.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Scores factors with a saved client profile's weights. */
export function scoreWithProfile(factors, profileName) {
  const profile = getClientProfile(profileName);
  if (!profile) throw new Error(`unknown client profile: ${profileName}`);
  return { ...applyWeights(factors, profile.weights), profile: profileName };
}

/* ------------------------------------------------------------------ */
/* 54290 — Bounty likelihood predictor                                  */
/* ------------------------------------------------------------------ */

const PREDICTOR_CONFIDENCE_LEVELS = ['high', 'medium', 'low'];

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Estimates the probability of at least one valid finding on a target from
 * portfolio patterns. Heuristic, deterministic, explainable — not a trained
 * model. probability is in [0, 1].
 *
 * @param {object} targetSignals {vulnCount, criticalCount, exposureScore, hygieneScore, pastValidFindings, daysSinceLastHunt}
 * @param {object} portfolioStats {totalTargets, totalValidFindings}
 * @returns {{probability:number, confidence:'high'|'medium'|'low', reasons:string[]}}
 */
export function predictBountyLikelihood(targetSignals = {}, portfolioStats = {}) {
  const signals = {
    vulnCount: Math.max(0, num(targetSignals.vulnCount)),
    criticalCount: Math.max(0, num(targetSignals.criticalCount)),
    exposureScore: clampScore(num(targetSignals.exposureScore, 50)),
    hygieneScore: clampScore(num(targetSignals.hygieneScore, 50)),
    pastValidFindings: Math.max(0, num(targetSignals.pastValidFindings)),
    daysSinceLastHunt: Math.max(0, num(targetSignals.daysSinceLastHunt)),
  };
  const totalTargets = Math.max(0, num(portfolioStats.totalTargets));
  const totalValidFindings = Math.max(0, num(portfolioStats.totalValidFindings));

  // Portfolio prior: expected valid findings per target, compressed into a base probability.
  const baseRate = totalTargets > 0 ? totalValidFindings / totalTargets : 0.25;
  let probability =
    0.12 +
    0.55 * Math.min(1, baseRate) +
    0.05 * Math.min(signals.criticalCount, 4) +
    0.02 * Math.min(signals.vulnCount, 10) +
    0.18 * (signals.exposureScore / 100) +
    0.1 * (1 - signals.hygieneScore / 100) +
    0.06 * Math.min(signals.pastValidFindings, 3) +
    (signals.daysSinceLastHunt >= 90 ? 0.05 : 0);
  probability = Math.max(0, Math.min(0.98, probability));
  probability = Math.round(probability * 1000) / 1000;

  const confidence =
    totalTargets >= 20 ? 'high' : totalTargets >= 5 ? 'medium' : 'low';

  const reasons = [];
  reasons.push(
    totalTargets > 0
      ? `Portfolio baseline: ${totalValidFindings} valid findings across ${totalTargets} targets.`
      : 'Portfolio baseline: no history yet, using conservative prior.'
  );
  if (signals.criticalCount > 0) reasons.push(`${signals.criticalCount} critical finding(s) already on this target.`);
  if (signals.vulnCount >= 5) reasons.push(`${signals.vulnCount} total findings — high issue density.`);
  if (signals.exposureScore >= 70) reasons.push(`High exposure surface (score ${signals.exposureScore}/100).`);
  if (signals.hygieneScore < 40) reasons.push(`Weak security hygiene (score ${signals.hygieneScore}/100).`);
  if (signals.pastValidFindings > 0) reasons.push('This target has produced valid findings before.');
  if (signals.daysSinceLastHunt >= 90) reasons.push('Not hunted in 90+ days — code drift raises odds.');

  return { probability, confidence, reasons };
}

export { PREDICTOR_CONFIDENCE_LEVELS };
