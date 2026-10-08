/**
 * wafCanaryProber.js — WAF behavior probing with canaries.
 *
 * Idea 00389: send benign canary payloads to map WAF block vs log behavior
 * without attacking.
 *
 * SAFETY: every canary in the built-in set is inert by construction — long
 * URLs, odd casing, double slashes, unusual-but-harmless headers, and unique
 * marker tokens that carry no executable content. Nothing here attempts to
 * bypass, exploit, or exfiltrate. The module builds the probe plan and then
 * *classifies* operator-captured responses as passed / logged / blocked /
 * challenged, producing a behavior map for the report.
 */

/**
 * Build a benign canary probe plan for a target URL.
 * @param {string} baseUrl - e.g. 'https://target.example/search'
 * @param {{marker?: string}} [options]
 * @returns {{probes: {id: string, method: string, url: string, headers: object, note: string}[]}}
 */
export function buildCanaryPlan(baseUrl, options = {}) {
  if (typeof baseUrl !== 'string' || !/^https?:\/\//i.test(baseUrl)) {
    throw new Error('buildCanaryPlan: baseUrl must be an http(s) URL');
  }
  const marker = options.marker || `dm-canary-${Date.now().toString(36)}`;
  const url = baseUrl.replace(/\/$/, '');
  const probes = [
    {
      id: 'baseline',
      method: 'GET',
      url: `${url}?canary=${marker}`,
      headers: {},
      note: 'Clean baseline: unique marker token, no anomalies — must pass.',
    },
    {
      id: 'long-path',
      method: 'GET',
      url: `${url}/${'a'.repeat(512)}?canary=${marker}`,
      headers: {},
      note: 'Oversized path segment (512 chars) — inert, tests length limits.',
    },
    {
      id: 'double-slash',
      method: 'GET',
      url: `${url}//double//slashes?canary=${marker}`,
      headers: {},
      note: 'Redundant path separators — inert, tests normalization.',
    },
    {
      id: 'mixed-case',
      method: 'GET',
      url: `${url}?CaNaRy=${marker}&OTHER=VALUE`,
      headers: {},
      note: 'Mixed-case parameter names — inert, tests case handling.',
    },
    {
      id: 'encoded-space',
      method: 'GET',
      url: `${url}?q=hello%20world%2Btest&canary=${marker}`,
      headers: {},
      note: 'Percent-encoded spaces — inert, tests decoding layers.',
    },
    {
      id: 'odd-header',
      method: 'GET',
      url: `${url}?canary=${marker}`,
      headers: { 'X-Canary-Probe': marker, 'X-Empty-Value': '' },
      note: 'Unusual but harmless custom headers — inert, tests header inspection.',
    },
    {
      id: 'long-header',
      method: 'GET',
      url: `${url}?canary=${marker}`,
      headers: { 'X-Canary-Long': 'b'.repeat(1024) },
      note: '1024-char header value — inert, tests header size limits.',
    },
    {
      id: 'null-byte-shape',
      method: 'GET',
      url: `${url}?name=user%00guest&canary=${marker}`,
      headers: {},
      note: 'Encoded null byte inside a plain value — no file access attempted; tests how the WAF treats it.',
    },
    {
      id: 'semicolon-param',
      method: 'GET',
      url: `${url}?a=1;canary=${marker}`,
      headers: {},
      note: 'Semicolon parameter separator — inert, tests parser strictness.',
    },
    {
      id: 'head-method',
      method: 'HEAD',
      url: `${url}?canary=${marker}`,
      headers: {},
      note: 'HEAD instead of GET — inert, tests method policy.',
    },
  ];
  return { probes, marker };
}

/**
 * @typedef {Object} ProbeResult
 * @property {string} id - Probe id from the plan.
 * @property {number} status - Observed HTTP status.
 * @property {Record<string,string>} [headers]
 * @property {string} [bodySnippet]
 * @property {number} [rttMs] - Round-trip time.
 */

/**
 * Classify one captured probe response.
 * @param {ProbeResult} result
 * @param {ProbeResult} baseline - The captured baseline probe for comparison.
 * @returns {{verdict: 'passed'|'blocked'|'challenged'|'logged'|'anomalous', signals: string[], confidence: string}}
 */
