/**
 * cvss.js — CVSS v3.1 base-score math + severity vocabulary for the agent.
 *
 * The brain may attach `cvssMetrics` when it files a finding (full metric
 * values, abbreviations, or a vector string). `cvssBaseScore` turns those into
 * a deterministic score; when the brain provides no metrics,
 * `severityToRating` maps the plain severity label to a display rating so a
 * report line is never blank and never crashes on bad model output.
 */

const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC = { L: 0.77, H: 0.44 };
const PR_UNCHANGED = { N: 0.85, L: 0.62, H: 0.27 };
const PR_CHANGED = { N: 0.85, L: 0.68, H: 0.5 };
const UI = { N: 0.85, R: 0.62 };
const CIA = { H: 0.56, L: 0.22, N: 0 };

const LONG_TO_SHORT = {
  attackVector: 'AV', attackComplexity: 'AC', privilegesRequired: 'PR',
  userInteraction: 'UI', scope: 'S', confidentiality: 'C', integrity: 'I', availability: 'A',
  network: 'N', adjacent: 'A', local: 'L', physical: 'P',
  low: 'L', high: 'H', none: 'N', required: 'R', unchanged: 'U', changed: 'C'
};

function short(value) {
  if (value === null || value === undefined) return null;
  const key = String(value).trim().toLowerCase().replace(/[^a-z]/g, '');
  return LONG_TO_SHORT[key] || String(value).trim().toUpperCase().slice(0, 1).toUpperCase();
}

/** Parse a `CVSS:3.1/AV:N/AC:L/...` vector string into a metric map. */
function parseVector(vector) {
  const metrics = {};
  for (const part of String(vector || '').split('/')) {
    const [k, v] = part.split(':');
    if (k && v && k.length <= 3) metrics[k.trim().toUpperCase()] = v.trim().toUpperCase();
  }
  return metrics;
}

/** CVSS "roundup": smallest 1-decimal number >= input. */
function roundup(value) {
  const scaled = value * 100000;
  if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return Math.round(scaled) / 100000;
  return (Math.floor(scaled / 10000) + 1) / 10;
}

function ratingFor(score) {
  if (!score || score <= 0) return 'None';
  if (score < 4.0) return 'Low';
  if (score < 7.0) return 'Medium';
  if (score < 9.0) return 'High';
  return 'Critical';
}

/**
 * Compute the CVSS v3.1 base score from brain-supplied metrics.
 * Accepts: { attackVector|AV, ..., vector } or a precomputed { baseScore }.
 * Returns { score, rating, vector, metrics } — never throws.
 */
export function cvssBaseScore(input = {}) {
  const metrics = { ...(input || {}) };
  if (metrics.vector && !metrics.AV) Object.assign(metrics, parseVector(metrics.vector));

  const get = (...keys) => {
    for (const k of keys) {
      const v = metrics[k];
      if (v !== undefined && v !== null && v !== '') return short(v);
    }
    return null;
  };

  // A precomputed score from the brain is trusted after a sanity clamp.
  if (metrics.baseScore !== undefined && metrics.baseScore !== null) {
    const score = Math.max(0, Math.min(10, Number(metrics.baseScore) || 0));
    return {
      score: Math.round(score * 10) / 10,
      rating: ratingFor(score),
      vector: metrics.vector || null,
      metrics
    };
  }

  const av = AV[get('AV', 'attackVector')] ?? null;
  const ac = AC[get('AC', 'attackComplexity')] ?? null;
  const s = get('S', 'scope');
  const scopeChanged = s === 'C';
  const prTable = scopeChanged ? PR_CHANGED : PR_UNCHANGED;
  const pr = prTable[get('PR', 'privilegesRequired')] ?? null;
  const ui = UI[get('UI', 'userInteraction')] ?? null;
  const c = CIA[get('C', 'confidentiality')] ?? null;
  const i = CIA[get('I', 'integrity')] ?? null;
  const a = CIA[get('A', 'availability')] ?? null;

  if ([av, ac, pr, ui, c, i, a].some((v) => v === null) || !s) {
    throw new Error('cvssMetrics is missing required base metrics (need AV/AC/PR/UI/S/C/I/A or a vector/baseScore)');
  }

  const iscBase = 1 - (1 - c) * (1 - i) * (1 - a);
  const exploitability = 8.22 * av * ac * pr * ui;
  let impact;
  let score;
  if (!scopeChanged) {
    impact = 6.42 * iscBase;
    score = roundup(Math.min(impact + exploitability, 10));
  } else {
    impact = 7.52 * (iscBase - 0.029) - 3.25 * Math.pow(Math.max(iscBase - 0.02, 0), 15);
    score = roundup(Math.min(1.08 * (impact + exploitability), 10));
  }
  if (impact <= 0) score = 0;

  const vector = metrics.vector ||
    `CVSS:3.1/AV:${get('AV', 'attackVector')}/AC:${get('AC', 'attackComplexity')}` +
    `/PR:${get('PR', 'privilegesRequired')}/UI:${get('UI', 'userInteraction')}/S:${s}` +
    `/C:${get('C', 'confidentiality')}/I:${get('I', 'integrity')}/A:${get('A', 'availability')}`;

  return { score, rating: ratingFor(score), vector, metrics };
}

const SEVERITY_RATING = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Informational',
  informational: 'Informational',
  none: 'None'
};

/** Map a plain severity label to a display rating (fallback when no metrics). */
export function severityToRating(severity) {
  return SEVERITY_RATING[String(severity || '').toLowerCase().trim()] || 'Informational';
}
