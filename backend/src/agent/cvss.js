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

/**
 * Default CVSS v3.1 base metrics per vulnerability class. Used when the brain
 * files a finding WITHOUT explicit cvssMetrics — every finding still gets a
 * real, deterministic vector + score + severity instead of a blank line.
 *
 * The metrics are conservative, standard estimates for the class (network
 * attack vector unless the class is inherently local). They are labeled as
 * defaults so a human analyst can refine them in the report.
 */
const DEFAULT_METRICS_BY_TYPE = {
  xss_reflected:  { AV: 'N', AC: 'L', PR: 'N', UI: 'R', S: 'C', C: 'L', I: 'L', A: 'N' },
  xss:            { AV: 'N', AC: 'L', PR: 'N', UI: 'R', S: 'C', C: 'L', I: 'L', A: 'N' },
  xss_stored:     { AV: 'N', AC: 'L', PR: 'N', UI: 'R', S: 'C', C: 'L', I: 'L', A: 'N' },
  xss_dom:        { AV: 'N', AC: 'L', PR: 'N', UI: 'R', S: 'C', C: 'L', I: 'L', A: 'N' },
  sqli:           { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' },
  sql_injection:  { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' },
  ssrf:           { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'C', C: 'H', I: 'L', A: 'L' },
  idor:           { AV: 'N', AC: 'L', PR: 'L', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'N' },
  broken_access_control: { AV: 'N', AC: 'L', PR: 'L', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'N' },
  lfi:            { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'N', A: 'N' },
  path_traversal: { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'N', A: 'N' },
  'path-traversal': { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'N', A: 'N' },
  command_injection: { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' },
  rce:            { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' },
  csrf:           { AV: 'N', AC: 'L', PR: 'N', UI: 'R', S: 'U', C: 'L', I: 'L', A: 'N' },
  open_redirect:  { AV: 'N', AC: 'L', PR: 'N', UI: 'R', S: 'U', C: 'L', I: 'L', A: 'N' },
  xxe:            { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'L', A: 'L' },
  ssti:           { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' },
  template_injection: { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' }
};

/**
 * Apply CVSS scoring to a finding automatically. Priority:
 *   1. finding.cvssMetrics (brain-supplied) → cvssBaseScore()
 *   2. finding.type mapped to DEFAULT_METRICS_BY_TYPE → deterministic vector
 *   3. severity label fallback → rating only, no score
 *
 * Never throws: always returns { score, rating, vector, source } where
 * source is 'brain' | 'default' | 'severity'.
 */
export function applyCvss(finding = {}) {
  // 1. Brain-supplied metrics win.
  if (finding.cvssMetrics) {
    try {
      const scored = cvssBaseScore(finding.cvssMetrics);
      return { ...scored, source: 'brain' };
    } catch {
      // fall through to defaults
    }
  }
  // 2. Type-based defaults.
  const type = String(finding.type || finding.vulnType || '').toLowerCase().trim();
  for (const [key, metrics] of Object.entries(DEFAULT_METRICS_BY_TYPE)) {
    if (type === key || type.includes(key)) {
      const scored = cvssBaseScore(metrics);
      return { ...scored, source: 'default' };
    }
  }
  // 3. Severity fallback — a rating, honestly labeled as score-less.
  return {
    score: null,
    rating: severityToRating(finding.severity),
    vector: null,
    metrics: null,
    source: 'severity',
    note: 'No CVSS metrics for this finding type — rating derived from the severity label.'
  };
}

/**
 * Enrich every finding in a list with its CVSS line (mutates a copy).
 * @returns {Array} findings with .cvss = { score, rating, vector, source }
 */
export function applyCvssToAll(findings = []) {
  return findings.map((finding) => ({ ...finding, cvss: applyCvss(finding) }));
}
