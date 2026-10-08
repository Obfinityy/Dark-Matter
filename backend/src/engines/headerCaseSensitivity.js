/**
 * headerCaseSensitivity.js — HTTP header-name case-handling analysis for autonomous bug bounty.
 *
 * Implements idea-bank item 00414: analyze how a server handles header
 * names sent in different cases to distinguish server frameworks.
 *
 * All functions are pure and side-effect free: they classify observation
 * records describing how the target responded to case-variant headers
 * during an authorized engagement. No network activity happens here.
 */

/**
 * Framework case-handling signatures.
 * @type {Array<{framework:string, canonicalizes:boolean, preservesCustom:boolean, notes:string}>}
 */
export const CASE_SIGNATURES = [
  {
    framework: 'Go net/http',
    canonicalizes: true,
    preservesCustom: false,
    notes: 'canonical MIME header key form',
  },
  {
    framework: 'Node.js (Express/Fastify)',
    canonicalizes: false,
    preservesCustom: true,
    notes: 'headers lowercased on parse, custom names preserved',
  },
  {
    framework: 'Python (Django/Werkzeug)',
    canonicalizes: true,
    preservesCustom: false,
    notes: 'WSGI environ keys uppercased with HTTP_ prefix',
  },
  {
    framework: 'Java (Servlet/Tomcat)',
    canonicalizes: false,
    preservesCustom: true,
    notes: 'case-insensitive lookup, original case preserved in iteration',
  },
  {
    framework: '.NET (Kestrel)',
    canonicalizes: false,
    preservesCustom: true,
    notes: 'case-insensitive dictionary, insertion order kept',
  },
  {
    framework: 'Ruby (Rack/Puma)',
    canonicalizes: true,
    preservesCustom: false,
    notes: 'rack input downcases to HTTP_* convention',
  },
];

/**
 * Analyze a batch of case-variant observations.
 * @param {Array<object>} observations Each: { header:string, sentCase:'lower'|'upper'|'mixed',
 *   accepted:boolean, echoedCase:string|null, matchedRouting:boolean }
 * @returns {{canonicalizes:boolean|null, preservesCustom:boolean|null, acceptedVariants:string[], rejectedVariants:string[], evidence:string[]}}
 */
export function analyzeCaseHandling(observations) {
  const list = Array.isArray(observations) ? observations : [];
  const acceptedVariants = new Set();
  const rejectedVariants = new Set();
  const evidence = [];
  let canonicalHits = 0;
  let preserveHits = 0;
  let comparable = 0;
  for (const o of list) {
    if (o.accepted) acceptedVariants.add(o.sentCase);
    else rejectedVariants.add(o.sentCase);
    if (o.accepted && o.echoedCase) {
      comparable += 1;
      const sent = String(o.header || '');
      const echoed = String(o.echoedCase);
      // canonical form: X-Custom-Header style
      const canonical = sent
        .toLowerCase()
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join('-');
      if (echoed === canonical) {
        canonicalHits += 1;
        evidence.push(`${o.header}: server rewrote ${o.sentCase} case to canonical form`);
      } else if (echoed === sent) {
        preserveHits += 1;
        evidence.push(`${o.header}: server preserved original ${o.sentCase} case`);
      } else {
        evidence.push(`${o.header}: server normalized to "${echoed}"`);
      }
    }
    if (o.matchedRouting === false && o.accepted) {
      evidence.push(`${o.header}: accepted but routing behaved differently than lowercase variant`);
    }
  }
  const canonicalizes = comparable > 0 ? canonicalHits / comparable >= 0.5 : null;
  const preservesCustom = comparable > 0 ? preserveHits / comparable >= 0.5 : null;
  return {
    canonicalizes,
    preservesCustom,
    acceptedVariants: [...acceptedVariants],
    rejectedVariants: [...rejectedVariants],
    evidence,
  };
}

/**
 * Match case-handling analysis against framework signatures.
 * @param {{canonicalizes:boolean|null, preservesCustom:boolean|null}} analysis Output of analyzeCaseHandling.
 * @returns {Array<{framework:string, confidence:number, reason:string}>} sorted by confidence.
 */
export function fingerprintFramework(analysis) {
  const results = [];
  for (const sig of CASE_SIGNATURES) {
    let score = 0;
    let total = 0;
    if (analysis.canonicalizes != null) {
      total += 1;
      if (sig.canonicalizes === analysis.canonicalizes) score += 1;
    }
    if (analysis.preservesCustom != null) {
      total += 1;
      if (sig.preservesCustom === analysis.preservesCustom) score += 1;
    }
    if (total === 0) continue;
    results.push({
      framework: sig.framework,
      confidence: score / total,
      reason: sig.notes,
    });
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}
