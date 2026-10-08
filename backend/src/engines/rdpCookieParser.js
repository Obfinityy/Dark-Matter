/**
 * rdpCookieParser.js — RDP routing-token / cookie field parser.
 *
 * Parses the RDP `Cookie:` field carried in the X.224 Connection Request PDU
 * (e.g. "Cookie: mstshash=user" or "Cookie: msts=<routing-token>"). Load
 * balancers and RD Connection Brokers sometimes inject routing tokens that
 * leak internal hostnames, farm names or session-broker identifiers — a
 * useful passive intelligence signal on in-scope targets.
 *
 * Offline parser: callers supply the cookie string as captured.
 */

/** Known cookie prefixes and their meanings. */
export const COOKIE_PREFIXES = {
  mstshash: 'Standard MSTSC hash cookie (username hash)',
  msts: 'Routing token cookie (load balancer / connection broker)',
};

/** Patterns that indicate an internal hostname or farm leaked in the token. */
export const INTERNAL_HOST_PATTERNS = [
  {
    regex: /([a-z0-9][a-z0-9-]*\.(?:local|lan|intranet|internal|corp|domain|dc\d*))(?:\b|$)/i,
    class: 'internal-fqdn',
  },
  {
    regex: /\b([A-Z][A-Z0-9-]{2,}|[a-z][a-z0-9-]{2,})-?(?:RDS|TS|SRV|SERVER|DC|APP|WEB)\d*\b/,
    class: 'hostname-convention',
  },
  { regex: /\b\d{1,3}(?:\.\d{1,3}){3}\b/, class: 'ip-literal' },
  { regex: /farm|collection|broker|gateway|session/i, class: 'farm-identifier' },
];

/**
 * Parse an RDP Cookie field value.
 *
 * @param {string} cookieValue - Full cookie value (after "Cookie: ").
 * @returns {Object} parsed structure.
 */
export function parseRdpCookie(cookieValue) {
  const raw = String(cookieValue || '').trim();
  if (!raw) return { valid: false, reason: 'empty cookie value' };

  const parts = raw
    .split(';')
    .map(p => p.trim())
    .filter(Boolean);
  const fields = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      fields.push({ key: null, value: part });
    } else {
      fields.push({
        key: part.slice(0, eq).trim().toLowerCase(),
        value: part.slice(eq + 1).trim(),
      });
    }
  }

  const routingTokens = fields.filter(f => f.key === 'msts').map(f => f.value);
  const hashCookies = fields.filter(f => f.key === 'mstshash').map(f => f.value);
  const other = fields.filter(f => f.key && f.key !== 'msts' && f.key !== 'mstshash');

  return {
    valid: true,
    raw,
    fieldCount: fields.length,
    fields,
    routingTokens,
    hashCookies,
    otherFields: other,
    hasRoutingToken: routingTokens.length > 0,
  };
}

/**
 * Extract leaked internal identifiers from routing tokens.
 *
 * @param {Array<string>} tokens - Routing token values.
 * @returns {Array<Object>} leaked-identifier findings.
 */
export function extractLeakedIdentifiers(tokens = []) {
  const findings = [];
  for (const token of tokens) {
    const t = String(token);
    for (const p of INTERNAL_HOST_PATTERNS) {
      const m = t.match(p.regex);
      if (m) {
        findings.push({
          token: t.slice(0, 120),
          leaked: m[1] || m[0],
          class: p.class,
          severity: p.class === 'internal-fqdn' || p.class === 'ip-literal' ? 'Medium' : 'Low',
        });
      }
    }
    // Heuristic: GUID-like broker tokens identify the session broker family.
    if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(t)) {
      findings.push({
        token: t.slice(0, 120),
        leaked: 'GUID session identifier',
        class: 'session-guid',
        severity: 'Low',
      });
    }
  }
  return findings;
}

/**
 * Full cookie analysis combining parse + leak extraction.
 *
 * @param {string} cookieValue
 * @returns {Object} analysis.
 */
export function analyzeRdpCookie(cookieValue) {
  const parsed = parseRdpCookie(cookieValue);
  if (!parsed.valid) {
    return { ...parsed, type: 'RDP Cookie Analysis', confidence: 'low' };
  }
  const leaks = extractLeakedIdentifiers(parsed.routingTokens);

  return {
    ...parsed,
    leakedIdentifiers: leaks,
    brokerDetected: parsed.hasRoutingToken,
    summary: parsed.hasRoutingToken
      ? `Routing token cookie present (${parsed.routingTokens.length}); ${leaks.length} internal identifier(s) extracted.`
      : parsed.hashCookies.length
        ? 'Standard mstshash cookie only — no routing token.'
        : 'Cookie field parsed; no recognized RDP cookie keys.',
    type: 'RDP Cookie Analysis',
    confidence: leaks.length ? 'high' : parsed.hasRoutingToken ? 'medium' : 'low',
  };
}

export const RDP_COOKIE_PARSER = {
  COOKIE_PREFIXES,
  INTERNAL_HOST_PATTERNS,
  parseRdpCookie,
  extractLeakedIdentifiers,
  analyzeRdpCookie,
};
export default RDP_COOKIE_PARSER;
