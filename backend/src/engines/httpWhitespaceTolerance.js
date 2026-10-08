/**
 * httpWhitespaceTolerance.js — HTTP whitespace-tolerance probing analysis for autonomous bug bounty.
 *
 * Implements idea-bank item 00416: analyze a parser's tolerance for
 * whitespace anomalies in the request line and header field lines
 * (obs-fold, leading/trailing spaces, tab separators) to identify the
 * parser family.
 *
 * All functions are pure and side-effect free: they classify whitespace
 * probe observations the caller recorded with safe, spec-deviation
 * probes during an authorized engagement. No network activity happens here.
 */

/**
 * Whitespace anomaly probes and their strictness meaning.
 * @type {Array<{probe:string, meaning:string}>}
 */
export const WHITESPACE_PROBES = [
  { probe: 'space-before-colon', meaning: 'space between field name and colon' },
  { probe: 'tab-after-value', meaning: 'horizontal tab trailing a field value' },
  { probe: 'obs-fold', meaning: 'obsolete line folding (CRLF + SP) in field value' },
  { probe: 'leading-space-request-line', meaning: 'space before the request method token' },
  { probe: 'multiple-spaces-request-line', meaning: 'multiple spaces between request-line tokens' },
  { probe: 'trailing-space-request-target', meaning: 'space before the HTTP version token' },
  { probe: 'bare-lf', meaning: 'lone LF line terminator instead of CRLF' },
  { probe: 'vertical-tab-in-value', meaning: 'vertical tab embedded in a field value' },
];

/**
 * Parser strictness tiers derived from probe outcomes.
 * @type {Array<{tier:string, acceptedProbes:string[], description:string}>}
 */
export const PARSER_TIERS = [
  { tier: 'strict-rfc', acceptedProbes: [], description: 'rejects every whitespace deviation' },
  {
    tier: 'moderate',
    acceptedProbes: ['tab-after-value', 'multiple-spaces-request-line'],
    description: 'tolerates benign spacing, rejects obs-fold and bare LF',
  },
  {
    tier: 'permissive',
    acceptedProbes: [
      'space-before-colon',
      'tab-after-value',
      'obs-fold',
      'multiple-spaces-request-line',
      'bare-lf',
    ],
    description: 'accepts obsolete and malformed framing — desync-prone',
  },
];

/**
 * Score whitespace-tolerance observations.
 * @param {Array<object>} observations Each: { probe:string, accepted:boolean, status:number|null, normalized:boolean }
 * @returns {{accepted:string[], rejected:string[], toleranceScore:number, notes:string[]}}
 */
export function scoreWhitespaceTolerance(observations) {
  const list = Array.isArray(observations) ? observations : [];
  const accepted = [];
  const rejected = [];
  const notes = [];
  for (const o of list) {
    if (o.accepted) accepted.push(o.probe);
    else rejected.push(o.probe);
    if (o.accepted && o.normalized)
      notes.push(`probe "${o.probe}" accepted and normalized to standard framing`);
    if (o.accepted && (o.probe === 'obs-fold' || o.probe === 'bare-lf')) {
      notes.push(`probe "${o.probe}" accepted — parser diverges from strict RFC framing`);
    }
  }
  const toleranceScore = list.length > 0 ? accepted.length / list.length : 0;
  return { accepted, rejected, toleranceScore, notes };
}

/**
 * Map tolerance scoring to a parser tier.
 * @param {{accepted:string[], toleranceScore:number}} scored Output of scoreWhitespaceTolerance.
 * @returns {{tier:string, confidence:number, description:string, implications:string[]}}
 */
export function identifyParserTier(scored) {
  let best = PARSER_TIERS[0];
  let bestOverlap = -1;
  for (const tier of PARSER_TIERS) {
    const overlap = tier.acceptedProbes.filter(p => scored.accepted.includes(p)).length;
    const unexpected = scored.accepted.filter(p => !tier.acceptedProbes.includes(p)).length;
    const score = overlap - unexpected;
    if (score > bestOverlap) {
      bestOverlap = score;
      best = tier;
    }
  }
  const implications = [];
  if (best.tier === 'permissive') {
    implications.push(
      'permissive parsing widens the desync surface — prioritize smuggling differentials'
    );
    implications.push('flag in report: parser accepts obsolete framing constructs');
  } else if (best.tier === 'strict-rfc') {
    implications.push('strict parser — desync unlikely at the framing layer');
  }
  const confidence =
    scored.accepted.length + best.acceptedProbes.length > 0
      ? Math.max(0, bestOverlap) / Math.max(1, best.acceptedProbes.length)
      : 0.3;
  return {
    tier: best.tier,
    confidence: Math.min(0.95, confidence + 0.2),
    description: best.description,
    implications,
  };
}
