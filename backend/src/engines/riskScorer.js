/**
 * riskScorer.js — CVSS-style risk scoring for findings.
 *
 * Scores each finding 0.0–10.0 across exploitability + impact, then maps
 * to bug-bounty style severity: Critical / High / Medium / Low / Info.
 * Used to prioritize what the agent reports first.
 */

const SEVERITY_BANDS = [
  { min: 9.0, label: 'Critical' },
  { min: 7.0, label: 'High' },
  { min: 4.0, label: 'Medium' },
  { min: 0.1, label: 'Low' },
  { min: 0.0, label: 'Info' },
];

// Base scores per vulnerability class (before context adjustments).
const BASE_SCORES = {
  'SQL Injection': 8.5,
  'Cross-Site Scripting (XSS)': 6.5,
  'SSRF candidate': 8.0,
  'IDOR candidate': 7.0,
  'Open Redirect': 4.5,
  'Sensitive Exposure': 7.5,
  'Default Credentials': 9.0,
};

const CONFIDENCE_MULTIPLIER = { high: 1.0, medium: 0.85, low: 0.65 };

/**
 * Score a finding. Returns { score, severity, breakdown }.
 */
export function scoreFinding(finding = {}) {
  const type = finding.type || 'Unknown';
  const confidence = finding.confidence || 'low';

  // Find base score (fuzzy match on type).
  let base = 5.0;
  for (const [key, val] of Object.entries(BASE_SCORES)) {
    if (type.toLowerCase().includes(key.toLowerCase().split(' ')[0])) {
      base = val;
      break;
    }
  }

  const confMult = CONFIDENCE_MULTIPLIER[confidence] ?? 0.65;
  let score = base * confMult;

  // Context adjustments.
  const adjustments = [];
  const url = String(finding.url || '');
  if (/admin|internal|prod/i.test(url)) {
    score += 0.5;
    adjustments.push('+0.5 admin/prod context');
  }
  if (finding.authenticated === true) {
    score -= 0.5;
    adjustments.push('-0.5 requires authentication');
  }
  if (finding.evidence && String(finding.evidence).length > 50) {
    score += 0.3;
    adjustments.push('+0.3 strong evidence');
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  const severity = SEVERITY_BANDS.find(b => score >= b.min)?.label || 'Info';

  return {
    score,
    severity,
    breakdown: { base, confidence, confidenceMultiplier: confMult, adjustments },
  };
}

/**
 * Sort findings by score descending (highest risk first).
 */
export function prioritize(findings = []) {
  return findings
    .map(f => ({ ...f, risk: scoreFinding(f) }))
    .sort((a, b) => b.risk.score - a.risk.score);
}

export const RISK_SCORER = { scoreFinding, prioritize, SEVERITY_BANDS };
export default RISK_SCORER;
