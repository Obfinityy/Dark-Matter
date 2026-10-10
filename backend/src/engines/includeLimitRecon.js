/**
 * includeLimitRecon.js — JSON:API include-limit probing (defensive recon).
 *
 * Idea 01231: measure the maximum relationship-expansion ("include") depth a
 * JSON:API-style list endpoint honors, because unbounded expansion can trigger
 * expensive join queries on an authorized target.
 *
 * Pure planning and response classification — no network calls are made here;
 * the operator's HTTP layer executes the generated probe plan and feeds the
 * observed responses back into the analyzer.
 */

export const JSONAPI_INCLUDE_DEPTHS = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20];

const INCLUDED_MARKERS = [
  { marker: 'too many', label: 'include-rejected' },
  { marker: 'max', label: 'include-capped' },
  { marker: 'invalid', label: 'include-rejected' },
  { marker: 'exceed', label: 'include-rejected' },
  { marker: 'depth', label: 'include-capped' },
];

/**
 * Build a probe plan that escalates the `include` parameter depth step by step.
 * @param {string[]} resourcePaths - e.g. ['/api/users', '/api/orders'].
 * @param {object} [options]
 * @param {string} [options.relationship='rel'] - Relationship name to nest.
 * @param {number[]} [options.depths] - Depth ladder to probe.
 * @returns {{probes: {method: string, path: string, query: Record<string,string>, depth: number}[], strategy: string}}
 */
export function probeJsonApiIncludeLimit(resourcePaths = [], options = {}) {
  const relationship = options.relationship || 'rel';
  const depths = options.depths || JSONAPI_INCLUDE_DEPTHS;
  const probes = [];
  for (const path of resourcePaths) {
    for (const depth of depths) {
      probes.push({
        method: 'GET',
        path,
        query: { include: Array(depth).fill(relationship).join('.') },
        depth,
      });
    }
  }
  return {
    probes,
    strategy:
      'Escalate nested include depth per resource; record the highest depth ' +
      'that returns 2xx with expanded `included` data. A sharp 4xx with an ' +
      'include-depth error message marks the enforced cap.',
  };
}

/**
 * Classify one include probe response.
 * @param {{status: number, headers?: Record<string,string>, body?: unknown}} response
 * @param {number} depth - The include depth that was probed.
 * @returns {{verdict: string, depthHonored: boolean, evidence: string}}
 */
export function analyzeIncludeResponse(response = {}, depth = 0) {
  const { status = 0, body = null } = response;
  const evidence = `HTTP ${status} at include depth ${depth}`;
  if (status >= 200 && status < 300) {
    let includedCount = 0;
    try {
      const json = typeof body === 'string' ? JSON.parse(body) : body;
      if (json && Array.isArray(json.included)) includedCount = json.included.length;
      else if (json && typeof json === 'object' && 'included' in json) includedCount = 1;
    } catch { /* non-JSON body */ }
    return {
      verdict: includedCount > 0 ? 'expanded' : 'accepted-no-expansion',
      depthHonored: true,
      evidence: `${evidence}; ${includedCount} included resource(s) expanded`,
    };
  }
  if (status === 400 || status === 422) {
    const text = String(body ?? '').toLowerCase();
    const hit = INCLUDED_MARKERS.find(m => text.includes(m.marker));
    return {
      verdict: hit ? hit.label : 'client-rejected',
      depthHonored: false,
      evidence: hit ? `${evidence}; server message hints at ${hit.label}` : evidence,
    };
  }
  if (status === 414 || status === 431) {
    return {
      verdict: 'uri-too-long',
      depthHonored: false,
      evidence: `${evidence}; request line/header limit hit before include logic`,
    };
  }
  if (status >= 500) {
    return {
      verdict: 'server-error',
      depthHonored: false,
      evidence: `${evidence}; deep expansion may be overwhelming the backend`,
    };
  }
  return { verdict: 'unclassified', depthHonored: false, evidence };
}

/**
 * Reduce a ladder of analyzed probe results to the maximum honored depth.
 * @param {{depth: number, verdict: string, depthHonored: boolean}[]} analyses
 * @returns {{maxIncludeDepth: number|null, capped: boolean, capDepth: number|null}}
 */
export function summarizeIncludeLimit(analyses = []) {
  const honored = analyses.filter(a => a.depthHonored).map(a => a.depth);
  const maxIncludeDepth = honored.length ? Math.max(...honored) : null;
  const cappedProbe = analyses.find(a => a.verdict === 'include-capped' || a.verdict === 'include-rejected');
  return {
    maxIncludeDepth,
    capped: cappedProbe != null,
    capDepth: cappedProbe ? cappedProbe.depth : null,
  };
}