export function classifyProbe(result, baseline = null) {
  const signals = [];
  const body = (result.bodySnippet || '').toLowerCase();
  const status = result.status;

  const challengeMarkers = [/captcha/i, /cf-chl-/, /challenge/i, /please verify/i, /incapsula/i];
  const blockMarkers = [
    /blocked/i,
    /forbidden/i,
    /access denied/i,
    /request rejected/i,
    /waf/i,
    /incident id/i,
  ];
  const isChallenge = challengeMarkers.some(re => re.test(body));
  const looksBlocked = blockMarkers.some(re => re.test(body));

  let verdict;
  if (isChallenge) {
    verdict = 'challenged';
    signals.push('challenge/captcha page markers in response body');
  } else if (status === 403 || status === 406 || status === 419 || status === 501) {
    verdict = 'blocked';
    signals.push(`blocking status ${status}`);
  } else if (looksBlocked) {
    verdict = 'blocked';
    signals.push('block-page language in response body');
  } else if (baseline && status !== baseline.status) {
    verdict = 'anomalous';
    signals.push(`status ${status} differs from baseline ${baseline.status}`);
  } else if (
    baseline &&
    result.rttMs != null &&
    baseline.rttMs != null &&
    result.rttMs > baseline.rttMs * 3
  ) {
    verdict = 'logged';
    signals.push(
      `RTT ${result.rttMs}ms is >3x baseline ${baseline.rttMs}ms — possible async logging/inspection`
    );
  } else {
    verdict = 'passed';
    signals.push('indistinguishable from baseline');
  }

  const confidence =
    verdict === 'passed' ? 'high' : isChallenge || looksBlocked ? 'high' : 'medium';
  return { verdict, signals, confidence };
}

/**
 * Build the full WAF behavior map from a captured probe run.
 * @param {{id: string, note?: string}[]} plan - Probe descriptors (from buildCanaryPlan).
 * @param {ProbeResult[]} results - Captured results, same order or matched by id.
 */
export function mapWafBehavior(plan = [], results = []) {
  const byId = new Map(results.map(r => [r.id, r]));
  const baseline = byId.get('baseline') || null;
  const mapped = [];
  for (const probe of plan) {
    const res = byId.get(probe.id);
    if (!res) {
      mapped.push({
        id: probe.id,
        verdict: 'anomalous',
        signals: ['no captured response'],
        confidence: 'low',
        note: probe.note,
      });
      continue;
    }
    mapped.push({
      id: probe.id,
      note: probe.note,
      status: res.status,
      ...classifyProbe(res, baseline),
    });
  }
  const counts = {};
  for (const m of mapped) counts[m.verdict] = (counts[m.verdict] || 0) + 1;
  const blocking = (counts.blocked || 0) + (counts.challenged || 0);
  return {
    mapped,
    counts,
    summary: {
      total: mapped.length,
      blocking,
      strictness: blocking === 0 ? 'permissive' : blocking <= 2 ? 'selective' : 'aggressive',
    },
  };
}

/**
 * Build a report finding from the behavior map.
 * @param {ReturnType<typeof mapWafBehavior>} behavior
 * @param {string} targetLabel
 */
export function canaryFinding(behavior, targetLabel = 'target') {
  return {
    title: `WAF canary behavior map — ${targetLabel}: ${behavior.summary.strictness} (${behavior.summary.blocking}/${behavior.summary.total} probes blocked or challenged)`,
    severity: 'Info',
    confidence: behavior.summary.total >= 5 ? 'high' : 'medium',
    strictness: behavior.summary.strictness,
    counts: behavior.counts,
    probes: behavior.mapped.map(m => ({
      id: m.id,
      verdict: m.verdict,
      status: m.status,
      signals: m.signals,
    })),
    evidence:
      'All probes were inert canaries; no attack payload was sent. ' +
      `${behavior.summary.blocking} of ${behavior.summary.total} canary probes were blocked or challenged.`,
  };
}

export const WAF_CANARY_PROBER = { buildCanaryPlan, classifyProbe, mapWafBehavior, canaryFinding };
export default WAF_CANARY_PROBER;
